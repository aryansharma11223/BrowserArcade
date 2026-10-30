/**
 * Browser Arcade - 2048 DOM Grid Renderer
 * Hardware-accelerated GPU transforms and DOM reconciliation.
 */

class GridRenderer {
  constructor(options = {}) {
    this.tileContainer = options.tileContainer || document.getElementById('tileContainer');
    this.scoreElement = options.scoreElement || document.getElementById('currentScore');
    this.bestScoreElement = options.bestScoreElement || document.getElementById('bestScore');
    this.undoButton = options.undoButton || document.getElementById('undoBtn');
    this.winOverlay = options.winOverlay || document.getElementById('winOverlay');
    this.gameOverOverlay = options.gameOverOverlay || document.getElementById('gameOverOverlay');
    this.finalScoreElement = options.finalScoreElement || document.getElementById('finalScore');

    this.tileElements = new Map(); // Map<tileId, HTMLElement>
  }

  /**
   * Performs complete grid sync from engine tile collection.
   * Used on initial load, new game, and undo.
   * @param {Array<{id: number, value: number, row: number, col: number}>} tiles
   * @param {boolean} [animateSpawn=false]
   */
  syncGrid(tiles, animateSpawn = false) {
    if (!this.tileContainer) return;

    this.tileContainer.innerHTML = '';
    this.tileElements.clear();

    tiles.forEach(tile => {
      const tileEl = this._createTileElement(tile, animateSpawn);
      this.tileContainer.appendChild(tileEl);
      this.tileElements.set(tile.id, tileEl);
    });
  }

  /**
   * Updates tile positions and animations following a valid move.
   * @param {Object} moveResult Result returned from engine.move()
   * @param {Array<{id: number, value: number, row: number, col: number}>} currentTiles
   */
  renderMove(moveResult, currentTiles) {
    if (!this.tileContainer) return;

    // Track active IDs to remove any stale elements
    const activeIds = new Set(currentTiles.map(t => t.id));

    // Update existing tile coordinates for smooth CSS transitions
    currentTiles.forEach(tile => {
      let el = this.tileElements.get(tile.id);
      if (el) {
        el.style.setProperty('--row', tile.row);
        el.style.setProperty('--col', tile.col);
      } else {
        // Newly spawned or merged tile
        const isMerged = moveResult.mergedTiles.some(
          m => m.row === tile.row && m.col === tile.col && m.value === tile.value
        );
        el = this._createTileElement(tile, true, isMerged);
        this.tileContainer.appendChild(el);
        this.tileElements.set(tile.id, el);
      }
    });

    // Clean up tiles that no longer exist (merged away)
    for (const [id, el] of this.tileElements.entries()) {
      if (!activeIds.has(id)) {
        // Remove after slide animation finishes
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
          this.tileElements.delete(id);
        }, 115);
      }
    }
  }

  /**
   * Creates a DOM tile element with CSS variable coordinates and classes.
   * @private
   */
  _createTileElement(tile, isNew = false, isMerged = false) {
    const el = document.createElement('div');
    const tileClass = tile.value <= 2048 ? `tile-${tile.value}` : 'tile-super';
    const digits = String(tile.value).length;

    el.className = `tile ${tileClass}`;
    if (isNew && !isMerged) el.classList.add('tile-new');
    if (isMerged) el.classList.add('tile-merged');

    el.style.setProperty('--row', tile.row);
    el.style.setProperty('--col', tile.col);
    el.setAttribute('data-digits', digits > 4 ? '5' : String(digits));
    el.setAttribute('data-id', tile.id);

    const inner = document.createElement('div');
    inner.className = 'tile-inner';
    inner.textContent = tile.value;

    el.appendChild(inner);
    return el;
  }

  /**
   * Updates Score and Best Score displays.
   * @param {number} currentScore
   * @param {number} bestScore
   * @param {number} [scoreGained=0]
   */
  updateScores(currentScore, bestScore, scoreGained = 0) {
    if (this.scoreElement) {
      this.scoreElement.textContent = currentScore.toLocaleString();

      if (scoreGained > 0) {
        const floatEl = document.createElement('span');
        floatEl.className = 'score-addition';
        floatEl.textContent = `+${scoreGained}`;
        this.scoreElement.parentNode.appendChild(floatEl);

        setTimeout(() => {
          if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
        }, 600);
      }
    }

    if (this.bestScoreElement) {
      this.bestScoreElement.textContent = bestScore.toLocaleString();
    }
  }

  /**
   * Updates Undo button availability.
   * @param {boolean} canUndo
   */
  updateUndoState(canUndo) {
    if (!this.undoButton) return;
    this.undoButton.disabled = !canUndo;
    this.undoButton.style.opacity = canUndo ? '1' : '0.45';
    this.undoButton.style.cursor = canUndo ? 'pointer' : 'not-allowed';
  }

  /**
   * Displays victory overlay.
   */
  showWin() {
    if (this.winOverlay) {
      this.winOverlay.classList.add('active');
    }
  }

  /**
   * Hides victory overlay (e.g. when continuing in endless mode).
   */
  hideWin() {
    if (this.winOverlay) {
      this.winOverlay.classList.remove('active');
    }
  }

  /**
   * Displays Game Over overlay with final score.
   * @param {number} score
   */
  showGameOver(score) {
    if (this.gameOverOverlay) {
      if (this.finalScoreElement) {
        this.finalScoreElement.textContent = score.toLocaleString();
      }
      this.gameOverOverlay.classList.add('active');
    }
  }

  /**
   * Hides Game Over overlay.
   */
  hideGameOver() {
    if (this.gameOverOverlay) {
      this.gameOverOverlay.classList.remove('active');
    }
  }
}

export { GridRenderer };
