import { createHmac, randomUUID } from 'node:crypto';

export class CmsError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new CmsError(status, code, message); };
export const ROLES = ['admin', 'editor', 'author', 'viewer'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;
export const EVENTS = ['page_view', 'article_open', 'fanzine_open', 'download', 'outbound_click'];
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'application/pdf': 'pdf' };

export function configuration(env = process.env) {
  let url = '';
  try {
    const u = new URL(env.SUPABASE_URL || '');
    if (u.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) && u.pathname === '/' && !u.search && !u.username && !u.password) url = u.origin;
  } catch {}
  const candidate = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  let key = /^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(candidate) ? candidate : '';
  if (!key && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)) {
    try { if (JSON.parse(Buffer.from(candidate.split('.')[1], 'base64url')).role === 'anon') key = candidate; } catch {}
  }
  const origins = [env.APP_ORIGIN, ...(env.CMS_ALLOWED_ORIGINS || '').split(','), env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '']
    .filter(Boolean).flatMap(value => { try { const u = new URL(value.trim()); return !u.hostname.includes('*') && (u.protocol === 'https:' || (env.NODE_ENV !== 'production' && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) && u.pathname === '/' && !u.username && !u.password ? [u.origin] : []; } catch { return []; } });
  if (env.NODE_ENV !== 'production') origins.push('http://localhost:3000', 'http://localhost:4173', 'http://127.0.0.1:3000', 'http://127.0.0.1:4173');
  return { url, key, configured: !!(url && key), origins: [...new Set(origins)], secure: env.NODE_ENV === 'production' || !!env.VERCEL, analytics: !!env.CMS_ANALYTICS_KEY, analyticsKey: env.CMS_ANALYTICS_KEY || '', bucket: 'lavanda-media' };
}

