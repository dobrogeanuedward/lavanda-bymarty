import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Astronomy from 'astronomy-engine';
import { calculateChart, resolveBirthTime } from '../src/natal-engine.js';
import { SolarError } from '../src/solar-engine.js';
import { computeLunarCalendar } from '../src/lunar-calendar.js';
import { buildNatalLunarReading } from '../src/natal-lunar-reading.js';

const phaseContent = JSON.parse(await readFile(new URL('../content/lunar-phases.json', import.meta.url), 'utf8'));
const options = { engine: Astronomy, phaseContent };
const calculation = { engine: Astronomy, now: new Date('2026-10-16T12:00:00Z') };
const base = { date: '1990-05-10', time: '14:30', timezone: 'Europe/Rome', latitude: 41.9028, longitude: 12.4964 };
const errorCode = code => error => error instanceof SolarError && error.code === code;
const makeChart = input => calculateChart({ ...base, ...input }, calculation);
const unknown = (date, overrides = {}, now = calculation.now) => calculateChart({ ...base, date, timezone: 'UTC', unknownTime: true, ...overrides }, { ...calculation, now });

// Keep actual geocentric lunar data when the test instant includes seconds/ms.
function chartAt(utc) {
  const chart = makeChart({ date: utc.slice(0, 10), time: utc.slice(11, 16), timezone: 'UTC' });
  const longitude = Astronomy.Ecliptic(Astronomy.GeoVector('Moon', new Date(utc), true)).elon;
  return { ...chart, meta: { ...chart.meta, utc }, planets: chart.planets.map(planet => planet.key === 'moon' ? { ...planet, longitude, signIndex: Math.floor(longitude / 30), degree: longitude % 30 } : planet) };
}
function intervalChart(start, end, segments = [{ start, end }]) {
  const utc = new Date((Date.parse(segments[0].start) + Date.parse(segments[0].end) - 1) / 2).toISOString();
  const chart = chartAt(utc), moon = chart.planets.find(planet => planet.key === 'moon');
  return { ...chart, meta: { ...chart.meta, unknownTime: true, representativeTime: true, localDay: { start, end, partialDay: false, segments } }, planets: chart.planets.map(planet => planet.key === 'moon' ? { ...planet, possibleSignIndices: [moon.signIndex], signCertain: true } : planet) };
}

test('Rome 1990 birth uses authoritative UTC, visible waning Moon and the separate full/Citrinitas sector', () => {
  const chart = makeChart({}), model = buildNatalLunarReading(chart, options);
  assert.equal(model.utc, '1990-05-10T12:30:00.000Z');
  assert.equal(model.unknownTime, false);
  assert.equal(model.phase.key, 'waning-gibbous');
  assert.equal(model.phase.label, 'Gibbosa calante');
  assert.equal(model.phase.certain, true);
  assert.equal(model.phase.sectorKey, 'full');
  assert.deepEqual(model.phaseOptions.map(phase => phase.key), ['full']);
  assert.equal(model.phaseOptions[0].angle, 180);
  assert.equal(model.alchemy.key, 'citrinitas');
  assert.equal(model.alchemy.convention, 'lavanda-editorial');
  assert.equal(model.moonSign.key, 'scorpio');
  assert.deepEqual(model.cards.map(card => card.card), [19, 20, 13, 2]);
  assert.match(model.cards.find(card => card.card === 13).reasons[0], /Luna in Scorpione.*Golden Dawn/);
  assert.match(model.cards.find(card => card.card === 2).reasons[0], /planetaria.*Golden Dawn/);
  assert.ok(model.cards.every(card => !card.conditional));
  assert.deepEqual(model.plants.map(plant => plant.scientificName), ['Narcissus pseudonarcissus', 'Lavandula angustifolia']);
  assert.equal(model.representative, null);
  assert.equal(model.localDay, null);
});

test('the same visible phase and editorial sector keep the Moon sign personal to each chart', () => {
  const first = buildNatalLunarReading(makeChart({}), options);
  const second = buildNatalLunarReading(makeChart({ date: '2024-01-26', time: '12:00', timezone: 'UTC' }), options);
  assert.equal(first.phase.key, second.phase.key);
  assert.equal(first.phase.sectorKey, second.phase.sectorKey);
  assert.equal(second.moonSign.key, 'leo');
  assert.ok(first.cards.some(card => card.card === 13));
  assert.ok(!second.cards.some(card => card.card === 13));
  assert.ok(second.cards.some(card => card.card === 8));
  assert.deepEqual(first.plants, second.plants);
});

