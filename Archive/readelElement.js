class ReadelExtension extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Attach a shadow root to this element
        this.loadResources();
    }

    loadResources() {
        const htmlUrl = chrome.runtime.getURL('scripts/injectedContent.html');
        const cssUrl = chrome.runtime.getURL('scripts/elementStyle.css');

        Promise.all([
            fetch(htmlUrl).then(response => {
                if (!response.ok) throw new Error('Failed to load HTML');
                return response.text();
            }),
            fetch(cssUrl).then(response => {
                if (!response.ok) throw new Error('Failed to load CSS');
                return response.text();
            })
        ])
        .then(([htmlData, cssData]) => {
            this.render(htmlData, cssData);
        })
        .catch(err => {
            console.error('Failed to load resources:', err);
        });
    }

    render(htmlData, cssData) {
        const style = document.createElement('style');
        style.textContent = cssData;
        this.shadowRoot.appendChild(style);

        const div = document.createElement('div');
        div.innerHTML = htmlData;
        this.shadowRoot.appendChild(div);

        this.setupReadelExtension();
    }

    setupReadelExtension() {
        // Initialize functionality or add event listeners
        console.log('Readel extension setup complete.');
        // You can access shadowRoot directly with this.shadowRoot here
    }
}

export default ReadelExtension;