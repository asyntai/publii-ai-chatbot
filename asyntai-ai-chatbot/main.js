const WIDGET_SRC = 'https://widget.asyntai.com/static/js/chat-widget.js';

class AsyntaiAIChatbot {
    constructor (API, name, config) {
        this.API = API;
        this.name = name;
        this.config = config;
    }

    addInsertions () {
        this.API.addInsertion('publiiFooter', this.addWidget, 1, this);
    }

    /**
     * The owner may paste the whole embed code from the Asyntai dashboard
     * or only the widget ID. Returns the ID, or '' when none is found.
     */
    static findWidgetId (raw) {
        let value = String(raw || '').trim();

        if (!value) {
            return '';
        }

        let match = value.match(/data-asyntai-id["']?\s*[,=]\s*["']([^"']+)["']/i);

        if (match) {
            value = match[1].trim();
        }

        return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : '';
    }

    addWidget () {
        let widgetId = AsyntaiAIChatbot.findWidgetId(this.config.widgetId);

        if (!widgetId) {
            return '';
        }

        // Inject the widget only after the page's load event, so the page
        // never waits for the chatbot.
        let code = '(function(){var l=function(){var s=document.createElement("script");' +
            's.src=' + JSON.stringify(WIDGET_SRC) + ';s.async=true;' +
            's.setAttribute("data-asyntai-id",' + JSON.stringify(widgetId) + ');' +
            'document.head.appendChild(s)};' +
            'if(document.readyState==="complete"){l()}' +
            'else{window.addEventListener("load",l)}})();';

        let group = String(this.config.cookieBannerGroup || '').trim().replace(/[^A-Za-z0-9_-]/g, '');

        if (this.config.cookieBannerIntegration && group) {
            // Publii's Cookie Banner runs gdpr-blocker scripts after consent,
            // when the page has already loaded.
            return '<script type="gdpr-blocker/' + group + '">' + code + '</script>';
        }

        return '<script>' + code + '</script>';
    }
}

module.exports = AsyntaiAIChatbot;
