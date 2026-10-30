/**
 * Browser Arcade - Safe Local Storage Manager
 * Robust, namespaced client-side persistence with in-memory fallback.
 * Strictly 0-cost, 0-dependency.
 */

class StorageManager {
  constructor(namespace = 'BrowserArcade') {
    this.namespace = namespace;
    this.memoryStore = new Map();
    this.isLocalStorageAvailable = this._checkAvailability();
  }

  /**
   * Probes whether localStorage is fully functional in the current browser context.
   * @private
   * @returns {boolean}
   */
  _checkAvailability() {
    try {
      const testKey = `__${this.namespace}_test__`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[StorageManager] LocalStorage unavailable (private mode or quota). Using in-memory fallback.');
      return false;
    }
  }

  /**
   * Generates a fully qualified namespaced key.
   * @private
   * @param {string} key
   * @returns {string}
   */
  _prefix(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Retrieves a parsed value from storage, or returns the provided default.
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  getItem(key, defaultValue = null) {
    const fullKey = this._prefix(key);
    try {
      if (this.isLocalStorageAvailable) {
        const item = window.localStorage.getItem(fullKey);
        if (item === null) return defaultValue;
        return JSON.parse(item);
      } else {
        return this.memoryStore.has(fullKey) ? this.memoryStore.get(fullKey) : defaultValue;
      }
    } catch (err) {
      console.error(`[StorageManager] Failed to read key "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Serializes and writes a value to storage.
   * @param {string} key
   * @param {*} value
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    const fullKey = this._prefix(key);
    try {
      const serialized = JSON.stringify(value);
      if (this.isLocalStorageAvailable) {
        window.localStorage.setItem(fullKey, serialized);
      }
      this.memoryStore.set(fullKey, value);
      return true;
    } catch (err) {
      console.warn(`[StorageManager] Failed to write key "${key}":`, err);
      this.memoryStore.set(fullKey, value);
      return false;
    }
  }

  /**
   * Removes a specific key from storage.
   * @param {string} key
   */
  removeItem(key) {
    const fullKey = this._prefix(key);
    try {
      if (this.isLocalStorageAvailable) {
        window.localStorage.removeItem(fullKey);
      }
      this.memoryStore.delete(fullKey);
    } catch (err) {
      console.warn(`[StorageManager] Failed to remove key "${key}":`, err);
    }
  }
}

// Global singleton instance
const storage = new StorageManager('BrowserArcade');

// Support both ES Module import and global script window access
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.arcadeStorage = storage;
}

export { StorageManager, storage };
