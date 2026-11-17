/**
 * Browser Arcade - Minesweeper Classic Game Engine
 * Pure mathematical logic, board state, mine distribution, and cascade reveal.
 * Strictly 0-dependency, 100% unit-testable.
 */

const PRESETS = {
  beginner: { rows: 9, cols: 9, mines: 10, label: 'Beginner' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: 'Intermediate' },
  expert: { rows: 16, cols: 30, mines: 99, label: 'Expert' },
  daily: { rows: 9, cols: 9, mines: 10, label: 'Daily Challenge' }
};

/**
 * Deterministic Mulberry32 32-bit PRNG
 * @param {number|string} seed
 * @returns {() => number} Float in [0, 1)
 */
function mulberry32(seed) {
  let s = (typeof seed === 'number' ? seed : parseInt(seed, 10) || 123456789) >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns UTC integer seed for given date (YYYYMMDD).
 * @param {Date} [date=new Date()]
 * @returns {number}
 */
function getDailySeed(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

class MinesweeperEngine {
  constructor(difficulty = 'beginner', customSeed = null) {
    this.setDifficulty(difficulty, customSeed);
    this.reset();
  }

  setDifficulty(difficulty, customSeed = null) {
    if (!PRESETS[difficulty]) {
      difficulty = 'beginner';
    }
    this.difficulty = difficulty;
    const config = PRESETS[difficulty];
    this.rows = config.rows;
    this.cols = config.cols;
    this.totalMines = config.mines;
    this.isDaily = difficulty === 'daily';

    if (this.isDaily) {
      this.seed = customSeed !== null ? customSeed : getDailySeed();
      this.rng = mulberry32(this.seed);
    } else if (customSeed !== null) {
      this.seed = customSeed;
      this.rng = mulberry32(customSeed);
    } else {
      this.seed = null;
      this.rng = Math.random;
    }
  }

  reset() {
    this.status = 'ready'; // 'ready' | 'playing' | 'won' | 'lost'
    this.grid = [];
    this.firstClick = true;
    this.revealedCount = 0;
    this.placedFlags = 0;
    this.explodedMine = null;
    this.startTime = null;
    this.endTime = null;

    // Reset PRNG instance for seed repeatability
    if (this.seed !== null) {
      this.rng = mulberry32(this.seed);
    }

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          adjacentMines: 0,
          isRevealed: false,
          isFlagged: false
        });
      }
      this.grid.push(row);
    }
  }

  getCell(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      return null;
    }
    return this.grid[r][c];
  }

  getNeighbors(r, c) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const cell = this.getCell(r + dr, c + dc);
        if (cell) neighbors.push(cell);
      }
    }
    return neighbors;
  }

  /**
   * Generates mines after the first click, ensuring that (safeR, safeC)
   * and all of its 8 adjacent neighbors are 100% free of mines.
   */
  _placeMines(safeR, safeC) {
    const forbidden = new Set();
    forbidden.add(`${safeR},${safeC}`);
    for (const n of this.getNeighbors(safeR, safeC)) {
      forbidden.add(`${n.row},${n.col}`);
    }

    const availableCoords = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!forbidden.has(`${r},${c}`)) {
          availableCoords.push({ r, c });
        }
      }
    }

    // In case availableCoords is smaller than totalMines (e.g. tiny test boards),
    // allow outside the safe center
    if (availableCoords.length < this.totalMines) {
      availableCoords.length = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (r !== safeR || c !== safeC) {
            availableCoords.push({ r, c });
          }
        }
      }
    }

    // Shuffle coords using Fisher-Yates with deterministic or standard PRNG
    for (let i = availableCoords.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [availableCoords[i], availableCoords[j]] = [availableCoords[j], availableCoords[i]];
    }

    const mineCoords = availableCoords.slice(0, this.totalMines);
    mineCoords.forEach(({ r, c }) => {
      this.grid[r][c].isMine = true;
    });

    // Compute adjacent numbers
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.isMine) {
          const count = this.getNeighbors(r, c).filter(n => n.isMine).length;
          cell.adjacentMines = count;
        }
      }
    }
  }

  /**
   * Primary action: Reveals cell at (r, c).
   */
  reveal(r, c) {
    const cell = this.getCell(r, c);
    if (!cell || cell.isRevealed || cell.isFlagged || this.status === 'won' || this.status === 'lost') {
      return { changed: false };
    }

    // First click handling
    if (this.firstClick) {
      this._placeMines(r, c);
      this.firstClick = false;
      this.status = 'playing';
      this.startTime = Date.now();
    }

    // Mine detonated -> Game Over
    if (cell.isMine) {
      this.status = 'lost';
      this.endTime = Date.now();
      this.explodedMine = { row: r, col: c };
      this._revealAllMines();
      return {
        changed: true,
        status: 'lost',
        hitMine: true,
        cell
      };
    }

    // Safe cell reveal with cascade flood-fill
    const revealedCells = [];
    const queue = [cell];
    cell.isRevealed = true;
    this.revealedCount++;
    revealedCells.push(cell);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.adjacentMines === 0) {
        for (const neighbor of this.getNeighbors(current.row, current.col)) {
          if (!neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine) {
            neighbor.isRevealed = true;
            this.revealedCount++;
            revealedCells.push(neighbor);
            if (neighbor.adjacentMines === 0) {
              queue.push(neighbor);
            }
          }
        }
      }
    }

    // Check Victory condition: all non-mine cells revealed
    const targetNonMines = (this.rows * this.cols) - this.totalMines;
    if (this.revealedCount >= targetNonMines) {
      this.status = 'won';
      this.endTime = Date.now();
      this._flagRemainingMines();
      return {
        changed: true,
        status: 'won',
        revealedCells
      };
    }

    return {
      changed: true,
      status: 'playing',
      revealedCells
    };
  }

  /**
   * Secondary action: Toggles flag on unrevealed cell.
   */
  toggleFlag(r, c) {
    const cell = this.getCell(r, c);
    if (!cell || cell.isRevealed || this.status === 'won' || this.status === 'lost') {
      return { changed: false };
    }

    if (this.status === 'ready') {
      this.status = 'playing';
      this.startTime = Date.now();
    }

    cell.isFlagged = !cell.isFlagged;
    this.placedFlags += cell.isFlagged ? 1 : -1;

    return {
      changed: true,
      cell,
      isFlagged: cell.isFlagged,
      remainingMines: this.getRemainingMines()
    };
  }

  /**
   * Chording action: Click on a revealed numbered cell whose adjacent flags
   * match its number to quickly unveil remaining unflagged neighbors.
   */
  chord(r, c) {
    const cell = this.getCell(r, c);
    if (!cell || !cell.isRevealed || cell.adjacentMines === 0 || this.status !== 'playing') {
      return { changed: false };
    }

    const neighbors = this.getNeighbors(r, c);
    const flagCount = neighbors.filter(n => n.isFlagged).length;

    if (flagCount !== cell.adjacentMines) {
      return { changed: false };
    }

    const unrevealed = neighbors.filter(n => !n.isRevealed && !n.isFlagged);
    if (unrevealed.length === 0) {
      return { changed: false };
    }

    // Check if any chorded reveal hits a mine
    let hitMine = false;
    for (const target of unrevealed) {
      const res = this.reveal(target.row, target.col);
      if (res.hitMine) {
        hitMine = true;
        break;
      }
    }

    return {
      changed: true,
      status: this.status,
      hitMine
    };
  }

  _revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine) {
          cell.isRevealed = true;
        }
      }
    }
  }

  _flagRemainingMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine && !cell.isFlagged) {
          cell.isFlagged = true;
          this.placedFlags++;
        }
      }
    }
  }

  getRemainingMines() {
    return this.totalMines - this.placedFlags;
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    return Math.floor((end - this.startTime) / 1000);
  }

  getState() {
    return {
      difficulty: this.difficulty,
      rows: this.rows,
      cols: this.cols,
      totalMines: this.totalMines,
      status: this.status,
      firstClick: this.firstClick,
      remainingMines: this.getRemainingMines(),
      elapsedTime: this.getElapsedTime(),
      explodedMine: this.explodedMine
    };
  }
}

if (typeof window !== 'undefined') {
  window.MinesweeperEngine = MinesweeperEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MinesweeperEngine, PRESETS, mulberry32, getDailySeed };
}

export { MinesweeperEngine, PRESETS, mulberry32, getDailySeed };
