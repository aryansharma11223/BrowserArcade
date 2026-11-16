/**
 * Browser Arcade - Minesweeper Main Application Controller
 * Coordinates engine, input, renderer, sound synthesizer, and storage.
 */

import { MinesweeperEngine, PRESETS } from './engine.js';
import { MinesweeperInput } from './input.js';
import { MinesweeperRenderer } from './renderer.js';
import { audio } from '/assets/js/sound.js';
import { storage } from '/assets/js/storage.js';

class MinesweeperGame {
  constructor() {
    this.engine = new MinesweeperEngine('beginner');
    this.timerInterval = null;

    this.dom = {
      board: document.getElementById('minesweeperBoard'),
      mineCount: document.getElementById('mineCountDisplay'),
      timer: document.getElementById('timerDisplay'),
      faceBtn: document.getElementById('faceBtn'),
      bestTime: document.getElementById('bestTimeDisplay'),
      modeToggleBtn: document.getElementById('modeToggleBtn'),
      modeIndicator: document.getElementById('modeIndicatorText'),
      diffButtons: document.querySelectorAll('.diff-btn'),
      winModal: document.getElementById('winModal'),
      winTime: document.getElementById('winTimeDisplay'),
      winBest: document.getElementById('winBestBadge'),
      lossModal: document.getElementById('lossModal'),
      playAgainBtn: document.getElementById('winPlayAgainBtn'),
      tryAgainBtn: document.getElementById('lossTryAgainBtn')
    };

    this.renderer = new MinesweeperRenderer(this.dom);
    this.input = new MinesweeperInput(this.dom.board, {
      onReveal: (r, c) => this.handleReveal(r, c),
      onFlag: (r, c) => this.handleFlag(r, c),
      onChord: (r, c) => this.handleChord(r, c),
      onRestart: () => this.restart(),
      onModeChange: (mode) => this.handleModeChange(mode)
    });

    this.init();
  }

  init() {
    this.bindDOMControls();
    this.loadBestTime();
    this.restart();
  }

  bindDOMControls() {
    if (this.dom.faceBtn) {
      this.dom.faceBtn.addEventListener('click', () => {
        audio.playClick();
        this.restart();
      });
    }

    if (this.dom.modeToggleBtn) {
      this.dom.modeToggleBtn.addEventListener('click', () => {
        this.input.toggleMode();
        audio.playClick();
      });
    }

    this.dom.diffButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const diff = e.currentTarget.dataset.diff;
        if (diff && PRESETS[diff]) {
          this.dom.diffButtons.forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          this.setDifficulty(diff);
          audio.playClick();
        }
      });
    });

    if (this.dom.playAgainBtn) {
      this.dom.playAgainBtn.addEventListener('click', () => {
        this.renderer.hideWinModal();
        audio.playClick();
        this.restart();
      });
    }

    if (this.dom.tryAgainBtn) {
      this.dom.tryAgainBtn.addEventListener('click', () => {
        this.renderer.hideLossModal();
        audio.playClick();
        this.restart();
      });
    }
  }

  setDifficulty(diff) {
    this.engine.setDifficulty(diff);
    this.loadBestTime();
    this.restart();
  }

  loadBestTime() {
    const times = storage.getItem('minesweeper_bestTimes', {});
    const best = times[this.engine.difficulty] || null;
    this.renderer.updateBestTime(best);
  }

  saveBestTime(elapsedTime) {
    const times = storage.getItem('minesweeper_bestTimes', {});
    const currentBest = times[this.engine.difficulty] || null;
    let isNewBest = false;

    if (!currentBest || elapsedTime < currentBest) {
      times[this.engine.difficulty] = elapsedTime;
      storage.setItem('minesweeper_bestTimes', times);
      isNewBest = true;
      this.renderer.updateBestTime(elapsedTime);
    }

    return isNewBest;
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.engine.status === 'playing') {
        const elapsed = this.engine.getElapsedTime();
        this.renderer.updateHUD(this.engine.getRemainingMines(), elapsed, this.engine.status);
      } else {
        this.stopTimer();
      }
    }, 500);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  restart() {
    this.stopTimer();
    this.renderer.hideWinModal();
    this.renderer.hideLossModal();
    this.engine.reset();
    this.renderer.setupBoard(this.engine.rows, this.engine.cols);
    this.renderer.updateHUD(this.engine.totalMines, 0, 'ready');
    this.renderer.updateModeIndicator(this.input.mode);
  }

  handleReveal(r, c) {
    const wasFirst = this.engine.firstClick;
    const res = this.engine.reveal(r, c);
    if (!res.changed) return;

    if (wasFirst && this.engine.status === 'playing') {
      this.startTimer();
    }

    if (res.status === 'lost') {
      this.stopTimer();
      audio.playExplosion();
      this.renderer.updateAllCells(this.engine.grid, this.engine.explodedMine);
      this.renderer.updateHUD(this.engine.getRemainingMines(), this.engine.getElapsedTime(), 'lost');
      setTimeout(() => this.renderer.showLossModal(), 400);
      return;
    }

    audio.playReveal();

    if (res.revealedCells) {
      res.revealedCells.forEach(cell => this.renderer.updateCell(cell));
    }

    if (res.status === 'won') {
      this.stopTimer();
      const elapsed = this.engine.getElapsedTime();
      const isNewBest = this.saveBestTime(elapsed);
      audio.playWin();
      this.renderer.updateAllCells(this.engine.grid);
      this.renderer.updateHUD(0, elapsed, 'won');
      setTimeout(() => this.renderer.showWinModal(elapsed, isNewBest), 400);
    } else {
      this.renderer.updateHUD(this.engine.getRemainingMines(), this.engine.getElapsedTime(), 'playing');
    }
  }

  handleFlag(r, c) {
    const wasReady = this.engine.status === 'ready';
    const res = this.engine.toggleFlag(r, c);
    if (!res.changed) return;

    if (wasReady && this.engine.status === 'playing') {
      this.startTimer();
    }

    audio.playFlag();
    this.renderer.updateCell(res.cell);
    this.renderer.updateHUD(res.remainingMines, this.engine.getElapsedTime(), this.engine.status);
  }

  handleChord(r, c) {
    const res = this.engine.chord(r, c);
    if (!res.changed) return;

    if (res.status === 'lost') {
      this.stopTimer();
      audio.playExplosion();
      this.renderer.updateAllCells(this.engine.grid, this.engine.explodedMine);
      this.renderer.updateHUD(this.engine.getRemainingMines(), this.engine.getElapsedTime(), 'lost');
      setTimeout(() => this.renderer.showLossModal(), 400);
      return;
    }

    audio.playReveal();
    this.renderer.updateAllCells(this.engine.grid);

    if (res.status === 'won') {
      this.stopTimer();
      const elapsed = this.engine.getElapsedTime();
      const isNewBest = this.saveBestTime(elapsed);
      audio.playWin();
      this.renderer.updateHUD(0, elapsed, 'won');
      setTimeout(() => this.renderer.showWinModal(elapsed, isNewBest), 400);
    } else {
      this.renderer.updateHUD(this.engine.getRemainingMines(), this.engine.getElapsedTime(), 'playing');
    }
  }

  handleModeChange(mode) {
    this.renderer.updateModeIndicator(mode);
  }
}

// Instantiate on DOMContentLoaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new MinesweeperGame();
  });
}

export { MinesweeperGame };
