import test from 'node:test';
import assert from 'node:assert/strict';
import { initWorld } from '../src/world.js';

function environment({ reduced = false, mobile = false } = {}) {
  const globals = ['document', 'matchMedia', 'IntersectionObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'addEventListener', 'innerHeight'];
  const previous = Object.fromEntries(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const classes = new Set(), values = new Map(), events = {}, observers = [], frames = new Map();
  let reads = 0, nextFrame = 0;
  const reveal = { dataset: {}, classList: { add: value => classes.add(value) } };
  const art = { dataset: { worldDepth: '.2' }, setAttribute(name, value) { this[name] = value; }, style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) }, getBoundingClientRect() { reads++; return { top: -900, height: 200 }; } };
  const reduce = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
  const document = { documentElement: { dataset: {} }, hidden: false, body: {}, querySelectorAll(selector) { return selector === '.world-parallax' ? [art] : selector === '[data-world-reveal]' ? [reveal] : [reveal]; }, querySelector() { return {}; }, addEventListener(name, callback) { events[name] = callback; } };
  Object.assign(globalThis, { document, innerHeight: 800, matchMedia: query => query.includes('reduced-motion') ? reduce : { matches: mobile }, addEventListener(name, callback) { events[name] = callback; }, IntersectionObserver: class { constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); } observe(element) { this.observed.push(element); } unobserve(element) { this.observed = this.observed.filter(item => item !== element); } }, MutationObserver: class { observe() {} }, requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } });
  return { document, reduce, reveal, art, classes, values, events, observers, frames, reads: () => reads, runFrame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); }, restore() { for (const [key, descriptor] of Object.entries(previous)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
}

test('reduced motion reveals content immediately and schedules no parallax frames', () => {
  const state = environment({ reduced: true });
  try {
    initWorld();
    assert.equal(state.document.documentElement.dataset.motion, 'off');
    assert.ok(state.classes.has('is-visible'));
    state.observers[1].callback([{ target: state.art, isIntersecting: true }]);
    state.events.scroll();
    assert.equal(state.frames.size, 0);
    assert.equal(state.reads(), 0);
    assert.equal(state.art['aria-hidden'], 'true');
  } finally { state.restore(); }
});

test('parallax coalesces scroll events into one frame and reads only visible artwork', () => {
  const state = environment();
  try {
    initWorld(); state.events.scroll();
    assert.equal(state.frames.size, 0);
    state.observers[1].callback([{ target: state.art, isIntersecting: true }]);
    state.events.scroll(); state.events.scroll();
    assert.equal(state.frames.size, 1);
    state.runFrame();
    assert.equal(state.reads(), 1);
    assert.equal(state.values.get('--world-y'), '46px');
    state.observers[1].callback([{ target: state.art, isIntersecting: false }]);
    state.events.scroll();
    assert.equal(state.frames.size, 0);
    assert.equal(state.art.dataset.worldVisible, 'false');
  } finally { state.restore(); }
});

test('mobile displacement stays small and a changed motion preference cancels pending work', () => {
  const state = environment({ mobile: true });
  try {
    initWorld();
    state.observers[1].callback([{ target: state.art, isIntersecting: true }]); state.runFrame();
    assert.equal(state.values.get('--world-y'), '12px');
    state.events.scroll(); assert.equal(state.frames.size, 1);
    state.reduce.matches = true; state.reduce.change();
    assert.equal(state.frames.size, 0);
    assert.equal(state.values.has('--world-y'), false);
    assert.ok(state.classes.has('is-visible'));
  } finally { state.restore(); }
});
