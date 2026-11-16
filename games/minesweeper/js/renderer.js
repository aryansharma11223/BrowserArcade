/**
 * Browser Arcade - Minesweeper Hardware-Accelerated DOM Renderer
 * Renders glassmorphic retro HUD, responsive grid, and smooth cell states.
 */

class MinesweeperRenderer {
  constructor(elements = {}) {
    this.boardEl = elements.board;
    this.mineCountEl = elements.mineCount;
    this.timerEl = elements.timer;
    this.faceBtnEl = elements.faceBtn;
    this.bestTimeEl = elements.bestTime;
    this.modeIndicatorEl = elements.modeIndicator;
    this.winModalEl = elements.winModal;
    this.winTimeEl = elements.winTime;
    this.winBestEl = elements.winBest;
    this.lossModalEl = elements.lossModal;

    this.cellElements = [];
  }

  setupBoard(rows, cols) {
    this.boardEl.innerHTML = '';
    this.cellElements = [];

    this.boardEl.style.setProperty('--grid-rows', rows);
    this.boardEl.style.setProperty('--grid-cols', cols);

    for (let r = 0; r < rows; r++) {
      const rowEls = [];
      for (let c = 0; c < cols; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mine-cell';
        btn.dataset.row = r;
        btn.dataset.col = c;
        btn.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);
        this.boardEl.appendChild(btn);
        rowEls.push(btn);
      }
      this.cellElements.push(rowEls);
    }
  }

  updateCell(cell, isExploded = false) {
    const el = this.cellElements[cell.row] && this.cellElements[cell.row][cell.col];
    if (!el) return;

    el.className = 'mine-cell';

    if (cell.isRevealed) {
      el.classList.add('revealed');
      if (cell.isMine) {
        el.classList.add('mine');
        el.textContent = '💣';
        if (isExploded) {
          el.classList.add('exploded');
        }
      } else if (cell.adjacentMines > 0) {
        el.classList.add(`val-${cell.adjacentMines}`);
        el.textContent = cell.adjacentMines;
      } else {
        el.textContent = '';
      }
    } else {
      if (cell.isFlagged) {
        el.classList.add('flagged');
        el.textContent = '🚩';
      } else {
        el.textContent = '';
      }
    }
  }

  updateAllCells(grid, explodedMine = null) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        const isExploded = explodedMine && explodedMine.row === r && explodedMine.col === c;
        this.updateCell(cell, isExploded);
      }
    }
  }

  updateHUD(remainingMines, seconds, status) {
    if (this.mineCountEl) {
      const formattedMines = String(Math.max(-99, Math.min(999, remainingMines))).padStart(3, '0');
      this.mineCountEl.textContent = formattedMines;
    }

    if (this.timerEl) {
      const formattedTime = String(Math.min(999, seconds)).padStart(3, '0');
      this.timerEl.textContent = formattedTime;
    }

    if (this.faceBtnEl) {
      if (status === 'won') {
        this.faceBtnEl.textContent = '😎';
        this.faceBtnEl.setAttribute('aria-label', 'Victory! Click to play again');
      } else if (status === 'lost') {
        this.faceBtnEl.textContent = '😵';
        this.faceBtnEl.setAttribute('aria-label', 'Game Over. Click to try again');
      } else {
        this.faceBtnEl.textContent = '🙂';
        this.faceBtnEl.setAttribute('aria-label', 'Reset game');
      }
    }
  }

  updateModeIndicator(mode) {
    if (this.modeIndicatorEl) {
      if (mode === 'flag') {
        this.modeIndicatorEl.textContent = '🚩 Flagging Mode';
        this.modeIndicatorEl.classList.add('active-flag');
      } else {
        this.modeIndicatorEl.textContent = '⛏️ Reveal Mode';
        this.modeIndicatorEl.classList.remove('active-flag');
      }
    }
  }

  updateBestTime(timeSeconds) {
    if (this.bestTimeEl) {
      if (!timeSeconds || timeSeconds === 0) {
        this.bestTimeEl.textContent = '--:--';
      } else {
        const m = Math.floor(timeSeconds / 60);
        const s = timeSeconds % 60;
        this.bestTimeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }
  }

  showWinModal(elapsedTime, isNewBest) {
    if (this.winModalEl) {
      if (this.winTimeEl) this.winTimeEl.textContent = `${elapsedTime}s`;
      if (this.winBestEl) {
        this.winBestEl.textContent = isNewBest ? '🏆 New Personal Record!' : '';
      }
      this.winModalEl.classList.add('active');
    }
  }

  hideWinModal() {
    if (this.winModalEl) {
      this.winModalEl.classList.remove('active');
    }
  }

  showLossModal() {
    if (this.lossModalEl) {
      this.lossModalEl.classList.add('active');
    }
  }

  hideLossModal() {
    if (this.lossModalEl) {
      this.lossModalEl.classList.remove('active');
    }
  }
}

export { MinesweeperRenderer };
