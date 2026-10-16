import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { SOLAR_DATE_RANGE, SolarError, computeSolarSystem } from '../src/solar-engine.js';
import { computeLunarCalendar, getLunarCalendarProgress } from '../src/lunar-calendar.js';

const options = { engine: Astronomy };
const keys = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];
const norm = vector => Math.hypot(...vector);
const difference = (a, b) => a.map((value, index) => value - b[index]);
const near = (actual, expected, tolerance = 1e-12) => assert.ok(norm(difference(actual, expected)) < tolerance);
const angularDifference = (a, b) => ((a - b + 540) % 360) - 180;
const errorCode = expected => error => error instanceof SolarError && error.code === expected;
const moon = date => {
  const vector = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), Astronomy.GeoMoon(new Date(date)));
  return [vector.x, vector.y, vector.z];
};

test('lunation boundaries and four principal phases match independent NASA Universal Time fixtures', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  // Fred Espenak / NASA GSFC, Phases of the Moon 2001–2025, UT, minute precision.
  // https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html
  const expected = [
    ['new', '2024-01-11T11:57:00Z'], ['first-quarter', '2024-01-18T03:53:00Z'],
    ['full', '2024-01-25T17:54:00Z'], ['last-quarter', '2024-02-02T23:18:00Z'],
  ];
  assert.equal(calendar.mainEvents.length, 4);
  for (const [index, [key, date]] of expected.entries()) {
    const event = calendar.mainEvents[index];
    assert.equal(event.key, key);
    assert.ok(Math.abs(Date.parse(event.date) - Date.parse(date)) < 120000, `${key}: ${event.date}`);
    assert.equal(event.date, event.eventDate);
    near(event.position, moon(event.date));
  }
  assert.equal(calendar.startDate, calendar.mainEvents[0].date);
  assert.ok(Math.abs(Date.parse(calendar.endDate) - Date.parse('2024-02-09T22:59:00Z')) < 120000);
  assert.ok(calendar.durationDays > 29.4 && calendar.durationDays < 29.5);
});

test('eight actual elongation crossings delimit unequal chronological intervals without gaps', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  assert.deepEqual(calendar.sectors.map(sector => sector.key), keys);
  assert.deepEqual(calendar.sectors.map(sector => sector.angle), [0, 45, 90, 135, 180, 225, 270, 315]);
  let total = 0;
  for (const [index, sector] of calendar.sectors.entries()) {
    assert.equal(sector.index, index);
    assert.equal(sector.eventDate, sector.startDate);
    assert.ok(Date.parse(sector.startDate) < Date.parse(sector.endDate));
    assert.ok(Math.abs(angularDifference(Astronomy.MoonPhase(new Date(sector.startDate)), sector.angle)) < 1e-5);
    if (index) assert.equal(sector.startDate, calendar.sectors[index - 1].endDate);
    total += sector.durationDays;
  }
  assert.equal(calendar.sectors[0].startDate, calendar.startDate);
  assert.equal(calendar.sectors.at(-1).endDate, calendar.endDate);
  assert.ok(Math.abs(total - calendar.durationDays) < 1e-12);
  const durations = calendar.sectors.map(sector => sector.durationDays);
  assert.ok(Math.max(...durations) - Math.min(...durations) > 0.5);
  assert.equal(calendar.sectors.filter(sector => sector.current).length, 1);
  assert.equal(calendar.currentSectorKey, 'first-quarter');
});

test('alchemy groups are explicitly editorial metadata and principal events keep the same phase keys', () => {
  const calendar = computeLunarCalendar('2026-10-16T12:00:00Z', options);
  const groups = ['nigredo', 'albedo', 'citrinitas', 'rubedo'];
  assert.deepEqual(calendar.groups.map(group => group.key), groups);
  assert.deepEqual(calendar.groups.map(group => group.label), ['Nigredo', 'Albedo', 'Citrinitas', 'Rubedo']);
  for (const [index, group] of calendar.groups.entries()) {
    assert.equal(group.convention, 'lavanda-editorial');
    assert.deepEqual(group.sectorIndices, [index * 2, index * 2 + 1]);
    assert.equal(group.startDate, calendar.sectors[index * 2].startDate);
    assert.equal(group.endDate, calendar.sectors[index * 2 + 1].endDate);
    assert.equal(group.durationDays, calendar.sectors[index * 2].durationDays + calendar.sectors[index * 2 + 1].durationDays);
  }
  assert.deepEqual(calendar.sectors.map(sector => sector.alchemyKey), groups.flatMap(key => [key, key]));
  assert.deepEqual(calendar.mainEvents.map(event => event.key), ['new', 'first-quarter', 'full', 'last-quarter']);
  assert.deepEqual(calendar.mainEvents.map(event => event.alchemyKey), groups);
});

