/**
 * Browser Arcade - Minesweeper Input Manager
 * Handles desktop mouse, mobile touch gestures, and keyboard navigation.
 */

class MinesweeperInput {
  constructor(boardElement, callbacks = {}) {
    this.board = boardElement;
    this.callbacks = callbacks;
    this.mode = 'reveal'; // 'reveal' | 'flag'
    this.focusedCoord = { r: 0, c: 0 };
    this.longPressTimer = null;
    this.longPressFired = false;
    this.touchStartPos = { x: 0, y: 0 };

    this._bindMouseEvents();
    this._bindTouchEvents();
    this._bindKeyboardEvents();
  }

  setMode(mode) {
    if (mode === 'reveal' || mode === 'flag') {
      this.mode = mode;
      if (this.callbacks.onModeChange) {
        this.callbacks.onModeChange(this.mode);
      }
    }
  }

  toggleMode() {
    this.setMode(this.mode === 'reveal' ? 'flag' : 'reveal');
  }

  _bindMouseEvents() {
    // Prevent standard context menu on board
    this.board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = e.target.closest('.mine-cell');
      if (target) {
        const r = parseInt(target.dataset.row, 10);
        const c = parseInt(target.dataset.col, 10);
        if (this.callbacks.onFlag) {
          this.callbacks.onFlag(r, c);
        }
      }
    });

    // Primary click
    this.board.addEventListener('click', (e) => {
      if (this.longPressFired) {
        this.longPressFired = false;
        return;
      }

      const target = e.target.closest('.mine-cell');
      if (!target) return;

      const r = parseInt(target.dataset.row, 10);
      const c = parseInt(target.dataset.col, 10);

      // In flag mode on touch/mobile
      if (this.mode === 'flag' && !target.classList.contains('revealed')) {
        if (this.callbacks.onFlag) {
          this.callbacks.onFlag(r, c);
        }
        return;
      }

      // If already revealed with numbers, click triggers chord
      if (target.classList.contains('revealed')) {
        if (this.callbacks.onChord) {
          this.callbacks.onChord(r, c);
        }
        return;
      }

      // Standard reveal
      if (this.callbacks.onReveal) {
        this.callbacks.onReveal(r, c);
      }
    });

    // Middle click chord
    this.board.addEventListener('mousedown', (e) => {
      if (e.button === 1) { // Middle click
        e.preventDefault();
        const target = e.target.closest('.mine-cell');
        if (target) {
          const r = parseInt(target.dataset.row, 10);
          const c = parseInt(target.dataset.col, 10);
          if (this.callbacks.onChord) {
            this.callbacks.onChord(r, c);
          }
        }
      }
    });
  }

  _bindTouchEvents() {
    this.board.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const target = e.target.closest('.mine-cell');
      if (!target) return;

      const touch = e.touches[0];
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      this.longPressFired = false;

      const r = parseInt(target.dataset.row, 10);
      const c = parseInt(target.dataset.col, 10);

      this.longPressTimer = setTimeout(() => {
        this.longPressFired = true;
        if (navigator.vibrate) {
          try { navigator.vibrate(35); } catch (_) {}
        }
        if (this.callbacks.onFlag) {
          this.callbacks.onFlag(r, c);
        }
      }, 350);
    }, { passive: true });

    this.board.addEventListener('touchmove', (e) => {
      if (!this.longPressTimer) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - this.touchStartPos.x);
      const dy = Math.abs(touch.clientY - this.touchStartPos.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });

    this.board.addEventListener('touchend', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });

    this.board.addEventListener('touchcancel', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });
  }

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key;
      let handled = false;

      if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        this.focusedCoord.r = Math.max(0, this.focusedCoord.r - 1);
        handled = true;
      } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        this.focusedCoord.r = this.focusedCoord.r + 1;
        handled = true;
      } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        this.focusedCoord.c = Math.max(0, this.focusedCoord.c - 1);
        handled = true;
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        this.focusedCoord.c = this.focusedCoord.c + 1;
        handled = true;
      } else if (key === 'Enter' || key === ' ') {
        if (this.mode === 'flag') {
          if (this.callbacks.onFlag) this.callbacks.onFlag(this.focusedCoord.r, this.focusedCoord.c);
        } else {
          if (this.callbacks.onReveal) this.callbacks.onReveal(this.focusedCoord.r, this.focusedCoord.c);
        }
        handled = true;
      } else if (key === 'f' || key === 'F') {
        if (this.callbacks.onFlag) this.callbacks.onFlag(this.focusedCoord.r, this.focusedCoord.c);
        handled = true;
      } else if (key === 'c' || key === 'C') {
        if (this.callbacks.onChord) this.callbacks.onChord(this.focusedCoord.r, this.focusedCoord.c);
        handled = true;
      } else if (key === 'r' || key === 'R') {
        if (this.callbacks.onRestart) this.callbacks.onRestart();
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        this._updateKeyboardFocus();
      }
    });
  }

  _updateKeyboardFocus() {
    const cells = this.board.querySelectorAll('.mine-cell');
    cells.forEach(c => c.classList.remove('keyboard-focused'));

    const target = this.board.querySelector(`[data-row="${this.focusedCoord.r}"][data-col="${this.focusedCoord.c}"]`);
    if (target) {
      target.classList.add('keyboard-focused');
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  destroy() {
    // Teardown
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
  }
}

export { MinesweeperInput };
