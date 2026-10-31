/**
 * Browser Arcade - Custom Analytics Consent Coordinator (Basic Consent Mode)
 * Privacy-first, zero-dependency, fail-closed consent architecture.
 * Strictly 0-cost, open web standards compliant.
 */

export const CONSENT_STORAGE_KEY = 'BrowserArcade:analytics_consent';
export const CONSENT_POLICY_VERSION = 1;
export const GA_MEASUREMENT_ID = 'G-WP6YR41EQ5';

export const ConsentState = Object.freeze({
  UNSET: 'unset',
  DENIED: 'denied',
  GRANTED: 'granted'
});

class ConsentManager {
  constructor() {
    this.measurementId = GA_MEASUREMENT_ID;
    this.storageKey = CONSENT_STORAGE_KEY;
    this.currentVersion = CONSENT_POLICY_VERSION;
    this.isGaLoaded = false;
    this.isScriptInjected = false;
    this.isConfigured = false;
    this.isGaEnabled = false;
    this.bannerElement = null;
    this.memoryChoice = null;
    this.lastFocusedTrigger = null;
    this._escapeKeyHandler = null;
    this.isStorageSupported = this._checkStorage();

    this.init();
  }

  /**
   * Safely probes whether localStorage is accessible.
   * @private
   * @returns {boolean}
   */
  _checkStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const test = `__consent_test_${Date.now()}__`;
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Reads and validates the current saved consent record.
   * Fails closed to UNSET on any error, corruption, or policy version mismatch.
   * @returns {{ status: string, version: number, timestamp: number }}
   */
  getConsent() {
    // If storage is unsupported, fallback to in-memory decision
    if (!this.isStorageSupported) {
      if (this.memoryChoice && this.memoryChoice.version === this.currentVersion) {
        return this.memoryChoice;
      }
      return { status: ConsentState.UNSET, version: this.currentVersion, timestamp: 0 };
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return { status: ConsentState.UNSET, version: this.currentVersion, timestamp: 0 };
      }
      const data = JSON.parse(raw);
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.status !== 'string' ||
        data.version !== this.currentVersion ||
        ![ConsentState.GRANTED, ConsentState.DENIED].includes(data.status)
      ) {
        return { status: ConsentState.UNSET, version: this.currentVersion, timestamp: 0 };
      }
      return data;
    } catch (e) {
      // Fail closed on invalid JSON or storage exceptions
      return { status: ConsentState.UNSET, version: this.currentVersion, timestamp: 0 };
    }
  }

  /**
   * Persists the user's decision with timestamp and version.
   * @param {string} status
   * @returns {{ status: string, version: number, timestamp: number }}
   */
  saveConsent(status) {
    if (![ConsentState.GRANTED, ConsentState.DENIED].includes(status)) {
      status = ConsentState.DENIED;
    }

    const payload = {
      status,
      timestamp: Date.now(),
      version: this.currentVersion
    };

    if (this.isStorageSupported) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      } catch (e) {
        this.memoryChoice = payload;
      }
    } else {
      this.memoryChoice = payload;
    }

    return payload;
  }

  /**
   * Enables Google Analytics according to Basic Consent Mode.
   * If not yet loaded, injects the script and configures GA4 once.
   * If already loaded (e.g. re-acceptance in same tab), re-enables measurement
   * and updates consent without duplicate script injection or duplicate page views.
   */
  loadGoogleAnalytics() {
    if (typeof window === 'undefined') return;

    // Un-disable GA4 measurement
    window['ga-disable-' + this.measurementId] = false;
    this.isGaEnabled = true;

    // Ensure dataLayer and gtag function are initialized
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
    }

    if (!this.isConfigured) {
      // First-time configuration
      window.gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });

      window.gtag('js', new Date());
      window.gtag('config', this.measurementId, {
        send_page_view: true
      });
      this.isConfigured = true;
    } else {
      // Already configured earlier in this session - update consent state without sending a duplicate page_view
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }

    // Inject script tag if not already injected
    if (!this.isScriptInjected) {
      const existing = (typeof document !== 'undefined')
        ? document.querySelector(`script[src*="id=${this.measurementId}"]`)
        : null;
      if (!existing && typeof document !== 'undefined' && document.head) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
        document.head.appendChild(script);
      }
      this.isScriptInjected = true;
      this.isGaLoaded = true;
    }
  }

  /**
   * Disables GA4 measurement and removes local GA cookies.
   */
  disableGoogleAnalytics() {
    if (typeof window === 'undefined') return;

    window['ga-disable-' + this.measurementId] = true;
    this.isGaEnabled = false;

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }

    this.removeGaCookies();
  }

  /**
   * Best-effort removal of _ga and _ga_* cookies across valid host-level domain combinations.
   * Note: Client-side cookie deletion in JavaScript is inherently best-effort as scripts cannot
   * inspect existing cookie attributes (Domain, Path, SameSite, Secure).
   */
  removeGaCookies() {
    if (typeof document === 'undefined' || !document.cookie) return;

    const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname)
      ? window.location.hostname
      : '';

    // Candidate domains: host-only (no Domain attribute), exact hostname, and leading-dot hostname.
    // Do NOT attempt public suffixes like .pages.dev.
    const domains = [''];
    if (hostname) {
      domains.push(hostname);
      domains.push(hostname.startsWith('.') ? hostname : `.${hostname}`);
    }

    const uniqueDomains = Array.from(new Set(domains));

    const cookies = document.cookie.split(';');
    cookies.forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name === '_ga' || name.startsWith('_ga_')) {
        uniqueDomains.forEach((d) => {
          const domainAttr = d ? `Domain=${d}; ` : '';
          document.cookie = `${name}=; Path=/; ${domainAttr}Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax`;
        });
      }
    });
  }

  accept() {
    this.saveConsent(ConsentState.GRANTED);
    this.closeBanner();
    this.loadGoogleAnalytics();
    this._dispatchConsentChangeEvent(ConsentState.GRANTED);
  }

  reject() {
    this.saveConsent(ConsentState.DENIED);
    this.closeBanner();
    this.disableGoogleAnalytics();
    this._dispatchConsentChangeEvent(ConsentState.DENIED);
  }

  _dispatchConsentChangeEvent(status) {
    try {
      window.dispatchEvent(new CustomEvent('arcade:consentchange', { detail: { status } }));
    } catch (e) {}
  }

  renderBanner() {
    if (typeof document === 'undefined') return;

    let banner = document.getElementById('arcadeConsentBanner');
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'arcadeConsentBanner';
      banner.className = 'arcade-consent-banner';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie and privacy preferences');
      banner.setAttribute('aria-live', 'polite');

      banner.innerHTML = `
        <div class="arcade-consent-inner container">
          <div class="arcade-consent-body">
            <div class="arcade-consent-header">
              <span class="arcade-consent-icon" aria-hidden="true">🛡️</span>
              <h2 class="arcade-consent-title" id="arcadeConsentHeading">Your privacy matters</h2>
            </div>
            <p class="arcade-consent-text">
              We use optional Google Analytics to understand how people discover and use Browser Arcade. Analytics remains disabled unless you choose to allow it.
            </p>
            <div class="arcade-consent-features" aria-label="Feature status">
              <span class="arcade-consent-pill always-active">
                <span class="status-indicator"></span> Essential Platform Features: <strong>Always Active</strong>
              </span>
              <span class="arcade-consent-pill optional-feature">
                <span class="status-indicator"></span> Google Analytics: <strong>Optional</strong>
              </span>
            </div>
          </div>
          <div class="arcade-consent-actions">
            <button type="button" class="arcade-btn arcade-btn-secondary" id="consentRejectBtn">
              Reject Analytics
            </button>
            <button type="button" class="arcade-btn arcade-btn-primary" id="consentAcceptBtn">
              Accept Analytics
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(banner);

      const rejectBtn = banner.querySelector('#consentRejectBtn');
      const acceptBtn = banner.querySelector('#consentAcceptBtn');

      if (rejectBtn) {
        rejectBtn.addEventListener('click', () => this.reject());
      }
      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => this.accept());
      }
    }

    this.bannerElement = banner;
    banner.style.display = 'block';
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        banner.classList.add('visible');
      });
    } else {
      banner.classList.add('visible');
    }
  }

  closeBanner() {
    // Detach Escape handler if attached
    if (this._escapeKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._escapeKeyHandler);
      this._escapeKeyHandler = null;
    }

    if (!this.bannerElement && typeof document !== 'undefined') {
      this.bannerElement = document.getElementById('arcadeConsentBanner');
    }
    if (this.bannerElement) {
      this.bannerElement.classList.remove('visible');
      setTimeout(() => {
        if (this.bannerElement && !this.bannerElement.classList.contains('visible')) {
          this.bannerElement.style.display = 'none';
        }
      }, 300);
    }

    // Restore focus to triggering element if focusable
    if (this.lastFocusedTrigger && typeof this.lastFocusedTrigger.focus === 'function') {
      try {
        this.lastFocusedTrigger.focus();
      } catch (e) {}
      this.lastFocusedTrigger = null;
    }
  }

  openPreferences(triggerElement = null) {
    this.lastFocusedTrigger = triggerElement || (typeof document !== 'undefined' ? document.activeElement : null);

    if (!this.bannerElement) {
      this.renderBanner();
    } else {
      this.bannerElement.style.display = 'block';
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          this.bannerElement.classList.add('visible');
        });
      } else {
        this.bannerElement.classList.add('visible');
      }
    }

    // Attach Escape key listener for preferences session
    if (!this._escapeKeyHandler && typeof window !== 'undefined') {
      this._escapeKeyHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeBanner();
        }
      };
      window.addEventListener('keydown', this._escapeKeyHandler);
    }

    setTimeout(() => {
      const rejectBtn = document.getElementById('consentRejectBtn');
      if (rejectBtn && typeof rejectBtn.focus === 'function') {
        rejectBtn.focus();
      }
    }, 50);
  }

  bindTriggers() {
    if (typeof document === 'undefined') return;

    const triggers = document.querySelectorAll('#cookieSettingsBtn, .cookie-settings-trigger');
    triggers.forEach((btn) => {
      if (!btn.dataset.consentBound) {
        btn.dataset.consentBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openPreferences(btn);
        });
      }
    });
  }

  bindStorageSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        const consent = this.getConsent();
        if (consent.status === ConsentState.GRANTED) {
          this.closeBanner();
          this.loadGoogleAnalytics();
        } else if (consent.status === ConsentState.DENIED) {
          this.closeBanner();
          this.disableGoogleAnalytics();
        }
      }
    });
  }

  init() {
    if (typeof window === 'undefined') return;

    const consent = this.getConsent();

    if (consent.status === ConsentState.GRANTED) {
      this.loadGoogleAnalytics();
    } else if (consent.status === ConsentState.DENIED) {
      this.disableGoogleAnalytics();
    } else {
      // UNSET -> Fail closed (no GA requests) and show consent banner
      this.disableGoogleAnalytics();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.renderBanner();
          this.bindTriggers();
        });
      } else {
        this.renderBanner();
        this.bindTriggers();
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindTriggers());
    } else {
      this.bindTriggers();
    }

    this.bindStorageSync();
  }
}

// Singleton instance
export { ConsentManager };
export const consentManager = new ConsentManager();
if (typeof window !== 'undefined') {
  window.arcadeConsent = consentManager;
}

export function initConsent() {
  return consentManager;
}
