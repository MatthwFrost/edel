import AudioPlayer from './audioPlayer.js';
import { InputHandler } from './inputHandler.js';
import { injectHighlightStyles, showOnboarding } from './highlighter.js';
import { installChildListener } from './frameGuard.js';
import { resolveTextBlockAtPoint } from './textExtractor.js';

function init() {
    injectHighlightStyles();

    const handler = new InputHandler();
    handler.setAudioPlayerConstructor(AudioPlayer);
    handler.activate();

    installChildListener(
        (x, y) => {
            handler._lastMouseX = x;
            handler._lastMouseY = y;
            handler._maybeInitHeavy();
            const resolved = resolveTextBlockAtPoint(x, y);
            if (!resolved) return;
            handler._pendingTarget = resolved;
            handler._startHoldReading();
        },
        (x, y) => {
            handler._lastMouseX = x;
            handler._lastMouseY = y;
            handler._maybeInitHeavy();
            const resolved = resolveTextBlockAtPoint(x, y);
            if (!resolved) return;
            handler._pendingTarget = resolved;
            handler._startContinuousReading();
        }
    );

    if (window === window.top) showOnboarding();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
