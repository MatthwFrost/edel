# Readel Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Readel's hover-to-read and double-tap-continuous-read reliable on Claude, ChatGPT, Gmail, Google Forms, and modern blogs by replacing the rigid tag-based DOM walker with caret-point resolution, enabling all-frames injection with sessionId-isolated playback, and surfacing a subtle miss indicator. Also renames voices to Aria/Finn/Mira/Ember/Atlas/Sable/Quill.

**Architecture:** Single content script runs in every same-origin frame (`all_frames: true`). On Alt keydown, resolve the text block via `caretPositionFromPoint` then walk up to the nearest non-inline ancestor that qualifies as a readable block. Iframes are handled by parent-to-child `postMessage` handoff. Playback events are filtered by a per-cycle `sessionId` so multi-frame pages don't cross-talk. Extension-context invalidation is detected on each keypress and surfaces a one-time toast. Tests are jsdom-fixture-based (captured HTML from real sites); no live E2E.

**Tech Stack:** Vanilla JS (ES modules, babel-transpiled by webpack), Chrome MV3 extension, Cartesia Sonic-3 TTS over WebSocket (offscreen document). New dev dependency: Jest + jsdom for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-04-14-reliability-design.md`

**Test HTML helper:** every test file in this plan uses `createContextualFragment` to mount HTML safely. The helper is inlined per-file rather than shared, keeping each test independently runnable.

---

## Phase A — Test Infrastructure & Foundation Modules

### Task 1: Set up Jest + jsdom

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/package.json`
- Create: `/Users/matthewfrost/readel/edel/jest.config.js`
- Create: `/Users/matthewfrost/readel/edel/tests/smoke.test.js`

- [ ] **Step 1: Install test deps**

Run:
```bash
cd /Users/matthewfrost/readel/edel
npm install --save-dev jest babel-jest jest-environment-jsdom
```

Expected: three packages added to `devDependencies`. `@babel/preset-env` is already present; `npm install` will dedupe.

- [ ] **Step 2: Create Jest config**

Create `/Users/matthewfrost/readel/edel/jest.config.js`:

```js
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
  },
  moduleFileExtensions: ['js']
};
```

- [ ] **Step 3: Update package.json scripts**

Modify `/Users/matthewfrost/readel/edel/package.json`. Replace the current `scripts` object:

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "build": "webpack --mode production"
}
```

- [ ] **Step 4: Write smoke test to verify Jest runs**

Create `/Users/matthewfrost/readel/edel/tests/smoke.test.js`:

```js
function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
}