test('principal phases are exact event instants, not entire 45-degree sectors', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', { engine: Astronomy });
  const before = ['waning-crescent', 'waxing-crescent', 'waxing-gibbous', 'waning-gibbous'];
  const after = ['waxing-crescent', 'waxing-gibbous', 'waning-gibbous', 'waning-crescent'];
  for (const [index, event] of calendar.mainEvents.entries()) {
    const time = Date.parse(event.date);
    assert.equal(buildNatalLunarReading(chartAt(event.date), options).phase.key, event.key);
    assert.equal(buildNatalLunarReading(chartAt(new Date(time - 1).toISOString()), options).phase.key, before[index]);
    assert.equal(buildNatalLunarReading(chartAt(new Date(time + 1).toISOString()), options).phase.key, after[index]);
  }
});

test('unknown hour reports actual phase/sign alternatives without impossible Cartesian combinations', () => {
  const model = buildNatalLunarReading(unknown('2024-01-25', { timezone: 'Europe/Rome' }), options);
  assert.equal(model.unknownTime, true);
  assert.equal(model.phase.certain, false);
  assert.equal(model.phase.key, null);
  assert.equal(model.phase.phaseAngle, null);
  assert.equal(model.phase.illuminatedFraction, null);
  assert.deepEqual(model.phase.options.map(option => option.key), ['waxing-gibbous', 'full', 'waning-gibbous']);
  assert.deepEqual(model.phaseOptions.map(option => option.key), ['waxing-gibbous', 'full']);
  assert.deepEqual(model.moonSign.possibleSignIndices, [3, 4]);
  assert.equal(model.moonSign.certain, false);
  assert.equal(model.alchemy.certain, false);
  assert.deepEqual(model.alchemy.options.map(option => option.key), ['albedo', 'citrinitas']);
  assert.deepEqual(model.alternatives.map(item => [item.phaseKey, item.signIndex]), [['waxing-gibbous', 3], ['waxing-gibbous', 4], ['full', 4]]);
  assert.ok(!model.alternatives.some(item => item.phaseKey === 'full' && item.signIndex === 3));
  assert.equal(model.cards.length, 7, 'all conditional alternatives survive deduplication');
  assert.ok(model.cards.filter(card => card.card !== 2).every(card => card.conditional));
  assert.equal(model.cards.find(card => card.card === 2).conditional, false);
  assert.match(model.representative.label, /rappresentativo.*non è l’ora/);
  assert.equal(typeof model.representative.illuminatedFraction, 'number');
  assert.ok(!('houses' in model) && !('aspects' in model));
});

test('a physical phase can stay certain while two editorial sectors and Moon signs remain conditional', () => {
  const model = buildNatalLunarReading(unknown('2024-01-14'), options);
  assert.equal(model.phase.certain, true);
  assert.equal(model.phase.key, 'waxing-crescent');
  assert.equal(model.phase.sectorCertain, false);
  assert.equal(model.phase.sectorKey, null);
  assert.deepEqual(model.phaseOptions.map(phase => phase.key), ['new', 'waxing-crescent']);
  assert.equal(model.alchemy.certain, true);
  assert.equal(model.alchemy.key, 'nigredo');
  assert.deepEqual(model.moonSign.possibleSignIndices, [10, 11]);
  const priestess = model.cards.find(card => card.card === 2);
  assert.equal(priestess.reasons.length, 3, 'two phase reasons plus the planetary Moon reason');
  assert.equal(priestess.conditional, false, 'the planetary correspondence remains unconditional');
  assert.deepEqual(priestess.conditions.map(condition => condition.kind), ['phase-editorial', 'phase-editorial', 'moon-planetary']);
  for (const phase of model.phaseOptions) assert.equal(phase.cards.find(card => card.card === 2).conditional, true);
});

