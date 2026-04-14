import { getTextFromElement, getTextFromElementOnward, getTextFromSelection, getTextFromSelectionOnward } from './textExtractor.js';
import { showHoverTarget, clearHoverTarget, showLoading, highlightElement, clearAllHighlights, scrollToElement, startScrollTracking, stopScrollTracking, showToast, showFullPagePill, hideFullPagePill, showSubtitle, hideSubtitle, applySentenceRange, clearSentenceHighlight } from './highlighter.js';

const INLINE_TAGS = new Set([
    'A', 'SPAN', 'EM', 'STRONG', 'B', 'I', 'CODE', 'MARK',
    'SMALL', 'SUB', 'SUP', 'ABBR', 'CITE', 'Q', 'S', 'U', 'TIME'
]);

const BLOCK_TAGS = new Set([
    'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'PRE', 'DD', 'DT',
    'DIV', 'ARTICLE', 'SECTION'
]);

const INTERACTIVE_TAGS = new Set([
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'
]);

const HOLD_THRESHOLD = 300;    // ms before a keydown counts as a hold
const DOUBLE_TAP_WINDOW = 300; // ms window for detecting double-tap

export class InputHandler {
    constructor(player) {
        this.player = player;
        this.currentHoverElement = null;
        this.mode = 'idle'; // 'idle' | 'hold-reading' | 'continuous-reading'
        this.altDown = false;
        this.lastAltRelease = 0;
        this.holdDelayTimer = null;
        this.sentenceMap = null;
        this.sentences = null;
        this._subtitlesEnabled = false;
        this._autoScrollEnabled = true;
        this._hotkey = { key: 'Alt', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false };

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onBlur = this._onBlur.bind(this);
    }

    activate() {
        document.addEventListener('keydown', this._onKeyDown, true);
        document.addEventListener('keyup', this._onKeyUp, true);
        document.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('beforeunload', () => this.deactivate());

        this.player.onSentenceStart = (index) => this._handleSentenceStart(index);
        this.player.onPlaybackComplete = () => this._handlePlaybackComplete();
        this.player.onError = () => this._handleError();

        try {
            chrome.storage.local.get(['subtitlesEnabled', 'autoScrollEnabled', 'hotkey'], (items) => {
                if (chrome.runtime.lastError) return;
                this._subtitlesEnabled = items.subtitlesEnabled || false;
                this._autoScrollEnabled = items.autoScrollEnabled !== false;
                if (items.hotkey) this._hotkey = items.hotkey;
            });
        } catch (e) { /* extension context invalidated */ }
    }

    deactivate() {
        document.removeEventListener('keydown', this._onKeyDown, true);
        document.removeEventListener('keyup', this._onKeyUp, true);
        document.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('blur', this._onBlur);
        if (this.mode !== 'idle') {
            this.player.stopImmediately();
        }
        clearAllHighlights();
    }

    _onMouseMove(event) {
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (el) {
            this.currentHoverElement = this._resolveTextBlock(el);
        }
    }

    _matchesHotkey(event) {
        const hk = this._hotkey;
        if (event.key !== hk.key) return false;
        // For modifier-only hotkeys (Alt, Ctrl, Shift), don't check other modifiers
        if (['Alt', 'Control', 'Shift', 'Meta'].includes(hk.key)) return true;
        // For combo hotkeys (Ctrl+R, etc.), check modifiers match
        return event.ctrlKey === hk.ctrlKey &&
               event.shiftKey === hk.shiftKey &&
               event.altKey === hk.altKey &&
               event.metaKey === hk.metaKey;
    }

