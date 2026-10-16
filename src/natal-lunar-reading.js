import { SIGNS } from './natal-engine.js';
import { SIGN_ARCANA, TAROT_CARDS } from './natal-tarot.js';
import { SolarError, SOLAR_DATE_RANGE } from './solar-engine.js';
import { computeLunarCalendar } from './lunar-calendar.js';

const DAY = 86400000;
const LABELS = { new: 'Luna nuova', 'waxing-crescent': 'Falce crescente', 'first-quarter': 'Primo quarto', 'waxing-gibbous': 'Gibbosa crescente', full: 'Luna piena', 'waning-gibbous': 'Gibbosa calante', 'last-quarter': 'Ultimo quarto', 'waning-crescent': 'Falce calante' };
const APPEARANCES = ['waxing-crescent', 'waxing-gibbous', 'waning-gibbous', 'waning-crescent'];
const iso = time => new Date(time).toISOString();
const validSign = value => Number.isInteger(value) && value >= 0 && value < 12;
const unique = values => [...new Set(values)];
const invalidChart = message => new SolarError('INVALID_NATAL_CHART', message);

function metadataTime(value, { end = false } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(value)) throw invalidChart('La carta non contiene un intervallo UTC valido.');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const time = Date.parse(value);
  if (!days || day < 1 || day > days || !Number.isFinite(time) || time < Date.parse(SOLAR_DATE_RANGE.min) || time > Date.parse(SOLAR_DATE_RANGE.max) + (end ? 1 : 0)) throw invalidChart('L’intervallo della giornata è fuori dai limiti validi della carta.');
  return time;
}
function localDay(chart, utc) {
  const input = chart.meta.localDay;
  if (!input || !Array.isArray(input.segments) || !input.segments.length) throw invalidChart('Senza l’ora occorrono gli intervalli effettivi della giornata civile. Ricalcola la carta.');
  const segments = input.segments.map(segment => ({ start: metadataTime(segment?.start), end: metadataTime(segment?.end, { end: true }) }));
  if (segments.some((segment, index) => segment.start >= segment.end || (index > 0 && segment.start < segments[index - 1].end))) throw invalidChart('Gli intervalli della giornata civile non sono ordinati o si sovrappongono.');
  const start = metadataTime(input.start), end = metadataTime(input.end, { end: true });
  const duration = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  if (start !== segments[0].start || end !== segments.at(-1).end || duration > 3 * DAY || !segments.some(segment => utc >= segment.start && utc < segment.end)) throw invalidChart('L’istante rappresentativo e la giornata civile non sono coerenti.');
  return { start: iso(start), end: iso(end), durationHours: duration / 3600000, partialDay: input.partialDay === true, segments: segments.map(segment => ({ start: iso(segment.start), end: iso(segment.end) })) };
}
function moonSign(chart) {
  const moon = chart.planets?.find?.(planet => planet?.key === 'moon');
  if (!moon) throw invalidChart('La carta non contiene la posizione della Luna.');
  let indices;
  if (Object.hasOwn(moon, 'possibleSignIndices')) {
    if (!Array.isArray(moon.possibleSignIndices) || !moon.possibleSignIndices.length || !moon.possibleSignIndices.every(validSign)) throw invalidChart('I segni possibili della Luna non sono validi.');
    indices = unique(moon.possibleSignIndices);
    if (validSign(moon.signIndex) && !indices.includes(moon.signIndex)) throw invalidChart('Il segno della Luna e le sue alternative non sono coerenti.');
  } else {
    if (!validSign(moon.signIndex)) throw invalidChart('La carta non contiene un segno lunare valido.');
    indices = [moon.signIndex];
  }
  const certain = indices.length === 1 && moon.signCertain !== false;
  const options = indices.map(signIndex => ({ signIndex, key: SIGNS[signIndex].key, label: SIGNS[signIndex].name }));
  return { certain, signIndex: certain ? indices[0] : null, key: certain ? options[0].key : null, label: certain ? options[0].label : 'Segno lunare da confermare', possibleSignIndices: indices, options };
}
function appearance(calendar, time) {
  const event = calendar.mainEvents.find(item => Date.parse(item.date) === time);
  const key = event?.key ?? APPEARANCES[Math.floor(calendar.phaseAngle / 90)];
  return { key, label: LABELS[key] };
}

