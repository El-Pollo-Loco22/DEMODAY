// lib/slack.js
/* global chrome */

const STORAGE_KEY = 'rwg_slack_webhook_url';

export async function saveSlackWebhookUrl(webhookUrl) {
	if (typeof webhookUrl !== 'string') {
		throw new Error('webhookUrl must be a string');
	}
	await chrome.storage.sync.set({ [STORAGE_KEY]: webhookUrl.trim() });
}

export async function getSlackWebhookUrl() {
	const result = await chrome.storage.sync.get([STORAGE_KEY]);
	return result?.[STORAGE_KEY] || '';
}

export async function postToSlack({ text, blocks }) {
	const webhookUrl = await getSlackWebhookUrl();
	if (!webhookUrl) {
		throw new Error('Slack webhook URL is not set');
	}
	const payload = blocks ? { blocks, text: text || '' } : { text: text || '' };
	const resp = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`Slack error ${resp.status}: ${body}`);
	}
	return true;
}

export async function sendTestSlackMessage() {
	const url = await getSlackWebhookUrl();
	if (!url) {
		throw new Error('Slack webhook URL is not set');
	}
	return postToSlack({
		text: 'Retro Web Games: Slack integration test ✅'
	});
}