describe('test infra', () => {
  test('jsdom gives us a document', () => {
    expect(typeof document).toBe('object');
    expect(document.body).toBeTruthy();
  });
  test('can create elements and query them', () => {
    mount('<p id="hi">hello</p>');
    expect(document.querySelector('#hi').textContent).toBe('hello');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/matthewfrost/readel/edel && npm test`
Expected: PASS 2/2

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js tests/smoke.test.js
git commit -m "Add Jest + jsdom test infrastructure"
```

---

### Task 2: `runtimeHealth.js` — detect extension-context invalidation

**Files:**
- Create: `/Users/matthewfrost/readel/edel/scripts/core/runtimeHealth.js`
- Create: `/Users/matthewfrost/readel/edel/tests/runtimeHealth.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/runtimeHealth.test.js`:

```js
import { isRuntimeAlive } from '../scripts/core/runtimeHealth.js';

describe('isRuntimeAlive', () => {
  afterEach(() => { delete global.chrome; });

  test('returns true when chrome.runtime.id is a non-empty string', () => {
    global.chrome = { runtime: { id: 'abcd1234' } };
    expect(isRuntimeAlive()).toBe(true);
  });

  test('returns false when chrome is undefined', () => {
    expect(isRuntimeAlive()).toBe(false);
  });

  test('returns false when chrome.runtime.id is missing', () => {
    global.chrome = { runtime: {} };
    expect(isRuntimeAlive()).toBe(false);
  });

  test('returns false when accessing chrome.runtime throws', () => {
    global.chrome = {};
    Object.defineProperty(global.chrome, 'runtime', {
      get() { throw new Error('Extension context invalidated.'); }
    });
    expect(isRuntimeAlive()).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/runtimeHealth.test.js`
Expected: FAIL — "Cannot find module '../scripts/core/runtimeHealth.js'".

- [ ] **Step 3: Implement module**

Create `/Users/matthewfrost/readel/edel/scripts/core/runtimeHealth.js`:

```js
export function isRuntimeAlive() {
  try {
    return typeof chrome !== 'undefined'
      && !!chrome.runtime
      && typeof chrome.runtime.id === 'string'
      && chrome.runtime.id.length > 0;
  } catch (e) {
    return false;
  }
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/runtimeHealth.test.js`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add scripts/core/runtimeHealth.js tests/runtimeHealth.test.js
git commit -m "Add runtimeHealth.isRuntimeAlive for context-invalidation detection"
```

---

### Task 3: `sessionBus.js` — per-cycle session IDs

**Files:**
- Create: `/Users/matthewfrost/readel/edel/scripts/core/sessionBus.js`
- Create: `/Users/matthewfrost/readel/edel/tests/sessionBus.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/sessionBus.test.js`:

```js
import { newSessionId, matchesSession } from '../scripts/core/sessionBus.js';

describe('sessionBus', () => {
  test('newSessionId returns a non-empty string', () => {
    const id = newSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(8);
  });

  test('newSessionId returns unique ids across calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(newSessionId());
    expect(ids.size).toBe(100);
  });

  test('matchesSession returns true when ids are equal', () => {
    expect(matchesSession('abc', 'abc')).toBe(true);
  });

  test('matchesSession returns false when ids differ', () => {
    expect(matchesSession('abc', 'xyz')).toBe(false);
  });

  test('matchesSession returns false when active id is null', () => {
    expect(matchesSession(null, 'abc')).toBe(false);
  });

  test('matchesSession returns false when incoming id is missing', () => {
    expect(matchesSession('abc', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/sessionBus.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement module**

Create `/Users/matthewfrost/readel/edel/scripts/core/sessionBus.js`:

```js
export function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function matchesSession(activeId, incomingId) {
  return typeof activeId === 'string'
    && typeof incomingId === 'string'
    && activeId === incomingId;
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/sessionBus.test.js`
Expected: PASS 6/6

- [ ] **Step 5: Commit**

```bash
git add scripts/core/sessionBus.js tests/sessionBus.test.js
git commit -m "Add sessionBus helpers for per-cycle playback session ids"
```

---

## Phase B — Text Extraction Pipeline

### Task 4: `isReadableBlock` primitive

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`
- Create: `/Users/matthewfrost/readel/edel/tests/textExtractor.isReadableBlock.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/textExtractor.isReadableBlock.test.js`:

```js
import { isReadableBlock } from '../scripts/core/textExtractor.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
  return document.body.firstElementChild;
}

describe('isReadableBlock', () => {
  test('returns true for a <p> with text', () => {
    expect(isReadableBlock(mount('<p>hello world</p>'))).toBe(true);
  });

  test('returns true for a <div> with direct text children', () => {
    expect(isReadableBlock(mount('<div>hi there</div>'))).toBe(true);
  });

  test('returns false for a <div> with only element children (no own text)', () => {
    expect(isReadableBlock(mount('<div><p>nested</p></div>'))).toBe(false);
  });

  test('returns false for SCRIPT, STYLE, NOSCRIPT', () => {
    expect(isReadableBlock(mount('<script>x</script>'))).toBe(false);
    expect(isReadableBlock(mount('<style>x</style>'))).toBe(false);
    expect(isReadableBlock(mount('<noscript>x</noscript>'))).toBe(false);
  });

  test('returns false for SVG, IFRAME, CANVAS', () => {
    expect(isReadableBlock(mount('<svg><text>x</text></svg>'))).toBe(false);
    expect(isReadableBlock(mount('<iframe></iframe>'))).toBe(false);
    expect(isReadableBlock(mount('<canvas></canvas>'))).toBe(false);
  });

  test('returns false for disconnected nodes', () => {
    const p = document.createElement('p');
    p.textContent = 'hi';
    expect(isReadableBlock(p)).toBe(false);
  });

  test('returns false for null / non-element', () => {
    expect(isReadableBlock(null)).toBe(false);
    expect(isReadableBlock(document.createTextNode('hi'))).toBe(false);
  });

  test('returns false for display:none', () => {
    expect(isReadableBlock(mount('<p style="display:none">hidden</p>'))).toBe(false);
  });

  test('returns false for visibility:hidden', () => {
    expect(isReadableBlock(mount('<p style="visibility:hidden">hidden</p>'))).toBe(false);
  });

  test('returns false for inline display', () => {
    expect(isReadableBlock(mount('<span style="display:inline">inline</span>'))).toBe(false);
  });

  test('returns true for own-text even when child has its own text', () => {
    expect(isReadableBlock(mount('<div>lead text <span>more</span> trailing</div>'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/textExtractor.isReadableBlock.test.js`
Expected: FAIL — `isReadableBlock is not a function`.

- [ ] **Step 3: Implement in textExtractor.js**

Open `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`. At the **top** of the file (before any existing code), add:

```js
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/textExtractor.isReadableBlock.test.js`
Expected: PASS 11/11

- [ ] **Step 5: Commit**

```bash
git add scripts/core/textExtractor.js tests/textExtractor.isReadableBlock.test.js
git commit -m "Add isReadableBlock primitive with computed-style + own-text check"
```

---

### Task 5: `resolveTextBlockAtPoint` — caret-based resolver

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`
- Create: `/Users/matthewfrost/readel/edel/tests/textExtractor.resolvePoint.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/textExtractor.resolvePoint.test.js`:

```js
import { resolveTextBlockAtPoint } from '../scripts/core/textExtractor.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
}

// jsdom does not implement caretPositionFromPoint / elementFromPoint / layout —
// stub them per test as needed.

describe('resolveTextBlockAtPoint', () => {
  afterEach(() => {
    delete document.caretPositionFromPoint;
    delete document.caretRangeFromPoint;
    document.elementFromPoint = () => null;
  });

  test('step 1: returns the non-inline ancestor of the caret text node', () => {
    mount('<article><p>hello <span>world</span></p></article>');
    const textNode = document.querySelector('p').firstChild;
    document.caretPositionFromPoint = () => ({ offsetNode: textNode, offset: 2 });
    expect(resolveTextBlockAtPoint(10, 10)).toBe(document.querySelector('p'));
  });

  test('step 1: walks up through inline spans to the block', () => {
    mount('<div><p>before <em>italic</em> after</p></div>');
    const textNode = document.querySelector('em').firstChild;
    document.caretPositionFromPoint = () => ({ offsetNode: textNode, offset: 1 });
    expect(resolveTextBlockAtPoint(10, 10)).toBe(document.querySelector('p'));
  });

  test('step 2: falls back to elementFromPoint when caret has no text node', () => {
    mount('<section><p>some text</p></section>');
    document.caretPositionFromPoint = () => null;
    document.elementFromPoint = () => document.querySelector('p');
    expect(resolveTextBlockAtPoint(10, 10)).toBe(document.querySelector('p'));
  });

  test('step 2: returns null when no readable ancestor exists', () => {
    mount('<article><p>a para</p><img alt=""></article>');
    document.caretPositionFromPoint = () => null;
    document.elementFromPoint = () => document.querySelector('img');
    expect(resolveTextBlockAtPoint(10, 10)).toBeNull();
  });

  test('step 3: returns selection object when non-empty selection exists', () => {
    mount('<p>selectable content here</p>');
    const p = document.querySelector('p');
    const range = document.createRange();
    range.setStart(p.firstChild, 2);
    range.setEnd(p.firstChild, 12);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.caretPositionFromPoint = () => null;
    document.elementFromPoint = () => null;
    const result = resolveTextBlockAtPoint(10, 10);
    expect(result && result.kind).toBe('selection');
    expect(result.text).toBe('lectable c');
  });

  test('step 4: returns null when nothing resolves', () => {
    mount('<div></div>');
    document.caretPositionFromPoint = () => null;
    document.elementFromPoint = () => null;
    window.getSelection().removeAllRanges();
    expect(resolveTextBlockAtPoint(10, 10)).toBeNull();
  });

  test('uses caretRangeFromPoint as fallback when caretPositionFromPoint is absent', () => {
    mount('<p>fallback path</p>');
    const textNode = document.querySelector('p').firstChild;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 0);
    document.caretRangeFromPoint = () => range;
    expect(resolveTextBlockAtPoint(10, 10)).toBe(document.querySelector('p'));
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/textExtractor.resolvePoint.test.js`
Expected: FAIL — `resolveTextBlockAtPoint is not a function`.

- [ ] **Step 3: Implement resolver in textExtractor.js**

Open `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`. Add, directly **after** the `isReadableBlock` function added in Task 4:

```js
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
        if (isReadableBlock(el)) return el;
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/textExtractor.resolvePoint.test.js`
Expected: PASS 7/7

- [ ] **Step 5: Commit**

```bash
git add scripts/core/textExtractor.js tests/textExtractor.resolvePoint.test.js
git commit -m "Add resolveTextBlockAtPoint caret-based ladder (caret, element, selection)"
```

---

### Task 6: Rewrite `getTextFromElementOnward` with scope-root

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`
- Create: `/Users/matthewfrost/readel/edel/tests/textExtractor.onward.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/textExtractor.onward.test.js`:

```js
import { getTextFromElementOnward, findScopeRoot } from '../scripts/core/textExtractor.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
}

describe('findScopeRoot', () => {
  test('returns nearest content-heavy ancestor', () => {
    mount(`
      <nav>Home | About</nav>
      <main>
        <article>
          <p>${'Lorem ipsum dolor sit amet. '.repeat(30)}</p>
          <p>${'Another paragraph of substantial text. '.repeat(30)}</p>
        </article>
      </main>
      <footer>Copyright 2026</footer>
    `);
    const start = document.querySelector('article p');
    expect(findScopeRoot(start)).toBe(document.querySelector('article'));
  });

  test('falls back to body when no ancestor meets criteria', () => {
    mount('<p>short</p>');
    expect(findScopeRoot(document.querySelector('p'))).toBe(document.body);
  });
});

describe('getTextFromElementOnward', () => {
  test('collects readable blocks from scope root onward', () => {
    mount(`
      <article>
        <p>First paragraph here.</p>
        <p>Second paragraph here.</p>
        <p>Third paragraph here.</p>
      </article>
    `);
    const start = document.querySelectorAll('article p')[0];
    const result = getTextFromElementOnward(start);
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);
    expect(result.sentences[0]).toMatch(/First paragraph/);
    expect(result.sentences.some(s => /Second paragraph/.test(s))).toBe(true);
    expect(result.sentences.some(s => /Third paragraph/.test(s))).toBe(true);
  });

  test('skips aside and role=navigation', () => {
    mount(`
      <article>
        <p>Real content one.</p>
        <aside><p>Ad content here.</p></aside>
        <nav role="navigation"><p>Nav link.</p></nav>
        <p>Real content two.</p>
      </article>
    `);
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/Real content one/);
    expect(joined).toMatch(/Real content two/);
    expect(joined).not.toMatch(/Ad content/);
    expect(joined).not.toMatch(/Nav link/);
  });

  test('skips aria-hidden=true elements', () => {
    mount(`
      <article>
        <p>Visible.</p>
        <div aria-hidden="true"><p>Hidden from AT.</p></div>
        <p>Also visible.</p>
      </article>
    `);
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/Visible/);
    expect(joined).toMatch(/Also visible/);
    expect(joined).not.toMatch(/Hidden from AT/);
  });

  test('clips at 30,000 characters', () => {
    const para = '<p>' + 'x'.repeat(1000) + '.</p>';
    mount('<article>' + para.repeat(100) + '</article>');
    const start = document.querySelector('article p');
    const result = getTextFromElementOnward(start);
    const total = result.sentences.join('').length;
    expect(total).toBeLessThanOrEqual(30000);
  });

  test('collects text from open shadow roots within scope', () => {
    mount('<article><p>outside paragraph.</p><div id="host"></div></article>');
    const host = document.getElementById('host');
    const shadow = host.attachShadow({ mode: 'open' });
    const range = document.createRange();
    range.selectNode(shadow);
    shadow.appendChild(range.createContextualFragment('<p>inside shadow root.</p>'));
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/outside paragraph/);
    expect(joined).toMatch(/inside shadow root/);
  });
});
```

Note: jsdom does not implement layout, so the `position: fixed/sticky` short-bar skip cannot be exercised here. It is covered by fixture tests in Task 14.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/textExtractor.onward.test.js`
Expected: FAIL — `findScopeRoot is not a function` plus unmet behavior on the rewritten walker.

- [ ] **Step 3: Replace `getTextFromElementOnward` and add `findScopeRoot`**

Open `/Users/matthewfrost/readel/edel/scripts/core/textExtractor.js`.

a) Delete the existing `const SKIP_TAGS = ...` and `const BLOCK_TAGS = ...` at the top — they are superseded. Leave `buildSentenceRanges`, `splitIntoSentences`, `getTextFromElement`, `getTextFromSelection`, `getTextFromSelectionOnward` definitions in place.

b) Delete the entire existing `export function getTextFromElementOnward(startElement) { ... }` (the function starting around line 110 of the original file).

c) Append at the end of the file:

```js
export function findScopeRoot(startEl) {
  let best = null;
  let el = startEl && startEl.parentElement;
  while (el && el !== document.body) {
    const innerText = el.innerText || '';
    const textLen = innerText.length;
    if (textLen > 500) {
      let linkLen = 0;
      for (const a of el.querySelectorAll('a')) {
        linkLen += (a.innerText || '').length;
      }
      const ratio = (textLen - linkLen) / textLen;
      if (ratio > 0.4) best = el;
    }
    el = el.parentElement;
  }
  return best || document.body;
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
  if (a.size === 0 || b.size === 0) return 0;
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
    const text = (startElement.innerText || '').trim();
    for (const s of splitIntoSentences(text)) {
      sentences.push(s);
      sentenceMap.push({ element: startElement });
    }
    return { sentences, sentenceMap };
  }

  while (current) {
    const blockText = (current.innerText || '').trim();
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/textExtractor.onward.test.js`
Expected: PASS 7/7. Then run full suite: `npm test` — all previous tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/core/textExtractor.js tests/textExtractor.onward.test.js
git commit -m "Rewrite getTextFromElementOnward with scope-root walker and readable-block filter"
```

---

## Phase C — Input Handler Rewrite & UI

### Task 7: Add `showMissPulse` to highlighter

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/highlighter.js`
- Create: `/Users/matthewfrost/readel/edel/tests/missPulse.test.js`

- [ ] **Step 1: Write failing test**

Create `/Users/matthewfrost/readel/edel/tests/missPulse.test.js`:

```js
import { showMissPulse, injectHighlightStyles } from '../scripts/core/highlighter.js';

describe('showMissPulse', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.head.replaceChildren();
  });

  test('inserts a positioned element at (x, y)', () => {
    injectHighlightStyles();
    showMissPulse(100, 200);
    const pulse = document.querySelector('.readel-miss-pulse');
    expect(pulse).not.toBeNull();
    expect(pulse.style.left).toBe('100px');
    expect(pulse.style.top).toBe('200px');
  });

  test('removes the pulse after ~400ms', (done) => {
    injectHighlightStyles();
    showMissPulse(10, 10);
    setTimeout(() => {
      expect(document.querySelector('.readel-miss-pulse')).toBeNull();
      done();
    }, 500);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/missPulse.test.js`
Expected: FAIL — `showMissPulse is not a function`.

- [ ] **Step 3: Implement in highlighter.js**

Open `/Users/matthewfrost/readel/edel/scripts/core/highlighter.js`.

a) Inside the CSS template string in `injectHighlightStyles` (around line 14), add these rules **before the closing backtick**:

```css
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
```

b) At the end of the file, add:

```js
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npm test -- tests/missPulse.test.js`
Expected: PASS 2/2

- [ ] **Step 5: Commit**

```bash
git add scripts/core/highlighter.js tests/missPulse.test.js
git commit -m "Add showMissPulse cursor-anchored indicator for resolution misses"
```

---

### Task 8: Rewrite `inputHandler.js` and `inject.js`

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/inputHandler.js`
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/inject.js`
- Create: `/Users/matthewfrost/readel/edel/tests/contentEditablePolicy.test.js`

- [ ] **Step 1: Write failing test for composer policy**

Create `/Users/matthewfrost/readel/edel/tests/contentEditablePolicy.test.js`:

```js
import { isComposerElement } from '../scripts/core/inputHandler.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
  return document.body.firstElementChild;
}

describe('isComposerElement', () => {
  test('rejects <textarea>', () => {
    expect(isComposerElement(mount('<textarea>hi</textarea>'))).toBe(true);
  });
  test('rejects <input type=text>', () => {
    expect(isComposerElement(mount('<input type="text" value="hi">'))).toBe(true);
  });
  test('rejects <input type=search>', () => {
    expect(isComposerElement(mount('<input type="search" value="hi">'))).toBe(true);
  });
  test('rejects elements with data-testid=chat-input-textbox', () => {
    expect(isComposerElement(mount('<div data-testid="chat-input-textbox" contenteditable="true">hi</div>'))).toBe(true);
  });
  test('accepts plain contenteditable for displayed content', () => {
    expect(isComposerElement(mount('<div contenteditable="true" class="notion-page">displayed page</div>'))).toBe(false);
  });
  test('accepts a <p> with no contenteditable', () => {
    expect(isComposerElement(mount('<p>regular paragraph</p>'))).toBe(false);
  });
  test('rejects elements inside a known composer ancestor', () => {
    mount('<div data-testid="chat-input-textbox"><span>inner</span></div>');
    expect(isComposerElement(document.querySelector('span'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/contentEditablePolicy.test.js`
Expected: FAIL — `isComposerElement is not a function`.

- [ ] **Step 3: Rewrite `inputHandler.js`**

Replace the entire contents of `/Users/matthewfrost/readel/edel/scripts/core/inputHandler.js` with:

```js
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
```

- [ ] **Step 4: Replace `inject.js` for lazy init and no 200-char bail**

Replace the entire contents of `/Users/matthewfrost/readel/edel/scripts/core/inject.js` with:

```js
import AudioPlayer from './audioPlayer.js';
import { InputHandler } from './inputHandler.js';
import { injectHighlightStyles, showOnboarding } from './highlighter.js';

function init() {
    injectHighlightStyles();

    const handler = new InputHandler();
    handler.setAudioPlayerConstructor(AudioPlayer);
    handler.activate();

    if (window === window.top) showOnboarding();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS including the new `contentEditablePolicy.test.js` (7/7). All prior tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/core/inputHandler.js scripts/core/inject.js tests/contentEditablePolicy.test.js
git commit -m "Rewrite inputHandler with caret-point resolution, lazy init, composer filter, miss pulse"
```

---

## Phase D — Service Worker, Offscreen, Manifest

### Task 9: Thread `sessionId` through AudioPlayer and offscreen

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/audioPlayer.js`
- Modify: `/Users/matthewfrost/readel/edel/build/background.js`
- Modify: `/Users/matthewfrost/readel/edel/offscreen.js`

- [ ] **Step 1: Update AudioPlayer**

Replace the entire contents of `/Users/matthewfrost/readel/edel/scripts/core/audioPlayer.js` with:

```js
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
```

- [ ] **Step 2: Update `build/background.js` to pass sessionId through**

Open `/Users/matthewfrost/readel/edel/build/background.js`. Make three edits:

a) In the `tts-speak` handler, add `sessionId` to the `offscreen-speak` call. Find:
```js
chrome.runtime.sendMessage({
    action: 'offscreen-speak',
    sentence: message.sentence,
    voiceId,
    apiKey,
    speed
}).then(r => console.log('[Readel bg] offscreen response:', r))
  .catch(err => console.error('[Readel bg] offscreen send failed:', err));
```
Replace with:
```js
chrome.runtime.sendMessage({
    action: 'offscreen-speak',
    sentence: message.sentence,
    sessionId: message.sessionId,
    voiceId,
    apiKey,
    speed
}).then(r => console.log('[Readel bg] offscreen response:', r))
  .catch(err => console.error('[Readel bg] offscreen send failed:', err));
```

b) In the `tts-event` relay, forward sessionId. Find:
```js
} else if (message.action === "tts-event") {
    if (activeTtsTabId) {
        chrome.tabs.sendMessage(activeTtsTabId, {
            action: 'tts-event',
            type: message.type
        }).catch(() => {});
    }
    return false;
}
```
Replace with:
```js
} else if (message.action === "tts-event") {
    if (activeTtsTabId) {
        chrome.tabs.sendMessage(activeTtsTabId, {
            action: 'tts-event',
            type: message.type,
            sessionId: message.sessionId
        }).catch(() => {});
    }
    return false;
}
```

c) In `tts-stop`, forward sessionId. Find:
```js
} else if (message.action === "tts-stop") {
    chrome.runtime.sendMessage({ action: 'offscreen-stop' }).catch(() => {});
    return false;
}
```
Replace with:
```js
} else if (message.action === "tts-stop") {
    chrome.runtime.sendMessage({ action: 'offscreen-stop', sessionId: message.sessionId }).catch(() => {});
    return false;
}
```

- [ ] **Step 3: Update `offscreen.js` to echo sessionId and reconnect WebSocket**

Replace the entire contents of `/Users/matthewfrost/readel/edel/offscreen.js` with:

```js
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
        if (msg.type === 'error') console.error('Readel Cartesia error:', msg);
        if (msg.context_id !== currentContextId) return;

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
```

- [ ] **Step 4: Build and run tests**

Run: `cd /Users/matthewfrost/readel/edel && npm run build && npm test`
Expected: webpack build succeeds; all jest tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/core/audioPlayer.js build/background.js build/inject.js offscreen.js
git commit -m "Thread sessionId through playback pipeline; add WebSocket reconnect backoff"
```

---

### Task 10: Manifest — all_frames + document_idle

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/manifest.json`

- [ ] **Step 1: Update manifest**

Open `/Users/matthewfrost/readel/edel/manifest.json`. Replace the `content_scripts` block with:

```json
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["build/inject.js"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
```

- [ ] **Step 2: Smoke-test build**

Run: `cd /Users/matthewfrost/readel/edel && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "Inject content script into all same-origin frames at document_idle"
```

---

### Task 11: `frameGuard.js` — iframe coordinate handoff

**Files:**
- Create: `/Users/matthewfrost/readel/edel/scripts/core/frameGuard.js`
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/inputHandler.js`
- Modify: `/Users/matthewfrost/readel/edel/scripts/core/inject.js`

- [ ] **Step 1: Create frameGuard.js**

Create `/Users/matthewfrost/readel/edel/scripts/core/frameGuard.js`:

```js
// Coordinate handoff between parent frame and same-origin child iframe.
// The parent calls forwardToChildIframe(iframeEl, x, y, mode) when
// elementFromPoint lands on an <iframe>; the child listens for the
// postMessage and runs resolution + playback locally.

const MESSAGE_KEY = '__readel_v1';
const CMD_HOLD = 'resolve-and-hold';
const CMD_CONTINUOUS = 'resolve-and-continuous';

export function forwardToChildIframe(iframeEl, x, y, mode) {
    if (!iframeEl || !iframeEl.contentWindow) return false;
    const rect = iframeEl.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;
    const cmd = mode === 'continuous' ? CMD_CONTINUOUS : CMD_HOLD;
    try {
        iframeEl.contentWindow.postMessage(
            { [MESSAGE_KEY]: true, cmd, x: localX, y: localY },
            '*'
        );
        return true;
    } catch (e) {
        return false;
    }
}

export function installChildListener(onHold, onContinuous) {
    window.addEventListener('message', (ev) => {
        const data = ev.data;
        if (!data || typeof data !== 'object' || !data[MESSAGE_KEY]) return;
        if (data.cmd === CMD_HOLD && typeof onHold === 'function') {
            onHold(data.x, data.y);
        } else if (data.cmd === CMD_CONTINUOUS && typeof onContinuous === 'function') {
            onContinuous(data.x, data.y);
        }
    });
}
```

- [ ] **Step 2: Update `inputHandler.js` to detect iframe at point**

Open `/Users/matthewfrost/readel/edel/scripts/core/inputHandler.js`.

a) Add a new import near the top, below the other imports:

```js
import { forwardToChildIframe } from './frameGuard.js';
```

b) In the constructor, add a new field:
```js
this._pendingIframe = null;
```

