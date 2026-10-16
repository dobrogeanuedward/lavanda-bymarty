import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { PLANETS, calculateChart } from '../src/natal-engine.js';
import { describeSelection } from '../src/natal-reading.js';
import { SolarError, computeSolarSystem } from '../src/solar-engine.js';
import { createNatalSolarModel, natalSelectionToSolarBody, solarBodyToNatalSelection } from '../src/natal-solar-model.js';

const options = { engine: Astronomy };
const chartOptions = { ...options, now: new Date('2026-10-16T12:00:00Z') };
const birthplace = { latitude: 41.8919, longitude: 12.5113 };
const norm = vector => Math.hypot(...vector);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const body = (model, key) => model.state.bodies.find(point => point.key === key);
const at = (input = {}) => calculateChart({ date: '2000-01-01', time: '12:00', timezone: 'UTC', ...birthplace, ...input }, chartOptions);
const errorCode = expected => error => error instanceof SolarError && error.code === expected;

test('the actual DST fold choice controls the 3D epoch, preserving the distinct repeated instants', () => {
  const input = { date: '2024-10-27', time: '02:30', timezone: 'Europe/Rome' };
  const firstChart = at({ ...input, utcChoice: '2024-10-27T00:30:00.000Z' });
  const secondChart = at({ ...input, utcChoice: '2024-10-27T01:30:00.000Z' });
  const first = createNatalSolarModel(firstChart, options), second = createNatalSolarModel(secondChart, options);
  assert.equal(first.meta.utc, '2024-10-27T00:30:00.000Z');
  assert.equal(second.meta.utc, '2024-10-27T01:30:00.000Z');
  assert.equal(first.state.date, firstChart.meta.utc);
  assert.equal(second.state.date, secondChart.meta.utc);
  assert.ok(norm(subtract(body(first, 'earth').position, body(second, 'earth').position)) > 0.0005);
  assert.ok(norm(subtract(first.state.moonGeocentric, second.state.moonGeocentric)) > 0.00001);
  assert.ok(norm(subtract(first.state.sunBarycentric, second.state.sunBarycentric)) > 1e-8);
  assert.equal(second.meta.paused, true);
  assert.equal(second.meta.unknownTime, false);
  assert.match(second.meta.dateLabel, /01:30:00 UTC/);
});

test('the birth snapshot matches independent JPL geometry and keeps Sun, Earth and Moon simultaneous', () => {
  const chart = at(), model = createNatalSolarModel(chart, options);
  // JPL Horizons, geometric vectors, J2000 ecliptic, UTC 2000-01-01T12:00Z.
  // https://ssd-api.jpl.nasa.gov/doc/horizons.html
  const earth = [-0.1771478822733411, 0.9672393401210591, -0.000004085203551709195];
  const moonRelative = [-0.001949005522028226, -0.001838439640328155, 0.0002424530340027334];
  assert.equal(model.state.date, '2000-01-01T12:00:00.000Z');
  assert.ok(norm(subtract(body(model, 'earth').position, earth)) < 3e-5);
  assert.ok(norm(subtract(model.state.moonGeocentric, moonRelative)) < 1.5e-7);
  assert.deepEqual(body(model, 'sun').position, [0, 0, 0]);
  assert.ok(norm(subtract(subtract(body(model, 'moon').position, body(model, 'earth').position), model.state.moonGeocentric)) < 1e-15);
  assert.equal(body(model, 'sun').distanceEarthAU, body(model, 'earth').distanceSunAU);
  assert.match(model.meta.frameNotice, /geometriche eliocentriche.*J2000/);
  assert.match(model.meta.frameNotice, /apparenti geocentriche.*della data/);
});

test('the model is an inert birth snapshot, independent of the current wall clock and form metadata', () => {
  const chart = at(), before = structuredClone(chart), first = createNatalSolarModel(chart, options);
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse('2099-01-01T00:00:00Z');
    assert.deepEqual(createNatalSolarModel(chart, options), first);
  } finally { Date.now = originalNow; }
  const conflictingForm = { ...chart, meta: { ...chart.meta, date: '2025-04-01', time: '05:10', timezone: 'Pacific/Auckland', offsetMinutes: 780 } };
  assert.deepEqual(createNatalSolarModel(conflictingForm, options), first, 'only the resolved UTC instant controls geometry');
  assert.deepEqual(chart, before);
  first.state.bodies[0].position[0] = 999;
  first.meta.title = 'consumer modification';
  assert.equal(body(createNatalSolarModel(chart, options), 'sun').position[0], 0);
  assert.notEqual(createNatalSolarModel(chart, options).meta.title, 'consumer modification');
});

test('unknown birth time stays a representative day map and preserves uncertain natal readings', () => {
  const chart = at({ date: '2024-03-20', timezone: 'Europe/Rome', unknownTime: true, time: undefined });
  const before = structuredClone(chart), model = createNatalSolarModel(chart, options);
  assert.equal(model.meta.utc, chart.meta.utc);
  assert.equal(model.meta.unknownTime, true);
  assert.equal(model.meta.representativeTime, true);
  assert.equal(model.meta.paused, true);
  assert.match(model.meta.title, /nel tuo giorno/);
  assert.ok(!model.meta.title.includes('nascita'));
  assert.match(model.meta.dateLabel, /^Istante rappresentativo/);
  assert.match(model.meta.notice, /Non mostra l’ora esatta della nascita/);
  assert.match(model.meta.notice, /non risolve i segni incerti/);
  const selection = solarBodyToNatalSelection('sun');
  assert.deepEqual(selection, { type: 'planet', key: 'sun' });
  const reading = describeSelection(chart, selection);
  assert.match(reading.title, /segno resta aperto/);
  assert.deepEqual(reading.cards.map(item => item.card), [18, 4]);
  assert.ok(reading.cards.every(item => /^Se (?:il )?Sole fosse/.test(item.reason)));
  assert.deepEqual(chart, before, 'the adapter never replaces uncertain chart positions with 3D reference positions');
});

