// Run: node plugins/publii/test/test.js
const assert = require('assert');
const vm = require('vm');
const path = require('path');
const fs = require('fs');

const Plugin = require('../asyntai-ai-chatbot/main.js');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../asyntai-ai-chatbot/plugin.json'), 'utf8'));

let passed = 0;
function test (name, fn) {
    fn();
    passed++;
    console.log('ok - ' + name);
}

function render (config) {
    let insertions = [];
    let api = { addInsertion: (place, cb, priority, inst) => insertions.push({ place, cb, inst }) };
    let plugin = new Plugin(api, 'asyntai-ai-chatbot', config);
    plugin.addInsertions();
    assert.strictEqual(insertions.length, 1);
    assert.strictEqual(insertions[0].place, 'publiiFooter');
    return insertions[0].cb.bind(insertions[0].inst, {}, false)();
}

const EMBED = '<script>(function(){var l=function(){var s=document.createElement("script");s.src="https://widget.asyntai.com/static/js/chat-widget.js";s.async=true;s.setAttribute("data-asyntai-id","asyntai_2bcd9dfbae24");document.head.appendChild(s)};if(document.readyState==="complete"){l()}else{window.addEventListener("load",l)}})();</script>';

test('manifest has every field Publii validates', () => {
    for (let key of ['name', 'version', 'author', 'scope', 'minimumPubliiVersion']) {
        assert.ok(manifest[key], key);
    }
    assert.strictEqual(manifest.scope, 'site');
});

test('finds the ID in the dashboard embed code', () => {
    assert.strictEqual(Plugin.findWidgetId(EMBED), 'asyntai_2bcd9dfbae24');
});

test('finds the ID in a plain script tag', () => {
    assert.strictEqual(Plugin.findWidgetId('<script src="x" data-asyntai-id="abc123" defer></script>'), 'abc123');
});

test('accepts a bare ID with spaces', () => {
    assert.strictEqual(Plugin.findWidgetId('  asyntai_2bcd9dfbae24 \n'), 'asyntai_2bcd9dfbae24');
});

test('rejects junk and empty values', () => {
    for (let bad of ['', null, undefined, 'hello world', '"><script>alert(1)</script>', 'a'.repeat(65)]) {
        assert.strictEqual(Plugin.findWidgetId(bad), '', String(bad));
    }
});

test('prints nothing without an ID', () => {
    assert.strictEqual(render({ widgetId: '' }), '');
});

test('prints a script that loads the widget after the load event', () => {
    let html = render({ widgetId: EMBED });
    assert.ok(html.startsWith('<script>') && html.endsWith('</script>'));
    let js = html.slice('<script>'.length, -'</script>'.length);
    let added = [];
    let listeners = {};
    let doc = {
        readyState: 'loading',
        createElement: () => ({ attrs: {}, setAttribute (k, v) { this.attrs[k] = v; } }),
        head: { appendChild: (el) => added.push(el) }
    };
    let win = { addEventListener: (ev, fn) => { listeners[ev] = fn; } };
    vm.runInNewContext(js, { document: doc, window: win });
    assert.strictEqual(added.length, 0, 'waits for load');
    listeners.load();
    assert.strictEqual(added.length, 1);
    assert.strictEqual(added[0].src, 'https://widget.asyntai.com/static/js/chat-widget.js');
    assert.strictEqual(added[0].attrs['data-asyntai-id'], 'asyntai_2bcd9dfbae24');
    assert.strictEqual(added[0].async, true);
});

test('runs at once when the page has already loaded (cookie consent case)', () => {
    let js = render({ widgetId: 'abc' }).slice(8, -9);
    let added = [];
    let doc = {
        readyState: 'complete',
        createElement: () => ({ setAttribute () {} }),
        head: { appendChild: (el) => added.push(el) }
    };
    vm.runInNewContext(js, { document: doc, window: { addEventListener () {} } });
    assert.strictEqual(added.length, 1);
});

test('cookie banner on: script waits for the consent group', () => {
    let html = render({ widgetId: 'abc', cookieBannerIntegration: true, cookieBannerGroup: ' functional ' });
    assert.ok(html.startsWith('<script type="gdpr-blocker/functional">'), html);
});

test('cookie banner on but no group: loads normally', () => {
    assert.ok(render({ widgetId: 'abc', cookieBannerIntegration: true, cookieBannerGroup: '' }).startsWith('<script>'));
});

test('group ID cannot break out of the attribute', () => {
    let html = render({ widgetId: 'abc', cookieBannerIntegration: true, cookieBannerGroup: 'a"><b' });
    assert.ok(html.startsWith('<script type="gdpr-blocker/ab">'), html);
});

console.log(passed + ' passed');
