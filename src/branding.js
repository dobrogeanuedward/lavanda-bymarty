// A synchronous same-origin head script sets the saved palette before CSS paints.
// app.js also imports this file: the global guard keeps initialization idempotent.
(() => {
  if (globalThis.LavandaBranding || !globalThis.document) return;
  const doc = globalThis.document;
  const key = 'lavanda-brand-direction';
  const versions = ['01', '02'];
  const assets = new Set(['logo.svg', 'logo-inverse.svg', 'wordmark.svg', 'emblem.svg', 'favicon.svg']);
  const photos = new Set(['manifesto', 'botanical', 'ritual', 'tarot']);
  let brand = '02', initialized = false;
  try { const saved = globalThis.localStorage?.getItem(key); if (versions.includes(saved)) brand = saved; } catch {}
  doc.documentElement.dataset.brand = brand;

  function sources(element) {
    if (element.dataset.brand01 && element.dataset.brand02) return [element.dataset.brand01, element.dataset.brand02];
    let asset = element.dataset.brandAsset, photo = element.dataset.brandPhoto;
    // The CMS can add reading-end emblems or initial study photos after page load.
    if (!asset && !photo) {
      const source = element.getAttribute('src') || element.getAttribute('href') || '';
      asset = source.match(/^\/brand(?:-v1)?\/([^/?#]+)$/)?.[1];
      photo = source.match(/^\/assets\/(?:bottega-)?(manifesto|botanical|ritual|tarot)\.webp$/)?.[1];
    }
    if (assets.has(asset)) {
      element.dataset.brandAsset = asset;
      const paths = [`/brand-v1/${asset}`, `/brand/${asset}`];
      return paths.map(path => globalThis.LavandaAssets?.[path]?.src || path);
    }
    if (photos.has(photo)) {
      element.dataset.brandPhoto = photo;
      const paths = [`/assets/${photo}.webp`, `/assets/bottega-${photo}.webp`];
      return paths.map(path => globalThis.LavandaAssets?.[path]?.src || path);
    }
    return null;
  }

  function apply() {
    doc.documentElement.dataset.brand = brand;
    doc.querySelectorAll('img, link[rel="icon"]').forEach(element => {
      const choices = sources(element);
      if (!choices) return;
      const attribute = element.tagName === 'LINK' ? 'href' : 'src';
      const source = choices[brand === '01' ? 0 : 1];
      if (element.getAttribute(attribute) !== source) element.setAttribute(attribute, source);
    });
    doc.querySelectorAll('source[data-brand-01-srcset], img[data-brand-01-srcset]').forEach(element => {
      const set = element.getAttribute(`data-brand-${brand}-srcset`) || '';
      if (element.getAttribute('srcset') !== set) element.setAttribute('srcset', set);
    });
    doc.querySelectorAll('[data-brand-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.brandSelect === brand)));
    const colour = doc.querySelector('meta[name="theme-color"]');
    const value = colour?.getAttribute(`data-brand-${brand}`);
    if (value) colour.setAttribute('content', value);
  }

  function setBrand(next, { persist = true, announce = true } = {}) {
    if (!versions.includes(next)) return brand;
    const changed = next !== brand;
    brand = next;
    if (persist) try { globalThis.localStorage?.setItem(key, brand); } catch {}
    apply();
    if (announce) doc.querySelectorAll('[data-brand-status]').forEach(status => { status.textContent = `Direzione visiva ${brand} attiva.`; });
    if (changed && typeof globalThis.CustomEvent === 'function') doc.dispatchEvent(new CustomEvent('lavanda-brand-changed', { detail: { brand } }));
    return brand;
  }

  function init() {
    apply();
    if (initialized) return;
    initialized = true;
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('[data-brand-select]');
      if (button) setBrand(button.dataset.brandSelect);
    });
    doc.addEventListener('keydown', event => {
      const button = event.target.closest?.('[data-brand-select]');
      if (!button) return;
      let next;
      if (['ArrowRight', 'ArrowLeft'].includes(event.key)) next = button.dataset.brandSelect === '01' ? '02' : '01';
      if (event.key === 'Home') next = '01';
      if (event.key === 'End') next = '02';
      if (next) { event.preventDefault(); setBrand(next); doc.querySelector(`[data-brand-select="${next}"]`)?.focus(); }
    });
    globalThis.addEventListener?.('storage', event => { if (event.key === key && versions.includes(event.newValue)) setBrand(event.newValue, { persist: false, announce: false }); });
    if (typeof globalThis.MutationObserver === 'function') new MutationObserver(apply).observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'srcset', 'data-brand-01', 'data-brand-02', 'data-brand-01-srcset', 'data-brand-02-srcset'] });
  }

  globalThis.LavandaBranding = { init, apply, setBrand, getBrand: () => brand };
  init();
})();
