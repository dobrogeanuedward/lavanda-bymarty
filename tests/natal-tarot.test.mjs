import test from 'node:test';
import assert from 'node:assert/strict';
import { TAROT_CARDS, SIGN_ARCANA, TAROT_METHOD, TAROT_SOURCES, recommendArcana } from '../src/natal-tarot.js';

const point = (key, signIndex, extra = {}) => ({ key, name: key === 'sun' ? 'Sole' : key === 'moon' ? 'Luna' : key, longitude: signIndex * 30 + 12, signIndex, degree: 12, ...extra });

test('all 22 cards have original reflection content and a traceable correspondence', () => {
  assert.equal(TAROT_CARDS.length, 22);
  assert.deepEqual(TAROT_CARDS.map(card => card.number), Array.from({ length: 22 }, (_, number) => number));
  assert.equal(new Set(TAROT_CARDS.map(card => card.name)).size, 22);
  for (const card of TAROT_CARDS) {
    for (const field of ['roman', 'name', 'keyword', 'description', 'question', 'practice', 'glyph', 'color']) assert.equal(typeof card[field], 'string', `${card.number}.${field}`);
    assert.ok(card.description.length > 100);
    assert.ok(card.question.endsWith('?'));
    assert.ok(card.practice.length > 45);
    assert.match(card.color, /^#[A-Fa-f0-9]{6}$/);
    assert.equal(card.correspondence.source, 'Golden Dawn');
    assert.equal(card.correspondence.url, TAROT_SOURCES[0].url);
    assert.ok([3, 4].includes(card.correspondence.page));
  }
  assert.match(TAROT_METHOD.curation, /non misura dominanti/);
  assert.match(TAROT_METHOD.tradition, /distinte dal calcolo/);
});

test('Golden Dawn major correspondences follow the verified RWS table, including VIII and XI', () => {
  // Benebell Wen, Holistic Tarot supplement, printed pp. 3–4.
  const expected = [
    ['element', 'air'], ['planet', 'mercury'], ['planet', 'moon'], ['planet', 'venus'],
    ['sign', 'aries'], ['sign', 'taurus'], ['sign', 'gemini'], ['sign', 'cancer'],
    ['sign', 'leo'], ['sign', 'virgo'], ['planet', 'jupiter'], ['sign', 'libra'],
    ['element', 'water'], ['sign', 'scorpio'], ['sign', 'sagittarius'], ['sign', 'capricorn'],
    ['planet', 'mars'], ['sign', 'aquarius'], ['sign', 'pisces'], ['planet', 'sun'],
    ['element', 'fire'], ['planet', 'saturn'],
  ];
  assert.deepEqual(TAROT_CARDS.map(card => [card.correspondence.type, card.correspondence.key]), expected);
  assert.equal(TAROT_CARDS[8].roman, 'VIII'); assert.equal(TAROT_CARDS[8].name, 'La Forza');
  assert.equal(TAROT_CARDS[11].roman, 'XI'); assert.equal(TAROT_CARDS[11].name, 'La Giustizia');
  assert.deepEqual(SIGN_ARCANA, [4, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 18]);
  for (const [index, number] of SIGN_ARCANA.entries()) assert.equal(TAROT_CARDS[number].correspondence.type, 'sign', index);
});

test('Sole, Luna and Ascendente lead a maximum of five recommendations with exact reasons', () => {
  const chart = { planets: [point('sun', 0), point('moon', 3), point('mercury', 5), point('mars', 7)], ascendant: { signIndex: 4 }, timeKnown: true };
  const result = recommendArcana(chart);
  assert.deepEqual(result.map(item => item.card.number), [4, 7, 8, 19, 2]);
  assert.deepEqual(result.map(item => item.score), [3, 2, 2, 1, 1]);
  assert.match(result[0].reasons[0], /Sole in Ariete/);
  assert.match(result[1].reasons[0], /Luna in Cancro/);
  assert.match(result[2].reasons[0], /Ascendente in Leone/);
  assert.equal(result[3].reasons[0], 'Corrispondenza planetaria del Sole');
  assert.equal(result[4].reasons[0], 'Corrispondenza planetaria della Luna');
  assert.ok(result.every(item => item.reasons.every(reason => reason.length < 75 && !/punti|Priorità|curatoriale/i.test(reason))));
  assert.ok(!result.some(item => [9, 13].includes(item.card.number)));
});

test('coincident sign cards are deduplicated while each origin remains visible', () => {
  const result = recommendArcana({ planets: [point('sun', 5), point('moon', 5)], ascendant: { signIndex: 5 } });
  assert.deepEqual(result.map(item => item.card.number), [9, 19, 2]);
  assert.equal(result[0].score, 7);
  assert.equal(result[0].reasons.length, 3);
  assert.ok(result[0].reasons.some(reason => reason.startsWith('Sole')));
  assert.ok(result[0].reasons.some(reason => reason.startsWith('Luna')));
  assert.ok(result[0].reasons.some(reason => reason.startsWith('Ascendente')));
});

test('unknown birth time excludes the Ascendente and an ambiguous lunar sign is skipped', () => {
  const chart = { planets: [point('sun', 0, { possibleSignIndices: [0] }), point('moon', 11, { possibleSignIndices: [11, 0] })], ascendant: { signIndex: 4 }, timeKnown: false };
  const result = recommendArcana(chart);
  assert.deepEqual(result.map(item => item.card.number), [4, 19]);
  assert.ok(result.every(item => item.reasons.every(reason => !reason.includes('Ascendente') && !reason.includes('Luna'))));
  assert.deepEqual(recommendArcana({ ...chart, timeKnown: true, unknownTime: true }).map(item => item.card.number), [4, 19]);
});

test('a sign that remains certain across possible times is usable without claiming a known time', () => {
  const result = recommendArcana({ planets: [point('moon', 1, { possibleSignIndices: [1] })], timeKnown: false });
  assert.deepEqual(result.map(item => item.card.number), [5, 2]);
  assert.match(result[0].reasons[0], /Luna in Toro/);
  const conflicting = recommendArcana({ planets: [point('sun', 0, { possibleSignIndices: [1] })] });
  assert.deepEqual(conflicting, []);
});

test('no dominant is inferred from other planets or a concentration in one sign', () => {
  const crowded = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(key => point(key, 1));
  assert.deepEqual(recommendArcana({ planets: crowded }), []);
  const withSun = recommendArcana({ planets: [point('sun', 2), ...crowded] });
  assert.deepEqual(withSun.map(item => item.card.number), [6, 19]);
});

test('invalid or absent signs cannot create a reading and input data is not mutated', () => {
  for (const chart of [null, undefined, {}, { planets: [] }, { planets: [point('sun', -1), point('moon', 12)] }, { planets: [point('sun', 1.5)] }, { planets: [point('moon', 1, { possibleSignIndices: [] })] }, { planets: [point('sun', 1, { possibleSignIndices: [1, null] })] }]) assert.deepEqual(recommendArcana(chart), []);
  const chart = { planets: [point('sun', 0), point('moon', 11)] };
  const before = structuredClone(chart), result = recommendArcana(chart);
  assert.deepEqual(chart, before);
  result[0].reasons.push('Local UI note');
  assert.ok(recommendArcana(chart).every(item => !item.reasons.includes('Local UI note')));
  assert.ok(Object.isFrozen(TAROT_CARDS) && Object.isFrozen(TAROT_CARDS[0]) && Object.isFrozen(TAROT_CARDS[0].correspondence));
});

test('English engine keys and keyed planet collections follow the same interface', () => {
  const array = recommendArcana({ planets: [point('Sun', 9), point('Moon', 10)] });
  const keyed = recommendArcana({ planets: { sun: { signIndex: 9 }, moon: { signIndex: 10 } } });
  assert.deepEqual(keyed.map(item => item.card.number), array.map(item => item.card.number));
  assert.deepEqual(array.map(item => item.card.number), [15, 17, 19, 2]);
});
