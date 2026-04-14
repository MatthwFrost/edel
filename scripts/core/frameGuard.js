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
