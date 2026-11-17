/**
 * Browser Arcade - Platform Shell Coordinator
 * Manages platform navigation, sound buttons, and shell interactions.
 */

import { audio } from './sound.js';
import { storage } from './storage.js';
import './consent.js';

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
    this.bindShareButtons();
    this.bindFullscreenController();
    this.bindInstallPrompt();
    this.registerServiceWorker();
    this.updateSoundIcons(audio.isMuted);

    // Sync sound state across tabs or components
    window.addEventListener('arcade:soundchange', (e) => {
      this.updateSoundIcons(e.detail.isMuted);
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Pre-cached update ready
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[SW] Registration failed:', err);
          });
      });
    }
  }

  bindInstallPrompt() {
    let deferredPrompt = null;
    const installBtns = document.querySelectorAll('.pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtns.forEach((btn) => {
        btn.style.display = 'inline-flex';
      });
    });

    installBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtns.forEach((b) => (b.style.display = 'none'));
        }
        deferredPrompt = null;
      });
    });

    window.addEventListener('appinstalled', () => {
      installBtns.forEach((b) => (b.style.display = 'none'));
      deferredPrompt = null;
    });
  }

  bindFullscreenController() {
    const toggleFullscreen = () => {
      const fsTarget = document.querySelector('.game-wrapper') || document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (fsTarget.requestFullscreen) {
          fsTarget.requestFullscreen().catch(() => {});
        } else if (fsTarget.webkitRequestFullscreen) {
          fsTarget.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    };

    document.addEventListener('click', (e) => {
      const fsBtn = e.target.closest('.fullscreen-toggle-btn');
      if (fsBtn) {
        e.preventDefault();
        toggleFullscreen();
      }
    });

    // Keyboard shortcut 'F' (only when not inside inputs/textareas)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (document.querySelector('.fullscreen-toggle-btn')) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    });

    const updateFsIcons = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      document.querySelectorAll('.fullscreen-toggle-btn').forEach(btn => {
        btn.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Enter Fullscreen');
        btn.setAttribute('title', isFs ? 'Exit Fullscreen (F / Esc)' : 'Enter Fullscreen (F)');
        const enterIcon = btn.querySelector('.fs-icon-enter');
        const exitIcon = btn.querySelector('.fs-icon-exit');
        if (enterIcon) enterIcon.style.display = isFs ? 'none' : 'inline-block';
        if (exitIcon) exitIcon.style.display = isFs ? 'inline-block' : 'none';
      });
    };

    document.addEventListener('fullscreenchange', updateFsIcons);
    document.addEventListener('webkitfullscreenchange', updateFsIcons);
  }

  bindShareButtons() {
    document.addEventListener('click', (e) => {
      const shareBtn = e.target.closest('.arcade-share-btn');
      if (!shareBtn) return;

      e.preventDefault();
      const game = shareBtn.getAttribute('data-game') || document.title.split('-')[0].trim();
      const scoreElId = shareBtn.getAttribute('data-score-el');
      const scoreEl = scoreElId ? document.getElementById(scoreElId) : null;
      const score = scoreEl ? scoreEl.textContent.trim() : '';

      const shareText = score
        ? `🎮 I scored ${score} in ${game} on Browser Arcade! Can you beat my score?`
        : `🎮 Playing ${game} on Browser Arcade! Check it out:`;
      const shareUrl = window.location.href;

      if (navigator.share) {
        navigator.share({
          title: `${game} - Browser Arcade`,
          text: shareText,
          url: shareUrl
        }).catch(() => {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
          this.showShareFeedback(shareBtn);
        }).catch(() => {});
      }
    });
  }

  showShareFeedback(btn) {
    const originalHtml = btn.innerHTML;
    btn.textContent = 'Copied Link! ✓';
    btn.style.borderColor = 'var(--accent-emerald)';
    btn.style.color = 'var(--accent-emerald)';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2500);
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
