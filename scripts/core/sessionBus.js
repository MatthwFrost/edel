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