test('geometry is the physical Moon in geocentric J2000, consistent with the same-instant solar scene', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', { ...options, samplesPerSector: 8 });
  assert.equal(calendar.frame, 'J2000 ecliptic');
  assert.equal(calendar.origin, 'earth');
  for (const sector of calendar.sectors) {
    assert.equal(sector.points.length, 9);
    near(sector.startPosition, moon(sector.startDate));
    near(sector.endPosition, moon(sector.endDate));
    const middle = new Date((Date.parse(sector.startDate) + Date.parse(sector.endDate)) / 2);
    near(sector.points[4], moon(middle));
    near(sector.points[4], computeSolarSystem(middle, options).moonGeocentric);
    assert.ok(sector.points.every(point => point.every(Number.isFinite)));
  }
});

test('a synodic-month trace exceeds one geocentric revolution and is not forced into a closed circle', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  const points = calendar.sectors.flatMap(sector => sector.points);
  let turn = 0;
  for (let index = 1; index < points.length; index++) {
    const from = Math.atan2(points[index - 1][1], points[index - 1][0]);
    const to = Math.atan2(points[index][1], points[index][0]);
    turn += ((to - from + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  }
  assert.ok(turn * 180 / Math.PI > 385 && turn * 180 / Math.PI < 395);
  assert.ok(norm(difference(points[0], points.at(-1))) > 0.001);
  const radii = points.map(norm);
  assert.ok(Math.max(...radii) - Math.min(...radii) > 0.0002);
  assert.ok(points.some(point => Math.abs(point[2]) > 0.0001));
});

test('half-open intervals switch exactly at each crossing and at the next New Moon', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  for (const sector of calendar.sectors) {
    const progress = getLunarCalendarProgress(calendar, sector.startDate);
    assert.equal(progress.currentSectorKey, sector.key);
    assert.equal(progress.sectorProgress, 0);
    const midpoint = (Date.parse(sector.startDate) + Date.parse(sector.endDate)) / 2;
    assert.ok(Math.abs(getLunarCalendarProgress(calendar, midpoint).sectorProgress - 0.5) < 1e-8);
  }
  assert.equal(getLunarCalendarProgress(calendar, calendar.startDate).lunationProgress, 0);
  assert.equal(getLunarCalendarProgress(calendar, Date.parse(calendar.endDate) - 1).currentSectorKey, 'waning-crescent');
  for (const outside of [Date.parse(calendar.startDate) - 1, calendar.endDate]) assert.throws(() => getLunarCalendarProgress(calendar, outside), errorCode('LUNATION_MISMATCH'));
  const next = computeLunarCalendar(calendar.endDate, options);
  assert.equal(next.startDate, calendar.endDate);
  assert.equal(next.currentSectorKey, 'new');
  assert.equal(next.lunationProgress, 0);
});

test('rebuilding on a New Moon remains stable across centuries and search directions', () => {
  // Includes cases where a backward-only SearchMoonPhase skips the boundary event.
  for (const date of ['1905-06-15T00:00:00Z', '1910-04-15T00:00:00Z', '1925-05-15T00:00:00Z', '1960-06-15T00:00:00Z', '2000-01-15T00:00:00Z', '2026-10-16T00:00:00Z', '2099-12-15T00:00:00Z']) {
    const calendar = computeLunarCalendar(date, { ...options, samplesPerSector: 2 });
    for (const boundary of [calendar.startDate, calendar.endDate]) {
      const rebuilt = computeLunarCalendar(boundary, { ...options, samplesPerSector: 2 });
      assert.equal(rebuilt.startDate, boundary, date);
      assert.equal(rebuilt.currentSectorKey, 'new');
      const before = computeLunarCalendar(Date.parse(boundary) - 1, { ...options, samplesPerSector: 2 });
      assert.equal(before.endDate, boundary, 'one millisecond before belongs to the earlier lunation');
    }
  }
});

