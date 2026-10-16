import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetDelivery, R2_PUBLIC_BASE, transformHTML, transformCSS } from '../scripts/asset-delivery.mjs';

function record(stem, format = 'webp', width) {
  const sha256 = 'a'.repeat(64), key = `lavanda/${stem}.${sha256.slice(0, 20)}.${format}`;
  return { key, path: '/r2/' + key, url: R2_PUBLIC_BASE + '/' + key, sha256, bytes: 100, status: 'verified', contentType: format === 'woff' ? 'font/woff' : `image/${format === 'svg' ? 'svg+xml' : format}`, ...(width ? { width, height: Math.round(width / 1.5) } : {}) };
}
function photo(name) {
  const variants = { webp: [record(name + '.640', 'webp', 640), record(name + '.1536', 'webp', 1536)], avif: [record(name + '.640', 'avif', 640), record(name + '.1536', 'avif', 1536)] };
  return { ...variants.webp[1], variants };
}
function manifest() {
  return { version: 1, mode: 'verified', bucket: 'dogostudio', prefix: 'lavanda', publicBase: R2_PUBLIC_BASE, assets: { '/assets/manifesto.webp': photo('assets--manifesto'), '/assets/bottega-manifesto.webp': photo('assets--bottega-manifesto'), '/brand/emblem.svg': record('brand--emblem', 'svg'), '/brand-v1/emblem.svg': record('brand-v1--emblem', 'svg'), '/fonts/lavanda.woff': record('fonts--lavanda', 'woff') } };
}

test('absent manifest preserves local QA, while dry-run and unverified inventories fail closed', () => {
  assert.equal(createAssetDelivery().transformHTML('<img src="/assets/local.webp">'), '<img src="/assets/local.webp">');
  assert.throws(() => createAssetDelivery({ ...manifest(), mode: 'dry-run' }), /must be verified/);
  const invalid = manifest(); invalid.assets['/brand/emblem.svg'].status = 'planned';
  assert.throws(() => createAssetDelivery(invalid), /unsafe or unverified/);
  const plannedVariant = manifest(); plannedVariant.assets['/assets/manifesto.webp'].variants.avif[0].status = 'planned';
  assert.throws(() => createAssetDelivery(plannedVariant), /unsafe or unverified/);
});

test('only the fixed DOGO bucket, flat hashed prefix and public CDN are accepted', () => {
  assert.throws(() => createAssetDelivery({ ...manifest(), bucket: 'other' }), /Unexpected/);
  const invalid = manifest(); invalid.assets['/brand/emblem.svg'].path = '/r2/lavanda/../private.svg';
  assert.throws(() => createAssetDelivery(invalid), /unsafe/);
  const code = manifest(); code.assets['/app.js'] = record('app', 'svg');
  assert.throws(() => createAssetDelivery(code), /only static asset paths/);
});

test('HTML images, brand alternatives and AVIF/WebP responsive sources use the verified proxy paths', () => {
  const data = manifest();
  const html = transformHTML('<img src="/assets/bottega-manifesto.webp" alt="Una foto" data-brand-photo="manifesto" data-brand-01="/assets/manifesto.webp" data-brand-02="/assets/bottega-manifesto.webp" loading="lazy">', data);
  assert.match(html, /^<picture class="asset-picture"><source type="image\/avif"/);
  assert.match(html, /srcset="\/r2\/lavanda\/assets--bottega-manifesto\.640\.[a-f0-9]{20}\.avif 640w, \/r2\/lavanda\/assets--bottega-manifesto\.1536\.[a-f0-9]{20}\.avif 1536w"/);
  assert.match(html, /data-brand-01-srcset="\/r2\/lavanda\/assets--manifesto\.640\.[a-f0-9]{20}\.webp 640w/);
  assert.match(html, /data-brand-02="\/r2\/lavanda\/assets--bottega-manifesto\.1536\.[a-f0-9]{20}\.webp"/);
  assert.match(html, /sizes="\(max-width: 720px\)/);
  assert.match(html, /width="1536" height="1024"/);
  assert.doesNotMatch(html, /="\/assets\//);
});

test('relative fonts and image URLs in CSS resolve against their actual file location', () => {
  const css = transformCSS('@font-face{src:url("../fonts/lavanda.woff")} .mark{background:url(/brand/emblem.svg#sign)} .inline{background:url(data:image/svg+xml;base64,abc)}', manifest(), '/admin/admin.css');
  assert.match(css, /url\("\/r2\/lavanda\/fonts--lavanda\.[a-f0-9]{20}\.woff"\)/);
  assert.match(css, /\/r2\/lavanda\/brand--emblem\.[a-f0-9]{20}\.svg#sign/);
  assert.match(css, /url\(data:image\/svg\+xml;base64,abc\)/);
});

test('application code, stylesheets, navigation, API media and external links are preserved', () => {
  const source = '<script src="/app.js"></script><script>const sample = \'<img src="/assets/not-in-manifest.webp">\';</script><link rel="stylesheet" href="/style.css"><a href="/blog/">Blog</a><img src="/api/media?id=x" alt="CMS"><a href="https://example.test/">Altro</a>';
  assert.equal(transformHTML(source, manifest()), source);
});

test('missing assets fail the verified build and public maps contain delivery data only', () => {
  const delivery = createAssetDelivery(manifest());
  assert.throws(() => delivery.transformHTML('<img src="/assets/missing.webp">'), /missing from the verified R2 manifest/);
  assert.throws(() => delivery.transformCSS('a{background:url(/icons/missing.svg)}'), /missing from the verified R2 manifest/);
  assert.equal(delivery.publicMap['/brand/emblem.svg'].src, manifest().assets['/brand/emblem.svg'].path);
  assert.equal(delivery.publicMap['/brand/emblem.svg'].sha256, undefined);
  assert.ok(delivery.hasDeliveredPath(manifest().assets['/assets/manifesto.webp'].variants.avif[0].path));
});

test('server-inserted brand emblems gain both verified alternatives before delivery rewriting', () => {
  const html = transformHTML('<img src="/brand/emblem.svg" alt="">', manifest());
  assert.match(html, /data-brand-asset="emblem.svg"/);
  assert.match(html, /data-brand-01="\/r2\/lavanda\/brand-v1--emblem\.[a-f0-9]{20}\.svg"/);
  assert.match(html, /data-brand-02="\/r2\/lavanda\/brand--emblem\.[a-f0-9]{20}\.svg"/);
});

test('relative brand-sheet assets and inline CSS use their page directory', () => {
  const html = transformHTML('<img src="emblem.svg" alt=""><style>a{background:url(emblem.svg)}</style><div style="background:url(\'emblem.svg\')"></div>', manifest(), '/brand/brand-sheet.html');
  assert.equal((html.match(/\/r2\/lavanda\/brand--emblem\.[a-f0-9]{20}\.svg/g) || []).length, 4);
});
