const BLOCK_TAGS = new Set([
    'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'PRE', 'DD', 'DT'
]);

const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'HEADER', 'ASIDE',
    'NOSCRIPT', 'SVG', 'IFRAME', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'
]);

function buildSentenceRanges(element, sentences) {
    const ranges = [];
    try {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let accumulated = '';
        let node;
        while (node = walker.nextNode()) {
            textNodes.push({ node, start: accumulated.length });
            accumulated += node.textContent;
        }
        let searchFrom = 0;
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            const idx = accumulated.indexOf(trimmed, searchFrom);
            if (idx === -1) { ranges.push(null); continue; }
            const endIdx = idx + trimmed.length;
            searchFrom = endIdx;
            const range = new Range();
            let startSet = false;
            for (const { node: tn, start } of textNodes) {
                const nodeEnd = start + tn.textContent.length;
                if (!startSet && nodeEnd > idx) {
                    range.setStart(tn, idx - start);
                    startSet = true;
                }
                if (startSet && nodeEnd >= endIdx) {
                    range.setEnd(tn, endIdx - start);
                    break;
                }
            }
            ranges.push(startSet ? range : null);
        }
    } catch (e) { /* fallback to nulls */ }
    return ranges;
}

export function splitIntoSentences(text) {
    const sentences = [];
    const regex = /[^.;:\n!?]+[.;:\n!?]+/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const s = match[0].trim();
        if (s.length > 0) sentences.push(s);
        lastIndex = regex.lastIndex;
    }
    // Capture any remaining text that doesn't end with punctuation
    const remainder = text.slice(lastIndex).trim();
    if (remainder.length > 0) sentences.push(remainder);
    return sentences;
}

export function getTextFromElement(element) {
    const text = (element.innerText || '').trim();
    return splitIntoSentences(text);
}

export function getTextFromSelection(selectedText) {
    return splitIntoSentences(selectedText);
}

export function getTextFromSelectionOnward(selectedText) {
    // Get all page text from the element containing the selection onward
    const selection = window.getSelection();
    if (!selection.rangeCount) return { sentences: splitIntoSentences(selectedText), sentenceMap: [] };

    const range = selection.getRangeAt(0);
    let startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;

    // Walk up to nearest block element
    while (startNode && !BLOCK_TAGS.has(startNode.tagName) && startNode !== document.body) {
        startNode = startNode.parentElement;
    }

    if (!startNode || startNode === document.body) {
        return { sentences: splitIntoSentences(selectedText), sentenceMap: [] };
    }

    // Get text from this element onward, but start from the selected text
    const { sentences, sentenceMap } = getTextFromElementOnward(startNode);

    // Find where the selected text starts in the sentences
    const selectedStart = selectedText.substring(0, 30).trim();
    let startIdx = 0;
    for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].includes(selectedStart)) {
            startIdx = i;
            break;
        }
    }

    return {
        sentences: sentences.slice(startIdx),
        sentenceMap: sentenceMap.slice(startIdx)
    };
}

export function getTextFromElementOnward(startElement) {
    const sentences = [];
    const sentenceMap = [];

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode(node) {
                if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
                if (BLOCK_TAGS.has(node.tagName)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    // Advance walker to startElement or past it
    let found = false;
    let current = walker.nextNode();
    while (current) {
        if (current === startElement || startElement.contains(current) || current.contains(startElement)) {
            found = true;
            break;
        }
        current = walker.nextNode();
    }

    if (!found) {
        // Fallback: just use the startElement itself
        const text = (startElement.innerText || '').trim();
        const elementSentences = splitIntoSentences(text);
        elementSentences.forEach(s => {
            sentences.push(s);
            sentenceMap.push({ element: startElement });
        });
        return { sentences, sentenceMap };
    }

    // Collect from current position onward
    while (current) {
        const text = (current.innerText || '').trim();
        if (text.length > 0) {
            const elementSentences = splitIntoSentences(text);
            const ranges = buildSentenceRanges(current, elementSentences);
            elementSentences.forEach((s, i) => {
                sentences.push(s);
                sentenceMap.push({ element: current, range: ranges[i] || null });
            });
        }
        current = walker.nextNode();
    }

    return { sentences, sentenceMap };
}
