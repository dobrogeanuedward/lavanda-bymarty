import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { SIGNS, PLANETS, NatalError, resolveBirthTime, calculateChart, calculateAspects } from '../src/natal-engine.js';

const options = { engine: Astronomy, now: new Date('2026-10-16T12:00:00Z') };
const base = { date: '2000-01-01', time: '12:00', timezone: 'UTC', latitude: 51.4779, longitude: 0 };
const circularDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const nearAngle = (actual, expected, tolerance = 0.002) => assert.ok(circularDifference(actual, expected) < tolerance, `${actual} differs from ${expected}`);
const errorCode = code => error => error instanceof NatalError && error.code === code;

test('exports the twelve signs and ten astronomical bodies with stable identities', () => {
  assert.equal(SIGNS.length, 12);
  assert.equal(PLANETS.length, 10);
  assert.equal(new Set(SIGNS.map(sign => sign.key)).size, 12);
  assert.equal(new Set(PLANETS.map(planet => planet.key)).size, 10);
  assert.deepEqual(SIGNS[0], { key: 'aries', name: 'Ariete', glyph: '♈', element: 'Fuoco' });
  assert.equal(PLANETS.find(planet => planet.key === 'pluto').body, 'Pluto');
  assert.ok(Object.isFrozen(SIGNS[0]));
});

test('Rome daylight-saving gap has no invented UTC instant', () => {
  const resolution = resolveBirthTime({ date: '2024-03-31', time: '02:30', timezone: 'Europe/Rome' });
  assert.equal(resolution.status, 'nonexistent');
  assert.deepEqual(resolution.candidates, []);
  assert.throws(() => calculateChart({ ...base, date: '2024-03-31', time: '02:30', timezone: 'Europe/Rome' }, options), errorCode('NONEXISTENT_LOCAL_TIME'));
});

test('Rome repeated hour returns both offsets and requires an explicit choice', () => {
  const input = { ...base, date: '2024-10-27', time: '02:30', timezone: 'Europe/Rome' };
  const resolution = resolveBirthTime(input);
  assert.equal(resolution.status, 'ambiguous');
  assert.deepEqual(resolution.candidates.map(candidate => [candidate.utc, candidate.offsetMinutes]), [
    ['2024-10-27T00:30:00.000Z', 120], ['2024-10-27T01:30:00.000Z', 60]
  ]);
  assert.throws(() => calculateChart(input, options), error => errorCode('AMBIGUOUS_LOCAL_TIME')(error) && error.candidates.length === 2);
  const first = calculateChart({ ...input, utcChoice: resolution.candidates[0].utc }, options);
  const second = calculateChart({ ...input, utcChoice: resolution.candidates[1].utc }, options);
  assert.ok(circularDifference(first.ascendant.longitude, second.ascendant.longitude) > 5);
  assert.equal(second.meta.offsetLabel, 'UTC+01:00');
  assert.throws(() => calculateChart({ ...input, utcChoice: '2024-10-27T02:30:00.000Z' }, options), errorCode('INVALID_UTC_CHOICE'));
});

test('New York DST gap and fold use that locality, independently of the host timezone', () => {
  assert.equal(resolveBirthTime({ date: '2024-03-10', time: '02:15', timezone: 'America/New_York' }).status, 'nonexistent');
  const fold = resolveBirthTime({ date: '2024-11-03', time: '01:30', timezone: 'America/New_York' });
  assert.deepEqual(fold.candidates.map(candidate => candidate.utc), ['2024-11-03T05:30:00.000Z', '2024-11-03T06:30:00.000Z']);
  assert.deepEqual(fold.candidates.map(candidate => candidate.offsetMinutes), [-240, -300]);
  const ordinary = resolveBirthTime({ date: '2024-07-01', time: '18:45', timezone: 'America/New_York' });
  assert.equal(ordinary.candidates[0].utc, '2024-07-01T22:45:00.000Z');
});

test('half-hour DST fold and gap and quarter-hour ordinary offsets are preserved', () => {
  const fold = resolveBirthTime({ date: '2024-04-07', time: '01:45', timezone: 'Australia/Lord_Howe' });
  assert.equal(fold.status, 'ambiguous');
  assert.deepEqual(fold.candidates.map(candidate => candidate.offsetMinutes), [660, 630]);
  assert.equal(resolveBirthTime({ date: '2024-10-06', time: '02:15', timezone: 'Australia/Lord_Howe' }).status, 'nonexistent');
  assert.equal(resolveBirthTime({ date: '2024-01-01', time: '00:00', timezone: 'Asia/Kathmandu' }).candidates[0].utc, '2023-12-31T18:15:00.000Z');
});

