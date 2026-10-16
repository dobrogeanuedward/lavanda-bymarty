import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../src/branding.js', import.meta.url), 'utf8');
function element(tagName, attributes = {}) {
  const node = { tagName, attributes: { ...attributes }, dataset: {}, focused: false, textContent: '' };
  for (const [name, value] of Object.entries(attributes)) if (name.startsWith('data-')) node.dataset[name.slice(5).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())] = value;
  node.getAttribute = name => node.attributes[name] ?? null;
  node.setAttribute = (name, value) => { node.attributes[name] = value; };
  node.closest = selector => selector === '[data-brand-select]' && node.dataset.brandSelect ? node : null;
  node.focus = () => { node.focused = true; };
  return node;
}
function browser({ storage = new Map(), blockedStorage = false, headOnly = false, assetMap = {} } = {}) {
  const images = headOnly ? [] : [
    element('IMG', { src: '/brand/logo.svg', 'data-brand-asset': 'logo.svg', 'data-brand-01': '/brand-v1/logo.svg', 'data-brand-02': '/brand/logo.svg' }),
    element('IMG', { src: 'https://cdn.test/assets/bottega-manifesto.webp', 'data-brand-photo': 'manifesto', 'data-brand-01': 'https://cdn.test/assets/manifesto.webp', 'data-brand-02': 'https://cdn.test/assets/bottega-manifesto.webp', 'data-brand-01-srcset': '/r2/lavanda/first.640.webp 640w', 'data-brand-02-srcset': '/r2/lavanda/second.640.webp 640w' }),
    element('LINK', { rel: 'icon', href: '/brand/favicon.svg', 'data-brand-asset': 'favicon.svg' }),
    element('IMG', { src: '/api/media?id=editorial-photo' }),
  ];
  const avifSource = element('SOURCE', { srcset: '/r2/lavanda/second.640.avif 640w', 'data-brand-01-srcset': '/r2/lavanda/first.640.avif 640w', 'data-brand-02-srcset': '/r2/lavanda/second.640.avif 640w' });
  const buttons = headOnly ? [] : ['01', '02'].map(version => element('BUTTON', { 'data-brand-select': version }));
  const status = element('SPAN');
  const theme = element('META', { 'data-brand-01': '#8093F1', 'data-brand-02': '#B58CFF', content: '#B58CFF' });
  const events = {}, windowEvents = {}, changes = [];
  let mutationCallback;
  const document = {
    documentElement: { dataset: {} },
    querySelectorAll(selector) { return selector === 'img, link[rel="icon"]' ? images : selector === '[data-brand-select]' ? buttons : selector === '[data-brand-status]' ? [status] : selector === 'source[data-brand-01-srcset], img[data-brand-01-srcset]' ? [avifSource, ...images.filter(image => image.dataset.brand01Srcset)] : []; },
    querySelector(selector) { return selector === 'meta[name="theme-color"]' ? theme : buttons.find(button => selector === `[data-brand-select="${button.dataset.brandSelect}"]`) || null; },
    addEventListener(name, callback) { (events[name] ||= []).push(callback); },
    dispatchEvent(event) { changes.push(event); },
  };
  const context = vm.createContext({ document, LavandaAssets: assetMap, localStorage: { getItem(name) { if (blockedStorage) throw new Error('Storage blocked'); return storage.get(name) ?? null; }, setItem(name, value) { if (blockedStorage) throw new Error('Storage blocked'); storage.set(name, value); } }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, MutationObserver: class { constructor(callback) { mutationCallback = callback; } observe() {} }, addEventListener(name, callback) { windowEvents[name] = callback; } });
  vm.runInContext(script, context);
  return { context, document, images, buttons, status, theme, avifSource, storage, events, windowEvents, changes, mutate: () => mutationCallback(), api: context.LavandaBranding };
}

test('head bootstrap applies the saved palette before body assets exist', () => {
  const browserState = browser({ storage: new Map([['lavanda-brand-direction', '01']]), headOnly: true });
  assert.equal(browserState.document.documentElement.dataset.brand, '01');
  const photo = element('IMG', { src: '/assets/bottega-botanical.webp', 'data-brand-photo': 'botanical' });
  browserState.images.push(photo);
  browserState.mutate();
  assert.equal(photo.getAttribute('src'), '/assets/botanical.webp');
});

