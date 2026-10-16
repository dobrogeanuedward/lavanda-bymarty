import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const R2_PUBLIC_BASE = 'https://pub-b39e5084f7324516a4fe99c212a65c5f.r2.dev';
const ASSET = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|woff2?|ttf|otf|pdf|md|txt)$/i;
const SAFE_PATH = /^\/r2\/lavanda\/[A-Za-z0-9._~-]+$/;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const decode = value => value.replaceAll('&amp;', '&');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
function put(tag, name, value) {
  const expression = new RegExp(`\\s${name}=["'][^"']*["']`, 'i');
  const attribute = ` ${name}="${escape(value)}"`;
  return expression.test(tag) ? tag.replace(expression, () => attribute) : tag.replace(/\s*\/?>$/, () => `${attribute}>`);
}

export async function loadAssetDelivery(root) {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(root, 'content/asset-manifest.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return createAssetDelivery(); throw error; }
  return createAssetDelivery(manifest);
}

/** Build delivery is enabled only after the public bytes have been verified. */
export function createAssetDelivery(manifest = null) {
  if (!manifest) return { enabled: false, publicMap: {}, resolve: value => value, transformHTML: html => html, transformCSS: css => css, hasDeliveredPath: () => false };
  if (manifest.mode !== 'verified') throw Error('R2 asset manifest must be verified; a dry-run inventory cannot be published.');
  if (manifest.version !== 1 || manifest.bucket !== 'dogostudio' || manifest.prefix !== 'lavanda' || manifest.publicBase !== R2_PUBLIC_BASE || !manifest.assets || Array.isArray(manifest.assets)) throw Error('Unexpected R2 asset manifest.');
  const delivered = new Map();
  function validate(record) {
    if (!record || !SAFE_PATH.test(record.path) || !/^[a-f0-9]{64}$/.test(record.sha256) || !record.path.includes(`.${record.sha256.slice(0, 20)}.`) || !['verified', 'uploaded', 'existing'].includes(record.status) || record.key !== record.path.slice(4) || record.url !== R2_PUBLIC_BASE + record.path.slice(3) || !Number.isSafeInteger(record.bytes) || record.bytes < 1) throw Error('An R2 asset record is unsafe or unverified.');
    delivered.set(record.path, record);
  }
  for (const [source, record] of Object.entries(manifest.assets)) {
    if (!source.startsWith('/') || source.startsWith('//') || !ASSET.test(source) || new URL(source, 'https://lavanda.invalid').pathname !== source || /[\\\s?#]/.test(source)) throw Error('The R2 manifest may contain only static asset paths.');
    validate(record);
    for (const [format, variants] of Object.entries(record.variants || {})) {
      if (!['webp', 'avif'].includes(format) || !Array.isArray(variants)) throw Error('Unsupported R2 image variants.');
      for (const variant of variants) {
        validate(variant);
        if (!Number.isSafeInteger(variant.width) || variant.width < 1 || variant.contentType !== `image/${format}`) throw Error('Invalid responsive image variant.');
      }
    }
  }
  function reference(value, pathname = '/') {
    if (!value || /^(?:https?:|data:|mailto:|tel:|#|\/\/)/i.test(value)) return null;
    let url;
    try { url = new URL(decode(value), `https://lavanda.invalid${pathname.startsWith('/') ? pathname : '/' + pathname}`); } catch { return null; }
    if (url.pathname.startsWith('/api/')) return null;
    const assetPath = decodeURIComponent(url.pathname);
    if (!ASSET.test(assetPath) && !assetPath.startsWith('/r2/')) return null;
    return { path: assetPath, suffix: url.search + url.hash };
  }
  function recordFor(value, pathname) {
    const found = reference(value, pathname);
    if (!found) return null;
    const record = manifest.assets[found.path] || delivered.get(found.path);
    if (!record) throw Error(`Static asset is missing from the verified R2 manifest: ${found.path}`);
    return record;
  }
  function resolve(value, pathname) {
    const found = reference(value, pathname);
    if (!found) return value;
    const record = recordFor(value, pathname);
    return record.path + found.suffix;
  }
  function srcset(variants = []) {
    return [...variants].sort((a, b) => a.width - b.width).map(variant => `${variant.path} ${variant.width}w`).join(', ');
  }
  function resolveSet(value, pathname) {
    return value.split(',').map(part => {
      const match = part.trim().match(/^(\S+)(\s+[^\s]+)?$/);
      return match ? resolve(match[1], pathname) + (match[2] || '') : part;
    }).join(', ');
  }
  function transformCSS(css, pathname = '/style.css') {
    return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_, quote, value) => `url(${quote}${resolve(value.trim(), pathname)}${quote})`);
  }
  function transformHTML(html, pathname = '/') {
    const scripts = [];
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script => { scripts.push(script); return `<!-- LAVANDA_SCRIPT_${scripts.length - 1} -->`; });
    html = html.replace(/<img\b[^>]*>/gi, original => {
      const local = reference(attr(original, 'src'), pathname)?.path;
      const brandAsset = local?.match(/^\/brand(?:-v1)?\/(logo\.svg|logo-inverse\.svg|wordmark\.svg|emblem\.svg|favicon\.svg)$/)?.[1];
      const brandPhoto = local?.match(/^\/assets\/(?:bottega-)?(manifesto|botanical|ritual|tarot)\.webp$/)?.[1];
      if ((brandAsset || brandPhoto) && !attr(original, 'data-brand-01')) {
        original = put(original, brandAsset ? 'data-brand-asset' : 'data-brand-photo', brandAsset || brandPhoto);
        original = put(original, 'data-brand-01', brandAsset ? `/brand-v1/${brandAsset}` : `/assets/${brandPhoto}.webp`);
        original = put(original, 'data-brand-02', brandAsset ? `/brand/${brandAsset}` : `/assets/bottega-${brandPhoto}.webp`);
      }
      const record = recordFor(attr(original, 'src'), pathname);
      if (!record?.variants?.webp?.length) return original;
      const first = recordFor(attr(original, 'data-brand-01'), pathname), second = recordFor(attr(original, 'data-brand-02'), pathname);
      let tag = put(original, 'srcset', srcset(record.variants.webp));
      if (!attr(tag, 'sizes')) tag = put(tag, 'sizes', '(max-width: 720px) calc(100vw - 44px), (max-width: 1050px) 50vw, 720px');
      if (!attr(tag, 'width') && record.width) tag = put(tag, 'width', record.width);
      if (!attr(tag, 'height') && record.height) tag = put(tag, 'height', record.height);
      if (first || second) {
        tag = put(tag, 'data-brand-01-srcset', srcset(first?.variants?.webp));
        tag = put(tag, 'data-brand-02-srcset', srcset(second?.variants?.webp));
      }
      const avif = srcset(record.variants.avif);
      if (!avif) return tag;
      let source = `<source type="image/avif" srcset="${escape(avif)}" sizes="${escape(attr(tag, 'sizes'))}">`;
      if (first || second) {
        source = put(source, 'data-brand-01-srcset', srcset(first?.variants?.avif));
        source = put(source, 'data-brand-02-srcset', srcset(second?.variants?.avif));
      }
      return `<picture class="asset-picture">${source}${tag}</picture>`;
    });
    html = html.replace(/<(?:img|source|link|a|video|audio|track|object|embed|image)\b[^>]*>/gi, tag => tag.replace(/\b(src|href|poster|data|data-brand-01|data-brand-02|srcset|data-brand-01-srcset|data-brand-02-srcset)=["']([^"']*)["']/gi, (_, name, value) => `${name}="${escape(name.endsWith('srcset') ? resolveSet(decode(value), pathname) : resolve(decode(value), pathname))}"`));
    html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_, attributes, css) => `<style${attributes}>${transformCSS(css, pathname)}</style>`);
    html = html.replace(/\bstyle="([^"]*)"/gi, (_, css) => `style="${escape(transformCSS(decode(css), pathname))}"`);
    return html.replace(/<!-- LAVANDA_SCRIPT_(\d+) -->/g, (_, index) => scripts[Number(index)]);
  }
  const publicMap = Object.fromEntries(Object.entries(manifest.assets).map(([source, record]) => [source, { src: record.path, srcset: srcset(record.variants?.webp), avifSrcset: srcset(record.variants?.avif), ...(record.width ? { width: record.width, height: record.height } : {}) }]));
  return { enabled: true, publicMap, resolve, transformHTML, transformCSS, hasDeliveredPath: value => delivered.has(value) };
}

export const transformHTML = (html, manifest, pathname = '/') => createAssetDelivery(manifest).transformHTML(html, pathname);
export const transformCSS = (css, manifest, pathname = '/style.css') => createAssetDelivery(manifest).transformCSS(css, pathname);
