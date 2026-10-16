import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { SIGNS, PLANETS, calculateChart } from '../src/natal-engine.js';
import { describeSelection } from '../src/natal-reading.js';

const point = (key, signIndex, extra = {}) => ({ key, name: PLANETS.find(item => item.key === key)?.name, longitude: signIndex * 30 + 12, degree: 12, signIndex, signCertain: true, ...extra });
const houses = (ascendant = 3) => SIGNS.map((_, signIndex) => ({ number: ((signIndex - ascendant + 12) % 12) + 1, signIndex, longitude: signIndex * 30 }));
const fixture = () => ({
  meta: { unknownTime: false, houseSystem: 'whole-sign' },
  planets: [point('sun', 0), point('moon', 6), point('mercury', 2), point('venus', 3), point('saturn', 8), point('neptune', 11, { signCertain: false, possibleSignIndices: [11, 0] })],
  houses: houses(), ascendant: { signIndex: 3 }, midheaven: { signIndex: 11 },
  aspects: [
    { from: 'sun', to: 'moon', type: 'opposition', orb: 4 },
    { from: 'venus', to: 'sun', type: 'square', orb: 1.2 },
    { from: 'sun', to: 'saturn', type: 'trine', orb: 0.2 },
    { from: 'mercury', to: 'sun', type: 'sextile', orb: 0.8 },
    { from: 'sun', to: 'neptune', type: 'conjunction', orb: 0.1 },
    { from: 'sun', to: 'absent', type: 'conjunction', orb: 0 },
    { from: 'sun', to: 'moon', type: 'invented', orb: 0 },
    { from: 'sun', to: 'moon', type: 'conjunction', orb: Number.NaN },
  ],
});
const allStrings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(allStrings) : [];
const prose = panel => allStrings(panel).join(' ');
const houseSections = panel => panel.sections.filter(section => section.title.startsWith('Casa '));
const aspectSections = panel => panel.sections.filter(section => /^(Congiunzione|Opposizione|Quadratura|Trigono|Sestile) con /.test(section.title));

test('real charts provide complete plain-text panels below 500 words with usable related selections', () => {
  const chart = calculateChart({ date: '2000-01-01', time: '12:00', timezone: 'Europe/Rome', latitude: 41.8919, longitude: 12.5113 }, { engine: Astronomy });
  const before = structuredClone(chart);
  const selections = [...PLANETS.map(planet => ({ type: 'planet', key: planet.key })), ...SIGNS.map(sign => ({ type: 'sign', key: sign.key })), { type: 'angle', key: 'ascendant' }, { type: 'angle', key: 'midheaven' }];
  for (const selection of selections) {
    const panel = describeSelection(chart, selection);
    assert.equal(panel.type, selection.type);
    assert.equal(panel.key, selection.key);
    for (const field of ['title', 'kicker', 'intro']) assert.equal(typeof panel[field], 'string');
    assert.ok(panel.intro.length > 100);
    assert.match(panel.kicker, /originale di Lavanda/);
    assert.ok(panel.sections.length >= 2);
    assert.ok(panel.questions.length >= 2 && panel.questions.length <= 3);
    assert.ok(panel.questions.every(question => question.endsWith('?')));
    assert.ok(panel.sections.every(section => typeof section.title === 'string' && typeof section.text === 'string'));
    assert.ok(prose(panel).split(/\s+/).length < 500, `${selection.type}:${selection.key}`);
    assert.ok(allStrings(panel).every(text => !/[<>]/.test(text)));
    assert.equal(new Set(panel.cards.map(item => item.card)).size, panel.cards.length);
    assert.equal(new Set(panel.related.map(item => `${item.type}:${item.key}`)).size, panel.related.length);
    for (const related of panel.related) {
      const next = describeSelection(chart, related);
      assert.ok(next, `${selection.key} → ${related.type}:${related.key}`);
      assert.equal(next.key, related.key);
    }
  }
  assert.deepEqual(chart, before);
});