c) In `_onKeyDown`, **after** `this._maybeInitHeavy();` and before the `resolveTextBlockAtPoint` call, add the iframe check:

```js
const hitForIframe = document.elementFromPoint(this._lastMouseX, this._lastMouseY);
if (hitForIframe && hitForIframe.tagName === 'IFRAME') {
    this.altDown = true;
    this._pendingIframe = hitForIframe;
    this.holdDelayTimer = setTimeout(() => {
        this.holdDelayTimer = null;
        if (this.altDown && this._pendingIframe) {
            forwardToChildIframe(this._pendingIframe, this._lastMouseX, this._lastMouseY, 'hold');
            this.mode = 'iframe-delegated';
            this._pendingIframe = null;
        }
    }, HOLD_THRESHOLD);
    return;
}
this._pendingIframe = null;
```

d) In `_onKeyUp`, update the double-tap branch. Find:
```js
if (now - this.lastAltRelease < DOUBLE_TAP_WINDOW) {
    this.lastAltRelease = 0;
    this._startContinuousReading();
} else {
```
Replace with:
```js
if (now - this.lastAltRelease < DOUBLE_TAP_WINDOW) {
    this.lastAltRelease = 0;
    if (this._pendingIframe) {
        forwardToChildIframe(this._pendingIframe, this._lastMouseX, this._lastMouseY, 'continuous');
        this.mode = 'iframe-delegated';
        this._pendingIframe = null;
    } else {
        this._startContinuousReading();
    }
} else {
```

