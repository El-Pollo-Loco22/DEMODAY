// content/content.js - Injected on all pages. Listens to messages and shows test overlay.
/* global chrome, RWGEngine */

console.log('[RWG][content] content.js loaded on', location.href);

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


