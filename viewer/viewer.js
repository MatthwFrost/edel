import * as pdfjsLib from './lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

// ── State ──
const BASE_SCALE = 1.5;
let currentZoom = 100;
let numPages = 0;
let currentPage = 1;
let pageElements = [];

const params = new URLSearchParams(location.search);
const pdfUrl = params.get('file');

// ── DOM refs ──
const viewerEl = document.getElementById('viewer');
const wrapperEl = document.getElementById('viewer-wrapper');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const titleEl = document.getElementById('title');
const pageinputEl = document.getElementById('pageinput');
const pagetotalEl = document.getElementById('pagetotal');
const zoomlevelEl = document.getElementById('zoomlevel');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const zoominBtn = document.getElementById('zoomin');
const zoomoutBtn = document.getElementById('zoomout');
const fitwBtn = document.getElementById('fitwidth');
const printBtn = document.getElementById('print');
const downloadBtn = document.getElementById('download');
const openchromeBtn = document.getElementById('openchrome');

// ── Citation patterns ──
const CITATION_INLINE = /\s*\[[\d,;\s\u2013\u2014\u2012–-]+\]\s*/g;
const CITATION_AUTHOR = /\s*\([A-Z][a-z]+(?:\s+(?:et\s+al\.?|&\s*[A-Z][a-z]+))?,?\s*\d{4}[a-z]?\)\s*/g;
const REFERENCES_HEADINGS = /^(references|bibliography|works cited|literature cited)$/i;

// ── Boot ──
if (!pdfUrl) {
    showError('No PDF URL provided.');
} else {
    loadPdf(pdfUrl);
    setupToolbar();
}

function showError(msg) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
}

// ── Toolbar ──

function setupToolbar() {
    prevBtn.addEventListener('click', () => scrollToPage(currentPage - 1));
    nextBtn.addEventListener('click', () => scrollToPage(currentPage + 1));

    pageinputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const n = parseInt(pageinputEl.value, 10);
            if (n >= 1 && n <= numPages) scrollToPage(n);
            else pageinputEl.value = currentPage;
            pageinputEl.blur();
        }
    });
    pageinputEl.addEventListener('blur', () => { pageinputEl.value = currentPage; });

    zoominBtn.addEventListener('click', () => setZoom(currentZoom + 25));
    zoomoutBtn.addEventListener('click', () => setZoom(currentZoom - 25));
    fitwBtn.addEventListener('click', fitToWidth);

    printBtn.addEventListener('click', () => window.print());
    downloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = '';
        a.click();
    });
    openchromeBtn.addEventListener('click', () => {
        chrome.storage.local.set({ 'readel_bypass_pdf': pdfUrl }, () => {
            location.href = pdfUrl;
        });
    });
}

function setZoom(pct) {
    currentZoom = Math.max(50, Math.min(300, pct));
    zoomlevelEl.textContent = currentZoom + '%';
    wrapperEl.style.transform = `scale(${currentZoom / 100})`;
    zoomoutBtn.disabled = currentZoom <= 50;
    zoominBtn.disabled = currentZoom >= 300;
}

function fitToWidth() {
    if (pageElements.length === 0) return;
    const pageW = pageElements[0].offsetWidth;
    const viewportW = document.documentElement.clientWidth - 24;
    setZoom(Math.round((viewportW / pageW) * 100));
}

function scrollToPage(n) {
    if (n < 1 || n > numPages || !pageElements[n - 1]) return;
    pageElements[n - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updatePageIndicator(n) {
    currentPage = n;
    pageinputEl.value = n;
    prevBtn.disabled = n <= 1;
    nextBtn.disabled = n >= numPages;
}

// ── Page tracking ──

function setupPageTracking() {
    const observer = new IntersectionObserver((entries) => {
        let bestPage = currentPage;
        let bestRatio = 0;
        for (const entry of entries) {
            if (entry.intersectionRatio > bestRatio) {
                bestRatio = entry.intersectionRatio;
                const idx = pageElements.indexOf(entry.target);
                if (idx >= 0) bestPage = idx + 1;
            }
        }
        if (bestRatio > 0) updatePageIndicator(bestPage);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    for (const el of pageElements) observer.observe(el);
}

// ── PDF loading ──

async function loadPdf(url) {
    try {
        const data = await fetchPdfData(url);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        numPages = pdf.numPages;

        const filename = extractFilename(url) || 'PDF';
        document.title = filename + ' — Readel';
        titleEl.textContent = filename;
        pagetotalEl.textContent = '/ ' + numPages;
        pageinputEl.value = '1';
        prevBtn.disabled = true;
        nextBtn.disabled = numPages <= 1;
        loadingEl.classList.add('hidden');

        let reachedReferences = false;
        for (let i = 1; i <= numPages; i++) {
            const hitRefs = await renderPage(pdf, i, reachedReferences);
            if (hitRefs) reachedReferences = true;
        }

        setupPageTracking();
        setZoom(100);

        // Start the viewer-integrated TTS player
        setupTtsPlayer();
    } catch (err) {
        console.error('Readel PDF viewer:', err);
        showError('Could not load PDF. The file may be restricted or unavailable.');
    }
}

async function fetchPdfData(url) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetch-pdf', url }, (response) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (response?.error) return reject(new Error(response.error));
            const binary = atob(response.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            resolve(bytes);
        });
    });
}