test('historical second-based offset is not rounded into a different civil time', () => {
  const old = resolveBirthTime({ date: '1900-01-01', time: '12:00', timezone: 'Europe/Paris' });
  assert.equal(old.candidates[0].utc, '1900-01-01T11:50:39.000Z');
  assert.equal(old.candidates[0].offsetLabel, 'UTC+00:09:21');
  const chart = calculateChart({ ...base, date: '1900-01-01', timezone: 'Europe/Paris' }, options);
  assert.ok(chart.meta.warnings.some(warning => warning.code === 'HISTORICAL_TIMEZONE'));
});

// Independent fixtures generated with Swiss Ephemeris core 2.10.03 / pyswisseph
// 2.10.3.2: swe.calc_ut(jd, body, FLG_SWIEPH), returned_flags=4 (Moshier
// fallback: no Swiss data files installed), tropical geocentric apparent date.
// https://www.astro.com/swisseph/swephprg.htm
const planetFixtures = [
  { input: base, longitudes: [280.36891967534336, 223.32377543840957, 271.8892750074874, 241.5657983261687, 327.9633133185202,
    25.25303030942177, 40.39563895600647, 314.8092231658263, 303.19298122365007, 251.45470884674097] },
  { input: { ...base, date: '1990-07-15', time: '06:30', timezone: 'Europe/Rome', latitude: 41.9028, longitude: 12.4964 },
    longitudes: [112.44806499891045, 18.88211571452692, 126.18485776271977, 84.03657387234554, 31.732686551251934,
      112.47925019379824, 291.986775310828, 276.9787830922827, 282.9295168548256, 225.0013676122882] }
];

for (const [index, fixture] of planetFixtures.entries()) {
  test(`all ten tropical geocentric longitudes match independent ephemeris fixture ${index + 1}`, () => {
    const chart = calculateChart(fixture.input, options);
    for (const [index, planet] of chart.planets.entries()) {
      nearAngle(planet.longitude, fixture.longitudes[index], 0.03);
      assert.equal(planet.signIndex, Math.floor(planet.longitude / 30));
      assert.ok(planet.degree >= 0 && planet.degree < 30);
      assert.equal(typeof planet.retrograde, 'boolean');
    }
    assert.equal(chart.meta.frame, 'geocentric-apparent-true-ecliptic-of-date');
  });
}

const angleFixtures = [
  [base, 24.26618920267986, 279.61108780028457],
  [{ ...base, date: '1990-07-15', time: '06:30', timezone: 'Europe/Rome', latitude: 41.9028, longitude: 12.4964 }, 119.85425296223573, 13.87574780198084],
  [{ ...base, date: '2024-03-30', time: '13:33', timezone: 'Asia/Kolkata', latitude: 18.966666, longitude: 72.833333 }, 117.20146622258267, 23.541515315027777]
];
for (const [index, [input, ascendant, midheaven]] of angleFixtures.entries()) {
  test(`eastern Ascendant and upper-meridian MC match Swiss fixture ${index + 1}`, () => {
    const chart = calculateChart(input, options);
    nearAngle(chart.ascendant.longitude, ascendant);
    nearAngle(chart.midheaven.longitude, midheaven);
  });
}

test('Ascendant is on the true ecliptic, at zero altitude and on the eastern horizon including polar latitudes', () => {
  const rad = Math.PI / 180;
  const time = Astronomy.MakeTime(new Date('2000-01-01T12:00:00Z'));
  for (const latitude of [-89, -80, -45, 0, 45, 80, 89]) {
    for (const longitude of [-170, -40, 0, 70, 170]) {
      const chart = calculateChart({ ...base, latitude, longitude }, options);
      assert.ok(chart.ascendant);
      const theta = (Astronomy.SiderealTime(time) * 15 + longitude) * rad;
      const phi = latitude * rad;
      const lambda = chart.ascendant.longitude * rad;
      const vector = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), new Astronomy.Vector(Math.cos(lambda), Math.sin(lambda), 0, time));
      const altitudeSine = vector.x * Math.cos(phi) * Math.cos(theta) + vector.y * Math.cos(phi) * Math.sin(theta) + vector.z * Math.sin(phi);
      assert.ok(Math.abs(altitudeSine) < 1e-12);
      assert.ok(-vector.x * Math.sin(theta) + vector.y * Math.cos(theta) > 0);
      const mc = chart.midheaven.longitude * rad;
      const upper = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), new Astronomy.Vector(Math.cos(mc), Math.sin(mc), 0, time));
      nearAngle(Math.atan2(upper.y, upper.x) / rad, theta / rad, 1e-9);
    }
  }
});

