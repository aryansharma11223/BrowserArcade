/**
 * Browser Arcade - Block Drop Main Application Controller
 * Manages 60 FPS requestAnimationFrame loop, gravity timing, audio, and persistence.
 */

import { BlockDropEngine } from './engine.js';
import { BlockDropRenderer } from './renderer.js';
import { BlockDropInput } from './input.js';
import { audio } from '/assets/js/sound.js';
import { storage } from '/assets/js/storage.js';

class BlockDropGame {
  constructor() {
    this.engine = new BlockDropEngine();
    this.lastDropTime = 0;
    this.animationFrameId = null;

    this.dom = {
      mainCanvas: document.getElementById('blockDropCanvas'),
      nextCanvas: document.getElementById('nextPieceCanvas'),
      holdCanvas: document.getElementById('holdPieceCanvas'),
      scoreEl: document.getElementById('scoreDisplay'),
      linesEl: document.getElementById('linesDisplay'),
      levelEl: document.getElementById('levelDisplay'),
      bestScoreEl: document.getElementById('bestScoreDisplay'),
      pauseBtn: document.getElementById('pauseBtn'),
      restartBtn: document.getElementById('restartBtn'),
      gameOverModal: document.getElementById('gameOverModal'),
      finalScoreEl: document.getElementById('finalScoreDisplay'),
      finalLinesEl: document.getElementById('finalLinesDisplay'),
      playAgainBtn: document.getElementById('playAgainBtn')
    };

    this.renderer = new BlockDropRenderer(this.dom);
    this.input = new BlockDropInput(this.dom.mainCanvas, {
      onMoveLeft: () => this.handleMoveLeft(),
      onMoveRight: () => this.handleMoveRight(),
      onRotate: (cw) => this.handleRotate(cw),
      onSoftDrop: () => this.handleSoftDrop(),
      onHardDrop: () => this.handleHardDrop(),
      onHold: () => this.handleHold(),
      onPause: () => this.togglePause(),
      onRestart: () => this.restart()
    });

    this.init();
  }

  init() {
    this.loadBestScore();
    this.bindControls();
    window.addEventListener('resize', () => {
      this.renderer.setupCanvas();
      this.renderer.render(this.engine.getState());
    });

    this.restart();
  }

  loadBestScore() {
    const saved = storage.getItem('blockdrop_bestScore', 0);
    this.engine.bestScore = parseInt(saved, 10) || 0;
    if (this.dom.bestScoreEl) {
      this.dom.bestScoreEl.textContent = this.engine.bestScore.toLocaleString();
    }
  }

  saveBestScore() {
    if (this.engine.score > this.engine.bestScore) {
      this.engine.bestScore = this.engine.score;
      storage.setItem('blockdrop_bestScore', this.engine.bestScore);
    }
  }

  bindControls() {
    if (this.dom.pauseBtn) {
      this.dom.pauseBtn.addEventListener('click', () => {
        audio.playClick();
        this.togglePause();
      });
    }

    if (this.dom.restartBtn) {
      this.dom.restartBtn.addEventListener('click', () => {
        audio.playClick();
        this.restart();
      });
    }

    if (this.dom.playAgainBtn) {
      this.dom.playAgainBtn.addEventListener('click', () => {
        audio.playClick();
        this.renderer.hideGameOverModal();
        this.restart();
      });
    }
  }

  restart() {
    this.engine.reset();
    this.loadBestScore();
    this.renderer.hideGameOverModal();
    this.lastDropTime = performance.now();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.gameLoop(performance.now());
  }

  togglePause() {
    if (this.engine.isGameOver) return;
    this.engine.isPaused = !this.engine.isPaused;
    if (this.dom.pauseBtn) {
      this.dom.pauseBtn.textContent = this.engine.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }
    if (!this.engine.isPaused) {
      this.lastDropTime = performance.now();
      this.gameLoop(performance.now());
    }
  }

  handleMoveLeft() {
    if (this.engine.moveLeft()) {
      audio.playClick();
      this.renderer.render(this.engine.getState());
    }
  }

  handleMoveRight() {
    if (this.engine.moveRight()) {
      audio.playClick();
      this.renderer.render(this.engine.getState());
    }
  }

  handleRotate(cw) {
    if (this.engine.rotate(cw)) {
      audio.playRotate();
      this.renderer.render(this.engine.getState());
    }
  }

  handleSoftDrop() {
    const res = this.engine.softDrop();
    if (res.moved) {
      this.renderer.render(this.engine.getState());
    } else if (res.locked) {
      this.handleLockEffects(res);
    }
  }

  handleHardDrop() {
    const res = this.engine.hardDrop();
    if (res.locked) {
      audio.playDrop();
      this.handleLockEffects(res);
    }
  }

  handleHold() {
    if (this.engine.hold()) {
      audio.playHold();
      this.renderer.render(this.engine.getState());
    }
  }

  handleLockEffects(lockResult) {
    this.saveBestScore();

    if (lockResult.linesCleared >= 4) {
      audio.playTetrisClear();
    } else if (lockResult.linesCleared > 0) {
      audio.playLineClear();
    } else {
      audio.playDrop();
    }

    if (this.engine.isGameOver) {
      audio.playExplosion();
      this.saveBestScore();
    }

    this.renderer.render(this.engine.getState());
  }

  gameLoop(currentTime) {
    if (this.engine.isPaused) return;

    if (!this.engine.isGameOver) {
      const dropInterval = this.engine.getDropInterval();
      if (currentTime - this.lastDropTime > dropInterval) {
        const res = this.engine.softDrop();
        if (res.locked) {
          this.handleLockEffects(res);
        }
        this.lastDropTime = currentTime;
      }
      this.renderer.render(this.engine.getState());
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    } else {
      this.renderer.render(this.engine.getState());
    }
  }
}

// Instantiate game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.blockDropGame = new BlockDropGame();
});

export { BlockDropGame };
