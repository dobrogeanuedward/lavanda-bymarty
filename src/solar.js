import {SOLAR_BODIES,AU_KM,computeSolarSystem} from './solar-engine.js';
import {SolarClock,parseUTCDateTime} from './solar-clock.js';
import {createSolarScene} from './solar-scene.js';
import {createSolarCalendarUI} from './solar-calendar-ui.js';
import {createLunarCalendarUI} from './lunar-calendar-ui.js';

const $=selector=>document.querySelector(selector);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(value,digits=2)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits}).format(value);
const timeFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const rateNames={1:'1 secondo/s',60:'1 minuto/s',3600:'1 ora/s',86400:'1 giorno/s',2592000:'30 giorni/s'};
const viewNames={calendar:'Calendario terrestre · Riferimento eliocentrico',inner:'Riferimento eliocentrico · Pianeti interni',all:'Riferimento eliocentrico · Sistema completo','earth-moon':'Terra e Luna · Traiettoria relativa alla Terra','sun-barycenter':'Riferimento baricentrico · Traiettoria del Sole su 12 anni'};
let scene=null,engine=null,state=null,selected='earth',view='calendar',raf=0,lastCompute=-Infinity,lastReadout=-Infinity,lastEpoch=0,epochVersion=0,orbitBusy=false,disposed=false;
const clock=new SolarClock();
const calendarUI=$('#solar-calendar')?createSolarCalendarUI({root:$('#solar-calendar'),onOpenCard:detail=>{lunarUI?.close({restoreFocus:false});dockCalendarCard(detail);},onCloseCard:undockCalendarCard,onVisitDate:visitCalendarDate,onFocusCalendar:focusCalendarView}):null;
const lunarUI=$('#solar-lunar-calendar')?createLunarCalendarUI({root:$('#solar-lunar-calendar'),onOpenCard:detail=>{calendarUI?.close({restoreFocus:false});if(view!=='earth-moon')focusCalendarView('earth-moon');dockCalendarCard(detail);},onCloseCard:undockCalendarCard,onVisitDate:visitCalendarDate,onFocusCalendar:()=>focusCalendarView('earth-moon')}):null;