// ── Page rendering ──

async function renderPage(pdf, pageNum, skipAll) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: BASE_SCALE });

    const container = document.createElement('div');
    container.className = 'page-container';
    container.style.width = viewport.width + 'px';
    container.style.height = viewport.height + 'px';
    container.style.setProperty('--total-scale-factor', BASE_SCALE);

    // Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Text layer (for selection)
    const textContent = await page.getTextContent();
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    container.appendChild(textLayerDiv);

    const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
    });
    await textLayer.render();

    // Build paragraph overlays by reading positions from the rendered spans
    const pageH = viewport.rawDims.pageHeight;
    const hitRefs = buildParagraphOverlays(textLayerDiv, pageH, skipAll);

    viewerEl.appendChild(container);
    pageElements.push(container);
    return hitRefs;
}

// ── Paragraph extraction ──
// Reads positions directly from the pdf.js-rendered spans so coordinates match exactly.

function buildParagraphOverlays(textLayerDiv, pageH, skipAll) {
    const spans = Array.from(textLayerDiv.querySelectorAll('span[role="presentation"]'));
    if (spans.length === 0) return false;

    // Read position + text from each rendered span
    const entries = [];
    for (const span of spans) {
        const text = span.textContent;
        if (!text) continue;

        const top = parseFloat(span.style.top) || 0;       // already a % of page height
        const left = parseFloat(span.style.left) || 0;     // already a % of page width
        const fontPx = parseFloat(span.style.getPropertyValue('--font-height')) || 1;
        const fontPct = (fontPx / pageH) * 100;

        entries.push({ text, top, left, fontPct });
    }
    if (entries.length === 0) return false;

    // Sort top-to-bottom, left-to-right
    entries.sort((a, b) => a.top - b.top || a.left - b.left);

    // Group into lines (similar top position)
    const lines = [[]];
    for (const e of entries) {
        const cur = lines[lines.length - 1];
        if (cur.length === 0 || Math.abs(e.top - cur[0].top) < e.fontPct * 0.5) {
            cur.push(e);
        } else {
            lines.push([e]);
        }
    }

    // Group lines into paragraphs by vertical gap
    const paras = [{ lines: [lines[0]] }];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const prev = paras[paras.length - 1];
        const prevLine = prev.lines[prev.lines.length - 1];
        const gap = line[0].top - (prevLine[0].top + prevLine[0].fontPct);

        if (gap > line[0].fontPct * 0.8) {
            paras.push({ lines: [line] });
        } else {
            prev.lines.push(line);
        }
    }

    // Create overlays
    let hitReferences = false;

    for (const para of paras) {
        const all = para.lines.flat();

        // Build text: items within a line joined directly, lines joined with space
        let rawText = para.lines
            .map(line => line.map(e => e.text).join(''))
            .join(' ')
            .trim();

        if (REFERENCES_HEADINGS.test(rawText)) hitReferences = true;
        if (skipAll || hitReferences) continue;

        // Strip citations
        let text = rawText
            .replace(CITATION_INLINE, ' ')
            .replace(CITATION_AUTHOR, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (!text || text.length < 2) continue;

        // Bounding box from span positions (already in %)
        const top = Math.min(...all.map(e => e.top));
        const bottom = Math.max(...all.map(e => e.top + e.fontPct * 1.4));
        const left = Math.min(...all.map(e => e.left));

        const p = document.createElement('p');
        p.className = 'readel-block';
        p.textContent = text;
        p.style.top = top + '%';
        p.style.left = left + '%';
        p.style.width = (96 - left) + '%';
        p.style.height = (bottom - top) + '%';
        textLayerDiv.appendChild(p);
    }

    return hitReferences;
}

