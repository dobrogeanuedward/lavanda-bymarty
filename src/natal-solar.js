import {SOLAR_BODIES} from './solar-engine.js';
import {createSolarScene} from './solar-scene.js';
import {createLunarCalendarUI} from './lunar-calendar-ui.js';
import {createNatalSolarModel,natalSelectionToSolarBody,solarBodyToNatalSelection} from './natal-solar-model.js';

const number=value=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
const views={inner:'Pianeti interni',all:'Sistema completo','earth-moon':'Terra e Luna · Orbita relativa alla Terra'};

/** A birth snapshot shares selection with the wheel, never an advancing clock. */
export function createNatalSolar({root,onSelect,onEarth,onLunarOpen=()=>{}}){
 const $=selector=>root.querySelector(selector);
 let scene=null,model=null,version=0,selection=null,view='inner',bodyKey=null;
 const stage=$('#natal-solar-stage');
 const buttons=$('#natal-solar-bodies');
 const lunarUI=createLunarCalendarUI({root:$('#natal-lunar-calendar'),detail:document.querySelector('#natal-lunar-detail'),staticSnapshot:true,onOpenCard:()=>onLunarOpen(),onFocusCalendar:()=>{view='earth-moon';scene?.setView(view);scene?.resetView();sync();}});
 for(const body of SOLAR_BODIES){
  const button=document.createElement('button');button.type='button';button.dataset.natalSolarBody=body.key;button.textContent=body.name;
  button.setAttribute('aria-controls','natal-wheel-reading');button.setAttribute('aria-pressed','false');buttons.append(button);
 }
 function sync(){
  if(scene)view=scene.getScaleInfo().view;
  for(const button of root.querySelectorAll('button[data-natal-solar-view]'))button.setAttribute('aria-pressed',String(button.dataset.natalSolarView===view));
  for(const button of buttons.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.natalSolarBody===bodyKey));
  $('#natal-solar-reference').textContent=views[view]+' · Eclittica J2000';
  $('#natal-lunar-calendar').hidden=view!=='earth-moon';
  if(view!=='earth-moon')lunarUI.close({restoreFocus:false});
  const info=scene?.getScaleInfo();
  if(info){
   const range=info.visibleEnhancementRange;
   $('#natal-solar-scale').textContent=info.sizeMode==='real'?'Distanze e raggi in scala fisica. Le etichette aiutano a ritrovare i corpi più piccoli.':`Distanze proporzionali. Raggi amplificati da ${number(range.minimum)}× a ${number(range.maximum)}× per la visibilità. Superfici schematiche.`;
  }
 }
 function fail(error){
  if(error?.code==='ORBIT_UNAVAILABLE'){$('#natal-solar-status').textContent='Le traiettorie non sono disponibili. Posizioni, letture e ruota restano consultabili.';return;}
  $('#natal-solar-loading').hidden=true;$('#natal-solar-error').hidden=false;
  $('#natal-solar-error').textContent=error?.message||'La vista 3D non è disponibile. Puoi esplorare la ruota e scegliere i pianeti dall’elenco.';
 }
 function selectFromChart(next){
  if(next)lunarUI.close({restoreFocus:false});
  selection=next;bodyKey=natalSelectionToSolarBody(next);
  if(bodyKey){scene?.selectBody(bodyKey,{focus:bodyKey==='moon'?'pair':!root.hidden});$('#natal-solar-selection-note').textContent='';}
  else{scene?.clearSelection();$('#natal-solar-selection-note').textContent=next?'Questa selezione appartiene alla ruota: segni, angoli e Plutone restano esplorabili nella carta e nelle letture.':'';}
  sync();
 }
 function chooseBody(key,trigger){
  lunarUI.close({restoreFocus:false});
  bodyKey=key;scene?.selectBody(key,{focus:key==='moon'?'pair':true});sync();
  const next=solarBodyToNatalSelection(key);
  if(next){selection=next;$('#natal-solar-selection-note').textContent='';onSelect(next,trigger);}
  else if(key==='earth'){selection=null;$('#natal-solar-selection-note').textContent='La Terra è il punto di osservazione della carta geocentrica.';onEarth(trigger);}
 }
 root.addEventListener('click',event=>{
  const body=event.target.closest('button[data-natal-solar-body]');if(body){chooseBody(body.dataset.natalSolarBody,body);return;}
  const camera=event.target.closest('button[data-natal-solar-view]');
  if(camera){
   view=camera.dataset.natalSolarView;scene?.setView(view);
   const visible=view==='earth-moon'?['earth','moon'].includes(bodyKey):view==='inner'?['sun','mercury','venus','earth','mars'].includes(bodyKey):bodyKey!=='moon';
   if(bodyKey&&visible)scene?.selectBody(bodyKey);else scene?.clearSelection();
   sync();
  }
 });
 $('#natal-solar-reset').addEventListener('click',()=>scene?.resetView());
 $('#natal-solar-size').addEventListener('change',()=>{scene?.setSizeMode($('#natal-solar-size').value);sync();});
 function clear(){
  version++;lunarUI.clear();lunarUI.setScene(null);scene?.dispose();scene=null;model=null;selection=null;bodyKey=null;view='inner';stage.replaceChildren();
  $('#natal-solar-loading').hidden=false;$('#natal-solar-error').hidden=true;$('#natal-solar-status').textContent='';
  $('#natal-solar-selection-note').textContent='';$('#natal-solar-time').textContent='';$('#natal-solar-time').removeAttribute('datetime');
  $('#natal-solar-notice').textContent='';$('#natal-solar-size').value='visible';sync();
 }
 async function setChart(chart,engine){
  clear();const token=version;
  try{
   model=createNatalSolarModel(chart,{engine});
   $('#natal-solar-title').textContent=model.meta.title;
   stage.setAttribute('aria-label',`${model.meta.unknownTime?'Sistema solare a un istante rappresentativo della giornata':'Sistema solare all’istante della nascita'}. Trascina per ruotare, usa due dita o la rotella per lo zoom. Seleziona un pianeta per la lettura e gli Arcani.`);
   root.querySelector('.natal-solar-views').setAttribute('aria-label',model.meta.unknownTime?'Viste del sistema solare a un istante rappresentativo':'Viste del sistema solare all’istante della nascita');
   $('#natal-solar-time').textContent=model.meta.dateLabel;$('#natal-solar-time').dateTime=model.meta.utc;
   $('#natal-solar-badge').textContent=model.meta.unknownTime?'Istante rappresentativo · fermo':'Istante di nascita · fermo';
   $('#natal-solar-notice').textContent=model.meta.notice;$('#natal-solar-frame-note').textContent=model.meta.frameNotice;
   lunarUI.update(new Date(model.meta.utc),engine,{representative:model.meta.unknownTime});
   const next=await createSolarScene({container:stage,engine,onSelect:key=>chooseBody(key,stage.querySelector(`[data-body="${key}"]`)),onLunarSelect:key=>lunarUI.select(key,{trigger:stage.querySelector(`[data-lunar-phase="${CSS.escape(key)}"]`)}),onError:error=>{if(token===version)fail(error);}});
   if(token!==version){next.dispose();return;}
   scene=next;scene.update(model.state);lunarUI.setScene(scene);scene.setView(view);scene.setSizeMode($('#natal-solar-size').value);
   if(selection)selectFromChart(selection);else if(bodyKey)scene.selectBody(bodyKey,{focus:true});else scene.clearSelection();sync();
   const success=await scene.setEpoch(new Date(model.meta.utc));if(token!==version)return;
   $('#natal-solar-loading').hidden=true;if(success)$('#natal-solar-status').textContent='Orbite calcolate per questo istante. Seleziona un pianeta per aprire la sua lettura.';
  }catch(error){if(token===version)fail(error);}
 }
 window.addEventListener('pagehide',event=>{if(!event.persisted)clear();});
 window.addEventListener('pageshow',event=>{if(event.persisted)scene?.resize();});
 return {setChart,clear,selectFromChart,showLunarCycle(){view='earth-moon';scene?.setView(view);scene?.resetView();sync();},closeLunar:()=>lunarUI.close({restoreFocus:false}),revealSelection(){if(bodyKey){scene?.selectBody(bodyKey,{focus:bodyKey==='moon'?'pair':true});sync();}},resize:()=>scene?.resize(),bodyButton:key=>buttons.querySelector(`[data-natal-solar-body="${key}"]`)};
}
