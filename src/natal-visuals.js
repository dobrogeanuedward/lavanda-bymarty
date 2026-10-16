import {SIGNS} from './natal-engine.js';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const point=(angle,r,c=320)=>[c+r*Math.cos(angle*Math.PI/180),c+r*Math.sin(angle*Math.PI/180)];
const coords=p=>p.map(n=>n.toFixed(2)).join(',');
const norm=n=>((n%360)+360)%360;
const wedge=(start,end,r1,r2)=>`M${coords(point(start,r2))} A${r2},${r2} 0 0 0 ${coords(point(end,r2))} L${coords(point(end,r1))} A${r1},${r1} 0 0 1 ${coords(point(start,r1))} Z`;
const SIGN_GLYPHS=['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'].map(glyph=>glyph+'\uFE0E');
const ELEMENT_COLORS=['#ffd600','#c3acd9','#d4dcff','#c4eddf'];
export function formatDegree(value){
 if(!Number.isFinite(value))return '—';
 const minutes=Math.floor((value%30)*60);
 return `${Math.floor(minutes/60)}° ${String(minutes%60).padStart(2,'0')}′`;
}

// Labels may move to stay readable; fine ticks and leaders retain exact longitudes.
export function separateLabels(planets){
 const sorted=planets.map(p=>({...p,labelLongitude:norm(p.longitude)})).sort((a,b)=>a.labelLongitude-b.labelLongitude);
 if(sorted.length<2)return sorted;
 // Cut the circle at its largest gap so a stellium crossing 0° is handled together.
 let cut=0,gap=-1;
 for(let i=0;i<sorted.length;i++){const g=norm(sorted[(i+1)%sorted.length].longitude-sorted[i].longitude);if(g>gap){gap=g;cut=(i+1)%sorted.length;}}
 const order=[...sorted.slice(cut),...sorted.slice(0,cut)];
 for(let i=1;i<order.length;i++)while(order[i].labelLongitude<order[i-1].labelLongitude)order[i].labelLongitude+=360;
 const actual=order.map(p=>p.labelLongitude);
 for(let n=0;n<40;n++)for(let i=0;i<order.length-1;i++){
  const deficit=12-(order[i+1].labelLongitude-order[i].labelLongitude);
  if(deficit>0){order[i].labelLongitude-=deficit/2;order[i+1].labelLongitude+=deficit/2;}
 }
 const drift=order.reduce((sum,p,i)=>sum+p.labelLongitude-actual[i],0)/order.length;
 return order.map(p=>({...p,labelLongitude:norm(p.labelLongitude-drift)}));
}