test('MC is independent of latitude, while longitude changes the local sky', () => {
  const south = calculateChart({ ...base, latitude: -70 }, options);
  const north = calculateChart({ ...base, latitude: 70 }, options);
  nearAngle(south.midheaven.longitude, north.midheaven.longitude, 1e-10);
  assert.ok(circularDifference(south.ascendant.longitude, north.ascendant.longitude) > 20);
  const east = calculateChart({ ...base, longitude: 30 }, options);
  assert.ok(circularDifference(east.midheaven.longitude, north.midheaven.longitude) > 20);
});

test('whole-sign houses begin at the Ascendant sign boundary and contain the planets by sign', () => {
  const chart = calculateChart(base, options);
  assert.equal(chart.houses.length, 12);
  assert.equal(chart.houses[0].longitude, 0);
  assert.notEqual(chart.houses[0].longitude, chart.ascendant.longitude);
  for (let index = 0; index < 12; index++) {
    assert.deepEqual(chart.houses[index], { number: index + 1, signIndex: index, longitude: index * 30 });
  }
  for (const planet of chart.planets) assert.equal(chart.houses[planet.house - 1].signIndex, planet.signIndex);
});

test('geographic poles and coincident horizon return unavailable angles and no invented houses', () => {
  for (const latitude of [-90, 90]) {
    const chart = calculateChart({ ...base, latitude }, options);
    assert.equal(chart.ascendant, undefined);
    assert.equal(chart.midheaven, undefined);
    assert.deepEqual(chart.houses, []);
    assert.ok(chart.meta.warnings.some(warning => warning.code === 'GEOGRAPHIC_POLE'));
    assert.ok(chart.planets.every(planet => Number.isFinite(planet.longitude)));
  }
  const time = Astronomy.MakeTime(new Date('2000-01-01T12:00:00Z'));
  const normal = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), new Astronomy.Vector(0, 0, 1, time));
  const epsilon = Math.atan2(-normal.y, normal.z) * 180 / Math.PI;
  const longitude = 270 - Astronomy.SiderealTime(time) * 15;
  const chart = calculateChart({ ...base, latitude: 90 - epsilon, longitude }, options);
  assert.equal(chart.ascendant, undefined);
  assert.ok(chart.meta.warnings.some(warning => warning.code === 'COINCIDENT_HORIZON'));
});

test('unknown time measures the complete 23-hour or 25-hour civil date', () => {
  for (const [date, expectedHours] of [['2024-03-31', 23], ['2024-10-27', 25]]) {
    const chart = calculateChart({ ...base, date, timezone: 'Europe/Rome', unknownTime: true, time: undefined }, options);
    assert.equal(chart.meta.localDay.durationHours, expectedHours);
    assert.equal(chart.ascendant, undefined);
    assert.equal(chart.midheaven, undefined);
    assert.deepEqual(chart.houses, []);
    assert.deepEqual(chart.aspects, []);
    assert.equal(chart.meta.representativeTime, true);
  }
});

test('unknown time reports two possible solar signs at the equinox without a certain sign label', () => {
  const chart = calculateChart({ ...base, date: '2024-03-20', unknownTime: true }, options);
  const sun = chart.planets.find(planet => planet.key === 'sun');
  assert.deepEqual(sun.possibleSignIndices, [11, 0]);
  assert.equal(sun.signIndex, null);
  assert.equal(sun.degree, null);
  assert.equal(sun.signCertain, false);
  assert.ok(Number.isFinite(sun.longitude));
});

test('unknown time refines a station that briefly crosses a cusp between samples', () => {
  const midnight = Date.parse('2000-01-01T00:00:00Z');
  const stationEngine = { ...Astronomy, SunPosition: date => {
    const hours = (date.getTime() - midnight) / 3600000;
    return { elon: 30.001 - (hours - 12.12) ** 2 / 10 };
  } };
  const chart = calculateChart({ ...base, unknownTime: true }, { ...options, engine: stationEngine });
  const sun = chart.planets.find(planet => planet.key === 'sun');
  assert.deepEqual(sun.possibleSignIndices, [0, 1]);
  assert.equal(sun.signIndex, null);
  assert.equal(sun.retrograde, null);
  assert.deepEqual(sun.possibleRetrogrades.sort(), [false, true]);
});

test('unknown time includes real stations in the first minutes of the civil date', () => {
  for (const input of [
    { date: '2025-11-10', timezone: 'Etc/GMT-5', latitude: 0, longitude: 75, planet: 'mercury' },
    { date: '2025-04-13', timezone: 'Etc/GMT+1', latitude: 0, longitude: -15, planet: 'venus' }
  ]) {
    const chart = calculateChart({ ...input, unknownTime: true }, options);
    const planet = chart.planets.find(planet => planet.key === input.planet);
    assert.equal(planet.retrograde, null);
    assert.deepEqual(planet.possibleRetrogrades.sort(), [false, true]);
  }
});

