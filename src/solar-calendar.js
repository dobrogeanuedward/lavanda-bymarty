import { SIGNS } from './natal-engine.js';
import { SolarError, SOLAR_FRAME, SOLAR_DATE_RANGE } from './solar-engine.js';

const DAY = 86400000;
const MONTHS = Object.freeze([
  ['january', 'Gennaio'], ['february', 'Febbraio'], ['march', 'Marzo'], ['april', 'Aprile'],
  ['may', 'Maggio'], ['june', 'Giugno'], ['july', 'Luglio'], ['august', 'Agosto'],
  ['september', 'Settembre'], ['october', 'Ottobre'], ['november', 'Novembre'], ['december', 'Dicembre'],
].map(([key, label]) => Object.freeze({ key, label })));
const SEASONS = { spring: 'Primavera', summer: 'Estate', autumn: 'Autunno', winter: 'Inverno' };
const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const OPPOSITE = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
const EVENTS = [
  ['march-equinox', 'Equinozio di marzo', 'mar_equinox', 0],
  ['june-solstice', 'Solstizio di giugno', 'jun_solstice', 90],
  ['september-equinox', 'Equinozio di settembre', 'sep_equinox', 180],
  ['december-solstice', 'Solstizio di dicembre', 'dec_solstice', 270],
];
const PHASES = [
  ['new', 'Luna nuova', 0], ['first-quarter', 'Primo quarto', 90],
  ['full', 'Luna piena', 180], ['last-quarter', 'Ultimo quarto', 270],
];
const normalize = value => ((value % 360) + 360) % 360;
const clamp = value => Math.max(0, Math.min(1, value));
const iso = value => new Date(value).toISOString();

function instant(value) {
  const isISO = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!(value instanceof Date) && !(typeof value === 'number' && Number.isFinite(value)) && !isISO) throw new SolarError('INVALID_DATE', 'Indica un istante valido con un fuso orario esplicito.');
  if (isISO) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    if (!days || day < 1 || day > days || Number(value.slice(11, 13)) > 23) throw new SolarError('INVALID_DATE', 'La data o l’ora non è valida.');
  }
  const time = new Date(value instanceof Date ? value.getTime() : value);
  if (!Number.isFinite(time.getTime())) throw new SolarError('INVALID_DATE', 'La data non corrisponde a un istante valido.');
  if (time.getTime() < Date.parse(SOLAR_DATE_RANGE.min) || time.getTime() > Date.parse(SOLAR_DATE_RANGE.max)) throw new SolarError('DATE_OUT_OF_RANGE', 'L’istante UTC è fuori dall’intervallo supportato dal calendario.');
  return time;
}

function astronomy(candidate) {
  const engine = candidate ?? globalThis.Astronomy;
  const methods = ['Seasons', 'SearchSunLongitude', 'SunPosition', 'SearchMoonPhase', 'HelioVector', 'Rotation_EQJ_ECL', 'RotateVector'];
  if (!engine || methods.some(method => typeof engine[method] !== 'function')) throw new SolarError('MISSING_ENGINE', 'Il motore del calendario astronomico non è disponibile.');
  return engine;
}
function eventTime(event) {
  const time = event?.date?.getTime();
  if (!Number.isFinite(time)) throw new SolarError('INVALID_EPHEMERIS', 'Il motore non ha restituito una data astronomica valida.');
  return time;
}
function earthPosition(engine, rotation, time) {
  const vector = engine.RotateVector(rotation, engine.HelioVector('Earth', new Date(time)));
  const result = [vector?.x, vector?.y, vector?.z];
  if (!result.every(Number.isFinite)) throw new SolarError('INVALID_EPHEMERIS', 'Il motore non ha restituito una posizione terrestre valida.');
  return result;
}