export function chartSVG(chart,{interactive=false,selected=null}={}){
 const empty=!chart;const active=interactive===true&&!empty;const unknown=chart?.meta?.unknownTime??chart?.unknownTime;const asc=chart?.ascendant;const origin=asc?.longitude??0;
 const selectedItem=(type,key)=>active&&selected?.type===type&&selected?.key===key;
 const groupAttributes=(type,key,label)=>active?` class="natal-wheel-${type}${selectedItem(type,key)?' is-selected':''}" role="button" tabindex="0" aria-label="${escapeHTML(label)}" aria-pressed="${selectedItem(type,key)}" data-chart-type="${type}" data-chart-key="${escapeHTML(key)}"`:'';
 const decoration='class="natal-wheel-decoration" pointer-events="none" aria-hidden="true"';
 const textAttributes='pointer-events="none" aria-hidden="true"';
 const signNames=p=>(p.possibleSignIndices||[]).filter(index=>Number.isInteger(index)&&SIGNS[index]).map(index=>SIGNS[index].name);
 const placementLabel=p=>{
  const uncertain=p.signCertain===false||(p.possibleSignIndices?.length>1);
  if(uncertain){const names=signNames(p);return `${p.name}, ${names.length>1?`segni possibili ${names.join(' o ')}`:names.length?`segno possibile ${names[0]}`:'segno non determinato'}, esplora significato e Arcani`;}
  return `${p.name}${Number.isInteger(p.signIndex)&&SIGNS[p.signIndex]?` in ${SIGNS[p.signIndex].name}`:''}, esplora significato e Arcani`;
 };
 const angle=longitude=>180-norm(longitude-origin);
 const line=(longitude,r1,r2,attrs='')=>`<line x1="${point(angle(longitude),r1)[0]}" y1="${point(angle(longitude),r1)[1]}" x2="${point(angle(longitude),r2)[0]}" y2="${point(angle(longitude),r2)[1]}" ${decoration} ${attrs}/>`;
 const signs=SIGN_GLYPHS.map((glyph,i)=>{
  const a=angle(i*30),end=a-30,p=point(a-15,267);
  return `<g${groupAttributes('sign',SIGNS[i].key,`${SIGNS[i].name}, esplora significato e Arcani`)}><path${active?' class="natal-wheel-hit"':''} d="${wedge(a,end,244,290)}" fill="${ELEMENT_COLORS[i%4]}" stroke="#131116" stroke-width=".7"/><text class="natal-wheel-glyph" x="${p[0]}" y="${p[1]+9}" font-size="27" text-anchor="middle" ${textAttributes}>${glyph}</text></g>`;
 }).join('');
 const ticks=Array.from({length:72},(_,i)=>line(i*5,244,i%6===0?230:239,'stroke="#131116" stroke-width=".65"')).join('');
 const houses=(chart?.houses||[]).map(h=>{
  const p=point(angle(h.longitude+15),221);
  return `${line(h.longitude,145,244,'stroke="#131116" stroke-width=".65" opacity=".35"')}<text class="natal-wheel-house-label" x="${p[0]}" y="${p[1]+4}" font-size="11" fill="#555" text-anchor="middle" ${textAttributes}>${h.number}</text>`;
 }).join('');
 const byKey=new Map((chart?.planets||[]).map(p=>[p.key,p]));
 const aspectInput=chart?.aspects||[];
 const isConnected=a=>active&&selected?.type==='planet'&&(selected.key===a.from||selected.key===a.to);
 // Keep the selected planet's links visible even in a crowded chart.
 const visibleAspects=active&&selected?.type==='planet'?[...aspectInput.filter(isConnected),...aspectInput.filter(a=>!isConnected(a))]:aspectInput;
 const aspects=visibleAspects.slice(0,18).map(a=>{
  const p1=byKey.get(a.from),p2=byKey.get(a.to);if(!p1||!p2)return '';
  const x=point(angle(p1.longitude),142),y=point(angle(p2.longitude),142);
  const hard=['square','opposition'].includes(a.type);
  const connected=isConnected(a);
  return `<line x1="${x[0]}" y1="${x[1]}" x2="${y[0]}" y2="${y[1]}" class="natal-wheel-decoration natal-wheel-aspect${connected?' is-connected':''}" pointer-events="none" aria-hidden="true"${active?` data-from="${escapeHTML(a.from)}" data-to="${escapeHTML(a.to)}"`:''} stroke="${hard?'#a71862':'#382096'}" stroke-width="1" opacity=".25" ${a.type==='sextile'?'stroke-dasharray="4 4"':''}/>`;
 }).join('');
 const placedPlanets=separateLabels(chart?.planets||[]);
 const planets=placedPlanets.map(p=>{
  const actual=point(angle(p.longitude),232),tail=point(angle(p.longitude),211),label=point(angle(p.labelLongitude),185);
  const uncertain=p.signCertain===false||(p.possibleSignIndices?.length>1);
  const nearest=Math.min(...placedPlanets.filter(other=>other!==p).map(other=>{const next=point(angle(other.labelLongitude),185);return Math.hypot(next[0]-label[0],next[1]-label[1]);}));
  // Keep one unit between neighboring hit disks; nearby symbols cannot steal input.
  const hitRadius=Math.min(22,(nearest-1)/2);
  return `<g${groupAttributes('planet',p.key,placementLabel(p))}><title>${escapeHTML(`${p.name}: ${unknown||uncertain?'posizione all’istante rappresentativo':'longitudine'} ${p.longitude.toFixed(3)}°`)}</title><line x1="${actual[0]}" y1="${actual[1]}" x2="${tail[0]}" y2="${tail[1]}" ${decoration} stroke="#131116" stroke-width="1.3"/><line x1="${tail[0]}" y1="${tail[1]}" x2="${label[0]}" y2="${label[1]}" ${decoration} stroke="#777" stroke-width=".7"/>${active?`<circle class="natal-wheel-hit" cx="${label[0]}" cy="${label[1]}" r="${hitRadius}" fill="transparent" pointer-events="all"/>`:''}<circle cx="${label[0]}" cy="${label[1]}" r="18" fill="#fff" ${textAttributes}/><text class="natal-wheel-glyph" x="${label[0]}" y="${label[1]+8}" text-anchor="middle" font-size="25" fill="${uncertain?'#777':'#131116'}" ${textAttributes}>${escapeHTML(p.glyph)}</text>${p.retrograde===true?`<text x="${label[0]+12}" y="${label[1]+18}" font-size="9" ${textAttributes}>R</text>`:''}${uncertain?`<text x="${label[0]+13}" y="${label[1]-11}" font-size="12" ${textAttributes}>?</text>`:''}</g>`;
 }).join('');
 const mc=chart?.midheaven;
 const mcp=mc?point(angle(mc.longitude),309):null;
 const mcBadge=mcp&&Math.abs(mcp[0]-12)<44&&Math.abs(mcp[1]-320)<44?[mcp[0],320+(mcp[1]<=320?-56:56)]:mcp;
 const angleBadge=(key,name,body,x,y,glyph,fill,textFill)=>`<g${groupAttributes('angle',key,placementLabel({...body,name}))}>${active?`<rect class="natal-wheel-hit" x="${x-22}" y="${y-22}" width="44" height="44" rx="12" fill="transparent" pointer-events="all"/>`:''}<rect x="${x-19}" y="${y-11}" width="38" height="22" rx="11" fill="${fill}" ${textAttributes}/><text x="${x}" y="${y+4}" fill="${textFill}" font-size="11" text-anchor="middle" ${textAttributes}>${glyph}</text></g>`;
 // Only the badges receive input; long angle lines never cover a sign sector.
 // Near the polar circles ASC and MC can coincide visually. Move the MC label
 // with a leader, retaining its true radial longitude and both hit targets.
 const mcLeader=mcp&&mcBadge!==mcp?`<line x1="${mcp[0]}" y1="${mcp[1]}" x2="${mcBadge[0]}" y2="${mcBadge[1]}" ${decoration} stroke="#382096" stroke-width=".8"/>`:'';
 const angles=asc?`${line(asc.longitude,145,298,'stroke="#131116" stroke-width="2"')}${mc?`${line(mc.longitude,145,295,'stroke="#382096" stroke-width="1.3" stroke-dasharray="4 4"')}${mcLeader}`:''}${angleBadge('ascendant','Ascendente',asc,12,320,'ASC','#131116','#fff')}${mc?angleBadge('midheaven','Medio Cielo',mc,mcBadge[0],mcBadge[1],'MC','#fff','#382096'):''}`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -22 684 684" role="${active?'group':'img'}" aria-label="${active?'Ruota interattiva: esplora segni, pianeti e angoli. ':''}${empty?'Ruota dei dodici segni zodiacali':unknown?'Mappa del giorno a un istante rappresentativo, senza Ascendente e case. Tutte le posizioni sono elencate sotto.':'Carta natale: pianeti, segni e case a segno intero. Tutte le posizioni sono elencate sotto.'}" style="font-family:Arial,sans-serif"><circle cx="320" cy="320" r="290" fill="#fff" ${textAttributes}/>${signs}${ticks}<circle cx="320" cy="320" r="145" fill="none" stroke="#131116" stroke-width=".5" opacity=".4" ${textAttributes}/>${houses}${aspects}${planets}${angles}<circle cx="320" cy="320" r="${empty?64:28}" fill="${empty?'#131116':'#fff'}" ${textAttributes}/><text x="320" y="${empty?340:330}" text-anchor="middle" font-size="${empty?65:32}" fill="${empty?'#b58cff':'#131116'}" ${textAttributes}>✦</text></svg>`;
}

