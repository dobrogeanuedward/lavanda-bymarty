import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import {calculateChart,SIGNS} from '../src/natal-engine.js';
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

const fixture=()=>calculateChart({date:'2000-01-01',time:'12:00',timezone:'UTC',latitude:51.4779,longitude:0},{engine:Astronomy});
const attr=(markup,name)=>markup.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const groups=svg=>[...svg.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)].map(([,attributes,body])=>({attributes,body,type:attr(attributes,'data-chart-type'),key:attr(attributes,'data-chart-key')}));
const buttons=svg=>groups(svg).filter(group=>attr(group.attributes,'role')==='button');
const lines=markup=>[...markup.matchAll(/<line\b[^>]*\/>/g)].map(match=>({markup:match[0],x1:Number(attr(match[0],'x1')),y1:Number(attr(match[0],'y1')),x2:Number(attr(match[0],'x2')),y2:Number(attr(match[0],'y2'))}));

test('interactive wheel exposes twelve signs, ten planets and two angles as named keyboard buttons',()=>{
 const chart=fixture(),svg=chartSVG(chart,{interactive:true});
 assert.match(svg,/<svg[^>]*role="group"[^>]*aria-label="Ruota interattiva:/);
 const controls=buttons(svg);
 assert.equal(controls.length,24);
 assert.deepEqual(controls.filter(group=>group.type==='sign').map(group=>group.key),SIGNS.map(sign=>sign.key));
 assert.deepEqual(controls.filter(group=>group.type==='angle').map(group=>group.key),['ascendant','midheaven']);
 assert.equal(controls.filter(group=>group.type==='planet').length,10);
 assert.equal(new Set(controls.map(group=>`${group.type}:${group.key}`)).size,24);
 for(const group of controls){
  assert.equal(attr(group.attributes,'tabindex'),'0');
  assert.equal(attr(group.attributes,'aria-pressed'),'false');
  assert.match(attr(group.attributes,'aria-label'),/esplora significato e Arcani/);
  assert.match(attr(group.attributes,'class'),new RegExp(`natal-wheel-${group.type}`));
 }
 assert.equal(attr(controls.find(group=>group.key==='sun').attributes,'aria-label'),'Sole in Capricorno, esplora significato e Arcani');
});

test('default exports and the empty wheel remain static images without interactive attributes',()=>{
 for(const svg of [chartSVG(fixture()),chartSVG(fixture(),{interactive:false,selected:{type:'planet',key:'sun'}}),chartSVG(null,{interactive:true,selected:{type:'sign',key:'aries'}})]){
  assert.match(svg,/<svg[^>]*role="img"/);
  assert.doesNotMatch(svg,/role="button"|tabindex=|aria-pressed=|data-chart-|data-from=|data-to=|natal-wheel-hit|is-selected|is-connected/);
  assert.doesNotMatch(svg,/<script|\son\w+=|javascript:/i);
 }
});

test('planet, sign and angle selections have one pressed control without mutating chart data',()=>{
 const chart=fixture(),snapshot=JSON.stringify(chart);
 for(const selected of [{type:'planet',key:'moon'},{type:'sign',key:'capricorn'},{type:'angle',key:'ascendant'},{type:'angle',key:'midheaven'}]){
  const controls=buttons(chartSVG(chart,{interactive:true,selected}));
  const pressed=controls.filter(group=>attr(group.attributes,'aria-pressed')==='true');
  assert.equal(pressed.length,1);
  assert.equal(pressed[0].type,selected.type);assert.equal(pressed[0].key,selected.key);
  assert.match(pressed[0].attributes,/is-selected/);
 }
 assert.equal(JSON.stringify(chart),snapshot);
 assert.equal(buttons(chartSVG(chart,{interactive:true,selected:{type:'planet',key:'not-a-planet'}})).filter(group=>attr(group.attributes,'aria-pressed')==='true').length,0);
});

test('unknown-time accessible labels describe possible signs and do not invent an Ascendant',()=>{
 const chart=calculateChart({date:'2024-03-20',unknownTime:true,timezone:'Europe/Rome',latitude:41.8919,longitude:12.5113},{engine:Astronomy});
 const controls=buttons(chartSVG(chart,{interactive:true}));
 assert.equal(controls.length,22);assert.equal(controls.filter(group=>group.type==='angle').length,0);
 const sun=controls.find(group=>group.type==='planet'&&group.key==='sun');
 assert.equal(attr(sun.attributes,'aria-label'),'Sole, segni possibili Pesci o Ariete, esplora significato e Arcani');
 assert.match(sun.body,/posizione all’istante rappresentativo/);
 assert.doesNotMatch(sun.attributes,/Sole in Ariete|Sole in Pesci/);
 const polar=calculateChart({date:'2000-01-01',time:'12:00',timezone:'UTC',latitude:90,longitude:0},{engine:Astronomy});
 assert.equal(buttons(chartSVG(polar,{interactive:true})).length,22);
});

test('interaction and selection preserve measured planet ticks, leaders and aspect endpoints across zero',()=>{
 const planets=[358,359,0,1,2].map((longitude,index)=>({key:`p${index}`,name:`Pianeta ${index}`,glyph:'☉',longitude,signIndex:Math.floor(longitude/30),degree:longitude%30}));
 const chart={planets,houses:[],ascendant:{longitude:117,signIndex:3,degree:27},midheaven:{longitude:22,signIndex:0,degree:22},aspects:[{from:'p0',to:'p4',type:'conjunction'}]};
 const renderings=[chartSVG(chart),chartSVG(chart,{interactive:true}),chartSVG(chart,{interactive:true,selected:{type:'planet',key:'p0'}})];
 const measured=renderings.map(svg=>groups(svg).filter(group=>group.body.includes('<title>')).map(group=>lines(group.body).map(({x1,y1,x2,y2})=>[x1,y1,x2,y2])));
 assert.deepEqual(measured[1],measured[0]);assert.deepEqual(measured[2],measured[0]);
 const selectedGroups=buttons(renderings[2]).filter(group=>group.type==='planet');
 const longitudeFromPoint=(x,y)=>((180-Math.atan2(y-320,x-320)*180/Math.PI+117)%360+360)%360;
 for(const group of selectedGroups){
  const planet=planets.find(planet=>planet.key===group.key),tick=lines(group.body)[0];
  assert.ok(Math.abs(((longitudeFromPoint(tick.x1,tick.y1)-planet.longitude+540)%360)-180)<1e-10);
  assert.ok(Math.abs(Math.hypot(tick.x1-320,tick.y1-320)-232)<1e-10);
 }
 const aspectLines=renderings.map(svg=>lines(svg).filter(line=>line.markup.includes('natal-wheel-aspect')).map(({x1,y1,x2,y2})=>[x1,y1,x2,y2]));
 assert.deepEqual(aspectLines[1],aspectLines[0]);assert.deepEqual(aspectLines[2],aspectLines[0]);
 assert.ok(Math.abs(longitudeFromPoint(aspectLines[0][0][0],aspectLines[0][0][1])-358)<1e-10);
});

test('the selected planet retains connected aspect highlights even after the normal eighteen-line cap',()=>{
 const chart=fixture();
 chart.aspects=[...Array.from({length:18},()=>({from:'sun',to:'moon',type:'opposition'})),{from:'uranus',to:'pluto',type:'sextile'}];
 const svg=chartSVG(chart,{interactive:true,selected:{type:'planet',key:'pluto'}});
 const aspects=lines(svg).filter(line=>line.markup.includes('natal-wheel-aspect'));
 assert.equal(aspects.length,18);
 assert.equal(attr(aspects[0].markup,'data-from'),'uranus');
 assert.equal(attr(aspects[0].markup,'data-to'),'pluto');
 assert.match(aspects[0].markup,/is-connected/);
 assert.equal(aspects.filter(line=>line.markup.includes('is-connected')).length,1);
 assert.doesNotMatch(chartSVG(chart,{interactive:true,selected:{type:'sign',key:'aries'}}),/is-connected/);
});

test('hit targets cover the visible controls while decorative lines and text cannot steal input',()=>{
 const svg=chartSVG(fixture(),{interactive:true});
 for(const group of buttons(svg)){
  assert.match(group.body,/class="natal-wheel-hit"/);
  if(group.type==='planet'){
   const hit=group.body.match(/<circle class="natal-wheel-hit"[^>]*>/)[0];
   assert.ok(Number(attr(hit,'r'))>=18&&Number(attr(hit,'r'))<=22);
   assert.match(hit,/pointer-events="all"/);
  }
  if(group.type==='angle'){
   assert.match(group.body,/<rect class="natal-wheel-hit"[^>]*width="44" height="44"/);
   assert.equal(lines(group.body).length,0,'angle badges do not turn a full radius into a click target');
  }
 }
 for(const line of lines(svg))assert.match(line.markup,/pointer-events="none"/);
 for(const text of svg.matchAll(/<text\b[^>]*>/g))assert.match(text[0],/pointer-events="none"/);
});

test('nearby planetary hit disks cannot overlap or steal a neighboring symbol click',()=>{
 const chart=fixture();
 chart.planets=chart.planets.map((planet,index)=>({...planet,longitude:(358+index)%360}));
 const targets=buttons(chartSVG(chart,{interactive:true})).filter(group=>group.type==='planet').map(group=>{
  const hit=group.body.match(/<circle class="natal-wheel-hit"[^>]*>/)[0];
  return {x:Number(attr(hit,'cx')),y:Number(attr(hit,'cy')),radius:Number(attr(hit,'r'))};
 });
 for(let first=0;first<targets.length;first++)for(let second=first+1;second<targets.length;second++){
  const a=targets[first],b=targets[second];
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.radius+b.radius);
 }
});

