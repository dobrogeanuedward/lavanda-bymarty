import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { SOLAR_DATE_RANGE, SolarError } from '../src/solar-engine.js';
import { computeSolarCalendar, getSolarCalendarProgress } from '../src/solar-calendar.js';

const options = { engine: Astronomy };
const norm = vector => Math.hypot(...vector);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const near = (actual, expected, tolerance = 1e-12) => assert.ok(norm(subtract(actual, expected)) < tolerance);
const longitudeDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const errorCode = expected => error => error instanceof SolarError && error.code === expected;
const earth = date => {
  const vector = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), Astronomy.HelioVector('Earth', new Date(date)));
  return [vector.x, vector.y, vector.z];
};

test('civil months run January to January with actual Gregorian lengths, including century leap rules', () => {
  for (const [year, february, total] of [[1900, 28, 365], [2000, 29, 366], [2024, 29, 366], [2026, 28, 365], [2100, 28, 365]]) {
    const calendar = computeSolarCalendar(`${year}-06-15T12:00:00Z`, options);
    assert.equal(calendar.year, year);
    assert.equal(calendar.startDate, `${year}-01-01T00:00:00.000Z`);
    assert.equal(calendar.endDate, `${year + 1}-01-01T00:00:00.000Z`);
    assert.equal(calendar.durationDays, total);
    assert.deepEqual(calendar.sectors.map(sector => sector.durationDays), [31, february, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
    assert.deepEqual(calendar.sectors.map(sector => sector.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(calendar.sectors.map(sector => sector.label), ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']);
    assert.equal(calendar.sectors.reduce((days, sector) => days + sector.durationDays, 0), total);
    for (let index = 0; index < 11; index++) assert.equal(calendar.sectors[index].endDate, calendar.sectors[index + 1].startDate);
  }
});

test('current month and progress use half-open UTC dates, including January and year wrap', () => {
  const calendar = computeSolarCalendar('2026-01-01T00:00:00Z', options);
  assert.equal(calendar.year, 2026);
  assert.equal(calendar.currentSectorKey, 'january');
  assert.equal(calendar.sectorProgress, 0);
  assert.equal(calendar.yearProgress, 0);
  assert.equal(calendar.sectors.filter(sector => sector.current).length, 1);
  const middle = getSolarCalendarProgress(calendar, '2026-01-16T12:00:00Z');
  assert.equal(middle.sectorProgress, 0.5);
  assert.equal(middle.currentSectorIndex, 0);
  assert.equal(getSolarCalendarProgress(calendar, '2026-01-31T23:59:59.999Z').currentSectorKey, 'january');
  assert.equal(getSolarCalendarProgress(calendar, '2026-02-01T00:00:00Z').currentSectorKey, 'february');
  const end = getSolarCalendarProgress(calendar, '2026-12-31T23:59:59.999Z');
  assert.equal(end.currentSectorKey, 'december');
  assert.ok(end.yearProgress < 1 && end.yearProgress > 0.999);
  assert.throws(() => getSolarCalendarProgress(calendar, '2027-01-01T00:00:00Z'), errorCode('CALENDAR_YEAR_MISMATCH'));
  assert.equal(computeSolarCalendar('2027-01-01T00:00:00Z', options).currentSectorKey, 'january');
});

test('meteorological seasons group three named months and preserve the December–January wrap', () => {
  const north = computeSolarCalendar('2026-01-15T12:00:00Z', options);
  const south = computeSolarCalendar('2026-01-15T12:00:00Z', { ...options, hemisphere: 'south' });
  const season = (calendar, key) => calendar.seasons.find(season => season.key === key);
  assert.deepEqual(season(north, 'spring').months, [3, 4, 5]);
  assert.deepEqual(season(north, 'summer').months, [6, 7, 8]);
  assert.deepEqual(season(north, 'autumn').months, [9, 10, 11]);
  assert.deepEqual(season(north, 'winter').sectorIndices, [11, 0, 1]);
  assert.deepEqual(season(north, 'winter').months, [12, 1, 2]);
  assert.equal(season(north, 'winter').intervals.length, 2);
  assert.deepEqual(season(north, 'winter').intervals.map(interval => [interval.startDate, interval.endDate]), [['2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'], ['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']]);
  assert.equal(north.sectors[0].seasonLabel, 'Inverno');
  assert.equal(south.sectors[0].seasonLabel, 'Estate');
  assert.deepEqual(season(south, 'spring').months, [9, 10, 11]);
  assert.deepEqual(season(south, 'winter').months, [6, 7, 8]);
  assert.deepEqual(season(south, 'summer').months, [12, 1, 2]);
  assert.deepEqual(north.astronomicalEvents, south.astronomicalEvents, 'hemisphere changes names, never celestial instants');
  for (let index = 0; index < 12; index++) assert.deepEqual(north.sectors[index].points, south.sectors[index].points);
});

// Independent USNO API, tz:0 and dst:false, precision to one minute.
// https://aa.usno.navy.mil/api/seasons?year=2026
// https://aa.usno.navy.mil/api/seasons?year=2024
for (const [year, expected] of [
  [2026, ['2026-03-20T14:46:00Z', '2026-06-21T08:24:00Z', '2026-09-23T00:05:00Z', '2026-12-21T20:50:00Z']],
  [2024, ['2024-03-20T03:06:00Z', '2024-06-20T20:51:00Z', '2024-09-22T12:44:00Z', '2024-12-21T09:20:00Z']],
]) test(`four astronomical markers match independent USNO ${year} dates and remain separate from civil month boundaries`, () => {
  const calendar = computeSolarCalendar(`${year}-06-01T00:00:00Z`, options);
  assert.deepEqual(calendar.astronomicalEvents.map(event => event.key), ['march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']);
  for (const [index, event] of calendar.astronomicalEvents.entries()) {
    assert.ok(Math.abs(Date.parse(event.date) - Date.parse(expected[index])) < 120000, `${event.key}: ${event.date}`);
    assert.ok(longitudeDifference(Astronomy.SunPosition(new Date(event.date)).elon, index * 90) < 1e-6);
    near(event.position, earth(event.date));
    assert.ok(calendar.sectors.every(sector => sector.startDate !== event.date));
  }
});

test('monthly curves use physical Earth positions and unequal angles rather than twelve equal wedges', () => {
  const calendar = computeSolarCalendar('2026-10-16T00:00:00Z', { ...options, samplesPerSector: 8 });
  const angles = [];
  for (const sector of calendar.sectors) {
    assert.equal(sector.points.length, 9);
    near(sector.startPosition, earth(sector.startDate));
    near(sector.endPosition, earth(sector.endDate));
    near(sector.points[4], earth((Date.parse(sector.startDate) + Date.parse(sector.endDate)) / 2));
    assert.ok(sector.points.every(point => norm(point) > 0.98 && norm(point) < 1.02));
    const a = Math.atan2(sector.startPosition[1], sector.startPosition[0]), b = Math.atan2(sector.endPosition[1], sector.endPosition[0]);
    angles.push(((b - a + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI);
  }
  assert.ok(Math.max(...angles) - Math.min(...angles) > 2);
  assert.ok(norm(subtract(calendar.sectors[0].startPosition, calendar.sectors[11].endPosition)) > 0.001, 'civil year is not forced to equal an exact orbital period');
});

test('tropical sign intervals are actual solar crossings clipped to each civil month', () => {
  const calendar = computeSolarCalendar('2026-10-16T00:00:00Z', options);
  for (const sector of calendar.sectors) {
    assert.equal(sector.solarSigns.length, 2);
    assert.equal(sector.solarSigns[0].startDate, sector.startDate);
    assert.equal(sector.solarSigns.at(-1).endDate, sector.endDate);
    assert.equal(sector.solarSigns[0].endDate, sector.solarSigns[1].startDate);
    for (const sign of sector.solarSigns) {
      const middle = new Date((Date.parse(sign.startDate) + Date.parse(sign.endDate)) / 2);
      assert.equal(Math.floor(Astronomy.SunPosition(middle).elon / 30) * 30, sign.longitude);
      assert.ok(Date.parse(sign.startDate) >= Date.parse(sector.startDate));
      assert.ok(Date.parse(sign.endDate) <= Date.parse(sector.endDate));
    }
    const entered = sector.solarSigns[1];
    assert.ok(longitudeDifference(Astronomy.SunPosition(new Date(entered.startDate)).elon, entered.longitude) < 1e-6);
  }
  assert.deepEqual(calendar.sectors[0].solarSigns.map(sign => sign.key), ['capricorn', 'aquarius']);
  assert.deepEqual(calendar.sectors[2].solarSigns.map(sign => sign.key), ['pisces', 'aries']);
  assert.equal(calendar.sectors[2].solarSigns[1].startDate, calendar.astronomicalEvents[0].date);
});

test('lunar phases match independent NASA UT fixtures and preserve multiple phases of the same kind in a month', () => {
  const calendar = computeSolarCalendar('2024-01-15T12:00:00Z', options);
  // Fred Espenak / NASA GSFC, Phases of the Moon 2001–2025, Universal Time.
  // https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html
  const expected = [['last-quarter', '2024-01-04T03:30:00Z'], ['new', '2024-01-11T11:57:00Z'], ['first-quarter', '2024-01-18T03:53:00Z'], ['full', '2024-01-25T17:54:00Z']];
  assert.equal(calendar.sectors[0].lunarPhases.length, expected.length);
  for (const [index, [key, date]] of expected.entries()) {
    const phase = calendar.sectors[0].lunarPhases[index];
    assert.equal(phase.key, key);
    assert.ok(Math.abs(Date.parse(phase.date) - Date.parse(date)) < 120000);
  }
  assert.equal(calendar.sectors[11].lunarPhases.filter(phase => phase.key === 'new').length, 2);
  for (const sector of calendar.sectors) for (const phase of sector.lunarPhases) {
    assert.ok(Date.parse(phase.date) >= Date.parse(sector.startDate) && Date.parse(phase.date) < Date.parse(sector.endDate));
    assert.ok(longitudeDifference(Astronomy.MoonPhase(new Date(phase.date)), phase.angle) < 1e-4);
  }
});

test('January progress can update a cached year without any engine call or mutation', () => {
  const calendar = computeSolarCalendar('2026-01-01T00:00:00Z', options), before = structuredClone(calendar);
  const progress = getSolarCalendarProgress(calendar, new Date('2026-02-15T00:00:00Z'));
  assert.equal(progress.currentSectorKey, 'february');
  assert.equal(progress.sectorProgress, 0.5);
  assert.equal(progress.seasonKey, 'winter');
  assert.deepEqual(calendar, before);
  assert.deepEqual(JSON.parse(JSON.stringify(calendar)), calendar);
});

test('the natal UTC margin and upper boundary keep complete physical year geometry', () => {
  for (const [date, year, key] of [[SOLAR_DATE_RANGE.min, 1899, 'december'], [SOLAR_DATE_RANGE.max, 2100, 'december']]) {
    const calendar = computeSolarCalendar(date, options);
    assert.equal(calendar.year, year);
    assert.equal(calendar.currentSectorKey, key);
    assert.equal(calendar.sectors.length, 12);
    assert.ok(calendar.sectors.flatMap(sector => sector.points).every(point => point.every(Number.isFinite)));
    assert.equal(calendar.astronomicalEvents.length, 4);
  }
});

test('invalid instants, calendar updates and options fail instead of guessing a frame or hemisphere', () => {
  for (const date of [null, undefined, {}, Number.NaN, Infinity, new Date(Number.NaN), '2026-01-01', '2026-02-30T00:00:00Z']) assert.throws(() => computeSolarCalendar(date, options), errorCode('INVALID_DATE'));
  for (const date of ['1899-12-30T23:59:59.999Z', '2101-01-01T00:00:00Z']) assert.throws(() => computeSolarCalendar(date, options), errorCode('DATE_OUT_OF_RANGE'));
  assert.throws(() => computeSolarCalendar('2026-01-01T00:00:00Z', { engine: {} }), errorCode('MISSING_ENGINE'));
  assert.throws(() => computeSolarCalendar('2026-01-01T00:00:00Z', { ...options, hemisphere: 'equator' }), errorCode('INVALID_HEMISPHERE'));
  for (const samplesPerSector of [0, 1, 129, 8.5, '12']) assert.throws(() => computeSolarCalendar('2026-01-01T00:00:00Z', { ...options, samplesPerSector }), errorCode('INVALID_SAMPLES'));
  assert.throws(() => getSolarCalendarProgress({}, '2026-01-01T00:00:00Z'), errorCode('INVALID_CALENDAR'));
  assert.throws(() => computeSolarCalendar('2026-01-01T00:00:00Z', { engine: { ...Astronomy, SearchSunLongitude: () => null } }), errorCode('INVALID_EPHEMERIS'));
});
