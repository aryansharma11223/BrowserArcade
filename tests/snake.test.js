/**
 * Browser Arcade - Snake Retro Automated Test Suite
 * Validates movement, direction queuing, collision detection, food generation,
 * scoring, lifecycle, and homepage integration.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GameEngine, Direction, GameStatus } = require('../games/snake/js/engine.js');

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
console.log('Running Snake Retro Automated Test Suite');
console.log('========================================\n');

// 1. Initial State & Snake Movement
runTest('Requirement #1: Snake spawns with default length 3 and moves continuously in direction', () => {
  const engine = new GameEngine({ cols: 20, rows: 20 });
  assert.strictEqual(engine.snake.length, 3);
  assert.deepStrictEqual(engine.snake[0], { x: 10, y: 10 });
  assert.deepStrictEqual(engine.snake[1], { x: 9, y: 10 });
  assert.deepStrictEqual(engine.snake[2], { x: 8, y: 10 });
  assert.strictEqual(engine.status, GameStatus.IDLE);

  engine.start();
  assert.strictEqual(engine.status, GameStatus.PLAYING);

  // Tick once to the right
  const result = engine.tick();
  assert.strictEqual(result.moved, true);
  assert.deepStrictEqual(engine.snake[0], { x: 11, y: 10 });
  assert.deepStrictEqual(engine.snake[1], { x: 10, y: 10 });
  assert.deepStrictEqual(engine.snake[2], { x: 9, y: 10 });
});

// 2. Valid and Invalid Direction Changes (Reversal Prevention & Buffering)
runTest('Requirement #2: Prevents 180-degree reversal and buffers rapid inputs', () => {
  const engine = new GameEngine({ cols: 20, rows: 20 });
  engine.start();

  // Moving RIGHT, attempting LEFT must be rejected
  const leftAttempt = engine.queueDirection('LEFT');
  assert.strictEqual(leftAttempt, false, 'Direct 180-degree reversal must be rejected');

  // Attempting UP is valid
  const upAttempt = engine.queueDirection('UP');
  assert.strictEqual(upAttempt, true, 'Perpendicular direction change must be accepted');

  // Buffering next command: after UP, queuing LEFT is valid
  const leftAfterUp = engine.queueDirection('LEFT');
  assert.strictEqual(leftAfterUp, true, 'Second valid direction must be buffered in queue');

  // Third command should be rejected by buffer cap
  const downRejected = engine.queueDirection('DOWN');
  assert.strictEqual(downRejected, false, 'Queue exceeding buffer limit must be dropped');

  // First tick: consumes UP
  engine.tick();
  assert.deepStrictEqual(engine.direction, Direction.UP);
  assert.deepStrictEqual(engine.snake[0], { x: 10, y: 9 });

  // Second tick: consumes LEFT
  engine.tick();
  assert.deepStrictEqual(engine.direction, Direction.LEFT);
  assert.deepStrictEqual(engine.snake[0], { x: 9, y: 9 });
});

// 3. Food Collection & Growth
runTest('Requirement #3: Eating food increases length and score without removing tail', () => {
  const engine = new GameEngine({
    cols: 20,
    rows: 20,
    initialSnake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
    initialDirection: Direction.RIGHT
  });
  engine.food = { x: 6, y: 5 }; // Place food directly in path
  engine.start();

  const initialLength = engine.snake.length;
  const result = engine.tick();

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.ateFood, true);
  assert.strictEqual(engine.snake.length, initialLength + 1);
  assert.deepStrictEqual(engine.snake[0], { x: 6, y: 5 }, 'New head on food position');
  assert.deepStrictEqual(engine.snake[engine.snake.length - 1], { x: 3, y: 5 }, 'Tail preserved (growth)');
  assert.strictEqual(engine.score, 10);
});

// 4. Food Placement Without Overlap
runTest('Requirement #4: Food only spawns on unoccupied grid cells', () => {
  // Test on small 3x3 grid
  const engine = new GameEngine({
    cols: 3,
    rows: 3,
    initialSnake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 }
    ]
  });

  const emptyCells = engine.getEmptyCells();
  assert.strictEqual(emptyCells.length, 4);

  // Spawn food 50 times, verify none overlap with snake
  for (let i = 0; i < 50; i++) {
    const food = engine.spawnFood();
    const overlaps = engine.snake.some(s => s.x === food.x && s.y === food.y);
    assert.strictEqual(overlaps, false, 'Food must never spawn on snake coordinates');
  }
});

// 5. Wall Collision
runTest('Requirement #5: Wall collision triggers Game Over', () => {
  // Place snake right next to right wall (x = 19) moving RIGHT
  const engine = new GameEngine({
    cols: 20,
    rows: 20,
    initialSnake: [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }],
    initialDirection: Direction.RIGHT
  });
  engine.start();

  const result = engine.tick();
  assert.strictEqual(result.moved, false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.reason, 'WALL_COLLISION');
  assert.strictEqual(engine.status, GameStatus.GAME_OVER);
});

// 6. Self-Collision
runTest('Requirement #6: Moving into own body triggers Game Over', () => {
  // Set up snake in loop: [5,5], [5,6], [4,6], [4,5], [4,4]
  // Moving DOWN from [5,5] into [5,6]
  const engine = new GameEngine({
    cols: 20,
    rows: 20,
    initialSnake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 }
    ],
    initialDirection: Direction.DOWN
  });
  engine.start();

  const result = engine.tick();
  assert.strictEqual(result.moved, false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.reason, 'SELF_COLLISION');
  assert.strictEqual(engine.status, GameStatus.GAME_OVER);
});

// 7. Score Updates & Speed Progression
runTest('Requirement #7: Consecutive food increases score and accelerates speed', () => {
  const engine = new GameEngine({ cols: 20, rows: 20 });
  const initialSpeed = engine.getSpeed();

  // Simulate eating 5 foods
  for (let i = 1; i <= 5; i++) {
    engine.snake = [{ x: i, y: 0 }, { x: i - 1, y: 0 }];
    engine.food = { x: i + 1, y: 0 };
    engine.direction = Direction.RIGHT;
    engine.start();
    engine.tick();
    assert.strictEqual(engine.score, i * 10);
  }

  assert.strictEqual(engine.score, 50);
  assert.ok(engine.getSpeed() < initialSpeed, 'Speed must accelerate as score increases');
});

// 8. Best-Score Persistence Logic
runTest('Requirement #8: Best score updates whenever current score exceeds it', () => {
  const engine = new GameEngine({ cols: 20, rows: 20, bestScore: 20 });
  assert.strictEqual(engine.bestScore, 20);

  engine.score = 10;
  engine.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  engine.food = { x: 6, y: 5 };
  engine.start();
  engine.tick();

  // Score is now 20, bestScore remains 20
  assert.strictEqual(engine.score, 20);
  assert.strictEqual(engine.bestScore, 20);

  // Eat another food -> score 30 -> bestScore becomes 30
  engine.food = { x: 7, y: 5 };
  engine.tick();
  assert.strictEqual(engine.score, 30);
  assert.strictEqual(engine.bestScore, 30);
});

// 9. Pause and Resume Lifecycle
runTest('Requirement #9: Pause halts game state; resume continues seamlessly', () => {
  const engine = new GameEngine({ cols: 20, rows: 20 });
  engine.start();
  assert.strictEqual(engine.status, GameStatus.PLAYING);

  // Pause
  const paused = engine.pause();
  assert.strictEqual(paused, true);
  assert.strictEqual(engine.status, GameStatus.PAUSED);

  // Ticking while paused must not move snake
  const headBefore = { ...engine.snake[0] };
  const tickResult = engine.tick();
  assert.strictEqual(tickResult.moved, false);
  assert.deepStrictEqual(engine.snake[0], headBefore);

  // Resume
  const resumed = engine.resume();
  assert.strictEqual(resumed, true);
  assert.strictEqual(engine.status, GameStatus.PLAYING);

  // Tick while resumed moves snake
  const activeTick = engine.tick();
  assert.strictEqual(activeTick.moved, true);
  assert.notDeepStrictEqual(engine.snake[0], headBefore);
});

// 10. Restart State Cleanliness
runTest('Requirement #10: Reset completely clears snake, input queue, and score', () => {
  const engine = new GameEngine({ cols: 20, rows: 20, bestScore: 100 });
  engine.start();
  engine.score = 60;
  engine.foodEaten = 6;
  engine.queueDirection('UP');
  engine.status = GameStatus.GAME_OVER;

  engine.reset();
  assert.strictEqual(engine.snake.length, 3);
  assert.strictEqual(engine.score, 0);
  assert.strictEqual(engine.foodEaten, 0);
  assert.strictEqual(engine.bestScore, 100, 'Best score preserved on reset');
  assert.strictEqual(engine.status, GameStatus.IDLE);
  assert.strictEqual(engine.inputQueue.length, 0);
  assert.deepStrictEqual(engine.direction, Direction.RIGHT);
});

// 11. Homepage Link and Catalog Status Integration Check
runTest('Requirement #11: Homepage links to Snake Retro and reflects Playable Now status', () => {
  const indexPath = path.join(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Verify catalog badge
  assert.ok(
    indexHtml.includes('2 Playable') && indexHtml.includes('2 Coming Soon'),
    'index.html catalog badge must show 2 Playable • 2 Coming Soon'
  );

  // Verify Snake Retro card has link and Playable status
  assert.ok(
    indexHtml.includes('href="/games/snake/"'),
    'index.html must contain link to /games/snake/'
  );
  assert.ok(
    indexHtml.includes('Snake Retro'),
    'index.html must include Snake Retro title'
  );
});

console.log('\n========================================');
console.log(`Snake Tests Passed: ${passedTests}/${totalTests} (100% Success)`);
console.log('========================================\n');
