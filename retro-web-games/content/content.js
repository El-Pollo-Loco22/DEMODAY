// content/content.js - Injected on all pages. Listens to messages and shows test overlay.
/* global chrome, RWGEngine */

console.log('[RWG][content] content.js loaded on', location.href);

function startGame() {
  try {
    const { canvas, removeOverlay } = window.RWGEngine.createFullscreenCanvasOverlay();
    const ctx = canvas.getContext('2d');

    // Game state
    let gameState = {
      running: true,
      score: 0,
      player: { x: canvas.width / 2, y: canvas.height - 50, width: 40, height: 20 },
      enemies: [],
      bullets: [],
      lastEnemySpawn: 0,
      keys: {}
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

function updateGame(state, deltaTime, canvas) {
  // Move player
  if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) {
    state.player.x = Math.max(0, state.player.x - 5);
  }
  if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) {
    state.player.x = Math.min(state.player.x + 5, canvas.width - state.player.width);
  }
  if (state.keys['ArrowUp'] || state.keys['w'] || state.keys['W']) {
    state.player.y = Math.max(0, state.player.y - 5);
  }
  if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) {
    state.player.y = Math.min(state.player.y + 5, canvas.height - state.player.height);
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
    state.enemies.push({
      x: Math.random() * (canvas.width - 30),
      y: -30,
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
    return enemy.y < canvas.height;
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
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw grid
  ctx.strokeStyle = 'rgba(0,255,153,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < ctx.canvas.width; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ctx.canvas.height); ctx.stroke();
  }
  for (let y = 0; y < ctx.canvas.height; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
  }

  // Draw player
  ctx.fillStyle = '#00ff99';
  ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);

  // Draw bullets
  ctx.fillStyle = '#ffff00';
  state.bullets.forEach(bullet => {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  // Draw enemies
  ctx.fillStyle = '#ff0066';
  state.enemies.forEach(enemy => {
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });

  // Draw score
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${state.score}`, 20, 30);

  // Draw instructions
  ctx.fillStyle = '#9fffd6';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Use WASD or Arrow Keys to move, Space to shoot', ctx.canvas.width / 2, ctx.canvas.height - 20);
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
      startGame();
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


