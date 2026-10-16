/** Geometric heliocentric ephemerides, AU, fixed mean ecliptic/equinox J2000. */
export const AU_KM = 149597870.7;
export const SOLAR_FRAME = 'J2000 ecliptic';
export const SOLAR_DATE_RANGE = Object.freeze({ min: '1900-01-01T00:00:00.000Z', max: '2100-12-31T23:59:59.999Z' });
const DAY_MS = 86400000;
const JULIAN_YEAR_DAYS = 365.25;
const PHYSICAL_SOURCE = 'https://ssd.jpl.nasa.gov/planets/phys_par.html';
const SUN_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html';
const MOON_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html';

// JPL volumetric mean radii and sidereal orbital periods (Julian years → days).
// Periods only define trajectory sampling windows; they never generate positions.
export const SOLAR_BODIES = Object.freeze([
  { key: 'sun', body: 'Sun', name: 'Sole', radiusKm: 695700, orbitalPeriodDays: null, color: '#FFD600', summary: 'Il Sole è l’origine della vista eliocentrica. La sua posizione zero descrive il riferimento scelto, non un’assenza di movimento nell’universo.', sourceUrl: SUN_SOURCE },
  { key: 'mercury', body: 'Mercury', name: 'Mercurio', radiusKm: 2439.4, orbitalPeriodDays: 0.2408467 * JULIAN_YEAR_DAYS, color: '#B8A9B7', summary: 'Il pianeta più interno. La distanza dal Sole cambia lungo la traiettoria: i punti sono posizioni calcolate, non passi uniformi su un cerchio.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'venus', body: 'Venus', name: 'Venere', radiusKm: 6051.8, orbitalPeriodDays: 0.61519726 * JULIAN_YEAR_DAYS, color: '#F3C58E', summary: 'La sua orbita si trova fra quelle di Mercurio e della Terra. La vista conserva la posizione nello spazio e l’inclinazione rispetto al piano J2000.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'earth', body: 'Earth', name: 'Terra', radiusKm: 6371.0084, orbitalPeriodDays: 1.0000174 * JULIAN_YEAR_DAYS, color: '#8093F1', summary: 'Il nostro punto di confronto per le distanze geocentriche. Nella vista eliocentrica anche la Terra percorre la propria traiettoria intorno al Sole.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'mars', body: 'Mars', name: 'Marte', radiusKm: 3389.5, orbitalPeriodDays: 1.8808476 * JULIAN_YEAR_DAYS, color: '#E66D5A', summary: 'Oltre l’orbita terrestre, Marte compie un giro in circa 687 giorni. La traiettoria campionata lascia visibile la variazione della distanza dal Sole.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'jupiter', body: 'Jupiter', name: 'Giove', radiusKm: 69911, orbitalPeriodDays: 11.862615 * JULIAN_YEAR_DAYS, color: '#D7AD85', summary: 'Il pianeta dal maggiore raggio medio fra gli otto mostrati. Il suo percorso intorno al Sole richiede quasi dodici anni terrestri.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'saturn', body: 'Saturn', name: 'Saturno', radiusKm: 58232, orbitalPeriodDays: 29.447498 * JULIAN_YEAR_DAYS, color: '#DFCB94', summary: 'Il suo percorso richiede circa ventinove anni e mezzo. Le dimensioni fisiche e le distanze restano dati separati dalle scelte di scala della scena.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'uranus', body: 'Uranus', name: 'Urano', radiusKm: 25362, orbitalPeriodDays: 84.016846 * JULIAN_YEAR_DAYS, color: '#9FFFCB', summary: 'Una rivoluzione richiede circa ottantaquattro anni. Per mostrarne il percorso si campiona una finestra molto più lunga di quella dei pianeti interni.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'neptune', body: 'Neptune', name: 'Nettuno', radiusKm: 24622, orbitalPeriodDays: 164.79132 * JULIAN_YEAR_DAYS, color: '#B58CFF', summary: 'Il pianeta più esterno di questa mappa, con un periodo di circa centosessantacinque anni. Anche qui ogni punto della traccia corrisponde a una data.', sourceUrl: PHYSICAL_SOURCE },
  { key: 'moon', body: 'Moon', name: 'Luna', radiusKm: 1737.4, orbitalPeriodDays: 27.3217, color: '#F4E9F5', summary: 'La posizione eliocentrica unisce il moto della Terra a quello della Luna. Nella vista locale la traiettoria lunare è invece riferita al centro della Terra.', sourceUrl: MOON_SOURCE },
].map(body => Object.freeze(body)));
const BY_KEY = new Map(SOLAR_BODIES.map(body => [body.key, body]));

export class SolarError extends Error {
  constructor(code, message) { super(message); this.name = 'SolarError'; this.code = code; }
}

function instant(value, { extended = false } = {}) {
  const explicitISO = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!(value instanceof Date) && !(typeof value === 'number' && Number.isFinite(value)) && !explicitISO) throw new SolarError('INVALID_DATE', 'Indica un istante valido con un fuso orario esplicito.');
  if (explicitISO) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    if (!days || day < 1 || day > days || Number(value.slice(11, 13)) > 23) throw new SolarError('INVALID_DATE', 'Il giorno o l’ora indicati non esistono nel calendario.');
  }
  const date = new Date(value instanceof Date ? value.getTime() : value);
  if (!Number.isFinite(date.getTime())) throw new SolarError('INVALID_DATE', 'La data non corrisponde a un istante valido.');
  const year = date.getUTCFullYear();
  if (year < (extended ? 1700 : 1900) || year > (extended ? 2300 : 2100)) throw new SolarError('DATE_OUT_OF_RANGE', extended ? 'Il campione di traiettoria deve restare fra il 1700 e il 2300.' : 'Scegli una data fra il 1900 e il 2100.');
  return date;
}