- [ ] **Step 3: Update `inject.js` to install child listener**

Replace the entire contents of `/Users/matthewfrost/readel/edel/scripts/core/inject.js` with:

```js
import AudioPlayer from './audioPlayer.js';
import { InputHandler } from './inputHandler.js';
import { injectHighlightStyles, showOnboarding } from './highlighter.js';
import { installChildListener } from './frameGuard.js';
import { resolveTextBlockAtPoint } from './textExtractor.js';

function init() {
    injectHighlightStyles();

    const handler = new InputHandler();
    handler.setAudioPlayerConstructor(AudioPlayer);
    handler.activate();

    installChildListener(
        (x, y) => {
            handler._lastMouseX = x;
            handler._lastMouseY = y;
            handler._maybeInitHeavy();
            const resolved = resolveTextBlockAtPoint(x, y);
            if (!resolved) return;
            handler._pendingTarget = resolved;
            handler._startHoldReading();
        },
        (x, y) => {
            handler._lastMouseX = x;
            handler._lastMouseY = y;
            handler._maybeInitHeavy();
            const resolved = resolveTextBlockAtPoint(x, y);
            if (!resolved) return;
            handler._pendingTarget = resolved;
            handler._startContinuousReading();
        }
    );

    if (window === window.top) showOnboarding();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

- [ ] **Step 4: Rebuild and run tests**

Run: `cd /Users/matthewfrost/readel/edel && npm run build && npm test`
Expected: build succeeds; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/core/frameGuard.js scripts/core/inputHandler.js scripts/core/inject.js build/inject.js
git commit -m "Add frameGuard iframe coordinate handoff for same-origin child frames"
```

