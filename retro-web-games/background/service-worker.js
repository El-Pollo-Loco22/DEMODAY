// background/service-worker.js (MV3 Service Worker, type: module)
/* global chrome */

console.log('[RWG][sw] Service worker starting...');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[RWG][sw] onInstalled', details);
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[RWG][sw] onStartup');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('[RWG][sw] onMessage', { message, sender });
    if (message?.type === 'RWG_PING') {
      sendResponse({ ok: true, ts: Date.now() });
      return true; // async safe
    }
  } catch (err) {
    console.error('[RWG][sw] Error handling message', err);
    sendResponse({ ok: false, error: String(err) });
  }
  return false;
});


