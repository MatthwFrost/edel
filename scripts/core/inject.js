import AudioPlayer from './audioPlayer.js';
import { InputHandler } from './inputHandler.js';
import { injectHighlightStyles, showOnboarding } from './highlighter.js';

function init() {
    injectHighlightStyles();

    const handler = new InputHandler();
    handler.setAudioPlayerConstructor(AudioPlayer);
    handler.activate();

    if (window === window.top) showOnboarding();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