test('stable unknown-time intervals preserve their limited certainties and civil DST lengths', () => {
  for (const [date, hours] of [['2024-03-31', 23], ['2024-10-27', 25]]) {
    const model = buildNatalLunarReading(unknown(date, { timezone: 'Europe/Rome' }), options);
    assert.equal(model.localDay.durationHours, hours);
    assert.equal(model.phase.certain, true);
    assert.equal(model.phase.sectorCertain, true);
    assert.equal(model.moonSign.certain, true);
    assert.ok(model.cards.every(card => !card.conditional));
    assert.equal(model.phase.phaseAngle, null, 'no representative angle is advertised as exact birth data');
  }
});

test('unknown-time crossing at next New Moon includes both real lunations', () => {
  const model = buildNatalLunarReading(unknown('2024-01-11'), options);
  assert.deepEqual(model.phaseOptions.map(option => option.key), ['waning-crescent', 'new']);
  assert.deepEqual(model.phase.options.map(option => option.key), ['waning-crescent', 'new', 'waxing-crescent']);
  assert.deepEqual(model.alchemy.options.map(option => option.key), ['rubedo', 'nigredo']);
  assert.equal(model.phaseOptions[0].intervals[0].endDate, model.phaseOptions[1].intervals[0].startDate);
});

test('end-exclusive day boundaries include a principal phase only when its event instant belongs to the day', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', { engine: Astronomy });
  const full = Date.parse(calendar.mainEvents[2].date), start = new Date(full - 3600000).toISOString();
  const before = buildNatalLunarReading(intervalChart(start, new Date(full).toISOString()), options);
  assert.deepEqual(before.phase.options.map(option => option.key), ['waxing-gibbous']);
  assert.deepEqual(before.phaseOptions.map(option => option.key), ['waxing-gibbous']);
  const at = buildNatalLunarReading(intervalChart(start, new Date(full + 1).toISOString()), options);
  assert.deepEqual(at.phase.options.map(option => option.key), ['waxing-gibbous', 'full']);
  const after = buildNatalLunarReading(intervalChart(start, new Date(full + 2).toISOString()), options);
  assert.deepEqual(after.phase.options.map(option => option.key), ['waxing-gibbous', 'full', 'waning-gibbous']);
});

test('disjoint civil-day segments do not invent a phase in the excluded gap', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', { engine: Astronomy });
  const full = Date.parse(calendar.mainEvents[2].date), start = new Date(full - 3600000).toISOString(), end = new Date(full + 3600000).toISOString();
  const segments = [{ start, end: new Date(full - 600000).toISOString() }, { start: new Date(full + 600000).toISOString(), end }];
  const model = buildNatalLunarReading(intervalChart(start, end, segments), options);
  assert.deepEqual(model.phase.options.map(option => option.key), ['waxing-gibbous', 'waning-gibbous']);
  assert.ok(model.alternatives.every(item => Date.parse(item.endDate) <= full - 600000 || Date.parse(item.startDate) >= full + 600000));
  assert.equal(model.localDay.durationHours, 5 / 3);
});

test('partial current civil day never extends a birth possibility into the future', () => {
  const chart = unknown('2024-01-25', { timezone: 'Europe/Rome' }, new Date('2024-01-25T08:00:00Z'));
  const model = buildNatalLunarReading(chart, options);
  assert.equal(model.localDay.partialDay, true);
  assert.equal(model.localDay.end, '2024-01-25T08:00:00.001Z');
  assert.deepEqual(model.phaseOptions.map(phase => phase.key), ['waxing-gibbous']);
  assert.ok(!model.phase.options.some(phase => phase.key === 'full'));
  assert.match(model.notices.join(' '), /parziale.*senza estenderli al futuro/);
});

test('plants deduplicate by scientific name and preserve every phase association', () => {
  const model = buildNatalLunarReading(unknown('2024-01-29'), options);
  assert.deepEqual(model.phaseOptions.map(phase => phase.key), ['full', 'waning-gibbous']);
  const narcissus = model.plants.find(plant => plant.scientificName === 'Narcissus pseudonarcissus');
  assert.deepEqual(narcissus.phaseKeys, ['full', 'waning-gibbous']);
  assert.equal(narcissus.associations.length, 2);
  assert.equal(narcissus.conditional, false);
  assert.equal(new Set(model.plants.map(plant => plant.scientificName)).size, model.plants.length);
  assert.ok(model.plants.filter(plant => plant !== narcissus).every(plant => plant.conditional));
});