function contentFor(key, phaseContent) {
  const source = phaseContent?.[key];
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const content = {};
  for (const field of ['title', 'introduction', 'alchemyNote', 'question', 'practice']) if (typeof source[field] === 'string') content[field] = source[field];
  content.arcana = unique(Array.isArray(source.arcana) ? source.arcana.filter(number => Number.isInteger(number) && TAROT_CARDS.some(card => card.number === number)) : []);
  content.plants = (Array.isArray(source.plants) ? source.plants : []).filter(plant => typeof plant?.scientificName === 'string' && typeof plant?.commonName === 'string').map(plant => {
    const result = {};
    for (const field of ['commonName', 'scientificName', 'noteBotanicaBreve', 'editorialAssociation']) if (typeof plant[field] === 'string') result[field] = plant[field];
    try { const url = new URL(plant.sourceUrl); if (url.protocol === 'https:') result.sourceUrl = url.href; } catch { /* An absent source never becomes a guessed URL. */ }
    return result;
  });
  return content;
}
function phaseCard(phase, card) {
  return {
    card, reasons: [`${phase.conditional ? 'Se la nascita cade nel settore' : 'Settore'} «${phase.label}» / ${phase.alchemyLabel}: accostamento editoriale di Lavanda.`],
    conditional: phase.conditional, conditions: [{ kind: 'phase-editorial', phaseKey: phase.key, conditional: phase.conditional }],
  };
}
function cardsFor(phases, signs) {
  const cards = new Map();
  const add = (card, text, condition) => {
    const item = cards.get(card) ?? { card, reasons: [], conditional: true, conditions: [] };
    if (!item.reasons.includes(text)) { item.reasons.push(text); item.conditions.push(condition); }
    item.conditional = item.conditional && condition.conditional;
    cards.set(card, item);
  };
  for (const phase of phases) for (const card of phase.content?.arcana ?? []) {
    const item = phaseCard(phase, card);
    add(card, item.reasons[0], item.conditions[0]);
  }
  for (const sign of signs.options) {
    const card = SIGN_ARCANA[sign.signIndex];
    add(card, `${signs.certain ? 'Luna in' : 'Se la Luna era in'} ${sign.label} → ${TAROT_CARDS[card].name}: corrispondenza tradizionale Golden Dawn.`, { kind: 'sign-traditional', signIndex: sign.signIndex, conditional: !signs.certain });
  }
  add(2, 'Luna → La Papessa: corrispondenza planetaria tradizionale Golden Dawn.', { kind: 'moon-planetary', conditional: false });
  return [...cards.values()];
}

function unknownTimeline(day, initial, engine) {
  const calendars = [initial], spans = [], appearances = new Map();
  const addAppearance = (key, interval, date) => {
    const item = appearances.get(key) ?? { key, label: LABELS[key], intervals: [], eventDates: [] };
    if (interval) item.intervals.push({ startDate: iso(interval.start), endDate: iso(interval.end) });
    if (date !== undefined && !item.eventDates.includes(iso(date))) item.eventDates.push(iso(date));
    appearances.set(key, item);
  };
  for (const segment of day.segments) {
    const start = Date.parse(segment.start), end = Date.parse(segment.end);
    let cursor = start;
    while (cursor < end) {
      let calendar = calendars.find(item => cursor >= Date.parse(item.startDate) && cursor < Date.parse(item.endDate));
      if (!calendar) { calendar = computeLunarCalendar(cursor, { engine, samplesPerSector: 2 }); calendars.push(calendar); }
      const stop = Math.min(end, Date.parse(calendar.endDate));
      for (const phase of calendar.sectors) {
        const from = Math.max(cursor, Date.parse(phase.startDate)), to = Math.min(stop, Date.parse(phase.endDate));
        if (from >= to) continue;
        spans.push({ phase, start: from, end: to });
        let continuousStart = from;
        if (phase.index % 2 === 0 && from === Date.parse(phase.startDate)) {
          addAppearance(phase.key, null, from);
          // A principal phase is an instant; reserve its representable Date, not a quarter-cycle.
          continuousStart++;
        }
        if (continuousStart < to) addAppearance(APPEARANCES[Math.floor(phase.index / 2)], { start: continuousStart, end: to });
      }
      cursor = stop;
    }
  }
  return { spans, appearances: [...appearances.values()] };
}

