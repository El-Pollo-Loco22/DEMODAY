// content/content.js - Injected on all pages. Listens to messages and shows test overlay.
/* global chrome, RWGEngine */

console.log('[RWG][content] content.js loaded on', location.href);

// Retro Snake - page-themed and safe-area aware
function startSnakeGame() {
  try {
    if (window.__RWG_SNAKE_ACTIVE__) {
      console.log('[RWG][content] Snake already running');
      return;
    }
    const { canvas, removeOverlay } = window.RWGEngine.createFullscreenCanvasOverlay();
    const ctx = canvas.getContext('2d');
    let theme = window.RWGEngine.getPageTheme();
    // Use full viewport as the play area boundaries
    let safeRect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    window.__RWG_SNAKE_ACTIVE__ = true;

    // Grid sizing derived from safe area to look native
    const cellSize = 18; // compact to fit most layouts
    function computeGrid() {
      // Recompute to the current viewport size on every call
      safeRect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      const cols = Math.max(10, Math.floor(safeRect.width / cellSize));
      const rows = Math.max(10, Math.floor(safeRect.height / cellSize));
      const gridWidth = cols * cellSize;
      const gridHeight = rows * cellSize;
      const offsetX = Math.floor(safeRect.x + (safeRect.width - gridWidth) / 2);
      const offsetY = Math.floor(safeRect.y + (safeRect.height - gridHeight) / 2);
      // Build obstacles from prominent DOM elements, filtered and padded
      const rawRects = window.RWGEngine.getDomObstacleRects(safeRect) || [];
      const viewArea = Math.max(1, safeRect.width * safeRect.height);
      const filtered = rawRects
        .filter(r => {
          const area = r.width * r.height;
          // ignore tiny specks and huge full-screen elements
          return area > 800 && area < viewArea * 0.33;
        })
        .slice(0, 30);
      const pad = 6; // shrink to make collisions fair
      const obstacles = filtered.map(r => {
        const gx = Math.max(0, Math.floor((r.x + pad - offsetX) / cellSize));
        const gy = Math.max(0, Math.floor((r.y + pad - offsetY) / cellSize));
        const gw = Math.max(0, Math.ceil((r.width - pad * 2) / cellSize));
        const gh = Math.max(0, Math.ceil((r.height - pad * 2) / cellSize));
        return { x: gx, y: gy, w: gw, h: gh };
      }).filter(o => o.w > 0 && o.h > 0);
      return { cols, rows, gridWidth, gridHeight, offsetX, offsetY, obstacles };
    }

    let grid = computeGrid();
    // Dynamic obstacles that grow with score (grid coordinates)
    let dynamicObstacles = [];
    grid.obstacles = [...grid.obstacles, ...dynamicObstacles];

    function randomFood(snakeCells) {
      let x, y;
      const domPoints = window.RWGEngine.getDomFoodPoints(safeRect);
      const candidates = domPoints.map(p => ({
        x: Math.max(0, Math.min(grid.cols - 1, Math.floor((p.x - grid.offsetX) / cellSize))),
        y: Math.max(0, Math.min(grid.rows - 1, Math.floor((p.y - grid.offsetY) / cellSize)))
      }));
      let tries = 0;
      do {
        if (candidates.length && tries < candidates.length * 2) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          x = pick.x; y = pick.y;
        } else {
          x = Math.floor(Math.random() * grid.cols);
          y = Math.floor(Math.random() * grid.rows);
        }
        tries++;
      } while (
        snakeCells.some(s => s.x === x && s.y === y) ||
        grid.obstacles?.some(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)
      );
      return { x, y };
    }

    // Initial snake: choose a free cell away from edges and obstacles
    function cellBlocked(x, y, obstacles) {
      return obstacles?.some(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
    }
    function findSafeCell() {
      const minX = 2, minY = 2, maxX = grid.cols - 3, maxY = grid.rows - 3;
      const cx = Math.max(minX, Math.min(maxX, Math.floor(grid.cols / 2)));
      const cy = Math.max(minY, Math.min(maxY, Math.floor(grid.rows / 2)));
      if (!cellBlocked(cx, cy, grid.obstacles)) return { x: cx, y: cy };
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (!cellBlocked(x, y, grid.obstacles)) return { x, y };
        }
      }
      return { x: cx, y: cy };
    }
    const spawn = findSafeCell();
    const startX = spawn.x;
    const startY = spawn.y;
    let state = {
      running: true,
      gameOver: false,
      paused: false,
      score: 0,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      stepMs: 120,
      lastStep: performance.now(),
      cells: [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
      ],
      food: { x: startX + 4, y: startY },
      theme,
      grid,
      dynamicObstacles,
      nextObstacleAtScore: 30
    };

    // Spawn a new rectangular obstacle in grid space at score milestones
    function maybeAddObstacle() {
      if (state.score < state.nextObstacleAtScore) return;
      const maxW = Math.max(2, Math.floor(grid.cols * 0.12));
      const maxH = Math.max(2, Math.floor(grid.rows * 0.12));
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      for (let attempt = 0; attempt < 50; attempt++) {
        const w = clamp(2 + Math.floor(Math.random() * maxW), 2, Math.max(2, maxW));
        const h = clamp(2 + Math.floor(Math.random() * maxH), 2, Math.max(2, maxH));
        const x = 1 + Math.floor(Math.random() * Math.max(1, grid.cols - w - 2));
        const y = 1 + Math.floor(Math.random() * Math.max(1, grid.rows - h - 2));
        const o = { x, y, w, h };
        // reject if overlaps snake, food, or existing obstacles
        const overlapsCell = state.cells.some(c => c.x >= o.x && c.x < o.x + o.w && c.y >= o.y && c.y < o.y + o.h);
        const overlapsFood = (state.food.x >= o.x && state.food.x < o.x + o.w && state.food.y >= o.y && state.food.y < o.y + o.h);
        const overlapsExisting = grid.obstacles?.some(ox => !(o.x + o.w <= ox.x || ox.x + ox.w <= o.x || o.y + o.h <= ox.y || ox.y + ox.h <= o.y));
        if (!overlapsCell && !overlapsFood && !overlapsExisting) {
          state.dynamicObstacles.push(o);
          grid.obstacles.push(o);
          // Increase the next threshold incrementally to avoid too many too fast
          state.nextObstacleAtScore += 30;
          break;
        }
      }
    }

    state.food = randomFood(state.cells);

    function onKey(e) {
      if (e.key === 'Escape') {
        state.running = false;
        removeOverlay?.();
        window.removeEventListener('keydown', onKey);
        window.__RWG_SNAKE_ACTIVE__ = false;
        return;
      }
      if (state.gameOver) {
        if (e.key === 'Enter' || e.key === ' ') {
          // Restart
          theme = window.RWGEngine.getPageTheme();
          grid = computeGrid();
          const sx = Math.floor(grid.cols / 2);
          const sy = Math.floor(grid.rows / 2);
          state = {
            running: true,
            gameOver: false,
            paused: false,
            score: 0,
            dir: { x: 1, y: 0 },
            nextDir: { x: 1, y: 0 },
            stepMs: 120,
            lastStep: performance.now(),
            cells: [ { x: sx, y: sy }, { x: sx - 1, y: sy }, { x: sx - 2, y: sy } ],
            food: randomFood([]),
            theme,
            grid
          };
          state.food = randomFood(state.cells);
        }
        return;
      }
      const k = e.key;
      if (k === 'p' || k === 'P') {
        state.paused = !state.paused;
        return;
      }
      // Direction changes; prevent direct reversal
      if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        if (state.dir.y !== 1) state.nextDir = { x: 0, y: -1 };
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        if (state.dir.y !== -1) state.nextDir = { x: 0, y: 1 };
      } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        if (state.dir.x !== 1) state.nextDir = { x: -1, y: 0 };
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        if (state.dir.x !== -1) state.nextDir = { x: 1, y: 0 };
      }
    }
    window.addEventListener('keydown', onKey);

    function update(now) {
      // On resize, recompute layout/theme to remain integrated
      const newGrid = computeGrid();
      // Merge dynamic obstacles each recompute
      newGrid.obstacles = [...newGrid.obstacles, ...state.dynamicObstacles];
      if (newGrid.cols !== grid.cols || newGrid.rows !== grid.rows || newGrid.offsetX !== grid.offsetX || newGrid.offsetY !== grid.offsetY) {
        grid = newGrid;
        state.grid = grid;
        // Clamp snake within bounds
        state.cells.forEach(c => {
          c.x = Math.max(0, Math.min(grid.cols - 1, c.x));
          c.y = Math.max(0, Math.min(grid.rows - 1, c.y));
        });
        state.food.x = Math.max(0, Math.min(grid.cols - 1, state.food.x));
        state.food.y = Math.max(0, Math.min(grid.rows - 1, state.food.y));
      }

      if (state.paused || state.gameOver) return;
      if (now - state.lastStep < state.stepMs) return;
      state.lastStep = now;
      state.dir = state.nextDir;

      const head = state.cells[0];
      const nx = head.x + state.dir.x;
      const ny = head.y + state.dir.y;

      // Wall collision
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) {
        state.gameOver = true;
        return;
      }

      // Obstacle collision
      if (grid.obstacles?.some(o => nx >= o.x && nx < o.x + o.w && ny >= o.y && ny < o.y + o.h)) {
        state.gameOver = true;
        return;
      }

      // Self collision
      if (state.cells.some((c, idx) => idx > 0 && c.x === nx && c.y === ny)) {
        state.gameOver = true;
        return;
      }

      // Advance
      state.cells.unshift({ x: nx, y: ny });
      if (nx === state.food.x && ny === state.food.y) {
        state.score += 10;
        state.food = randomFood(state.cells);
        // Increase speed more aggressively as points are collected
        state.stepMs = Math.max(40, state.stepMs - 4);
        // Add obstacles as score milestones are reached
        maybeAddObstacle();
      } else {
        state.cells.pop();
      }
    }

    function render() {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Clip to safe grid area
      ctx.save();
      ctx.beginPath();
      ctx.rect(grid.offsetX, grid.offsetY, grid.gridWidth, grid.gridHeight);
      ctx.clip();

      // Subtle grid lines adopting site palette
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      if (theme.backgroundColor && theme.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      }
      ctx.lineWidth = 1;
      for (let x = 0; x <= grid.cols; x += 1) {
        const px = grid.offsetX + x * cellSize + 0.5;
        ctx.beginPath(); ctx.moveTo(px, grid.offsetY); ctx.lineTo(px, grid.offsetY + grid.gridHeight); ctx.stroke();
      }
      for (let y = 0; y <= grid.rows; y += 1) {
        const py = grid.offsetY + y * cellSize + 0.5;
        ctx.beginPath(); ctx.moveTo(grid.offsetX, py); ctx.lineTo(grid.offsetX + grid.gridWidth, py); ctx.stroke();
      }

      // Retro scanlines overlay inside playfield
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#000';
      for (let y = grid.offsetY; y < grid.offsetY + grid.gridHeight; y += 3) {
        ctx.fillRect(grid.offsetX, y, grid.gridWidth, 1);
      }
      ctx.globalAlpha = 1;

      // Food
      ctx.fillStyle = state.theme.accentColor || '#ffcc00';
      ctx.fillRect(grid.offsetX + state.food.x * cellSize, grid.offsetY + state.food.y * cellSize, cellSize, cellSize);

      // Snake
      ctx.fillStyle = state.theme.primaryColor || '#00ff99';
      for (let i = state.cells.length - 1; i >= 0; i--) {
        const c = state.cells[i];
        const alpha = i === 0 ? 1 : Math.max(0.5, 1 - i * 0.03);
        ctx.globalAlpha = alpha;
        ctx.fillRect(grid.offsetX + c.x * cellSize, grid.offsetY + c.y * cellSize, cellSize, cellSize);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Obstacles (div boxes as obstacles)
      if (grid.obstacles && grid.obstacles.length) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 64, 64, 0.28)';
        ctx.strokeStyle = 'rgba(255, 64, 64, 0.95)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,64,64,0.8)';
        ctx.shadowBlur = 8;
        grid.obstacles.forEach(o => {
          const x = grid.offsetX + o.x * cellSize;
          const y = grid.offsetY + o.y * cellSize;
          const w = o.w * cellSize;
          const h = o.h * cellSize;
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        });
        ctx.restore();
      }

      // Bold playfield border with glow
      ctx.save();
      ctx.strokeStyle = theme.primaryColor || '#00ff99';
      ctx.lineWidth = 3;
      ctx.shadowColor = theme.primaryColor || '#00ff99';
      ctx.shadowBlur = 10;
      ctx.strokeRect(grid.offsetX + 0.5, grid.offsetY + 0.5, grid.gridWidth - 1, grid.gridHeight - 1);
      ctx.restore();

      // Checkered viewport border (entire visible canvas)
      ctx.save();
      const borderSize = 6;
      const dash = 16;
      const gap = 12;
      const colorA = theme.accentColor || '#ffcc00';
      const colorB = theme.primaryColor || '#00ff99';
      // Subtle exterior glow
      ctx.shadowColor = colorA;
      ctx.shadowBlur = 8;
      // Top and bottom edges
      for (let x = 0; x < ctx.canvas.width; x += dash + gap) {
        ctx.fillStyle = ((Math.floor(x / (dash + gap)) % 2) === 0) ? colorA : colorB;
        ctx.fillRect(x, 0, dash, borderSize);
        ctx.fillRect(x, ctx.canvas.height - borderSize, dash, borderSize);
      }
      // Left and right edges
      for (let y = 0; y < ctx.canvas.height; y += dash + gap) {
        ctx.fillStyle = ((Math.floor(y / (dash + gap)) % 2) === 0) ? colorB : colorA;
        ctx.fillRect(0, y, borderSize, dash);
        ctx.fillRect(ctx.canvas.width - borderSize, y, borderSize, dash);
      }
      ctx.restore();

      // Retro scoreboard panel for better visibility
      const panelX = grid.offsetX;
      const panelY = Math.max(8, grid.offsetY - 36);
      const panelW = 160;
      const panelH = 28;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeStyle = colorA;
      ctx.lineWidth = 2;
      ctx.shadowColor = colorB;
      ctx.shadowBlur = 8;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
      ctx.fillStyle = state.theme.textColor || '#ffffff';
      ctx.font = `bold 16px ${state.theme.fontFamily || 'monospace'}`;
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${state.score}`, panelX + 10, panelY + 19);
      ctx.restore();

      if (state.paused) {
        window.RWGEngine.drawCenteredMessage(ctx, 'Paused');
      }
      if (state.gameOver) {
        window.RWGEngine.drawCenteredMessage(ctx, 'Game Over');
        ctx.fillStyle = state.theme.primaryColor || '#9fffd6';
        ctx.font = `14px ${state.theme.fontFamily || 'monospace'}`;
        ctx.textAlign = 'center';
        ctx.fillText('Press Enter to restart, Esc to exit', grid.offsetX + grid.gridWidth / 2, grid.offsetY + grid.gridHeight / 2 + 40);
      }
    }

    // Main loop (fixed-step update via accumulator)
    let last = performance.now();
    function frame(now) {
      if (!state.running) return;
      theme = window.RWGEngine.getPageTheme();
      state.theme = theme;
      update(now);
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (err) {
    console.error('[RWG][content] Failed to start snake', err);
  }
}

function startGame() {
  try {
    const { canvas, removeOverlay } = window.RWGEngine.createFullscreenCanvasOverlay();
    const ctx = canvas.getContext('2d');
    const theme = window.RWGEngine.getPageTheme();
    // Use full viewport as the play area boundaries
    const safeRect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };

    // Game state
    let gameState = {
      running: true,
      score: 0,
      player: { x: safeRect.x + safeRect.width / 2, y: safeRect.y + safeRect.height - 50, width: 40, height: 20 },
      enemies: [],
      bullets: [],
      lastEnemySpawn: 0,
      keys: {},
      theme,
      safeRect
    };

    // Input handling
    const keyHandler = (e) => {
      gameState.keys[e.key] = e.type === 'keydown';
      if (e.key === 'Escape') {
        gameState.running = false;
        removeOverlay?.();
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('keyup', keyHandler);
      }
    };
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('keyup', keyHandler);

    // Game loop
    let lastTime = performance.now();
    function gameLoop(currentTime) {
      if (!gameState.running) return;
      
      const deltaTime = Math.min(33, currentTime - lastTime);
      lastTime = currentTime;

      // Update game state
      updateGame(gameState, deltaTime, canvas);
      
      // Render
      renderGame(ctx, gameState);

      requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);

  } catch (err) {
    console.error('[RWG][content] Failed to start game', err);
  }
}

// --- Snake helpers for dynamic difficulty ---
function maybeAddObstacle() {
  try {
    // Access state via closure in startSnakeGame
    // This function is defined outside but used inside; guard if not available
    if (!window.__RWG_SNAKE_ACTIVE__) return;
  } catch (_) {
    // no-op
  }
}

function updateGame(state, deltaTime, canvas) {
  // Move player
  if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) {
    state.player.x = Math.max(state.safeRect.x, state.player.x - 5);
  }
  if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) {
    state.player.x = Math.min(state.player.x + 5, state.safeRect.x + state.safeRect.width - state.player.width);
  }
  if (state.keys['ArrowUp'] || state.keys['w'] || state.keys['W']) {
    state.player.y = Math.max(state.safeRect.y, state.player.y - 5);
  }
  if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) {
    state.player.y = Math.min(state.player.y + 5, state.safeRect.y + state.safeRect.height - state.player.height);
  }

  // Shoot bullets
  if (state.keys[' ']) { // Spacebar
    const now = performance.now();
    if (now - (state.lastShot || 0) > 200) { // Rate limit
      state.bullets.push({
        x: state.player.x + state.player.width / 2,
        y: state.player.y,
        width: 4,
        height: 10,
        speed: 8
      });
      state.lastShot = now;
    }
  }

  // Spawn enemies
  const now = performance.now();
  if (now - state.lastEnemySpawn > 1000) { // Every second
    const anchor = window.RWGEngine.getRandomInterestingPoint(state.safeRect);
    state.enemies.push({
      x: Math.max(state.safeRect.x, Math.min(state.safeRect.x + state.safeRect.width - 30, anchor.x - 15)),
      y: Math.max(state.safeRect.y - 40, state.safeRect.y) - 30,
      width: 30,
      height: 30,
      speed: 2 + Math.random() * 2
    });
    state.lastEnemySpawn = now;
  }

  // Update bullets
  state.bullets = state.bullets.filter(bullet => {
    bullet.y -= bullet.speed;
    return bullet.y > -bullet.height;
  });

  // Update enemies
  state.enemies = state.enemies.filter(enemy => {
    enemy.y += enemy.speed;
    return enemy.y < state.safeRect.y + state.safeRect.height;
  });

  // Collision detection
  state.bullets.forEach((bullet, bulletIndex) => {
    state.enemies.forEach((enemy, enemyIndex) => {
      if (bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y) {
        // Collision!
        state.bullets.splice(bulletIndex, 1);
        state.enemies.splice(enemyIndex, 1);
        state.score += 10;
      }
    });
  });

  // Check game over
  state.enemies.forEach(enemy => {
    if (enemy.y + enemy.height > state.player.y &&
        enemy.x < state.player.x + state.player.width &&
        enemy.x + enemy.width > state.player.x) {
      state.running = false;
    }
  });
}

function renderGame(ctx, state) {
  // Clear canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw grid themed and clipped to safe area
  ctx.save();
  ctx.beginPath();
  ctx.rect(state.safeRect.x, state.safeRect.y, state.safeRect.width, state.safeRect.height);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,255,153,0.10)';
  ctx.lineWidth = 1;
  for (let x = state.safeRect.x; x < state.safeRect.x + state.safeRect.width; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, state.safeRect.y); ctx.lineTo(x, state.safeRect.y + state.safeRect.height); ctx.stroke();
  }
  for (let y = state.safeRect.y; y < state.safeRect.y + state.safeRect.height; y += 24) {
    ctx.beginPath(); ctx.moveTo(state.safeRect.x, y); ctx.lineTo(state.safeRect.x + state.safeRect.width, y); ctx.stroke();
  }
  ctx.restore();

  // Draw player
  ctx.fillStyle = state.theme.primaryColor || '#00ff99';
  ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);

  // Draw bullets
  ctx.fillStyle = state.theme.accentColor || '#ffff00';
  state.bullets.forEach(bullet => {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  // Draw enemies
  ctx.fillStyle = 'rgba(255, 0, 102, 0.9)';
  state.enemies.forEach(enemy => {
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });

  // Draw score
  ctx.fillStyle = state.theme.textColor || '#ffffff';
  ctx.font = `20px ${state.theme.fontFamily || 'monospace'}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${state.score}`, state.safeRect.x + 12, state.safeRect.y + 24);

  // Draw instructions
  ctx.fillStyle = state.theme.primaryColor || '#9fffd6';
  ctx.font = `14px ${state.theme.fontFamily || 'monospace'}`;
  ctx.textAlign = 'center';
  ctx.fillText('Use WASD/Arrows to move, Space to shoot', state.safeRect.x + state.safeRect.width / 2, state.safeRect.y + state.safeRect.height - 10);
}

function showTestOverlay() {
  try {
    const { canvas, removeOverlay } = window.RWGEngine.createFullscreenCanvasOverlay();
    const ctx = canvas.getContext('2d');

    let running = true;
    let last = performance.now();
    let t = 0;

    function frame(now) {
      if (!running) return;
      const dt = Math.min(33, now - last);
      last = now;
      t += dt;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Retro grid background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(0,255,153,0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      window.RWGEngine.drawCenteredMessage(ctx, 'Retro Web Games Ready');
      ctx.fillStyle = '#9fffd6';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press Esc to close', canvas.width / 2, canvas.height / 2 + 40);

      if (running) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const escClose = (e) => {
      if (e.key === 'Escape') {
        running = false;
        removeOverlay?.();
        window.removeEventListener('keydown', escClose);
      }
    };
    window.addEventListener('keydown', escClose);
  } catch (err) {
    console.error('[RWG][content] Failed to show overlay', err);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message?.type === 'RWG_START_GAME') {
      console.log('[RWG][content] Received RWG_START_GAME');
      startSnakeGame();
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === 'RWG_TEST_OVERLAY') {
      console.log('[RWG][content] Received RWG_TEST_OVERLAY');
      showTestOverlay();
      sendResponse({ ok: true });
      return true;
    }
  } catch (err) {
    console.error('[RWG][content] Error in onMessage', err);
    sendResponse({ ok: false, error: String(err) });
  }
  return false;
});


