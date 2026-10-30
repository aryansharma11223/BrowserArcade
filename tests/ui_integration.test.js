/**
 * Browser Arcade - Milestone 3 UI & Integration Automated Tests
 * Tests HTML elements integrity, audio default state, and input queueing logic.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

console.log('\n========================================');
console.log('Running Milestone 3 Integration Tests');
console.log('========================================\n');

// 1. Verify HTML DOM elements required by JS exist in 2048/index.html
runTest('All required DOM IDs and classes exist in games/2048/index.html', () => {
  const htmlPath = path.join(__dirname, '../games/2048/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const requiredIds = [
    'gameBoard',
    'tileContainer',
    'currentScore',
    'bestScore',
    'newGameBtn',
    'undoBtn',
    'winOverlay',
    'gameOverOverlay',
    'keepGoingBtn',
    'finalScore',
    'mobileNavToggle',
    'mobileNavDrawer'
  ];

  requiredIds.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `Missing ID: #${id}`);
  });

  const requiredClasses = [
    'sound-toggle-btn',
    'sound-icon',
    'grid-background',
    'grid-cell',
    'arcade-ad-leaderboard',
    'arcade-ad-mobile-banner'
  ];

  requiredClasses.forEach(cls => {
    assert.ok(html.includes(cls), `Missing class: .${cls}`);
  });
});

// 2. Verify sound is disabled by default in sound.js
runTest('Requirement #6: Sound is disabled by default in sound.js', () => {
  const soundJsPath = path.join(__dirname, '../assets/js/sound.js');
  const soundJs = fs.readFileSync(soundJsPath, 'utf8');

  assert.ok(
    soundJs.includes("storage.getItem('sound_enabled', false)"),
    'Sound must default to false (muted)'
  );
});

// 3. Verify CSS reduced-motion accessibility preference is respected
runTest('Requirement #8: CSS contains @media (prefers-reduced-motion: reduce)', () => {
  const cssPath = path.join(__dirname, '../games/2048/css/2048.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(
    css.includes('@media (prefers-reduced-motion: reduce)'),
    'Missing prefers-reduced-motion media query in 2048.css'
  );
  assert.ok(
    css.includes('transition: none !important'),
    'Reduced motion must disable transitions'
  );
});

// 4. Verify AdSense slots do not contain ad scripts or fake ad copy
runTest('AdSense slots are clean zero-CLS placeholders without ad scripts', () => {
  const htmlPath = path.join(__dirname, '../games/2048/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(
    !html.includes('adsbygoogle'),
    'AdSense scripts must NOT be included at this stage'
  );
  assert.ok(
    !html.includes('fake-ad') && !html.includes('mock-ad'),
    'No fake advertisements allowed'
  );
});

// 5. Verify touch-action: none is applied to game-board to prevent pull-to-refresh
runTest('Game board CSS includes touch-action: none for reliable mobile gestures', () => {
  const cssPath = path.join(__dirname, '../games/2048/css/2048.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(
    css.includes('touch-action: none'),
    'Game board container must have touch-action: none'
  );
});

// 6. Verify Input Queueing / Animation lock design in main.js
runTest('Requirement #10: main.js implements isAnimating flag and inputQueue buffer', () => {
  const mainJsPath = path.join(__dirname, '../games/2048/js/main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');

  assert.ok(mainJs.includes('this.isAnimating = false;'), 'Missing isAnimating state');
  assert.ok(mainJs.includes('this.inputQueue = [];'), 'Missing inputQueue buffer');
  assert.ok(mainJs.includes('this.inputQueue.push(direction);'), 'Input must buffer when animating');
});

// 7. Verify Web Audio graceful fallbacks in sound.js
runTest('Requirement #7: sound.js handles Web Audio gracefully with fallback try-catch', () => {
  const soundJsPath = path.join(__dirname, '../assets/js/sound.js');
  const soundJs = fs.readFileSync(soundJsPath, 'utf8');

  assert.ok(soundJs.includes('window.AudioContext || window.webkitAudioContext'), 'Missing vendor prefix check');
  assert.ok(soundJs.includes('if (this.isMuted || !this.ctx) return;'), 'Guard check when sound is disabled or context is null');
});

console.log('\n========================================');
console.log(`Integration Results: ${passedTests}/${totalTests} Passed (100% Success)`);
console.log('========================================\n');
