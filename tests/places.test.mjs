import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import handler, { normalizePlace, loadPlaces, findPlaces } from '../api/places.mjs';

const previousFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('Place lookup must use the self-hosted index, never an external API.'); };
after(() => { globalThis.fetch = previousFetch; });
const index = await loadPlaces();
function response() {
  return { statusCode: 200, headers: {}, body: '', setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value || ''; } };
}
async function request(query, { method = 'GET', url = '/api/places', vercelQuery = true } = {}) {
  const res = response();
  await handler({ method, url, ...(vercelQuery ? { query: { q: query } } : {}) }, res);
  return { ...res, data: JSON.parse(res.body) };
}

test('real self-hosted GeoNames index is cached and includes a broad city dataset', async () => {
  assert.ok(index.length > 200_000);
  assert.equal(await loadPlaces(), index);
  assert.equal(normalizePlace('  São   Paulo '), 'sao paulo');
  assert.equal(normalizePlace('Île-de-France'), 'ile de france');
});

test('Roma, Rome and Italian or English country filters resolve the same real locality', () => {
  for (const query of ['Roma', 'Rome', 'Roma, Italia', 'Rome,Italy', 'Roma,IT']) {
    const results = findPlaces(index, query), capital = results[0];
    assert.equal(capital.id, 3169070, query);
    assert.equal(capital.countryCode, 'IT'); assert.equal(capital.timezone, 'Europe/Rome');
    assert.ok(Math.abs(capital.latitude - 41.9) < .1);
    assert.ok(Math.abs(capital.longitude - 12.5) < .1);
    assert.match(capital.label, /Italia/);
    if (query.includes(',')) assert.ok(results.every(place => place.countryCode === 'IT'));
  }
});

test('Italian London alias and French country searches use the local aliases and country index', () => {
  const london = findPlaces(index, 'Londra')[0];
  assert.equal(london.id, 2643743); assert.equal(london.countryCode, 'GB'); assert.equal(london.timezone, 'Europe/London');
  const paris = findPlaces(index, 'Paris,france');
  assert.equal(paris[0].id, 2988507); assert.equal(paris[0].timezone, 'Europe/Paris');
  assert.ok(paris.every(place => place.countryCode === 'FR'));
});

test('homonymous cities keep distinct IDs, labels and timezones and can be filtered by country', () => {
  const cambridges = findPlaces(index, 'Cambridge').filter(place => place.name === 'Cambridge');
  assert.ok(cambridges.length >= 3);
  assert.equal(new Set(cambridges.map(place => place.id)).size, cambridges.length);
  assert.ok(new Set(cambridges.map(place => place.countryCode)).size >= 3);
  assert.ok(new Set(cambridges.map(place => place.timezone)).size >= 3);
  assert.ok(new Set(cambridges.map(place => place.label)).size >= 3);
  const inUs = findPlaces(index, 'Cambridge,US');
  assert.ok(inUs.length > 0 && inUs.every(place => place.countryCode === 'US'));
  const springfields = findPlaces(index, 'Springfield');
  assert.equal(springfields.length, 8);
  assert.ok(new Set(springfields.map(place => place.timezone)).size > 1);
});

test('GET response exposes only selected public fields and license, never search internals', async () => {
  const result = await request(null, { url: '/api/places?q=Paris%2Cfrance', vercelQuery: false });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.match(result.headers['Cache-Control'], /public/);
  assert.equal(result.data.source, 'GeoNames'); assert.equal(result.data.license, 'CC BY 4.0');
  assert.ok(result.data.places.length >= 1 && result.data.places.length <= 8);
  const fields = ['country', 'countryCode', 'id', 'label', 'latitude', 'longitude', 'name', 'timezone'];
  for (const place of result.data.places) assert.deepEqual(Object.keys(place).sort(), fields);
  assert.doesNotMatch(result.body, /"(?:search|regions|aliases|population|rows|index)"/);
});

test('Vercel query parameters take precedence and an unmatched place returns a clean empty result', async () => {
  const result = await request('Roma,Italia', { url: '/api/places?q=Londra' });
  assert.equal(result.data.places[0].id, 3169070);
  const none = await request('zzzzzzzzzzzzzzzzzzzz');
  assert.equal(none.statusCode, 200); assert.deepEqual(none.data.places, []);
});

test('invalid query shape, length and control characters are rejected with a public error', async () => {
  for (const query of [undefined, '', 'R', '  ', 'x'.repeat(81), 'Roma\u0000', 'Roma\n', ['Roma'], 123]) {
    const result = await request(query);
    assert.equal(result.statusCode, 400, String(query));
    assert.equal(typeof result.data.error, 'string');
    assert.equal(result.data.places, undefined);
    assert.doesNotMatch(result.body, /"(?:rows|index|search|stack)"/);
  }
});

test('unsupported methods declare GET without loading or returning the internal index', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const result = await request('Roma', { method });
    assert.equal(result.statusCode, 405); assert.equal(result.headers.Allow, 'GET');
    assert.deepEqual(Object.keys(result.data), ['error']);
  }
});

test('a missing deployed dataset fails safely and offers manual coordinates without leaking paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lavanda-places-qa-'));
  try {
    await mkdir(path.join(directory, 'api'));
    const file = path.join(directory, 'api/places.mjs');
    await writeFile(file, await readFile(new URL('../api/places.mjs', import.meta.url)));
    const missing = (await import(pathToFileURL(file).href)).default;
    const res = response();
    await missing({ method: 'GET', url: '/api/places?q=Roma' }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(JSON.parse(res.body).error, /coordinate manualmente/);
    assert.doesNotMatch(res.body, /ENOENT|places\.json|\/Users\/|stack|gzip|rows/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
