/**
 * Browser Arcade - Snake Retro Game Engine (Pure Model)
 *
 * Completely decoupled from UI, DOM, and audio.
 * Zero external dependencies.
 * Deterministic grid coordinates, collision detection, and lifecycle management.
 */

export const Direction = Object.freeze({
  UP: Object.freeze({ x: 0, y: -1, name: 'UP' }),
  DOWN: Object.freeze({ x: 0, y: 1, name: 'DOWN' }),
  LEFT: Object.freeze({ x: -1, y: 0, name: 'LEFT' }),
  RIGHT: Object.freeze({ x: 1, y: 0, name: 'RIGHT' })
});

export const GameStatus = Object.freeze({
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
});

export class GameEngine {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.cols=20] Number of grid columns
   * @param {number} [options.rows=20] Number of grid rows
   * @param {Array<{x: number, y: number}>} [options.initialSnake=null] Optional starting snake
   * @param {Object} [options.initialDirection=null] Optional starting direction
   * @param {Function} [options.randomFn=Math.random] Custom PRNG for deterministic testing
   * @param {number} [options.bestScore=0] Initial best score
   */
  constructor(options = {}) {
    this.cols = options.cols || 20;
    this.rows = options.rows || 20;
    this.randomFn = options.randomFn || Math.random;
    this.bestScore = options.bestScore || 0;

    this.snake = [];
    this.direction = Direction.RIGHT;
    this.inputQueue = [];
    this.food = null;
    this.score = 0;
    this.foodEaten = 0;
    this.status = GameStatus.IDLE;

    if (options.initialSnake) {
      this.snake = options.initialSnake.map(seg => ({ ...seg }));
      this.direction = options.initialDirection || Direction.RIGHT;
      this.spawnFood();
    } else {
      this.reset();
    }
  }

  /**
   * Resets the game to initial starting state.
   */
  reset() {
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);

    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];

    this.direction = Direction.RIGHT;
    this.inputQueue = [];
    this.score = 0;
    this.foodEaten = 0;
    this.status = GameStatus.IDLE;
    this.spawnFood();
  }

  /**
   * Starts or restarts gameplay.
   */
  start() {
    if (this.status === GameStatus.GAME_OVER) {
      this.reset();
    }
    this.status = GameStatus.PLAYING;
  }

  /**
   * Pauses active gameplay.
   */
  pause() {
    if (this.status === GameStatus.PLAYING) {
      this.status = GameStatus.PAUSED;
      return true;
    }
    return false;
  }

  /**
   * Resumes paused gameplay.
   */
  resume() {
    if (this.status === GameStatus.PAUSED) {
      this.status = GameStatus.PLAYING;
      return true;
    }
    return false;
  }

  /**
   * Toggles pause/play state.
   * @returns {string} New status
   */
  togglePause() {
    if (this.status === GameStatus.PLAYING) {
      this.pause();
    } else if (this.status === GameStatus.PAUSED) {
      this.resume();
    } else if (this.status === GameStatus.IDLE) {
      this.start();
    }
    return this.status;
  }

  /**
   * Helper to check if two directions are exact opposites (180 deg reverse).
   * @private
   */
  _isOpposite(dirA, dirB) {
    return dirA.x + dirB.x === 0 && dirA.y + dirB.y === 0;
  }

  /**
   * Validates and queues a direction change.
   * Prevents 180-degree instant reversal and buffers up to 2 inputs per tick.
   * @param {string|Object} direction
   * @returns {boolean} Whether direction was queued
   */
  queueDirection(direction) {
    let target = direction;
    if (typeof direction === 'string') {
      target = Direction[direction.toUpperCase()];
    }

    if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
      return false;
    }

    // Reference direction is the last queued direction, or current direction if queue empty
    const refDir = this.inputQueue.length > 0
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.direction;

    // Prevent immediate reversal or redundant duplicate direction
    if (this._isOpposite(target, refDir) || target.name === refDir.name) {
      return false;
    }

    // Limit buffer to 2 commands
    if (this.inputQueue.length < 2) {
      this.inputQueue.push(target);
      return true;
    }

    return false;
  }

  /**
   * Finds all empty grid cells not occupied by any snake segment.
   * @returns {Array<{x: number, y: number}>}
   */
  getEmptyCells() {
    const occupied = new Set();
    for (const segment of this.snake) {
      occupied.add(`${segment.x},${segment.y}`);
    }

    const empty = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }
    return empty;
  }

  /**
   * Spawns food randomly in an unoccupied cell.
   * @returns {{x: number, y: number}|null}
   */
  spawnFood() {
    const emptyCells = this.getEmptyCells();
    if (emptyCells.length === 0) {
      this.food = null;
      return null;
    }

    const index = Math.floor(this.randomFn() * emptyCells.length);
    this.food = emptyCells[index];
    return this.food;
  }

  /**
   * Computes the current tick interval (speed progression).
   * Accelerates as food is eaten, down to a responsive cap.
   * @returns {number} Milliseconds per tick
   */
  getSpeed() {
    // Initial 145ms, accelerating by 4ms per food, capped at 65ms
    return Math.max(65, 145 - (this.foodEaten * 4));
  }

  /**
   * Advances the game one step.
   * Evaluates input, movement, collisions, and food ingestion.
   * @returns {Object} Step outcome
   */
  tick() {
    if (this.status !== GameStatus.PLAYING) {
      return { moved: false, status: this.status };
    }

    // Dequeue next validated direction if present
    if (this.inputQueue.length > 0) {
      this.direction = this.inputQueue.shift();
    }

    const head = this.snake[0];
    const nextHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    };

    // 1. Wall Collision Check
    if (
      nextHead.x < 0 ||
      nextHead.x >= this.cols ||
      nextHead.y < 0 ||
      nextHead.y >= this.rows
    ) {
      this.status = GameStatus.GAME_OVER;
      return {
        moved: false,
        gameOver: true,
        reason: 'WALL_COLLISION',
        score: this.score,
        bestScore: this.bestScore
      };
    }

    const isEating = this.food && nextHead.x === this.food.x && nextHead.y === this.food.y;

    // 2. Self Collision Check
    // If eating, tail will stay in place; if not eating, tail will vacate this step.
    const segmentsToCheck = isEating ? this.snake : this.snake.slice(0, -1);
    const selfCollided = segmentsToCheck.some(
      seg => seg.x === nextHead.x && seg.y === nextHead.y
    );

    if (selfCollided) {
      this.status = GameStatus.GAME_OVER;
      return {
        moved: false,
        gameOver: true,
        reason: 'SELF_COLLISION',
        score: this.score,
        bestScore: this.bestScore
      };
    }

    // 3. Move snake forward
    this.snake.unshift(nextHead);

    if (isEating) {
      this.score += 10;
      this.foodEaten += 1;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }

      const nextFood = this.spawnFood();
      const isWon = nextFood === null; // Board completely filled

      if (isWon) {
        this.status = GameStatus.GAME_OVER;
      }

      return {
        moved: true,
        ateFood: true,
        score: this.score,
        bestScore: this.bestScore,
        food: this.food,
        speed: this.getSpeed(),
        gameOver: isWon,
        won: isWon
      };
    }

    // Normal move: remove tail
    this.snake.pop();

    return {
      moved: true,
      ateFood: false,
      score: this.score,
      bestScore: this.bestScore,
      speed: this.getSpeed(),
      gameOver: false
    };
  }
}