function astronomy(candidate) {
  const engine = candidate ?? globalThis.Astronomy;
  if (!engine || ['HelioVector', 'GeoMoon', 'BaryState', 'Rotation_EQJ_ECL', 'RotateVector'].some(key => typeof engine[key] !== 'function')) throw new SolarError('MISSING_ENGINE', 'Il motore astronomico non è disponibile.');
  return engine;
}

function arrayVector(vector) {
  const result = [vector?.x, vector?.y, vector?.z];
  if (!result.every(Number.isFinite)) throw new SolarError('INVALID_EPHEMERIS', 'Il calcolo astronomico ha restituito una posizione non valida.');
  return result;
}
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const magnitude = vector => Math.hypot(...vector);
const normalizeDegrees = value => ((value % 360) + 360) % 360;

function position(engine, rotation, body, date) {
  return arrayVector(engine.RotateVector(rotation, body === 'Moon' ? engine.GeoMoon(date) : engine.HelioVector(body, date)));
}
function sunBarycentricPosition(engine, rotation, date) {
  return arrayVector(engine.RotateVector(rotation, engine.BaryState('Sun', date)));
}

function bodyRotation(engine, rotation, body, date) {
  if (typeof engine.RotationAxis !== 'function') return undefined;
  const axis = engine.RotationAxis(body, date);
  const north = arrayVector(engine.RotateVector(rotation, axis.north));
  if (!Number.isFinite(axis.spin) || Math.abs(magnitude(north) - 1) > 1e-8) throw new SolarError('INVALID_EPHEMERIS', 'Il calcolo astronomico ha restituito un asse non valido.');
  return { north, primeMeridianDegrees: normalizeDegrees(axis.spin) };
}