test('planet readings use the three closest actual aspects and retain each other principle', () => {
  const panel = describeSelection(fixture(), { type: 'planet', key: 'sun' });
  const aspects = aspectSections(panel);
  assert.deepEqual(aspects.map(section => section.title), ['Trigono con Saturno', 'Sestile con Mercurio', 'Quadratura con Venere']);
  assert.match(aspects[0].text, /tempo e responsabilità/);
  assert.match(aspects[1].text, /linguaggio e scambio/);
  assert.match(aspects[2].text, /valore e incontro/);
  assert.match(aspects[0].text, /0,2°/);
  assert.ok(aspects.every(section => section.text.includes('?')));
  assert.ok(!aspects.some(section => /Nettuno|assente|invented/.test(section.title)));
  assert.deepEqual(houseSections(panel).map(section => section.title.split(' · ')[0]), ['Casa 10']);
  assert.deepEqual(panel.cards.map(item => item.card), [4, 19]);
  assert.equal(panel.related.find(item => item.type === 'sign').key, 'aries');
});

test('seven classical planetary Arcana are distinct from sign cards and outer planets receive no invented correspondence', () => {
  const classical = { sun: 19, moon: 2, mercury: 1, venus: 3, mars: 16, jupiter: 10, saturn: 21 };
  for (const [key, number] of Object.entries(classical)) {
    const panel = describeSelection({ planets: [point(key, 0)] }, { type: 'planet', key });
    assert.deepEqual(panel.cards.map(item => item.card), [4, number]);
    assert.match(panel.cards[1].reason, /Corrispondenza planetaria.*Golden Dawn/);
  }
  for (const key of ['uranus', 'neptune', 'pluto']) {
    const panel = describeSelection({ planets: [point(key, 0)] }, { type: 'planet', key });
    assert.deepEqual(panel.cards.map(item => item.card), [4]);
    assert.match(panel.caveat, /non riceve qui una corrispondenza planetaria diretta Golden Dawn/);
    assert.match(panel.caveat, /scelta simbolica di Lavanda/);
  }
});

test('unknown time keeps uncertain signs conditional and rejects stale houses, angles and aspects', () => {
  const chart = { ...fixture(), unknownTime: false, meta: { unknownTime: true } };
  chart.planets = [point('sun', 0, { possibleSignIndices: [0] }), point('moon', null, { signCertain: false, possibleSignIndices: [11, 0], retrograde: null })];
  const moon = describeSelection(chart, { type: 'planet', key: 'moon' });
  assert.match(moon.title, /segno resta aperto/);
  assert.ok(moon.sections.some(section => section.title === 'Se la Luna fosse in Pesci'));
  assert.ok(moon.sections.some(section => section.title === 'Se la Luna fosse in Ariete'));
  assert.deepEqual(moon.cards.map(item => item.card), [18, 4]);
  assert.ok(moon.cards.every(item => item.reason.startsWith('Se la Luna fosse')));
  assert.equal(houseSections(moon).length, 0);
  assert.equal(aspectSections(moon).length, 0);
  assert.ok(!moon.sections.some(section => section.title.startsWith('Moto apparente')));
  assert.match(moon.caveat, /Ora sconosciuta/);
  const sun = describeSelection(chart, { type: 'planet', key: 'sun' });
  assert.equal(sun.title, 'Sole in Ariete');
  assert.deepEqual(sun.cards.map(item => item.card), [4, 19]);
  assert.equal(houseSections(sun).length, 0);
  assert.equal(aspectSections(sun).length, 0);
  assert.match(sun.caveat, /nell’intervallo della giornata/);
  const aries = describeSelection(chart, { type: 'sign', key: 'aries' });
  assert.match(aries.sections.find(section => section.title === 'Le presenze nella carta').text, /Sole/);
  assert.match(aries.sections.find(section => section.title.startsWith('Presenze possibili')).text, /Luna.*potrebbe/);
  assert.equal(houseSections(aries).length, 0);
  assert.ok(!aries.related.some(item => item.type === 'angle'));
  assert.deepEqual(describeSelection(chart, { type: 'angle', key: 'ascendant' }).cards, []);
  assert.equal(aspectSections(describeSelection({ ...fixture(), meta: undefined, unknownTime: true }, { type: 'planet', key: 'sun' })).length, 0);
});

