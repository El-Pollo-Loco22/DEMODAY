// popup.js - basic PIN storage and overlay test trigger
/* global chrome */

console.log('[RWG][popup] Loaded popup.js');

const pinInput = document.getElementById('pin');
const saveBtn = document.getElementById('savePin');
const testOverlayBtn = document.getElementById('testOverlay');
const pinStatus = document.getElementById('pinStatus');
const openSwLogsBtn = document.getElementById('openSwLogs');

async function loadPin() {
  try {
    const { rwg_group_pin } = await chrome.storage.local.get('rwg_group_pin');
    if (typeof rwg_group_pin === 'string') {
      pinInput.value = rwg_group_pin;
      pinStatus.textContent = 'Loaded saved PIN from storage.';
    } else {
      pinStatus.textContent = 'Enter your 6-digit group PIN.';
    }
  } catch (err) {
    console.error('[RWG][popup] Failed to load PIN', err);
    pinStatus.textContent = 'Error loading PIN (see console).';
  }
}

async function savePin() {
  const value = pinInput.value.trim();
  if (!/^\d{6}$/.test(value)) {
    pinStatus.textContent = 'PIN must be exactly 6 digits.';
    return;
  }
  try {
    await chrome.storage.local.set({ rwg_group_pin: value });
    console.log('[RWG][popup] Saved PIN');
    pinStatus.textContent = 'PIN saved!';
  } catch (err) {
    console.error('[RWG][popup] Failed to save PIN', err);
    pinStatus.textContent = 'Error saving PIN (see console).';
  }
}

async function testOverlay() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      pinStatus.textContent = 'No active tab found.';
      return;
    }
    // Some URLs (chrome://, chromewebstore) disallow content scripts
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
      pinStatus.textContent = 'Cannot inject into this page. Try a normal website.';
      return;
    }
    console.log('[RWG][popup] Sending test overlay message to tab', tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'RWG_TEST_OVERLAY' });
    console.log('[RWG][popup] Content response:', response);
    pinStatus.textContent = 'Overlay requested. Press Esc to close it.';
  } catch (err) {
    console.error('[RWG][popup] Error sending message', err);
    pinStatus.textContent = 'Injection failed (see console).';
  }
}

async function openServiceWorkerLogs() {
  try {
    // A ping will cause logs to appear in sw console
    await chrome.runtime.sendMessage({ type: 'RWG_PING' });
    // The user must manually open extension service worker logs via chrome://extensions → Inspect views
    alert('To view Service Worker logs: chrome://extensions → "Retro Web Games" → Service Worker: Inspect');
  } catch (err) {
    console.error('[RWG][popup] Failed to ping service worker', err);
  }
}

document.addEventListener('DOMContentLoaded', loadPin);
saveBtn.addEventListener('click', savePin);
testOverlayBtn.addEventListener('click', testOverlay);
openSwLogsBtn.addEventListener('click', openServiceWorkerLogs);


