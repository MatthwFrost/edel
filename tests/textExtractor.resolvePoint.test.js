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
