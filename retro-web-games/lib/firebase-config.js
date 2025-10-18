// lib/firebase-config.js
// Placeholder for Firebase initialization. We'll fill this in Step 4.
// Config values will be read from chrome.storage (not hardcoded).

export async function getFirebaseConfig() {
  // In future steps, read from storage keys set via options page or env import.
  // For now return null to avoid accidental initialization.
  try {
    return null;
  } catch (err) {
    console.error('[RWG][firebase] Failed to get config', err);
    return null;
  }
}


