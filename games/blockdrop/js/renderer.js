/**
 * Browser Arcade - Block Drop Hardware-Accelerated Canvas Renderer
 * 60 FPS neon cyber aesthetic, high-DPI crisp scaling, ghost piece, and HUD previews.
 */

import { ROWS, COLS, HIDDEN_ROWS } from './engine.js';

class BlockDropRenderer {
  constructor(elements = {}) {
    this.mainCanvas = elements.mainCanvas;
    this.mainCtx = this.mainCanvas ? this.mainCanvas.getContext('2d') : null;

    this.nextCanvas = elements.nextCanvas;
    this.nextCtx = this.nextCanvas ? this.nextCanvas.getContext('2d') : null;

    this.holdCanvas = elements.holdCanvas;
    this.holdCtx = this.holdCanvas ? this.holdCanvas.getContext('2d') : null;

    this.scoreEl = elements.scoreEl;
    this.linesEl = elements.linesEl;
    this.levelEl = elements.levelEl;
    this.bestScoreEl = elements.bestScoreEl;
    this.gameOverModal = elements.gameOverModal;
    this.finalScoreEl = elements.finalScoreEl;
    this.finalLinesEl = elements.finalLinesEl;

    this.blockSize = 24;
    this.setupCanvas();
  }

  setupCanvas() {
    if (!this.mainCanvas || !this.mainCtx) return;

    const dpr = window.devicePixelRatio || 1;
    // Calculate block size based on display width
    const rect = this.mainCanvas.getBoundingClientRect();
    const displayWidth = rect.width || 280;
    this.blockSize = Math.floor(displayWidth / COLS);

    const canvasWidth = this.blockSize * COLS;
    const canvasHeight = this.blockSize * ROWS;

    this.mainCanvas.width = canvasWidth * dpr;
    this.mainCanvas.height = canvasHeight * dpr;
    this.mainCtx.scale(dpr, dpr);

    // Setup preview canvases
    [this.nextCanvas, this.holdCanvas].forEach(canv => {
      if (canv) {
        const cRect = canv.getBoundingClientRect();
        const pSize = cRect.width || 80;
        canv.width = pSize * dpr;
        canv.height = pSize * dpr;
        const ctx = canv.getContext('2d');
        ctx.scale(dpr, dpr);
      }
    });
  }

  render(state) {
    if (!this.mainCtx) return;

    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    // 1. Draw subtle grid background
    this._drawGrid();

    // 2. Draw locked blocks
    this._drawLockedGrid(state.grid);

    // 3. Draw ghost piece
    if (state.currentPiece && !state.isGameOver) {
      this._drawGhostPiece(state.currentPiece, state.ghostY);
    }

    // 4. Draw active falling piece
    if (state.currentPiece && !state.isGameOver) {
      this._drawPiece(state.currentPiece, state.currentPiece.x, state.currentPiece.y);
    }

    // 5. Render previews & HUD
    this._renderPreview(this.nextCtx, this.nextCanvas, state.nextPiece);
    this._renderPreview(this.holdCtx, this.holdCanvas, state.holdPiece);
    this.updateHUD(state);
  }

  _drawGrid() {
    this.mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.mainCtx.lineWidth = 1;

    for (let c = 0; c <= COLS; c++) {
      this.mainCtx.beginPath();
      this.mainCtx.moveTo(c * this.blockSize, 0);
      this.mainCtx.lineTo(c * this.blockSize, ROWS * this.blockSize);
      this.mainCtx.stroke();
    }

    for (let r = 0; r <= ROWS; r++) {
      this.mainCtx.beginPath();
      this.mainCtx.moveTo(0, r * this.blockSize);
      this.mainCtx.lineTo(COLS * this.blockSize, r * this.blockSize);
      this.mainCtx.stroke();
    }
  }

  _drawLockedGrid(grid) {
    // Only render visible rows (skip hidden spawn rows)
    for (let r = HIDDEN_ROWS; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const color = grid[r][c];
        if (color !== 0) {
          this._drawBlock(c, r - HIDDEN_ROWS, color);
        }
      }
    }
  }

  _drawPiece(piece, posX, posY) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          const drawY = posY + r - HIDDEN_ROWS;
          if (drawY >= 0) {
            this._drawBlock(posX + c, drawY, piece.color);
          }
        }
      }
    }
  }

  _drawGhostPiece(piece, ghostY) {
    const m = piece.matrix;
    this.mainCtx.save();
    this.mainCtx.globalAlpha = 0.25;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          const drawY = ghostY + r - HIDDEN_ROWS;
          if (drawY >= 0) {
            this._drawBlock(piece.x + c, drawY, piece.color, true);
          }
        }
      }
    }
    this.mainCtx.restore();
  }

  _drawBlock(x, y, color, isGhost = false) {
    const px = x * this.blockSize;
    const py = y * this.blockSize;
    const size = this.blockSize;

    if (isGhost) {
      this.mainCtx.strokeStyle = color;
      this.mainCtx.lineWidth = 1.5;
      this.mainCtx.strokeRect(px + 1, py + 1, size - 2, size - 2);
      this.mainCtx.fillStyle = color;
      this.mainCtx.fillRect(px + 2, py + 2, size - 4, size - 4);
      return;
    }

    // High quality beveled neon block
    this.mainCtx.fillStyle = color;
    this.mainCtx.fillRect(px, py, size, size);

    // Bevel highlights
    this.mainCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    this.mainCtx.fillRect(px, py, size, 2);
    this.mainCtx.fillRect(px, py, 2, size);

    // Bevel shadow
    this.mainCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.mainCtx.fillRect(px, py + size - 2, size, 2);
    this.mainCtx.fillRect(px + size - 2, py, 2, size);

    // Inset center
    this.mainCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.mainCtx.fillRect(px + 4, py + 4, size - 8, size - 8);
  }

  _renderPreview(ctx, canvas, piece) {
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (!piece) return;

    const m = piece.matrix;
    const miniSize = Math.floor(w / 4.8);
    const pieceWidth = m[0].length * miniSize;
    const pieceHeight = m.length * miniSize;

    const startX = (w - pieceWidth) / 2;
    const startY = (h - pieceHeight) / 2;

    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          const px = startX + c * miniSize;
          const py = startY + r * miniSize;

          ctx.fillStyle = piece.color;
          ctx.fillRect(px, py, miniSize, miniSize);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(px, py, miniSize, 1.5);
          ctx.fillRect(px, py, 1.5, miniSize);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(px, py + miniSize - 1.5, miniSize, 1.5);
          ctx.fillRect(px + miniSize - 1.5, py, 1.5, miniSize);
        }
      }
    }
  }

  updateHUD(state) {
    if (this.scoreEl) this.scoreEl.textContent = state.score.toLocaleString();
    if (this.linesEl) this.linesEl.textContent = state.lines;
    if (this.levelEl) this.levelEl.textContent = state.level;
    if (this.bestScoreEl) this.bestScoreEl.textContent = state.bestScore.toLocaleString();

    if (state.isGameOver && this.gameOverModal) {
      if (this.finalScoreEl) this.finalScoreEl.textContent = state.score.toLocaleString();
      if (this.finalLinesEl) this.finalLinesEl.textContent = state.lines;
      this.gameOverModal.classList.add('active');
    }
  }

  hideGameOverModal() {
    if (this.gameOverModal) {
      this.gameOverModal.classList.remove('active');
    }
  }
}

if (typeof window !== 'undefined') {
  window.BlockDropRenderer = BlockDropRenderer;
}

export { BlockDropRenderer };
