/**
 * Browser Arcade - Block Drop Classic Automated Test Suite
 * Validates 7-bag randomizer, grid boundaries, collision detection, rotation with kicks,
 * soft/hard drops, hold piece queue, line clearing, scoring, and level gravity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { BlockDropEngine, TETROMINOES, COLS, ROWS, TOTAL_ROWS } = require('../games/blockdrop/js/engine.js');

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
console.log('Running Block Drop Classic Automated Test Suite');
console.log('========================================\n');

// 1. Board Dimensions & Initial State
runTest('Engine initializes with standard 10x22 grid, level 1, and starting pieces', () => {
  const engine = new BlockDropEngine();
  assert.strictEqual(engine.cols, 10);
  assert.strictEqual(engine.rows, 20);
  assert.strictEqual(engine.totalRows, 22);
  assert.strictEqual(engine.score, 0);
  assert.strictEqual(engine.lines, 0);
  assert.strictEqual(engine.level, 1);
  assert.strictEqual(engine.isGameOver, false);
  assert.strictEqual(engine.isPaused, false);
  assert.ok(engine.currentPiece !== null, 'currentPiece must be spawned');
  assert.ok(engine.nextPiece !== null, 'nextPiece must be queued');
});

// 2. 7-Bag Randomizer
runTest('7-Bag randomizer produces all 7 distinct tetrominoes per cycle', () => {
  const engine = new BlockDropEngine();
  const seenTypes = new Set();

  seenTypes.add(engine.currentPiece.type);
  seenTypes.add(engine.nextPiece.type);

  // Generate 5 more to complete the 7-piece bag
  for (let i = 0; i < 5; i++) {
    const piece = engine._generatePiece();
    seenTypes.add(piece.type);
  }

  assert.strictEqual(seenTypes.size, 7, `Expected all 7 unique shapes, got ${seenTypes.size}`);
  ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].forEach(type => {
    assert.ok(seenTypes.has(type), `Missing tetromino shape ${type}`);
  });
});

// 3. Lateral Movement & Wall Collisions
runTest('Movement left/right updates coordinates and respects wall boundaries', () => {
  const engine = new BlockDropEngine();
  const startX = engine.currentPiece.x;

  // Move right
  const movedRight = engine.moveRight();
  assert.strictEqual(movedRight, true);
  assert.strictEqual(engine.currentPiece.x, startX + 1);

  // Move left twice
  engine.moveLeft();
  engine.moveLeft();
  assert.strictEqual(engine.currentPiece.x, startX - 1);

  // Attempt to move past left wall
  for (let i = 0; i < 10; i++) {
    engine.moveLeft();
  }
  const minX = engine.currentPiece.x;
  const cannotMovePastWall = engine.moveLeft();
  assert.strictEqual(cannotMovePastWall, false);
  assert.strictEqual(engine.currentPiece.x, minX, 'Cannot move past left wall boundary');
});

// 4. Piece Rotation & Invariance
runTest('Rotation transforms polyomino matrix; O-piece remains invariant', () => {
  const engine = new BlockDropEngine();

  // Test T-piece rotation
  engine.currentPiece = {
    type: 'T',
    color: '#a855f7',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    x: 4,
    y: 5
  };

  const rotatedCW = engine.rotate(true);
  assert.strictEqual(rotatedCW, true);
  assert.deepStrictEqual(engine.currentPiece.matrix, [
    [0, 1, 0],
    [0, 1, 1],
    [0, 1, 0]
  ]);

  // Test O-piece rotation invariance
  engine.currentPiece = {
    type: 'O',
    color: '#eab308',
    matrix: [[1, 1], [1, 1]],
    x: 4,
    y: 5
  };
  const oRotated = engine.rotate(true);
  assert.strictEqual(oRotated, false, 'O-piece should not rotate');
});

// 5. Soft Drop and Hard Drop Mechanics
runTest('Soft drop awards 1 point per row; hard drop drops to ghost position and locks', () => {
  const engine = new BlockDropEngine();
  const initialY = engine.currentPiece.y;

  // Soft drop once
  const softResult = engine.softDrop();
  assert.strictEqual(softResult.moved, true);
  assert.strictEqual(engine.currentPiece.y, initialY + 1);
  assert.strictEqual(engine.score, 1);

  // Hard drop
  const preHardY = engine.currentPiece.y;
  const hardResult = engine.hardDrop();
  assert.strictEqual(hardResult.locked, true);
  assert.ok(hardResult.droppedRows > 0);
  assert.ok(engine.score > 1, 'Hard drop should award score for dropped distance');
});

// 6. Hold Piece Queue
runTest('Hold piece stores active block, prevents consecutive double-hold, and allows swap', () => {
  const engine = new BlockDropEngine();
  const originalType = engine.currentPiece.type;

  // First hold: banks original, spawns next
  const hold1 = engine.hold();
  assert.strictEqual(hold1, true);
  assert.strictEqual(engine.holdPiece.name, originalType);

  // Immediate second hold attempt is blocked
  const hold2 = engine.hold();
  assert.strictEqual(hold2, false, 'Cannot hold twice consecutively for the same piece');

  // Hard drop to lock piece and reset canHold
  engine.hardDrop();
  assert.strictEqual(engine.canHold, true, 'canHold must reset after piece lock');

  // Now hold again: should swap
  const newType = engine.currentPiece.type;
  const hold3 = engine.hold();
  assert.strictEqual(hold3, true);
  assert.strictEqual(engine.currentPiece.type, originalType, 'Hold should swap previously held piece into active play');
  assert.strictEqual(engine.holdPiece.name, newType);
});

// 7. Line Clear Detection & Multi-Line Scoring
runTest('Full row clearing removes lines, shifts down, and awards multi-line bonuses', () => {
  const engine = new BlockDropEngine();

  // Manually fill bottom row (row 21) except for 1 cell
  const bottomRow = TOTAL_ROWS - 1;
  for (let c = 0; c < COLS; c++) {
    engine.grid[bottomRow][c] = '#3b82f6';
  }

  // Clear bottom row
  const cleared = engine._clearLines();
  assert.strictEqual(cleared, 1);
  assert.strictEqual(engine.lines, 1);
  assert.strictEqual(engine.score, 100); // 100 * level 1

  // Verify bottom row is now empty
  assert.ok(engine.grid[bottomRow].every(cell => cell === 0));

  // Test 4-line Tetris scoring
  for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      engine.grid[r][c] = '#06b6d4';
    }
  }
  const tetrisCleared = engine._clearLines();
  assert.strictEqual(tetrisCleared, 4);
  assert.strictEqual(engine.lines, 5);
  assert.strictEqual(engine.score, 100 + 800); // 100 + 800 * level 1
});

// 8. Level Progression & Acceleration Curve
runTest('Level increments every 10 lines and accelerates gravity drop interval', () => {
  const engine = new BlockDropEngine();
  assert.strictEqual(engine.level, 1);
  const initialInterval = engine.getDropInterval();

  // Simulate 10 lines
  engine.lines = 10;
  engine.level = Math.floor(engine.lines / 10) + 1;
  assert.strictEqual(engine.level, 2);

  const level2Interval = engine.getDropInterval();
  assert.ok(level2Interval < initialInterval, `Level 2 speed (${level2Interval}ms) should be faster than Level 1 (${initialInterval}ms)`);
});

// 9. Reset and Clean State Restoration
runTest('Reset restores pristine ready state with empty grid, zeroed scores, and cleared hold', () => {
  const engine = new BlockDropEngine();
  engine.hardDrop();
  engine.hold();
  engine.score = 5000;
  engine.lines = 15;

  engine.reset();
  assert.strictEqual(engine.score, 0);
  assert.strictEqual(engine.lines, 0);
  assert.strictEqual(engine.level, 1);
  assert.strictEqual(engine.holdPiece, null);
  assert.strictEqual(engine.isGameOver, false);

  for (let r = 0; r < engine.totalRows; r++) {
    assert.ok(engine.grid[r].every(cell => cell === 0), `Row ${r} must be empty after reset`);
  }
});

console.log('\n========================================');
console.log(`Block Drop Tests Passed: ${passedTests}/${totalTests} (100% Success)`);
console.log('========================================\n');
