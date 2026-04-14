let ws = null;
let audioCtx = null;
let nextPlayTime = 0;
let currentContextId = null;
let currentSessionId = null;
let wsReady = false;
let pendingRequest = null;
let wsReconnectDelay = 500;

const SAMPLE_RATE = 24000;

function sendEvent(type, extra) {
    chrome.runtime.sendMessage(
        Object.assign({ action: 'tts-event', type, sessionId: currentSessionId }, extra || {}),
        () => { if (chrome.runtime.lastError) { /* ignore */ } }
    );
}

function ensureAudioContext() {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function connectWebSocket(apiKey) {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    if (ws && ws.readyState === WebSocket.CONNECTING) return;

    const url = `wss://api.cartesia.ai/tts/websocket?api_key=${apiKey}&cartesia_version=2025-04-16`;
    ws = new WebSocket(url);
    wsReady = false;

    ws.onopen = () => {
        wsReady = true;
        wsReconnectDelay = 500;
        if (pendingRequest) {
            ws.send(JSON.stringify(pendingRequest));
            pendingRequest = null;
        }
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Drop messages for stale contexts (canceled sentences echo here).
        if (msg.context_id && msg.context_id !== currentContextId) return;

        if (msg.type === 'chunk' && msg.data) {
            if (nextPlayTime === 0 || nextPlayTime <= audioCtx.currentTime) sendEvent('start');
            const pcmBytes = base64ToArrayBuffer(msg.data);
            const samples = new Float32Array(pcmBytes);
            const buffer = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
            buffer.getChannelData(0).set(samples);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            const now = audioCtx.currentTime;
            if (nextPlayTime < now) nextPlayTime = now;
            source.start(nextPlayTime);
            nextPlayTime += buffer.duration;
        } else if (msg.type === 'done') {
            const remaining = Math.max(0, (nextPlayTime - audioCtx.currentTime) * 1000);
            setTimeout(() => sendEvent('end'), remaining);
        } else if (msg.type === 'error') {
            // Log with stringified payload so chrome://extensions errors panel shows details.
            console.error('Readel Cartesia error:', JSON.stringify(msg));
            sendEvent('error');
        }
    };

    ws.onerror = (err) => {
        console.error('Readel WebSocket error:', err);
        wsReady = false;
    };

    ws.onclose = () => {
        wsReady = false;
        ws = null;
    };
}

function speak(sentence, voiceId, apiKey, speed, sessionId) {
    currentSessionId = sessionId || null;
    ensureAudioContext();
    connectWebSocket(apiKey);

    currentContextId = 'ctx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    nextPlayTime = 0;

    const cartesiaSpeed = Math.min(1.5, Math.max(0.6, speed || 1));

    const request = {
        model_id: 'sonic-3',
        transcript: sentence,
        voice: { mode: 'id', id: voiceId },
        language: 'en',
        generation_config: { speed: cartesiaSpeed },
        context_id: currentContextId,
        output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: SAMPLE_RATE
        }
    };

    if (wsReady) {
        ws.send(JSON.stringify(request));
    } else {
        pendingRequest = request;
        if (!ws) {
            setTimeout(() => connectWebSocket(apiKey), wsReconnectDelay);
            wsReconnectDelay = Math.min(8000, wsReconnectDelay * 2);
        }
    }
}

function stopAudio() {
    if (ws && wsReady && currentContextId) {
        try { ws.send(JSON.stringify({ context_id: currentContextId, cancel: true })); } catch (e) {}
    }
    currentContextId = null;
    nextPlayTime = 0;
    if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
    }
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new ArrayBuffer(binary.length);
    const view = new Uint8Array(bytes);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return bytes;
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'offscreen-speak') {
        speak(message.sentence, message.voiceId, message.apiKey, message.speed, message.sessionId);
    } else if (message.action === 'offscreen-stop') {
        currentSessionId = message.sessionId || currentSessionId;
        stopAudio();
    }
});
