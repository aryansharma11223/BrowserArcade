/**
 * Browser Arcade - Deterministic PRNG & Daily Seed Coordinator
 *
 * Provides Mulberry32 32-bit pseudo-random number generator and
 * standardized UTC Daily Seed generation for synchronized global challenges.
 * Pure mathematical implementation, 100% unit-testable, zero external dependencies.
 */

/**
 * Creates a deterministic Mulberry32 pseudo-random number generator.
 * @param {number|string} seed
 * @returns {() => number} Random float in range [0, 1)
 */
export function mulberry32(seed) {
  let s = (typeof seed === 'number' ? seed : parseInt(seed, 10) || 123456789) >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an integer seed representing the current UTC date (YYYYMMDD).
 * @param {Date} [date=new Date()]
 * @returns {number} Integer seed (e.g. 20261117)
 */
export function getDailySeed(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

/**
 * Returns formatted human-readable UTC date string.
 * @param {Date} [date=new Date()]
 * @returns {string} e.g. "Nov 17, 2026"
 */
export function getDailyDateString(date = new Date()) {
  const y = date.getUTCFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[date.getUTCMonth()];
  const d = date.getUTCDate();
  return `${m} ${d}, ${y}`;
}

/**
 * Generates standardized local storage key for daily challenge tracking.
 * @param {string} gamePrefix
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getDailyChallengeKey(gamePrefix, date = new Date()) {
  return `${gamePrefix}_daily_${getDailySeed(date)}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mulberry32, getDailySeed, getDailyDateString, getDailyChallengeKey };
}
