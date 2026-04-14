# Readel Reliability — Design Spec

**Date:** 2026-04-14
**Target version:** 2.1.0
**Status:** Draft — awaiting user review

---

## 1. Problem Statement

Readel's hover-to-read and double-tap-to-read-onward features break on several classes of site we want to support first-class: **Claude**, **ChatGPT**, **Gmail message bodies**, **Google Forms**, and some modern blogs. Google Docs does not work at all (canvas rendering).

Root causes in the current implementation:

1. **Page-load early-exit.** `scripts/core/inject.js:27` aborts initialization when `document.body.innerText.length < 200`. Most SPAs render content after `document_end`, so the extension never initializes. This alone explains most of the failure on Claude and ChatGPT.
2. **Rigid tag whitelist.** `_resolveTextBlock` in `scripts/core/inputHandler.js:167` walks up from the hovered element looking for tags in `BLOCK_TAGS` (`P`, `LI`, `H1`–`H6`, `BLOCKQUOTE`, etc.). Modern chat UIs render text into anonymous `<div>`s; none of those tags are ever matched.
3. **Blanket contentEditable rejection.** The same function rejects any element inside a `contentEditable` ancestor (line 171, 176). Notion, Google Docs, and parts of Gmail use contentEditable for *displayed* content, so hover-to-read refuses to resolve a target even when text is visibly present and not an input.
4. **No iframe support.** `manifest.json` injects only into the top frame, but Gmail message bodies render inside a same-origin iframe.
5. **No ShadowDOM traversal.** Some widget SDKs render in open shadow roots.
6. **Extension-context invalidation is silent.** After an extension reload, content scripts remain on the page but their `chrome.*` calls throw; there is no recovery path, so users see silent failure until they refresh the page.

This spec defines the work to make hover-to-read and continuous-read reliable across Gmail, forms, blogs, Claude, and ChatGPT, without site-specific code. Google Docs (canvas rendering) is explicitly **out of scope** for this spec.

## 2. Non-Goals

- **Google Docs canvas support.** Requires toggling the Docs accessibility-mode DOM — a separate multi-week effort.
- **Cross-origin iframe support.** Chrome's security model prevents reading across origins from a content script; we accept silent failure there.
- **Closed ShadowDOM support.** Rare in reader-relevant sites; not worth the workarounds.
- **Reader-mode article extraction** (stripping ads/nav from arbitrary pages). The scope-root heuristic in §4.4 is a coarser, cheaper version of this that is sufficient for our read-onward feature.
- **Headless browser E2E tests.** We rely on fixture-based tests (§6).

## 3. Architecture

### 3.1 File layout after this change

```
manifest.json
  content_scripts[0].all_frames: true          NEW — inject into iframes
  content_scripts[0].run_at: document_idle     CHANGED from document_end

scripts/core/
  inject.js          — remove 200-char bail; lazy heavy-init on first Alt keypress
  textExtractor.js   — caret-point resolver; isReadableBlock test; scope-root walker
  inputHandler.js    — replace _resolveTextBlock; relax contentEditable rules;
                       coordinate-based hover (no per-mousemove work)
  audioPlayer.js     — sessionId-tagged event filter
  highlighter.js     — unchanged
  sessionBus.js      NEW — sessionId generation and event filtering helpers
  frameGuard.js      NEW — parent↔child iframe coordinate handoff via postMessage
  runtimeHealth.js   NEW — detects extension-context invalidation; single recovery toast

scripts/popup/
  index.html         — voice dropdown grouped Free / Beta
  popup.js           — unchanged logic; voice IDs change

build/background.js  — regenerated from new sources; adds voice-ID migration
offscreen.js         — echoes sessionId into every tts-event; adds WS reconnect

tests/                                          NEW
  fixtures/          — captured HTML snapshots
  textExtractor.test.js
  inputHandler.test.js
  resolvePoint.test.js

docs/testing/manual-smoke.md                    NEW — ordered smoke-test checklist
```