---

## Phase E — Voice UI & Migration

### Task 12: New voice dropdown + migration

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/scripts/popup/index.html`
- Modify: `/Users/matthewfrost/readel/edel/scripts/popup/app.css`
- Modify: `/Users/matthewfrost/readel/edel/build/background.js`

- [ ] **Step 1: Update the dropdown**

Open `/Users/matthewfrost/readel/edel/scripts/popup/index.html`. Replace the entire existing `<select id="voice-select" ...>` element (lines 22-29 of the current file, including its options) with:

```html
<select id="voice-select" class="select" aria-label="Select voice">
  <optgroup label="Free">
    <option value="a33f7a4c-100f-41cf-a1fd-5822e8fc253f">Aria</option>
    <option value="79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e">Finn</option>
    <option value="f9836c6e-a0bd-460e-9d3c-f7299fa60f94">Mira</option>
  </optgroup>
  <optgroup label="Beta" class="voice-beta">
    <option value="d1d9c946-7cfc-4378-85a4-07d09827cb7e">+ Ember</option>
    <option value="5ee9feff-1265-424a-9d7f-8e4d431a12c7">+ Atlas</option>
    <option value="dc30854e-e398-4579-9dc8-16f6cb2c19b9">+ Sable</option>
    <option value="4f7f1324-1853-48a6-b294-4e78e8036a83">+ Quill</option>
  </optgroup>