function solarTransitions(engine, year, events) {
  return SIGNS.map((sign, index) => {
    const longitude = index * 30;
    const cardinal = events.find(event => event.longitude === longitude);
    const event = cardinal ? { date: new Date(cardinal.date) } : engine.SearchSunLongitude(longitude, new Date(Date.UTC(year, (index + 2) % 12, 10)), 20);
    const time = eventTime(event);
    if (new Date(time).getUTCFullYear() !== year) throw new SolarError('INVALID_EPHEMERIS', 'Il passaggio solare non appartiene all’anno richiesto.');
    return { key: sign.key, label: sign.name, longitude, time };
  }).sort((a, b) => a.time - b.time);
}
function signsInMonth(engine, transitions, start, end) {
  const longitude = engine.SunPosition(new Date(start)).elon;
  if (!Number.isFinite(longitude)) throw new SolarError('INVALID_EPHEMERIS', 'La longitudine solare non è valida.');
  let signIndex = Math.floor(normalize(longitude) / 30), cursor = start;
  const result = [];
  const append = stop => {
    if (cursor < stop) result.push({ key: SIGNS[signIndex].key, label: SIGNS[signIndex].name, longitude: signIndex * 30, startDate: iso(cursor), endDate: iso(stop) });
  };
  for (const transition of transitions.filter(event => event.time >= start && event.time < end)) {
    append(transition.time);cursor = transition.time;signIndex = transition.longitude / 30;
  }
  append(end);
  return result;
}
function lunarPhases(engine, start, end) {
  const result = [];
  for (const [key, label, angle] of PHASES) {
    let cursor = start;
    while (cursor < end) {
      const event = engine.SearchMoonPhase(angle, new Date(cursor), (end - cursor) / DAY);
      if (!event) break;
      const time = eventTime(event);
      if (time < cursor || time >= end) break;
      result.push({ key, label, date: iso(time), angle });
      cursor = time + 60000; // Avoid rediscovering the same numerically rounded event.
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
function seasonIntervals(indices, sectors) {
  const intervals = [];
  for (const index of [...indices].sort((a, b) => a - b)) {
    const sector = sectors[index], previous = intervals.at(-1);
    if (previous?.endDate === sector.startDate) previous.endDate = sector.endDate;
    else intervals.push({ startDate: sector.startDate, endDate: sector.endDate });
  }
  return intervals.map(interval => ({ ...interval, durationDays: (Date.parse(interval.endDate) - Date.parse(interval.startDate)) / DAY }));
}

/** Fast time-only update for a cached year's geometry; throws when a new year is needed. */
export function getSolarCalendarProgress(calendar, date) {
  const time = instant(date), milliseconds = time.getTime();
  if (!calendar || !Array.isArray(calendar.sectors) || calendar.sectors.length !== 12) throw new SolarError('INVALID_CALENDAR', 'Il calendario non contiene i dodici mesi.');
  if (calendar.year !== time.getUTCFullYear()) throw new SolarError('CALENDAR_YEAR_MISMATCH', 'Ricostruisci il calendario per il nuovo anno UTC.');
  const currentSectorIndex = calendar.sectors.findIndex(sector => milliseconds >= Date.parse(sector.startDate) && milliseconds < Date.parse(sector.endDate));
  if (currentSectorIndex < 0) throw new SolarError('INVALID_CALENDAR', 'L’istante non rientra nei mesi del calendario.');
  const current = calendar.sectors[currentSectorIndex];
  const yearProgress = (milliseconds - Date.parse(calendar.startDate)) / (Date.parse(calendar.endDate) - Date.parse(calendar.startDate));
  return { date: time.toISOString(), year: calendar.year, currentSectorIndex, currentSectorKey: current.key, sectorProgress: clamp((milliseconds - Date.parse(current.startDate)) / (Date.parse(current.endDate) - Date.parse(current.startDate))), yearProgress, cycleProgress: yearProgress, seasonKey: current.seasonKey };
}

/** Civil UTC months, meteorological groups, and independently dated celestial events. */
export function computeSolarCalendar(date, { engine: candidate, hemisphere = 'north', samplesPerSector = 12 } = {}) {
  const time = instant(date), engine = astronomy(candidate);
  if (!['north', 'south'].includes(hemisphere)) throw new SolarError('INVALID_HEMISPHERE', 'Scegli emisfero nord o sud.');
  if (!Number.isInteger(samplesPerSector) || samplesPerSector < 2 || samplesPerSector > 128) throw new SolarError('INVALID_SAMPLES', 'Ogni mese richiede da 2 a 128 intervalli.');
  const year = time.getUTCFullYear(), rotation = engine.Rotation_EQJ_ECL(), seasonEvents = engine.Seasons(year);
  const astronomicalEvents = EVENTS.map(([key, label, property, longitude]) => {
    const milliseconds = eventTime(seasonEvents[property]);
    return { key, label, date: iso(milliseconds), longitude, position: earthPosition(engine, rotation, milliseconds) };
  });
  const transitions = solarTransitions(engine, year, astronomicalEvents);
  const sectors = MONTHS.map((month, index) => {
    const start = Date.UTC(year, index, 1), end = Date.UTC(year, index + 1, 1);
    const seasonKey = hemisphere === 'north' ? NORTH[index] : OPPOSITE[NORTH[index]];
    const points = Array.from({ length: samplesPerSector + 1 }, (_, sample) => earthPosition(engine, rotation, start + (end - start) * sample / samplesPerSector));
    return {
      key: month.key, name: month.label, label: month.label, monthLabel: month.label, index, month: index + 1,
      seasonKey, seasonLabel: SEASONS[seasonKey], startDate: iso(start), endDate: iso(end), durationDays: (end - start) / DAY,
      startPosition: points[0].slice(), endPosition: points.at(-1).slice(), points,
      solarSigns: signsInMonth(engine, transitions, start, end), lunarPhases: lunarPhases(engine, start, end),
      current: time.getTime() >= start && time.getTime() < end,
      progress: clamp((time.getTime() - start) / (end - start)),
    };
  });
  const seasons = Object.entries(SEASONS).map(([key, label]) => {
    let sectorIndices = sectors.filter(sector => sector.seasonKey === key).map(sector => sector.index);
    if (sectorIndices.includes(11) && sectorIndices.includes(0)) sectorIndices = [11, 0, 1];
    const intervals = seasonIntervals(sectorIndices, sectors);
    return { key, label, sectorIndices, monthIndices: sectorIndices.slice(), months: sectorIndices.map(index => index + 1), intervals, durationDays: intervals.reduce((sum, interval) => sum + interval.durationDays, 0) };
  });
  const calendar = { date: time.toISOString(), year, frame: SOLAR_FRAME, hemisphere, timeZone: 'UTC', seasonConvention: 'meteorological', startDate: iso(Date.UTC(year, 0, 1)), endDate: iso(Date.UTC(year + 1, 0, 1)), durationDays: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY, sectors, seasons, astronomicalEvents };
  return { ...calendar, ...getSolarCalendarProgress(calendar, time) };
}
