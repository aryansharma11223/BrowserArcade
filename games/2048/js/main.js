/**
 * Browser Arcade - 2048 Game Coordinator
 * Bridges GameEngine, GridRenderer, InputManager, and AudioManager.
 * Ensures input queueing, score persistence, and flawless state sync.
 */

import { GameEngine } from './engine.js';
import { GridRenderer } from './renderer.js';
import { InputManager } from './input.js';
import { audio } from '../../../assets/js/sound.js';
import { storage } from '../../../assets/js/storage.js';

class Game2048App {
  constructor() {
    this.bestScoreKey = '2048_bestScore';
    this.bestScore = storage.getItem(this.bestScoreKey, 0);

    this.engine = new GameEngine();
    this.renderer = new GridRenderer();

    // Input queue & animation state
    this.isAnimating = false;
    this.inputQueue = [];
    this.maxQueueSize = 2; // Buffer up to 2 rapid consecutive inputs
    this.animationDuration = 115; // Matches CSS transition duration

    this.init();
  }

  init() {
    // Mount InputManager on game board
    const boardElement = document.getElementById('gameBoard');
    this.input = new InputManager(boardElement, (direction) => {
      this.handleInput(direction);
    });

    // Keyboard shortcut for Undo (U or Ctrl+Z)
    this.input.setUndoCallback(() => {
      this.undo();
    });

    // Bind action buttons
    this.bindButtons();

    // Initial render
    this.renderer.syncGrid(this.engine.getTiles(), true);
    this.renderer.updateScores(this.engine.score, this.bestScore);
    this.renderer.updateUndoState(this.engine.canUndo());
  }

  bindButtons() {
    // New game buttons
    document.querySelectorAll('.btn-new-game').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.playClick();
        this.newGame();
      });
    });

    // Undo buttons
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.undo();
      });
    }

    // Keep Going (Win overlay)
    const keepGoingBtn = document.getElementById('keepGoingBtn');
    if (keepGoingBtn) {
      keepGoingBtn.addEventListener('click', () => {
        audio.playClick();
        this.continueGame();
      });
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

      // Dismiss on backdrop click
      rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
          rulesModal.classList.remove('active');
        }
      });
    }
  }

  /**
   * Processes player directional movement with a robust FIFO animation queue.
   * Prevents rapid input spamming from desynchronizing UI or dropped commands.
   * @param {'UP'|'RIGHT'|'DOWN'|'LEFT'} direction
   */
  handleInput(direction) {
    if (this.isAnimating) {
      if (this.inputQueue.length < this.maxQueueSize) {
        this.inputQueue.push(direction);
      }
      return;
    }

    const result = this.engine.move(direction);
    if (!result.moved) {
      // If move was invalid, drain next queued input if any
      this._drainNextInput();
      return;
    }

    this.isAnimating = true;

    // Update Best Score persistence if current score exceeded it
    if (this.engine.score > this.bestScore) {
      this.bestScore = this.engine.score;
      storage.setItem(this.bestScoreKey, this.bestScore);
    }

    // Trigger audio feedback based on move outcome
    if (result.mergedTiles.length > 0) {
      const highestMergedVal = Math.max(...result.mergedTiles.map(m => m.value));
      audio.playMerge(highestMergedVal);
    } else {
      audio.playSlide();
    }

    // Render move transitions and HUD
    this.renderer.renderMove(result, this.engine.getTiles());
    this.renderer.updateScores(this.engine.score, this.bestScore, result.scoreGained);
    this.renderer.updateUndoState(this.engine.canUndo());

    // Check Win and Game Over conditions
    if (result.won && !this.engine.keepPlaying) {
      setTimeout(() => {
        audio.playWin();
        this.renderer.showWin();
      }, this.animationDuration + 50);
    } else if (result.gameOver) {
      setTimeout(() => {
        audio.playGameOver();
        this.renderer.showGameOver(this.engine.score);
      }, this.animationDuration + 50);
    }

    // Release animation lock and drain next queued input
    setTimeout(() => {
      this.isAnimating = false;
      this._drainNextInput();
    }, this.animationDuration);
  }

  /**
   * Drains and executes the next pending movement in the FIFO queue.
   * @private
   */
  _drainNextInput() {
    if (this.inputQueue.length > 0) {
      const nextMove = this.inputQueue.shift();
      this.handleInput(nextMove);
    }
  }

  /**
   * Reverts to the previous board and score state.
   */
  undo() {
    if (!this.engine.canUndo()) return;

    audio.playUndo();
    const success = this.engine.undo();
    if (!success) return;

    // Cleanly re-render restored tiles
    this.renderer.syncGrid(this.engine.getTiles());
    this.renderer.updateScores(this.engine.score, this.bestScore);
    this.renderer.updateUndoState(this.engine.canUndo());

    // Dismiss overlays if undone from win or game over
    this.renderer.hideGameOver();
    if (!this.engine.won) {
      this.renderer.hideWin();
    }
  }

  /**
   * Continues the game past 2048 in endless mode.
   */
  continueGame() {
    this.engine.continuePlaying();
    this.renderer.hideWin();
  }

  /**
   * Starts a completely new game.
   */
  newGame() {
    this.engine.reset();
    this.renderer.hideGameOver();
    this.renderer.hideWin();
    this.renderer.syncGrid(this.engine.getTiles(), true);
    this.renderer.updateScores(this.engine.score, this.bestScore);
    this.renderer.updateUndoState(this.engine.canUndo());
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Game2048App());
} else {
  new Game2048App();
}

export { Game2048App };