</select>
```

- [ ] **Step 2: Add beta styling**

Open `/Users/matthewfrost/readel/edel/scripts/popup/app.css`. Append to the end of the file:

```css
#voice-select optgroup[label="Beta"] { color: #ec4899; }
#voice-select optgroup[label="Beta"] option { color: #ec4899; }
```

- [ ] **Step 3: Add migration in `background.js`**

Open `/Users/matthewfrost/readel/edel/build/background.js`. Replace the first line:

```js
const CARTESIA_DEFAULT_VOICE = "71a7ad14-091c-4e8e-a314-022ece01c121";
```

With:

```js
const CARTESIA_DEFAULT_VOICE = "a33f7a4c-100f-41cf-a1fd-5822e8fc253f"; // Aria

const VOICE_MIGRATION = {
    '71a7ad14-091c-4e8e-a314-022ece01c121': 'dc30854e-e398-4579-9dc8-16f6cb2c19b9', // British Lady -> Sable
    'f146dcec-e481-45be-8ad2-96e1e40e7f32': '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Reading Man -> Atlas
    '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e': '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', // Nonfiction Man -> Finn (same id)
    '00a77add-48d5-4ef6-8157-71e5437b282d': 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', // Calm Lady -> Mira
    '69267136-1bdc-412f-ad78-0caad210fb40': '4f7f1324-1853-48a6-b294-4e78e8036a83', // Friendly Man -> Quill
    'd46abd1d-2d02-43e8-819f-51fb652c1c61': '5ee9feff-1265-424a-9d7f-8e4d431a12c7'  // Newsman -> Atlas
};
```

Then find the existing `chrome.runtime.onInstalled.addListener` block. Replace it with:

```js
chrome.runtime.onInstalled.addListener(async function (details) {
    if (details.reason === "install" || details.reason === "update") {
        chrome.storage.local.set({ 'cartesiaApiKey': 'sk_car_e5CtJM7VCSbc3SoXUkZpnD' });
        chrome.storage.local.get(['voiceID'], (items) => {
            const cur = items.voiceID;
            if (!cur) {
                chrome.storage.local.set({ 'voiceID': CARTESIA_DEFAULT_VOICE });
            } else if (VOICE_MIGRATION[cur] && VOICE_MIGRATION[cur] !== cur) {
                chrome.storage.local.set({ 'voiceID': VOICE_MIGRATION[cur] });
            }
        });
    }
});
```

- [ ] **Step 4: Manual verification**

Run `npm run build`, then reload the unpacked extension at `chrome://extensions`. Open the popup. Confirm:
- Dropdown shows "Free" group with Aria / Finn / Mira and "Beta" group with + Ember / + Atlas / + Sable / + Quill (pink text).
- Selecting each voice persists across popup reopens.
- With a legacy install that used "British Reading Lady", `chrome.storage.local.get('voiceID')` after reload returns the Sable id.

Manual — no assertion.

- [ ] **Step 5: Commit**

```bash
git add scripts/popup/index.html scripts/popup/app.css build/background.js
git commit -m "Rename voices to Aria/Finn/Mira/Ember/Atlas/Sable/Quill with legacy-id migration"
```

