/**
 * Browser Arcade - 2048 Game Engine (Pure Model)
 * 
 * Completely decoupled from UI, DOM, and audio.
 * Zero external dependencies.
 * Deterministic mathematical matrix operations and state management.
 */

class GameEngine {
  /**
   * @param {Object} options
   * @param {number} [options.size=4] Grid dimensions (standard 4x4)
   * @param {number[][]} [options.initialGrid=null] Optional predefined grid for testing
   * @param {Function} [options.randomFn=Math.random] Custom PRNG for deterministic testing
   */
  constructor(options = {}) {
    this.size = options.size || 4;
    this.randomFn = options.randomFn || Math.random;

    this.grid = [];
    this.score = 0;
    this.won = false;
    this.keepPlaying = false;
    this.gameOver = false;
    this.undoStack = [];
    this._nextTileId = 1;

    if (options.initialGrid) {
      this.loadGrid(options.initialGrid, options.score || 0);
    } else {
      this.reset();
    }
  }

  /**
   * Resets game state to a new initial game with 2 starting tiles.
   */
  reset() {
    this.grid = this._createEmptyGrid();
    this.score = 0;
    this.won = false;
    this.keepPlaying = false;
    this.gameOver = false;
    this.undoStack = [];
    this._nextTileId = 1;

    // Standard 2048 starts with 2 random tiles
    this.spawnRandomTile();
    this.spawnRandomTile();
  }

