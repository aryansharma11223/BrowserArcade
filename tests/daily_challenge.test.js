/**
 * Browser Arcade - Daily Challenge Deterministic PRNG & Synchronization Test Suite
 *
 * Verifies that Mulberry32 PRNG produces deterministic sequences,
 * UTC daily seeds synchronize across instances, and Minesweeper / 2048
 * generate 100% identical board configurations for all players on a given calendar day.
 */

const assert = require('assert');
const { mulberry32, getDailySeed, getDailyDateString, getDailyChallengeKey } = require('../assets/js/prng.js');
const { MinesweeperEngine, PRESETS } = require('../games/minesweeper/js/engine.js');
const { GameEngine } = require('../games/2048/js/engine.js');

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
console.log('Running Daily Challenge Automated Test Suite');
console.log('========================================\n');

// 1. PRNG determinism
runTest('Mulberry32 produces identical float sequences for identical integer seeds', () => {
  const seed = 20261117;
  const rng1 = mulberry32(seed);
  const rng2 = mulberry32(seed);

  for (let i = 0; i < 50; i++) {
    const val1 = rng1();
    const val2 = rng2();
    assert.strictEqual(val1, val2, `Mismatch at index ${i}: ${val1} !== ${val2}`);
    assert.ok(val1 >= 0 && val1 < 1, `Value out of bounds [0, 1): ${val1}`);
  }
});

// 2. PRNG variation across different seeds
runTest('Mulberry32 produces distinct initial values for different seeds', () => {
  const rngA = mulberry32(20261117);
  const rngB = mulberry32(20261118);

  assert.notStrictEqual(rngA(), rngB(), 'Different seeds should produce different pseudorandom floats');
});

// 3. Daily seed format verification
runTest('getDailySeed produces integer YYYYMMDD matching UTC date', () => {
  const testDate = new Date('2026-11-17T12:00:00Z');
  const seed = getDailySeed(testDate);
  assert.strictEqual(seed, 20261117, `Expected 20261117, got ${seed}`);

  const str = getDailyDateString(testDate);
  assert.strictEqual(str, 'Nov 17, 2026');

  const key = getDailyChallengeKey('minesweeper', testDate);
  assert.strictEqual(key, 'minesweeper_daily_20261117');
});

// 4. Minesweeper Daily Preset & Config
runTest('MinesweeperEngine supports "daily" difficulty preset with 9x9 grid and 10 mines', () => {
  assert.ok(PRESETS.daily, 'PRESETS must include daily');
  assert.strictEqual(PRESETS.daily.rows, 9);
  assert.strictEqual(PRESETS.daily.cols, 9);
  assert.strictEqual(PRESETS.daily.mines, 10);

  const engine = new MinesweeperEngine('daily', 20261117);
  assert.strictEqual(engine.difficulty, 'daily');
  assert.strictEqual(engine.isDaily, true);
  assert.strictEqual(engine.rows, 9);
  assert.strictEqual(engine.cols, 9);
  assert.strictEqual(engine.totalMines, 10);
  assert.strictEqual(engine.seed, 20261117);
});

// 5. Global minefield synchronization on same first-click
runTest('Two independent daily Minesweeper engines place mines at identical coordinates', () => {
  const seed = 20261117;
  const engine1 = new MinesweeperEngine('daily', seed);
  const engine2 = new MinesweeperEngine('daily', seed);

  // Both players open (4, 4) at center
  engine1.reveal(4, 4);
  engine2.reveal(4, 4);

  // Extract mine locations
  const mines1 = [];
  const mines2 = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (engine1.grid[r][c].isMine) mines1.push(`${r},${c}`);
      if (engine2.grid[r][c].isMine) mines2.push(`${r},${c}`);
    }
  }

  assert.strictEqual(mines1.length, 10, 'Must place exactly 10 mines');
  assert.strictEqual(mines2.length, 10, 'Must place exactly 10 mines');
  assert.deepStrictEqual(mines1, mines2, 'Mine placements must be 100% identical across all instances');
});

// 6. Engine reset retains daily seed reproducibility
runTest('Resetting daily Minesweeper engine retains deterministic board generation', () => {
  const seed = 20261117;
  const engine = new MinesweeperEngine('daily', seed);

  engine.reveal(0, 0);
  const firstRunMines = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (engine.grid[r][c].isMine) firstRunMines.push(`${r},${c}`);
    }
  }

  // Reset and reveal same cell again
  engine.reset();
  engine.reveal(0, 0);
  const secondRunMines = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (engine.grid[r][c].isMine) secondRunMines.push(`${r},${c}`);
    }
  }

  assert.deepStrictEqual(firstRunMines, secondRunMines, 'Resetting engine must regenerate identical mine distribution');
});

// 7. 2048 with Mulberry32 deterministic tile spawns
runTest('2048 engine seeded with Mulberry32 generates identical tile spawn sequences', () => {
  const seed = 20261117;
  const engineA = new GameEngine({ randomFn: mulberry32(seed) });
  const engineB = new GameEngine({ randomFn: mulberry32(seed) });

  // Initial 2 tiles should be identical
  assert.deepStrictEqual(engineA.grid, engineB.grid, 'Starting 2048 grids must match');

  // Both execute the exact same move sequence: LEFT, DOWN, RIGHT, DOWN
  const moves = ['LEFT', 'DOWN', 'RIGHT', 'DOWN'];
  for (const move of moves) {
    engineA.move(move);
    engineB.move(move);
    assert.deepStrictEqual(engineA.grid, engineB.grid, `Grid mismatch after move ${move}`);
    assert.strictEqual(engineA.score, engineB.score, `Score mismatch after move ${move}`);
  }
});

console.log('\n========================================');
console.log(`Daily Challenge Tests Passed: ${passedTests}/${totalTests} (100% Success)`);
console.log('========================================\n');
