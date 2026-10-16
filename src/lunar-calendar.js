import { SolarError, SOLAR_FRAME, SOLAR_DATE_RANGE } from './solar-engine.js';

const DAY = 86400000;
const PHASES = Object.freeze([
  ['new', 'Luna nuova'], ['waxing-crescent', 'Falce crescente'],
  ['first-quarter', 'Primo quarto'], ['waxing-gibbous', 'Gibbosa crescente'],
  ['full', 'Luna piena'], ['waning-gibbous', 'Gibbosa calante'],
  ['last-quarter', 'Ultimo quarto'], ['waning-crescent', 'Falce calante'],
].map(([key, label], index) => Object.freeze({ key, label, angle: index * 45 })));
// These pairings are Lavanda's editorial reading, not astronomical categories.
const ALCHEMY = Object.freeze([
  ['nigredo', 'Nigredo'], ['albedo', 'Albedo'],
  ['citrinitas', 'Citrinitas'], ['rubedo', 'Rubedo'],
].map(([key, label]) => Object.freeze({ key, label })));
const iso = value => new Date(value).toISOString();
const clamp = value => Math.max(0, Math.min(1, value));

function instant(value) {
  const isISO = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!(value instanceof Date) && !(typeof value === 'number' && Number.isFinite(value)) && !isISO) throw new SolarError('INVALID_DATE', 'Indica un istante valido con un fuso orario esplicito.');
  if (isISO) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    if (!days || day < 1 || day > days || Number(value.slice(11, 13)) > 23) throw new SolarError('INVALID_DATE', 'La data o l’ora non è valida.');
  }
  const date = new Date(value instanceof Date ? value.getTime() : value);
  if (!Number.isFinite(date.getTime())) throw new SolarError('INVALID_DATE', 'La data non corrisponde a un istante valido.');
  if (date.getTime() < Date.parse(SOLAR_DATE_RANGE.min) || date.getTime() > Date.parse(SOLAR_DATE_RANGE.max)) throw new SolarError('DATE_OUT_OF_RANGE', 'L’istante UTC è fuori dall’intervallo supportato dal calendario lunare.');
  return date;
}

function astronomy(candidate, methods = ['SearchMoonPhase', 'MoonPhase', 'Illumination', 'GeoMoon', 'Rotation_EQJ_ECL', 'RotateVector']) {
  const engine = candidate ?? globalThis.Astronomy;
  if (!engine || methods.some(method => typeof engine[method] !== 'function')) throw new SolarError('MISSING_ENGINE', 'Il motore del calendario lunare non è disponibile.');
  return engine;
}
function phaseAngle(engine, time) {
  const angle = engine.MoonPhase(new Date(time));
  if (!Number.isFinite(angle) || angle < 0 || angle >= 360) throw new SolarError('INVALID_EPHEMERIS', 'L’elongazione lunare non è valida.');
  return angle;
}
function illumination(engine, time) {
  const illuminatedFraction = engine.Illumination('Moon', new Date(time))?.phase_fraction;
  if (!Number.isFinite(illuminatedFraction) || illuminatedFraction < 0 || illuminatedFraction > 1) throw new SolarError('INVALID_EPHEMERIS', 'La frazione illuminata della Luna non è valida.');
  return { phaseAngle: phaseAngle(engine, time), illuminatedFraction };
}

/** Stable first representable millisecond of a crossing, not a claim of physical ms accuracy. */
function eventTime(engine, angle, event) {
  const approximate = event?.date?.getTime();
  if (!Number.isFinite(approximate)) throw new SolarError('INVALID_EPHEMERIS', 'Il motore non ha restituito una fase lunare valida.');
  const difference = time => ((phaseAngle(engine, time) - angle + 540) % 360) - 180;
  let before = approximate - 2000, after = approximate + 2000;
  const lower = difference(before), upper = difference(after);
  if (lower > 0 || upper < 0) throw new SolarError('INVALID_EPHEMERIS', 'Il passaggio lunare non contiene la soglia richiesta.');
  if (lower === 0) return before;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (difference(middle) < 0) before = middle;
    else after = middle;
  }
  return after;
}
function search(engine, angle, time, days) {
  return eventTime(engine, angle, engine.SearchMoonPhase(angle, new Date(time), days));
}
function lunation(engine, milliseconds) {
  // Both directions matter at a New Moon: the backward search can skip that event.
  const candidates = [search(engine, 0, milliseconds, -40), search(engine, 0, milliseconds, 40)].sort((a, b) => a - b);
  const start = candidates.filter(time => time <= milliseconds).at(-1) ?? search(engine, 0, milliseconds - DAY, -40);
  const end = candidates.find(time => time > milliseconds) ?? search(engine, 0, start + DAY, 40);
  if (!(start <= milliseconds && milliseconds < end && end - start > 20 * DAY && end - start < 40 * DAY)) throw new SolarError('INVALID_EPHEMERIS', 'Non è stato possibile delimitare la lunazione corrente.');
  return { start, end };
}
function moonPosition(engine, rotation, time) {
  const vector = engine.RotateVector(rotation, engine.GeoMoon(new Date(time)));
  const result = [vector?.x, vector?.y, vector?.z];
  if (!result.every(Number.isFinite)) throw new SolarError('INVALID_EPHEMERIS', 'Il motore non ha restituito una posizione lunare valida.');
  return result;
}

