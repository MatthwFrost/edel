const CARTESIA_DEFAULT_VOICE = "a33f7a4c-100f-41cf-a1fd-5822e8fc253f"; // Aria

const VOICE_MIGRATION = {
    '71a7ad14-091c-4e8e-a314-022ece01c121': 'dc30854e-e398-4579-9dc8-16f6cb2c19b9', // British Lady -> Sable
    'f146dcec-e481-45be-8ad2-96e1e40e7f32': '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Reading Man -> Atlas
    '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e': '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', // Nonfiction Man -> Finn (same id)
    '00a77add-48d5-4ef6-8157-71e5437b282d': 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', // Calm Lady -> Mira
    '69267136-1bdc-412f-ad78-0caad210fb40': '4f7f1324-1853-48a6-b294-4e78e8036a83', // Friendly Man -> Quill
    'd46abd1d-2d02-43e8-819f-51fb652c1c61': '5ee9feff-1265-424a-9d7f-8e4d431a12c7'  // Newsman -> Atlas
};

let offscreenCreated = false;

async function ensureOffscreen() {
    if (offscreenCreated) return;
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Streaming TTS audio via WebSocket'
        });
        offscreenCreated = true;
    } catch (e) {
        offscreenCreated = true;
    }
}

chrome.runtime.onInstalled.addListener(async function (details) {
    if (details.reason === "install" || details.reason === "update") {
        chrome.storage.local.set({ 'cartesiaApiKey': 'sk_car_e5CtJM7VCSbc3SoXUkZpnD' });
        chrome.storage.local.get(['voiceID'], (items) => {
            const cur = items.voiceID;
            if (!cur) {
                chrome.storage.local.set({ 'voiceID': CARTESIA_DEFAULT_VOICE });
            } else if (VOICE_MIGRATION[cur] && VOICE_MIGRATION[cur] !== cur) {
                chrome.storage.local.set({ 'voiceID': VOICE_MIGRATION[cur] });
            }
        });
    }
});

function getSettings() {
    return new Promise(resolve => {
        chrome.storage.local.get(['voiceID', 'cartesiaApiKey', 'playbackRate'], items => {
            resolve({
                voiceId: items.voiceID || CARTESIA_DEFAULT_VOICE,
                apiKey: items.cartesiaApiKey || '',
                speed: parseFloat(items.playbackRate) || 1
            });
        });
    });
}

// Send an error that originated in the background (not from offscreen).
// Must reach both content scripts (via tabs API) and extension pages (via runtime API).
function notifyError() {
    const msg = { action: 'tts-event', type: 'error' };
    if (activeTtsTabId) {
        chrome.tabs.sendMessage(activeTtsTabId, msg).catch(() => {});
    }
    chrome.runtime.sendMessage(msg).catch(() => {});
}

let activeTtsTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // PDF viewer handlers — commented out
    // if (message.action === "open-pdf-viewer") {
    //     const viewerUrl = chrome.runtime.getURL('viewer/viewer.html') +
    //         '?file=' + encodeURIComponent(message.url);
    //     chrome.tabs.update(sender.tab.id, { url: viewerUrl });
    //     return false;
    // } else if (message.action === "fetch-pdf") {
    //     (async () => {
    //         try {
    //             const resp = await fetch(message.url);
    //             if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    //             const buf = await resp.arrayBuffer();
    //             const bytes = new Uint8Array(buf);
    //             const chunks = [];
    //             for (let i = 0; i < bytes.length; i += 0x8000) {
    //                 chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    //             }
    //             sendResponse({ data: btoa(chunks.join('')) });
    //         } catch (err) {
    //             sendResponse({ error: err.message });
    //         }
    //     })();
    //     return true;
    // }
    console.log('[Readel bg] got message:', message.action);
    if (message.action === "tts-speak") {
        console.log('[Readel bg] tts-speak received');
        if (activeTtsTabId && activeTtsTabId !== sender.tab?.id) {
            chrome.runtime.sendMessage({ action: 'offscreen-stop' }).catch(() => {});
        }
        activeTtsTabId = sender.tab?.id;
        (async () => {
            try {
                console.log('[Readel bg] ensuring offscreen...');
                await ensureOffscreen();
                console.log('[Readel bg] offscreen ready');
                const { voiceId, apiKey, speed } = await getSettings();
                console.log('[Readel bg] settings:', { voiceId, hasKey: !!apiKey, speed });
                if (!apiKey) {
                    console.error('[Readel bg] no API key!');
                    notifyError();
                    return;
                }
                console.log('[Readel bg] sending to offscreen');
                chrome.runtime.sendMessage({
                    action: 'offscreen-speak',
                    sentence: message.sentence,
                    sessionId: message.sessionId,
                    voiceId,
                    apiKey,
                    speed
                }).then(r => console.log('[Readel bg] offscreen response:', r))
                  .catch(err => console.error('[Readel bg] offscreen send failed:', err));
            } catch (err) {
                console.error('[Readel bg] error:', err);
                notifyError();
            }
        })();
        return false;
    } else if (message.action === "tts-stop") {
        chrome.runtime.sendMessage({ action: 'offscreen-stop', sessionId: message.sessionId }).catch(() => {});
        return false;
    } else if (message.action === "tts-event") {
        // Forward to content scripts only. Do NOT re-broadcast via chrome.runtime.sendMessage
        // because extension pages (PDF viewer) already received this event directly
        // from the offscreen document's original chrome.runtime.sendMessage broadcast.
        // Re-broadcasting would cause double delivery and break AudioPlayer.
        if (activeTtsTabId) {
            chrome.tabs.sendMessage(activeTtsTabId, {
                action: 'tts-event',
                type: message.type,
                sessionId: message.sessionId
            }).catch(() => {});
        }
        return false;
    }
    return false;
});