/** All bodies at one UTC instant, without light-time or aberration corrections. */
export function computeSolarSystem(date, { engine: candidate } = {}) {
  const time = instant(date), engine = astronomy(candidate), rotation = engine.Rotation_EQJ_ECL();
  const earth = position(engine, rotation, 'Earth', time);
  const moonGeocentric = position(engine, rotation, 'Moon', time);
  const sunBarycentric = sunBarycentricPosition(engine, rotation, time);
  const bodies = SOLAR_BODIES.map(body => {
    const coordinates = body.key === 'sun' ? [0, 0, 0] : body.key === 'earth' ? earth.slice() : body.key === 'moon' ? add(earth, moonGeocentric) : position(engine, rotation, body.body, time);
    const spin = bodyRotation(engine, rotation, body.body, time);
    return { ...body, position: coordinates, barycentricPosition: add(coordinates, sunBarycentric), distanceSunAU: magnitude(coordinates), distanceEarthAU: magnitude(subtract(coordinates, earth)), ...(spin ? { rotation: spin } : {}) };
  });
  return { date: time.toISOString(), frame: SOLAR_FRAME, bodies, moonGeocentric, sunBarycentric };
}

/**
 * Time-sampled trajectory around centerDate. `samples` is the segment count;
 * points includes both interval endpoints, so it contains samples + 1 vectors.
 * The Moon uses an Earth-centered origin; planetary trajectories use the Sun.
 * The Sun is sampled barycentrically over a chosen 12-year interval, not a period.
 * Endpoints are actual ephemerides and must not be forced into a closed loop.
 */
function orbitPlan(key, centerDate, { engine: candidate, samples = 192 } = {}) {
  const body = BY_KEY.get(key);
  if (!body) throw new SolarError('INVALID_BODY', 'Questo corpo non è disponibile nella mappa.');
  if (!Number.isInteger(samples) || samples < 16 || samples > 2048) throw new SolarError('INVALID_SAMPLES', 'La traiettoria richiede da 16 a 2048 intervalli.');
  const center = instant(centerDate), engine = astronomy(candidate), rotation = engine.Rotation_EQJ_ECL();
  const periodDays = key === 'sun' ? 12 * JULIAN_YEAR_DAYS : body.orbitalPeriodDays, origin = key === 'sun' ? 'ssb' : key === 'moon' ? 'earth' : 'sun';
  const duration = periodDays * DAY_MS, start = center.getTime() - duration / 2, end = center.getTime() + duration / 2;
  const startDate = instant(start, { extended: true }), endDate = instant(end, { extended: true });
  return { key, origin, center, start, startDate, endDate, duration, periodDays, samples, engine, rotation, body };
}

function orbitPoint(plan, index) {
  const date = new Date(plan.start + plan.duration * index / plan.samples);
  return plan.key === 'sun' ? sunBarycentricPosition(plan.engine, plan.rotation, date) : position(plan.engine, plan.rotation, plan.body.body, date);
}
function orbitResult(plan, points) {
  return { key: plan.key, frame: SOLAR_FRAME, origin: plan.origin, centerDate: plan.center.toISOString(), startDate: plan.startDate.toISOString(), endDate: plan.endDate.toISOString(), periodDays: plan.periodDays, points, closed: false, ...(plan.key === 'sun' ? { intervalLabel: 'Traiettoria del Sole su 12 anni' } : {}) };
}

export function sampleOrbit(key, centerDate, options = {}) {
  const plan = orbitPlan(key, centerDate, options);
  return orbitResult(plan, plan.samples ? Array.from({ length: plan.samples + 1 }, (_, index) => orbitPoint(plan, index)) : []);
}

function checkAbort(signal) {
  if (signal?.aborted) {
    const error = new Error('Il campionamento della traiettoria è stato annullato.');
    error.name = 'AbortError';
    throw error;
  }
}

/** Cooperative trajectory sampling, cancellable when the displayed epoch changes. */
export async function sampleOrbitAsync(key, centerDate, { chunkSize = 24, signal, ...options } = {}) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 256) throw new SolarError('INVALID_CHUNK_SIZE', 'Un blocco di calcolo richiede da 1 a 256 campioni.');
  checkAbort(signal);
  const plan = orbitPlan(key, centerDate, options), points = [];
  for (let index = 0; plan.samples && index <= plan.samples; index++) {
    checkAbort(signal);
    points.push(orbitPoint(plan, index));
    if ((index + 1) % chunkSize === 0 && index < plan.samples) await new Promise(resolve => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  return orbitResult(plan, points);
}
