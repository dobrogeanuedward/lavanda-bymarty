import {SIGNS,calculateChart,resolveBirthTime} from './natal-engine.js';
import {TAROT_CARDS,recommendArcana} from './natal-tarot.js';
import {chartSVG,cardSVG,formatDegree,escapeHTML as e} from './natal-visuals.js';
import {describeSelection} from './natal-reading.js';
import {createNatalSolar} from './natal-solar.js';

const $=selector=>document.querySelector(selector);
const form=$('#natal-form');
let selectedPlace=null,currentChart=null,enginePromise=null,searchController=null,searchVersion=0,calculationVersion=0;
let selectedChartItem=null,lastSelectionTrigger=null,wheelZoom=100,wheelScrollBeforeDialog=0,displayMode='solar';
const smooth=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const signName=p=>Number.isInteger(p?.signIndex)?SIGNS[p.signIndex].name:(p?.possibleSignIndices||[]).map(i=>SIGNS[i]?.name).filter(Boolean).join(' / ')||'Non disponibile';
const uncertain=p=>p?.signCertain===false||(p?.possibleSignIndices?.length>1);
const natalSolar=form?createNatalSolar({root:$('#natal-solar-panel'),onSelect:showSelection,onEarth:showEarthInfo}):null;
const aspectsLabels={conjunction:'Congiunzione',opposition:'Opposizione',trine:'Trigono',square:'Quadratura',sextile:'Sestile'};

function error(message){const box=$('#natal-error');box.textContent=message;box.hidden=!message;}
function invalidate(){calculationVersion++;if($('#natal-wheel-dialog').open)$('#natal-wheel-dialog').close();natalSolar?.clear();currentChart=null;selectedChartItem=null;$('#natal-wheel-reading').hidden=true;$('#natal-wheel-reading').replaceChildren();$('#natal-result').hidden=true;$('#natal-empty').hidden=false;$('#natal-recommendations').hidden=true;error('');}
function clearTimeChoice(){$('#time-choice').hidden=true;$('#time-choice-options').replaceChildren();}
function setPlace(place){
 selectedPlace=place;const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:place.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));$('#birth-date').max=`${parts.year}-${parts.month}-${parts.day}`;invalidate();clearTimeChoice();$('#place-results').hidden=true;
 $('#birth-place').value=place.name;
 const selected=$('#selected-place');selected.hidden=false;
 selected.innerHTML=`<strong>${e(place.label)}</strong><span>${e(place.latitude.toFixed(4))}°, ${e(place.longitude.toFixed(4))}° · ${e(place.timezone)}</span>`;
 $('#place-status').textContent='Luogo selezionato. Il fuso sarà applicato alla data di nascita.';
}
async function searchPlaces(){
 const query=$('#birth-place').value.trim();
 if(query.length<2){$('#place-status').textContent='Scrivi almeno due caratteri per cercare una città.';return;}
 const version=++searchVersion;searchController?.abort();searchController=new AbortController();
 $('#place-status').textContent='Cerco il luogo…';$('#place-results').hidden=true;$('#search-place').disabled=true;
 try{
  const response=await fetch(`/api/places?q=${encodeURIComponent(query)}`,{signal:searchController.signal});
  const data=await response.json();if(version!==searchVersion)return;
  if(!response.ok)throw Error(data.error||'Ricerca momentaneamente non disponibile.');
  const list=$('#place-results');list.replaceChildren();
  for(const place of data.places){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.innerHTML=`${e(place.label)}<small>${e(place.timezone)}</small>`;button.addEventListener('click',()=>setPlace(place));li.append(button);list.append(li);}
  list.hidden=!data.places.length;
  $('#place-status').textContent=data.places.length?`${data.places.length} luoghi trovati. Scegli la località corretta.`:'Nessun luogo trovato. Aggiungi il paese, oppure inserisci le coordinate.';
 }catch(err){if(err.name!=='AbortError'&&version===searchVersion)$('#place-status').textContent='La ricerca non è disponibile. Puoi inserire le coordinate qui sotto.';}
 finally{if(version===searchVersion)$('#search-place').disabled=false;}
}
async function loadAstronomy(){
 if(globalThis.Astronomy)return globalThis.Astronomy;
 if(!enginePromise)enginePromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/vendor/astronomy.js';script.async=true;
  script.onload=()=>globalThis.Astronomy?resolve(globalThis.Astronomy):reject(Error('Il motore di calcolo non è disponibile. Ricarica la pagina.'));
  script.onerror=()=>{script.remove();enginePromise=null;reject(Error('Non riesco a caricare il motore di calcolo. Controlla la connessione e riprova.'));};
  document.head.append(script);
 });
 return enginePromise;
}
function bigThree(chart){
 const sun=chart.planets.find(p=>p.key==='sun'),moon=chart.planets.find(p=>p.key==='moon');
 const cell=(name,p,type,key,help)=>`<div>${p?`<button type="button" data-chart-type="${type}" data-chart-key="${key}" aria-controls="natal-wheel-reading" aria-pressed="false">`:'<div>'}<span>${name}</span><strong>${e(signName(p))}</strong><small>${p?(uncertain(p)?'Il segno cambia durante il giorno':formatDegree(p.degree)):help}</small>${p?'<b aria-hidden="true">↗</b></button>':'</div>'}</div>`;
 return cell('☉ Sole',sun,'planet','sun')+cell('☽ Luna',moon,'planet','moon')+cell('↗ Ascendente',chart.ascendant,'angle','ascendant',chart.unknownTime?'Serve l’ora di nascita':'Non definito per queste coordinate');
}