/** Same apparent tropical longitude used by natal-engine, never a heliocentric substitute. */
function signIntervals(day, engine) {
  if (typeof engine?.GeoVector !== 'function' || typeof engine?.Ecliptic !== 'function') throw new SolarError('MISSING_ENGINE', 'Il motore non può verificare i passaggi del segno lunare.');
  const signAt = time => {
    const longitude = engine.Ecliptic(engine.GeoVector('Moon', new Date(time), true))?.elon;
    if (!Number.isFinite(longitude)) throw new SolarError('INVALID_EPHEMERIS', 'La longitudine apparente della Luna non è valida.');
    return Math.floor(((longitude % 360) + 360) % 360 / 30);
  };
  const intervals = [];
  for (const segment of day.segments) {
    const start = Date.parse(segment.start), end = Date.parse(segment.end);
    let from = start, previous = start, index = signAt(start);
    while (previous < end - 1) {
      const sample = Math.min(previous + 3600000, end - 1), next = signAt(sample);
      if (next !== index) {
        let before = previous, after = sample;
        while (after - before > 1) {
          const middle = Math.floor((before + after) / 2);
          if (signAt(middle) === index) before = middle; else after = middle;
        }
        intervals.push({ start: from, end: after, signIndex: index });
        from = after; index = next;
      }
      previous = sample;
    }
    intervals.push({ start: from, end, signIndex: index });
  }
  return intervals;
}