test('absent editorial JSON leaves measured data and traditional cards available without invented content', () => {
  const model = buildNatalLunarReading(makeChart({}), { engine: Astronomy });
  assert.equal(model.phase.key, 'waning-gibbous');
  assert.equal(model.phaseOptions[0].content, null);
  assert.deepEqual(model.cards.map(card => card.card), [13, 2]);
  assert.deepEqual(model.plants, []);
  assert.match(model.notices.join(' '), /editoriali.*non sono ancora disponibili/);
  const loaded = buildNatalLunarReading(makeChart({}), options);
  assert.equal(loaded.utc, model.utc);
  assert.deepEqual(loaded.phase, model.phase);
});

test('UTC fold choices and the 1900 positive-timezone margin stay authoritative', () => {
  const input = { ...base, date: '2024-10-27', time: '02:30' };
  const choices = resolveBirthTime(input).candidates;
  const models = choices.map(choice => buildNatalLunarReading(calculateChart({ ...input, utcChoice: choice.utc }, calculation), options));
  assert.deepEqual(models.map(model => model.utc), ['2024-10-27T00:30:00.000Z', '2024-10-27T01:30:00.000Z']);
  assert.notEqual(models[0].phase.phaseAngle, models[1].phase.phaseAngle);
  const old = buildNatalLunarReading(makeChart({ date: '1900-01-01', time: '00:00', timezone: 'Asia/Tokyo' }), options);
  assert.equal(old.utc, '1899-12-31T15:00:00.000Z');
  assert.equal(old.phase.phaseAngle, Astronomy.MoonPhase(new Date(old.utc)));
  const unrelatedFormData = makeChart({});
  unrelatedFormData.meta.date = '2024-01-01'; unrelatedFormData.meta.time = '00:00'; unrelatedFormData.meta.timezone = 'Asia/Tokyo';
  assert.equal(buildNatalLunarReading(unrelatedFormData, options).utc, '1990-05-10T12:30:00.000Z');
});

test('uncertainty fails closed across wrapper flags, and the model is detached JSON without input mutations', () => {
  const chart = unknown('2024-01-25'), before = structuredClone(chart), contentBefore = structuredClone(phaseContent);
  const model = buildNatalLunarReading(chart, options);
  assert.deepEqual(chart, before); assert.deepEqual(phaseContent, contentBefore);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  model.phaseOptions[0].content.plants[0].commonName = 'Changed';
  assert.deepEqual(phaseContent, contentBefore);
  for (const flag of ['wrapper', 'metadata', 'representative']) {
    const changed = structuredClone(chart); changed.unknownTime = flag === 'wrapper'; changed.meta.unknownTime = flag === 'metadata'; changed.meta.representativeTime = flag === 'representative';
    assert.equal(buildNatalLunarReading(changed, options).unknownTime, true);
  }
});

test('missing UTC, malformed uncertainty intervals and engines fail without falling back to now', () => {
  for (const chart of [null, {}, { meta: {} }, { meta: { utc: '' } }]) assert.throws(() => buildNatalLunarReading(chart, options), errorCode('INVALID_NATAL_CHART'));
  for (const utc of ['invalid', '2024-01-25', '2024-02-30T00:00:00Z']) assert.throws(() => buildNatalLunarReading({ ...makeChart({}), meta: { utc } }, options), errorCode('INVALID_DATE'));
  assert.throws(() => buildNatalLunarReading({ ...makeChart({}), meta: { utc: '1899-12-30T23:59:59Z' } }, options), errorCode('DATE_OUT_OF_RANGE'));
  assert.throws(() => buildNatalLunarReading(makeChart({}), { engine: {} }), errorCode('MISSING_ENGINE'));
  const noDay = unknown('2024-01-25'); delete noDay.meta.localDay;
  assert.throws(() => buildNatalLunarReading(noDay, options), errorCode('INVALID_NATAL_CHART'));
  for (const modify of [chart => { chart.meta.localDay.segments[0].end = chart.meta.localDay.start; }, chart => { chart.meta.localDay.segments[0].start = '2024-02-30T00:00:00Z'; }, chart => { chart.meta.utc = '2024-01-26T12:00:00Z'; }, chart => { chart.planets = chart.planets.filter(planet => planet.key !== 'moon'); }]) {
    const chart = unknown('2024-01-25'); modify(chart);
    assert.throws(() => buildNatalLunarReading(chart, options), errorCode('INVALID_NATAL_CHART'));
  }
});