test('wheel margins include the ASC badge and the MC target at the furthest edge without a fixed pixel width',()=>{
 const chart=fixture();chart.midheaven={longitude:chart.ascendant.longitude+180,signIndex:6,degree:0};
 const svg=chartSVG(chart,{interactive:true});
 assert.match(svg,/viewBox="-22 -22 684 684"/);
 const root=svg.match(/<svg\b[^>]*>/)[0];
 assert.doesNotMatch(root,/\bwidth=|\bheight=/);
 const asc=buttons(svg).find(group=>group.key==='ascendant');
 assert.match(asc.body,/<rect class="natal-wheel-hit" x="-10" y="298" width="44" height="44"/);
 const mc=buttons(svg).find(group=>group.key==='midheaven');
 const hit=mc.body.match(/<rect class="natal-wheel-hit"[^>]*>/)[0];
 assert.ok(Number(attr(hit,'x'))>=-22);
 assert.ok(Number(attr(hit,'x'))+44<=662);
});

test('near-coincident ASC and MC keep distinct targets and labels while the MC radial anchor stays true',()=>{
 const chart=calculateChart({date:'2000-01-01',time:'12:00',timezone:'UTC',latitude:66.56232012703853,longitude:-11.457044551682259},{engine:Astronomy});
 const svg=chartSVG(chart,{interactive:true}),controls=buttons(svg).filter(group=>group.type==='angle');
 const rectangles=controls.map(group=>{
  const hit=group.body.match(/<rect class="natal-wheel-hit"[^>]*>/)[0];
  return {x:Number(attr(hit,'x')),y:Number(attr(hit,'y')),width:Number(attr(hit,'width')),height:Number(attr(hit,'height'))};
 });
 assert.equal(rectangles.length,2);
 const [a,b]=rectangles;
 assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
 const mcLine=lines(svg).find(line=>attr(line.markup,'stroke-width')==='1.3'&&attr(line.markup,'stroke-dasharray')==='4 4');
 const displayedAngle=Math.atan2(mcLine.y2-320,mcLine.x2-320)*180/Math.PI;
 const actualLongitude=((180-displayedAngle+chart.ascendant.longitude)%360+360)%360;
 assert.ok(Math.abs(actualLongitude-chart.midheaven.longitude)<1e-10);
 assert.ok(Math.abs(Math.hypot(mcLine.x2-320,mcLine.y2-320)-295)<1e-10);
 assert.ok(lines(svg).some(line=>attr(line.markup,'stroke-width')==='.8'),'a leader explains the moved badge');
});

test('interactive labels and data keys escape markup and preserve text-presentation zodiac glyphs',()=>{
 const chart=fixture();chart.planets[0]={...chart.planets[0],key:'sun" onclick="alert(1)',name:'<script>&"',glyph:'<x>'};
 const svg=chartSVG(chart,{interactive:true});
 assert.match(svg,/data-chart-key="sun&quot; onclick=&quot;alert\(1\)"/);
 assert.match(svg,/&lt;script&gt;&amp;&quot;/);
 assert.match(svg,/&lt;x&gt;/);
 assert.doesNotMatch(svg,/<script>|<x>|\sonclick="/);
 assert.match(svg,/♈\uFE0E/);
});
