export function isReadableBlock(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE || !el.isConnected) return false;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return false;
  if (tag === 'SVG' || tag === 'IFRAME' || tag === 'CANVAS') return false;

  const style = getComputedStyle(el);
  if (!style) return false;
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (style.display && style.display.startsWith('inline')) return false;

  let ownText = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      ownText += child.textContent;
      if (ownText.trim().length >= 2) return true;
    }
  }
  return ownText.trim().length >= 2;
}

const INLINE_TAGS = new Set([
  'A', 'ABBR', 'ACRONYM', 'B', 'BDO', 'BIG', 'BR', 'CITE', 'CODE',
  'DFN', 'EM', 'I', 'IMG', 'INPUT', 'KBD', 'LABEL', 'MAP', 'OBJECT',
  'OUTPUT', 'Q', 'SAMP', 'SELECT', 'SMALL', 'SPAN', 'STRONG', 'SUB',
  'SUP', 'TEXTAREA', 'TIME', 'TT', 'U', 'VAR'
]);

function isBlockLikeEl(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (INLINE_TAGS.has(el.tagName)) return false;
  return isReadableBlock(el);
}

export function resolveTextBlockAtPoint(x, y) {
  // Step 1 — caret point, walk up to readable block
  let caret = null;
  if (typeof document.caretPositionFromPoint === 'function') {
    caret = document.caretPositionFromPoint(x, y);
  } else if (typeof document.caretRangeFromPoint === 'function') {
    caret = document.caretRangeFromPoint(x, y);
  }
  if (caret) {
    const node = caret.offsetNode || caret.startContainer || null;
    if (node && node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
      let el = node.parentElement;
      while (el && el !== document.body) {
        if (isBlockLikeEl(el)) return el;
        el = el.parentElement;
      }
    }
  }

  // Step 2 — elementFromPoint walk-up
  const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
  let el = hit;
  while (el && el !== document.body) {
    if (isReadableBlock(el)) return el;
    el = el.parentElement;
  }

  // Step 3 — active non-empty selection
  const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
    return { kind: 'selection', text: sel.toString().trim() };
  }

  // Step 4 — silent (caller shows miss pulse)
  return null;
}


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

    // Walk up to nearest readable block element
    while (startNode && !isReadableBlock(startNode) && startNode !== document.body) {
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

export function findScopeRoot(startEl) {
  let el = startEl && startEl.parentElement;
  while (el && el !== document.body) {
    const elText = el.innerText || el.textContent || '';
    const textLen = elText.length;
    if (textLen > 500) {
      let linkLen = 0;
      for (const a of el.querySelectorAll('a')) {
        linkLen += (a.innerText || a.textContent || '').length;
      }
      const ratio = (textLen - linkLen) / textLen;
      if (ratio > 0.4) return el;
    }
    el = el.parentElement;
  }
  return document.body;
}

function isSkippableForWalk(el) {
  if (el.tagName === 'ASIDE') return true;
  const role = el.getAttribute && el.getAttribute('role');
  if (role === 'navigation' || role === 'complementary') return true;
  if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return true;
  const style = getComputedStyle(el);
  if (style && (style.position === 'fixed' || style.position === 'sticky')) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.height < 80) return true;
  }
  return false;
}

function tokenSet(text) {
  return new Set(
    text.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(t => t.length > 2)
  );
}

function overlapRatio(prev, next) {
  if (!prev || !next) return 0;
  const a = tokenSet(prev);
  const b = tokenSet(next);
  if (a.size < 4 || b.size < 4) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / Math.min(a.size, b.size);
}

const CHAR_CLIP = 30000;

export function getTextFromElementOnward(startElement) {
  const sentences = [];
  const sentenceMap = [];
  let totalChars = 0;
  let lastBlockText = '';

  const scopeRoot = findScopeRoot(startElement);

  const walker = document.createTreeWalker(
    scopeRoot,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (isSkippableForWalk(node)) return NodeFilter.FILTER_REJECT;
        if (isReadableBlock(node)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

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
    const text = (startElement.innerText || startElement.textContent || '').trim();
    for (const s of splitIntoSentences(text)) {
      sentences.push(s);
      sentenceMap.push({ element: startElement });
    }
    return { sentences, sentenceMap };
  }

  while (current) {
    const blockText = (current.innerText || current.textContent || '').trim();
    if (blockText.length > 0 && overlapRatio(lastBlockText, blockText) < 0.9) {
      const elementSentences = splitIntoSentences(blockText);
      const ranges = buildSentenceRanges(current, elementSentences);
      for (let i = 0; i < elementSentences.length; i++) {
        const s = elementSentences[i];
        if (totalChars + s.length > CHAR_CLIP) {
          return { sentences, sentenceMap };
        }
        sentences.push(s);
        sentenceMap.push({ element: current, range: ranges[i] || null });
        totalChars += s.length;
      }
      lastBlockText = blockText;
    }
    current = walker.nextNode();
  }

  // Second pass: open shadow roots within scope. Closed shadow roots are invisible to us.
  const hosts = scopeRoot.querySelectorAll('*');
  for (const host of hosts) {
    const shadow = host.shadowRoot;
    if (!shadow || shadow.mode !== 'open') continue;
    const shadowWalker = document.createTreeWalker(
      shadow,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (isSkippableForWalk(node)) return NodeFilter.FILTER_REJECT;
          if (isReadableBlock(node)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    let sCur = shadowWalker.nextNode();
    while (sCur) {
      const blockText = (sCur.innerText || sCur.textContent || '').trim();
      if (blockText.length > 0) {
        const elementSentences = splitIntoSentences(blockText);
        for (const s of elementSentences) {
          if (totalChars + s.length > CHAR_CLIP) {
            return { sentences, sentenceMap };
          }
          sentences.push(s);
          sentenceMap.push({ element: sCur, range: null });
          totalChars += s.length;
        }
      }
      sCur = shadowWalker.nextNode();
    }
  }

  return { sentences, sentenceMap };
}