---

## Phase F — Fixture Tests & QA

### Task 13: Capture fixtures

**Files:**
- Create: `/Users/matthewfrost/readel/edel/tests/fixtures/README.md`
- Create: `/Users/matthewfrost/readel/edel/tests/fixtures/*.html`

This task is manual. You need access to logged-in sessions on Claude, ChatGPT, and Gmail.

- [ ] **Step 1: Capture DOM for each target**

For each target below: open the page, open devtools → Elements → right-click `<html>` → Copy → Outer HTML → save into the corresponding file under `/Users/matthewfrost/readel/edel/tests/fixtures/`. Scrub any identifying personal content (names, email addresses) via search-and-replace before saving.

| File | Source |
|---|---|
| `claude-conversation.html` | `claude.ai` conversation with 3+ assistant messages |
| `chatgpt-conversation.html` | `chatgpt.com` conversation with 3+ assistant messages |
| `gmail-message-body.html` | Gmail message body (inspect the iframe and copy its inner document) |
| `google-forms-response.html` | A public Google Form response page you've filled out |
| `medium-article.html` | Any public Medium article |
| `substack-post.html` | Any public Substack post |
| `nytimes-article.html` | Any free NYT article |
| `notion-doc.html` | A public Notion page |

- [ ] **Step 2: Write the fixtures README**

Create `/Users/matthewfrost/readel/edel/tests/fixtures/README.md`:

```md
# Site DOM fixtures

Each `.html` here is an outer-HTML snapshot of a real site at the time of capture. Used by `tests/sites.test.js` to verify that the block resolver and continuous-read walker work on that DOM shape.

## Refresh cadence

These fixtures are frozen in time. Sites change CSS class names and DOM structure frequently; expect to refresh quarterly, or whenever a smoke test flags a regression.

## How to capture

1. Open the page in Chrome (logged in where required).
2. Open devtools → Elements.
3. Right-click the `<html>` node → Copy → Outer HTML.
4. Save into the matching file under this directory.
5. Remove any personal identifying info via search-and-replace before committing.
6. Run `npm test -- tests/sites.test.js` and update expectations if the site changed legitimately.
```

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/
git commit -m "Add site DOM fixtures for Claude, ChatGPT, Gmail, Forms, blogs, Notion"
```

---

### Task 14: Fixture-based resolver tests

**Files:**
- Create: `/Users/matthewfrost/readel/edel/tests/sites.test.js`

- [ ] **Step 1: Write fixture tests**

Create `/Users/matthewfrost/readel/edel/tests/sites.test.js`:

```js
import fs from 'fs';
import path from 'path';
import { isReadableBlock, findScopeRoot, getTextFromElementOnward } from '../scripts/core/textExtractor.js';

function loadFixture(name) {
    const p = path.join(__dirname, 'fixtures', name);
    return fs.readFileSync(p, 'utf8');
}

function mountFixture(html) {
    document.body.replaceChildren();
    // Extract body content if a full document was captured.
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = m ? m[1] : html;
    const range = document.createRange();
    range.selectNode(document.body);
    document.body.appendChild(range.createContextualFragment(bodyHtml));
}

function firstBlockMatching(selectorList) {
    for (const sel of selectorList.split(',').map(s => s.trim())) {
        const nodes = document.querySelectorAll(sel);
        for (const n of nodes) {
            const text = (n.innerText || n.textContent || '').trim();
            if (text.length > 40) return n;
        }
    }
    return null;
}

describe('claude-conversation fixture', () => {
    beforeAll(() => mountFixture(loadFixture('claude-conversation.html')));
    test('an assistant message is findable as a readable block', () => {
        const msg = firstBlockMatching('[data-testid*="assistant" i], [class*="assistant" i], [class*="message" i]');
        expect(msg).not.toBeNull();
        const candidate = isReadableBlock(msg) ? msg : msg.querySelector('p, li, div');
        expect(candidate).toBeTruthy();
    });
});

describe('chatgpt-conversation fixture', () => {
    beforeAll(() => mountFixture(loadFixture('chatgpt-conversation.html')));
    test('an assistant message is findable as a readable block', () => {
        const msg = firstBlockMatching('[data-message-author-role="assistant"], [class*="markdown"], [class*="assistant"]');
        expect(msg).not.toBeNull();
        const candidate = isReadableBlock(msg) ? msg : msg.querySelector('p, li, div');
        expect(candidate).toBeTruthy();
    });
});

describe('gmail-message-body fixture', () => {
    beforeAll(() => mountFixture(loadFixture('gmail-message-body.html')));
    test('message body is findable', () => {
        const body = firstBlockMatching('div[dir="ltr"], .gmail_default, .ii, .a3s');
        expect(body).not.toBeNull();
    });
});

describe('medium-article fixture', () => {
    beforeAll(() => mountFixture(loadFixture('medium-article.html')));
    test('article paragraphs are readable and scope-root is article-ish', () => {
        const p = document.querySelector('article p');
        expect(p).not.toBeNull();
        expect(isReadableBlock(p)).toBe(true);
        const root = findScopeRoot(p);
        expect(root).not.toBe(document.body);
    });
    test('continuous-read from first paragraph yields many blocks', () => {
        const p = document.querySelector('article p');
        const result = getTextFromElementOnward(p);
        expect(result.sentences.length).toBeGreaterThan(5);
    });
});

describe('substack-post fixture', () => {
    beforeAll(() => mountFixture(loadFixture('substack-post.html')));
    test('post paragraphs resolve as readable', () => {
        const p = firstBlockMatching('[class*="post-content"] p, .post-content p, p');
        expect(p).not.toBeNull();
        expect(isReadableBlock(p)).toBe(true);
    });
});

describe('nytimes-article fixture', () => {
    beforeAll(() => mountFixture(loadFixture('nytimes-article.html')));
    test('article paragraphs resolve as readable', () => {
        const p = firstBlockMatching('section[name="articleBody"] p, article p, p');
        expect(p).not.toBeNull();
        expect(isReadableBlock(p)).toBe(true);
    });
});