  /**
   * Loads a custom grid (useful for unit tests and state restoring).
   * @param {number[][]} gridMatrix
   * @param {number} [score=0]
   */
  loadGrid(gridMatrix, score = 0) {
    this.size = gridMatrix.length;
    this.grid = this._createEmptyGrid();
    this.score = score;
    this.won = false;
    this.keepPlaying = false;
    this.gameOver = false;
    this.undoStack = [];
    this._nextTileId = 1;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = gridMatrix[r][c];
        if (val > 0) {
          this.grid[r][c] = {
            id: this._nextTileId++,
            value: val,
            row: r,
            col: c
          };
          if (val >= 2048) {
            this.won = true;
          }
        }
      }
    }

    this.gameOver = this._checkGameOver();
  }

  /**
   * Returns a 2D matrix of raw numeric values (0 for empty).
   * @returns {number[][]}
   */
  getGridValues() {
    return this.grid.map(row => row.map(cell => (cell ? cell.value : 0)));
  }

  /**
   * Returns a flat array of all currently active tile objects.
   * @returns {Array<{id: number, value: number, row: number, col: number}>}
   */
  getTiles() {
    const tiles = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c]) {
          tiles.push({ ...this.grid[r][c] });
        }
      }
    }
    return tiles;
  }

  /**
   * Finds all empty coordinates on the board.
   * @returns {Array<{row: number, col: number}>}
   */
  getEmptyCells() {
    const empty = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.grid[r][c]) {
          empty.push({ row: r, col: c });
        }
      }
    }
    return empty;
  }

  /**
   * Spawns a random tile in an empty cell (90% chance of 2, 10% chance of 4).
   * @returns {Object|null} The spawned tile, or null if board is full
   */
  spawnRandomTile() {
    const emptyCells = this.getEmptyCells();
    if (emptyCells.length === 0) return null;

    const randomIndex = Math.floor(this.randomFn() * emptyCells.length);
    const { row, col } = emptyCells[randomIndex];
    const value = this.randomFn() < 0.9 ? 2 : 4;

    const tile = {
      id: this._nextTileId++,
      value,
      row,
      col
    };

    this.grid[row][col] = tile;
    return { ...tile };
  }

  /**
   * Executes a move in the specified direction.
   * @param {'UP'|'RIGHT'|'DOWN'|'LEFT'} direction
   * @returns {{
   *   moved: boolean,
   *   scoreGained: number,
   *   won: boolean,
   *   gameOver: boolean,
   *   mergedTiles: Array<{value: number, row: number, col: number}>,
   *   spawnedTile: Object|null
   * }}
   */
  move(direction) {
    if (this.gameOver) {
      return { moved: false, scoreGained: 0, won: this.won, gameOver: true, mergedTiles: [], spawnedTile: null };
    }

    const vector = this._getVector(direction);
    if (!vector) {
      throw new Error(`Invalid direction: ${direction}. Use UP, RIGHT, DOWN, or LEFT.`);
    }

    const traversals = this._buildTraversals(vector);
    let moved = false;
    let scoreGained = 0;
    const mergedTiles = [];

    // Create deep snapshot BEFORE any mutations for undo functionality
    const previousSnapshot = this._createSnapshot();

    // Track which target positions have already merged in THIS turn to guarantee single-merge rule
    const mergedPositions = Array.from({ length: this.size }, () => Array(this.size).fill(false));

    traversals.row.forEach(r => {
      traversals.col.forEach(c => {
        const cell = this.grid[r][c];
        if (!cell) return;

        const positions = this._findFarthestPosition(r, c, vector);
        const nextCell = this._getCell(positions.next);

        // Check if merge is possible: next exists, same value, and hasn't merged yet this move
        if (
          nextCell &&
          nextCell.value === cell.value &&
          !mergedPositions[positions.next.row][positions.next.col]
        ) {
          // Merge tiles
          const mergedValue = cell.value * 2;
          const targetRow = positions.next.row;
          const targetCol = positions.next.col;

          const mergedTile = {
            id: this._nextTileId++,
            value: mergedValue,
            row: targetRow,
            col: targetCol,
            mergedFrom: [cell.id, nextCell.id]
          };

          this.grid[targetRow][targetCol] = mergedTile;
          this.grid[r][c] = null;

          mergedPositions[targetRow][targetCol] = true;
          scoreGained += mergedValue;
          mergedTiles.push({ value: mergedValue, row: targetRow, col: targetCol });
          moved = true;

          // Check for 2048 win condition
          if (mergedValue >= 2048 && !this.won && !this.keepPlaying) {
            this.won = true;
          }
        } else if (positions.farthest.row !== r || positions.farthest.col !== c) {
          // Slide without merge
          this.grid[positions.farthest.row][positions.farthest.col] = {
            ...cell,
            row: positions.farthest.row,
            col: positions.farthest.col
          };
          this.grid[r][c] = null;
          moved = true;
        }
      });
    });

    if (moved) {
      // Commit previous snapshot to undo stack
      this.undoStack.push(previousSnapshot);

      this.score += scoreGained;

      // Spawn a new random tile after successful move
      const spawnedTile = this.spawnRandomTile();

      // Check for Game Over condition
      this.gameOver = this._checkGameOver();

      return {
        moved: true,
        scoreGained,
        won: this.won,
        gameOver: this.gameOver,
        mergedTiles,
        spawnedTile
      };
    }

    // Invalid move: do not mutate, do not push undo, do not spawn tile
    return {
      moved: false,
      scoreGained: 0,
      won: this.won,
      gameOver: this.gameOver,
      mergedTiles: [],
      spawnedTile: null
    };
  }

  /**
   * Continues the game in endless mode after reaching 2048.
   */
  continuePlaying() {
    this.keepPlaying = true;
  }

  /**
   * Reverts to the previous game state.
   * Completely restores board, score, win status, and game-over status.
   * @returns {boolean} True if successfully undone, false if no states left.
   */
  undo() {
    if (this.undoStack.length === 0) return false;

    const snapshot = this.undoStack.pop();
    this._restoreSnapshot(snapshot);
    return true;
  }

  /**
   * Checks if an undo operation is available.
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  _createEmptyGrid() {
    return Array.from({ length: this.size }, () => Array(this.size).fill(null));
  }

  _getVector(direction) {
    const vectors = {
      UP: { r: -1, c: 0 },
      RIGHT: { r: 0, c: 1 },
      DOWN: { r: 1, c: 0 },
      LEFT: { r: 0, c: -1 }
    };
    return vectors[direction] || null;
  }

  _buildTraversals(vector) {
    const traversals = {
      row: [],
      col: []
    };

    for (let i = 0; i < this.size; i++) {
      traversals.row.push(i);
      traversals.col.push(i);
    }

    // Always traverse from the side being moved towards
    if (vector.r === 1) traversals.row.reverse();
    if (vector.c === 1) traversals.col.reverse();

    return traversals;
  }

  _withinBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  _getCell(pos) {
    if (!pos || !this._withinBounds(pos.row, pos.col)) return null;
    return this.grid[pos.row][pos.col];
  }

  _findFarthestPosition(row, col, vector) {
    let prev = { row, col };
    let next = { row: row + vector.r, col: col + vector.c };

    while (this._withinBounds(next.row, next.col) && !this.grid[next.row][next.col]) {
      prev = next;
      next = { row: next.row + vector.r, col: next.col + vector.c };
    }

    return {
      farthest: prev,
      next: this._withinBounds(next.row, next.col) ? next : null
    };
  }

  /**
   * Checks whether the game is over.
   * A game is over if and only if:
   * 1. There are NO empty cells.
   * 2. NO two adjacent horizontal or vertical cells share identical values.
   * @returns {boolean}
   */
  _checkGameOver() {
    if (this.getEmptyCells().length > 0) return false;

    // Check horizontal and vertical merges
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c].value;

        // Check right neighbor
        if (c < this.size - 1 && this.grid[r][c + 1].value === val) {
          return false;
        }
        // Check bottom neighbor
        if (r < this.size - 1 && this.grid[r + 1][c].value === val) {
          return false;
        }
      }
    }

    return true;
  }

  _createSnapshot() {
    // Deep clone grid
    const gridClone = this.grid.map(row =>
      row.map(cell => (cell ? { ...cell } : null))
    );

    return {
      grid: gridClone,
      score: this.score,
      won: this.won,
      keepPlaying: this.keepPlaying,
      gameOver: this.gameOver,
      nextTileId: this._nextTileId
    };
  }

  _restoreSnapshot(snapshot) {
    this.grid = snapshot.grid.map(row =>
      row.map(cell => (cell ? { ...cell } : null))
    );
    this.score = snapshot.score;
    this.won = snapshot.won;
    this.keepPlaying = snapshot.keepPlaying;
    this.gameOver = snapshot.gameOver;
    this._nextTileId = snapshot.nextTileId;
  }
}

// Support both ES Module import and CommonJS / Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameEngine };
}

export { GameEngine };
