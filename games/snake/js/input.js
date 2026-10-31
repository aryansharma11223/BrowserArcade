/**
 * Browser Arcade - Snake Retro Input Coordinator
 *
 * Captures keyboard (Arrows, WASD, Space), mobile swipe gestures,
 * and virtual D-pad controls while preventing unexpected page scrolling.
 */

export class InputManager {
  /**
   * @param {HTMLElement} touchTarget Target element for swipe detection
   * @param {Function} onDirection Callback invoked with 'UP'|'DOWN'|'LEFT'|'RIGHT'
   * @param {Function} onTogglePause Callback invoked when space / pause key is pressed
   * @param {Function} onRestart Callback invoked when Enter / R is pressed to restart
   */
  constructor(touchTarget, onDirection, onTogglePause, onRestart) {
    this.target = touchTarget;
    this.onDirection = onDirection || (() => {});
    this.onTogglePause = onTogglePause || (() => {});
    this.onRestart = onRestart || (() => {});

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.minSwipeDistance = 20;

    this.bindKeyboard();
    this.bindTouch();
    this.bindVirtualButtons();
  }

  /**
   * Binds keyboard events with strict scroll-hijack prevention.
   */
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore key events when user is typing in a form or input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.onDirection('UP');
          break;

        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.onDirection('DOWN');
          break;

        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.onDirection('LEFT');
          break;

        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.onDirection('RIGHT');
          break;

        case 'Space':
          e.preventDefault();
          this.onTogglePause();
          break;

        case 'Enter':
        case 'KeyR':
          this.onRestart();
          break;

        default:
          break;
      }
    }, { passive: false });
  }

  /**
   * Binds swipe gesture listeners to the game surface.
   */
  bindTouch() {
    if (!this.target) return;

    this.target.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.target.addEventListener('touchmove', (e) => {
      // Prevent browser pull-to-refresh or native scrolling over the game board
      if (e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    this.target.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 0) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const dx = touchEndX - this.touchStartX;
      const dy = touchEndY - this.touchStartY;

      if (Math.hypot(dx, dy) < this.minSwipeDistance) {
        // Tap on board toggles pause / start
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        this.onDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        // Vertical swipe
        this.onDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }, { passive: true });
  }

  /**
   * Binds virtual touch D-pad / directional buttons.
   */
  bindVirtualButtons() {
    const buttons = document.querySelectorAll('[data-snake-dir]');
    buttons.forEach((btn) => {
      const handlePress = (e) => {
        e.preventDefault();
        const dir = btn.dataset.snakeDir;
        if (dir) {
          this.onDirection(dir);
        }
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('click', handlePress);
    });
  }
}
