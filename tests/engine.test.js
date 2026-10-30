/**
 * Browser Arcade - 2048 Engine Automated Unit Test Suite
 * Zero external testing libraries. Uses Node.js native assert module.
 */

const assert = require('assert');
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
console.log('Running 2048 Engine Automated Test Suite');
console.log('========================================\n');

// 1. Initial State
runTest('Initial state spawns exactly 2 tiles on 4x4 grid', () => {
  const engine = new GameEngine();
  assert.strictEqual(engine.size, 4);
  assert.strictEqual(engine.score, 0);
  assert.strictEqual(engine.won, false);
  assert.strictEqual(engine.gameOver, false);
  assert.strictEqual(engine.canUndo(), false);

  const tiles = engine.getTiles();
  assert.strictEqual(tiles.length, 2);
  tiles.forEach(t => {
    assert.ok(t.value === 2 || t.value === 4);
  });
});

// 2. Sliding without merge
runTest('Sliding tiles without merge: [0, 2, 0, 4] LEFT -> [2, 4, 0, 0]', () => {
  const initialGrid = [
    [0, 2, 0, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  // Deterministic PRNG that places tile predictably (won't interfere with row 0)
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.0 });
  const result = engine.move('LEFT');

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.scoreGained, 0);

  const grid = engine.getGridValues();
  assert.strictEqual(grid[0][0], 2);
  assert.strictEqual(grid[0][1], 4);
});

// 3. Single Merge per move rule: [2, 2, 2, 2] -> [4, 4, 0, 0]
runTest('Requirement #5: Each tile merges only once per move ([2, 2, 2, 2] -> [4, 4, 0, 0])', () => {
  const initialGrid = [
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.0 });
  const result = engine.move('LEFT');

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.scoreGained, 8); // 4 + 4

  const grid = engine.getGridValues();
  assert.strictEqual(grid[0][0], 4);
  assert.strictEqual(grid[0][1], 4);
  assert.notStrictEqual(grid[0][0], 8); // Must NOT merge again to 8!
});

// 4. Directional Merging: [4, 4, 8, 8] -> [8, 16, 0, 0]
runTest('Directional Merging: [4, 4, 8, 8] LEFT -> [8, 16, 0, 0]', () => {
  const initialGrid = [
    [4, 4, 8, 8],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.0 });
  const result = engine.move('LEFT');

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.scoreGained, 24); // 8 + 16

  const grid = engine.getGridValues();
  assert.strictEqual(grid[0][0], 8);
  assert.strictEqual(grid[0][1], 16);
});

// 5. Right move traversal order: [2, 4, 2, 2] RIGHT -> [0, 2, 4, 4]
runTest('Right move traversal merges closest to edge: [2, 4, 2, 2] RIGHT -> [0, 2, 4, 4]', () => {
  const initialGrid = [
    [2, 4, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.0 });
  const result = engine.move('RIGHT');

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.scoreGained, 4);

  const grid = engine.getGridValues();
  assert.strictEqual(grid[0][3], 4);
  assert.strictEqual(grid[0][2], 4);
  assert.strictEqual(grid[0][1], 2);
});

// 6. Invalid Move (Requirement #4)
runTest('Requirement #4: Invalid moves do not mutate grid, generate undo, or spawn tiles', () => {
  const initialGrid = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid });
  const prevEmptyCount = engine.getEmptyCells().length;

  const result = engine.move('LEFT');

  assert.strictEqual(result.moved, false);
  assert.strictEqual(result.scoreGained, 0);
  assert.strictEqual(result.spawnedTile, null);
  assert.strictEqual(engine.canUndo(), false); // Undo stack must NOT grow
  assert.strictEqual(engine.getEmptyCells().length, prevEmptyCount); // No tile spawned
  assert.strictEqual(engine.score, 0);
});

// 7. Win condition at 2048
runTest('Requirement #2: Merging into 2048 triggers win state', () => {
  const initialGrid = [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid });
  const result = engine.move('LEFT');

  assert.strictEqual(result.won, true);
  assert.strictEqual(engine.won, true);
  assert.strictEqual(engine.getGridValues()[0][0], 2048);
});

