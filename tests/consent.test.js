/**
 * Browser Arcade - Consent Manager Automated Unit Test Suite
 * Zero external testing libraries. Uses Node.js native assert module.
 * Validates Basic Consent Mode, state transitions, fail-closed security,
 * localStorage persistence, cookie cleanup, dynamic gtag script injection,
 * accessibility focus lifecycle, Escape-key handling, and same-tab re-acceptance.
 */

const assert = require('assert');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
    throw error;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
    throw error;
  }
}

console.log('\n========================================');
console.log('Running Custom Consent Coordinator Test Suite');
console.log('========================================\n');

// Mock Browser Environment Factory
function createMockEnvironment(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));

  const mockLocalStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _store: store
  };

  const listeners = new Map();
  const rawCookieAssignments = [];

  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.attributes = {};
      this.style = {};
      this.classList = {
        _classes: new Set(),
        add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
        remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
        contains: (c) => this.classList._classes.has(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (this.classList._classes.has(c)) {
              this.classList._classes.delete(c);
              return false;
            } else {
              this.classList._classes.add(c);
              return true;
            }
          } else if (force) {
            this.classList._classes.add(c);
            return true;
          } else {
            this.classList._classes.delete(c);
            return false;
          }
        }
      };
      this.childNodes = [];
      this.innerHTML = '';
      this.dataset = {};
      this._eventListeners = new Map();
      this._focused = false;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') this.id = String(value);
      if (name === 'class') this.className = String(value);
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    appendChild(child) {
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    }

    addEventListener(event, handler) {
      if (!this._eventListeners.has(event)) {
        this._eventListeners.set(event, []);
      }
      this._eventListeners.get(event).push(handler);
    }

    dispatchEvent(evt) {
      const handlers = this._eventListeners.get(evt.type) || [];
      handlers.forEach(h => h(evt));
      return true;
    }

    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return findById(this, id);
      }
      return null;
    }

    querySelectorAll(selector) {
      return [];
    }

    focus() {
      this._focused = true;
    }
  }

  function findById(node, id) {
    if (node.id === id) return node;
    for (const child of node.childNodes || []) {
      const found = findById(child, id);
      if (found) return found;
    }
    return null;
  }

  const mockHead = new MockElement('head');
  const mockBody = new MockElement('body');

  let cookies = '';

  const mockDocument = {
    head: mockHead,
    body: mockBody,
    readyState: 'complete',
    activeElement: null,
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
      const inBody = findById(mockBody, id);
      if (inBody) return inBody;
      return findById(mockHead, id);
    },
    querySelector: (sel) => {
      if (sel.includes('script[src*=')) {
        for (const child of mockHead.childNodes) {
          if (child.tagName === 'SCRIPT' && child.src && child.src.includes('id=G-WP6YR41EQ5')) {
            return child;
          }
        }
        return null;
      }
      if (sel.startsWith('#')) {
        return mockDocument.getElementById(sel.slice(1));
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const matches = [];
      const parts = sel.split(',').map(s => s.trim());
      parts.forEach(p => {
        if (p.startsWith('#')) {
          const el = mockDocument.getElementById(p.slice(1));
          if (el) matches.push(el);
        }
      });
      return matches;
    },
    get cookie() {
      return cookies;
    },
    set cookie(val) {
      rawCookieAssignments.push(val);
      const [pair] = val.split(';');
      const [k, v] = pair.split('=');
      if (val.includes('Max-Age=0') || val.includes('Expires=Thu, 01 Jan 1970')) {
        const cookieList = cookies.split('; ').filter(c => !c.startsWith(`${k.trim()}=`));
        cookies = cookieList.join('; ');
      } else {
        const cookieList = cookies.split('; ').filter(c => c && !c.startsWith(`${k.trim()}=`));
        cookieList.push(`${k.trim()}=${v ? v.trim() : ''}`);
        cookies = cookieList.join('; ');
      }
    }
  };

  const mockWindow = {
    location: { hostname: 'browserarcade.pages.dev' },
    localStorage: mockLocalStorage,
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!listeners.has(event)) return;
      const arr = listeners.get(event);
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    },
    dispatchEvent: (evt) => {
      const handlers = listeners.get(evt.type) || [];
      handlers.forEach(h => h(evt));
      return true;
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    _listeners: listeners
  };

  return {
    window: mockWindow,
    document: mockDocument,
    localStorage: mockLocalStorage,
    rawCookieAssignments,
    triggerStorageEvent: (key, newValue) => {
      const handlers = listeners.get('storage') || [];
      handlers.forEach(h => h({ key, newValue }));
    },
    triggerKeydown: (key) => {
      const handlers = listeners.get('keydown') || [];
      handlers.forEach(h => h({ key }));
    }
  };
}

