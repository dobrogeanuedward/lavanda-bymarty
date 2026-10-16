// Public presentation only: callers must pass an already published entry.
const SOCIAL_NAMES = { instagram: 'Instagram', facebook: 'Facebook', pinterest: 'Pinterest', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', mastodon: 'Mastodon', threads: 'Threads' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = (value, max = 1000) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const decode = value => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[entity]));

/** Accept only HTTPS URLs without credentials, or single-slash local paths. */
export function publicUrl(value, { local = true } = {}) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\\<>"'\u0000-\u001f\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return '';
  if (local && /^\/(?!\/)/.test(value)) {
    // Encoded slash/backslash prefixes can become a scheme-relative URL after decoding.
    if (/^\/(?:%2f|%5c|%25(?:2f|5c))/i.test(value)) return '';
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function meta(html, attribute, name, value) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*>`, 'gi');
  const tag = value ? `<meta ${attribute}="${name}" content="${escape(value)}">` : '';
  let found = false;
  html = html.replace(pattern, () => { if (found) return ''; found = true; return tag; });
  return !found && tag ? html.replace(/<\/head>/i, () => `${tag}</head>`) : html;
}

function canonicalTag(html, value) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
  const tag = value ? `<link rel="canonical" href="${escape(value)}">` : '';
  let found = false;
  html = html.replace(pattern, () => { if (found) return ''; found = true; return tag; });
  return !found && tag ? html.replace(/<\/head>/i, () => `${tag}</head>`) : html;
}

function originalMeta(html, name) {
  const match = html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*\\bcontent=["']([^"']*)["'][^>]*>`, 'i'));
  return match ? decode(match[1]) : '';
}

function pagePath(value) {
  const safe = publicUrl(value);
  if (!safe.startsWith('/')) return '/';
  try { return new URL(safe, 'https://lavanda.invalid').pathname; } catch { return '/'; }
}

/**
 * Apply CMS public settings and entry SEO to a generated HTML shell.
 * `path` is the public page path; `origin` must come from trusted app configuration.
 * Explicit noindex always wins; otherwise the shell's indexing policy is retained.
 */