test('unknown civil date handles midnight DST gaps and a completely skipped date', () => {
  const chart = calculateChart({ ...base, date: '2018-11-04', timezone: 'America/Sao_Paulo', unknownTime: true }, options);
  assert.equal(chart.meta.localDay.start, '2018-11-04T03:00:00.000Z');
  assert.equal(chart.meta.localDay.durationHours, 23);
  assert.throws(() => calculateChart({ ...base, date: '2011-12-30', timezone: 'Pacific/Apia', unknownTime: true }, options), errorCode('NONEXISTENT_LOCAL_DATE'));
});

test('today with unknown time excludes future moments and reports the partial interval', () => {
  const chart = calculateChart({ ...base, date: '2026-10-16', unknownTime: true }, options);
  assert.equal(chart.meta.localDay.partialDay, true);
  assert.equal(chart.meta.localDay.end, '2026-10-16T12:00:00.001Z');
  assert.ok(chart.meta.warnings.some(warning => warning.code === 'PARTIAL_CURRENT_DAY'));
});

test('retrograde is derived from geocentric motion, including a known Mercury retrograde', () => {
  const chart = calculateChart({ ...base, date: '2024-04-10' }, options);
  assert.equal(chart.planets.find(planet => planet.key === 'mercury').retrograde, true);
  assert.ok(chart.planets.find(planet => planet.key === 'mercury').speedDegreesPerDay < 0);
  assert.equal(chart.planets.find(planet => planet.key === 'sun').retrograde, false);
  assert.equal(chart.planets.find(planet => planet.key === 'moon').retrograde, false);
});

test('aspects use circular separation and the specified inclusive orbs', () => {
  const aspects = calculateAspects([{ key: 'a', longitude: 359 }, { key: 'b', longitude: 1 }, { key: 'c', longitude: 181 }, { key: 'd', longitude: 63 }]);
  assert.deepEqual(aspects.find(aspect => aspect.from === 'a' && aspect.to === 'b'), { from: 'a', to: 'b', type: 'conjunction', angle: 2, orb: 2 });
  assert.equal(aspects.find(aspect => aspect.from === 'b' && aspect.to === 'c').type, 'opposition');
  assert.equal(aspects.find(aspect => aspect.from === 'b' && aspect.to === 'd').type, 'sextile');
  assert.equal(calculateAspects([{ key: 'a', longitude: 0 }, { key: 'b', longitude: 64 }]).length, 0);
  assert.equal(calculateAspects([{ key: 'a', longitude: 0 }, { key: 'b', longitude: 94 }])[0].type, 'square');
  assert.equal(calculateAspects([{ key: 'a', longitude: 0 }, { key: 'b', longitude: 124 }])[0].type, 'trine');
  const chart = calculateChart(base, options);
  assert.ok(chart.aspects.length > 0);
});

test('invalid Gregorian dates, clocks, timezone and coordinates fail explicitly', () => {
  for (const date of ['1899-12-31', '2023-02-29', '2000-02-30', '2024-13-01', '2024-00-01', '24-01-01']) {
    assert.throws(() => resolveBirthTime({ date, time: '12:00', timezone: 'UTC' }), errorCode('INVALID_DATE'));
  }
  for (const time of ['24:00', '12:60', '9:30', '', undefined]) assert.throws(() => resolveBirthTime({ date: base.date, time, timezone: 'UTC' }), errorCode('INVALID_TIME'));
  assert.throws(() => calculateChart({ ...base, timezone: 'Mars/Olympus' }, options), errorCode('INVALID_TIMEZONE'));
  for (const coordinates of [{ latitude: 91 }, { longitude: -181 }, { latitude: NaN }, { longitude: '12' }]) {
    assert.throws(() => calculateChart({ ...base, ...coordinates }, options), errorCode('INVALID_COORDINATES'));
  }
  assert.throws(() => calculateChart({ ...base, unknownTime: 'true' }, options), errorCode('INVALID_TIME_MODE'));
});

test('future local dates and future instants fail, but local today depends on the selected timezone', () => {
  assert.throws(() => calculateChart({ ...base, date: '2026-10-17' }, options), errorCode('FUTURE_BIRTH'));
  assert.throws(() => calculateChart({ ...base, date: '2026-10-16', time: '12:01' }, options), errorCode('FUTURE_BIRTH'));
  const chart = calculateChart({ ...base, date: '2026-10-17', time: '01:00', timezone: 'Pacific/Kiritimati' }, options);
  assert.equal(chart.meta.utc, '2026-10-16T11:00:00.000Z');
});

test('module can be imported without a browser and reports a missing astronomy bundle', () => {
  assert.throws(() => calculateChart(base, { ...options, engine: {} }), errorCode('ENGINE_UNAVAILABLE'));
});
