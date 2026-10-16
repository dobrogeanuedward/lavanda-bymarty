import {computeLunarCalendar,getLunarCalendarProgress} from './lunar-calendar.js';
import {SOLAR_MIN_DATE,SOLAR_MAX_DATE} from './solar-clock.js';
import {TAROT_CARDS} from './natal-tarot.js';
import {cardSVG,escapeHTML as e} from './natal-visuals.js';

const colors={nigredo:'#d5c3ed',albedo:'#faf7ed',citrinitas:'#ffd600',rubedo:'#ff8bb8'};
const glyphs=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
const dateFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const utc=value=>dateFormat.format(new Date(value))+' UTC';
const number=(value,digits=1)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits}).format(value);
const source=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};

/** Reuses one real lunation until its next new Moon; cards never advance a natal snapshot. */
export function createLunarCalendarUI({root,detail=root.querySelector('[data-lunar-detail]'),staticSnapshot=false,onOpenCard=()=>{},onCloseCard=()=>{},onVisitDate=null,onFocusCalendar=()=>{}}){
 const $=selector=>root.querySelector(selector),titleId=detail.getAttribute('aria-labelledby');
 let scene=null,calendar=null,progress=null,selection=null,content=null,contentError=false,lastTrigger=null,lastReadout='',notice='';
 function updateButtons(){
  for(const button of root.querySelectorAll('[data-lunar-select]')){
   button.setAttribute('aria-pressed',String(button.dataset.lunarSelect===selection));
   if(button.dataset.lunarSelect===progress?.currentSectorKey)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  }
  scene?.setLunarCalendarSelection(selection||progress?.currentSectorKey||null);
 }
 function renderIndex(){
  const focusedKey=root.contains(document.activeElement)?document.activeElement.dataset.lunarSelect:null;
  $('[data-lunar-range]').textContent=`Lunazione: ${utc(calendar.startDate)} → ${utc(calendar.endDate)} · ${number(calendar.durationDays,2)} giorni`;
  $('[data-lunar-phases]').innerHTML=calendar.sectors.map((phase,index)=>`<button type="button" data-lunar-select="${e(phase.key)}" aria-controls="${e(detail.id)}" aria-pressed="false" style="--lunar-color:${colors[phase.alchemyKey]}"><span class="lunar-mini-glyph" aria-hidden="true">${glyphs[index]}</span><span>${index%2===0?`<strong>${e(phase.alchemyLabel)}</strong>`:''}<span>${e(phase.phaseLabel||phase.label)}</span><small>${e(utc(phase.startDate))}</small></span></button>`).join('');
  if(focusedKey)root.querySelector(`[data-lunar-select="${CSS.escape(focusedKey)}"]`)?.focus({preventScroll:true});
 }
 function cards(data){
  return (data?.arcana||[]).map(id=>TAROT_CARDS.find(card=>card.number===id)).filter(Boolean).map(card=>`<details class="calendar-arcana" data-lunar-card="${card.number}"><summary data-lunar-action="arcana-${card.number}">${cardSVG(card)}<span><strong>${e(card.roman)} · ${e(card.name)}</strong><small>Accostamento editoriale di Lavanda per questa fase</small></span><b aria-hidden="true">＋</b></summary><div><p>${e(card.description)}</p><blockquote>${e(card.question)}</blockquote><p>${e(card.practice)}</p></div></details>`).join('');
 }
 function editorial(phase){
  const data=content?.[phase.key];
  if(!data)return `<p>${contentError?'Il quaderno simbolico non è disponibile. Ricarica la pagina per riprovare.':'Carico Arcani e botaniche…'}</p>`;
  return `<p class="calendar-editorial-label">Il percorso simbolico / Lavanda</p><h3>${e(data.title)}</h3><p>${e(data.introduction)}</p><p class="calendar-small">${e(data.alchemyNote)}</p><section><h3>Gli Arcani da esplorare</h3>${cards(data)}</section><section><h3>Le piante di questo passaggio</h3><div class="calendar-plants">${data.plants.map(plant=>{const url=source(plant.sourceUrl);return `<article><h4>${e(plant.commonName)}</h4><p class="calendar-latin"><i>${e(plant.scientificName)}</i></p><p>${e(plant.noteBotanicaBreve)}</p><p>${e(plant.editorialAssociation)}</p>${url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">Fonte botanica ↗</a>`:''}</article>`;}).join('')}</div></section><div class="calendar-practice"><h4>Una domanda</h4><p>${e(data.question)}</p><h4>Un gesto da esplorare</h4><p>${e(data.practice)}</p></div>`;
 }
 function renderDetail(){
  const phase=calendar?.sectors.find(item=>item.key===selection);if(!phase)return;
  const index=phase.index,next=calendar.sectors[(index+1)%8],visitTime=Date.parse(phase.startDate);
  const visit=onVisitDate&&!staticSnapshot?(visitTime>=SOLAR_MIN_DATE&&visitTime<=SOLAR_MAX_DATE?`<button type="button" class="natal-small-button" data-lunar-visit="${e(phase.startDate)}" data-lunar-action="visit">Visita questo passaggio in pausa ↗</button>`:'<p class="calendar-small">Questo passaggio si trova fuori dall’intervallo esplorabile 1900–2100. Puoi leggerne le corrispondenze; il tempo del modello rimane invariato.</p>'):'';
  const active=detail.contains(document.activeElement)?document.activeElement.dataset.lunarAction:null;
  const open=new Set([...detail.querySelectorAll('details[data-lunar-card][open]')].map(node=>node.dataset.lunarCard));
  detail.dataset.alchemy=phase.alchemyKey;
  detail.innerHTML=`<header><div><p class="section-caption">${e(phase.alchemyLabel)} / Il quaderno lunare</p><h2 id="${e(titleId)}">${e(index%2===0?phase.alchemyLabel:phase.phaseLabel||phase.label)}.</h2>${index%2===0?`<p class="lunar-phase-caption">${e(phase.phaseLabel||phase.label)}</p>`:''}</div><button type="button" class="natal-reading-close" data-lunar-close data-lunar-action="close" aria-label="Chiudi la scheda lunare">×</button></header><nav class="calendar-card-nav" aria-label="Esplora un’altra fase"><label>Fase lunare<select data-lunar-phase-select data-lunar-action="phase-select">${calendar.sectors.map(item=>`<option value="${e(item.key)}"${item.key===selection?' selected':''}>${e(item.index%2===0?item.alchemyLabel+' · ':'')}${e(item.phaseLabel||item.label)}</option>`).join('')}</select></label><button type="button" class="natal-small-button" data-lunar-focus data-lunar-action="focus">Centra il ciclo ↗</button></nav><p class="calendar-card-dates">Passaggio a ${phase.angle}° · <time datetime="${e(phase.startDate)}">${e(utc(phase.startDate))}</time></p><p class="lunar-interval">Il settore segue il tratto da questo passaggio a ${e((next.phaseLabel||next.label).toLowerCase())}: <time datetime="${e(phase.endDate)}">${e(utc(phase.endDate))}</time> · ${number(phase.durationDays,2)} giorni.</p>${notice?`<p class="lunar-notice">${e(notice)}</p>`:''}<section data-lunar-editorial>${editorial(phase)}</section>${visit}<footer><p>Istanti astronomici calcolati con Astronomy Engine. Titoli alchemici, Arcani e associazioni vegetali compongono una lettura editoriale di Lavanda. Le carte conservano la numerazione Rider–Waite–Smith; gli accostamenti alle fasi sono scelti per questo percorso.</p>${staticSnapshot?'<p>La carta natale rimane ferma al suo istante: questa scheda esplora i passaggi del ciclo che lo contiene.</p>':''}<button type="button" class="natal-small-button" data-lunar-close data-lunar-action="back">Torna alla mappa ↑</button></footer>`;
  for(const node of detail.querySelectorAll('details[data-lunar-card]'))if(open.has(node.dataset.lunarCard))node.open=true;
  if(active)(detail.querySelector(`[data-lunar-action="${CSS.escape(active)}"]`)||detail).focus({preventScroll:true});
 }
 function select(key,{trigger=null,focus=true}={}){
  if(!calendar?.sectors.some(phase=>phase.key===key))return;
  selection=key;if(trigger&&!detail.contains(trigger))lastTrigger=trigger;renderDetail();detail.hidden=false;updateButtons();onOpenCard(detail);
  if(focus){detail.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});detail.focus({preventScroll:true});}
 }
 function close({restoreFocus=true}={}){
  const wasOpen=!detail.hidden;detail.hidden=true;selection=null;updateButtons();if(wasOpen)onCloseCard(detail,{restoreFocus});
  if(restoreFocus&&wasOpen){
   const dialog=document.querySelector('dialog[open]');
   [lastTrigger,root.querySelector(`[data-lunar-select="${progress?.currentSectorKey}"]`)].find(node=>node?.isConnected&&node.getClientRects().length&&(!dialog||dialog.contains(node)))?.focus();
  }
 }
 function handleClick(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-lunar-close'))close();
  else if(button.dataset.lunarSelect)select(button.dataset.lunarSelect,{trigger:button});
  else if(button.hasAttribute('data-lunar-focus'))onFocusCalendar();
  else if(button.dataset.lunarVisit)onVisitDate?.(new Date(button.dataset.lunarVisit));
 }
 root.addEventListener('click',event=>{if(!detail.contains(event.target))handleClick(event);});detail.addEventListener('click',handleClick);
 detail.addEventListener('change',event=>{if(event.target.matches('[data-lunar-phase-select]'))select(event.target.value,{trigger:event.target,focus:false});});
 function update(date,engine,{representative=false}={}){
  try{
   notice=representative?'Fase all’istante rappresentativo della giornata. Senza l’ora di nascita, il passaggio esatto e la fase effettiva restano da confermare.':'';
   $('[data-lunar-notice]').hidden=!notice;$('[data-lunar-notice]').textContent=notice;
   const milliseconds=date.getTime();
   if(!calendar||milliseconds<Date.parse(calendar.startDate)||milliseconds>=Date.parse(calendar.endDate)){
    calendar=computeLunarCalendar(date,{engine});progress=getLunarCalendarProgress(calendar,date,{engine});scene?.setLunarCalendar(calendar);renderIndex();if(selection)renderDetail();lastReadout='';
   }else progress=getLunarCalendarProgress(calendar,date,{engine});
   const key=`${progress.currentSectorKey}:${Math.round(progress.illuminatedFraction*1000)}:${Math.round(progress.phaseAngle*10)}:${representative}`;
   if(key!==lastReadout){
    lastReadout=key;const phase=calendar.sectors[progress.currentSectorIndex];
    $('[data-lunar-glyph]').textContent=glyphs[Math.round(progress.phaseAngle/45)%8];
    $('[data-lunar-current]').textContent=`${phase.alchemyLabel} · da ${(phase.phaseLabel||phase.label).toLowerCase()} a ${(calendar.sectors[(phase.index+1)%8].phaseLabel||calendar.sectors[(phase.index+1)%8].label).toLowerCase()}${representative?' / riferimento del giorno':''}`;
    $('[data-lunar-metrics]').textContent=`Disco illuminato: ${number(progress.illuminatedFraction*100)}% · Elongazione eclittica: ${number(progress.phaseAngle)}°`;
    updateButtons();
   }
   $('[data-lunar-status]').textContent='';
  }catch(error){$('[data-lunar-status]').textContent=error.message;}
 }
 function clear(){
  scene?.setLunarCalendar(null);calendar=null;progress=null;selection=null;lastTrigger=null;lastReadout='';notice='';detail.hidden=true;detail.replaceChildren();
  $('[data-lunar-phases]').replaceChildren();$('[data-lunar-range]').textContent='';$('[data-lunar-current]').textContent='Preparo il ciclo lunare…';$('[data-lunar-metrics]').textContent='';$('[data-lunar-notice]').hidden=true;$('[data-lunar-notice]').textContent='';$('[data-lunar-status]').textContent='';
 }
 fetch('/lunar-phases.json').then(response=>{if(!response.ok)throw Error('unavailable');return response.json();}).then(data=>{content=data;if(selection)renderDetail();}).catch(()=>{contentError=true;if(selection)renderDetail();});
 return {update,select,close,clear,detail,setScene(next){scene=next;scene?.setLunarCalendar(calendar);updateButtons();}};
}