### 3.2 Control flow on Alt keydown (new)

```
keydown(Alt) in focused frame
  │
  ├─ runtimeHealth check → if invalid, show "needs refresh" toast, stop
  │
  ├─ maybeInitHeavy() (first press only: instantiate AudioPlayer, load settings)
  │
  ├─ if elementFromPoint(x, y) is an <iframe> (same-origin):
  │     postMessage('readel:resolvePoint', {localX, localY}) to iframe, stop here
  │
  ├─ resolveTextBlockAtPoint(lastMouseX, lastMouseY)
  │     │
  │     ├─ 1. caretPositionFromPoint → text node → walk up to non-inline ancestor
  │     ├─ 2. elementFromPoint → walk up until isReadableBlock() passes
  │     ├─ 3. window.getSelection() if non-empty
  │     └─ 4. return null (silent failure)
  │
  ├─ applyContentEditablePolicy(block) — reject if block is a known composer
  │
  ├─ start 300 ms hold timer → hold fires → _startHoldReading(block)
  │
  └─ on double-tap within 300 ms → _startContinuousReading(block)
```

## 4. Text Extraction Pipeline

### 4.1 Primitive: `isReadableBlock(el)`

```js
function isReadableBlock(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE || !el.isConnected) return false;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return false;
  if (tag === 'SVG' || tag === 'IFRAME' || tag === 'CANVAS') return false;

  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (style.display.startsWith('inline')) return false;

  // Must have directly-owned visible text — not just descendants' text.
  const ownText = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim())
    .join(' ');
  return ownText.length >= 2;
}
```

Replaces the `BLOCK_TAGS` whitelist. Works on any DOM.

### 4.2 Point resolver: `resolveTextBlockAtPoint(x, y)`

```js
function resolveTextBlockAtPoint(x, y) {
  // Step 1 — caret point
  const caret = document.caretPositionFromPoint?.(x, y)
             ?? document.caretRangeFromPoint?.(x, y);
  if (caret) {
    const node = caret.offsetNode || caret.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
      let el = node.parentElement;
      while (el && el !== document.body) {
        if (getComputedStyle(el).display !== 'inline' && isReadableBlock(el)) return el;
        el = el.parentElement;
      }
    }
  }

  // Step 2 — elementFromPoint walk-up
  const hit = document.elementFromPoint(x, y);
  let el = hit;
  while (el && el !== document.body) {
    if (isReadableBlock(el)) return el;
    el = el.parentElement;
  }

  // Step 3 — active non-empty selection
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
    return { kind: 'selection', text: sel.toString().trim() };
  }

  // Step 4 — silent failure
  return null;
}
```

### 4.3 ContentEditable policy

- **Reject** if the resolved element matches `textarea, input[type=text], input[type=search]`, or if the hovered text node is inside an element with `role="textbox"` whose `aria-label` or nearby DOM suggests user composition (ChatGPT composer, Claude composer, Gmail compose body).
- **Accept** contentEditable ancestors for displayed content (Notion pages, rendered markdown, editable-but-displayed blocks).
- Practical implementation: maintain a short allowlist of composer selectors (e.g. `'[data-testid=chat-input-textbox]'`, `'.gmail_default[contenteditable]'` composer class). Everything else inside contentEditable is fair game for reading.
- **Applied where:** the policy is a post-resolution filter in `inputHandler.js`. After `resolveTextBlockAtPoint` returns a block, we call `applyContentEditablePolicy(block)` — if it matches any composer selector, we treat it as silent failure (step 4 equivalent) and do not show preview highlight or start the hold timer.

### 4.4 Continuous-read walker

`getTextFromElementOnward(startEl)` is rewritten:

