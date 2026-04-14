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
