/**
 * Browser Arcade - Block Drop Classic Game Engine (Tetris Logic)
 * Pure mathematical model: 7-bag randomizer, SRS wall kicks, ghost piece,
 * hold piece, line clearing, scoring, and level gravity.
 * 0 external dependencies, 100% unit-testable.
 */

const COLS = 10;
const ROWS = 20;
const HIDDEN_ROWS = 2;
const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

const TETROMINOES = {
  I: {
    name: 'I',
    color: '#06b6d4',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  O: {
    name: 'O',
    color: '#eab308',
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  T: {
    name: 'T',
    color: '#a855f7',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  S: {
    name: 'S',
    color: '#22c55e',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  Z: {
    name: 'Z',
    color: '#ef4444',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  J: {
    name: 'J',
    color: '#3b82f6',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    name: 'L',
    color: '#f97316',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  }
};

const SCORES = {
  SINGLE: 100,
  DOUBLE: 300,
  TRIPLE: 500,
  TETRIS: 800
};

class BlockDropEngine {
  constructor(options = {}) {
    this.randomFn = options.randomFn || Math.random;
    this.reset();
  }

  reset() {
    this.cols = COLS;
    this.rows = ROWS;
    this.totalRows = TOTAL_ROWS;

    // Grid representation: 0 for empty, or color string for locked block
    this.grid = Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(0));

    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.bestScore = 0;
    this.isGameOver = false;
    this.isPaused = false;

    this.holdPiece = null;
    this.canHold = true;

    this.currentPiece = null;
    this.nextPiece = null;

    // Spawn first and next pieces
    this.nextPiece = this._generatePiece();
    this._spawnNextPiece();
  }

  /**
   * Generates pieces using standard 7-bag randomizer to prevent droughts.
   */
  _generatePiece() {
    if (this.bag.length === 0) {
      this.bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.randomFn() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const type = this.bag.pop();
    const proto = TETROMINOES[type];
    return {
      type: proto.name,
      color: proto.color,
      matrix: proto.matrix.map(row => [...row]),
      x: 0,
      y: 0
    };
  }

  _spawnNextPiece() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this._generatePiece();

    // Center piece at the top (within hidden rows)
    const m = this.currentPiece.matrix;
    this.currentPiece.x = Math.floor((this.cols - m[0].length) / 2);
    this.currentPiece.y = 0;

    // If spawned piece collides immediately -> Game Over
    if (this._collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.isGameOver = true;
      return false;
    }

    this.canHold = true;
    return true;
  }

  _collides(matrix, posX, posY) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const x = posX + c;
          const y = posY + r;

          // Wall boundaries
          if (x < 0 || x >= this.cols || y >= this.totalRows) {
            return true;
          }
          // Already locked blocks (only if within board)
          if (y >= 0 && this.grid[y][x] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  moveLeft() {
    if (this.isGameOver || this.isPaused || !this.currentPiece) return false;
    if (!this._collides(this.currentPiece.matrix, this.currentPiece.x - 1, this.currentPiece.y)) {
      this.currentPiece.x--;
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.isGameOver || this.isPaused || !this.currentPiece) return false;
    if (!this._collides(this.currentPiece.matrix, this.currentPiece.x + 1, this.currentPiece.y)) {
      this.currentPiece.x++;
      return true;
    }
    return false;
  }

  rotate(clockwise = true) {
    if (this.isGameOver || this.isPaused || !this.currentPiece) return false;
    if (this.currentPiece.type === 'O') return false; // O tetromino does not need rotation

    const m = this.currentPiece.matrix;
    const n = m.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (clockwise) {
          rotated[c][n - 1 - r] = m[r][c];
        } else {
          rotated[n - 1 - c][r] = m[r][c];
        }
      }
    }

    // Standard wall kicks offsets to test
    const kickOffsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-2, 0],
      [2, 0]
    ];

    for (const [ox, oy] of kickOffsets) {
      if (!this._collides(rotated, this.currentPiece.x + ox, this.currentPiece.y + oy)) {
        this.currentPiece.matrix = rotated;
        this.currentPiece.x += ox;
        this.currentPiece.y += oy;
        return true;
      }
    }

    return false;
  }

  softDrop() {
    if (this.isGameOver || this.isPaused || !this.currentPiece) return { moved: false };
    if (!this._collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      this.score += 1;
      return { moved: true, locked: false };
    }
    // Cannot move down -> lock piece
    return this.lockPiece();
  }

  hardDrop() {
    if (this.isGameOver || this.isPaused || !this.currentPiece) return { droppedRows: 0, locked: false };
    let droppedRows = 0;
    while (!this._collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      droppedRows++;
    }
    this.score += droppedRows * 2;
    const lockResult = this.lockPiece();
    return {
      droppedRows,
      locked: true,
      linesCleared: lockResult.linesCleared
    };
  }

  getGhostY() {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (!this._collides(this.currentPiece.matrix, this.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  hold() {
    if (this.isGameOver || this.isPaused || !this.canHold || !this.currentPiece) return false;

    const currentType = this.currentPiece.type;
    if (!this.holdPiece) {
      this.holdPiece = TETROMINOES[currentType];
      this._spawnNextPiece();
    } else {
      const prevHold = this.holdPiece;
      this.holdPiece = TETROMINOES[currentType];
      this.currentPiece = {
        type: prevHold.name,
        color: prevHold.color,
        matrix: prevHold.matrix.map(row => [...row]),
        x: Math.floor((this.cols - prevHold.matrix[0].length) / 2),
        y: 0
      };
      if (this._collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
        this.isGameOver = true;
        return false;
      }
    }

    this.canHold = false;
    return true;
  }

  lockPiece() {
    const m = this.currentPiece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          const x = this.currentPiece.x + c;
          const y = this.currentPiece.y + r;
          if (y >= 0 && y < this.totalRows && x >= 0 && x < this.cols) {
            this.grid[y][x] = this.currentPiece.color;
          }
        }
      }
    }

    const linesCleared = this._clearLines();
    const spawned = this._spawnNextPiece();

    return {
      locked: true,
      linesCleared,
      gameOver: this.isGameOver
    };
  }

  _clearLines() {
    let clearedCount = 0;

    for (let r = this.totalRows - 1; r >= 0; r--) {
      const isFull = this.grid[r].every(cell => cell !== 0);
      if (isFull) {
        clearedCount++;
        this.grid.splice(r, 1);
        this.grid.unshift(Array(this.cols).fill(0));
        r++; // check same row index again because rows shifted down
      }
    }

    if (clearedCount > 0) {
      this.lines += clearedCount;

      let baseScore = 0;
      if (clearedCount === 1) baseScore = SCORES.SINGLE;
      else if (clearedCount === 2) baseScore = SCORES.DOUBLE;
      else if (clearedCount === 3) baseScore = SCORES.TRIPLE;
      else if (clearedCount >= 4) baseScore = SCORES.TETRIS;

      this.score += baseScore * this.level;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }

      // Increase level every 10 lines
      this.level = Math.floor(this.lines / 10) + 1;
    }

    return clearedCount;
  }

  getDropInterval() {
    // Standard gravity speed curve: starts at 800ms, accelerates per level down to 80ms
    return Math.max(80, 800 - (this.level - 1) * 70);
  }

  getState() {
    return {
      grid: this.grid,
      currentPiece: this.currentPiece,
      ghostY: this.getGhostY(),
      nextPiece: this.nextPiece,
      holdPiece: this.holdPiece,
      score: this.score,
      lines: this.lines,
      level: this.level,
      bestScore: this.bestScore,
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
      canHold: this.canHold
    };
  }
}

if (typeof window !== 'undefined') {
  window.BlockDropEngine = BlockDropEngine;
  window.TETROMINOES = TETROMINOES;
}

export { BlockDropEngine, TETROMINOES, COLS, ROWS, HIDDEN_ROWS, TOTAL_ROWS };
