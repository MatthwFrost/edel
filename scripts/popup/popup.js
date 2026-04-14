document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voice-select');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');

    // Apply banner — shows once at the bottom when any setting changes
    let applyBanner = null;

    function showRefresh() {
        if (applyBanner) return;
        applyBanner = document.createElement('div');
        applyBanner.className = 'apply-banner';
        applyBanner.innerHTML = '<button class="apply-btn">↻ Apply changes</button>';
        document.querySelector('.container').appendChild(applyBanner);

        applyBanner.querySelector('.apply-btn').addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
            applyBanner.remove();
            applyBanner = null;
        });
    }

    // Speed mapping: slider 0-100 → display 0.5x-2x → actual 0.6-1.5
    // Display 1x = actual 1.5 (max Cartesia speed)
    function sliderToActual(v) { return 0.6 + (v / 100) * 0.9; }
    function actualToSlider(a) { return Math.round(((a - 0.6) / 0.9) * 100); }
    function sliderToDisplay(v) {
        // Map 0→0.5x, 50→1x, 100→2x (but 50 = actual 1.05, 100 = actual 1.5 which we label 2x)
        const actual = sliderToActual(v);
        // Remap: actual 0.6=0.5x, actual 1.05=1x, actual 1.5=2x
        if (actual <= 1.05) {
            // 0.6→0.5, 1.05→1.0
            return (0.5 + ((actual - 0.6) / 0.45) * 0.5).toFixed(1);
        } else {
            // 1.05→1.0, 1.5→2.0
            return (1.0 + ((actual - 1.05) / 0.45) * 1.0).toFixed(1);
        }
    }

    // Load saved settings
    chrome.storage.local.get(['voiceID', 'playbackRate', 'volumeValue'], (items) => {
        if (items.voiceID) voiceSelect.value = items.voiceID;
        const rate = parseFloat(items.playbackRate);
        if (rate >= 0.6 && rate <= 1.5) {
            speedSlider.value = actualToSlider(rate);
            speedValue.textContent = sliderToDisplay(actualToSlider(rate)) + 'x';
        }
        if (items.volumeValue) {
            volumeSlider.value = items.volumeValue;
            volumeValue.textContent = Math.round(items.volumeValue * 100) + '%';
        }
    });

    voiceSelect.addEventListener('change', () => {
        chrome.storage.local.set({ 'voiceID': voiceSelect.value });
        showRefresh();
    });

    speedSlider.addEventListener('input', () => {
        const v = parseInt(speedSlider.value);
        speedValue.textContent = sliderToDisplay(v) + 'x';
        chrome.storage.local.set({ 'playbackRate': sliderToActual(v).toFixed(2) });
        showRefresh();
    });

    volumeSlider.addEventListener('input', () => {
        const vol = volumeSlider.value;
        volumeValue.textContent = Math.round(vol * 100) + '%';
        chrome.storage.local.set({ 'volumeValue': vol });
        showRefresh();
    });

    // Hotkey picker
    const hotkeyPicker = document.getElementById('hotkey-picker');
    const hotkeyDisplay = document.getElementById('hotkey-display');
    const hotkeyReset = document.getElementById('hotkey-reset');
    let recording = false;

    const IS_MAC = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
    const DEFAULT_HOTKEY = { key: 'Alt', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false };

    function keyLabel(key) {
        if (IS_MAC) {
            if (key === 'Alt') return 'Option';
            if (key === 'Meta') return 'Cmd';
            if (key === 'Control') return 'Ctrl';
        } else {
            if (key === 'Control') return 'Ctrl';
        }
        return key;
    }

    function formatHotkey(hk) {
        const parts = [];
        if (hk.ctrlKey) parts.push(keyLabel('Control'));
        if (hk.shiftKey) parts.push('Shift');
        if (hk.altKey && hk.key !== 'Alt') parts.push(keyLabel('Alt'));
        if (hk.metaKey) parts.push(keyLabel('Meta'));
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(hk.key)) {
            parts.push(hk.key.length === 1 ? hk.key.toUpperCase() : hk.key);
        } else if (parts.length === 0) {
            parts.push(keyLabel(hk.key));
        }
        return parts.join(' + ');
    }

    chrome.storage.local.get('hotkey', (items) => {
        const hk = items.hotkey || DEFAULT_HOTKEY;
        hotkeyDisplay.textContent = formatHotkey(hk);
    });

    const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
    let heldModifiers = {};

    hotkeyPicker.addEventListener('click', () => {
        recording = true;
        heldModifiers = {};
        hotkeyPicker.classList.add('recording');
        hotkeyDisplay.textContent = 'Press a key...';
    });

    document.addEventListener('keydown', (e) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();

        if (MODIFIERS.has(e.key)) {
            // Modifier pressed — show it but wait for a regular key
            heldModifiers = { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey };
            const parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.shiftKey) parts.push('Shift');
            if (e.altKey) parts.push('Alt');
            if (e.metaKey) parts.push('Meta');
            hotkeyDisplay.textContent = parts.join(' + ') + ' + ...';
            return;
        }

        // Regular key pressed — save the full combo
        const hotkey = {
            key: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey
        };
        saveHotkey(hotkey);
    });

    document.addEventListener('keyup', (e) => {
        if (!recording) return;
        if (!MODIFIERS.has(e.key)) return;
        e.preventDefault();
        e.stopPropagation();

        // Modifier released without a regular key — save modifier alone
        const hotkey = {
            key: e.key,
            ctrlKey: e.key === 'Control',
            shiftKey: e.key === 'Shift',
            altKey: e.key === 'Alt',
            metaKey: e.key === 'Meta'
        };
        saveHotkey(hotkey);
    });

    function saveHotkey(hotkey) {
        recording = false;
        heldModifiers = {};
        hotkeyPicker.classList.remove('recording');
        hotkeyDisplay.textContent = formatHotkey(hotkey);
        chrome.storage.local.set({ 'hotkey': hotkey });
        showRefresh();
    }

    // Clicking outside cancels recording
    document.addEventListener('click', (e) => {
        if (recording && e.target !== hotkeyPicker && !hotkeyPicker.contains(e.target)) {
            recording = false;
            heldModifiers = {};
            hotkeyPicker.classList.remove('recording');
            chrome.storage.local.get('hotkey', (items) => {
                hotkeyDisplay.textContent = formatHotkey(items.hotkey || DEFAULT_HOTKEY);
            });
        }
    });

    hotkeyReset.addEventListener('click', () => {
        chrome.storage.local.set({ 'hotkey': DEFAULT_HOTKEY });
        hotkeyDisplay.textContent = formatHotkey(DEFAULT_HOTKEY);
    });

    // Auto-scroll toggle
    const autoscrollToggle = document.getElementById('autoscroll-toggle');
    chrome.storage.local.get('autoScrollEnabled', (items) => {
        autoscrollToggle.checked = items.autoScrollEnabled !== false;
    });
    autoscrollToggle.addEventListener('change', () => {
        chrome.storage.local.set({ 'autoScrollEnabled': autoscrollToggle.checked });
        showRefresh();
    });

    // Subtitles toggle
    const subtitlesToggle = document.getElementById('subtitles-toggle');
    chrome.storage.local.get('subtitlesEnabled', (items) => {
        subtitlesToggle.checked = items.subtitlesEnabled || false;
    });
    subtitlesToggle.addEventListener('change', () => {
        chrome.storage.local.set({ 'subtitlesEnabled': subtitlesToggle.checked });
        showRefresh();
    });

    // Character usage display
    const charsUsedEl = document.getElementById('chars-used');
    function formatChars(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    }
    function renderChars() {
        chrome.storage.local.get('charactersUsed', (items) => {
            const used = typeof items.charactersUsed === 'number' ? items.charactersUsed : 0;
            charsUsedEl.textContent = `${formatChars(used)} CHARS`;
        });
    }
    renderChars();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.charactersUsed) renderChars();
    });

    // Response time display
    const responseTimeEl = document.getElementById('response-time');
    chrome.storage.local.get('avgResponseTime', (items) => {
        const avg = items.avgResponseTime;
        if (!avg) return;
        const ms = Math.round(avg);
        const dotClass = ms < 200 ? 'fast' : ms < 500 ? 'medium' : 'slow';
        responseTimeEl.replaceChildren();
        const dot = document.createElement('span');
        dot.className = `response-dot ${dotClass}`;
        responseTimeEl.appendChild(dot);
        responseTimeEl.appendChild(document.createTextNode(`${ms}MS`));
    });
});
