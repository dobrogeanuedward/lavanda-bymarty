import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { UUID, safeUrl, validateResource, validateMedia, validatePublish } from '../lib/cms.mjs';

// Maintenance only: never import this module in a browser or an application route.
const ROOT = new URL('../', import.meta.url);
export class SeedError extends Error {}
const stop = message => { throw new SeedError(message); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function seedId(key) {
  const bytes = createHash('sha256').update(`lavanda-cms-seed:v1:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; // UUID v8, deterministic application namespace.
  bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function uniqueMap(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = key(row);
    if (typeof value !== 'string' || !value || result.has(value)) stop('Il seed contiene identificativi mancanti o duplicati.');
    result.set(value, row.id);
  }
  return result;
}
const remap = (id, map) => {
  if (id == null || id === '') return null;
  if (!map.has(id)) stop('Il seed contiene un riferimento a un contenuto non presente.');
  return map.get(id);
};
function fields(source) {
  if (!object(source)) stop('Il seed contiene un record non valido.');
  const ignored = new Set(['id','version','updated_at','created_at']);
  return Object.fromEntries(Object.entries(source).filter(([key]) => !ignored.has(key)));
}

export async function createSeedPlan(source, { assetUrls = null, readAsset = path => readFile(new URL(`public${path}`, ROOT)) } = {}) {
  if (!object(source) || Object.keys(source).some(k => !['entries','media','taxonomies','settings'].includes(k)) ||
      !['entries','media','taxonomies'].every(k => Array.isArray(source[k]) && source[k].length <= 100)) stop('La struttura del seed non è valida.');
  try {
    const assets = [];
    if (assetUrls !== null && (!object(assetUrls) || Object.keys(assetUrls).length !== source.media.length)) stop('La mappa R2 deve contenere esattamente tutti gli asset del seed.');
    for (const item of source.media) {
      if (!object(item) || !/^\/assets\/[a-z0-9-]+\.(webp|png|jpg|jpeg|gif|avif|pdf)$/.test(item.public_url || '')) stop('Gli asset del seed devono essere file locali in /assets/.');
      const bytes = Buffer.from(await readAsset(item.public_url));
      const valid = validateMedia({ filename: item.filename, title: item.title, alt: item.alt || '', folder: item.folder || '', mime_type: item.mime_type, content_base64: bytes.toString('base64') });
      const remoteUrl = assetUrls === null ? null : safeUrl(assetUrls[item.public_url], 'asset R2', {empty:false});
      if (remoteUrl && (new URL(remoteUrl).search || new URL(remoteUrl).hash)) stop('Gli URL R2 devono essere permanenti e senza query o frammenti.');
      assets.push({ id:item.id, sourceUrl:item.public_url, remoteUrl, hash:digest(bytes), mimeType:valid.mime, sizeBytes:bytes.length });
    }
    const mediaIds = uniqueMap(assets.map(a => ({id:a.remoteUrl || a.sourceUrl, sourceId:a.id})), a => a.sourceId);
    const mediaUrls = uniqueMap(assets.map(a => ({id:a.remoteUrl || a.sourceUrl, url:a.sourceUrl})), a => a.url);
    const taxonomies = source.taxonomies.map(item => ({ ...validateResource('taxonomies', fields(item), true), id: seedId(`taxonomy:${item.kind}:${item.slug}`), sourceId:item.id }));
    uniqueMap(taxonomies, t => `${t.kind}:${t.slug}`);
    const taxonomyIds = uniqueMap(taxonomies, t => t.sourceId);
    const entryIds = uniqueMap(source.entries.map(e => ({id:seedId(`entry:${e.type}:${e.slug}`), sourceId:e.id})), e => e.sourceId);
    uniqueMap(source.entries, e => `${e.type}:${e.slug}`);
    const entries = source.entries.map(item => {
      const data = fields(item);
      if (Object.hasOwn(data,'editorial_notes')) stop('Le note private vanno importate separatamente dalla redazione.');
      if (object(data.metadata)) {
        data.metadata = { ...data.metadata };
        // Historical local seed field: the live API calls it image_alt.
        if (Object.hasOwn(data.metadata, 'cover_alt')) { data.metadata.image_alt ??= data.metadata.cover_alt; delete data.metadata.cover_alt; }
        if (data.metadata.article_ids) data.metadata.article_ids = data.metadata.article_ids.map(id => remap(id, entryIds));
      }
      const coverUrl = item.cover_media_id ? remap(item.cover_media_id, mediaIds) : mediaUrls.get(data.metadata?.cover_url);
      if (coverUrl) data.metadata = { ...data.metadata, cover_url:coverUrl };
      data.cover_media_id = null; // R2 objects are external URLs, not Supabase Storage records.
      data.category_id = remap(item.category_id, taxonomyIds);
      data.fanzine_pages = (item.fanzine_pages || []).map(page => {
        if (page.media_id) stop('Le pagine fanzine con media_id richiedono una migrazione del modello per gli asset R2.');
        return {...page,media_id:null};
      });
      data.status ??= 'draft';
      data.published_at ??= null;
      const valid = validateResource('entries', data, true);
      validatePublish(valid);
      return { ...valid, id:entryIds.get(item.id) };
    }).sort((a,b) => Number(a.type === 'fanzine') - Number(b.type === 'fanzine'));
    const settings = validateResource('settings', fields(source.settings), true);
    return { assets, taxonomies:taxonomies.map(({sourceId,...row}) => row), entries, settings };
  } catch (error) {
    if (error instanceof SeedError) throw error;
    // Do not print filesystem errors, source values, or raw validation exceptions.
    stop('Il seed o un asset non supera la validazione. Nessuna importazione eseguita.');
  }
}

export function seedConfiguration(env = process.env) {
  let url;
  try {
    url = new URL(env.SUPABASE_URL || '');
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash || url.port) throw Error();
  } catch { stop('SUPABASE_URL deve indicare il progetto Supabase HTTPS dedicato.'); }
  const ref = url.hostname.split('.')[0];
  if (env.LAVANDA_CMS_PROJECT_REF !== ref) stop('LAVANDA_CMS_PROJECT_REF deve corrispondere al progetto dedicato in SUPABASE_URL.');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  let legacy = false;
  if (!/^sb_secret_[A-Za-z0-9_-]{8,}$/.test(key)) {
    try { legacy = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key) && JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'service_role'; } catch {}
    if (!legacy) stop('È richiesta una chiave server privilegiata nelle variabili di ambiente.');
  }
  if (!UUID.test(env.LAVANDA_CMS_AUTHOR_ID || '')) stop('LAVANDA_CMS_AUTHOR_ID deve indicare il profilo amministratore attivo.');
  return { url:url.origin, key, legacy, authorId:env.LAVANDA_CMS_AUTHOR_ID };
}

export async function applySeed(plan, config, { fetchImpl = globalThis.fetch } = {}) {
  if (!plan.assets.every(asset => asset.remoteUrl ? asset.remoteUrl.startsWith('https://') : /^\/assets\/[a-z0-9-]+\.(webp|png|jpg|jpeg|gif|avif|pdf)$/.test(asset.sourceUrl))) stop('Il seed deve usare gli asset locali del sito o una mappa HTTPS completa degli asset R2.');
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    let response;
    try {
      response = await fetchImpl(`${config.url}${path}`, { method, redirect:'error', signal:AbortSignal.timeout(20000),
        headers:{ apikey:config.key, ...(config.legacy ? {Authorization:`Bearer ${config.key}`} : {}), ...headers }, body });
    } catch { stop('Servizio dati non raggiungibile. Importazione interrotta; è possibile ripeterla.'); }
    if (!response.ok) stop(`Servizio dati: HTTP ${response.status}. Controllare schema, grant e credenziali; è possibile ripetere l’importazione.`);
    return response;
  }
  async function records(table, filters, method = 'GET', row) {
    const params = new URLSearchParams({select:'*',...filters});
    const response = await request(`/rest/v1/${table}?${params}`, { method, body:row ? JSON.stringify(row) : undefined,
      headers:row ? {'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'} : {} });
    let data;
    try { data = await response.json(); } catch { stop('Risposta dati non valida. Importazione interrotta.'); }
    if (!Array.isArray(data)) stop('Risposta dati non valida. Importazione interrotta.');
    return data;
  }
  const count = { entries:0, taxonomies:0, settings:0, skipped:0 };
  const [author] = await records('cms_profiles',{id:`eq.${config.authorId}`,limit:'1'});
  if (!author?.active || author.role !== 'admin') stop('Il profilo autore deve essere un amministratore attivo. Nessuna scrittura eseguita.');
  const ids = new Map();
  const existing = new Set();
  async function lookup(table, row) {
    const filters = table === 'cms_entries' ? {type:`eq.${row.type}`,slug:`eq.${row.slug}`} : table === 'cms_taxonomies' ? {kind:`eq.${row.kind}`,slug:`eq.${row.slug}`} : {id:`eq.${row.id}`};
    const [found] = await records(table,{...filters,limit:'1'});
    if (found) { if (!UUID.test(found.id || '')) stop('Identificativo remoto non valido.'); ids.set(row.id,found.id); existing.add(row.id); }
    return found;
  }
  // Read-only preflight finishes before the first insert. No Storage API is used.
  const settings = await records('cms_settings',{singleton:'eq.true',limit:'1'});
  for (const row of plan.taxonomies) await lookup('cms_taxonomies',row);
  for (const row of plan.entries) await lookup('cms_entries',row);
  async function insert(table, row, conflict, kind) {
    if (existing.has(row.id)) { count.skipped++; return; }
    const rows = await records(table,{on_conflict:conflict},'POST',row);
    if (rows.length) {
      if (rows.length !== 1 || rows[0].id !== row.id) stop('Identità inserita non confermata. Importazione interrotta.');
      ids.set(row.id,rows[0].id); count[kind]++;
    }
    else { if (!await lookup(table,row)) stop('Inserimento non confermato. Ripetere l’importazione.'); count.skipped++; }
  }
  for (const row of plan.taxonomies) await insert('cms_taxonomies',row,'kind,slug','taxonomies');
  const mapped = id => id ? ids.get(id) || id : null;
  for (const entry of plan.entries) {
    const row = {...entry,author_id:config.authorId,cover_media_id:mapped(entry.cover_media_id),category_id:mapped(entry.category_id),
      metadata:{...entry.metadata},fanzine_pages:entry.fanzine_pages.map(page => ({...page,media_id:mapped(page.media_id)}))};
    if (row.metadata.article_ids) row.metadata.article_ids = row.metadata.article_ids.map(mapped);
    await insert('cms_entries',row,'type,slug','entries');
  }
  if (settings.length) count.skipped++;
  else {
    const rows = await records('cms_settings',{on_conflict:'singleton'},'POST',{...plan.settings,singleton:true});
    if (rows.length) count.settings++; else count.skipped++;
  }
  return count;
}

export async function runSeed({args = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch, log = console.log} = {}) {
  if (args.length > 1 || (args.length && !['--apply','--dry-run','--help'].includes(args[0]))) stop('Argomenti non validi. Usa --help; le credenziali si leggono solo dall’ambiente.');
  if (args[0] === '--help') {
    log('node scripts/seed-cms.mjs [--dry-run | --apply]\nDefault: validazione locale senza rete. --apply richiede SUPABASE_URL, SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY), LAVANDA_CMS_PROJECT_REF e LAVANDA_CMS_AUTHOR_ID nell’ambiente. LAVANDA_CMS_ASSET_MAP è opzionale per asset già caricati su R2. Vedi docs/cms-backend.md.');
    return;
  }
  let source;
  try { source = JSON.parse(await readFile(new URL('public/admin/seed.json',ROOT),'utf8')); } catch { stop('Impossibile leggere il seed locale.'); }
  let assetUrls = null;
  if (env.LAVANDA_CMS_ASSET_MAP) {
    try { assetUrls = JSON.parse(env.LAVANDA_CMS_ASSET_MAP); } catch { stop('LAVANDA_CMS_ASSET_MAP deve essere un oggetto JSON valido.'); }
  }
  const plan = await createSeedPlan(source,{assetUrls});
  log(`Seed validato: ${plan.entries.length} contenuti, ${plan.assets.length} asset, ${plan.taxonomies.length} tassonomie.`);
  if (args[0] !== '--apply') { log('Dry run: nessuna rete e nessuna scrittura. Gli stati editoriali vengono conservati; le bozze richiedono pubblicazione dalla redazione.'); return plan; }
  const config = seedConfiguration(env);
  const result = await applySeed(plan,config,{fetchImpl});
  log(`Importazione confermata: ${result.entries} contenuti, ${result.taxonomies} tassonomie, ${result.settings} impostazioni aggiunti; ${result.skipped} record esistenti conservati. Asset referenziati: ${plan.assets.length}${assetUrls ? ' su R2' : ' dal sito'}.`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeed().catch(error => { console.error(error instanceof SeedError ? error.message : 'Importazione interrotta. Controllare la configurazione e riprovare.'); process.exitCode = 1; });
}
