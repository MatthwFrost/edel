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
