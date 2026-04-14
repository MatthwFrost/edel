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
