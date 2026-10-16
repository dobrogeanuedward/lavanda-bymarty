import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as engine from 'astronomy-engine';
import {calculateChart} from '../src/natal-engine.js';
import {buildNatalLunarReading} from '../src/natal-lunar-reading.js';
import {personalNarrative} from '../src/natal-personal.js';
import {escapeHTML} from '../src/natal-visuals.js';
const phaseContent=JSON.parse(await readFile(new URL('../content/lunar-phases.json',import.meta.url)));
const voices=JSON.parse(await readFile(new URL('../content/natal-lunar-voices.json',import.meta.url)));
const options={engine,now:new Date('2026-10-16T12:00:00Z')};
const modelFor=input=>buildNatalLunarReading(calculateChart({date:'1990-05-10',time:'14:30',timezone:'Europe/Rome',latitude:41.9028,longitude:12.4964,...input},options),{engine,phaseContent});

test('the complete birth narrative connects the measured Moon, alchemy, cards and plants',()=>{
 const narrative=personalNarrative(modelFor({}),voices);
 for(const value of ['Scorpione','Gibbosa calante','Citrinitas','La Morte','Il Sole','narciso selvatico','lavanda vera'])assert.ok(narrative.includes(value),value);
 assert.ok(narrative.includes(escapeHTML(voices.scorpio.bridge.citrinitas)));
});

test('uncertain birth narrative uses only sign and alchemy pairings that actually occurred',()=>{
 const narrative=personalNarrative(modelFor({date:'2024-01-25',unknownTime:true}),voices);
 for(const text of [voices.cancer.bridge.albedo,voices.leo.bridge.albedo,voices.leo.bridge.citrinitas])assert.ok(narrative.includes(escapeHTML(text)));
 assert.ok(!narrative.includes(escapeHTML(voices.cancer.bridge.citrinitas)),'the impossible full-Moon/Cancer pairing must not appear');
 assert.match(narrative,/Se la nascita cade in questo tratto/);
});

test('stable alchemy with uncertain Moon signs preserves both conditional voices',()=>{
 const narrative=personalNarrative(modelFor({date:'2024-01-14',timezone:'UTC',unknownTime:true}),voices);
 for(const key of ['aquarius','pisces'])assert.ok(narrative.includes(escapeHTML(voices[key].bridge.nigredo)));
 assert.match(narrative,/Se la Luna fosse in Acquario/);
 assert.match(narrative,/Se la Luna fosse in Pesci/);
});