test('a true uncertainty flag cannot become an exact birth claim when wrapper metadata disagrees', () => {
  const chart = at();
  for (const [wrapper, metadata, representative] of [[true, false, false], [false, true, false], [false, false, true], [undefined, true, undefined]]) {
    const model = createNatalSolarModel({ ...chart, unknownTime: wrapper, meta: { ...chart.meta, unknownTime: metadata, representativeTime: representative } }, options);
    assert.equal(model.meta.unknownTime, true);
    assert.equal(model.meta.representativeTime, true);
    assert.match(model.meta.title, /giorno/);
    assert.match(model.meta.notice, /^Ora sconosciuta/);
  }
  const known = createNatalSolarModel({ ...chart, unknownTime: false, meta: { ...chart.meta, unknownTime: false, representativeTime: false } }, options);
  assert.equal(known.meta.unknownTime, false);
  assert.match(known.meta.title, /alla tua nascita/);
});

test('all nine shared bodies round-trip to the same natal reading and Arcana', () => {
  const chart = at();
  for (const planet of PLANETS.filter(planet => planet.key !== 'pluto')) {
    const original = { type: 'planet', key: planet.key };
    const bodyKey = natalSelectionToSolarBody(original), selected = solarBodyToNatalSelection(bodyKey);
    assert.equal(bodyKey, planet.key);
    assert.deepEqual(selected, original);
    assert.deepEqual(describeSelection(chart, selected), describeSelection(chart, original));
  }
  assert.equal(natalSelectionToSolarBody({ type: 'planet', key: ' MOON ' }), 'moon');
  assert.deepEqual(solarBodyToNatalSelection('SUN'), { type: 'planet', key: 'sun' });
  const selected = solarBodyToNatalSelection('moon');
  selected.key = 'earth';
  assert.equal(solarBodyToNatalSelection('moon').key, 'moon');
});

test('Earth, Pluto, signs and angles never acquire a fabricated planetary correspondence', () => {
  for (const selection of [null, {}, { type: 'sign', key: 'aries' }, { type: 'sign', key: 'sun' }, { type: 'angle', key: 'ascendant' }, { type: 'angle', key: 'sun' }, { type: 'planet', key: 'earth' }, { type: 'planet', key: 'pluto' }, { type: 'planet', key: 'constructor' }, { type: 'planet', key: {} }]) assert.equal(natalSelectionToSolarBody(selection), null);
  for (const key of ['earth', 'pluto', 'aries', 'ascendant', 'constructor', '__proto__', null, undefined, 0, { key: 'sun' }]) assert.equal(solarBodyToNatalSelection(key), null);
  const model = createNatalSolarModel(at(), options);
  assert.ok(model.state.bodies.some(body => body.key === 'earth'));
  assert.ok(!model.state.bodies.some(body => body.key === 'pluto'));
  assert.match(model.meta.selectionNotice, /Terra.*senza una posizione astrologica/);
  assert.match(model.meta.selectionNotice, /Plutone resta disponibile nella ruota/);
});

test('historical UTC seconds survive the adapter without being rounded to local form minutes', () => {
  const chart = at({ date: '1900-01-01', time: '12:00', timezone: 'Europe/Paris' });
  const model = createNatalSolarModel(chart, options);
  assert.equal(chart.meta.utc, '1900-01-01T11:50:39.000Z');
  assert.equal(model.state.date, chart.meta.utc);
  assert.match(model.meta.dateLabel, /11:50:39 UTC/);
});

test('missing, invalid or unsupported authoritative UTC fails instead of substituting now or clamping birth time', () => {
  for (const chart of [null, undefined, {}, { meta: {} }, { meta: { utc: '' } }, { meta: { utc: new Date() } }]) assert.throws(() => createNatalSolarModel(chart, options), errorCode('INVALID_NATAL_CHART'));
  for (const utc of ['not a date', '2000-01-01T12:00:00', '2000-02-30T12:00:00Z']) assert.throws(() => createNatalSolarModel({ meta: { utc } }, options), errorCode('INVALID_DATE'));
  assert.throws(() => createNatalSolarModel({ meta: { utc: '2000-01-01T12:00:00Z' } }, { engine: {} }), errorCode('MISSING_ENGINE'));
  const boundaryChart = at({ date: '1900-01-01', time: '00:00', timezone: 'Asia/Tokyo', latitude: 35.6895, longitude: 139.6917 });
  assert.equal(boundaryChart.meta.utc, '1899-12-31T15:00:00.000Z');
  const before = structuredClone(boundaryChart);
  const boundaryModel = createNatalSolarModel(boundaryChart, options);
  assert.equal(boundaryModel.meta.utc, boundaryChart.meta.utc);
  assert.deepEqual(boundaryModel.state, computeSolarSystem('1899-12-31T15:00:00.000Z', options));
  assert.ok(norm(boundaryModel.state.moonGeocentric) > 0.0022 && norm(boundaryModel.state.moonGeocentric) < 0.0029);
  assert.ok(norm(subtract(subtract(body(boundaryModel, 'moon').position, body(boundaryModel, 'earth').position), boundaryModel.state.moonGeocentric)) < 1e-15);
  assert.throws(() => createNatalSolarModel({ meta: { utc: '1899-12-30T23:59:59.999Z' } }, options), errorCode('DATE_OUT_OF_RANGE'));
  assert.deepEqual(boundaryChart, before);
});