function text(selector,value){const node=$(selector);if(node&&node.textContent!==String(value))node.textContent=value;}
function announce(message){text('#solar-status',message);}
function sceneError(error){
 if(error?.code==='ORBIT_UNAVAILABLE'){announce('Le traiettorie non sono disponibili per questo aggiornamento. Le posizioni rimangono calcolate.');return;}
 $('#solar-loading').hidden=true;$('#solar-render-error').hidden=false;
 text('#solar-render-error-text',error?.message||'La vista 3D non è disponibile in questo browser. Le posizioni restano consultabili qui sotto.');
}
async function loadAstronomy(){
 if(globalThis.Astronomy)return globalThis.Astronomy;
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/vendor/astronomy.js';script.async=true;
  script.onload=()=>globalThis.Astronomy?resolve(globalThis.Astronomy):reject(Error('Il motore astronomico non è disponibile.'));
  script.onerror=()=>reject(Error('Non riesco a caricare il motore astronomico. Controlla la connessione e ricarica la pagina.'));
  document.head.append(script);
 });
}
function renderBody(){
 const body=SOLAR_BODIES.find(body=>body.key===selected);if(!body)return;
 $('#solar-body-detail').innerHTML=`<div class="solar-body-detail-header"><h2 id="solar-body-title">${e(body.name)}</h2><button type="button" class="natal-small-button" id="solar-focus-body">Centra ${e(body.name)} ↗</button></div><p>${e(body.summary)}</p><dl class="solar-body-facts"><div><dt>Raggio medio</dt><dd>${number(body.radiusKm,1)} km</dd></div><div><dt>${body.key==='sun'?'Intervallo della traiettoria baricentrica':body.key==='moon'?'Periodo siderale intorno alla Terra':'Periodo siderale medio'}</dt><dd>${body.orbitalPeriodDays?`${number(body.orbitalPeriodDays,2)} giorni`:'12 anni'}</dd></div>${body.key!=='sun'?'<div><dt>Distanza dal Sole, ora</dt><dd id="solar-distance-sun">—</dd></div>':''}${body.key!=='earth'?`<div><dt>Distanza dalla Terra, ora</dt><dd id="solar-distance-earth">—</dd></div>`:''}${body.key==='sun'?'<div><dt>Distanza dal baricentro, ora</dt><dd id="solar-distance-barycenter">—</dd></div>':''}</dl><p class="solar-body-source">Parametri fisici: <a href="${e(body.sourceUrl)}" target="_blank" rel="noopener noreferrer">NASA / JPL ↗</a></p>`;
 for(const button of document.querySelectorAll('[data-solar-body]'))button.setAttribute('aria-pressed',String(button.dataset.solarBody===selected));
 $('#solar-focus-body').disabled=!scene;
 $('#solar-focus-body').addEventListener('click',()=>selectBody(selected,true));
 if(state)updateReadouts();
}
function syncView(){
 if(scene)view=scene.getScaleInfo().view;
 for(const button of document.querySelectorAll('button[data-solar-view]'))button.setAttribute('aria-pressed',String(button.dataset.solarView===view));
 text('#solar-view-caption',viewNames[view]+' · Eclittica J2000');
 updateScale();
}
function updateScale(){
 const info=scene?.getScaleInfo();
 if(!info)return;
 if(info.sizeMode==='real'||view==='sun-barycenter'){
  text('#solar-scale-note','Distanze e raggi in scala fisica. I nomi permettono di ritrovare anche i corpi quasi impercettibili. Superfici schematiche.');
 }else{
  const factors=info.bodies.filter(body=>body.visible).map(body=>body.enhancementFactor);
  const minimum=Math.min(...factors),maximum=Math.max(...factors);
  text('#solar-scale-note',`Distanze proporzionali. Raggi amplificati da ${number(minimum,1)}× a ${number(maximum,1)}× nella vista attuale, per la visibilità. Superfici schematiche.`);
 }
}
function selectBody(key,focus=false){
 if(!SOLAR_BODIES.some(body=>body.key===key))return;
 const changed=selected!==key;selected=key;scene?.selectBody(key,{focus});syncView();if(changed)renderBody();else updateReadouts();
}
function setView(next){
 if(!Object.hasOwn(viewNames,next))return;view=next;
 if(view==='sun-barycenter')selected='sun';
 else if(view==='earth-moon'&&!['earth','moon'].includes(selected))selected='earth';
 else if(['calendar','inner'].includes(view)&&!['sun','mercury','venus','earth','mars'].includes(selected))selected='earth';
 else if(view==='all'&&selected==='moon')selected='earth';
 scene?.setView(view);scene?.selectBody(selected);syncView();renderBody();
}
function updateTime(snapshot){
 text('#solar-timestamp',timeFormat.format(snapshot.date)+' UTC');$('#solar-timestamp').dateTime=snapshot.date.toISOString();
 text('#solar-live-badge',snapshot.paused?`In pausa · ${rateNames[snapshot.rate]}`:snapshot.live?'Tempo reale · 1×':`Tempo esplorato · ${rateNames[snapshot.rate]}`);
 $('#solar-pause').setAttribute('aria-pressed',String(snapshot.paused));text('#solar-pause',snapshot.paused?'Riprendi ▶':'Metti in pausa Ⅱ');
 if(snapshot.limit)announce('Raggiunto il limite del 2100. Il tempo è in pausa; scegli una nuova data o torna ad Adesso.');
}
function updateReadouts(){
 if(!state)return;const body=state.bodies.find(body=>body.key===selected);
 if(body){
  text('#solar-distance-sun',`${number(body.distanceSunAU,6)} AU`);
  text('#solar-distance-earth',body.key==='moon'?`${number(body.distanceEarthAU*AU_KM,0)} km`:`${number(body.distanceEarthAU,6)} AU`);
  text('#solar-distance-barycenter',`${number(Math.hypot(...body.barycentricPosition)*AU_KM,0)} km`);
 }
 for(const body of state.bodies){
  for(let axis=0;axis<3;axis++)text(`[data-solar-coordinate="${body.key}-${axis}"]`,body.position[axis].toFixed(6));
  text(`[data-solar-distance="${body.key}"]`,number(body.distanceEarthAU,6));
 }
 text('#solar-table-date',timeFormat.format(new Date(state.date))+' UTC');
}
async function refreshOrbits(date,{force=false}={}){
 if(!scene||(!force&&orbitBusy))return false;
 orbitBusy=true;const version=++epochVersion;lastEpoch=date.getTime();
 if(force)announce('Aggiorno le traiettorie attorno alla data osservata…');
 try{
  const success=await scene.setEpoch(date);
  if(version===epochVersion&&success&&force)announce('Traiettorie aggiornate. Ogni punto corrisponde a un istante calcolato.');
  return success;
 }finally{if(version===epochVersion)orbitBusy=false;}
}
function compute(){
 if(!engine)return;const snapshot=clock.snapshot();state=computeSolarSystem(snapshot.date,{engine});scene?.update(state);updateTime(snapshot);calendarUI?.update(snapshot.date,engine);lunarUI?.update(snapshot.date,engine);updateReadouts();
 if(scene&&Math.abs(snapshot.date.getTime()-lastEpoch)>15*86400000)refreshOrbits(snapshot.date).catch(sceneError);
}
function frame(tick){
 raf=0;if(disposed||document.visibilityState==='hidden')return;
 const snapshot=clock.snapshot(),interval=snapshot.rate>1&&!snapshot.paused?1000/30:250;
 if(tick-lastCompute>=interval){
  try{state=computeSolarSystem(snapshot.date,{engine});scene?.update(state);updateTime(snapshot);calendarUI?.update(snapshot.date,engine);lunarUI?.update(snapshot.date,engine);
   if(tick-lastReadout>=1000){updateReadouts();lastReadout=tick;}
   if(scene&&Math.abs(snapshot.date.getTime()-lastEpoch)>15*86400000)refreshOrbits(snapshot.date).catch(sceneError);
  }catch(error){announce(error.message);}
  lastCompute=tick;
 }
 raf=requestAnimationFrame(frame);
}
function start(){if(engine&&!disposed&&!raf&&document.visibilityState!=='hidden')raf=requestAnimationFrame(frame);}
function syncDateInput(){$('#solar-date').value=clock.snapshot().date.toISOString().slice(0,16);}
let expandedDialog=null,scenePlaceholder=null,calendarCardPlaceholder=null,dockedCard=null;
function visitCalendarDate(date){clock.seek(date);clock.setPaused(true);syncDateInput();compute();refreshOrbits(date,{force:true}).catch(sceneError);announce('L’osservazione è in pausa alla data scelta. “Adesso” torna al tempo reale.');}
function focusCalendarView(next){setView(next);scene?.resetView();}
function dockCalendarCard(detail){
 if(!expandedDialog?.open)return;
 if(dockedCard&&dockedCard!==detail)undockCalendarCard(dockedCard,{restoreFocus:false});
 const slot=expandedDialog.querySelector('.solar-calendar-dialog-slot');
 if(!calendarCardPlaceholder){calendarCardPlaceholder=document.createComment('calendar-card-position');detail.before(calendarCardPlaceholder);}
 dockedCard=detail;slot.append(detail);slot.hidden=false;scene?.resize();
}
function undockCalendarCard(detail=dockedCard,{restoreFocus=true}={}){
 if(!detail||detail!==dockedCard)return;
 if(calendarCardPlaceholder){calendarCardPlaceholder.replaceWith(detail);calendarCardPlaceholder=null;}
 dockedCard=null;
 const slot=expandedDialog?.querySelector('.solar-calendar-dialog-slot');if(slot)slot.hidden=true;scene?.resize();
 if(restoreFocus&&expandedDialog?.open)$('#solar-fullscreen').focus({preventScroll:true});
}
function fullscreenLabel(){const expanded=!!expandedDialog?.open;text('#solar-fullscreen',expanded?'Chiudi vista ×':'Espandi ↗');$('#solar-fullscreen').setAttribute('aria-label',expanded?'Chiudi il modello a schermo intero':'Apri il modello a schermo intero');}
function expandScene(){
 const shell=$('.solar-scene-shell');
 if(expandedDialog?.open){expandedDialog.close();return;}
 if(!expandedDialog){
  expandedDialog=document.createElement('dialog');expandedDialog.className='solar-dialog';expandedDialog.setAttribute('aria-label','Sistema solare — vista espansa');
  expandedDialog.innerHTML='<div class="solar-dialog-layout"><div class="solar-dialog-scene-slot"></div><aside class="solar-calendar-dialog-slot" aria-label="Scheda del calendario" hidden></aside></div>';
  document.body.append(expandedDialog);
  expandedDialog.addEventListener('close',()=>{undockCalendarCard(dockedCard,{restoreFocus:false});scenePlaceholder.replaceWith(shell);scenePlaceholder=null;fullscreenLabel();scene?.resize();$('#solar-fullscreen').focus({preventScroll:true});});
 }
 scenePlaceholder=document.createComment('solar-scene-position');shell.before(scenePlaceholder);expandedDialog.querySelector('.solar-dialog-scene-slot').append(shell);expandedDialog.showModal();if(calendarUI&&!calendarUI.detail.hidden)dockCalendarCard(calendarUI.detail);else if(lunarUI&&!lunarUI.detail.hidden)dockCalendarCard(lunarUI.detail);fullscreenLabel();scene?.resize();$('#solar-fullscreen').focus({preventScroll:true});
}

