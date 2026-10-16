import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySitePresentation, publicUrl } from '../lib/site-presentation.mjs';

const shell = '<!doctype html><html><head><title>Gli scritti | Lavanda</title><meta name="description" content="Descrizione iniziale"><meta name="robots" content="noindex,follow"><meta property="og:title" content="Titolo iniziale"><meta property="og:description" content="Vecchia descrizione"><meta property="og:type" content="website"></head><body><header><a class="brand-small" href="/" aria-label="Lavanda, home"><img src="/brand/emblem.svg" alt=""><span>Lavanda</span></a><nav id="navigation" aria-label="Navigazione principale"><a href="/blog/">Blog</a></nav></header><main id="contenuto"><p>Testo editoriale Lavanda</p></main><footer class="footer"><div><a href="/" aria-label="Lavanda, home"><img src="/brand/logo-inverse.svg" alt="Lavanda"></a><p>Strega di quartiere</p></div><p>Una ricerca.<br>Un progetto di Martina.</p><nav aria-label="Altri percorsi"><a href="/studio/">Studio</a></nav></footer></body></html>';

test('public settings change identity, footer, menu and social without touching editorial body', () => {
  const html = applySitePresentation(shell, { view: 'blog', path: '/blog/un-articolo/', settings: {
    site_title: 'Lavanda $& <em>nuova</em>', tagline: 'Il centro $& <script>test</script>', site_description: 'Una descrizione "nuova".',
    navigation: [{ label: 'Gli scritti', href: '/blog/' }, { label: 'Altro', href: 'https://example.test/?a=1&b=2' }, { label: 'XSS', href: 'javascript:alert(1)' }],
    social_links: { instagram: 'https://instagram.com/lavanda', youtube: '', custom: 'https://example.test/', constructor: 'https://prototype.test/', threads: 'javascript:alert(1)' },
  } });
  assert.match(html, /<span>Lavanda \$&amp; &lt;em&gt;nuova&lt;\/em&gt;<\/span>/);
  assert.match(html, /<title>Gli scritti \| Lavanda \$&amp; &lt;em&gt;nuova&lt;\/em&gt;<\/title>/);
  assert.match(html, /Il centro \$&amp; &lt;script&gt;test&lt;\/script&gt;/);
  assert.match(html, /<p>Una descrizione &quot;nuova&quot;\.<\/p>/);
  assert.match(html, /href="\/blog\/" aria-current="page">Gli scritti/);
  assert.match(html, /href="https:\/\/example.test\/\?a=1&amp;b=2" rel="noopener noreferrer"/);
  assert.match(html, /data-cms-social aria-label="Social"><a href="https:\/\/instagram.com\/lavanda"/);
  assert.match(html, /<main id="contenuto"><p>Testo editoriale Lavanda<\/p><\/main>/);
  assert.doesNotMatch(html, /javascript:|>XSS<|>custom<|<script>|prototype.test/);
});

