/**
 * Browser Arcade - 2048 Input Manager
 * Handles keyboard (Arrows, WASD) and mobile touch swipe gestures.
 * Completely decoupled from game engine & rendering.
 */

class InputManager {
  /**
   * @param {HTMLElement} targetElement The game board element for touch gestures
   * @param {Function} onMoveCallback Callback invoked with ('UP'|'RIGHT'|'DOWN'|'LEFT')
   */
  constructor(targetElement, onMoveCallback) {
    this.targetElement = targetElement;
    this.onMoveCallback = onMoveCallback;

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchThreshold = 28; // Minimum swipe distance in px

    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundTouchStart = this._handleTouchStart.bind(this);
    this._boundTouchMove = this._handleTouchMove.bind(this);
    this._boundTouchEnd = this._handleTouchEnd.bind(this);

    this.init();
  }

  init() {
    window.addEventListener('keydown', this._boundKeyDown);

    if (this.targetElement) {
      this.targetElement.addEventListener('touchstart', this._boundTouchStart, { passive: false });
      this.targetElement.addEventListener('touchmove', this._boundTouchMove, { passive: false });
      this.targetElement.addEventListener('touchend', this._boundTouchEnd, { passive: false });
      this.targetElement.addEventListener('touchcancel', this._boundTouchEnd, { passive: false });
    }
  }

  /**
   * Optional callback for undo shortcut
   * @param {Function} onUndoCallback
   */
  setUndoCallback(onUndoCallback) {
    this.onUndoCallback = onUndoCallback;
  }

  destroy() {
    window.removeEventListener('keydown', this._boundKeyDown);

    if (this.targetElement) {
      this.targetElement.removeEventListener('touchstart', this._boundTouchStart);
      this.targetElement.removeEventListener('touchmove', this._boundTouchMove);
      this.targetElement.removeEventListener('touchend', this._boundTouchEnd);
      this.targetElement.removeEventListener('touchcancel', this._boundTouchEnd);
    }
  }

  /**
   * Handles keyboard navigation and shortcuts.
   * @private
   */
  _handleKeyDown(event) {
    // Avoid intercepting if an input field or textarea has focus
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    // Check for Undo shortcut: 'U', or 'Ctrl+Z' / 'Cmd+Z'
    if (
      (event.key === 'u' || event.key === 'U') ||
      ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z'))
    ) {
      if (this.onUndoCallback) {
        event.preventDefault();
        this.onUndoCallback();
        return;
      }
    }

    const keyMap = {
      ArrowUp: 'UP',
      KeyW: 'UP',
      ArrowRight: 'RIGHT',
      KeyD: 'RIGHT',
      ArrowDown: 'DOWN',
      KeyS: 'DOWN',
      ArrowLeft: 'LEFT',
      KeyA: 'LEFT'
    };

    const direction = keyMap[event.code] || keyMap[event.key];
    if (direction) {
      event.preventDefault(); // Suppress window scroll
      this.onMoveCallback(direction);
    }
  }

  /**
   * Captures starting touch coordinates.
   * @private
   */
  _handleTouchStart(event) {
    if (event.touches.length > 1) return; // Ignore multi-touch gestures
    // Avoid triggering board swipe if user taps an active overlay button
    if (event.target.closest('button, .game-overlay.active, .arcade-modal-card')) return;

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  /**
   * Prevents standard page scroll on the game board during swipe.
   * @private
   */
  _handleTouchMove(event) {
    // Prevent rubber-banding or accidental scroll while interacting with the board
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  /**
   * Evaluates gesture delta and triggers directional move.
   * @private
   */
  _handleTouchEnd(event) {
    if (!event.changedTouches || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Require swipe to exceed minimum threshold
    if (Math.max(absDx, absDy) < this.touchThreshold) return;

    // Determine primary movement axis (horizontal vs vertical)
    if (absDx > absDy) {
      // Horizontal swipe
      this.onMoveCallback(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      // Vertical swipe
      this.onMoveCallback(dy > 0 ? 'DOWN' : 'UP');
    }
  }
}

export { InputManager };