/** Personal lunar data, without a clock, DOM, predictions, houses or aspects. */
export function buildNatalLunarReading(chart, { engine: candidate, phaseContent = {} } = {}) {
  if (!chart || typeof chart !== 'object' || typeof chart.meta?.utc !== 'string' || !chart.meta.utc.trim()) throw invalidChart('La carta non contiene un istante UTC autorevole. Ricalcola la carta.');
  const engine = candidate ?? globalThis.Astronomy;
  const calendar = computeLunarCalendar(chart.meta.utc, { engine, samplesPerSector: 2 });
  const utc = calendar.date, time = Date.parse(utc);
  const unknownTime = chart.unknownTime === true || chart.meta.unknownTime === true || chart.meta.representativeTime === true;
  const day = unknownTime ? localDay(chart, time) : null, signs = moonSign(chart);
  const current = calendar.sectors[calendar.currentSectorIndex], physical = appearance(calendar, time);
  const timeline = unknownTime ? unknownTimeline(day, calendar, engine) : null;
  const spans = timeline?.spans ?? [{ phase: current, start: time, end: time }];
  const phaseMap = new Map();
  for (const span of spans) {
    const item = phaseMap.get(span.phase.key) ?? {
      key: span.phase.key, label: span.phase.label, angle: span.phase.angle,
      alchemyKey: span.phase.alchemyKey, alchemyLabel: span.phase.alchemyLabel,
      startDate: span.phase.startDate, endDate: span.phase.endDate,
      from: span.phase.startDate, end: span.phase.endDate, intervals: [],
      content: contentFor(span.phase.key, phaseContent),
    };
    if (unknownTime) item.intervals.push({ startDate: iso(span.start), endDate: iso(span.end) });
    phaseMap.set(item.key, item);
  }
  const phaseOptions = [...phaseMap.values()].map(item => ({ ...item, conditional: phaseMap.size > 1 }));
  for (const phase of phaseOptions) {
    phase.cards = (phase.content?.arcana ?? []).map(card => phaseCard(phase, card));
    phase.plants = (phase.content?.plants ?? []).map(plant => ({ ...plant, conditional: phase.conditional, phaseKeys: [phase.key] }));
  }
  const appearances = timeline?.appearances ?? [{ ...physical, intervals: [], eventDates: calendar.mainEvents.some(event => Date.parse(event.date) === time) ? [utc] : [] }];
  const appearanceCertain = appearances.length === 1, sectorCertain = phaseOptions.length === 1;
  const alchemyOptions = [...new Map(phaseOptions.map(phase => [phase.alchemyKey, { key: phase.alchemyKey, label: phase.alchemyLabel }])).values()];
  const plants = new Map();
  for (const phase of phaseOptions) for (const plant of phase.plants) {
    const identity = plant.scientificName.trim().toLocaleLowerCase('it');
    const item = plants.get(identity) ?? { ...plant, phaseKeys: [], associations: [] };
    if (!item.phaseKeys.includes(phase.key)) {
      item.phaseKeys.push(phase.key);
      item.associations.push({ phaseKey: phase.key, editorialAssociation: plant.editorialAssociation ?? '' });
    }
    plants.set(identity, item);
  }
  for (const plant of plants.values()) plant.conditional = plant.phaseKeys.length < phaseOptions.length;
  let alternatives = [];
  if (unknownTime) {
    const intervals = signIntervals(day, engine);
    if (intervals.some(interval => !signs.possibleSignIndices.includes(interval.signIndex))) throw invalidChart('I segni possibili della carta non coprono l’intera giornata calcolata.');
    alternatives = spans.flatMap(span => intervals.flatMap(interval => {
      const from = Math.max(span.start, interval.start), to = Math.min(span.end, interval.end);
      return from < to ? [{ phaseKey: span.phase.key, alchemyKey: span.phase.alchemyKey, signIndex: interval.signIndex, signKey: SIGNS[interval.signIndex].key, startDate: iso(from), endDate: iso(to) }] : [];
    }));
  }
  const notices = [];
  if (unknownTime) notices.push('Ora sconosciuta: le possibilità appartengono agli intervalli effettivi della giornata civile; l’istante rappresentativo non è l’ora della nascita.');
  if (day?.partialDay) notices.push('La giornata è parziale: sono considerati soltanto gli intervalli già trascorsi indicati dalla carta, senza estenderli al futuro.');
  if (phaseOptions.some(phase => phase.content === null)) notices.push('I contenuti editoriali delle fasi non sono ancora disponibili; nessun Arcano di fase o pianta viene inventato.');
  return {
    utc, unknownTime,
    phase: {
      certain: appearanceCertain, key: appearanceCertain ? appearances[0].key : null, label: appearanceCertain ? appearances[0].label : 'Fase lunare da confermare', options: appearances,
      sectorCertain, sectorKey: sectorCertain ? phaseOptions[0].key : null, sectorLabel: sectorCertain ? phaseOptions[0].label : 'Settore lunare da confermare',
      phaseAngle: unknownTime ? null : calendar.phaseAngle, illuminatedFraction: unknownTime ? null : calendar.illuminatedFraction,
    },
    phaseOptions,
    alchemy: { certain: alchemyOptions.length === 1, key: alchemyOptions.length === 1 ? alchemyOptions[0].key : null, label: alchemyOptions.length === 1 ? alchemyOptions[0].label : 'Passaggio alchemico da confermare', options: alchemyOptions, convention: 'lavanda-editorial' },
    moonSign: signs, cards: cardsFor(phaseOptions, signs), plants: [...plants.values()], alternatives,
    representative: unknownTime ? { utc, label: 'Istante rappresentativo della giornata; non è l’ora della nascita.', phaseAngle: calendar.phaseAngle, illuminatedFraction: calendar.illuminatedFraction, appearanceKey: physical.key, appearanceLabel: physical.label, sectorKey: current.key, sectorLabel: current.label, alchemyKey: current.alchemyKey, alchemyLabel: current.alchemyLabel } : null,
    lunation: { startDate: calendar.startDate, endDate: calendar.endDate, durationDays: calendar.durationDays, frame: calendar.frame, origin: calendar.origin },
    localDay: day, notices,
  };
}
