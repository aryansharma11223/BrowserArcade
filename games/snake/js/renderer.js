/**
 * Browser Arcade - Snake Retro Canvas Grid Renderer
 *
 * Hardware-accelerated 60 FPS HTML5 Canvas renderer with DPR scaling,
 * retro phosphor grid, glowing neon snake, animated food, and particle effects.
 */

export class GridRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} [cols=20]
   * @param {number} [rows=20]
   */
  constructor(canvas, cols = 20, rows = 20) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols;
    this.rows = rows;

    this.cellSize = 0;
    this.width = 0;
    this.height = 0;
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    this.particles = [];
    this.theme = 'neon'; // 'neon' | 'nokia' | 'midnight'
    this.resize();
  }

  /**
   * Sets active visual theme.
   * @param {string} themeName
   */
  setTheme(themeName) {
    this.theme = ['neon', 'nokia', 'midnight'].includes(themeName) ? themeName : 'neon';
  }

  /**
   * Adjusts canvas resolution for crisp rendering across high-DPI displays.
   */
  resize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height) || 400);

    this.width = size;
    this.height = size;
    this.cellSize = size / this.cols;

    this.canvas.width = Math.floor(size * this.dpr);
    this.canvas.height = Math.floor(size * this.dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Adds an explosion of particle sparks at a grid cell when food is eaten.
   * @param {number} gridX
   * @param {number} gridY
   */
  addFoodParticles(gridX, gridY) {
    const cx = (gridX + 0.5) * this.cellSize;
    const cy = (gridY + 0.5) * this.cellSize;
    let colors = ['#34D399', '#10B981', '#EC4899', '#FBBF24', '#FFFFFF'];
    if (this.theme === 'nokia') {
      colors = ['#0f380f', '#194919', '#276227'];
    } else if (this.theme === 'midnight') {
      colors = ['#FBBF24', '#F59E0B', '#C084FC', '#A855F7', '#FFFFFF'];
    }

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: this.theme === 'nokia' ? 2 : (2 + Math.random() * 2),
        life: 1.0,
        decay: 0.035 + Math.random() * 0.03
      });
    }
  }

  /**
   * Updates particle positions and removes faded ones.
   * @private
   */
  _updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Renders a full frame.
   * @param {Object} engine GameEngine instance
   */
  render(engine) {
    if (!this.ctx || !this.width) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply theme canvas backdrop if retro mode
    if (this.theme === 'nokia') {
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.theme === 'midnight') {
      ctx.fillStyle = '#0f0c1b';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 1. Retro Background & Grid
    this._drawGrid(ctx);

    // 2. Food Item
    if (engine.food) {
      this._drawFood(ctx, engine.food);
    }

    // 3. Snake Body & Head
    if (engine.snake && engine.snake.length > 0) {
      this._drawSnake(ctx, engine.snake, engine.direction, engine.status);
    }

    // 4. Particle Sparks
    this._drawParticles(ctx);
  }

  /**
   * Draws subtle retro grid lines.
   * @private
   */
  _drawGrid(ctx) {
    ctx.save();
    if (this.theme === 'nokia') {
      ctx.strokeStyle = 'rgba(15, 56, 15, 0.12)';
    } else if (this.theme === 'midnight') {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
    } else {
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    }
    ctx.lineWidth = 1;

    for (let c = 0; c <= this.cols; c++) {
      const x = Math.floor(c * this.cellSize);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let r = 0; r <= this.rows; r++) {
      const y = Math.floor(r * this.cellSize);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draws glowing food with theme support.
   * @private
   */
  _drawFood(ctx, food) {
    ctx.save();
    const cx = (food.x + 0.5) * this.cellSize;
    const cy = (food.y + 0.5) * this.cellSize;
    const radius = (this.cellSize * 0.42);

    if (this.theme === 'nokia') {
      // Nokia 3310 square pixel food block with inner pattern
      const fx = Math.floor(food.x * this.cellSize) + 2;
      const fy = Math.floor(food.y * this.cellSize) + 2;
      const fsize = Math.floor(this.cellSize) - 4;
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(fx, fy, fsize, fsize);
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(fx + 2, fy + 2, fsize - 4, fsize - 4);
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(fx + 4, fy + 4, fsize - 8, fsize - 8);
      ctx.restore();
      return;
    }

    if (this.theme === 'midnight') {
      const pulse = Math.sin(Date.now() / 180) * 1.5;
      const currentRadius = Math.max(3, radius + pulse);
      ctx.shadowColor = 'rgba(234, 179, 8, 0.85)';
      ctx.shadowBlur = 14;
      const grad = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, currentRadius);
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.6, '#EAB308');
      grad.addColorStop(1, '#A16207');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Default Neon
    const pulse = Math.sin(Date.now() / 180) * 1.5;
    const currentRadius = Math.max(3, radius + pulse);

    // Outer glow
    ctx.shadowColor = 'rgba(236, 72, 153, 0.75)';
    ctx.shadowBlur = 12;

    // Gradient fill
    const grad = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, currentRadius);
    grad.addColorStop(0, '#F472B6');
    grad.addColorStop(0.6, '#EC4899');
    grad.addColorStop(1, '#BE185D');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Stem / green leaf detail
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - currentRadius - 1, 2.5, 1.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws the snake with theme styling.
   * @private
   */
  _drawSnake(ctx, snake, direction, status) {
    ctx.save();
    const padding = this.theme === 'nokia' ? 0.5 : 1.5;
    const segSize = this.cellSize - (padding * 2);

    if (this.theme === 'nokia') {
      ctx.fillStyle = '#0f380f';
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const x = Math.floor(seg.x * this.cellSize) + padding;
        const y = Math.floor(seg.y * this.cellSize) + padding;
        ctx.fillRect(x, y, segSize, segSize);
      }
      const head = snake[0];
      const hx = Math.floor(head.x * this.cellSize) + padding;
      const hy = Math.floor(head.y * this.cellSize) + padding;
      this._drawNokiaEyes(ctx, hx, hy, segSize, direction);
      ctx.restore();
      return;
    }

    if (this.theme === 'midnight') {
      for (let i = snake.length - 1; i >= 1; i--) {
        const seg = snake[i];
        const x = (seg.x * this.cellSize) + padding;
        const y = (seg.y * this.cellSize) + padding;
        const progress = 1 - (i / snake.length);
        const alpha = 0.75 + (progress * 0.25);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.4)';
        ctx.shadowBlur = 8;
        this._drawRoundedRect(ctx, x, y, segSize, segSize, Math.max(3, segSize * 0.28));
      }

      const head = snake[0];
      const hx = (head.x * this.cellSize) + padding;
      const hy = (head.y * this.cellSize) + padding;

      ctx.shadowColor = status === 'GAME_OVER' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(192, 132, 252, 0.9)';
      ctx.shadowBlur = 14;
      const headGrad = ctx.createLinearGradient(hx, hy, hx + segSize, hy + segSize);
      if (status === 'GAME_OVER') {
        headGrad.addColorStop(0, '#EF4444');
        headGrad.addColorStop(1, '#DC2626');
      } else {
        headGrad.addColorStop(0, '#C084FC');
        headGrad.addColorStop(1, '#9333EA');
      }
      ctx.fillStyle = headGrad;
      this._drawRoundedRect(ctx, hx, hy, segSize, segSize, Math.max(4, segSize * 0.35));
      this._drawEyes(ctx, hx, hy, segSize, direction, status);
      ctx.restore();
      return;
    }

    // Default Neon Theme
    for (let i = snake.length - 1; i >= 1; i--) {
      const seg = snake[i];
      const x = (seg.x * this.cellSize) + padding;
      const y = (seg.y * this.cellSize) + padding;

      const progress = 1 - (i / snake.length);
      const alpha = 0.75 + (progress * 0.25);
      ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
      ctx.shadowBlur = 6;

      this._drawRoundedRect(ctx, x, y, segSize, segSize, Math.max(3, segSize * 0.28));
    }

    // Draw head segment
    const head = snake[0];
    const hx = (head.x * this.cellSize) + padding;
    const hy = (head.y * this.cellSize) + padding;

    ctx.shadowColor = status === 'GAME_OVER'
      ? 'rgba(239, 68, 68, 0.8)'
      : 'rgba(52, 211, 153, 0.8)';
    ctx.shadowBlur = 14;

    const headGrad = ctx.createLinearGradient(hx, hy, hx + segSize, hy + segSize);
    if (status === 'GAME_OVER') {
      headGrad.addColorStop(0, '#EF4444');
      headGrad.addColorStop(1, '#DC2626');
    } else {
      headGrad.addColorStop(0, '#34D399');
      headGrad.addColorStop(1, '#10B981');
    }

    ctx.fillStyle = headGrad;
    this._drawRoundedRect(ctx, hx, hy, segSize, segSize, Math.max(4, segSize * 0.35));

    // Draw eyes looking toward movement direction
    this._drawEyes(ctx, hx, hy, segSize, direction, status);

    ctx.restore();
  }

  /**
   * Draws retro pixel eyes for Nokia 3310 theme.
   * @private
   */
  _drawNokiaEyes(ctx, hx, hy, size, direction) {
    const eyeSize = Math.max(2, Math.floor(size * 0.25));
    let leftEye = { x: 0, y: 0 };
    let rightEye = { x: 0, y: 0 };

    if (direction.name === 'UP') {
      leftEye = { x: hx + 2, y: hy + 2 };
      rightEye = { x: hx + size - eyeSize - 2, y: hy + 2 };
    } else if (direction.name === 'DOWN') {
      leftEye = { x: hx + size - eyeSize - 2, y: hy + size - eyeSize - 2 };
      rightEye = { x: hx + 2, y: hy + size - eyeSize - 2 };
    } else if (direction.name === 'LEFT') {
      leftEye = { x: hx + 2, y: hy + size - eyeSize - 2 };
      rightEye = { x: hx + 2, y: hy + 2 };
    } else { // RIGHT
      leftEye = { x: hx + size - eyeSize - 2, y: hy + 2 };
      rightEye = { x: hx + size - eyeSize - 2, y: hy + size - eyeSize - 2 };
    }

    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(leftEye.x, leftEye.y, eyeSize, eyeSize);
    ctx.fillRect(rightEye.x, rightEye.y, eyeSize, eyeSize);
  }

  /**
   * Helper to draw a rounded rectangle.
   * @private
   */
  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draws retro eyes on the snake head.
   * @private
   */
  _drawEyes(ctx, hx, hy, size, direction, status) {
    ctx.save();
    ctx.shadowBlur = 0;

    const eyeRadius = Math.max(1.5, size * 0.16);
    const pupilRadius = Math.max(1, size * 0.08);

    let leftEye = { x: 0, y: 0 };
    let rightEye = { x: 0, y: 0 };

    if (direction.name === 'UP') {
      leftEye = { x: hx + size * 0.28, y: hy + size * 0.28 };
      rightEye = { x: hx + size * 0.72, y: hy + size * 0.28 };
    } else if (direction.name === 'DOWN') {
      leftEye = { x: hx + size * 0.72, y: hy + size * 0.72 };
      rightEye = { x: hx + size * 0.28, y: hy + size * 0.72 };
    } else if (direction.name === 'LEFT') {
      leftEye = { x: hx + size * 0.28, y: hy + size * 0.72 };
      rightEye = { x: hx + size * 0.28, y: hy + size * 0.28 };
    } else { // RIGHT
      leftEye = { x: hx + size * 0.72, y: hy + size * 0.28 };
      rightEye = { x: hx + size * 0.72, y: hy + size * 0.72 };
    }

    // Draw eye whites
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw pupils (or X if game over)
    if (status === 'GAME_OVER') {
      ctx.strokeStyle = '#991B1B';
      ctx.lineWidth = 1.5;
      [leftEye, rightEye].forEach(eye => {
        ctx.beginPath();
        ctx.moveTo(eye.x - 2, eye.y - 2);
        ctx.lineTo(eye.x + 2, eye.y + 2);
        ctx.moveTo(eye.x + 2, eye.y - 2);
        ctx.lineTo(eye.x - 2, eye.y + 2);
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = '#0F172A';
      const pupilShiftX = direction.x * (pupilRadius * 0.6);
      const pupilShiftY = direction.y * (pupilRadius * 0.6);
      ctx.beginPath();
      ctx.arc(leftEye.x + pupilShiftX, leftEye.y + pupilShiftY, pupilRadius, 0, Math.PI * 2);
      ctx.arc(rightEye.x + pupilShiftX, rightEye.y + pupilShiftY, pupilRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draws active particle sparks.
   * @private
   */
  _drawParticles(ctx) {
    if (this.particles.length === 0) return;

    ctx.save();
    this._updateParticles();

    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