test('switch changes every branded logo, favicon and CDN photo, retaining editorial media', () => {
  const state = browser();
  assert.equal(state.api.getBrand(), '02');
  state.events.click[0]({ target: state.buttons[0] });
  assert.equal(state.document.documentElement.dataset.brand, '01');
  assert.equal(state.images[0].getAttribute('src'), '/brand-v1/logo.svg');
  assert.equal(state.images[1].getAttribute('src'), 'https://cdn.test/assets/manifesto.webp');
  assert.equal(state.images[2].getAttribute('href'), '/brand-v1/favicon.svg');
  assert.equal(state.images[3].getAttribute('src'), '/api/media?id=editorial-photo');
  assert.equal(state.theme.getAttribute('content'), '#8093F1');
  assert.equal(state.images[1].getAttribute('srcset'), '/r2/lavanda/first.640.webp 640w');
  assert.equal(state.avifSource.getAttribute('srcset'), '/r2/lavanda/first.640.avif 640w');
  assert.equal(state.buttons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(state.buttons[1].getAttribute('aria-pressed'), 'false');
  assert.equal(state.status.textContent, 'Direzione visiva 01 attiva.');
  assert.equal(state.changes[0].type, 'lavanda-brand-changed');
  state.events.click[0]({ target: state.buttons[1] });
  assert.equal(state.images[1].getAttribute('src'), 'https://cdn.test/assets/bottega-manifesto.webp');
  assert.equal(state.avifSource.getAttribute('srcset'), '/r2/lavanda/second.640.avif 640w');
});

test('selected direction survives a new page and blocked storage keeps the switch usable', () => {
  const storage = new Map();
  browser({ storage }).api.setBrand('01');
  const nextPage = browser({ storage });
  assert.equal(nextPage.api.getBrand(), '01');
  assert.equal(nextPage.images[0].getAttribute('src'), '/brand-v1/logo.svg');
  const blocked = browser({ blockedStorage: true });
  assert.equal(blocked.api.setBrand('01'), '01');
  assert.equal(blocked.images[0].getAttribute('src'), '/brand-v1/logo.svg');
});

test('keyboard selection, storage synchronization and double loading are accessible and idempotent', () => {
  const state = browser();
  let prevented = false;
  state.events.keydown[0]({ target: state.buttons[1], key: 'Home', preventDefault() { prevented = true; } });
  assert.ok(prevented); assert.equal(state.api.getBrand(), '01'); assert.ok(state.buttons[0].focused);
  state.windowEvents.storage({ key: 'lavanda-brand-direction', newValue: '02' });
  assert.equal(state.api.getBrand(), '02');
  vm.runInContext(script, state.context);
  state.api.init();
  assert.equal(state.events.click.length, 1);
  assert.equal(state.api.setBrand('javascript:bad'), '02');
});

test('CMS-inserted reading-end logos and study photos inherit the active direction', () => {
  const state = browser({ storage: new Map([['lavanda-brand-direction', '01']]) });
  const logo = element('IMG', { src: '/brand/emblem.svg' });
  const photo = element('IMG', { src: '/assets/ritual.webp' });
  state.images.push(logo, photo); state.mutate();
  assert.equal(logo.getAttribute('src'), '/brand-v1/emblem.svg');
  state.api.setBrand('02');
  assert.equal(logo.getAttribute('src'), '/brand/emblem.svg');
  assert.equal(photo.getAttribute('src'), '/assets/bottega-ritual.webp');
});

test('CMS-inserted logos use the generated verified asset map rather than a local fallback', () => {
  const state = browser({ storage: new Map([['lavanda-brand-direction', '01']]), assetMap: { '/brand/emblem.svg': { src: '/r2/lavanda/brand--emblem.hash.svg' }, '/brand-v1/emblem.svg': { src: '/r2/lavanda/brand-v1--emblem.hash.svg' } } });
  const logo = element('IMG', { src: '/brand/emblem.svg' });
  state.images.push(logo); state.mutate();
  assert.equal(logo.getAttribute('src'), '/r2/lavanda/brand-v1--emblem.hash.svg');
  state.api.setBrand('02');
  assert.equal(logo.getAttribute('src'), '/r2/lavanda/brand--emblem.hash.svg');
});

test('build serves the CSP-compatible synchronous script before CSS and preserves both asset alternatives', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('<script src="/branding.js"></script>') < html.indexOf('rel="stylesheet"'));
  assert.match(html, /data-brand="02"/);
  assert.match(html, /role="group" aria-label="Direzione visiva"/);
  assert.match(html, /data-brand-select="01" aria-pressed="false"/);
  assert.match(html, /data-brand-asset="emblem.svg" data-brand-01="[^"]*emblem(?:\.[a-f0-9]{20})?\.svg" data-brand-02="[^"]*emblem(?:\.[a-f0-9]{20})?\.svg"/);
  assert.match(html, /data-brand-photo="manifesto" data-brand-01="[^"]*manifesto(?:\.\d+)?(?:\.[a-f0-9]{20})?\.webp" data-brand-02="[^"]*manifesto(?:\.\d+)?(?:\.[a-f0-9]{20})?\.webp"/);
  assert.doesNotMatch(html, /<script>[^<]/);
});
