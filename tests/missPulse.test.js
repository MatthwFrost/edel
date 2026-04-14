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
