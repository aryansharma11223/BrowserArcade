/**
 * Browser Arcade - Minesweeper Main Application Controller
 * Coordinates engine, input, renderer, sound synthesizer, and storage.
 */

import { MinesweeperEngine, PRESETS } from './engine.js';
import { MinesweeperInput } from './input.js';
import { MinesweeperRenderer } from './renderer.js';
import { audio } from '/assets/js/sound.js';
import { storage } from '/assets/js/storage.js';
import { getDailyDateString, getDailyChallengeKey } from '/assets/js/prng.js';

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

    this.theme = storage.getItem('minesweeper_theme', 'neon');
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
    this.applyTheme(this.theme);
    this.updateDailyUI();
    this.loadBestTime();
    this.restart();
  }

  updateDailyUI() {
    const banner = document.getElementById('dailyBanner');
    const dateDisplay = document.getElementById('dailyDateDisplay');
    const statusBadge = document.getElementById('dailyStatusBadge');

    if (this.engine.isDaily) {
      if (banner) banner.style.display = 'inline-flex';
      if (dateDisplay) dateDisplay.textContent = getDailyDateString();

      const key = getDailyChallengeKey('minesweeper');
      const dailyRecord = storage.getItem(key, null);
      if (statusBadge) {
        if (dailyRecord && dailyRecord.won) {
          statusBadge.style.display = 'inline-block';
          statusBadge.textContent = `⭐ Solved (${dailyRecord.time}s)`;
        } else {
          statusBadge.style.display = 'none';
        }
      }
    } else {
      if (banner) banner.style.display = 'none';
    }
  }

  applyTheme(theme) {
    this.theme = theme === 'win95' ? 'win95' : 'neon';
    storage.setItem('minesweeper_theme', this.theme);
    const hudBox = document.querySelector('.minesweeper-hud-box');
    const board = document.getElementById('minesweeperBoard');
    const themeBtn = document.getElementById('minesThemeBtn');

    if (this.theme === 'win95') {
      if (hudBox) hudBox.classList.add('theme-win95');
      if (board) board.classList.add('theme-win95');
      if (themeBtn) {
        themeBtn.setAttribute('title', 'Theme: Windows 95 Classic (Click to switch to Neon)');
        themeBtn.setAttribute('aria-label', 'Theme: Windows 95 Classic');
        const icon = themeBtn.querySelector('.theme-btn-icon');
        if (icon) icon.textContent = '💾';
      }
    } else {
      if (hudBox) hudBox.classList.remove('theme-win95');
      if (board) board.classList.remove('theme-win95');
      if (themeBtn) {
        themeBtn.setAttribute('title', 'Theme: Modern Neon (Click to switch to Win95)');
        themeBtn.setAttribute('aria-label', 'Theme: Modern Neon');
        const icon = themeBtn.querySelector('.theme-btn-icon');
        if (icon) icon.textContent = '✨';
      }
    }
  }

  bindDOMControls() {
    const themeBtn = document.getElementById('minesThemeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        audio.playClick();
        this.applyTheme(this.theme === 'win95' ? 'neon' : 'win95');
      });
    }

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
    this.updateDailyUI();
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
      let isNewBest = false;

      if (this.engine.isDaily) {
        const key = getDailyChallengeKey('minesweeper');
        storage.setItem(key, { won: true, time: elapsed, date: new Date().toISOString() });
        this.updateDailyUI();
        isNewBest = true;
      } else {
        isNewBest = this.saveBestTime(elapsed);
      }

      audio.playWin();
      this.renderer.updateAllCells(this.engine.grid);
      this.renderer.updateHUD(0, elapsed, 'won');

      // Customize share button for Daily Challenge if applicable
      const shareBtn = this.dom.winModal ? this.dom.winModal.querySelector('.arcade-share-btn') : null;
      if (this.engine.isDaily && shareBtn) {
        const dateStr = getDailyDateString();
        shareBtn.setAttribute('data-share-title', `Browser Arcade Daily Challenge (${dateStr})`);
        shareBtn.setAttribute('data-share-text', `Browser Arcade Daily Challenge (${dateStr}) 💣 Minefield Cleared in ${elapsed}s! Can you beat my time? https://browserarcade.pages.dev/games/minesweeper/`);
      } else if (shareBtn) {
        shareBtn.removeAttribute('data-share-title');
        shareBtn.removeAttribute('data-share-text');
      }

      setTimeout(() => this.renderer.showWinModal(elapsed, isNewBest, this.engine.isDaily), 400);
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
