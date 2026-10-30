/**
 * Browser Arcade - Platform Shell Coordinator
 * Manages platform navigation, sound buttons, and shell interactions.
 */

import { audio } from './sound.js';
import { storage } from './storage.js';

class ArcadePlatform {
  constructor() {
    this.mobileToggle = document.getElementById('mobileNavToggle');
    this.mobileDrawer = document.getElementById('mobileNavDrawer');
    this.soundButtons = document.querySelectorAll('.sound-toggle-btn');

    this.init();
  }

  init() {
    this.bindMobileNav();
    this.bindSoundButtons();
    this.updateSoundIcons(audio.isMuted);

    // Sync sound state across tabs or components
    window.addEventListener('arcade:soundchange', (e) => {
      this.updateSoundIcons(e.detail.isMuted);
    });
  }

  bindMobileNav() {
    if (!this.mobileToggle || !this.mobileDrawer) return;

    this.mobileToggle.addEventListener('click', () => {
      const isOpen = this.mobileDrawer.classList.toggle('active');
      this.mobileToggle.classList.toggle('active', isOpen);
      this.mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close drawer when clicking outside or navigating
    document.addEventListener('click', (e) => {
      if (
        this.mobileDrawer.classList.contains('active') &&
        !this.mobileDrawer.contains(e.target) &&
        !this.mobileToggle.contains(e.target)
      ) {
        this.mobileDrawer.classList.remove('active');
        this.mobileToggle.classList.remove('active');
        this.mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  bindSoundButtons() {
    this.soundButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const isMuted = audio.toggleMute();
        this.updateSoundIcons(isMuted);
        if (!isMuted) {
          audio.playClick();
        }
      });
    });
  }

  updateSoundIcons(isMuted) {
    this.soundButtons.forEach((btn) => {
      btn.setAttribute('aria-label', isMuted ? 'Unmute sound effects' : 'Mute sound effects');
      btn.setAttribute('title', isMuted ? 'Sound: Muted (Click to Unmute)' : 'Sound: Enabled (Click to Mute)');
      btn.classList.toggle('active', !isMuted);

      const iconContainer = btn.querySelector('.sound-icon');
      if (iconContainer) {
        if (isMuted) {
          // Muted speaker SVG
          iconContainer.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>`;
        } else {
          // Unmuted speaker SVG with sound waves
          iconContainer.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>`;
        }
      }
    });
  }
}

// Auto-bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ArcadePlatform());
} else {
  new ArcadePlatform();
}

export { ArcadePlatform };
