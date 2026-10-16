import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import {calculateChart} from '../src/natal-engine.js';
import {recommendArcana,TAROT_CARDS} from '../src/natal-tarot.js';
import {chartSVG,cardSVG,separateLabels,formatDegree} from '../src/natal-visuals.js';

test('full natal calculation produces a finite wheel with twelve houses and explained arcana',()=>{
 const chart=calculateChart({date:'2000-01-01',time:'12:00',timezone:'Europe/Rome',latitude:41.8919,longitude:12.5113},{engine:Astronomy});
 const svg=chartSVG(chart);
 assert.doesNotMatch(svg,/NaN|undefined|Infinity/);
 assert.match(svg,/Carta natale:/);assert.match(svg,/>ASC<|>ASC<\/text>/);
 assert.equal(chart.houses.length,12);
 assert.ok(recommendArcana(chart).some(({card,reasons})=>card.number===15&&reasons.some(r=>r.includes('Sole in Capricorno'))));
 assert.match(svg,/♈\uFE0E/,'zodiac glyphs request text presentation, not colored emoji');
});

test('unknown birth time keeps an uncertain Sun out of recommendations and labels the wheel',()=>{
 const chart=calculateChart({date:'2024-03-20',unknownTime:true,timezone:'Europe/Rome',latitude:41.8919,longitude:12.5113},{engine:Astronomy});
 const svg=chartSVG(chart);
 assert.match(svg,/Mappa del giorno a un istante rappresentativo/);
 assert.doesNotMatch(svg,/>ASC<|>MC</);
 assert.ok(chart.planets.find(p=>p.key==='sun').possibleSignIndices.length>1);
 assert.ok(recommendArcana(chart).every(({reasons})=>reasons.every(r=>!r.includes('Sole'))));
});

test('a stellium crossing zero retains the measured longitude of every planet',()=>{
 const input=[358,359,0,1,2].map((longitude,i)=>({key:String(i),longitude}));
 const placed=separateLabels(input);
 for(const planet of input)assert.equal(placed.find(p=>p.key===planet.key).longitude,planet.longitude);
 const angles=placed.map(p=>p.labelLongitude).sort((a,b)=>a-b);
 for(let i=0;i<angles.length;i++)assert.ok(((angles[(i+1)%angles.length]-angles[i]+360)%360)>11.9);
 assert.deepEqual(input.map(p=>p.longitude),[358,359,0,1,2]);
});

test('all twenty-two card studies are distinct and escape text in SVG output',()=>{
 assert.equal(new Set(TAROT_CARDS.map(cardSVG)).size,22);
 const svg=cardSVG({...TAROT_CARDS[0],name:'<script>&"',roman:'<x>'});
 assert.match(svg,/&lt;script&gt;&amp;&quot;/);assert.doesNotMatch(svg,/<script>|<x>/);
});

test('degrees never round across a sign boundary',()=>{
 assert.equal(formatDegree(29.9999),'29° 59′');
 assert.equal(formatDegree(0),'0° 00′');
 assert.equal(formatDegree(null),'—');
});
