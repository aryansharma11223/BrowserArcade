/**
 * Browser Arcade - Snake Retro Game Coordinator
 *
 * Bridges GameEngine, GridRenderer, InputManager, AudioManager, and StorageManager.
 * Manages the 60 FPS animation loop, audio feedback, HUD score sync, and modal lifecycles.
 */

import { GameEngine, GameStatus } from './engine.js';
import { GridRenderer } from './renderer.js';
import { InputManager } from './input.js';
import { audio } from '../../../assets/js/sound.js';
import { storage } from '../../../assets/js/storage.js';

export class SnakeApp {
  constructor() {
    this.bestScoreKey = 'snake_bestScore';
    this.bestScore = storage.getItem(this.bestScoreKey, 0);

    this.engine = new GameEngine({
      cols: 20,
      rows: 20,
      bestScore: this.bestScore
    });

    this.canvas = document.getElementById('snakeCanvas');
    this.boardContainer = document.getElementById('gameBoard');
    this.renderer = new GridRenderer(this.canvas, 20, 20);

    this.lastTickTime = performance.now();
    this.animationFrameId = null;

    this.init();
  }

  init() {
    // 1. Mount Input Coordinator
    this.input = new InputManager(
      this.boardContainer,
      (dir) => this.handleDirection(dir),
      () => this.togglePause(),
      () => this.restartGame()
    );

    // 2. Bind UI Action Buttons
    this.bindButtons();

    // 3. Sync Initial Scores in DOM
    this.updateScoreDisplay(0, this.bestScore);

    // 4. Handle Window Resizes with DPR adjustment
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // 5. Start Render & Game Loop
    this.lastTickTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Main 60 FPS game loop.
   * Renders every frame; ticks snake movement based on dynamic speed progression.
   * @param {DOMHighResTimeStamp} now
   */
  loop(now) {
    if (this.engine.status === GameStatus.PLAYING) {
      const interval = this.engine.getSpeed();
      if (now - this.lastTickTime >= interval) {
        this.lastTickTime = now;
        const result = this.engine.tick();
        this.handleTickResult(result);
      }
    }

    // Render 60 FPS frame (particles, food pulse, snake)
    this.renderer.render(this.engine);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Handles direction input from keyboard, swipe, or D-pad.
   * If game is in IDLE state, auto-starts on first directional command.
   * @param {string} dir
   */
  handleDirection(dir) {
    if (this.engine.status === GameStatus.IDLE) {
      this.startGame();
    } else if (this.engine.status === GameStatus.PAUSED) {
      this.resumeGame();
    }

    this.engine.queueDirection(dir);
  }

  /**
   * Evaluates the outcome of each movement tick.
   * @param {Object} result
   */
  handleTickResult(result) {
    if (!result) return;

    if (result.ateFood) {
      audio.playEat();
      if (result.food) {
        this.renderer.addFoodParticles(result.food.x, result.food.y);
      }
      this.updateScoreDisplay(result.score, result.bestScore, 10);

      // Persist best score if beaten
      if (result.score >= result.bestScore) {
        storage.setItem(this.bestScoreKey, result.bestScore);
      }
    }

    if (result.gameOver) {
      audio.playGameOver();
      storage.setItem(this.bestScoreKey, this.engine.bestScore);
      this.showGameOver(result.score, this.engine.bestScore);
    }
  }

  /**
   * Starts gameplay from idle state.
   */
  startGame() {
    audio.playClick();
    this.hideStartOverlay();
    this.hideGameOverOverlay();
    this.hidePauseOverlay();
    this.engine.start();
    this.updatePauseButton(false);
  }

  /**
   * Toggles pause/resume state.
   */
  togglePause() {
    audio.playClick();
    if (this.engine.status === GameStatus.PLAYING) {
      this.engine.pause();
      this.showPauseOverlay();
      this.updatePauseButton(true);
    } else if (this.engine.status === GameStatus.PAUSED) {
      this.resumeGame();
    } else if (this.engine.status === GameStatus.IDLE) {
      this.startGame();
    }
  }

  /**
   * Resumes paused game.
   */
  resumeGame() {
    audio.playClick();
    this.engine.resume();
    this.hidePauseOverlay();
    this.updatePauseButton(false);
    this.lastTickTime = performance.now();
  }

  /**
   * Restarts the game to a clean state.
   */
  restartGame() {
    audio.playClick();
    this.engine.reset();
    this.engine.start();
    this.hideGameOverOverlay();
    this.hidePauseOverlay();
    this.hideStartOverlay();
    this.updateScoreDisplay(0, this.engine.bestScore);
    this.updatePauseButton(false);
    this.lastTickTime = performance.now();
  }

  /**
   * Updates score and high-score elements in the DOM.
   */
  updateScoreDisplay(score, bestScore, gained = 0) {
    const scoreEl = document.getElementById('currentScore');
    const bestEl = document.getElementById('bestScore');

    if (scoreEl) scoreEl.textContent = score;
    if (bestEl) bestEl.textContent = bestScore;

    if (gained > 0 && scoreEl) {
      this._showScoreAddition(scoreEl, `+${gained}`);
    }
  }

  /**
   * Floating score popup animation.
   * @private
   */
  _showScoreAddition(targetEl, text) {
    const container = targetEl.closest('.score-box');
    if (!container) return;

    const popup = document.createElement('div');
    popup.className = 'score-addition';
    popup.textContent = text;
    container.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 600);
  }

  /**
   * Updates the pause button label and aria state.
   */
  updatePauseButton(isPaused) {
    const btn = document.getElementById('pauseBtn');
    if (!btn) return;

    btn.setAttribute('aria-label', isPaused ? 'Resume Game' : 'Pause Game');
    btn.setAttribute('title', isPaused ? 'Resume Game (Space)' : 'Pause Game (Space)');

    const label = btn.querySelector('.btn-label');
    if (label) {
      label.textContent = isPaused ? 'Resume' : 'Pause';
    }
  }

  showGameOver(score, best) {
    const overlay = document.getElementById('gameOverOverlay');
    const finalScoreEl = document.getElementById('finalScore');
    const bestScoreEl = document.getElementById('modalBestScore');

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (bestScoreEl) bestScoreEl.textContent = best;
    if (overlay) overlay.classList.add('active');
  }

  hideGameOverOverlay() {
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  showPauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) overlay.classList.add('active');
  }

  hidePauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  hideStartOverlay() {
    const overlay = document.getElementById('startOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  bindButtons() {
    // New game buttons
    document.querySelectorAll('.btn-new-game').forEach(btn => {
      btn.addEventListener('click', () => this.restartGame());
    });

    // Pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    // Resume button in pause overlay
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeGame());
    }

    // Start button in initial overlay
    const startBtn = document.getElementById('startOverlayBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // Instructions modal toggle
    const rulesBtn = document.getElementById('rulesBtn');
    const rulesModal = document.getElementById('rulesModal');
    const closeRulesBtn = document.getElementById('closeRulesBtn');

    if (rulesBtn && rulesModal) {
      rulesBtn.addEventListener('click', () => {
        audio.playClick();
        rulesModal.classList.add('active');
      });
    }

    if (closeRulesBtn && rulesModal) {
      closeRulesBtn.addEventListener('click', () => {
        audio.playClick();
        rulesModal.classList.remove('active');
      });

      rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
          rulesModal.classList.remove('active');
        }
      });
    }
  }
}

// Auto-bootstrap when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SnakeApp());
  } else {
    new SnakeApp();
  }
}
