import { resolveTextBlockAtPoint, getTextFromElement, getTextFromElementOnward, getTextFromSelection, getTextFromSelectionOnward } from './textExtractor.js';
import {
    showHoverTarget, clearHoverTarget, showLoading, highlightElement, clearAllHighlights,
    scrollToElement, startScrollTracking, stopScrollTracking,
    showToast, showFullPagePill, hideFullPagePill, showSubtitle, hideSubtitle,
    applySentenceRange, showMissPulse
} from './highlighter.js';
import { isRuntimeAlive } from './runtimeHealth.js';

const HOLD_THRESHOLD = 300;
const DOUBLE_TAP_WINDOW = 300;

const COMPOSER_SELECTORS = [
    '[data-testid="chat-input-textbox"]',
    '[data-testid="composer-text-area"]',
    '[contenteditable="true"][role="textbox"][aria-label*="Message" i]',
    '[contenteditable="true"][aria-label*="compose" i]',
    '.editable[contenteditable="true"][g_editable="true"]'
];

export function isComposerElement(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
        const t = (el.getAttribute('type') || '').toLowerCase();
        if (t === 'text' || t === 'search' || t === 'email' || t === 'url' || t === '') return true;
    }
    for (const sel of COMPOSER_SELECTORS) {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
    }
    return false;
}

export class InputHandler {
    constructor() {
        this.player = null;
        this.mode = 'idle';
        this.altDown = false;
        this.lastAltRelease = 0;
        this.holdDelayTimer = null;
        this.sentenceMap = null;
        this.sentences = null;
        this._subtitlesEnabled = false;
        this._autoScrollEnabled = true;
        this._hotkey = { key: 'Alt', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false };
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._heavyInitDone = false;
        this._runtimeDead = false;
        this._AudioPlayerCtor = null;
        this._pendingTarget = null;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onBlur = this._onBlur.bind(this);
    }

    setAudioPlayerConstructor(Ctor) {
        this._AudioPlayerCtor = Ctor;
    }

    activate() {
        document.addEventListener('keydown', this._onKeyDown, true);
        document.addEventListener('keyup', this._onKeyUp, true);
        document.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('beforeunload', () => this.deactivate());
    }

    deactivate() {
        document.removeEventListener('keydown', this._onKeyDown, true);
        document.removeEventListener('keyup', this._onKeyUp, true);
        document.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('blur', this._onBlur);
        if (this.player && this.mode !== 'idle') this.player.stopImmediately();
        clearAllHighlights();
    }

    _maybeInitHeavy() {
        if (this._heavyInitDone) return;
        this._heavyInitDone = true;
        if (this._AudioPlayerCtor) {
            this.player = new this._AudioPlayerCtor();
            this.player.onSentenceStart = (i) => this._handleSentenceStart(i);
            this.player.onPlaybackComplete = () => this._handlePlaybackComplete();
            this.player.onError = () => this._handleError();
        }
        try {
            chrome.storage.local.get(['subtitlesEnabled', 'autoScrollEnabled', 'hotkey'], (items) => {
                if (chrome.runtime.lastError) return;
                this._subtitlesEnabled = !!items.subtitlesEnabled;
                this._autoScrollEnabled = items.autoScrollEnabled !== false;
                if (items.hotkey) this._hotkey = items.hotkey;
            });
        } catch (e) { /* extension context invalidated */ }
    }

    _onMouseMove(event) {
        this._lastMouseX = event.clientX;
        this._lastMouseY = event.clientY;
    }

    _matchesHotkey(event) {
        const hk = this._hotkey;
        if (event.key !== hk.key) return false;
        if (['Alt', 'Control', 'Shift', 'Meta'].includes(hk.key)) return true;
        return event.ctrlKey === hk.ctrlKey
            && event.shiftKey === hk.shiftKey
            && event.altKey === hk.altKey
            && event.metaKey === hk.metaKey;
    }

    _onKeyDown(event) {
        if (!this._matchesHotkey(event)) return;
        if (event.repeat) return;
        if (this.altDown) return;

        if (!isRuntimeAlive()) {
            if (!this._runtimeDead) {
                this._runtimeDead = true;
                try { showToast('Readel needs a page refresh.', 5000); } catch (e) {}
                this.deactivate();
            }
            return;
        }

        event.preventDefault();
        this._maybeInitHeavy();

        if (this.mode === 'continuous-reading') {
            this._stopContinuous();
            return;
        }

        this.altDown = true;

        const resolved = resolveTextBlockAtPoint(this._lastMouseX, this._lastMouseY);

        if (!resolved) {
            showMissPulse(this._lastMouseX, this._lastMouseY);
            this.altDown = false;
            return;
        }

        if (resolved.nodeType === Node.ELEMENT_NODE && isComposerElement(resolved)) {
            showMissPulse(this._lastMouseX, this._lastMouseY);
            this.altDown = false;
            return;
        }

        this._pendingTarget = resolved;

        if (resolved.nodeType === Node.ELEMENT_NODE) {
            showHoverTarget(resolved);
        }

        this.holdDelayTimer = setTimeout(() => {
            this.holdDelayTimer = null;
            if (this.altDown && this.mode === 'idle') {
                this._startHoldReading();
            }
        }, HOLD_THRESHOLD);
    }