test('entry SEO overrides defaults and updates every sharing tag consistently', () => {
  const html = applySitePresentation(shell, { view: 'article', path: '/blog/ritorno/', settings: { site_title: 'Lavanda', seo: { title: 'Generale', description: 'Generale', canonical: 'https://lavanda.test/', noindex: false } }, entry: { type: 'post', title: 'Titolo', excerpt: 'Sommario', seo: { title: 'Una & lettura', description: 'Una "descrizione"', canonical: 'https://lavanda.test/percorso-preferito/', noindex: true }, cover_media_id: 'e2c8e637-4507-4b0b-944a-898d0b38d50a', metadata: { image_alt: 'Una foto' } } });
  assert.match(html, /<title>Una &amp; lettura<\/title>/);
  assert.match(html, /property="og:title" content="Una &amp; lettura"/);
  assert.match(html, /name="description" content="Una &quot;descrizione&quot;"/);
  assert.match(html, /property="og:description" content="Una &quot;descrizione&quot;"/);
  assert.match(html, /rel="canonical" href="https:\/\/lavanda.test\/percorso-preferito\/"/);
  assert.match(html, /property="og:url" content="https:\/\/lavanda.test\/percorso-preferito\/"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /property="og:image" content="https:\/\/lavanda.test\/api\/media\?id=e2c8e637-4507-4b0b-944a-898d0b38d50a"/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(html, /Titolo iniziale|Vecchia descrizione/);
});

test('canonical defaults derive each public route and discard request query and fragment', () => {
  const settings = { seo: { canonical: 'https://lavanda.test/', noindex: false }, site_description: 'Sito' };
  const html = applySitePresentation(shell, { view: 'article', path: '/blog/test/?tracking=1#test', settings, entry: { title: 'Articolo', excerpt: 'Sommario' } });
  assert.match(html, /<title>Articolo \| Lavanda<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/lavanda.test\/blog\/test\/"/);
  assert.match(html, /name="description" content="Sommario"/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.doesNotMatch(html, /tracking=|#test/);
  const home = applySitePresentation(shell, { settings, view: 'home', path: '/' });
  assert.match(home, /rel="canonical" href="https:\/\/lavanda.test\/"/);
});

test('site noindex cannot be weakened by an entry and static study remains noindex by default', () => {
  assert.match(applySitePresentation(shell), /name="robots" content="noindex,follow"/);
  assert.match(applySitePresentation(shell, { settings: { seo: { noindex: true } }, entry: { seo: { noindex: false } } }), /name="robots" content="noindex,follow"/);
  assert.match(applySitePresentation(shell, { entry: { seo: { noindex: false } } }), /name="robots" content="index,follow"/);
  assert.match(applySitePresentation(shell, { settings: { seo: { noindex: false } }, noindex: true }), /name="robots" content="noindex,follow"/);
});

test('unsafe stored URLs cannot create links, canonicals or Open Graph images', () => {
  const html = applySitePresentation(shell, { view: 'article', path: '//evil.test/', origin: 'https://lavanda.test/', settings: { seo: { canonical: 'javascript:alert(1)' }, navigation: [{ label: 'X', href: '//evil.test/' }, { label: 'Y', href: '/%5cevil.test/' }], social_links: { instagram: 'https://user:password@evil.test/' } }, entry: { title: 'Test', seo: { canonical: 'https://user:password@evil.test/' }, metadata: { cover_url: 'javascript:alert(1)' } } });
  assert.match(html, /rel="canonical" href="https:\/\/lavanda.test\/"/);
  assert.doesNotMatch(html, /evil.test|javascript:|password|property="og:image"/);
  for (const input of ['//evil.test', '/\\evil.test', '/%2fevil.test', '/%255cevil.test', '/\r\nLocation:evil', 'https://good.test/%0d%0aLocation:evil', 'http://good.test/', 'https://user:password@good.test/']) assert.equal(publicUrl(input), '', input);
  assert.equal(publicUrl('/blog/?q=lavanda#risultati'), '/blog/?q=lavanda#risultati');
  assert.equal(publicUrl('https://example.test/ricerca?q=lavanda'), 'https://example.test/ricerca?q=lavanda');
});

test('presentation can be applied repeatedly without duplicate SEO or social tags', () => {
  const options = { settings: { seo: { canonical: 'https://lavanda.test/' }, social_links: { instagram: 'https://instagram.com/lavanda' } } };
  const html = applySitePresentation(applySitePresentation(shell, options), options);
  for (const value of ['rel="canonical"', 'property="og:title"', 'property="og:url"', 'data-cms-social']) assert.equal(html.split(value).length - 1, 1, value);
});

test('presentation hooks match the generated website shell', async () => {
  const source = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const html = applySitePresentation(source, { settings: { site_title: 'Nuova Lavanda', tagline: 'Una nuova voce', site_description: 'Un progetto pubblico.', navigation: [{ label: 'Nuovo menu', href: '/progetto/' }], social_links: { instagram: 'https://instagram.com/lavanda' } } });
  assert.match(html, /<span>Nuova Lavanda<\/span>/);
  assert.match(html, /<p>Una nuova voce<\/p>/);
  assert.match(html, /class="cover-kicker"><p>Lavanda<\/p><p>Una nuova voce<\/p>/);
  assert.match(html, /<p>Un progetto pubblico\.<\/p>/);
  assert.match(html, /id="navigation"[^>]*><a href="\/progetto\/">Nuovo menu<\/a><\/nav>/);
  assert.match(html, /data-cms-social/);
});
