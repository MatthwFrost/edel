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