/** Reuse a lunation's geometry until its next New Moon. No ephemeris call without engine. */
export function getLunarCalendarProgress(calendar, date, { engine: candidate } = {}) {
  const time = instant(date), milliseconds = time.getTime();
  if (!calendar || !Array.isArray(calendar.sectors) || calendar.sectors.length !== 8) throw new SolarError('INVALID_CALENDAR', 'Il calendario non contiene gli otto passaggi lunari.');
  const start = Date.parse(calendar.startDate), end = Date.parse(calendar.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new SolarError('INVALID_CALENDAR', 'Gli estremi della lunazione non sono validi.');
  if (milliseconds < start || milliseconds >= end) throw new SolarError('LUNATION_MISMATCH', 'Ricostruisci il calendario per la lunazione dell’istante richiesto.');
  const currentSectorIndex = calendar.sectors.findIndex(sector => milliseconds >= Date.parse(sector.startDate) && milliseconds < Date.parse(sector.endDate));
  if (currentSectorIndex < 0) throw new SolarError('INVALID_CALENDAR', 'L’istante non rientra negli intervalli del calendario.');
  const current = calendar.sectors[currentSectorIndex];
  return {
    date: time.toISOString(), currentSectorIndex, currentSectorKey: current.key,
    sectorProgress: clamp((milliseconds - Date.parse(current.startDate)) / (Date.parse(current.endDate) - Date.parse(current.startDate))),
    lunationProgress: (milliseconds - start) / (end - start),
    alchemyKey: current.alchemyKey,
    ...(candidate !== undefined ? illumination(astronomy(candidate, ['MoonPhase', 'Illumination']), milliseconds) : {}),
  };
}

/** Eight actual elongation crossings within a real New-Moon-to-New-Moon interval. */
export function computeLunarCalendar(date, { engine: candidate, samplesPerSector = 10 } = {}) {
  const time = instant(date), engine = astronomy(candidate), milliseconds = time.getTime();
  if (!Number.isInteger(samplesPerSector) || samplesPerSector < 2 || samplesPerSector > 128) throw new SolarError('INVALID_SAMPLES', 'Ogni passaggio lunare richiede da 2 a 128 intervalli.');
  const { start, end } = lunation(engine, milliseconds), rotation = engine.Rotation_EQJ_ECL();
  const boundaries = [start, ...PHASES.slice(1).map(phase => search(engine, phase.angle, start, 35)), end];
  if (boundaries.some((boundary, index) => index > 0 && boundary <= boundaries[index - 1])) throw new SolarError('INVALID_EPHEMERIS', 'I passaggi lunari non sono ordinati nella lunazione.');
  const sectors = PHASES.map((phase, index) => {
    const from = boundaries[index], to = boundaries[index + 1], alchemy = ALCHEMY[Math.floor(index / 2)];
    const points = Array.from({ length: samplesPerSector + 1 }, (_, sample) => moonPosition(engine, rotation, from + (to - from) * sample / samplesPerSector));
    return {
      key: phase.key, index, label: phase.label, phaseLabel: phase.label, angle: phase.angle,
      alchemyKey: alchemy.key, alchemyLabel: alchemy.label,
      startDate: iso(from), endDate: iso(to), eventDate: iso(from), durationDays: (to - from) / DAY,
      points, startPosition: points[0].slice(), endPosition: points.at(-1).slice(),
      current: milliseconds >= from && milliseconds < to,
      progress: clamp((milliseconds - from) / (to - from)),
    };
  });
  const mainEvents = sectors.filter(sector => sector.index % 2 === 0).map(sector => ({
    key: sector.key, label: sector.label, phaseLabel: sector.phaseLabel, angle: sector.angle,
    alchemyKey: sector.alchemyKey, alchemyLabel: sector.alchemyLabel,
    date: sector.startDate, eventDate: sector.startDate, position: sector.startPosition.slice(),
  }));
  const groups = ALCHEMY.map((alchemy, index) => ({
    ...alchemy, sectorIndices: [index * 2, index * 2 + 1],
    startDate: sectors[index * 2].startDate, endDate: sectors[index * 2 + 1].endDate,
    durationDays: sectors[index * 2].durationDays + sectors[index * 2 + 1].durationDays,
    convention: 'lavanda-editorial',
  }));
  const calendar = {
    date: time.toISOString(), frame: SOLAR_FRAME, origin: 'earth', timeZone: 'UTC',
    startDate: iso(start), endDate: iso(end), durationDays: (end - start) / DAY,
    phaseAngleConvention: 'geocentric-ecliptic-elongation',
    sectors, mainEvents, groups,
  };
  return { ...calendar, ...getLunarCalendarProgress(calendar, time, { engine }) };
}