const star=(cx,cy,r=32)=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4-Math.PI/2,rr=i%2?r*.3:r;return `${cx+rr*Math.cos(a)},${cy+rr*Math.sin(a)}`;}).join(' ');
const circle=(x,y,r,fill='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const sun=`${circle(105,133,43,'#ffd600')}${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<path d="M${105+53*Math.cos(a)},${133+53*Math.sin(a)} l${15*Math.cos(a)},${15*Math.sin(a)}"/>`;}).join('')}<path d="M88 132h6m22 0h6m-28 18q11 10 22 0"/>`;
const moon=`<path d="M131 66C78 57 53 99 63 139s57 55 89 25c-45 8-70-18-62-50 5-24 21-40 41-48Z" fill="#ffd600"/>`;
// Original geometric studies, drawn in code. No historic deck artwork is reproduced.
const motifs=[
 `<path d="M38 213h130M71 213l29-60 41 12-12 48M100 153l-10-36 22-31 24 23-12 40M125 100l36-36M153 62l19 3-5 20"/>${circle(112,74,14,'#fff')}<polygon points="${star(54,85,22)}" fill="#ffd600"/>`,
 `<path d="M53 204h104M65 204v-65h80v65M105 139V92m-22 0h44"/>${circle(105,72,17,'#fff')}<path d="M53 60q10-16 25 0t25 0t25 0t25 0"/><polygon points="${star(105,166,23)}" fill="#ffd600"/>`,
 `${moon}<path d="M39 215V94h20v121m92 0V94h20v121M62 215h87"/>${circle(105,187,16,'#fff')}`,
 `<path d="M60 210q4-85 45-106 41 21 45 106ZM82 80l-6-28 29 13 29-13-6 28Z" fill="#ffd600"/>${circle(105,92,19,'#fff')}<path d="M58 218h94M151 163v-40m-13 13h26"/>`,
 `<path d="M57 218V113h96v105M72 113V77h66v36M83 77l-9-25 31 12 31-12-9 25M76 153h58v65H76Z" fill="#ffd600"/><path d="M89 171h32m-16-12v47"/>`,
 `<path d="M51 218V83h22v135m64 0V83h22v135M78 218V128l27-27 27 27v90M105 101V56m-18 18h36m-28-9h20"/><path d="M91 165h28v43H91Z" fill="#ffd600"/>`,
 `${circle(73,121,17,'#fff')}${circle(137,121,17,'#fff')}<path d="M48 215l6-64h36l15 32 15-32h36l6 64M81 81q24-37 48 0l-24 25Z" fill="#ffd600"/>`,
 `<path d="M49 187h112v-56H49ZM72 131V90h66v41M63 187l-12 31m96-31 12 31"/>${circle(72,198,18,'#ffd600')}${circle(138,198,18,'#ffd600')}<polygon points="${star(105,67,24)}" fill="#fff"/>`,
 `${circle(105,142,48,'#ffd600')}<path d="M76 140q29-28 58 0M76 159q29 26 58 0M91 85q14-15 28 0M74 63q12-18 31 0 19-18 31 0-12 18-31 0-19 18-31 0Z"/>`,
 `<path d="M62 222l26-91-2-40 20-21 21 22-4 43 25 87ZM151 222V97m-14 7h28v36h-28Z" fill="#fff"/><polygon points="${star(151,122,12)}" fill="#ffd600"/>`,
 `${circle(105,139,66,'#ffd600')}${circle(105,139,36)}${circle(105,139,9,'#131116')}<path d="M105 73v57m0 18v57M39 139h57m18 0h57M58 92l40 40m14 14 40 40M58 186l40-40m14-14 40-40"/>`,
 `<path d="M105 58v156M58 91h94M72 91l-23 57h46Zm66 0-23 57h46ZM75 218h60"/><path d="M42 148q30 32 60 0m6 0q30 32 60 0" fill="#ffd600"/>`,
 `<path d="M44 69h122M62 69v35M148 69v35M105 69v57l-22 27 26 24-9 26m9-26 32-31M105 126l35-3"/>${circle(101,219,15,'#ffd600')}`,
 `<path d="M53 218l26-72h52l26 72ZM75 146l-8-35 18-32h40l18 32-8 35Z" fill="#fff"/>${circle(88,115,7,'#131116')}${circle(122,115,7,'#131116')}<path d="M95 137h20M51 67l110 145M159 67 49 212"/>`,
 `<path d="M62 85h29v38q-15 20-29 0ZM119 159h29v38q-15 20-29 0ZM78 123q0 36 55 36M119 97q-11 30-14 67" fill="#ffd600"/>${circle(105,65,18,'#fff')}<path d="M49 218h112"/>`,
 `<path d="M55 214 74 132h62l19 82ZM79 91 60 63l29 7m42 21 19-28-29 7M75 95l30-24 30 24-8 37H83Z" fill="#131116"/><path d="M83 171q-28-33-39 4t34 37m49-41q28-33 39 4t-34 37"/><polygon points="${star(105,110,16)}" fill="#ffd600"/>`,
 `<path d="M69 218l8-108h56l8 108ZM65 110h80M75 91l-8-24 21 5 17-15 17 15 21-5-8 24Z" fill="#fff"/><path d="M133 52l-30 62h24l-37 66" fill="#ffd600"/>`,
 `<polygon points="${star(105,121,72)}" fill="#ffd600"/>${Array.from({length:6},(_,i)=>`<polygon points="${star(43+(i%2)*124,64+Math.floor(i/2)*70,13)}" fill="#fff"/>`).join('')}<path d="M63 219q20-18 42 0t42 0"/>`,
 `${moon}<path d="M43 219V165h30v54m64 0v-54h30v54M77 219l28-40 28 40"/>${circle(151,75,6,'#fff')}`,
 `${sun}<path d="M43 219q30-28 62 0t62 0"/>`,
 `<path d="M61 202h88v16H61ZM93 96l-8-25 17-13 30 14 23-11v44l-23-11-30 14-17-12Z" fill="#ffd600"/><path d="M75 128l-20 32m50-32v40m30-40 20 32M105 168v34m-17-17h34"/>`,
 `<ellipse cx="105" cy="140" rx="62" ry="84"/><ellipse cx="105" cy="140" rx="49" ry="70"/>${circle(105,119,18,'#ffd600')}<path d="M93 140l-17 47h58l-17-47M47 64l17 17m82 118 17 17M47 216l17-17m82-118 17-17"/>`
];
export function cardSVG(card){
 const n=Number(card.number);const color=['#fff','#b58cff','#ffd600','#d3dfff'][n%4];
 return `<svg class="natal-card-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 300" aria-hidden="true"><rect x="1" y="1" width="208" height="298" rx="12" fill="${color}" stroke="#131116" stroke-width="2"/><rect x="12" y="12" width="186" height="276" rx="7" fill="none" stroke="#131116"/><text x="105" y="37" text-anchor="middle" font-size="13" font-family="Arial,sans-serif" fill="#131116">${escapeHTML(card.roman)}</text><g stroke="#131116" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none">${motifs[n]||motifs[0]}</g><path d="M23 239h164" stroke="#131116"/><text x="105" y="263" text-anchor="middle" font-size="${card.name.length>15?12:14}" font-family="Georgia,serif" fill="#131116">${escapeHTML(card.name)}</text><text x="105" y="280" text-anchor="middle" font-size="7" letter-spacing="2" font-family="Arial,sans-serif" fill="#131116">LAVANDA</text></svg>`;
}