function extractFilename(url) {
    try {
        const path = new URL(url).pathname;
        const name = path.split('/').pop();
        return name ? decodeURIComponent(name.replace(/\.pdf$/i, '')) : null;
    } catch { return null; }
}

// ── Viewer-integrated TTS player ──
// Built directly into the viewer (not reusing inject.js) so we avoid
// extension-page messaging edge cases. Matches Readel's Alt-key UX:
//   • Hold Alt over a paragraph → reads that paragraph
//   • Double-tap Alt → reads from that paragraph onward
//   • Press Alt during continuous reading → stops

const HOLD_THRESHOLD = 300;
const DOUBLE_TAP_WINDOW = 300;

const SENTENCE_RE = /[^.;:\n!?]+[.;:\n!?]+/g;

function splitSentences(text) {
    const out = [];
    let last = 0;
    let m;
    SENTENCE_RE.lastIndex = 0;
    while ((m = SENTENCE_RE.exec(text)) !== null) {
        const s = m[0].trim();
        if (s) out.push(s);
        last = SENTENCE_RE.lastIndex;
    }
    const rem = text.slice(last).trim();
    if (rem) out.push(rem);
    return out;
}

function setupTtsPlayer() {
    injectHighlightStyles();

    // Player state
    let sentences = [];
    let sentenceIndex = 0;
    let isPlaying = false;
    let stopAfterCurrent = false;
    let mode = 'idle';               // 'idle' | 'hold' | 'continuous'
    let sentenceElements = [];       // parallel to sentences — which .readel-block each came from

    // Input state
    let hoverBlock = null;
    let altDown = false;
    let lastAltRelease = 0;
    let holdTimer = null;

    // Receive TTS events (from offscreen's chrome.runtime.sendMessage broadcast)
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action !== 'tts-event') return;
        if (message.type === 'start') {
            isPlaying = true;
            highlightBlock(sentenceElements[sentenceIndex] || null);
        } else if (message.type === 'end') {
            isPlaying = false;
            if (stopAfterCurrent) {
                stopAfterCurrent = false;
                finishPlayback();
                return;
            }
            sentenceIndex++;
            speakCurrent();
        } else if (message.type === 'error') {
            isPlaying = false;
            finishPlayback();
            showToast("Couldn't play audio. Try again.");
        }
    });

    function speakCurrent() {
        if (sentenceIndex >= sentences.length) { finishPlayback(); return; }
        highlightBlock(sentenceElements[sentenceIndex] || null, true);
        chrome.runtime.sendMessage({
            action: 'tts-speak',
            sentence: sentences[sentenceIndex],
        });
    }

    function finishPlayback() {
        mode = 'idle';
        sentences = [];
        sentenceElements = [];
        sentenceIndex = 0;
        stopAfterCurrent = false;
        clearAllHighlights();
        hidePill();
    }

    function stopImmediately() {
        chrome.runtime.sendMessage({ action: 'tts-stop' });
        finishPlayback();
    }

    function startHoldReading() {
        if (!hoverBlock) return;
        const text = hoverBlock.textContent.trim();
        const split = splitSentences(text);
        if (split.length === 0) return;

        mode = 'hold';
        sentences = split;
        sentenceElements = split.map(() => hoverBlock);
        sentenceIndex = 0;
        stopAfterCurrent = false;
        speakCurrent();
    }

    function startContinuousReading() {
        if (!hoverBlock) return;
        // Collect all .readel-block elements from hoverBlock onward (DOM order)
        const allBlocks = Array.from(document.querySelectorAll('.readel-block'));
        const startIdx = allBlocks.indexOf(hoverBlock);
        if (startIdx < 0) return;
        const blocks = allBlocks.slice(startIdx);

        const allSentences = [];
        const allElements = [];
        for (const block of blocks) {
            const split = splitSentences(block.textContent.trim());
            for (const s of split) {
                allSentences.push(s);
                allElements.push(block);
            }
        }
        if (allSentences.length === 0) return;

        mode = 'continuous';
        sentences = allSentences;
        sentenceElements = allElements;
        sentenceIndex = 0;
        stopAfterCurrent = false;
        showPill();
        speakCurrent();
    }

    // Input handlers
    document.addEventListener('mousemove', (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.classList && el.classList.contains('readel-block')) {
            if (hoverBlock !== el) {
                clearHoverTarget();
                hoverBlock = el;
            }
        } else {
            if (hoverBlock) {
                clearHoverTarget();
                hoverBlock = null;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Alt' || e.repeat) return;
        e.preventDefault();

        if (mode === 'continuous') {
            stopImmediately();
            return;
        }
        if (altDown) return;
        altDown = true;

        if (hoverBlock) showHoverTarget(hoverBlock);

        holdTimer = setTimeout(() => {
            holdTimer = null;
            if (altDown && mode === 'idle') startHoldReading();
        }, HOLD_THRESHOLD);
    }, true);

    document.addEventListener('keyup', (e) => {
        if (e.key !== 'Alt') return;
        e.preventDefault();
        if (!altDown) return;
        altDown = false;

        if (mode === 'hold') {
            stopAfterCurrent = true;
            return;
        }

        if (holdTimer !== null) {
            clearTimeout(holdTimer);
            holdTimer = null;

            const now = Date.now();
            if (now - lastAltRelease < DOUBLE_TAP_WINDOW) {
                lastAltRelease = 0;
                startContinuousReading();
            } else {
                lastAltRelease = now;
                clearHoverTarget();
            }
        }
    }, true);

    window.addEventListener('blur', () => {
        if (altDown) {
            altDown = false;
            if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
            if (mode === 'hold') stopAfterCurrent = true;
        }
    });
}