    _onKeyDown(event) {
        if (!this._matchesHotkey(event)) return;
        if (event.repeat) return;
        if (this.altDown) return;

        event.preventDefault();

        // If currently in continuous-reading, Alt press stops it
        if (this.mode === 'continuous-reading') {
            this._stopContinuous();
            return;
        }

        this.altDown = true;

        // Immediate visual feedback — show which element will be read
        if (this.currentHoverElement) {
            showHoverTarget(this.currentHoverElement);
        }

        // Start hold timer — if it fires, this is a hold
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

        // If we're in hold-reading mode, release stops it
        if (this.mode === 'hold-reading') {
            this._stopHoldReading();
            return;
        }

        // If hold timer is still pending, this was a quick tap (not a hold)
        if (this.holdDelayTimer !== null) {
            clearTimeout(this.holdDelayTimer);
            this.holdDelayTimer = null;

            const now = Date.now();
            if (now - this.lastAltRelease < DOUBLE_TAP_WINDOW) {
                // Second tap — double-tap detected
                this.lastAltRelease = 0;
                this._startContinuousReading();
            } else {
                // First tap — record and wait for potential second
                this.lastAltRelease = now;
                clearHoverTarget();
            }
        }
    }

    _onBlur() {
        // Window lost focus (e.g. Alt+Tab) — treat as keyup
        if (this.altDown) {
            this.altDown = false;
            if (this.holdDelayTimer !== null) {
                clearTimeout(this.holdDelayTimer);
                this.holdDelayTimer = null;
            }
            if (this.mode === 'hold-reading') {
                this._stopHoldReading();
            }
        }
    }

    _resolveTextBlock(el) {
        if (!el || el === document.documentElement || el === document.body) return null;

        // Skip interactive elements
        if (INTERACTIVE_TAGS.has(el.tagName) || el.isContentEditable) return null;

        let current = el;
        // Walk up from inline elements
        while (current && current !== document.body) {
            if (INTERACTIVE_TAGS.has(current.tagName) || current.isContentEditable) return null;
            if (BLOCK_TAGS.has(current.tagName) && !INLINE_TAGS.has(current.tagName)) {
                const text = (current.innerText || '').trim();
                if (text.length > 0 && text.length < 10000) {
                    return current;
                }
            }
            current = current.parentElement;
        }
        return null;
    }

    _startHoldReading() {
        const sel = window.getSelection();
        const selectedText = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
        const target = this.currentHoverElement;

        let sentences;
        if (selectedText.length > 0) {
            sentences = getTextFromSelection(selectedText);
        } else if (target) {
            sentences = getTextFromElement(target);
        } else {
            return;
        }

        this.mode = 'hold-reading';
        if (sentences.length === 0) {
            this.mode = 'idle';
            return;
        }

        this.sentences = sentences;
        this.sentenceMap = null;
        clearHoverTarget();
        if (target) showLoading(target);
        this.player.startPlaybackCycle(sentences);
    }

    _stopHoldReading() {
        this.player.finishCurrentSentenceAndStop();
        // mode will be reset in _handlePlaybackComplete
    }

    _startContinuousReading() {
        const sel = window.getSelection();
        const selectedText = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
        const target = this.currentHoverElement;

        let sentences, sentenceMap;
        if (selectedText.length > 0) {
            const result = getTextFromSelectionOnward(selectedText);
            sentences = result.sentences;
            sentenceMap = result.sentenceMap;
        } else if (target) {
            const result = getTextFromElementOnward(target);
            sentences = result.sentences;
            sentenceMap = result.sentenceMap;
        } else {
            return;
        }

        this.mode = 'continuous-reading';
        if (sentences.length === 0) {
            this.mode = 'idle';
            return;
        }

        this.sentences = sentences;
        this.sentenceMap = sentenceMap;
        clearHoverTarget();
        if (target) showLoading(target);
        showFullPagePill();
        if (this._autoScrollEnabled) startScrollTracking();
        this.player.startPlaybackCycle(sentences);
    }

    _stopContinuous() {
        hideFullPagePill();
        hideSubtitle();
        stopScrollTracking();
        this.player.stopImmediately();
    }

    _handleSentenceStart(index) {
        if (this.mode === 'continuous-reading' && this.sentenceMap && this.sentenceMap[index]) {
            const entry = this.sentenceMap[index];
            highlightElement(entry.element);
            if (this._autoScrollEnabled) scrollToElement(entry.element);
            applySentenceRange(entry.range);
        } else if (this.mode === 'hold-reading' && this.currentHoverElement) {
            highlightElement(this.currentHoverElement);
        }

        // Subtitles (if enabled in settings)
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