function setWheelZoom(value){
 wheelZoom=Math.max(100,Math.min(220,value));$('#natal-chart').style.removeProperty('width');$('#natal-chart').style.setProperty('--natal-wheel-scale',String(wheelZoom/100));
 $('#natal-zoom-value').textContent=`${wheelZoom}%`;$('#natal-zoom-out').disabled=wheelZoom===100;$('#natal-zoom-in').disabled=wheelZoom===220;
 $('#natal-wheel-viewport').classList.toggle('is-zoomed',wheelZoom>100);
 if(wheelZoom===100){$('#natal-wheel-viewport').scrollTop=0;$('#natal-wheel-viewport').scrollLeft=0;}
}
function selectionButton(item,label=item.label){return `<button type="button" data-chart-type="${e(item.type)}" data-chart-key="${e(item.key)}" aria-controls="natal-wheel-reading" aria-pressed="false">${e(label)}</button>`;}
function renderWheelChoices(chart){
 const points=chart.planets.map(p=>({type:'planet',key:p.key,label:`${p.glyph} ${p.name}`}));
 if(chart.ascendant)points.push({type:'angle',key:'ascendant',label:'↗ Ascendente'});
 if(chart.midheaven)points.push({type:'angle',key:'midheaven',label:'MC Medio Cielo'});
 $('#natal-wheel-choices').innerHTML=`<p>Pianeti e punti</p><div class="natal-wheel-choice-list">${points.map(p=>selectionButton(p)).join('')}</div><p>I dodici segni</p><div class="natal-wheel-choice-list">${SIGNS.map(s=>selectionButton({type:'sign',key:s.key,label:`${s.glyph}\uFE0E ${s.name}`})).join('')}</div>`;
}
function updateSelectionState(){
 for(const node of document.querySelectorAll('.natal-page [data-chart-type]')){
  const selected=selectedChartItem&&node.dataset.chartType===selectedChartItem.type&&node.dataset.chartKey===String(selectedChartItem.key);
  node.setAttribute('aria-pressed',String(Boolean(selected)));node.classList.toggle('is-selected',Boolean(selected));
 }
}
function setDisplayMode(mode){
 displayMode=mode==='wheel'?'wheel':'solar';$('#natal-wheel-panel').hidden=displayMode!=='wheel';$('#natal-solar-panel').hidden=displayMode!=='solar';
 for(const button of document.querySelectorAll('button[data-natal-mode]'))button.setAttribute('aria-pressed',String(button.dataset.natalMode===displayMode));
 if(displayMode==='solar'){natalSolar?.resize();natalSolar?.revealSelection();}
}
function showSelection(selection,trigger){
 if(!currentChart)return;const reading=describeSelection(currentChart,selection);if(!reading)return;
 natalSolar?.selectFromChart(selection);renderReading(reading,trigger);
}
function showEarthInfo(trigger){
 if(!currentChart)return;
 renderReading({type:'reference',key:'earth',kicker:'Il punto di osservazione',title:'La Terra, nella tua mappa.',intro:'La carta natale osserva il cielo dalla Terra. Nel modello 3D la Terra compare come corpo fisico in orbita intorno al Sole; nella ruota non le attribuiamo un segno o un Arcano.',sections:[{title:'La Luna intorno alla Terra',text:'Scegli “Terra e Luna” per vedere la traiettoria lunare da vicino. Il modello conserva l’istante della carta e le distanze proporzionali, con raggi amplificati per renderli visibili.'}],related:[{type:'planet',key:'moon',label:'☽ La Luna: lettura e Arcani'}]},trigger);
}
function renderReading(reading,trigger){
 selectedChartItem={type:reading.type,key:reading.key};lastSelectionTrigger=trigger;
 $('#natal-chart').innerHTML=chartSVG(currentChart,{interactive:true,selected:selectedChartItem});updateSelectionState();
 const panel=$('#natal-wheel-reading');panel.hidden=false;
 const cards=(reading.cards||[]).flatMap(item=>{const card=TAROT_CARDS.find(c=>c.number===item.card);return card?[{card,reason:item.reason}]:[];});
 panel.innerHTML=`<header class="natal-reading-header"><div><p class="section-caption">${e(reading.kicker)}</p><h3 id="natal-selection-title">${e(reading.title)}</h3></div><button type="button" class="natal-reading-close" data-close-reading aria-label="Chiudi l’approfondimento">×</button></header>${reading.caveat?`<p class="natal-reading-caveat">${e(reading.caveat)}</p>`:''}<p class="natal-reading-intro">${e(reading.intro)}</p>${(reading.sections||[]).map(section=>`<section><h4>${e(section.title)}</h4><p>${e(section.text)}</p></section>`).join('')}${reading.questions?.length?`<section class="natal-reading-questions"><h4>Domande per la tua esplorazione</h4><ul>${reading.questions.map(question=>`<li>${e(question)}</li>`).join('')}</ul></section>`:''}${cards.length?`<section><h4>Gli Arcani collegati</h4><p class="natal-reading-card-hint">Apri una carta per seguirne il significato e il gesto da esplorare.</p><div class="natal-reading-cards">${cards.map(({card,reason})=>`<details class="natal-reading-card"><summary><span class="natal-reading-card-thumb">${cardSVG(card)}</span><span><strong>${e(card.roman)} · ${e(card.name)}</strong><small>${e(reason)}</small></span><b aria-hidden="true">＋</b></summary><div><p>${e(card.description)}</p><blockquote>${e(card.question)}</blockquote><p>${e(card.practice)}</p></div></details>`).join('')}</div></section>`:''}${reading.related?.length?`<nav class="natal-reading-related" aria-label="Continua nella carta"><p>Segui un’altra corrispondenza</p><div>${reading.related.map(item=>selectionButton(item)).join('')}</div></nav>`:''}<button type="button" class="natal-small-button natal-reading-back" data-close-reading>Torna alla mappa ↑</button><p class="natal-reading-footnote">Una lettura simbolica di Lavanda, composta a partire dalla tua carta. Le associazioni tradizionali e le scelte editoriali sono spiegate nel metodo.</p>`;
 updateSelectionState();const closeReading=()=>{
  const item=selectedChartItem;selectedChartItem=null;natalSolar?.selectFromChart(null);panel.hidden=true;$('#natal-chart').innerHTML=chartSVG(currentChart,{interactive:true});updateSelectionState();
  const fallback=document.querySelector(`#natal-chart [data-chart-type="${item.type}"][data-chart-key="${CSS.escape(String(item.key))}"]`);
  [lastSelectionTrigger,fallback,natalSolar?.bodyButton(item.key),document.querySelector('button[data-natal-mode][aria-pressed="true"]')].find(node=>node?.isConnected&&node.getClientRects().length)?.focus();
 };for(const button of panel.querySelectorAll('[data-close-reading]'))button.addEventListener('click',closeReading);
 panel.scrollIntoView({behavior:smooth(),block:'start'});panel.focus({preventScroll:true});
}
function referenceTime(chart){return new Intl.DateTimeFormat('it',{timeZone:chart.meta.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(chart.meta.utc));}
function renderPlacements(chart){
 const known=!chart.unknownTime;
 const list=[...chart.planets,...(chart.ascendant?[{...chart.ascendant,key:'ascendant',type:'angle',name:'Ascendente',glyph:'ASC'}]:[]),...(chart.midheaven?[{...chart.midheaven,key:'midheaven',type:'angle',name:'Medio Cielo',glyph:'MC'}]:[])];
 $('#natal-placements').innerHTML=`<div class="natal-table-scroll" tabindex="0" role="region" aria-label="Tabella delle posizioni, scorri se necessario"><table><caption>${known?'R = moto retrogrado apparente. Case a segno intero.':`Riferimento alle ${referenceTime(chart)} locali. I gradi sono indicativi: senza l’ora non rappresentano il momento esatto della nascita. Case non calcolate.`}</caption><thead><tr><th scope="col">Corpo / punto</th><th scope="col">Segno</th><th scope="col">Gradi</th>${known?'<th scope="col">Casa</th>':''}</tr></thead><tbody>${list.map(p=>`<tr><td>${selectionButton({type:p.type||'planet',key:p.key,label:`${p.glyph} ${p.name} ${p.retrograde===true?'R':''}`})}</td><td>${e(signName(p))}${uncertain(p)?' *':''}</td><td>${Number.isFinite(p.degree)?formatDegree(p.degree):'Variabili *'}</td>${known?`<td>${chart.ascendant&&Number.isFinite(p.longitude)?((Math.floor(p.longitude/30)-chart.ascendant.signIndex+12)%12)+1:'—'}</td>`:''}</tr>`).join('')}</tbody></table></div>${chart.planets.some(uncertain)?'<p>* Il pianeta attraversa un confine fra segni durante questa giornata. L’ora è necessaria per risolvere il dubbio.</p>':''}`;
 const byKey=new Map(chart.planets.map(p=>[p.key,p]));
 $('#natal-aspects').innerHTML=chart.unknownTime?'<p>Gli aspetti richiedono l’ora di nascita. Non vengono assegnati a una mappa del giorno.</p>':`<p>Distanze angolari fra i pianeti. Orbi massimi: 6° per congiunzione e opposizione, 4° per trigono e quadratura, 3° per sestile. Nella ruota le linee viola indicano trigoni e sestili, le linee rosa quadrature e opposizioni.</p><ul class="natal-aspect-list">${(chart.aspects||[]).map(a=>`<li><span>${e(byKey.get(a.from)?.name)} · ${e(byKey.get(a.to)?.name)}</span><span>${e(aspectsLabels[a.type]||a.type)} / ${Number(a.orb).toFixed(1)}°</span></li>`).join('')}</ul>${chart.aspects?.length?'':'<p>Nessun aspetto entro gli orbi selezionati.</p>'}`;
}
function showCard(number,trigger){
 const card=TAROT_CARDS.find(c=>c.number===Number(number));if(!card)return;
 const detail=$('#natal-card-detail');detail.hidden=false;
 detail.innerHTML=`<div>${cardSVG(card)}</div><div><p class="section-caption">${e(card.roman)} / ${e(card.correspondence.label)} · ${e(card.keyword)}</p><h3 id="natal-card-title">${e(card.name)}</h3><p>${e(card.description)}</p><h4>Una domanda</h4><blockquote>${e(card.question)}</blockquote><h4>Un gesto da esplorare</h4><p>${e(card.practice)}</p><p class="small">Corrispondenza ${e(card.correspondence.source)}: ${e(card.correspondence.label)}. Testi e studio illustrato originali di Lavanda.</p><button type="button" class="natal-small-button" id="close-natal-card">Chiudi questa carta ↑</button></div>`;
 $('#close-natal-card').addEventListener('click',()=>{detail.hidden=true;trigger?.focus();});
 detail.scrollIntoView({behavior:smooth(),block:'start'});detail.focus({preventScroll:true});
}
function renderRecommendations(chart){
 const cards=recommendArcana(chart);
 $('#natal-cards').innerHTML=cards.map(({card,reasons})=>`<article class="natal-tarot-card"><button type="button" class="natal-card-cover" data-arcana="${card.number}" aria-label="Esplora ${e(card.name)}">${cardSVG(card)}</button><h3>${e(card.name)}</h3><ul class="natal-card-reasons">${reasons.map(reason=>`<li>${e(reason)}</li>`).join('')}</ul><p>${e(card.question)}</p><button type="button" class="natal-small-button" data-arcana="${card.number}">Apri la carta ↗</button></article>`).join('');
 $('#natal-recommendation-note').textContent=chart.unknownTime?'Percorso basato sui segni certi della giornata e sui due luminari. Le associazioni ai segni incerti sono escluse.':'Il segno del Sole apre il percorso; seguono Luna e Ascendente. Gli Arcani planetari dei due luminari aggiungono due ulteriori porte. Le corrispondenze coincidenti si uniscono.';
 $('#natal-recommendations').hidden=false;
}
function renderResult(chart,input,place,engine){
 if($('#natal-wheel-dialog').open)$('#natal-wheel-dialog').close();
 currentChart=chart;selectedChartItem=null;$('#natal-wheel-reading').hidden=true;$('#natal-wheel-reading').replaceChildren();$('#natal-empty').hidden=true;$('#natal-result').hidden=false;
 $('#natal-result-title').textContent=chart.unknownTime?'La mappa del tuo giorno.':'Il cielo della tua nascita.';
 const date=new Intl.DateTimeFormat('it',{dateStyle:'long',timeZone:'UTC'}).format(new Date(`${input.date}T12:00:00Z`));
 $('#natal-birth-summary').textContent=`${date} · ${chart.unknownTime?'ora sconosciuta':`${input.time} (ora locale, ${chart.meta.offsetLabel})`} · ${place.label} · ${input.timezone}`;
 $('#natal-big-three').innerHTML=bigThree(chart);$('#natal-chart').innerHTML=chartSVG(chart,{interactive:true});setWheelZoom(100);renderWheelChoices(chart);
 const warnings=Array.isArray(chart.warnings)?chart.warnings.map(w=>typeof w==='string'?w:w.message||'').filter(Boolean):[];
 $('#natal-chart-note').textContent=[chart.unknownTime?`Ruota di riferimento alle ${referenceTime(chart)} locali. Senza un’ora attendibile, Ascendente e case restano aperti.`:'Zodiaco tropicale · Case a segno intero · ASC: Ascendente · MC: Medio Cielo. Le tacche indicano le posizioni esatte; i simboli sono distanziati per leggibilità.',...warnings].join(' ');
 setDisplayMode('solar');natalSolar.setChart(chart,engine);renderPlacements(chart);renderRecommendations(chart);
 $('#natal-result-title').focus({preventScroll:true});$('#natal-result').scrollIntoView({behavior:smooth(),block:'start'});
}
if(form){
 $('#birth-date').max=localToday();$('#empty-wheel').innerHTML=chartSVG(null);
 const zones=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):['Europe/Rome','Europe/London','America/New_York','Asia/Tokyo'];
 $('#natal-timezones').innerHTML=zones.map(zone=>`<option value="${e(zone)}"></option>`).join('');
 $('#natal-deck-grid').innerHTML=TAROT_CARDS.map(card=>`<button type="button" class="natal-deck-card" data-arcana="${card.number}" aria-label="Esplora ${e(card.name)}">${cardSVG(card)}<span>${e(card.roman)} · ${e(card.name)}</span></button>`).join('');
 document.querySelector('.natal-page').addEventListener('click',event=>{
  const mode=event.target.closest('button[data-natal-mode]');if(mode){setDisplayMode(mode.dataset.natalMode);return;}
  const target=event.target.closest('[data-chart-type]');if(target){showSelection({type:target.dataset.chartType,key:target.dataset.chartKey},target);return;}
  const button=event.target.closest('[data-arcana]');if(button)showCard(button.dataset.arcana,button);
 });
 $('#natal-chart').addEventListener('keydown',event=>{
  const target=event.target.closest('[data-chart-type]');if(!target)return;
  if(event.key==='Enter'||event.key===' '){event.preventDefault();showSelection({type:target.dataset.chartType,key:target.dataset.chartKey},target);return;}
  const controls=[...$('#natal-chart').querySelectorAll(`[data-chart-type="${target.dataset.chartType}"]`)];
  const index=controls.indexOf(target);let next;
  if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%controls.length;
  if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+controls.length)%controls.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=controls.length-1;
  if(next!==undefined){event.preventDefault();controls[next].focus();}
 });
 $('#natal-zoom-in').addEventListener('click',()=>setWheelZoom(wheelZoom+40));
 $('#natal-zoom-out').addEventListener('click',()=>setWheelZoom(wheelZoom-40));
 $('#natal-zoom-fit').addEventListener('click',()=>setWheelZoom(100));
 $('#natal-open-wheel').addEventListener('click',()=>{
  wheelScrollBeforeDialog=window.scrollY;$('#natal-dialog-mount').append($('#natal-explorer'));$('#natal-wheel-dialog').showModal();natalSolar.resize();$('#natal-close-wheel').focus();
 });
 $('#natal-close-wheel').addEventListener('click',()=>$('#natal-wheel-dialog').close());
 $('#natal-wheel-dialog').addEventListener('close',()=>{
  $('#natal-explorer-slot').append($('#natal-explorer'));natalSolar.resize();if(currentChart){window.scrollTo({top:wheelScrollBeforeDialog,behavior:'instant'});$('#natal-open-wheel').focus({preventScroll:true});}
 });
 $('#search-place').addEventListener('click',searchPlaces);
 $('#birth-place').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchPlaces();}});
 $('#birth-place').addEventListener('input',()=>{selectedPlace=null;searchVersion++;searchController?.abort();$('#search-place').disabled=false;$('#selected-place').hidden=true;$('#place-results').hidden=true;$('#place-status').textContent='';invalidate();clearTimeChoice();});
 for(const selector of ['#birth-date','#birth-time'])$(selector).addEventListener('input',()=>{invalidate();clearTimeChoice();});
 $('#unknown-time').addEventListener('change',()=>{
  const unknown=$('#unknown-time').checked;$('#birth-time').disabled=unknown;$('#birth-time').required=!unknown;
  $('#time-help').textContent=unknown?'La mappa del giorno mostrerà i segni possibili. Ascendente e case richiedono l’ora.':'Usa l’ora locale riportata sul documento di nascita.';
  invalidate();clearTimeChoice();
 });
 $('#use-coordinates').addEventListener('click',()=>{
  const lat=$('#manual-lat'),lon=$('#manual-lon'),zone=$('#manual-zone').value.trim();
  if(lat.value===''||lon.value===''||!lat.checkValidity()||!lon.checkValidity()){error('Inserisci coordinate valide: latitudine fra −89,9 e 89,9 e longitudine fra −180 e 180.');return;}
  try{new Intl.DateTimeFormat('it',{timeZone:zone});}catch{error('Inserisci un fuso IANA valido, per esempio Europe/Rome.');return;}
  if(!zone){error('Inserisci il fuso della località, per esempio Europe/Rome.');return;}
  const latitude=Number(lat.value),longitude=Number(lon.value);
  setPlace({name:'Coordinate personalizzate',label:`Coordinate ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,latitude,longitude,timezone:zone});
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();error('');
  if(!selectedPlace){error('Cerca e seleziona il luogo di nascita, oppure conferma le coordinate manuali.');$('#birth-place').focus();return;}
  const place={...selectedPlace},version=++calculationVersion;
  const input={date:$('#birth-date').value,time:$('#birth-time').value,unknownTime:$('#unknown-time').checked,timezone:selectedPlace.timezone,latitude:selectedPlace.latitude,longitude:selectedPlace.longitude};
  try{
   if(!input.unknownTime){
    const resolved=resolveBirthTime(input);
    if(resolved.status==='nonexistent')throw Error('Quell’ora locale non esiste a causa di un cambio d’ora o di calendario. Controlla l’ora riportata sul documento di nascita.');
    if(resolved.status==='ambiguous'){
     const choice=form.querySelector('input[name="utc-choice"]:checked')?.value;
     if(!resolved.candidates.some(c=>c.utc===choice)){
      $('#time-choice-options').innerHTML=resolved.candidates.map((c,i)=>`<label><input type="radio" name="utc-choice" value="${e(c.utc)}"> ${i===0?'Prima':'Seconda'} occorrenza · ${e(c.offsetLabel)}</label>`).join('');
      $('#time-choice').hidden=false;error('Scegli l’occorrenza dell’ora prima di calcolare. Se non puoi verificarla, usa “Non conosco l’ora”.');$('#time-choice').scrollIntoView({behavior:smooth(),block:'center'});return;
     }
     input.utcChoice=choice;
    }
   }
   $('#calculate-natal').disabled=true;$('#calculate-natal').textContent='Disegno la tua mappa…';
   const engine=await loadAstronomy();if(version!==calculationVersion)return;const raw=calculateChart(input,{engine});const chart={...raw,unknownTime:raw.meta.unknownTime,warnings:raw.meta.warnings};
   renderResult(chart,input,place,engine);
  }catch(err){if(version===calculationVersion)error(err.message||'Non riesco a calcolare questa carta. Controlla i dati e riprova.');}
  finally{$('#calculate-natal').disabled=false;$('#calculate-natal').innerHTML='Calcola la carta natale <span aria-hidden="true">✦</span>';}
 });
 $('#natal-print').addEventListener('click',()=>window.print());
 $('#natal-download').addEventListener('click',()=>{
  if(!currentChart)return;const blob=new Blob([chartSVG(currentChart)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lavanda-carta-natale.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('#natal-reset').addEventListener('click',()=>{
  searchVersion++;searchController?.abort();$('#search-place').disabled=false;form.reset();$('#birth-date').max=localToday();selectedPlace=null;invalidate();clearTimeChoice();$('#birth-time').disabled=false;$('#birth-time').required=true;$('#time-help').textContent='Usa l’ora locale riportata sul documento di nascita.';$('#selected-place').hidden=true;$('#place-results').hidden=true;$('#place-status').textContent='';$('#natal-card-detail').hidden=true;for(const id of ['natal-birth-summary','natal-big-three','natal-chart','natal-placements','natal-aspects','natal-cards','natal-wheel-choices','natal-chart-note','natal-card-detail'])$('#'+id).replaceChildren();$('#birth-date').focus();
 });
}