1. **Scope root.** Walk up from `startEl` collecting ancestors. For each, compute `textLen = innerText.length` and `linkLen = total innerText of <a> descendants`. The deepest ancestor where `textLen > 500` and `(textLen - linkLen) / textLen > 0.4` is the scope root. Fallback: `document.body`.
2. **Walk.** `TreeWalker(scopeRoot, SHOW_ELEMENT)` with `acceptNode`:
   - Reject `<aside>`, `[role=navigation]`, `[role=complementary]`, `[aria-hidden=true]`.
   - Reject fixed/sticky positioned elements shorter than 80 px (cookie banners, ad bars).
   - Accept if `isReadableBlock(el)`.
3. **ShadowDOM.** When the walker encounters an element with an open `shadowRoot`, recurse into it with a nested walker. Closed roots ignored.
4. **Dedup.** If consecutive accepted blocks have ≥90% text overlap (Jaccard on trimmed lowercased tokens), drop the second.
5. **Clip.** Stop emitting sentences once total characters collected exceeds 30,000.

### 4.5 Iframe traversal

`manifest.json` changes to `all_frames: true`. Each frame runs its own content script instance. On Alt keydown in a frame, **before** calling `resolveTextBlockAtPoint`, we check `document.elementFromPoint(x, y)`. If that is a same-origin `<iframe>` element, the parent hands off resolution to the child and stops:

```js
iframe.contentWindow.postMessage(
  { __readel: true, cmd: 'resolvePoint', x: localX, y: localY },
  iframe.src.startsWith(location.origin) ? '*' : location.origin
);
```

The child's `frameGuard.js` listens for `__readel` messages and runs resolution + playback in the child frame.

Continuous-read does **not** cross iframe boundaries. The walker stops when it reaches an iframe element and does not descend.

## 5. Runtime & Session Architecture

### 5.1 Multi-frame session isolation

Playback events broadcast from service worker / offscreen reach every frame. Without a guard, a Gmail read in the main frame would be interrupted by empty `end` events from the composer-iframe's AudioPlayer.

**Protocol:**
- Each frame's `AudioPlayer` generates a `sessionId = crypto.randomUUID()` when it starts a playback cycle.
- All `offscreen-speak` requests include `sessionId`.
- Service worker passes it through to `offscreen.js`.
- Every `tts-event` emitted from `offscreen.js` includes the active `sessionId`.
- `AudioPlayer.onMessage` ignores events whose `sessionId !== this.currentSessionId`.

Implementation: `scripts/core/sessionBus.js` exports a small helper used by AudioPlayer; changes to `background.js` and `offscreen.js` are ~5 lines each.

### 5.2 Extension-context invalidation recovery

`scripts/core/runtimeHealth.js`:

```js
export function isRuntimeAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

export function installRuntimeWatch(onInvalid) {
  // Called before any chrome.* access; also polled on first keydown.
  if (!isRuntimeAlive()) { onInvalid(); return; }
}
```

On detected invalidation:
1. Remove `keydown` / `keyup` / `mousemove` / `blur` listeners.
2. Call `clearAllHighlights()`.
3. Show a one-time toast: *"Readel needs a page refresh."* (5 s timeout, then auto-dismisses; no further retries this page-life.)

### 5.3 Lazy init (replaces 200-char bail)

```js
// inject.js new shape:
injectHighlightStyles();                  // runs immediately — just CSS

const handler = new InputHandler(null);   // player is null for now
handler.attachListeners();                // keydown/keyup/mousemove

// On first Alt keydown:
handler.maybeInitHeavy = () => {
  if (this.player) return;
  this.player = new AudioPlayer();
  showOnboarding();                       // moved here from init
};
```

The extension now works on any page that eventually renders text, regardless of what `document.body.innerText.length` is at load time.

### 5.4 Coordinate-based hover tracking

Current code runs `_resolveTextBlock(elementFromPoint(...))` on every `mousemove` to cache `currentHoverElement`. This is:
- Wasteful (mousemove fires at 60 Hz).
- Wrong-surface-area (we cache the tag-walker result, not a text-node).
- Stale-prone (element may have re-rendered).

New behavior: `mousemove` listener stores only `{ lastX, lastY }`. Resolution happens at Alt keydown. Preview highlight appears after resolution (sub-millisecond cost; still feels instant).