test('the real equinox day remains a pair of possibilities rather than a certain solar sign', () => {
  const chart = calculateChart({ date: '2024-03-20', timezone: 'Europe/Rome', latitude: 41.8919, longitude: 12.5113, unknownTime: true }, { engine: Astronomy });
  const sun = describeSelection(chart, { type: 'planet', key: 'sun' });
  assert.match(sun.title, /segno resta aperto/);
  assert.deepEqual(sun.cards.map(item => item.card), [18, 4]);
  assert.ok(sun.cards.every(item => item.reason.startsWith('Se il Sole fosse')));
  assert.ok(prose(sun).split(/\s+/).length < 500);
  assert.equal(houseSections(sun).length, 0);
  assert.equal(aspectSections(sun).length, 0);
});

test('retrograde prose requires an actual boolean and describes motion without a fixed outcome', () => {
  for (const retrograde of [undefined, null, 'true', 0]) {
    const panel = describeSelection({ planets: [point('saturn', 1, { retrograde })] }, { type: 'planet', key: 'saturn' });
    assert.ok(!panel.sections.some(section => section.title.startsWith('Moto apparente')));
  }
  for (const retrograde of [true, false]) {
    const panel = describeSelection({ planets: [point('saturn', 1, { retrograde })] }, { type: 'planet', key: 'saturn' });
    const motion = panel.sections.find(section => section.title.startsWith('Moto apparente'));
    assert.equal(motion.title, retrograde ? 'Moto apparente retrogrado' : 'Moto apparente diretto');
    assert.match(motion.text, /senza assegnargli un esito necessario/);
  }
});

test('sign selection accepts numeric or English keys and distinguishes actual planets, possibilities and angles', () => {
  const chart = { planets: [point('sun', 0), point('moon', null, { signCertain: false, possibleSignIndices: [11, 0] })], ascendant: { signIndex: 0 }, midheaven: { signIndex: 11 }, houses: houses() };
  const panel = describeSelection(chart, { type: 'sign', key: 0 });
  assert.deepEqual(panel, describeSelection(chart, { type: 'sign', key: 'ARIES' }));
  assert.equal(panel.key, 'aries');
  assert.match(panel.sections.find(section => section.title === 'Le presenze nella carta').text, /certezza Sole/);
  assert.ok(!panel.sections.find(section => section.title === 'Le presenze nella carta').text.includes('Luna'));
  assert.match(panel.sections.find(section => section.title.startsWith('Presenze possibili')).text, /Luna/);
  assert.match(panel.sections.find(section => section.title === 'I punti di orientamento').text, /Ascendente cade in Ariete/);
  assert.ok(!panel.sections.find(section => section.title === 'I punti di orientamento').text.includes('ruolo pubblico'));
  assert.deepEqual(panel.related.map(item => [item.type, item.key]), [['planet', 'sun'], ['planet', 'moon'], ['angle', 'ascendant']]);
  assert.deepEqual(panel.cards.map(item => item.card), [4]);
  const pisces = describeSelection(chart, { type: 'sign', key: 'pisces' });
  assert.match(pisces.sections.find(section => section.title === 'I punti di orientamento').text, /Medio Cielo cade in Pesci/);
  assert.ok(!pisces.cards[0].reason.startsWith('Se '), 'the actual angle remains certain');
  delete chart.midheaven;
  assert.match(describeSelection(chart, { type: 'sign', key: 'pisces' }).cards[0].reason, /^Se la Luna fosse in Pesci/);
});

