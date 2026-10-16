import { PLANETS } from './natal-engine.js';
import { SOLAR_BODIES, SolarError, computeSolarSystem } from './solar-engine.js';

const solarKeys = new Set(SOLAR_BODIES.map(body => body.key));
const sharedKeys = new Set(PLANETS.map(planet => planet.key).filter(key => solarKeys.has(key)));
const normalizedKey = key => typeof key === 'string' ? key.trim().toLowerCase() : null;
const utcFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** No astrological Earth, no invented 3D Pluto, and no sign/angle substitution. */
export function natalSelectionToSolarBody(selection) {
  const key = normalizedKey(selection?.key);
  return selection?.type === 'planet' && sharedKeys.has(key) ? key : null;
}

/** Reuse the natal chart's existing reading and Arcana for a shared body. */
export function solarBodyToNatalSelection(bodyKey) {
  const key = normalizedKey(bodyKey);
  return sharedKeys.has(key) ? { type: 'planet', key } : null;
}

/**
 * An inert snapshot: no timer and no date/timezone reconstruction from form data.
 * The engine-resolved UTC instant remains authoritative, including DST choices.
 */
export function createNatalSolarModel(chart, { engine } = {}) {
  if (!chart || typeof chart !== 'object' || typeof chart.meta?.utc !== 'string' || !chart.meta.utc.trim()) throw new SolarError('INVALID_NATAL_CHART', 'La carta non contiene un istante UTC calcolato. Ricalcola la carta prima di aprire il modello.');
  // Fail closed if an adapted wrapper and engine metadata disagree about certainty.
  const unknownTime = chart.unknownTime === true || chart.meta.unknownTime === true || chart.meta.representativeTime === true;
  const state = computeSolarSystem(chart.meta.utc, { engine });
  const dateLabel = `${unknownTime ? 'Istante rappresentativo' : 'Istante della carta'} · ${utcFormatter.format(new Date(state.date))} UTC`;
  const notice = unknownTime
    ? 'Ora sconosciuta: il modello è fermo all’istante rappresentativo scelto per la giornata calcolata. Non mostra l’ora esatta della nascita e non risolve i segni incerti. Le letture e gli Arcani conservano le possibilità e i limiti della carta del giorno.'
    : 'Il modello è fermo all’istante UTC della tua carta calcolata. I corpi condivisi aprono le stesse letture e gli stessi Arcani della ruota.';
  return {
    state,
    meta: {
      title: unknownTime ? 'Il sistema solare nel tuo giorno.' : 'Il sistema solare alla tua nascita.',
      utc: state.date,
      dateLabel,
      unknownTime,
      representativeTime: unknownTime,
      paused: true,
      notice,
      frameNotice: 'Il 3D usa posizioni geometriche eliocentriche nell’eclittica J2000; la ruota usa posizioni apparenti geocentriche nell’eclittica della data. L’istante è lo stesso, i riferimenti sono diversi.',
      selectionNotice: 'La Terra è un riferimento del modello, senza una posizione astrologica nella ruota. Plutone resta disponibile nella ruota e nelle letture; segni e angoli non vengono sostituiti con corpi del 3D.',
    },
  };
}