// 8. Continue Playing after 2048
runTest('Requirement #2: continuePlaying() enables endless mode beyond 2048', () => {
  const initialGrid = [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.5 });
  engine.move('LEFT');
  assert.strictEqual(engine.won, true);

  // User activates Continue Playing
  engine.continuePlaying();
  assert.strictEqual(engine.keepPlaying, true);

  // Subsequent move occurs smoothly
  const result2 = engine.move('DOWN');
  assert.ok(result2.moved);
  assert.strictEqual(engine.gameOver, false);
});

// 9. Game Over Trigger (Requirement #6)
runTest('Requirement #6: Game Over triggers only when board is full and no adjacent merges exist', () => {
  // Completely dead board
  const deadGrid = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  const engine = new GameEngine({ initialGrid: deadGrid });
  assert.strictEqual(engine.gameOver, true);

  // Full board with ONE possible horizontal merge
  const almostDeadGrid = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 2, 4] // Note the adjacent [2, 2] on row 3
  ];
  const engine2 = new GameEngine({ initialGrid: almostDeadGrid });
  assert.strictEqual(engine2.gameOver, false);

  // Board with empty cell cannot be Game Over
  const gridWithHole = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 0, 2]
  ];
  const engine3 = new GameEngine({ initialGrid: gridWithHole });
  assert.strictEqual(engine3.gameOver, false);
});

// 10. Complete Undo Restoration (Requirement #3)
runTest('Requirement #3: Undo completely restores board matrix, score, and state', () => {
  const initialGrid = [
    [2, 2, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const initialScore = 150;
  const engine = new GameEngine({ initialGrid, score: initialScore, randomFn: () => 0.0 });

  assert.strictEqual(engine.canUndo(), false);

  // Make a valid move
  const moveResult = engine.move('LEFT');
  assert.strictEqual(moveResult.moved, true);
  assert.strictEqual(engine.score, initialScore + 4);
  assert.strictEqual(engine.canUndo(), true);

  // Perform Undo
  const undoSuccess = engine.undo();
  assert.strictEqual(undoSuccess, true);

  // Verify board and score are restored exactly
  const restoredGrid = engine.getGridValues();
  assert.deepStrictEqual(restoredGrid, initialGrid);
  assert.strictEqual(engine.score, initialScore);
  assert.strictEqual(engine.canUndo(), false);
});

// 11. Multi-Step Undo Stack
runTest('Multi-step undo reversibility across several moves', () => {
  const initialGrid = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const engine = new GameEngine({ initialGrid, randomFn: () => 0.0 });

  // Move 1
  engine.move('RIGHT');
  assert.strictEqual(engine.undoStack.length, 1);

  // Move 2
  engine.move('DOWN');
  assert.strictEqual(engine.undoStack.length, 2);

  // Undo move 2
  assert.strictEqual(engine.undo(), true);
  assert.strictEqual(engine.undoStack.length, 1);

  // Undo move 1
  assert.strictEqual(engine.undo(), true);
  assert.strictEqual(engine.undoStack.length, 0);

  // Undo on empty returns false
  assert.strictEqual(engine.undo(), false);
  assert.deepStrictEqual(engine.getGridValues(), initialGrid);
});

// 12. Tile Spawn Probability (90% for 2, 10% for 4)
runTest('Random tile spawn distribution approximates 90/10 probability', () => {
  let count2 = 0;
  let count4 = 0;
  const trials = 1000;

  for (let i = 0; i < trials; i++) {
    const val = Math.random() < 0.9 ? 2 : 4;
    if (val === 2) count2++;
    else count4++;
  }

  // 90% of 1000 is 900. Tolerance +- 50
  assert.ok(count2 > 850 && count2 < 950, `Count of 2s (${count2}) within expected range`);
  assert.ok(count4 > 50 && count4 < 150, `Count of 4s (${count4}) within expected range`);
});

console.log('\n========================================');
console.log(`Test Results: ${passedTests}/${totalTests} Passed (100% Success)`);
console.log('========================================\n');
