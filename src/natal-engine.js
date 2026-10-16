/** Tropical, apparent geocentric positions in the true ecliptic of date.
 * Astronomy Engine 2.1.19: https://github.com/cosinekitty/astronomy
 * Load astronomy.browser.min.js before this module, or inject { engine } in Node.
 * A chart is a symbolic astrological convention, not a scientific personality assessment.
 */
export const SIGNS = Object.freeze([
  ['aries', 'Ariete', '♈', 'Fuoco'], ['taurus', 'Toro', '♉', 'Terra'],
  ['gemini', 'Gemelli', '♊', 'Aria'], ['cancer', 'Cancro', '♋', 'Acqua'],
  ['leo', 'Leone', '♌', 'Fuoco'], ['virgo', 'Vergine', '♍', 'Terra'],
  ['libra', 'Bilancia', '♎', 'Aria'], ['scorpio', 'Scorpione', '♏', 'Acqua'],
  ['sagittarius', 'Sagittario', '♐', 'Fuoco'], ['capricorn', 'Capricorno', '♑', 'Terra'],
  ['aquarius', 'Acquario', '♒', 'Aria'], ['pisces', 'Pesci', '♓', 'Acqua']
].map(([key, name, glyph, element]) => Object.freeze({ key, name, glyph, element })));

export const PLANETS = Object.freeze([
  ['sun', 'Sole', '☉', 'Sun'], ['moon', 'Luna', '☽', 'Moon'],
  ['mercury', 'Mercurio', '☿', 'Mercury'], ['venus', 'Venere', '♀', 'Venus'],
  ['mars', 'Marte', '♂', 'Mars'], ['jupiter', 'Giove', '♃', 'Jupiter'],
  ['saturn', 'Saturno', '♄', 'Saturn'], ['uranus', 'Urano', '♅', 'Uranus'],
  ['neptune', 'Nettuno', '♆', 'Neptune'], ['pluto', 'Plutone', '♇', 'Pluto']
].map(([key, name, glyph, body]) => Object.freeze({ key, name, glyph, body })));

