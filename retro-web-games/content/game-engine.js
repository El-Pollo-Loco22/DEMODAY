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
  // Transparent to let the page show through; drawing uses blend for retro look
  overlay.style.background = 'transparent';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.cursor = 'none';
  // Do not block interactions on the page beneath
  overlay.style.pointerEvents = 'none';

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';
  // Blend drawings with the page to feel integrated
  canvas.style.mixBlendMode = 'screen';

  overlay.appendChild(canvas);
  document.documentElement.appendChild(overlay);

  // --- Scroll lock while overlay is active ---
  const html = document.documentElement;
  const body = document.body || html;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevHtmlOverscroll = html.style.overscrollBehavior;
  const prevBodyOverscroll = body.style.overscrollBehavior;
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'contain';
  body.style.overscrollBehavior = 'contain';

  const preventScrollKeys = (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (keys.includes(e.key)) {
      e.preventDefault();
    }
  };
  const wheelBlocker = (e) => { e.preventDefault(); };
  const touchBlocker = (e) => { e.preventDefault(); };
  window.addEventListener('keydown', preventScrollKeys, { capture: true });
  window.addEventListener('wheel', wheelBlocker, { passive: false, capture: true });
  window.addEventListener('touchmove', touchBlocker, { passive: false, capture: true });

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
    // Restore scroll behavior and remove blockers
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    html.style.overscrollBehavior = prevHtmlOverscroll;
    body.style.overscrollBehavior = prevBodyOverscroll;
    window.removeEventListener('keydown', preventScrollKeys, { capture: true });
    window.removeEventListener('wheel', wheelBlocker, { capture: true });
    window.removeEventListener('touchmove', touchBlocker, { capture: true });
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

// --- Page-aware utilities ---
function getPageTheme() {
  try {
    const root = document.documentElement;
    const body = document.body || root;
    const csBody = getComputedStyle(body);
    const csRoot = getComputedStyle(root);

    // Helpers to probe common thematic elements
    const pickColor = () => {
      const link = document.querySelector('a[href]');
      if (link) return getComputedStyle(link).color;
      const btn = document.querySelector('button, [role="button"], input[type="submit"], input[type="button"], .btn, .button');
      if (btn) {
        const cs = getComputedStyle(btn);
        return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : cs.color;
      }
      const h = document.querySelector('h1, h2, h3');
      if (h) return getComputedStyle(h).color;
      return '#00ff99';
    };

    const pickAccent = () => {
      const sel = document.querySelector('mark, .tag, .chip, .badge');
      if (sel) {
        const cs = getComputedStyle(sel);
        return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : cs.color;
      }
      const input = document.querySelector('input:focus, textarea:focus, select:focus');
      if (input) return getComputedStyle(input).outlineColor || getComputedStyle(input).borderColor;
      return '#ffcc00';
    };

    const backgroundColor = csBody.backgroundColor || csRoot.backgroundColor || '#0a0a0a';
    const textColor = csBody.color || '#ffffff';
    const primaryColor = csRoot.getPropertyValue('--color-primary').trim() || csRoot.getPropertyValue('--primary').trim() || pickColor();
    const accentColor = csRoot.getPropertyValue('--color-accent').trim() || csRoot.getPropertyValue('--accent').trim() || pickAccent();
    const fontFamily = csBody.fontFamily && csBody.fontFamily !== '""' ? csBody.fontFamily : 'monospace';

    return { backgroundColor, textColor, primaryColor, accentColor, fontFamily };
  } catch (e) {
    console.warn('[RWG][engine] getPageTheme failed', e);
    return { backgroundColor: '#0a0a0a', textColor: '#ffffff', primaryColor: '#00ff99', accentColor: '#ffcc00', fontFamily: 'monospace' };
  }
}

