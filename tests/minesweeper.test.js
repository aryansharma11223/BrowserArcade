/**
 * Browser Arcade - Minesweeper Classic Automated Test Suite
 * Validates board generation, first-click safety guarantee, neighbor counting,
 * cascade flood-fill, flag toggling, win/loss conditions, chording, and resets.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MinesweeperEngine, PRESETS } = require('../games/minesweeper/js/engine.js');

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
console.log('Running Minesweeper Classic Automated Test Suite');
console.log('========================================\n');

// 1. Difficulty Presets & Initialization
runTest('Engine initializes with correct preset dimensions and mine counts', () => {
  const beginner = new MinesweeperEngine('beginner');
  assert.strictEqual(beginner.rows, 9);
  assert.strictEqual(beginner.cols, 9);
  assert.strictEqual(beginner.totalMines, 10);
  assert.strictEqual(beginner.status, 'ready');
  assert.strictEqual(beginner.firstClick, true);

  const intermediate = new MinesweeperEngine('intermediate');
  assert.strictEqual(intermediate.rows, 16);
  assert.strictEqual(intermediate.cols, 16);
  assert.strictEqual(intermediate.totalMines, 40);

  const expert = new MinesweeperEngine('expert');
  assert.strictEqual(expert.rows, 16);
  assert.strictEqual(expert.cols, 30);
  assert.strictEqual(expert.totalMines, 99);
});

// 2. First-Click Safety Guarantee
runTest('First-click safety guarantee: clicked cell and all 8 neighbors have 0 mines', () => {
  for (let trial = 0; trial < 10; trial++) {
    const engine = new MinesweeperEngine('beginner');
    const clickR = 4;
    const clickC = 4;

    const result = engine.reveal(clickR, clickC);
    assert.strictEqual(engine.status, 'playing');
    assert.strictEqual(engine.firstClick, false);

    // Verify clicked cell and 8 neighbors have isMine === false
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = clickR + dr;
        const nc = clickC + dc;
        assert.strictEqual(engine.grid[nr][nc].isMine, false, `Forbidden neighbor at (${nr}, ${nc}) had a mine!`);
      }
    }

    // Verify total placed mines strictly equals 10
    let totalMinesPlaced = 0;
    for (let r = 0; r < engine.rows; r++) {
      for (let c = 0; c < engine.cols; c++) {
        if (engine.grid[r][c].isMine) totalMinesPlaced++;
      }
    }
    assert.strictEqual(totalMinesPlaced, 10, `Expected exactly 10 mines, found ${totalMinesPlaced}`);
  }
});

// 3. Mathematical Neighbor Calculation Consistency
runTest('Adjacent mine counts accurately match placed mine coordinates', () => {
  const engine = new MinesweeperEngine('beginner');
  engine.reveal(0, 0); // triggers placement

  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      if (!engine.grid[r][c].isMine) {
        let expectedNeighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < engine.rows && nc >= 0 && nc < engine.cols) {
              if (engine.grid[nr][nc].isMine) expectedNeighbors++;
            }
          }
        }
        assert.strictEqual(
          engine.grid[r][c].adjacentMines,
          expectedNeighbors,
          `Neighbor count mismatch at (${r}, ${c}): expected ${expectedNeighbors}, got ${engine.grid[r][c].adjacentMines}`
        );
      }
    }
  }
});

// 4. Cascade Flood Fill
runTest('Cascade flood-fill automatically clears contiguous zero-neighbor areas', () => {
  const engine = new MinesweeperEngine('beginner');
  const result = engine.reveal(4, 4);

  // Because (4,4) and its neighbors are all safe, (4,4) has 0 adjacent mines and cascades
  const revealedCell = engine.grid[4][4];
  assert.strictEqual(revealedCell.isRevealed, true);
  assert.ok(result.revealedCells.length >= 9, `Cascade should reveal at least the 9 safe zone cells, got ${result.revealedCells.length}`);
});

// 5. Flag Toggling & Remaining Mine Counter
runTest('Flagging decrements remaining mine count and protects cells from accidental reveal', () => {
  const engine = new MinesweeperEngine('beginner');
  assert.strictEqual(engine.getRemainingMines(), 10);

  // Flag cell (0, 1)
  const flag1 = engine.toggleFlag(0, 1);
  assert.strictEqual(flag1.isFlagged, true);
  assert.strictEqual(engine.getRemainingMines(), 9);

  // Flagged cell cannot be revealed
  const revealAttempt = engine.reveal(0, 1);
  assert.strictEqual(revealAttempt.changed, false);
  assert.strictEqual(engine.grid[0][1].isRevealed, false);

  // Unflag cell (0, 1)
  const unflag1 = engine.toggleFlag(0, 1);
  assert.strictEqual(unflag1.isFlagged, false);
  assert.strictEqual(engine.getRemainingMines(), 10);
});

// 6. Loss Condition
runTest('Revealing an active mine cell triggers Game Over loss state', () => {
  const engine = new MinesweeperEngine('beginner');
  engine.reveal(0, 0); // Place mines safely away from (0,0)

  // Find a cell with a mine
  let mineR = -1;
  let mineC = -1;
  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      if (engine.grid[r][c].isMine) {
        mineR = r;
        mineC = c;
        break;
      }
    }
    if (mineR !== -1) break;
  }

  assert.ok(mineR !== -1, 'Must find at least one mine');
  const result = engine.reveal(mineR, mineC);

  assert.strictEqual(result.hitMine, true);
  assert.strictEqual(engine.status, 'lost');
  assert.deepStrictEqual(engine.explodedMine, { row: mineR, col: mineC });
});

// 7. Win Condition
runTest('Revealing all non-mine cells triggers victory and auto-flags remaining mines', () => {
  const engine = new MinesweeperEngine('beginner');
  engine.reveal(0, 0);

  // Reveal every non-mine cell
  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      if (!engine.grid[r][c].isMine && !engine.grid[r][c].isRevealed) {
        engine.reveal(r, c);
      }
    }
  }

  assert.strictEqual(engine.status, 'won');
  // Check that all mines are now flagged
  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      if (engine.grid[r][c].isMine) {
        assert.strictEqual(engine.grid[r][c].isFlagged, true, `Mine at (${r}, ${c}) should be auto-flagged on win`);
      }
    }
  }
});

// 8. Chording Mechanism
runTest('Chording reveals unflagged neighbors when flagged count matches adjacent mine number', () => {
  const engine = new MinesweeperEngine('beginner');
  engine.reveal(4, 4);

  // Find a revealed cell with adjacentMines === 1
  let targetR = -1;
  let targetC = -1;
  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      if (engine.grid[r][c].isRevealed && engine.grid[r][c].adjacentMines === 1) {
        targetR = r;
        targetC = c;
        break;
      }
    }
    if (targetR !== -1) break;
  }

  if (targetR !== -1) {
    // Find its single mine neighbor
    let mineR = -1, mineC = -1;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = targetR + dr;
        const nc = targetC + dc;
        if (nr >= 0 && nr < engine.rows && nc >= 0 && nc < engine.cols) {
          if (engine.grid[nr][nc].isMine) {
            mineR = nr;
            mineC = nc;
            break;
          }
        }
      }
      if (mineR !== -1) break;
    }

    if (mineR !== -1) {
      // Flag the mine
      engine.toggleFlag(mineR, mineC);

      // Perform chord on (targetR, targetC)
      const chordResult = engine.chord(targetR, targetC);
      assert.strictEqual(chordResult.changed, true, 'Chord should succeed when flags match adjacent count');
      assert.strictEqual(chordResult.hitMine, false);
    }
  }
});

// 9. Reset and Clean State Restoration
runTest('Reset restores pristine ready state with zero revealed or flagged cells', () => {
  const engine = new MinesweeperEngine('beginner');
  engine.reveal(3, 3);
  engine.toggleFlag(0, 0);

  engine.reset();
  assert.strictEqual(engine.status, 'ready');
  assert.strictEqual(engine.firstClick, true);
  assert.strictEqual(engine.getRemainingMines(), 10);
  assert.strictEqual(engine.explodedMine, null);

  for (let r = 0; r < engine.rows; r++) {
    for (let c = 0; c < engine.cols; c++) {
      assert.strictEqual(engine.grid[r][c].isRevealed, false);
      assert.strictEqual(engine.grid[r][c].isFlagged, false);
      assert.strictEqual(engine.grid[r][c].isMine, false);
      assert.strictEqual(engine.grid[r][c].adjacentMines, 0);
    }
  }
});

console.log('\n========================================');
console.log(`Minesweeper Tests Passed: ${passedTests}/${totalTests} (100% Success)`);
console.log('========================================\n');
