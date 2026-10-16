import { configuration, rows } from '../lib/cms.mjs';
import { publicUrl } from '../lib/site-presentation.mjs';

function redirectSource(value) {
  const source = publicUrl(value);
  return source.startsWith('/') && !/[?#]/.test(source) && !/^\/(?:api|admin)(?:\/|$)/i.test(source) ? source : '';
}

/** Resolve a stored public redirect using only the anonymous routing projection. */
export async function resolveRedirect(config, source) {
  source = redirectSource(source);
  if (!config.configured || !source) return null;
  const query = new URLSearchParams({ select: 'source,target,code', source: `eq.${source}`, limit: '1' });
  const result = await rows(config, 'cms_public_redirects', query);
  const row = result.data?.[0];
  const target = publicUrl(row?.target);
  if (!row || row.source !== source || !target || ![301, 302].includes(row.code)) return null;
  if (target.startsWith('/') && new URL(target, 'https://lavanda.invalid').pathname === new URL(source, 'https://lavanda.invalid').pathname) return null;
  return { target, code: row.code };
}

// The catch-all public rewrite supplies source; known site routes can reuse
// resolveRedirect before rendering their page. No request URL becomes a target.
export async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405; res.end(); return;
  }
  const params = new URL(req.url || '/', 'https://lavanda.invalid').searchParams;
  const source = typeof req.query?.source === 'string' ? req.query.source : params.get('source');
  try {
    const redirect = await resolveRedirect(configuration(), source);
    if (redirect) { res.statusCode = redirect.code; res.setHeader('Location', redirect.target); res.end(); return; }
    res.statusCode = 404; res.end(req.method === 'HEAD' ? '' : 'Pagina non trovata');
  } catch (error) {
    // Log no source, target, upstream body or credentials.
    console.error('Public redirect lookup failed', { code: error?.code || 'INTERNAL_ERROR' });
    res.statusCode = 503; res.end(req.method === 'HEAD' ? '' : 'La pagina non è disponibile in questo momento.');
  }
}

export default handler;
