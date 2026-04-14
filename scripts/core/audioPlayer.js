import { newSessionId, matchesSession } from './sessionBus.js';

class AudioPlayer {
    constructor() {
        this.init();
        this._setupMessageListener();
    }

    async init() {
        this.sentences = [];
        this.sentenceIndex = 0;
        this.isPlaying = false;
        this._stopAfterCurrent = false;
        this._sentenceStartTime = 0;
        this._responseTimes = [];
        this.currentSessionId = null;
        if (this.onSentenceStart === undefined) this.onSentenceStart = null;
        if (this.onPlaybackComplete === undefined) this.onPlaybackComplete = null;
        if (this.onError === undefined) this.onError = null;
    }

    _setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action !== 'tts-event') return;
            if (!matchesSession(this.currentSessionId, message.sessionId)) return;

            if (message.type === 'start') {
                this.isPlaying = true;
                if (this._sentenceStartTime) {
                    const elapsed = Date.now() - this._sentenceStartTime;
                    this._responseTimes.push(elapsed);
                    const avg = this._responseTimes.reduce((a, b) => a + b, 0) / this._responseTimes.length;
                    try { chrome.storage.local.set({ 'avgResponseTime': avg }); } catch (e) {}
                }
                if (this.onSentenceStart) this.onSentenceStart(this.sentenceIndex);
            } else if (message.type === 'end') {
                this.isPlaying = false;
                if (this._stopAfterCurrent) {
                    this._stopAfterCurrent = false;
                    if (this.onPlaybackComplete) this.onPlaybackComplete();
                    return;
                }
                this.sentenceIndex++;
                this._speakCurrent();
            } else if (message.type === 'error') {
                this.isPlaying = false;
                if (this.onError) this.onError();
            }
        });
    }

    async startPlaybackCycle(sentences) {
        this._stopAfterCurrent = false;
        this.sentences = sentences;
        this.sentenceIndex = 0;
        this.currentSessionId = newSessionId();
        this._speakCurrent();
    }

    _speakCurrent() {
        if (this.sentenceIndex >= this.sentences.length) {
            this.isPlaying = false;
            if (this.onPlaybackComplete) this.onPlaybackComplete();
            return;
        }
        this._sentenceStartTime = Date.now();
        try {
            chrome.runtime.sendMessage({
                action: 'tts-speak',
                sentence: this.sentences[this.sentenceIndex],
                sessionId: this.currentSessionId
            }).catch(() => {});
        } catch (e) { /* context invalidated */ }
    }

    finishCurrentSentenceAndStop() {
        this._stopAfterCurrent = true;
    }

    stopImmediately() {
        try {
            chrome.runtime.sendMessage({ action: 'tts-stop', sessionId: this.currentSessionId }).catch(() => {});
        } catch (e) { /* context invalidated */ }
        const onComplete = this.onPlaybackComplete;
        this.init();
        if (onComplete) onComplete();
    }
}

export default AudioPlayer;