// ── Visual feedback ──

function injectHighlightStyles() {
    if (document.getElementById('readel-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'readel-viewer-styles';
    style.textContent = `
        .readel-block.readel-hover { background-color: rgba(59, 130, 246, 0.15) !important; color: transparent; }
        .readel-block.readel-loading { background-color: rgba(59, 130, 246, 0.15) !important; animation: readel-pulse 1.2s ease-in-out infinite; color: transparent; }
        .readel-block.readel-active { background-color: rgba(59, 130, 246, 0.2) !important; color: transparent; }
        @keyframes readel-pulse {
            0%, 100% { background-color: rgba(59, 130, 246, 0.1) !important; }
            50% { background-color: rgba(59, 130, 246, 0.22) !important; }
        }
        .readel-toast {
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
            background: #1a1a1a; color: #fff; font-size: 13px; padding: 10px 20px;
            border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);
            z-index: 2147483647; opacity: 0; transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .readel-toast.readel-toast-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        .readel-pill {
            position: fixed; top: 52px; left: 50%; transform: translateX(-50%) translateY(-20px);
            background: #1a1a1a; color: #fff; font-size: 13px; padding: 8px 16px;
            border-radius: 100px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            z-index: 2147483647; display: flex; align-items: center; gap: 8px;
            opacity: 0; transition: opacity 0.25s, transform 0.25s;
        }
        .readel-pill.readel-pill-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        .readel-pill-dot {
            width: 6px; height: 6px; border-radius: 50%; background: #3b82f6;
            animation: readel-dot-pulse 1.5s ease-in-out infinite;
        }
        @keyframes readel-dot-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
    `;
    document.head.appendChild(style);
}

function showHoverTarget(el) {
    clearHoverTarget();
    if (el) el.classList.add('readel-hover');
}
function clearHoverTarget() {
    document.querySelectorAll('.readel-hover').forEach(el => el.classList.remove('readel-hover'));
}
function highlightBlock(el, loading) {
    document.querySelectorAll('.readel-active, .readel-loading').forEach(e => {
        e.classList.remove('readel-active', 'readel-loading');
    });
    clearHoverTarget();
    if (el) el.classList.add(loading ? 'readel-loading' : 'readel-active');
}
function clearAllHighlights() {
    document.querySelectorAll('.readel-hover, .readel-active, .readel-loading').forEach(el => {
        el.classList.remove('readel-hover', 'readel-active', 'readel-loading');
    });
}

let pillEl = null;
function showPill() {
    hidePill();
    const pill = document.createElement('div');
    pill.className = 'readel-pill';
    pill.innerHTML = '<div class="readel-pill-dot"></div>Reading';
    document.body.appendChild(pill);
    pillEl = pill;
    requestAnimationFrame(() => pill.classList.add('readel-pill-visible'));
}
function hidePill() {
    if (!pillEl) return;
    pillEl.classList.remove('readel-pill-visible');
    const el = pillEl;
    pillEl = null;
    setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
}

let toastTimer = null;
function showToast(msg) {
    let toast = document.querySelector('.readel-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'readel-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => toast.classList.add('readel-toast-visible'));
    toastTimer = setTimeout(() => toast.classList.remove('readel-toast-visible'), 3000);
}
