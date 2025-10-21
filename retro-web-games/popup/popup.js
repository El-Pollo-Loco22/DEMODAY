// popup.js - basic PIN storage and overlay test trigger
/* global chrome */
import { saveSlackWebhookUrl, getSlackWebhookUrl, sendTestSlackMessage } from '../lib/slack.js';

console.log('[RWG][popup] Loaded popup.js');

const pinInput = document.getElementById('pin');
const saveBtn = document.getElementById('savePin');
const startGameBtn = document.getElementById('startGame');
const pinStatus = document.getElementById('pinStatus');
const openSwLogsBtn = document.getElementById('openSwLogs');
const slackWebhookInput = document.getElementById('slackWebhook');
const saveSlackBtn = document.getElementById('saveSlack');
const testSlackBtn = document.getElementById('testSlack');
const slackStatus = document.getElementById('slackStatus');

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

async function loadSlackWebhook() {
	try {
		const url = await getSlackWebhookUrl();
		if (url) {
			slackWebhookInput.value = url;
			slackStatus.textContent = 'Loaded Slack webhook URL.';
		} else {
			slackStatus.textContent = 'Paste your Slack Incoming Webhook URL and save it.';
		}
	} catch (err) {
		console.error('[RWG][popup] Failed to load Slack URL', err);
		slackStatus.textContent = 'Error loading Slack URL (see console).';
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

async function saveSlack() {
	const value = slackWebhookInput.value.trim();
	if (!value.startsWith('https://hooks.slack.com/')) {
		slackStatus.textContent = 'Enter a valid Slack webhook URL.';
		return;
	}
	try {
		await saveSlackWebhookUrl(value);
		console.log('[RWG][popup] Saved Slack webhook URL');
		slackStatus.textContent = 'Slack URL saved!';
	} catch (err) {
		console.error('[RWG][popup] Failed to save Slack URL', err);
		slackStatus.textContent = 'Error saving Slack URL (see console).';
	}
}

async function testSlack() {
	try {
		slackStatus.textContent = 'Sending test message...';
		await sendTestSlackMessage();
		slackStatus.textContent = 'Sent test message to Slack ✅';
	} catch (err) {
		console.error('[RWG][popup] Slack test failed', err);
		slackStatus.textContent = 'Slack test failed (see console).';
	}
}

async function startGame() {
  try {
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Starting...';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      pinStatus.textContent = 'No active tab found.';
      startGameBtn.disabled = false;
      startGameBtn.textContent = 'Start Game';
      return;
    }
    // Some URLs (chrome://, chromewebstore) disallow content scripts
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
      pinStatus.textContent = 'Cannot inject into this page. Try a normal website.';
      return;
    }
    console.log('[RWG][popup] Starting game on tab', tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'RWG_START_GAME' });
    console.log('[RWG][popup] Game response:', response);
    pinStatus.textContent = 'Game started! Press Esc to close.';
  } catch (err) {
    console.error('[RWG][popup] Error starting game', err);
    pinStatus.textContent = 'Game start failed (see console).';
  }
  finally {
    startGameBtn.disabled = false;
    startGameBtn.textContent = 'Start Game';
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

document.addEventListener('DOMContentLoaded', () => {
	loadPin();
	loadSlackWebhook();
});
saveBtn.addEventListener('click', savePin);
startGameBtn.addEventListener('click', startGame);
openSwLogsBtn.addEventListener('click', openServiceWorkerLogs);
saveSlackBtn.addEventListener('click', saveSlack);
testSlackBtn.addEventListener('click', testSlack);