const DAY = 86400000;
const MINUTE = 60000;
const RAD = Math.PI / 180;
const formatters = new Map();
const normalize = value => ((value % 360) + 360) % 360;
const difference = (a, b) => ((a - b + 540) % 360) - 180;
const dateKey = parts => `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

export class NatalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NatalError';
    this.code = code;
    Object.assign(this, details);
  }
}

function formatter(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim()) throw new NatalError('INVALID_TIMEZONE', 'Scegli un fuso orario IANA.');
  if (!formatters.has(timezone)) {
    try {
      formatters.set(timezone, new Intl.DateTimeFormat('en-CA-u-ca-iso8601', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }));
    } catch {
      throw new NatalError('INVALID_TIMEZONE', 'Il fuso orario non è riconosciuto.');
    }
  }
  return formatters.get(timezone);
}

function localParts(milliseconds, timezone) {
  const result = {};
  for (const part of formatter(timezone).formatToParts(new Date(milliseconds))) {
    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) result[part.type] = Number(part.value);
  }
  return result;
}

function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new NatalError('INVALID_DATE', 'Inserisci una data nel formato anno-mese-giorno.');
  const [year, month, day] = date.split('-').map(Number);
  const milliseconds = Date.UTC(year, month - 1, day);
  if (year < 1900 || dateKey({ year, month, day }) !== dateKey({
    year: new Date(milliseconds).getUTCFullYear(), month: new Date(milliseconds).getUTCMonth() + 1,
    day: new Date(milliseconds).getUTCDate()
  })) throw new NatalError('INVALID_DATE', 'La data deve essere valida e dal 1900 in poi.');
  return { year, month, day, milliseconds };
}

function parseTime(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new NatalError('INVALID_TIME', 'Inserisci un orario valido, da 00:00 a 23:59.');
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

function offsetLabel(offsetMinutes) {
  const seconds = Math.round(Math.abs(offsetMinutes) * 60);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
  const remainder = seconds % 60;
  return `UTC${offsetMinutes < 0 ? '−' : '+'}${hours}:${minutes}${remainder ? `:${String(remainder).padStart(2, '0')}` : ''}`;
}

/** Never silently shifts a nonexistent clock time, or picks a repeated one. */
export function resolveBirthTime({ date, time, timezone } = {}) {
  const day = parseDate(date);
  const clock = parseTime(time);
  formatter(timezone);
  const naive = day.milliseconds + clock.hour * 3600000 + clock.minute * MINUTE;
  const offsets = new Set();
  // Include both sides of nearby transitions and non-hour historical offsets.
  for (let delta = -48; delta <= 48; delta += 3) {
    const instant = naive + delta * 3600000;
    const p = localParts(instant, timezone);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant);
  }
  const candidates = [];
  for (const offset of offsets) {
    const instant = naive - offset;
    const p = localParts(instant, timezone);
    if (dateKey(p) === date && p.hour === clock.hour && p.minute === clock.minute && p.second === 0) {
      const offsetMinutes = offset / MINUTE;
      candidates.push({ utc: new Date(instant).toISOString(), offsetMinutes, offsetLabel: offsetLabel(offsetMinutes) });
    }
  }
  candidates.sort((a, b) => a.utc.localeCompare(b.utc));
  return { date, time, timezone, status: candidates.length === 0 ? 'nonexistent' : candidates.length === 1 ? 'valid' : 'ambiguous', candidates };
}

function dayIntervals(date, timezone) {
  const midnight = parseDate(date).milliseconds;
  const sameDate = value => dateKey(localParts(value, timezone)) === date;
  const step = 15 * MINUTE;
  const segments = [];
  let previous = midnight - 3 * DAY;
  let previousMatch = sameDate(previous);
  let start = previousMatch ? previous : null;
  // Search the actual civil date, including midnight gaps and skipped dates.
  for (let current = previous + step; current <= midnight + 3 * DAY; current += step) {
    const match = sameDate(current);
    if (match !== previousMatch) {
      let left = previous;
      let right = current;
      while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (sameDate(middle) === previousMatch) left = middle;
        else right = middle;
      }
      if (match) start = right;
      else { segments.push({ start, end: right }); start = null; }
    }
    previous = current;
    previousMatch = match;
  }
  if (!segments.length) throw new NatalError('NONEXISTENT_LOCAL_DATE', 'Questa data non è esistita nel fuso orario scelto.');
  return segments;
}

function requireEngine(engine) {
  for (const method of ['SunPosition', 'GeoVector', 'Ecliptic', 'SiderealTime', 'Rotation_ECT_EQD', 'Rotation_EQD_ECT', 'RotateVector', 'Vector', 'MakeTime']) {
    if (typeof engine?.[method] !== 'function') throw new NatalError('ENGINE_UNAVAILABLE', 'Il motore astronomico non è ancora disponibile.');
  }
  return engine;
}

function planetLongitude(engine, body, instant) {
  const date = new Date(instant);
  // EclipticLongitude() is HELIOcentric and must not be used for birth charts.
  return normalize(body === 'Sun' ? engine.SunPosition(date).elon : engine.Ecliptic(engine.GeoVector(body, date, true)).elon);
}

function planetSpeed(engine, body, instant) {
  return difference(planetLongitude(engine, body, instant + MINUTE), planetLongitude(engine, body, instant - MINUTE)) * 720;
}

function position(engine, planet, instant) {
  const longitude = planetLongitude(engine, planet.body, instant);
  const speedDegreesPerDay = planetSpeed(engine, planet.body, instant);
  return { key: planet.key, name: planet.name, glyph: planet.glyph, longitude,
    signIndex: Math.floor(longitude / 30), degree: longitude % 30,
    retrograde: speedDegreesPerDay < 0, speedDegreesPerDay };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = value => Math.hypot(...value);
const vectorArray = value => [value.x, value.y, value.z];

/** Eastern horizon intersection, in the true equatorial frame of date. */
function chartAngles(engine, instant, latitude, longitude) {
  const time = engine.MakeTime(new Date(instant));
  const theta = normalize(engine.SiderealTime(time) * 15 + longitude) * RAD;
  const phi = latitude * RAD;
  if (Math.abs(Math.cos(phi)) < 1e-12) return { reason: 'GEOGRAPHIC_POLE' };
  const normal = vectorArray(engine.RotateVector(engine.Rotation_ECT_EQD(time), new engine.Vector(0, 0, 1, time)));
  const zenith = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
  const east = [-Math.sin(theta), Math.cos(theta), 0];
  let rising = cross(normal, zenith);
  const length = norm(rising);
  if (length < 1e-12) return { reason: 'COINCIDENT_HORIZON' };
  rising = rising.map(value => value / length);
  const eastness = dot(rising, east);
  if (Math.abs(eastness) < 1e-12) return { reason: 'UNDEFINED_EASTERN_INTERSECTION' };
  if (eastness < 0) rising = rising.map(value => -value);
  const toLongitude = coordinates => {
    const vector = engine.RotateVector(engine.Rotation_EQD_ECT(time), new engine.Vector(...coordinates, time));
    const value = normalize(Math.atan2(vector.y, vector.x) / RAD);
    return { longitude: value, signIndex: Math.floor(value / 30), degree: value % 30 };
  };
  // The upper meridian has equatorial RA theta, regardless of latitude.
  const meridianNormal = [-Math.sin(theta), Math.cos(theta), 0];
  let culmination = cross(meridianNormal, normal);
  if (dot(culmination, [Math.cos(theta), Math.sin(theta), 0]) < 0) culmination = culmination.map(value => -value);
  return { ascendant: toLongitude(rising), midheaven: toLongitude(culmination) };
}

function possiblePositions(engine, planet, segments, representative) {
  const sample = [];
  let previousLongitude;
  let unwrapped;
  for (const segment of segments) {
    const last = segment.end - 1;
    const times = [segment.start];
    for (let at = segment.start + 15 * MINUTE; at < last; at += 15 * MINUTE) times.push(at);
    if (last > segment.start) times.push(last);
    for (const instant of times) {
      const longitude = planetLongitude(engine, planet.body, instant);
      unwrapped = previousLongitude === undefined ? longitude : unwrapped + difference(longitude, previousLongitude);
      sample.push({ instant, longitude: unwrapped, speed: planetSpeed(engine, planet.body, instant), segment });
      previousLongitude = longitude;
    }
  }
  const values = sample.map(point => point.longitude);
  // Refine station roots, including the first and last minutes of the day:
  // a brief cusp crossing may have matching signs at both sample endpoints.
  for (let i = 1; i < sample.length; i++) {
    const before = sample[i - 1], after = sample[i];
    if (before.segment !== after.segment || before.speed * after.speed > 0 || (!before.speed && !after.speed)) continue;
    let left = before.instant, right = after.instant;
    while (right - left > 1) {
      const middle = Math.floor((left + right) / 2);
      if ((planetSpeed(engine, planet.body, middle) < 0) === (before.speed < 0)) left = middle;
      else right = middle;
    }
    values.push(before.longitude + difference(planetLongitude(engine, planet.body, (left + right) / 2), normalize(before.longitude)));
  }
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const possibleSignIndices = [];
  for (let sign = Math.floor(minimum / 30); sign <= Math.floor(maximum / 30); sign++) {
    const index = ((sign % 12) + 12) % 12;
    if (!possibleSignIndices.includes(index)) possibleSignIndices.push(index);
  }
  const possibleRetrogrades = [...new Set(sample.filter(point => Math.abs(point.speed) > 1e-12).map(point => point.speed < 0))];
  const result = position(engine, planet, representative);
  return { ...result, signIndex: possibleSignIndices.length === 1 ? possibleSignIndices[0] : null,
    degree: possibleSignIndices.length === 1 ? result.degree : null,
    signCertain: possibleSignIndices.length === 1, possibleSignIndices,
    retrograde: possibleRetrogrades.length === 1 ? possibleRetrogrades[0] : null,
    possibleRetrogrades, longitudeRange: { minimum: normalize(minimum), maximum: normalize(maximum), crossesZero: Math.floor(minimum / 360) !== Math.floor(maximum / 360) } };
}

export function calculateAspects(planets) {
  const definitions = [['conjunction', 0, 6], ['opposition', 180, 6], ['trine', 120, 4], ['square', 90, 4], ['sextile', 60, 3]];
  const aspects = [];
  for (let first = 0; first < planets.length; first++) {
    for (let second = first + 1; second < planets.length; second++) {
      const angle = Math.abs(difference(planets[first].longitude, planets[second].longitude));
      for (const [type, target, allowed] of definitions) {
        const orb = Math.abs(angle - target);
        if (orb <= allowed) { aspects.push({ from: planets[first].key, to: planets[second].key, type, angle, orb }); break; }
      }
    }
  }
  return aspects;
}

export function calculateChart(input, { engine = globalThis.Astronomy, now = new Date() } = {}) {
  const { date, time, timezone, latitude, longitude, unknownTime = false, utcChoice } = input || {};
  const day = parseDate(date);
  formatter(timezone);
  if (typeof unknownTime !== 'boolean') throw new NatalError('INVALID_TIME_MODE', 'Indica se l’ora è conosciuta.');
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new NatalError('INVALID_COORDINATES', 'Scegli un luogo con coordinate valide.');
  }
  const nowMilliseconds = new Date(now).getTime();
  if (!Number.isFinite(nowMilliseconds)) throw new NatalError('INVALID_NOW', 'L’istante attuale non è valido.');
  if (date > dateKey(localParts(nowMilliseconds, timezone))) throw new NatalError('FUTURE_BIRTH', 'La data di nascita non può essere futura.');
  requireEngine(engine);
  const warnings = [];
  if (day.year < 1970) warnings.push({ code: 'HISTORICAL_TIMEZONE', message: 'Prima del 1970 il fuso storico dipende dai dati IANA del dispositivo: verifica l’ora civile registrata nel luogo di nascita.' });
  const meta = { engine: 'Astronomy Engine', engineVersion: '2.1.19', zodiac: 'tropical', frame: 'geocentric-apparent-true-ecliptic-of-date',
    houseSystem: 'whole-sign', timezone, date, time: unknownTime ? null : time, unknownTime, latitude, longitude,
    precision: 'approximate-arcminute', warnings };
  if (unknownTime) {
    const fullSegments = dayIntervals(date, timezone);
    const segments = fullSegments.map(segment => ({ start: segment.start, end: Math.min(segment.end, nowMilliseconds + 1) })).filter(segment => segment.start < segment.end);
    if (!segments.length) throw new NatalError('FUTURE_BIRTH', 'La data di nascita non può essere futura.');
    const noon = resolveBirthTime({ date, time: '12:00', timezone }).candidates.map(candidate => Date.parse(candidate.utc));
    const representative = noon.find(instant => segments.some(segment => instant >= segment.start && instant < segment.end)) ?? Math.floor((segments[0].start + segments.at(-1).end - 1) / 2);
    const planets = PLANETS.map(planet => possiblePositions(engine, planet, segments, representative));
    const partialDay = segments.at(-1).end < fullSegments.at(-1).end;
    warnings.push({ code: 'UNKNOWN_BIRTH_TIME', message: 'Ora ignota: posizioni rappresentative e segni possibili nell’intera giornata civile; Ascendente, case e aspetti sono omessi.' });
    if (partialDay) warnings.push({ code: 'PARTIAL_CURRENT_DAY', message: 'Per la data odierna l’intervallo termina all’istante attuale.' });
    return { planets, houses: [], aspects: [], meta: { ...meta, utc: new Date(representative).toISOString(), representativeTime: true,
      localDay: { start: new Date(segments[0].start).toISOString(), end: new Date(segments.at(-1).end).toISOString(),
        durationHours: segments.reduce((sum, segment) => sum + segment.end - segment.start, 0) / 3600000, partialDay,
        segments: segments.map(segment => ({ start: new Date(segment.start).toISOString(), end: new Date(segment.end).toISOString() })) } } };
  }
  const resolution = resolveBirthTime({ date, time, timezone });
  if (resolution.status === 'nonexistent') throw new NatalError('NONEXISTENT_LOCAL_TIME', 'Questo orario non è esistito per il cambio di ora legale. Scegli l’orario registrato corretto.', { candidates: [] });
  if (resolution.status === 'ambiguous' && !utcChoice) throw new NatalError('AMBIGUOUS_LOCAL_TIME', 'Questo orario si è verificato due volte: scegli il fuso indicato sul documento.', { candidates: resolution.candidates });
  const chosen = utcChoice ? resolution.candidates.find(candidate => candidate.utc === utcChoice) : resolution.candidates[0];
  if (!chosen) throw new NatalError('INVALID_UTC_CHOICE', 'L’istante scelto non corrisponde all’ora locale inserita.', { candidates: resolution.candidates });
  const instant = Date.parse(chosen.utc);
  if (instant > nowMilliseconds) throw new NatalError('FUTURE_BIRTH', 'L’orario di nascita non può essere futuro.');
  const planets = PLANETS.map(planet => ({ ...position(engine, planet, instant), signCertain: true }));
  const angles = chartAngles(engine, instant, latitude, longitude);
  const houses = angles.ascendant ? Array.from({ length: 12 }, (_, index) => {
    const signIndex = (angles.ascendant.signIndex + index) % 12;
    return { number: index + 1, longitude: signIndex * 30, signIndex };
  }) : [];
  if (angles.reason) warnings.push({ code: angles.reason, message: 'Ascendente e case non sono geometricamente definiti per queste coordinate e questo istante.' });
  if (angles.ascendant) for (const planet of planets) planet.house = ((planet.signIndex - angles.ascendant.signIndex + 12) % 12) + 1;
  return { planets, ...(angles.ascendant ? { ascendant: angles.ascendant, midheaven: angles.midheaven } : {}), houses,
    aspects: calculateAspects(planets), meta: { ...meta, utc: chosen.utc, offsetMinutes: chosen.offsetMinutes,
      offsetLabel: chosen.offsetLabel, timeResolution: resolution.status, representativeTime: false } };
}
