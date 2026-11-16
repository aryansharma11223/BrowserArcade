/**
 * Browser Arcade - Block Drop Multi-Device Input Manager
 * Handles desktop keyboard mappings, repeat delay (DAS/ARR), touch gestures,
 * and on-screen virtual arcade gamepad.
 */

class BlockDropInput {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = Object.assign({
      onMoveLeft: () => {},
      onMoveRight: () => {},
      onRotate: (clockwise) => {},
      onSoftDrop: () => {},
      onHardDrop: () => {},
      onHold: () => {},
      onPause: () => {},
      onRestart: () => {}
    }, callbacks);

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    this.bindKeyboard();
    this.bindTouch();
    this.bindVirtualGamepad();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in form field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.callbacks.onMoveLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.callbacks.onMoveRight();
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.callbacks.onRotate(true);
          break;
        case 'KeyZ':
          e.preventDefault();
          this.callbacks.onRotate(false);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.callbacks.onSoftDrop();
          break;
        case 'Space':
          e.preventDefault();
          this.callbacks.onHardDrop();
          break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          e.preventDefault();
          this.callbacks.onHold();
          break;
        case 'KeyP':
          e.preventDefault();
          this.callbacks.onPause();
          break;
        case 'KeyR':
          e.preventDefault();
          this.callbacks.onRestart();
          break;
      }
    });
  }

  bindTouch() {
    if (!this.canvas) return;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const duration = Date.now() - this.touchStartTime;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Tap detected (short duration & small travel)
        if (duration < 220 && absDx < 20 && absDy < 20) {
          this.callbacks.onRotate(true);
          return;
        }

        // Swipe detected
        if (absDx > absDy && absDx > 25) {
          if (dx > 0) {
            this.callbacks.onMoveRight();
          } else {
            this.callbacks.onMoveLeft();
          }
        } else if (absDy > absDx && absDy > 30) {
          if (dy > 0) {
            if (duration < 200 && dy > 80) {
              this.callbacks.onHardDrop();
            } else {
              this.callbacks.onSoftDrop();
            }
          }
        }
      }
    }, { passive: false });
  }

  bindVirtualGamepad() {
    const btnMap = [
      { id: 'btnMoveLeft', action: () => this.callbacks.onMoveLeft() },
      { id: 'btnMoveRight', action: () => this.callbacks.onMoveRight() },
      { id: 'btnRotate', action: () => this.callbacks.onRotate(true) },
      { id: 'btnSoftDrop', action: () => this.callbacks.onSoftDrop() },
      { id: 'btnHardDrop', action: () => this.callbacks.onHardDrop() },
      { id: 'btnHold', action: () => this.callbacks.onHold() }
    ];

    btnMap.forEach(({ id, action }) => {
      const el = document.getElementById(id);
      if (el) {
        const handleTrigger = (e) => {
          e.preventDefault();
          action();
          if (window.navigator && window.navigator.vibrate) {
            try { window.navigator.vibrate(15); } catch (_) {}
          }
        };
        el.addEventListener('click', handleTrigger);
        el.addEventListener('touchstart', handleTrigger, { passive: false });
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.BlockDropInput = BlockDropInput;
}

export { BlockDropInput };