function getSafeContentRect() {
  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Heuristic: subtract fixed headers/footers occupying full width
    let topInset = 0;
    let bottomInset = 0;
    const els = Array.from(document.querySelectorAll('*'));
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden') {
        const rect = el.getBoundingClientRect();
        // Full-width header near the top
        if (rect.top <= 1 && rect.height > 40 && rect.width >= vw * 0.9) {
          topInset = Math.max(topInset, rect.bottom);
        }
        // Full-width footer near the bottom
        if (vh - rect.bottom <= 1 && rect.height > 40 && rect.width >= vw * 0.9) {
          bottomInset = Math.max(bottomInset, rect.height);
        }
      }
    }

    // Prefer semantic main/content containers if available
    const main = document.querySelector('main, #main, #content, .content, .container');
    if (main) {
      const r = main.getBoundingClientRect();
      const top = Math.max(topInset, Math.max(0, r.top));
      const left = Math.max(0, r.left);
      const right = Math.min(vw, r.right);
      const bottom = Math.min(vh - bottomInset, r.bottom);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);
      if (width >= 200 && height >= 120) return { x: left, y: top, width, height };
    }

    const x = 0;
    const y = Math.min(topInset + 8, vh * 0.25);
    const width = vw;
    const height = Math.max(120, vh - bottomInset - y - 8);
    return { x, y, width, height };
  } catch (e) {
    console.warn('[RWG][engine] getSafeContentRect failed', e);
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  }
}

function getRandomInterestingPoint(safeRect) {
  try {
    const rect = safeRect || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    const candidates = Array.from(document.querySelectorAll('a[href], img, h1, h2, h3'))
      .map(el => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 8 && rect.height > 8 &&
        rect.right > rect.left && rect.bottom > rect.top &&
        rect.right > rect.left &&
        rect.left < rect.x + rect.width &&
        rect.top < rect.y + rect.height)
      .filter(({ rect }) => rect.left < rect.x + rect.width && rect.right > rect.x && rect.top < rect.y + rect.height && rect.bottom > rect.y);

    if (candidates.length) {
      const { rect: r } = candidates[Math.floor(Math.random() * candidates.length)];
      const cx = Math.max(rect.x, Math.min(rect.x + rect.width, r.left + r.width / 2));
      const cy = Math.max(rect.y, Math.min(rect.y + rect.height, r.top + r.height / 2));
      return { x: cx, y: cy };
    }
    return { x: rect.x + Math.random() * rect.width, y: rect.y + Math.random() * rect.height };
  } catch (e) {
    return { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight };
  }
}

function getDomObstacleRects(safeRect) {
  try {
    const rect = safeRect || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Consider fixed sidebars, sticky elements, and prominent cards as obstacles
    const elements = Array.from(document.querySelectorAll('*')).slice(0, 2500);
    const obstacles = [];
    for (const el of elements) {
      if (el.id === 'rwg-overlay' || el.closest('#rwg-overlay')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      const pos = cs.position;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      // accept: fixed/sticky/absolute OR visible div blocks within safe area
      const isFixedLike = (pos === 'fixed' || pos === 'sticky' || pos === 'absolute');
      const isProminentDiv = (el.tagName === 'DIV' && (parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)'));
      if (!isFixedLike && !isProminentDiv) continue;
      // must intersect safe rect
      const ix = Math.max(rect.x, r.left);
      const iy = Math.max(rect.y, r.top);
      const ax = Math.min(rect.x + rect.width, r.right);
      const ay = Math.min(rect.y + rect.height, r.bottom);
      if (ix < ax && iy < ay) {
        obstacles.push({ x: Math.max(rect.x, r.left), y: Math.max(rect.y, r.top), width: Math.min(rect.x + rect.width, r.right) - Math.max(rect.x, r.left), height: Math.min(rect.y + rect.height, r.bottom) - Math.max(rect.y, r.top) });
      }
    }
    return obstacles;
  } catch (e) {
    console.warn('[RWG][engine] getDomObstacleRects failed', e);
    return [];
  }
}

function getDomFoodPoints(safeRect) {
  try {
    const rect = safeRect || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    const selectors = 'a[href], button, [role="button"], .btn, img, .badge, .chip, .tag, mark, h1, h2, h3';
    const points = [];
    Array.from(document.querySelectorAll(selectors)).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height) {
        points.push({ x: cx, y: cy });
      }
    });
    return points;
  } catch (e) {
    console.warn('[RWG][engine] getDomFoodPoints failed', e);
    return [];
  }
}

// Attach to global
window.RWGEngine.createFullscreenCanvasOverlay = createFullscreenCanvasOverlay;
window.RWGEngine.drawCenteredMessage = drawCenteredMessage;
window.RWGEngine.getPageTheme = getPageTheme;
window.RWGEngine.getSafeContentRect = getSafeContentRect;
window.RWGEngine.getRandomInterestingPoint = getRandomInterestingPoint;
window.RWGEngine.getDomObstacleRects = getDomObstacleRects;
window.RWGEngine.getDomFoodPoints = getDomFoodPoints;


