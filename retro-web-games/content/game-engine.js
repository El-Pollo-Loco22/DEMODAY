// content/game-engine.js - shared overlay utilities used by games/content script
/* global chrome */

console.log('[RWG][engine] game-engine.js loaded');

// MV3 content scripts are classic scripts (no ESM). Expose API on window.
window.RWGEngine = window.RWGEngine || {};

function createFullscreenCanvasOverlay() {
  // If overlay already exists, reuse it
  let overlay = document.getElementById('rwg-overlay');
  if (overlay) {
    console.log('[RWG][engine] Reusing existing overlay');
    return { overlay, canvas: overlay.querySelector('canvas') };
  }

  overlay = document.createElement('div');
  overlay.id = 'rwg-overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '2147483647'; // max
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.cursor = 'none';

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';

  overlay.appendChild(canvas);
  document.documentElement.appendChild(overlay);

  // Esc to close overlay
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      removeOverlay();
    }
  };
  document.addEventListener('keydown', escHandler, { once: true });

  function removeOverlay() {
    console.log('[RWG][engine] Removing overlay');
    if (overlay?.parentElement) overlay.parentElement.removeChild(overlay);
  }

  // Resize handling
  const resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeHandler);

  // Return helpers to caller
  return { overlay, canvas, removeOverlay, resizeHandler };
}

function drawCenteredMessage(ctx, text) {
  ctx.save();
  ctx.fillStyle = '#00ff99';
  ctx.strokeStyle = '#003322';
  ctx.lineWidth = 4;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = ctx.canvas.width / 2;
  const y = ctx.canvas.height / 2;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Attach to global
window.RWGEngine.createFullscreenCanvasOverlay = createFullscreenCanvasOverlay;
window.RWGEngine.drawCenteredMessage = drawCenteredMessage;


