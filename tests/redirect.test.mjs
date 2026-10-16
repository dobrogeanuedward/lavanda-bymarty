import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler, { resolveRedirect } from '../api/redirect.mjs';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const config = { configured: true, url: 'https://lavanda-test.supabase.co', key: 'sb_publishable_test12345678' };
const response = () => ({ statusCode: 200, headers: {}, body: '', setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value || ''; } });

test('redirect lookup reads only the anonymous public projection with an exact source filter', async () => {
  let requested, options;
  globalThis.fetch = async (url, init) => { requested = new URL(url); options = init; return new Response(JSON.stringify([{ source: '/vecchio/', target: '/blog/nuovo/', code: 301 }])); };
  assert.deepEqual(await resolveRedirect(config, '/vecchio/'), { target: '/blog/nuovo/', code: 301 });
  assert.equal(requested.pathname, '/rest/v1/cms_public_redirects');
  assert.equal(requested.searchParams.get('source'), 'eq./vecchio/');
  assert.equal(requested.searchParams.get('select'), 'source,target,code');
  assert.equal(options.headers.apikey, config.key);
  assert.equal(options.headers.Authorization, undefined);
});

test('unsafe, private and malformed redirect sources are rejected without database access', async () => {
  globalThis.fetch = async () => { throw new Error('Should not fetch'); };
  for (const source of [null, '/api/auth', '/admin/', '//evil.test/', '/%2fevil.test/', '/old?target=x', '/old#fragment', 'https://evil.test/']) assert.equal(await resolveRedirect(config, source), null, source);
  assert.equal(await resolveRedirect({ configured: false }, '/old/'), null);
});

test('only a stored safe destination and allowed status may become a redirect', async () => {
  for (const row of [
    { source: '/other/', target: '/new/', code: 301 },
    { source: '/old/', target: '//evil.test/', code: 301 },
    { source: '/old/', target: 'https://user:password@evil.test/', code: 302 },
    { source: '/old/', target: 'https://good.test/%0d%0aLocation:evil', code: 302 },
    { source: '/old/', target: '/new/', code: 307 },
    { source: '/old/', target: '/old/?again=1', code: 301 },
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify([row]));
    assert.equal(await resolveRedirect(config, '/old/'), null, JSON.stringify(row));
  }
  globalThis.fetch = async () => new Response(JSON.stringify([{ source: '/old/', target: 'https://example.test/new/', code: 302 }]));
  assert.deepEqual(await resolveRedirect(config, '/old/'), { target: 'https://example.test/new/', code: 302 });
});

test('redirect handler rejects writes and provides a quiet 404 without configuration', async () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY, anon: process.env.SUPABASE_ANON_KEY };
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_PUBLISHABLE_KEY; delete process.env.SUPABASE_ANON_KEY;
    const denied = response(); await handler({ method: 'POST', url: '/api/redirect?source=/old/' }, denied);
    assert.equal(denied.statusCode, 405); assert.equal(denied.headers.Allow, 'GET, HEAD');
    const missing = response(); await handler({ method: 'HEAD', url: '/api/redirect?source=/old/' }, missing);
    assert.equal(missing.statusCode, 404); assert.equal(missing.body, '');
  } finally {
    for (const [name, value] of Object.entries({ SUPABASE_URL: saved.url, SUPABASE_PUBLISHABLE_KEY: saved.key, SUPABASE_ANON_KEY: saved.anon })) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
