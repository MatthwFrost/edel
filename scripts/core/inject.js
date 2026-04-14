import AudioPlayer from './audioPlayer.js';
import { InputHandler } from './inputHandler.js';
import { injectHighlightStyles, showOnboarding } from './highlighter.js';

// PDF support — commented out for now
// function checkForPdf() {
//     const isPdf = document.contentType === 'application/pdf' ||
//                   /\.pdf(\?[^#]*)?(#.*)?$/i.test(location.href);
//     if (!isPdf) return false;
//
//     chrome.storage.local.get('readel_bypass_pdf', (items) => {
//         if (items.readel_bypass_pdf === location.href) {
//             chrome.storage.local.remove('readel_bypass_pdf');
//             return;
//         }
//         chrome.runtime.sendMessage({ action: 'open-pdf-viewer', url: location.href });
//     });
//     return true;
// }

function init() {
    // PDF redirect — commented out
    // if (!location.href.startsWith('chrome-extension://') && checkForPdf()) return;
    // const isViewerPage = location.href.includes('viewer/viewer.html');

    const bodyText = document.body?.innerText || '';
    if (bodyText.length < 200) return;

    injectHighlightStyles();

    const player = new AudioPlayer();
    const handler = new InputHandler(player);
    handler.activate();

    showOnboarding();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