test('phaseAngle is elongation, while illuminatedFraction is a separate physical measurement', () => {
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  assert.equal(calendar.phaseAngleConvention, 'geocentric-ecliptic-elongation');
  assert.equal(calendar.phaseAngle, Astronomy.MoonPhase(new Date(calendar.date)));
  const physical = Astronomy.Illumination('Moon', new Date(calendar.date));
  assert.equal(calendar.illuminatedFraction, physical.phase_fraction);
  assert.ok(Math.abs(calendar.phaseAngle - physical.phase_angle) > 20);
  for (const [index, fraction] of [[0, 0], [1, 0.5], [2, 1], [3, 0.5]]) {
    const progress = getLunarCalendarProgress(calendar, calendar.mainEvents[index].date, options);
    assert.ok(Math.abs(progress.illuminatedFraction - fraction) < 0.01);
    assert.ok(Math.abs(angularDifference(progress.phaseAngle, index * 90)) < 1e-5);
  }
});

test('cached geometry is reusable without engine calls, mutation, or implicit current-time reads', () => {
  const input = new Date('2024-01-20T00:00:00Z');
  const calendar = computeLunarCalendar(input, options), before = structuredClone(calendar);
  input.setUTCFullYear(2050);
  const sector = calendar.sectors[4];
  const progress = getLunarCalendarProgress(calendar, sector.startDate);
  assert.equal(progress.currentSectorKey, 'full');
  assert.ok(!('phaseAngle' in progress) && !('illuminatedFraction' in progress), 'time-only updates cannot return stale illumination');
  assert.deepEqual(calendar, before);
  assert.deepEqual(JSON.parse(JSON.stringify(calendar)), calendar);
});

test('supported UTC limits retain complete lunations even when geometry crosses the observed-date range', () => {
  for (const date of [SOLAR_DATE_RANGE.min, SOLAR_DATE_RANGE.max]) {
    const calendar = computeLunarCalendar(date, options);
    assert.equal(calendar.date, date);
    assert.ok(Date.parse(calendar.startDate) <= Date.parse(date));
    assert.ok(Date.parse(calendar.endDate) > Date.parse(date));
    assert.ok(calendar.sectors.flatMap(sector => sector.points).every(point => point.every(Number.isFinite)));
    assert.equal(calendar.mainEvents.length, 4);
  }
  assert.ok(Date.parse(computeLunarCalendar(SOLAR_DATE_RANGE.min, options).startDate) < Date.parse(SOLAR_DATE_RANGE.min));
  assert.ok(Date.parse(computeLunarCalendar(SOLAR_DATE_RANGE.max, options).endDate) > Date.parse(SOLAR_DATE_RANGE.max));
  assert.ok(Math.abs(computeLunarCalendar('2024-02-29T12:00:00Z', options).durationDays - 29.5) < 0.5);
});

test('invalid dates, unsupported instants, malformed ephemerides and options fail explicitly', () => {
  for (const date of [null, undefined, {}, Number.NaN, Infinity, new Date(Number.NaN), '2026-01-01', '2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z']) assert.throws(() => computeLunarCalendar(date, options), errorCode('INVALID_DATE'));
  for (const date of ['1899-12-30T23:59:59.999Z', '2101-01-01T00:00:00Z']) assert.throws(() => computeLunarCalendar(date, options), errorCode('DATE_OUT_OF_RANGE'));
  assert.throws(() => computeLunarCalendar('2026-01-01T00:00:00Z', { engine: {} }), errorCode('MISSING_ENGINE'));
  for (const samplesPerSector of [0, 1, 129, 2.5, '10']) assert.throws(() => computeLunarCalendar('2026-01-01T00:00:00Z', { ...options, samplesPerSector }), errorCode('INVALID_SAMPLES'));
  assert.throws(() => getLunarCalendarProgress({}, '2026-01-01T00:00:00Z'), errorCode('INVALID_CALENDAR'));
  const calendar = computeLunarCalendar('2024-01-20T00:00:00Z', options);
  assert.throws(() => getLunarCalendarProgress({ ...calendar, endDate: 'invalid' }, calendar.date), errorCode('INVALID_CALENDAR'));
  for (const overrides of [{ SearchMoonPhase: () => null }, { MoonPhase: () => Number.NaN }, { Illumination: () => ({ phase_fraction: 2 }) }, { GeoMoon: () => ({ x: Number.NaN, y: 0, z: 0 }) }]) assert.throws(() => computeLunarCalendar(calendar.date, { engine: { ...Astronomy, ...overrides } }), errorCode('INVALID_EPHEMERIS'));
});
