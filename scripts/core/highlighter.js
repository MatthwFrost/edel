const STYLE_ID = 'readel-highlight-styles';

let currentHighlightedElement = null;
let styleInjected = false;
let toastTimeout = null;

export function injectHighlightStyles() {
    if (styleInjected) return;
    const existing = document.getElementById(STYLE_ID);
    if (existing) { styleInjected = true; return; }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .readel-hover-target {
            background-color: rgba(59, 130, 246, 0.08) !important;
            border-radius: 4px;
            box-shadow: inset 2px 0 0 rgba(59, 130, 246, 0);
            animation: readel-hover-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
            transition: background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .readel-loading {
            background-color: rgba(59, 130, 246, 0.08) !important;
            border-left: 3px solid rgba(59, 130, 246, 0.4) !important;
            padding-left: 8px !important;
            border-radius: 2px;
            animation: readel-breathe 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .readel-sentence-active {
            background-color: rgba(59, 130, 246, 0.08) !important;
            border-left: 3px solid rgba(59, 130, 246, 0.5) !important;
            padding-left: 8px !important;
            border-radius: 2px;
            animation: readel-sentence-bloom 420ms cubic-bezier(0.22, 1, 0.36, 1);
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        ::highlight(readel-current-sentence) {
            background-color: rgba(59, 130, 246, 0.2);
            border-radius: 2px;
        }
        @keyframes readel-hover-in {
            0% {
                background-color: rgba(59, 130, 246, 0);
                box-shadow: inset 2px 0 0 rgba(59, 130, 246, 0);
            }
            100% {
                background-color: rgba(59, 130, 246, 0.08);
                box-shadow: inset 2px 0 0 rgba(59, 130, 246, 0.25);
            }
        }
        @keyframes readel-breathe {
            0%, 100% {
                background-color: rgba(59, 130, 246, 0.06) !important;
                box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            }
            50% {
                background-color: rgba(59, 130, 246, 0.14) !important;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
            }
        }
        @keyframes readel-sentence-bloom {
            0% {
                background-color: rgba(59, 130, 246, 0.04) !important;
                border-left-color: rgba(59, 130, 246, 0.2) !important;
            }
            45% {
                background-color: rgba(59, 130, 246, 0.16) !important;
                border-left-color: rgba(59, 130, 246, 0.8) !important;
            }
            100% {
                background-color: rgba(59, 130, 246, 0.08) !important;
                border-left-color: rgba(59, 130, 246, 0.5) !important;
            }
        }

        /* Error toast */
        .readel-toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            padding: 10px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.18);
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .readel-toast.readel-toast-visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        /* Onboarding overlay */
        .readel-onboarding {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            padding: 16px 20px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 280px;
            animation: readel-slide-in 0.3s ease;
        }
        .readel-onboarding-title {
            font-size: 14px;
            font-weight: 600;
            color: #0f0f0f;
            margin-bottom: 8px;
        }
        .readel-onboarding-text {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 12px;
        }
        .readel-onboarding-text kbd {
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-bottom-width: 2px;
            border-radius: 3px;
            padding: 1px 5px;
            font-size: 11px;
            font-family: inherit;
            font-weight: 500;
        }
        .readel-onboarding-dismiss {
            background: none;
            border: none;
            font-size: 12px;
            color: #3b82f6;
            cursor: pointer;
            padding: 0;
            font-family: inherit;
            font-weight: 500;
        }
        .readel-onboarding-dismiss:hover {
            text-decoration: underline;
        }
        @keyframes readel-slide-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Jump back button */
        .readel-jumpback {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            font-weight: 500;
            padding: 8px 16px;
            border-radius: 100px;
            border: none;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            cursor: pointer;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 6px;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .readel-jumpback.readel-jumpback-visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }
        .readel-jumpback:hover {
            background: #333;
        }

        /* Subtitle bar */
        .readel-subtitle {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            padding: 10px 24px;
            border-radius: 10px;
            max-width: 600px;
            text-align: center;
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .readel-subtitle.readel-subtitle-visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        /* Full page pill */
        .readel-pill {
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%) translateY(-60px);
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            padding: 10px 20px;
            border-radius: 100px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            transition: opacity 0.25s, transform 0.25s;
        }
        .readel-pill.readel-pill-visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .readel-pill-label {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .readel-pill-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #3b82f6;
            animation: readel-dot-pulse 1.5s ease-in-out infinite;
        }
        @keyframes readel-dot-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        .readel-pill-check {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            color: #999;
            cursor: pointer;
            user-select: none;
        }
        .readel-pill-check input {
            margin: 0;
            cursor: pointer;
            accent-color: #3b82f6;
        }
        .readel-pill-sep {
            width: 1px;
            height: 14px;
            background: #333;
        }

        /* Miss pulse */
        .readel-miss-pulse {
            position: fixed;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(107, 114, 128, 0.55);
            pointer-events: none;
            z-index: 2147483647;
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0;
            transition: opacity 80ms ease-out, transform 80ms ease-out;
        }
        .readel-miss-pulse.readel-miss-pulse-visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        .readel-miss-pulse.readel-miss-pulse-fading {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.2);
            transition: opacity 220ms ease-in, transform 220ms ease-in;
        }
    `;
    document.head.appendChild(style);
    styleInjected = true;
}

export function showHoverTarget(element) {
    clearHoverTarget();
    if (element) {
        element.classList.add('readel-hover-target');
    }
}

export function clearHoverTarget() {
    document.querySelectorAll('.readel-hover-target').forEach(el => {
        el.classList.remove('readel-hover-target');
    });
}

export function showLoading(element) {
    if (element) {
        element.classList.remove('readel-hover-target');
        element.classList.add('readel-loading');
    }
}

export function clearLoading() {
    document.querySelectorAll('.readel-loading').forEach(el => {
        el.classList.remove('readel-loading');
    });
}

export function highlightElement(element) {
    clearLoading();
    if (currentHighlightedElement && currentHighlightedElement !== element) {
        currentHighlightedElement.classList.remove('readel-sentence-active');
    }
    if (element) {
        element.classList.add('readel-sentence-active');
    }
    currentHighlightedElement = element;
}

export function clearAllHighlights() {
    document.querySelectorAll('.readel-hover-target, .readel-sentence-active, .readel-loading').forEach(el => {
        el.classList.remove('readel-hover-target', 'readel-sentence-active', 'readel-loading');
    });
    currentHighlightedElement = null;
    clearSentenceHighlight();
}

// ---- Sentence-level highlight (CSS Custom Highlight API) ----
export function applySentenceRange(range) {
    clearSentenceHighlight();
    if (!CSS.highlights || !range) return;
    try {
        CSS.highlights.set('readel-current-sentence', new Highlight(range));
    } catch (e) {
        // Range may be invalid if DOM changed since extraction
    }
}

export function clearSentenceHighlight() {
    if (CSS.highlights) {
        CSS.highlights.delete('readel-current-sentence');
    }
}

// ---- Auto-scroll with jump-back ----
let scrollLocked = true;
let currentReadingElement = null;
let jumpBackBtn = null;
let userScrollListener = null;

export function scrollToElement(element) {
    if (!element) return;
    currentReadingElement = element;

    if (scrollLocked) {
        const rect = element.getBoundingClientRect();
        const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!inView) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

export function startScrollTracking() {
    scrollLocked = true;
    hideJumpBack();

    // Detect user scrolling away
    let autoScrolling = false;
    const origScrollTo = window.scrollTo;

    userScrollListener = () => {
        if (!currentReadingElement) return;
        const rect = currentReadingElement.getBoundingClientRect();
        const inView = rect.top >= -200 && rect.bottom <= window.innerHeight + 200;
        if (!inView && scrollLocked) {
            scrollLocked = false;
            showJumpBack();
        } else if (inView && !scrollLocked) {
            scrollLocked = true;
            hideJumpBack();
        } else if (!scrollLocked && jumpBackBtn) {
            // Update arrow direction while scrolling
            const arrow = rect.top < 0 ? '↑' : '↓';
            jumpBackBtn.textContent = arrow + ' Jump to reading';
        }
    };
    window.addEventListener('scroll', userScrollListener, { passive: true });
}

export function stopScrollTracking() {
    if (userScrollListener) {
        window.removeEventListener('scroll', userScrollListener);
        userScrollListener = null;
    }
    scrollLocked = true;
    currentReadingElement = null;
    hideJumpBack();
}

function showJumpBack() {
    if (!jumpBackBtn) {
        jumpBackBtn = document.createElement('button');
        jumpBackBtn.className = 'readel-jumpback';
        jumpBackBtn.addEventListener('click', () => {
            scrollLocked = true;
            if (currentReadingElement) {
                currentReadingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            hideJumpBack();
        });
        document.body.appendChild(jumpBackBtn);
        requestAnimationFrame(() => {
            jumpBackBtn.classList.add('readel-jumpback-visible');
        });
    }

    // Update arrow direction based on where the reading element is
    if (currentReadingElement) {
        const rect = currentReadingElement.getBoundingClientRect();
        const arrow = rect.top < 0 ? '↑' : '↓';
        jumpBackBtn.textContent = arrow + ' Jump to reading';
    }
}

function hideJumpBack() {
    if (jumpBackBtn) {
        jumpBackBtn.classList.remove('readel-jumpback-visible');
        const btn = jumpBackBtn;
        jumpBackBtn = null;
        setTimeout(() => { if (btn.parentNode) btn.remove(); }, 200);
    }
}

// ---- Toast ----
export function showToast(message, duration = 3000) {
    let toast = document.querySelector('.readel-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'readel-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toastTimeout);

    requestAnimationFrame(() => {
        toast.classList.add('readel-toast-visible');
    });

    toastTimeout = setTimeout(() => {
        toast.classList.remove('readel-toast-visible');
    }, duration);
}

// ---- Full page pill ----
let pillElement = null;

export function showFullPagePill() {
    try {
    chrome.storage.local.get('readel_hide_pill', (items) => {
        if (chrome.runtime.lastError) return;
        if (items.readel_hide_pill) return;

        hideFullPagePill();

        const pill = document.createElement('div');
        pill.className = 'readel-pill';
        pill.innerHTML = `
            <div class="readel-pill-label">
                <div class="readel-pill-dot"></div>
                Reading full page
            </div>
            <div class="readel-pill-sep"></div>
            <label class="readel-pill-check">
                <input type="checkbox" class="readel-pill-checkbox">
                Don't show again
            </label>
        `;
        document.body.appendChild(pill);
        pillElement = pill;

        pill.querySelector('.readel-pill-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) {
                chrome.storage.local.set({ 'readel_hide_pill': true });
                hideFullPagePill();
            }
        });

        requestAnimationFrame(() => {
            pill.classList.add('readel-pill-visible');
        });
    });
    } catch (e) { /* extension context invalidated */ }
}

export function hideFullPagePill() {
    if (pillElement) {
        pillElement.classList.remove('readel-pill-visible');
        setTimeout(() => {
            if (pillElement && pillElement.parentNode) {
                pillElement.remove();
            }
            pillElement = null;
        }, 250);
    }
}

// ---- Subtitle ----
let subtitleElement = null;

export function showSubtitle(text) {
    if (!subtitleElement) {
        subtitleElement = document.createElement('div');
        subtitleElement.className = 'readel-subtitle';
        document.body.appendChild(subtitleElement);
    }
    subtitleElement.textContent = text;
    requestAnimationFrame(() => {
        subtitleElement.classList.add('readel-subtitle-visible');
    });
}

export function hideSubtitle() {
    if (subtitleElement) {
        subtitleElement.classList.remove('readel-subtitle-visible');
        setTimeout(() => {
            if (subtitleElement && subtitleElement.parentNode) {
                subtitleElement.remove();
            }
            subtitleElement = null;
        }, 200);
    }
}

// ---- Onboarding ----
export function showOnboarding() {
    try {
    chrome.storage.local.get('readel_onboarded', (items) => {
        if (chrome.runtime.lastError) return;
        if (items.readel_onboarded) return;

        const el = document.createElement('div');
        el.className = 'readel-onboarding';
        el.innerHTML = `
            <div class="readel-onboarding-title">Readel is ready</div>
            <div class="readel-onboarding-text">
                Hold <kbd>Alt</kbd> over any text to hear it read aloud.<br>
                Double-tap <kbd>Alt</kbd> to read continuously.
            </div>
            <button class="readel-onboarding-dismiss">Got it</button>
        `;
        document.body.appendChild(el);

        el.querySelector('.readel-onboarding-dismiss').addEventListener('click', () => {
            el.remove();
            chrome.storage.local.set({ 'readel_onboarded': true });
        });

        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (el.parentNode) {
                el.remove();
                chrome.storage.local.set({ 'readel_onboarded': true });
            }
        }, 15000);
    });
    } catch (e) { /* extension context invalidated */ }
}

// ---- Miss pulse ----
export function showMissPulse(x, y) {
    const pulse = document.createElement('div');
    pulse.className = 'readel-miss-pulse';
    pulse.style.left = x + 'px';
    pulse.style.top = y + 'px';
    document.body.appendChild(pulse);
    requestAnimationFrame(() => pulse.classList.add('readel-miss-pulse-visible'));
    setTimeout(() => pulse.classList.add('readel-miss-pulse-fading'), 80);
    setTimeout(() => { if (pulse.parentNode) pulse.remove(); }, 400);
}