export function applySitePresentation(html, { settings = {}, entry = null, view = 'home', path = '/', origin = '', noindex } = {}) {
  settings = object(settings);
  const siteSeo = object(settings.seo), entrySeo = object(entry?.seo);
  const siteTitle = text(settings.site_title, 150) || 'Lavanda';
  const isHome = view === 'home';
  const existingTitle = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || siteTitle);
  const title = text(entrySeo.title, 180) || (entry ? `${text(entry.title, 240) || siteTitle} | ${siteTitle}` : isHome ? text(siteSeo.title, 180) || siteTitle : existingTitle.replace(/\s*\|\s*Lavanda$/, () => ` | ${siteTitle}`));
  const description = text(entrySeo.description, 500) || text(entry?.excerpt) || text(siteSeo.description, 500) || text(settings.site_description) || originalMeta(html, 'description');
  const route = pagePath(path);
  const siteCanonical = publicUrl(siteSeo.canonical, { local: false });
  const trustedOrigin = publicUrl(origin, { local: false });
  const base = siteCanonical || trustedOrigin;
  const canonical = publicUrl(entrySeo.canonical, { local: false }) || (base ? isHome ? siteCanonical || new URL('/', base).href : new URL(route, base).href : '');
  const shellNoindex = /(?:^|,)\s*noindex\s*(?:,|$)/i.test(originalMeta(html, 'robots'));
  const blockIndex = noindex === true || siteSeo.noindex === true || entrySeo.noindex === true || (noindex !== false && siteSeo.noindex !== false && entrySeo.noindex !== false && shellNoindex);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escape(title)}</title>`);
  html = meta(html, 'name', 'description', description);
  html = meta(html, 'name', 'robots', blockIndex ? 'noindex,follow' : 'index,follow');
  html = meta(html, 'property', 'og:title', title);
  html = meta(html, 'property', 'og:description', description);
  html = meta(html, 'property', 'og:site_name', siteTitle);
  html = meta(html, 'property', 'og:type', entry?.type === 'post' ? 'article' : 'website');
  html = canonicalTag(html, canonical);
  html = meta(html, 'property', 'og:url', canonical);
  let image = publicUrl(entry?.metadata?.cover_url);
  if (typeof entry?.cover_media_id === 'string' && /^[0-9a-f-]{36}$/i.test(entry.cover_media_id)) image = `/api/media?id=${encodeURIComponent(entry.cover_media_id)}`;
  if (image.startsWith('/')) image = base ? new URL(image, base).href : '';
  html = meta(html, 'property', 'og:image', image);
  html = meta(html, 'property', 'og:image:alt', image ? text(entry?.metadata?.image_alt) : '');

  html = html.replace(/(<a\b[^>]*\bclass="brand-small"[^>]*>)([\s\S]*?)(<\/a>)/i, (_, open, inner, close) => open.replace(/\baria-label="[^"]*"/, () => `aria-label="${escape(siteTitle)}, home"`) + inner.replace(/<span>[\s\S]*?<\/span>/, () => `<span>${escape(siteTitle)}</span>`) + close);
  if (typeof settings.tagline === 'string') html = html.replace(/(<div\b[^>]*\bclass="cover-kicker"[^>]*>\s*<p>[\s\S]*?<\/p>\s*<p>)[\s\S]*?(<\/p>)/i, (_, prefix, suffix) => prefix + escape(text(settings.tagline, 240)) + suffix);
  if (Array.isArray(settings.navigation)) {
    const links = settings.navigation.slice(0, 20).flatMap(item => {
      const label = text(item?.label, 80), href = publicUrl(item?.href);
      if (!label || !href) return [];
      const localPath = href.startsWith('/') ? pagePath(href) : '';
      const current = localPath && (route === localPath || (localPath !== '/' && route.startsWith(`${localPath.replace(/\/$/, '')}/`)));
      return [`<a href="${escape(href)}"${current ? ' aria-current="page"' : ''}${href.startsWith('https:') ? ' rel="noopener noreferrer"' : ''}>${escape(label)}</a>`];
    }).join('');
    html = html.replace(/(<nav\b[^>]*\bid="navigation"[^>]*>)[\s\S]*?(<\/nav>)/i, (_, open, close) => open + links + close);
  }
  html = html.replace(/(<footer\b[^>]*\bclass="footer"[^>]*>)([\s\S]*?)(<\/footer>)/i, (_, open, body, close) => {
    body = body.replace(/(<a\b[^>]*\bhref="\/"[^>]*>)([\s\S]*?)(<\/a>)/i, (_, link, brand, end) => link.replace(/\baria-label="[^"]*"/, () => `aria-label="${escape(siteTitle)}, home"`) + brand.replace(/\balt="Lavanda"/, () => `alt="${escape(siteTitle)}"`) + end);
    if (typeof settings.tagline === 'string') body = body.replace(/(<\/a>\s*<p>)[\s\S]*?(<\/p>)/i, (_, prefix, suffix) => prefix + escape(text(settings.tagline, 240)) + suffix);
    if (typeof settings.site_description === 'string') body = body.replace(/(<\/div>\s*<p>)[\s\S]*?(<\/p>)/i, (_, prefix, suffix) => prefix + escape(text(settings.site_description)) + suffix);
    body = body.replace(/<nav\b[^>]*\bdata-cms-social\b[^>]*>[\s\S]*?<\/nav>/gi, '');
    const socials = Object.entries(object(settings.social_links)).flatMap(([name, url]) => {
      const href = publicUrl(url, { local: false });
      return Object.hasOwn(SOCIAL_NAMES, name) && href ? [`<a href="${escape(href)}" rel="noopener noreferrer">${SOCIAL_NAMES[name]}</a>`] : [];
    }).join('');
    if (socials) body += `<nav class="footer-social" data-cms-social aria-label="Social">${socials}</nav>`;
    return open + body + close;
  });
  return html;
}
