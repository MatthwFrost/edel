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
