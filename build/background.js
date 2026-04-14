const CARTESIA_DEFAULT_VOICE = "71a7ad14-091c-4e8e-a314-022ece01c121";

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