## 6. Fallback Chain and Failure-Mode Table

| Situation | Ladder step that rescues | UX |
|---|---|---|
| Cursor over image / video / padding | Step 2 (elementFromPoint walk-up) | Reads nearest block |
| CSS `pointer-events: none` on wrapper | Step 1 (caret ignores pointer-events) | Reads text |
| Active text selection | Step 3 | Reads selection |
| Cross-origin iframe | All steps fail in parent | Miss pulse |
| `<canvas>`-rendered text | All steps fail | Miss pulse |
| SVG text nodes | Step 1 reaches `<svg>`, which is skipped | Miss pulse |
| DOM mutated between resolve and speak | Range validity check before speak | Skip stale sentence |
| WebSocket drop mid-session | Reconnect with exponential backoff on next speak | Resume |
| 3 consecutive playback failures | Abort cycle | "Couldn't continue reading" toast |
| Extension reloaded while page open | `runtimeHealth` detects on next keydown | "Needs refresh" toast |

**Miss indicator (step 4).** When resolution returns null, we show a subtle cursor-anchored miss pulse — a 12×12 px muted-gray circle that fades in over 80 ms and out over 220 ms at `(lastMouseX, lastMouseY)`. Total lifespan ~400 ms. This tells the user "Readel heard you but found no text" without interrupting their flow. Lives in `highlighter.js` as `showMissPulse(x, y)`, injected once into `injectHighlightStyles()`.

Playback-promised-then-broken errors continue to use the existing `showToast` (bottom-center).

## 7. Testing Strategy

### 7.1 Fixture tests (Jest + jsdom)

`tests/fixtures/` holds captured HTML from real sites:

```
claude-conversation.html
chatgpt-conversation.html
gmail-inbox-row.html
gmail-message-body.html
google-forms-response.html
medium-article.html
substack-post.html
nytimes-article.html
notion-doc.html
```

Each fixture comes from devtools → right-click on `<html>` → Copy → Outer HTML, scrubbed of user-identifying text where applicable.

For each fixture, tests assert:
- `resolveTextBlockAtPoint(fixture, x, y)` returns the expected block at known coordinates.
- `isReadableBlock(expectedParagraph)` returns `true`; `isReadableBlock(expectedFooter)` returns `false`.
- Scope-root resolution from a known block identifies the expected content container.
- Continuous-read walker from block N yields ≥ M subsequent blocks, all inside the scope root, none from footer/nav.

### 7.2 Manual smoke tests

`docs/testing/manual-smoke.md` — ordered list, under 10 minutes:

1. claude.ai — hold Alt over assistant message → reads. Double-tap → reads rest of conversation.
2. chatgpt.com — same.
3. Gmail reading pane — hold Alt over message body (iframe) → reads.
4. NYTimes article — double-tap Alt → reads article, stops at end of article body (not footer / recommended-articles rail).
5. Medium post — same.
6. Google Forms response view — hold Alt over answer text → reads.
7. Page with embedded Substack iframe — hold Alt over embed → reads.
8. Refresh extension in chrome://extensions with a page open → next Alt press shows "needs refresh" toast (not silent death).
9. Continuous-read long article → navigate away mid-read → audio stops, no zombie sentences.

When a smoke test fails, capture the DOM as a new fixture before writing the fix. Test suite grows with each reliability bug.

### 7.3 Not building

- Playwright/Puppeteer live-site E2E. Target sites (Claude, ChatGPT, Gmail) gate on auth, rate-limit, and change DOM frequently. Fixtures give us 95% of the signal at 5% of the cost and no network flakiness.

## 8. Voice UI

### 8.1 Voice mapping

The dropdown in `scripts/popup/index.html` is replaced with two `<optgroup>`s:

| Label | Tier | Cartesia voice | ID |
|---|---|---|---|
| Aria | Free | Lauren — Lively Narrator (female) | `a33f7a4c-100f-41cf-a1fd-5822e8fc253f` |
| Finn | Free | Theo — Modern Narrator (male) | `79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e` |
| Mira | Free | Caroline — Southern Guide (female) | `f9836c6e-a0bd-460e-9d3c-f7299fa60f94` |
| ＋ Ember | Beta | Jolene — Warm Storyteller (female) | `d1d9c946-7cfc-4378-85a4-07d09827cb7e` |
| ＋ Atlas | Beta | Ronald — Thinker (male, deep) | `5ee9feff-1265-424a-9d7f-8e4d431a12c7` |
| ＋ Sable | Beta | Victoria — Refined Coordinator (British female) | `dc30854e-e398-4579-9dc8-16f6cb2c19b9` |
| ＋ Quill | Beta | Casper — Gentle Narrator (male) | `4f7f1324-1853-48a6-b294-4e78e8036a83` |

4 female / 3 male. Beta voices selectable by all users; the `＋` prefix and pink color (`#ec4899`) are visual-only indicators of experimental status.

### 8.2 Migration

On extension install or update, `background.js` runs a one-shot migration:

```js
const VOICE_MIGRATION = {
  '71a7ad14-091c-4e8e-a314-022ece01c121': 'dc30854e-e398-4579-9dc8-16f6cb2c19b9', // BritishLady → Sable
  'f146dcec-e481-45be-8ad2-96e1e40e7f32': '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // ReadingMan → Atlas
  '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e': '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', // NonfictionMan → Finn (same ID)
  '00a77add-48d5-4ef6-8157-71e5437b282d': 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', // CalmLady → Mira
  '69267136-1bdc-412f-ad78-0caad210fb40': '4f7f1324-1853-48a6-b294-4e78e8036a83', // FriendlyMan → Quill
  'd46abd1d-2d02-43e8-819f-51fb652c1c61': '5ee9feff-1265-424a-9d7f-8e4d431a12c7'  // Newsman → Atlas
};
```

If stored `voiceID` is falsy or not in the migration table, default to Aria.

### 8.3 CSS

Beta options receive pink styling via option / optgroup class selectors. Dropdown layout otherwise unchanged.

## 9. Out-of-Scope / Follow-ups

- **Google Docs canvas support.** Requires triggering accessibility-mode DOM. Separate spec.
- **Per-site adapters.** Claude/ChatGPT/Gmail-specific selectors that could yield cleaner sentence boundaries. Worth adding only if Approach 2 leaves visible gaps after it ships.
- **Reader-mode extraction.** Full Readability.js-style cleaning. Our scope-root heuristic is sufficient for continuous-read; a full reader mode is a separate feature.
- **Selection-range highlighting for non-block reads.** The current sentence-level Highlight API path already works when the block has a Range; when resolution returned only a selection (step 3), we read the text but skip the per-sentence highlight. Acceptable.

## 10. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Site rewrites DOM, fixture tests become irrelevant | High over 6 months | Fixture library is versioned in-repo; refresh quarterly |
| `caretPositionFromPoint` unsupported in some browsers | Low (Chrome supports it; fallback to `caretRangeFromPoint`) | Both in Step 1 |
| Iframe injection causes noticeable perf hit | Low | Each content script is ~30 KB; no startup cost on non-user activation |
| Scope-root heuristic gets it wrong on a new site pattern | Medium | Smoke-test list covers the seven targets; expand as issues arise |
| Voice migration maps a user to a voice they dislike | Medium | Migration runs once; user can change voice in popup anytime |
| Beta voices sound bad and reflect on product | Low | Beta tag exists; non-blocking. Can swap voice IDs without spec changes |

## 11. Rollout

- Ship as version **2.1.0**.
- No behind-flag rollout; changes are diffuse and hard to toggle.
- Changelog entry highlights Gmail / Claude / ChatGPT support and new voices.
- Monitor extension reviews for the week following release. If regressions appear on sites that previously worked, patch 2.1.1 with narrower scope-root heuristics.