    _onKeyUp(event) {
        if (event.key !== this._hotkey.key) return;
        event.preventDefault();

        if (!this.altDown) return;
        this.altDown = false;

        if (this.mode === 'hold-reading') {
            this._stopHoldReading();
            return;
        }

        if (this.holdDelayTimer !== null) {
            clearTimeout(this.holdDelayTimer);
            this.holdDelayTimer = null;

            const now = Date.now();
            if (now - this.lastAltRelease < DOUBLE_TAP_WINDOW) {
                this.lastAltRelease = 0;
                this._startContinuousReading();
            } else {
                this.lastAltRelease = now;
                clearHoverTarget();
            }
        }
    }

    _onBlur() {
        if (this.altDown) {
            this.altDown = false;
            if (this.holdDelayTimer !== null) {
                clearTimeout(this.holdDelayTimer);
                this.holdDelayTimer = null;
            }
            if (this.mode === 'hold-reading') this._stopHoldReading();
        }
    }

    _startHoldReading() {
        const target = this._pendingTarget;
        let sentences;

        if (target && target.kind === 'selection') {
            sentences = getTextFromSelection(target.text);
        } else if (target && target.nodeType === Node.ELEMENT_NODE) {
            sentences = getTextFromElement(target);
        } else {
            return;
        }

        if (!sentences || sentences.length === 0) { this.mode = 'idle'; return; }

        this.mode = 'hold-reading';
        this.sentences = sentences;
        this.sentenceMap = null;
        clearHoverTarget();
        if (target.nodeType === Node.ELEMENT_NODE) showLoading(target);
        if (this.player) this.player.startPlaybackCycle(sentences);
    }

    _stopHoldReading() {
        if (this.player) this.player.finishCurrentSentenceAndStop();
    }

    _startContinuousReading() {
        const target = this._pendingTarget;
        let sentences, sentenceMap;

        if (target && target.kind === 'selection') {
            const r = getTextFromSelectionOnward(target.text);
            sentences = r.sentences;
            sentenceMap = r.sentenceMap;
        } else if (target && target.nodeType === Node.ELEMENT_NODE) {
            const r = getTextFromElementOnward(target);
            sentences = r.sentences;
            sentenceMap = r.sentenceMap;
        } else {
            return;
        }

        if (!sentences || sentences.length === 0) { this.mode = 'idle'; return; }

        this.mode = 'continuous-reading';
        this.sentences = sentences;
        this.sentenceMap = sentenceMap;
        clearHoverTarget();
        if (target.nodeType === Node.ELEMENT_NODE) showLoading(target);
        showFullPagePill();
        if (this._autoScrollEnabled) startScrollTracking();
        if (this.player) this.player.startPlaybackCycle(sentences);
    }

    _stopContinuous() {
        hideFullPagePill();
        hideSubtitle();
        stopScrollTracking();
        if (this.player) this.player.stopImmediately();
    }

    _handleSentenceStart(index) {
        if (this.mode === 'continuous-reading' && this.sentenceMap && this.sentenceMap[index]) {
            const entry = this.sentenceMap[index];
            highlightElement(entry.element);
            if (this._autoScrollEnabled) scrollToElement(entry.element);
            applySentenceRange(entry.range);
        } else if (this.mode === 'hold-reading' && this._pendingTarget && this._pendingTarget.nodeType === Node.ELEMENT_NODE) {
            highlightElement(this._pendingTarget);
        }
        const text = this.sentences && this.sentences[index];
        if (text && this._subtitlesEnabled) showSubtitle(text);
    }

    _handlePlaybackComplete() {
        this.mode = 'idle';
        this.sentenceMap = null;
        this.sentences = null;
        clearAllHighlights();
        hideFullPagePill();
        hideSubtitle();
        stopScrollTracking();
    }

    _handleError() {
        this.mode = 'idle';
        this.sentenceMap = null;
        this.sentences = null;
        clearAllHighlights();
        hideFullPagePill();
        hideSubtitle();
        stopScrollTracking();
        showToast('Couldn\u2019t play audio. Try again.');
    }
}