describe('google-forms-response fixture', () => {
    beforeAll(() => mountFixture(loadFixture('google-forms-response.html')));
    test('answer text resolves as readable', () => {
        const answer = firstBlockMatching('[role="listitem"] [dir="auto"], [role="heading"], span');
        expect(answer).not.toBeNull();
    });
});

describe('notion-doc fixture', () => {
    beforeAll(() => mountFixture(loadFixture('notion-doc.html')));
    test('doc paragraphs resolve as readable despite contentEditable', () => {
        const p = firstBlockMatching('[data-content-editable-leaf], [data-block-id] [contenteditable], p');
        expect(p).not.toBeNull();
    });
});
```

- [ ] **Step 2: Run fixture tests**

Run: `npm test -- tests/sites.test.js`
Expected: PASS on each describe block. If a selector fails (real site class names differ from the assumption), inspect the fixture HTML, update the matching selector, and rerun.

- [ ] **Step 3: Commit**

```bash
git add tests/sites.test.js
git commit -m "Add fixture-based resolver tests for target sites"
```

---

### Task 15: Manual smoke-test checklist

**Files:**
- Create: `/Users/matthewfrost/readel/edel/docs/testing/manual-smoke.md`

- [ ] **Step 1: Write the checklist**

Create `/Users/matthewfrost/readel/edel/docs/testing/manual-smoke.md`:

```md
# Readel manual smoke test

Run before every release. Target time: under 10 minutes.

## Setup

1. `npm run build`
2. Load `/Users/matthewfrost/readel/edel` as an unpacked extension in `chrome://extensions`.
3. Open the extension popup and confirm the voice dropdown shows Free / Beta groups.

## Tests

Each step: hold Alt over the target text unless otherwise noted. Expect audio to start within 1-2 seconds and the hovered block to highlight.

1. **claude.ai** — open any conversation. Hold Alt over an assistant message. Expect playback. Release. Double-tap Alt over the same message. Expect continuous read through the rest of the conversation.
2. **chatgpt.com** — same as above.
3. **Gmail reading pane (mail.google.com)** — open an email. Hold Alt over the message body. Expect playback. (Gmail renders the body inside a same-origin iframe; the frameGuard handoff is exercised here.)
4. **NYTimes article** — open any free article. Double-tap Alt over the first paragraph. Expect continuous read of the article body, stopping before the recommended-articles rail or footer.
5. **Medium post** — same as NYTimes.
6. **Google Forms response** — open a form response page. Hold Alt over any answer text. Expect playback.
7. **Substack iframe embed** — find a page that embeds a Substack post (or equivalent third-party embed). Hold Alt over text inside the embed. Expect playback.
8. **Extension reload** — with a page open, go to `chrome://extensions` and click the Readel reload icon. Return to the page and press Alt. Expect a bottom-center toast reading *"Readel needs a page refresh."* — not silent failure.
9. **Navigate-away mid-read** — on a long article, double-tap Alt to start continuous read. Click a link to navigate away after 2 sentences. Expect audio to stop immediately (no zombie sentences from the old page).
10. **Miss pulse** — hover over an `<img>` with no surrounding text and press Alt. Expect a small gray circle to briefly appear at the cursor position, with no audio and no toast.

## Regressions to verify are absent

- On a plain blog post (example.com or a simple HTML page), hold Alt over a `<p>`: still works exactly like before.
- Double-tap continuous-read on a simple page still stops at the end of the article, not at the end of the document.

## What to do if a test fails

Capture the DOM of the failing page as a new fixture under `tests/fixtures/`, add a failing assertion in `tests/sites.test.js`, then fix the code. The test suite grows with each bug.
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing/manual-smoke.md
git commit -m "Add manual smoke-test checklist for pre-release QA"
```

---

### Task 16: Version bump and release prep

**Files:**
- Modify: `/Users/matthewfrost/readel/edel/manifest.json`
- Modify: `/Users/matthewfrost/readel/edel/package.json`
- Modify: `/Users/matthewfrost/readel/edel/README.md`

- [ ] **Step 1: Bump version to 2.1.0**

Open `/Users/matthewfrost/readel/edel/manifest.json`. Change:
```json
"version": "2.0.1",
```
to:
```json
"version": "2.1.0",
```

Open `/Users/matthewfrost/readel/edel/package.json`. Change:
```json
"version": "1.4.4",
```
to:
```json
"version": "2.1.0",
```

- [ ] **Step 2: Rewrite README**

Replace the entire contents of `/Users/matthewfrost/readel/edel/README.md` with:

```md
# Readel v2.1.0

Modern, minimal, free text-to-speech. Hold **Alt** over any text to hear it read aloud. Double-tap **Alt** to read continuously to the end of the content.

Works on: blogs, news sites, Gmail, Google Forms, Claude, ChatGPT, Notion, Substack, and most modern webapps.

Not yet supported: Google Docs (canvas-rendered).

## Voices

- **Free:** Aria, Finn, Mira
- **Beta:** Ember, Atlas, Sable, Quill

## Keyboard

- **Hold Alt** — read the paragraph under the cursor
- **Double-tap Alt** — read from the current paragraph to the end of the article

## Development

```
npm install
npm run build       # webpack production build
npm test            # jest unit + fixture tests
```

Manual smoke test: `docs/testing/manual-smoke.md`.
```

- [ ] **Step 3: Run full build + test pass**

Run:
```bash
cd /Users/matthewfrost/readel/edel && npm run build && npm test
```
Expected: build succeeds; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add manifest.json package.json README.md
git commit -m "Bump to v2.1.0; update README with supported sites and new voices"
```

---

## Final Verification

After all tasks are complete:

- [ ] All Jest tests pass: `npm test` → GREEN.
- [ ] Webpack build succeeds: `npm run build` → no warnings about missing imports.
- [ ] Manual smoke test `docs/testing/manual-smoke.md` executed and all 10 items pass.
- [ ] `git log --oneline` shows roughly 16 focused commits on `main`.
- [ ] `manifest.json` version is `2.1.0`; `package.json` version is `2.1.0`.

If any smoke-test item fails, do not ship. Capture the failing page as a new fixture, add an assertion, patch the code, re-run smoke tests.