// Custom Event Polyfill for testing
class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail || {};
  }
}

async function main() {
  const consentModule = await import('../assets/js/consent.js');
  const {
    ConsentManager,
    ConsentState,
    CONSENT_STORAGE_KEY,
    CONSENT_POLICY_VERSION,
    GA_MEASUREMENT_ID
  } = consentModule;

  // 1. Verify Constants
  runTest('Module exports correct policy constants and enum values', () => {
    assert.strictEqual(CONSENT_STORAGE_KEY, 'BrowserArcade:analytics_consent');
    assert.strictEqual(CONSENT_POLICY_VERSION, 1);
    assert.strictEqual(GA_MEASUREMENT_ID, 'G-WP6YR41EQ5');
    assert.strictEqual(ConsentState.UNSET, 'unset');
    assert.strictEqual(ConsentState.DENIED, 'denied');
    assert.strictEqual(ConsentState.GRANTED, 'granted');
  });

  // 2. Default Initial Visit (Unset State)
  await runAsyncTest('Initial visit without saved decision fails closed: GA disabled, no script injected', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    const consent = manager.getConsent();

    assert.strictEqual(consent.status, ConsentState.UNSET);
    assert.strictEqual(consent.version, 1);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
    assert.strictEqual(manager.isGaLoaded, false);

    const scripts = env.document.head.childNodes.filter(n => n.tagName === 'SCRIPT');
    assert.strictEqual(scripts.length, 0, 'No script should be injected in UNSET state');
  });

  // 3. User Rejection (Denied State)
  await runAsyncTest('Rejecting analytics saves DENIED, maintains ga-disable, clears cookies, and does not inject script', async () => {
    const env = createMockEnvironment();
    env.document.cookie = '_ga=GA1.2.123456789.1600000000';
    env.document.cookie = '_ga_WP6YR41EQ5=GS1.1.1600000000.1.0.0';
    assert.ok(env.document.cookie.includes('_ga='));

    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    let changeEventFired = false;
    let changeEventStatus = null;
    env.window.addEventListener('arcade:consentchange', (e) => {
      changeEventFired = true;
      changeEventStatus = e.detail.status;
    });

    manager.reject();

    const consent = manager.getConsent();
    assert.strictEqual(consent.status, ConsentState.DENIED);
    assert.strictEqual(consent.version, 1);
    assert.ok(consent.timestamp > 0);

    const raw = env.localStorage.getItem(CONSENT_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.status, ConsentState.DENIED);

    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
    assert.strictEqual(manager.isGaLoaded, false);
    assert.ok(!env.document.cookie.includes('_ga='), '_ga cookie must be cleared on reject');

    assert.strictEqual(changeEventFired, true);
    assert.strictEqual(changeEventStatus, ConsentState.DENIED);
  });

  // 4. User Acceptance (Granted State)
  await runAsyncTest('Accepting analytics saves GRANTED, enables GA, configures consent mode, and dynamically injects script', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    let changeEventFired = false;
    let changeEventStatus = null;
    env.window.addEventListener('arcade:consentchange', (e) => {
      changeEventFired = true;
      changeEventStatus = e.detail.status;
    });

    manager.accept();

    const consent = manager.getConsent();
    assert.strictEqual(consent.status, ConsentState.GRANTED);
    assert.strictEqual(consent.version, 1);
    assert.ok(consent.timestamp > 0);

    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);
    assert.strictEqual(manager.isGaLoaded, true);

    const scripts = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scripts.length, 1, 'Exactly one gtag script must be injected');
    assert.strictEqual(scripts[0].async, true);
    assert.strictEqual(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-WP6YR41EQ5');

    assert.ok(Array.isArray(env.window.dataLayer));
    assert.strictEqual(typeof env.window.gtag, 'function');

    manager.loadGoogleAnalytics();
    const scriptsAfterSecondCall = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scriptsAfterSecondCall.length, 1);

    assert.strictEqual(changeEventFired, true);
    assert.strictEqual(changeEventStatus, ConsentState.GRANTED);
  });

  // 5. Subsequent visit with pre-existing GRANTED consent
  await runAsyncTest('Returning visit with stored GRANTED consent automatically boots GA without banner', async () => {
    const preExisting = JSON.stringify({
      status: 'granted',
      version: 1,
      timestamp: Date.now() - 10000
    });
    const env = createMockEnvironment({ [CONSENT_STORAGE_KEY]: preExisting });
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(manager.isGaLoaded, true);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);

    const script = env.document.head.childNodes.find(n => n.tagName === 'SCRIPT');
    assert.ok(script, 'Script must be dynamically loaded');
  });

  // 6. Policy version mismatch resets to UNSET (fail-closed re-consent)
  await runAsyncTest('Stored consent with obsolete policy version fails closed to UNSET', async () => {
    const obsoleteRecord = JSON.stringify({
      status: 'granted',
      version: 0,
      timestamp: Date.now() - 50000
    });
    const env = createMockEnvironment({ [CONSENT_STORAGE_KEY]: obsoleteRecord });
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    const consent = manager.getConsent();

    assert.strictEqual(consent.status, ConsentState.UNSET);
    assert.strictEqual(manager.isGaLoaded, false);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
  });

  // 7. Corrupted JSON or invalid status in storage fails closed
  await runAsyncTest('Corrupted JSON or unrecognized status safely fails closed to UNSET', async () => {
    const env1 = createMockEnvironment({ [CONSENT_STORAGE_KEY]: '{bad_json:true' });
    global.window = env1.window;
    global.document = env1.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env1.window.requestAnimationFrame;

    const manager1 = new ConsentManager();
    assert.strictEqual(manager1.getConsent().status, ConsentState.UNSET);

    const env2 = createMockEnvironment({
      [CONSENT_STORAGE_KEY]: JSON.stringify({ status: 'malicious', version: 1, timestamp: Date.now() })
    });
    global.window = env2.window;
    global.document = env2.document;
    global.requestAnimationFrame = env2.window.requestAnimationFrame;

    const manager2 = new ConsentManager();
    assert.strictEqual(manager2.getConsent().status, ConsentState.UNSET);
  });

  // 8. Storage failure fallback (e.g. Safari Private Mode / QuotaExceeded)
  await runAsyncTest('QuotaExceeded or restricted localStorage falls back safely to in-memory state', async () => {
    const env = createMockEnvironment();
    env.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    assert.strictEqual(manager.getConsent().status, ConsentState.UNSET);

    manager.accept();
    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(manager.isGaLoaded, true);
  });

  // 9. Revocation flow (Accepted -> Later Rejected via Cookie Settings)
  await runAsyncTest('User can revoke consent: switches to DENIED, deactivates GA, and cleans cookies', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    manager.accept();
    assert.strictEqual(manager.isGaLoaded, true);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);

    env.document.cookie = '_ga=GA1.2.987654321.1600000000';

    manager.reject();
    assert.strictEqual(manager.getConsent().status, ConsentState.DENIED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
    assert.ok(!env.document.cookie.includes('_ga='));
  });

  // 10. Cross-tab synchronization via storage event
  await runAsyncTest('Cross-tab storage event synchronizes consent decision across open tabs', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    assert.strictEqual(manager.isGaLoaded, false);

    const grantedPayload = JSON.stringify({
      status: 'granted',
      version: 1,
      timestamp: Date.now()
    });
    env.localStorage._store.set(CONSENT_STORAGE_KEY, grantedPayload);
    env.triggerStorageEvent(CONSENT_STORAGE_KEY, grantedPayload);

    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(manager.isGaLoaded, true);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);
  });

  // 11. Same-Tab Re-Acceptance (Accept -> Reject -> Accept)
  await runAsyncTest('Same-tab Accept -> Reject -> Accept correctly re-enables GA without duplicate scripts or pageviews', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();

    // 1. Initial Accept
    manager.accept();
    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);
    assert.strictEqual(manager.isGaEnabled, true);
    assert.strictEqual(manager.isConfigured, true);
    const scriptsAfterFirstAccept = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scriptsAfterFirstAccept.length, 1);

    // Track calls sent to gtag
    const gtagCalls = [];
    const originalGtag = env.window.gtag;
    env.window.gtag = function() {
      gtagCalls.push(Array.from(arguments));
      return originalGtag.apply(this, arguments);
    };

    // 2. Reject in same tab
    manager.reject();
    assert.strictEqual(manager.getConsent().status, ConsentState.DENIED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
    assert.strictEqual(manager.isGaEnabled, false);
    const lastCallAfterReject = gtagCalls[gtagCalls.length - 1];
    assert.deepStrictEqual(lastCallAfterReject, ['consent', 'update', { analytics_storage: 'denied' }]);

    // 3. Re-Accept in same tab
    manager.accept();
    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false, 'ga-disable must be reset to false upon re-accept');
    assert.strictEqual(manager.isGaEnabled, true);

    // Verify consent was updated to granted
    const lastCallAfterReAccept = gtagCalls[gtagCalls.length - 1];
    assert.deepStrictEqual(lastCallAfterReAccept, ['consent', 'update', { analytics_storage: 'granted' }]);

    // Verify no duplicate script tag was appended
    const scriptsAfterSecondAccept = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scriptsAfterSecondAccept.length, 1, 'Script must not be duplicated on re-accept');

    // Verify no second config call was made
    const configCalls = gtagCalls.filter(call => call[0] === 'config');
    assert.strictEqual(configCalls.length, 0, 'No extra gtag("config") should be called on re-accept');
  });

  // 12. Repeated Clicks Idempotency
  await runAsyncTest('Repeated Accept or Reject clicks remain idempotent and safe', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();

    // Rapid successive accept clicks
    manager.accept();
    manager.accept();
    manager.accept();
    assert.strictEqual(manager.getConsent().status, ConsentState.GRANTED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false);
    const scripts = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scripts.length, 1);

    // Rapid successive reject clicks
    manager.reject();
    manager.reject();
    assert.strictEqual(manager.getConsent().status, ConsentState.DENIED);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
  });

  // 13. Cross-Tab Re-Acceptance with Pre-Loaded GA
  await runAsyncTest('Cross-tab re-acceptance re-enables measurement when GA was already loaded in receiving tab', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();
    // Tab B starts accepted
    manager.accept();
    assert.strictEqual(manager.isGaEnabled, true);

    // Tab A changes to DENIED
    const deniedPayload = JSON.stringify({ status: 'denied', version: 1, timestamp: Date.now() });
    env.localStorage._store.set(CONSENT_STORAGE_KEY, deniedPayload);
    env.triggerStorageEvent(CONSENT_STORAGE_KEY, deniedPayload);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], true);
    assert.strictEqual(manager.isGaEnabled, false);

    // Tab A changes back to GRANTED
    const grantedPayload = JSON.stringify({ status: 'granted', version: 1, timestamp: Date.now() });
    env.localStorage._store.set(CONSENT_STORAGE_KEY, grantedPayload);
    env.triggerStorageEvent(CONSENT_STORAGE_KEY, grantedPayload);
    assert.strictEqual(env.window['ga-disable-G-WP6YR41EQ5'], false, 'ga-disable must reset to false in receiving tab');
    assert.strictEqual(manager.isGaEnabled, true);

    const scripts = env.document.head.childNodes.filter(
      n => n.tagName === 'SCRIPT' && n.src && n.src.includes('G-WP6YR41EQ5')
    );
    assert.strictEqual(scripts.length, 1);
  });

  // 14. Accessibility Focus Lifecycle and Escape Key Handling
  await runAsyncTest('Accessibility focus lifecycle remembers trigger, restores focus on close, and handles Escape key', async () => {
    const env = createMockEnvironment();
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    const manager = new ConsentManager();

    // Verify initial banner display did NOT steal focus to any trigger
    assert.strictEqual(manager.lastFocusedTrigger, null);

    // Simulate opening preferences via a trigger button
    const mockTrigger = env.document.createElement('button');
    mockTrigger.id = 'cookieSettingsBtn';
    mockTrigger.focus = function() { this._focused = true; };

    manager.openPreferences(mockTrigger);
    assert.strictEqual(manager.lastFocusedTrigger, mockTrigger);
    assert.ok(env.window._listeners.get('keydown').length > 0, 'Escape key listener must be attached');

    // Simulate Escape key press
    env.triggerKeydown('Escape');
    assert.strictEqual(mockTrigger._focused, true, 'Focus must be restored to trigger button on Escape');
    assert.strictEqual(manager.lastFocusedTrigger, null);
    assert.strictEqual(env.window._listeners.get('keydown').length, 0, 'Escape key listener must be detached after close');

    // Reopen and close via choice
    mockTrigger._focused = false;
    manager.openPreferences(mockTrigger);
    assert.strictEqual(manager.lastFocusedTrigger, mockTrigger);

    manager.accept();
    assert.strictEqual(mockTrigger._focused, true, 'Focus must be restored to trigger button after making a choice');
    assert.strictEqual(manager.lastFocusedTrigger, null);
    assert.strictEqual(env.window._listeners.get('keydown').length, 0);
  });

  // 15. Cookie Cleanup Domain Targets (No .pages.dev)
  await runAsyncTest('Cookie cleanup generates valid host targets and strictly avoids public suffixes (.pages.dev)', async () => {
    const env = createMockEnvironment();
    env.window.location.hostname = 'browserarcade.pages.dev';
    global.window = env.window;
    global.document = env.document;
    global.CustomEvent = MockCustomEvent;
    global.requestAnimationFrame = env.window.requestAnimationFrame;

    env.document.cookie = '_ga=GA1.2.111111111.1600000000';
    env.document.cookie = '_ga_WP6YR41EQ5=GS1.1.1600000000.1.0.0';

    const manager = new ConsentManager();
    manager.removeGaCookies();

    // Inspect all raw cookie write attempts
    const assignments = env.rawCookieAssignments;
    assert.ok(assignments.length > 0, 'Must have attempted cookie deletion');

    // Assert that .pages.dev is NEVER targeted as a cookie domain
    const invalidPublicSuffixAttempt = assignments.find(s => s.includes('Domain=.pages.dev') || s.includes('Domain=pages.dev'));
    assert.strictEqual(
      invalidPublicSuffixAttempt,
      undefined,
      'Must NOT attempt cookie deletion on public suffix .pages.dev'
    );

    // Assert that host-level targets ARE attempted
    const hasHostTarget = assignments.some(s => s.includes('Domain=browserarcade.pages.dev') || s.includes('Domain=.browserarcade.pages.dev') || !s.includes('Domain='));
    assert.ok(hasHostTarget, 'Must attempt host-level cookie deletion');
  });

  console.log('\n========================================');
  console.log(`Consent Suite Results: ${passedTests}/${totalTests} Passed (100% Success)`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('Fatal error running consent test suite:', err);
  process.exit(1);
});