export function headers(req) { return Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v])); }
export function query(req) { return new URL(req.url || '/', 'https://lavanda.invalid').searchParams; }
export function json(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie, Origin');
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}
export function sendError(res, error) {
  const expected = error instanceof CmsError;
  return json(res, expected ? error.status : 500, { error: { code: expected ? error.code : 'INTERNAL_ERROR', message: expected ? error.message : 'La richiesta non è stata completata. Riprova.' } });
}
export function requireConfiguration(config) { if (!config.configured) fail(503, 'SETUP_REQUIRED', 'Il database di Lavanda deve ancora essere collegato. I dati non sono sincronizzati.'); }
export function requireMethod(req, allowed) { if (!allowed.includes(req.method)) fail(405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito.'); }
export function requireOrigin(req, config, customHeader = true) {
  const h = headers(req);
  if (!h.origin || !config.origins.includes(h.origin)) fail(403, 'ORIGIN_DENIED', 'Origine della richiesta non autorizzata.');
  if (customHeader && h['x-cms-request'] !== '1') fail(403, 'CSRF_FAILED', 'La richiesta di modifica non è valida.');
  if (h['sec-fetch-site'] === 'cross-site') fail(403, 'CSRF_FAILED', 'Richiesta da un sito esterno non consentita.');
}
export async function readBody(req, maxBytes = 750_000) {
  const h = headers(req);
  if (!/^application\/json(?:;|$)/i.test(h['content-type'] || '')) fail(415, 'CONTENT_TYPE', 'È richiesto un documento JSON.');
  if (Number(h['content-length'] || 0) > maxBytes) fail(413, 'TOO_LARGE', 'Il contenuto supera il limite consentito.');
  let body = req.body;
  if (body === undefined) {
    let bytes = 0; const chunks = [];
    for await (const chunk of req) { const b = Buffer.from(chunk); bytes += b.length; if (bytes > maxBytes) fail(413, 'TOO_LARGE', 'Il contenuto supera il limite consentito.'); chunks.push(b); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (typeof body === 'string' || Buffer.isBuffer(body)) { if (Buffer.byteLength(body) > maxBytes) fail(413, 'TOO_LARGE', 'Il contenuto supera il limite consentito.'); try { body = JSON.parse(String(body)); } catch { fail(400, 'INVALID_JSON', 'Il documento JSON non è valido.'); } }
  if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'INVALID_BODY', 'È richiesto un oggetto JSON.');
  if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) fail(413, 'TOO_LARGE', 'Il contenuto supera il limite consentito.');
  return body;
}
export function string(value, key, max, { required = false, min = 0 } = {}) {
  if (typeof value !== 'string' || value.length > max || value.length < min || (required && !value.trim()) || /\u0000/.test(value)) fail(422, 'INVALID_FIELD', `Il campo «${key}» non è valido.`);
  return value.trim();
}
export function uuid(value, field = 'id', nullable = false) { if (nullable && (value === null || value === '')) return null; if (typeof value !== 'string' || !UUID.test(value)) fail(422, 'INVALID_ID', `Il campo «${field}» non è un identificativo valido.`); return value; }
export function version(value) { if (!Number.isSafeInteger(value) || value < 1) fail(422, 'VERSION_REQUIRED', 'Ricarica il contenuto prima di salvarlo: manca la sua versione.'); return value; }
export function oneOf(value, options, field) { if (!options.includes(value)) fail(422, 'INVALID_FIELD', `Il valore di «${field}» non è consentito.`); return value; }
export function boolean(value, key) { if (typeof value !== 'boolean') fail(422, 'INVALID_FIELD', `Il campo «${key}» deve essere vero o falso.`); return value; }
export function safeUrl(value, field, { local = false, empty = true } = {}) {
  value = string(value, field, 2048);
  if (empty && !value) return '';
  if (local && /^\/(?!\/)[^\s\\<>"']*$/.test(value) && !/%(?:0[0-9ad]|5c)/i.test(value)) return value;
  try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) throw new Error(); return u.href; } catch { fail(422, 'UNSAFE_URL', `Il collegamento «${field}» deve usare HTTPS${local ? ' o un percorso interno' : ''}.`); }
}
function seo(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(422, 'INVALID_FIELD', 'I metadati SEO non sono validi.');
  const result = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === 'title') result.title = string(v, key, 180);
    else if (key === 'description') result.description = string(v, key, 500);
    else if (key === 'canonical') result.canonical = safeUrl(v, key);
    else if (key === 'noindex') result.noindex = boolean(v, key);
    else fail(422, 'UNKNOWN_FIELD', `Metadato SEO non riconosciuto: ${key}.`);
  }
  return result;
}
const COMMON = { version: v => version(v) };
const text = (key, max, required = false) => v => string(v, key, max, { required });
const slug = v => { if (typeof v !== 'string' || v.length > 150 || !SLUG.test(v)) fail(422, 'INVALID_SLUG', 'Usa lettere minuscole, numeri e trattini per lo slug.'); return v; };
const date = v => { if (v === null || v === '') return null; if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) fail(422, 'INVALID_DATE', 'La data non è valida.'); return new Date(v).toISOString(); };
const tags = v => { if (!Array.isArray(v) || v.length > 30) fail(422, 'INVALID_FIELD', 'Sono consentiti al massimo 30 tag.'); return [...new Set(v.map(x => string(x, 'tag', 64, { required: true })))]; };
function metadata(v) {
  if(!v||typeof v!=='object'||Array.isArray(v))fail(422,'INVALID_FIELD','I metadati non sono validi.');
  const result={};
  for(const [key,value] of Object.entries(v)){
    if(key==='issue_number'){if(!(Number.isSafeInteger(value)&&value>=0&&value<=9999)&&!(typeof value==='string'&&/^\d{1,4}$/.test(value)))fail(422,'INVALID_FIELD','Il numero del quaderno non è valido.');result[key]=value;}
    else if(key==='article_ids'){if(!Array.isArray(value)||value.length>100)fail(422,'INVALID_FIELD','Il sommario supera 100 articoli.');result[key]=[...new Set(value.map(id=>uuid(id)))];}
    else if(key==='subtitle')result[key]=string(value,key,500);
    else if(key==='image_alt')result[key]=string(value,key,1000);
    else if(key==='source_note')result[key]=string(value,key,5000);
    else if(key==='category_name'||key==='source_status')result[key]=string(value,key,100);
    else if(key==='cover_url')result[key]=safeUrl(value,key,{local:true});
    else fail(422,'UNKNOWN_FIELD',`Metadato non riconosciuto: ${key}.`);
  }
  return result;
}
export const RESOURCES = {
  entries: { table: 'cms_entries', required: ['type', 'title', 'slug'], fields: { ...COMMON, type: v => oneOf(v, ['post', 'page', 'fanzine'], 'type'), title: text('title', 240, true), slug, excerpt: text('excerpt', 1000), body: text('body', 500000), metadata, status: v => oneOf(v, ['draft', 'review', 'scheduled', 'published', 'archived', 'trash'], 'status'), category_id: v => uuid(v, 'category_id', true), cover_media_id: v => uuid(v, 'cover_media_id', true), tags, seo, published_at: date, fanzine_pages: v => { if (!Array.isArray(v) || v.length > 100) fail(422, 'INVALID_FIELD', 'La fanzine può contenere fino a 100 pagine.'); return v.map(p => { if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).some(k => !['title','body','media_id','layout'].includes(k))) fail(422, 'INVALID_FIELD', 'Una pagina della fanzine non è valida.'); return { title: string(p.title || '', 'title', 240), body: string(p.body || '', 'body', 10000), media_id: uuid(p.media_id || null, 'media_id', true), layout: oneOf(p.layout || 'text', ['text', 'photo', 'cover', 'quote'], 'layout') }; }); } } },
  media: { table: 'cms_media', required: ['title'], fields: { ...COMMON, title: text('title', 240, true), alt: text('alt', 1000), caption: text('caption', 2000), credit: text('credit', 500), folder: text('folder', 100), published: v => boolean(v, 'published') } },
  taxonomies: { table: 'cms_taxonomies', required: ['name', 'slug', 'kind'], fields: { ...COMMON, name: text('name', 100, true), slug, kind: v => oneOf(v, ['category', 'tag'], 'kind'), description: text('description', 2000) } },
  settings: { table: 'cms_settings', required: ['site_title'], fields: { ...COMMON, site_title: text('site_title', 150, true), tagline: text('tagline', 240), site_description: text('site_description', 1000), seo, social_links: v => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length > 10) fail(422, 'INVALID_FIELD', 'I social non sono validi.'); return Object.fromEntries(Object.entries(v).map(([k, url]) => [oneOf(k, ['instagram','facebook','pinterest','tiktok','youtube','linkedin','mastodon','threads'], 'social'), safeUrl(url, k)])); }, navigation: v => { if (!Array.isArray(v) || v.length > 20) fail(422, 'INVALID_FIELD', 'Il menu può contenere fino a 20 collegamenti.'); return v.map(item => ({ label: string(item?.label, 'label', 80, { required: true }), href: safeUrl(item?.href, 'href', { local: true, empty: false }) })); } } },
  profiles: { table: 'cms_profiles', required: [], fields: { ...COMMON, display_name: text('display_name', 100, true), role: v => oneOf(v, ROLES, 'role'), active: v => boolean(v, 'active') } },
  redirects: { table: 'cms_redirects', required: ['source', 'target'], fields: { ...COMMON, source: v => { const out = safeUrl(v, 'source', { local: true, empty: false }); if (!out.startsWith('/') || /[?#]/.test(out) || out.startsWith('/api/') || out.startsWith('/admin/')) fail(422, 'INVALID_FIELD', 'Il percorso di origine del redirect non è valido.'); return out; }, target: v => safeUrl(v, 'target', { local: true, empty: false }), code: v => oneOf(v, [301, 302], 'code') } },
  comments: { table: 'cms_comments', required: ['entry_id', 'author_name', 'body'], fields: { ...COMMON, entry_id: v => uuid(v, 'entry_id'), author_name: text('author_name', 100, true), body: text('body', 10000, true), status: v => oneOf(v, ['pending', 'approved', 'spam', 'trash'], 'status') } },
  revisions: { table: 'cms_revisions', readOnly: true },
  audit: { table: 'cms_audit', readOnly: true },
};
export function validateResource(resource, value, create = false) {
  const def = RESOURCES[resource]; if (!def) fail(404, 'UNKNOWN_RESOURCE', 'Questa raccolta non esiste.');
  if (def.readOnly) fail(405, 'READ_ONLY', 'Questa raccolta è di sola lettura.');
  const data = {};
  for (const [key, v] of Object.entries(value)) {
    if(resource==='entries'&&key==='editorial_notes'){data[key]=string(v,key,20000);continue;}
    if (!Object.hasOwn(def.fields, key)) fail(422, 'UNKNOWN_FIELD', `Campo non consentito: ${key}.`); data[key] = def.fields[key](v);
  }
  if (create) for (const field of def.required) if (data[field] === undefined) fail(422, 'MISSING_FIELD', `Il campo «${field}» è richiesto.`);
  if (!create) version(value.version);
  return data;
}
export function authorize(profile, resource, method, row = null, patch = null) {
  if (!profile?.active || !ROLES.includes(profile.role)) fail(403, 'NOT_A_MEMBER', 'Il tuo account non ha accesso alla redazione.');
  if (method === 'GET') { if (resource === 'audit' && profile.role !== 'admin') fail(403, 'FORBIDDEN', 'Il registro attività è riservato agli amministratori.'); return; }
  if (profile.role === 'viewer') fail(403, 'FORBIDDEN', 'Il tuo ruolo consente la sola lettura.');
  if (['settings', 'profiles', 'redirects'].includes(resource) && profile.role !== 'admin') fail(403, 'FORBIDDEN', 'Questa operazione richiede il ruolo amministratore.');
  if (resource === 'comments' && !['admin', 'editor'].includes(profile.role)) fail(403, 'FORBIDDEN', 'La moderazione richiede un editor.');
  if (profile.role === 'author') {
    if (!['entries', 'media'].includes(resource)) fail(403, 'FORBIDDEN', 'Il tuo ruolo non consente questa modifica.');
    if (row && row.author_id !== profile.id) fail(403, 'FORBIDDEN', 'Puoi modificare solo i tuoi contenuti.');
    if (resource === 'entries' && ((row && !['draft', 'review', 'trash'].includes(row.status)) || (patch?.status && !['draft', 'review', 'trash'].includes(patch.status)))) fail(403, 'PUBLISH_FORBIDDEN', 'Invia il contenuto in revisione: la pubblicazione richiede un editor.');
    if (resource === 'media' && patch?.published) fail(403, 'PUBLISH_FORBIDDEN', 'La pubblicazione dei media richiede un editor.');
  }
}
export function validatePublish(entry) {
  if (!['published', 'scheduled'].includes(entry.status)) return;
  if (!entry.title?.trim() || !SLUG.test(entry.slug || '') || (!entry.body?.trim() && !entry.fanzine_pages?.length)) fail(422, 'INCOMPLETE_PUBLICATION', 'Per pubblicare servono titolo, slug e un contenuto.');
  if (entry.status === 'scheduled' && (!entry.published_at || Date.parse(entry.published_at) <= Date.now())) fail(422, 'INVALID_SCHEDULE', 'Scegli una data di pubblicazione futura.');
}
export function validateMedia(body) {
  const filename = string(body.filename, 'filename', 180, { required: true });
  const mime = oneOf(body.mime_type, Object.keys(MIME_EXT), 'mime_type');
  if (typeof body.content_base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.content_base64)) fail(422, 'INVALID_MEDIA', 'Il file non è valido.');
  const bytes = Buffer.from(body.content_base64, 'base64');
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) fail(413, 'MEDIA_TOO_LARGE', 'Ogni file può pesare al massimo 3 MB.');
  const hex = bytes.subarray(0, 16).toString('hex');
  const magic = { 'image/jpeg': hex.startsWith('ffd8ff'), 'image/png': hex.startsWith('89504e470d0a1a0a'), 'image/gif': ['GIF87a','GIF89a'].some(v => bytes.subarray(0,6).toString() === v), 'image/webp': bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP', 'image/avif': bytes.subarray(4,8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8,32).toString()), 'application/pdf': bytes.subarray(0,5).toString() === '%PDF-' };
  if (!magic[mime]) fail(422, 'MIME_MISMATCH', 'Il contenuto del file non corrisponde al formato dichiarato.');
  return { bytes, mime, filename, ext: MIME_EXT[mime], title: string(body.title || filename.replace(/\.[^.]+$/, ''), 'title', 240, { required: true }), alt: string(body.alt || '', 'alt', 1000), folder: string(body.folder || '', 'folder', 100) };
}
export function cookies(req, config) {
  const result = {};
  for (const item of (headers(req).cookie || '').split(';')) { const i = item.indexOf('='); if (i > 0) { try { result[item.slice(0,i).trim()] = decodeURIComponent(item.slice(i+1)); } catch {} } }
  const prefix = config.secure ? '__Host-lv_' : 'lv_';
  return { access: result[`${prefix}access`] || '', refresh: result[`${prefix}refresh`] || '' };
}
export function setSession(res, session, config) {
  const prefix = config.secure ? '__Host-lv_' : 'lv_';
  const secure = config.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', ['access','refresh'].map(type => `${prefix}${type}=${encodeURIComponent(session?.[`${type}_token`] || '')}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${session ? (type === 'access' ? Math.min(Number(session.expires_in) || 3600,3600) : 2592000) : 0}`));
}
export async function upstream(config, path, { token = null, method = 'GET', body, extraHeaders = {}, raw = false, key = config.key } = {}) {
  let response;
  try { response = await fetch(`${config.url}${path}`, { method, headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders }, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)), signal: AbortSignal.timeout(12000) }); }
  catch { fail(503, 'DATABASE_UNAVAILABLE', 'Il servizio dati non è raggiungibile. Nessuna conferma di salvataggio ricevuta.'); }
  if (!response.ok) {
    let detail = {}; try { detail = await response.json(); } catch {}
    if (response.status === 401) fail(401, 'SESSION_EXPIRED', 'La sessione è scaduta. Accedi di nuovo.');
    if (response.status === 403 || detail.code === '42501') fail(403, 'FORBIDDEN', 'Il tuo ruolo non consente questa operazione.');
    if (response.status === 429) fail(429, 'RATE_LIMITED', 'Troppe richieste. Attendi prima di riprovare.');
    if (detail.code === '23505') fail(409, 'DUPLICATE', 'Lo slug o il valore scelto esiste già.');
    if (['42P01','PGRST205','42883','PGRST202'].includes(detail.code)) fail(503, 'SCHEMA_REQUIRED', 'Il database è raggiungibile, ma lo schema della redazione deve essere inizializzato.');
    if (detail.code === 'P0002') fail(404, 'NOT_FOUND', 'Il contenuto non esiste o non è accessibile.');
    if (detail.code === '40001') fail(409, 'VERSION_CONFLICT', 'Il contenuto è stato modificato. Ricaricalo prima di salvare.');
    if (['23503','23514','22023','P0001'].includes(detail.code)) fail(422, 'DATA_CONSTRAINT', 'La modifica non rispetta i vincoli dei dati. Controlla contenuto, riferimenti e permessi.');
    fail(response.status === 400 ? 422 : 502, 'UPSTREAM_ERROR', 'Il servizio dati ha rifiutato la richiesta.');
  }
  return response;
}
export async function rows(config, table, params, options = {}) {
  const response = await upstream(config, `/rest/v1/${table}?${params}`, { ...options, extraHeaders: { Prefer: options.method && options.method !== 'GET' ? 'return=representation,count=exact' : 'count=exact', ...options.extraHeaders } });
  const range = response.headers.get('content-range') || '';
  const data = response.status === 204 ? [] : await response.json();
  return { data, count: /^\d+$/.test(range.split('/')[1] || '') ? Number(range.split('/')[1]) : Array.isArray(data) ? data.length : 0 };
}
export async function authenticate(req, config) {
  requireConfiguration(config);
  const access = cookies(req, config).access;
  if (!access) fail(401, 'AUTH_REQUIRED', 'Accedi per aprire la redazione.');
  const response = await upstream(config, '/auth/v1/user', { token: access });
  const user = await response.json();
  if (!user?.id || user.is_anonymous === true) fail(401, 'AUTH_REQUIRED', 'È richiesto un account verificato.');
  const result = await rows(config, 'cms_profiles', `select=*&id=eq.${uuid(user.id)}&limit=1`, { token: access });
  const profile = result.data[0];
  authorize(profile, 'entries', 'GET');
  return { token: access, user: { id: user.id, email: user.email || '' }, profile };
}
export function publicMediaPath(id) { return `/api/media?id=${uuid(id)}`; }
export const newId = () => randomUUID();
export function analyticsSignature(secret, timestamp, payload) { return createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(payload)}`).digest('hex'); }
export function validateEvent(input) {
  const event = oneOf(input.event === 'pageview' ? 'page_view' : input.event, EVENTS, 'event');
  const path = string(input.path, 'path', 200, { required: true });
  if (!/^\/(?!\/)[a-zA-Z0-9/_\-.%]*$/.test(path) || /%[0-9a-f]{2}/i.test(path) || /(?:^|\/)(?:admin|api)(?:\/|$)/.test(path)) fail(422, 'INVALID_PATH', 'Il percorso non è misurabile.');
  // Never accept query strings, arbitrary dimensions, IDs, addresses or device information.
  if (Object.keys(input).some(k => !['event','path'].includes(k))) fail(422, 'UNKNOWN_FIELD', 'L’evento contiene dati non consentiti.');
  return { event, path };
}