test('a sign without occupants does not imply an absent personal quality and all twelve house contexts use actual data', () => {
  const chart = { planets: [], houses: houses() };
  const titles = new Set();
  for (const [index, sign] of SIGNS.entries()) {
    const panel = describeSelection(chart, { type: 'sign', key: sign.key });
    assert.match(panel.sections.find(section => section.title === 'Le presenze nella carta').text, /non indica una mancanza di qualità/);
    const context = houseSections(panel);
    assert.equal(context.length, 1);
    assert.ok(context[0].title.startsWith(`Casa ${((index - 3 + 12) % 12) + 1} · `));
    assert.ok(context[0].text.length > 150);
    titles.add(context[0].title);
    assert.deepEqual(panel.related, []);
  }
  assert.equal(titles.size, 12);
  assert.deepEqual(houseSections(describeSelection({ planets: [] }, { type: 'sign', key: 'aries' })), []);
});

test('angles use actual whole-sign houses and an unavailable point receives no invented position', () => {
  const chart = fixture();
  const mc = describeSelection(chart, { type: 'angle', key: 'mc' });
  assert.equal(mc.key, 'midheaven');
  assert.equal(mc.title, 'Medio Cielo in Pesci');
  assert.deepEqual(houseSections(mc).map(section => section.title.split(' · ')[0]), ['Casa 9']);
  assert.match(mc.caveat, /non viene assunta come decima casa/);
  assert.deepEqual(mc.cards.map(item => item.card), [18]);
  assert.equal(mc.related.find(item => item.type === 'sign').key, 'pisces');
  assert.equal(describeSelection(chart, { type: 'angle', key: 'asc' }).key, 'ascendant');
  for (const unavailable of [{}, { ...chart, unknownTime: true, meta: { unknownTime: true } }]) {
    const panel = describeSelection(unavailable, { type: 'angle', key: 'midheaven' });
    assert.match(panel.title, /non disponibile/);
    assert.deepEqual(panel.cards, []);
    assert.deepEqual(panel.sections, []);
    assert.deepEqual(panel.related, []);
  }
});

test('invalid selections are rejected, names remain curated and each response is independent', () => {
  const chart = fixture();
  for (const selection of [null, {}, { type: 'unknown', key: 'sun' }, { type: 'planet', key: 'constructor' }, { type: 'planet', key: 'absent' }, { type: 'sign', key: -1 }, { type: 'sign', key: 12 }, { type: 'sign', key: 'constructor' }, { type: 'angle', key: '__proto__' }]) assert.equal(describeSelection(chart, selection), null);
  assert.equal(describeSelection(null, { type: 'sign', key: 0 }), null);
  chart.planets[0].name = '<img src=x onerror=alert(1)>';
  chart.houses.push(null, { number: 0, signIndex: 0 }, { number: 13, signIndex: 0 });
  const before = structuredClone(chart), panel = describeSelection(chart, { type: 'planet', key: 'SUN' });
  assert.equal(panel.title, 'Sole in Ariete');
  assert.ok(!prose(panel).includes('<img'));
  assert.deepEqual(chart, before);
  panel.cards[0].reason = 'edited by a consumer';
  panel.sections[0].text = 'edited by a consumer';
  assert.ok(!prose(describeSelection(chart, { type: 'planet', key: 'sun' })).includes('edited by a consumer'));
  for (const extra of [{ possibleSignIndices: [0, null] }, { possibleSignIndices: [] }, { signCertain: false }, { possibleSignIndices: [1] }]) {
    const result = describeSelection({ planets: [point('sun', 0, extra)] }, { type: 'planet', key: 'sun' });
    assert.match(result.title, /segno resta aperto/);
    assert.ok(result.cards.every(item => item.reason.startsWith('Se il Sole fosse')));
    assert.equal(houseSections(result).length, 0);
    assert.equal(aspectSections(result).length, 0);
  }
});