if($('#solar-stage')){
 $('#solar-body-buttons').innerHTML=SOLAR_BODIES.map(body=>`<button type="button" data-solar-body="${body.key}" aria-pressed="${body.key===selected}"><span class="solar-body-dot" style="background:${body.color}" aria-hidden="true"></span>${e(body.name)}</button>`).join('');
 $('#solar-numbers').innerHTML=`<table><caption>Coordinate geometriche eliocentriche del modello, eclittica J2000, arrotondate in AU. Distanze dalla Terra nello stesso istante. <span id="solar-table-date"></span></caption><thead><tr><th scope="col">Corpo</th><th scope="col">X (AU)</th><th scope="col">Y (AU)</th><th scope="col">Z (AU)</th><th scope="col">Dalla Terra (AU)</th></tr></thead><tbody>${SOLAR_BODIES.map(body=>`<tr><td><button type="button" data-solar-body="${body.key}">${e(body.name)}</button></td>${[0,1,2].map(axis=>`<td data-solar-coordinate="${body.key}-${axis}">—</td>`).join('')}<td data-solar-distance="${body.key}">—</td></tr>`).join('')}</tbody></table>`;
 renderBody();syncDateInput();
 document.querySelector('.solar-page').addEventListener('click',event=>{const body=event.target.closest('[data-solar-body]');if(body)selectBody(body.dataset.solarBody);const camera=event.target.closest('button[data-solar-view]');if(camera)setView(camera.dataset.solarView);});
 $('#solar-rate').addEventListener('change',()=>{clock.setRate(Number($('#solar-rate').value));compute();announce(`Velocità impostata: ${rateNames[clock.rate]}.`);});
 $('#solar-pause').addEventListener('click',()=>{clock.setPaused(!clock.snapshot().paused);compute();});
 $('#solar-now').addEventListener('click',()=>{clock.resetNow();$('#solar-rate').value='1';syncDateInput();compute();refreshOrbits(clock.snapshot().date,{force:true}).catch(sceneError);announce('Orologio sincronizzato con l’istante corrente UTC del dispositivo.');});
 $('#solar-date-form').addEventListener('submit',event=>{
  event.preventDefault();const error=$('#solar-date-error');error.hidden=true;
  try{clock.seek(parseUTCDateTime($('#solar-date').value));compute();refreshOrbits(clock.snapshot().date,{force:true}).catch(sceneError);announce('Data UTC applicata. Il tempo segue la velocità selezionata.');}
  catch(cause){error.textContent=cause.message;error.hidden=false;}
 });
 $('#solar-size').addEventListener('change',()=>{scene?.setSizeMode($('#solar-size').value);updateScale();});
 $('#solar-orbits').addEventListener('change',()=>scene?.setOrbits($('#solar-orbits').checked));
 $('#solar-labels').addEventListener('change',()=>scene?.setLabels($('#solar-labels').checked));
 $('#solar-reset-camera').addEventListener('click',()=>scene?.resetView());
 $('#solar-fullscreen').addEventListener('click',expandScene);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){cancelAnimationFrame(raf);raf=0;}else start();});
 window.addEventListener('pagehide',event=>{cancelAnimationFrame(raf);raf=0;if(!event.persisted){disposed=true;scene?.dispose();}});
 window.addEventListener('pageshow',event=>{if(event.persisted&&!disposed){compute();scene?.resize();start();}});
 try{
  engine=await loadAstronomy();if(disposed)throw Error('Pagina chiusa.');compute();start();
  scene=await createSolarScene({container:$('#solar-stage'),engine,onSelect:key=>selectBody(key),onCalendarSelect:key=>calendarUI?.select(key,{trigger:$('#solar-stage').querySelector(`[data-calendar-sector="${CSS.escape(key)}"]`)}),onLunarSelect:key=>lunarUI?.select(key,{trigger:$('#solar-stage').querySelector(`[data-lunar-phase="${CSS.escape(key)}"]`)}),onError:sceneError});
  if(disposed){scene.dispose();throw Error('Pagina chiusa.');}
  scene.update(state);calendarUI?.setScene(scene);lunarUI?.setScene(scene);setView(view);scene.setSizeMode($('#solar-size').value);scene.setLabels($('#solar-labels').checked);scene.setOrbits($('#solar-orbits').checked);
  await refreshOrbits(clock.snapshot().date,{force:true});$('#solar-loading').hidden=true;renderBody();updateScale();
 }catch(error){if(!disposed)sceneError(error);}
}
