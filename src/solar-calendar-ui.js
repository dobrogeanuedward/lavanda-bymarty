import {computeSolarCalendar,getSolarCalendarProgress} from './solar-calendar.js';
import {SIGNS} from './natal-engine.js';
import {SIGN_ARCANA,TAROT_CARDS} from './natal-tarot.js';
import {cardSVG,escapeHTML as e} from './natal-visuals.js';

const dateFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',day:'numeric',month:'long'});
const instantFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const colors={spring:'#9fffcb',summer:'#ffd600',autumn:'#ff78b3',winter:'#b58cff'};
const utc=value=>instantFormat.format(new Date(value))+' UTC';
const sourceLink=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};

export function createSolarCalendarUI({root,onOpenCard=()=>{},onCloseCard=()=>{},onVisitDate,onFocusCalendar}){
 const $=selector=>root.querySelector(selector);
 const detail=$('#solar-calendar-detail');
 let scene=null,calendar=null,progress=null,content=null,contentError=false,selection=null,lastTrigger=null,lastMonth=-1,failedYear=null;
 function updateButtons(){
  for(const button of root.querySelectorAll('button[data-calendar-select]')){
   const active=button.dataset.calendarSelect===selection;
   button.setAttribute('aria-pressed',String(active));
   if(calendar?.sectors[progress?.currentSectorIndex]?.key===button.dataset.calendarSelect)button.setAttribute('aria-current','date');else button.removeAttribute('aria-current');
  }
  scene?.setCalendarSelection(selection||progress?.currentSectorKey||null);
 }
 function nav(){return `<nav class="calendar-card-nav" aria-label="Esplora un altro mese"><label>Mese<select data-calendar-month-select data-calendar-action="month-select">${calendar.sectors.some(month=>month.key===selection)?'':'<option value="" disabled selected>Scegli un mese</option>'}${calendar.sectors.map(month=>`<option value="${month.key}"${selection===month.key?' selected':''}>${e(month.name)}</option>`).join('')}</select></label><button type="button" class="natal-small-button" data-calendar-focus>Centra il calendario ↗</button></nav>`;}
 function card(number,reason){
  const value=TAROT_CARDS.find(card=>card.number===number);if(!value)return '';
  return `<details class="calendar-arcana" data-calendar-card="${value.number}"><summary data-calendar-action="arcana-${value.number}">${cardSVG(value)}<span><strong>${e(value.roman)} · ${e(value.name)}</strong><small>${e(reason)}</small></span><b aria-hidden="true">＋</b></summary><div><p>${e(value.description)}</p><blockquote>${e(value.question)}</blockquote><p>${e(value.practice)}</p></div></details>`;
 }
 function plants(month){
  const data=content?.[month.key];
  if(!data)return `<p>${contentError?'Le schede botaniche non sono disponibili. Ricarica la pagina per riprovare.':'Carico il quaderno botanico…'}</p>`;
  return `<p class="calendar-editorial-label">Botaniche / scelte editoriali di Lavanda</p><h3>${e(data.title)}</h3><p>${e(data.introduction)}</p><div class="calendar-plants">${data.plants.map(plant=>{const source=sourceLink(plant.sourceUrl);return `<article><h4>${e(plant.commonName)}</h4><p class="calendar-latin"><i>${e(plant.scientificName)}</i></p><p>${e(plant.noteBotanicaBreve)}</p><p>${e(plant.editorialAssociation)}</p>${source?`<a href="${e(source)}" target="_blank" rel="noopener noreferrer">Fonte botanica ↗</a>`:''}</article>`;}).join('')}</div>${data.seasonNote?`<p class="calendar-small">${e(data.seasonNote)}</p>`:''}<div class="calendar-practice"><h4>Una domanda</h4><p>${e(data.question)}</p><h4>Un gesto da esplorare</h4><p>${e(data.practice)}</p></div>`;
 }
 function monthHTML(month){
  const events=calendar.astronomicalEvents.filter(event=>event.date>=month.startDate&&event.date<month.endDate);
  return `<p class="calendar-card-dates">${e(dateFormat.format(new Date(month.startDate)))} — ${e(dateFormat.format(new Date(Date.parse(month.endDate)-1)))} · ${month.durationDays} giorni · ${e(month.seasonLabel)} · Calendario meteorologico</p><section><h3>Il Sole attraversa</h3><p class="calendar-small">Segni tropicali e passaggi calcolati per ${calendar.year}. Orari in UTC.</p><div class="calendar-signs">${month.solarSigns.map(sign=>{const index=SIGNS.findIndex(value=>value.key===sign.key);return `<article><h4>${e(sign.label)}</h4><p>${e(utc(sign.startDate))}<br>→ ${e(utc(sign.endDate))}</p>${card(SIGN_ARCANA[index],`Corrispondenza del segno ${sign.label} · Golden Dawn`)}</article>`;}).join('')}</div><p class="calendar-small">Gli Arcani seguono le corrispondenze simboliche dei segni. Una lettura del calendario, aperta all’esplorazione.</p></section><section id="calendar-botanics">${plants(month)}</section><section><h3>Il ritmo della Luna</h3><ul class="calendar-phase-list">${month.lunarPhases.map(phase=>`<li><strong>${e(phase.label)}</strong><time datetime="${e(phase.date)}">${e(utc(phase.date))}</time></li>`).join('')}</ul><button type="button" class="natal-small-button" data-calendar-moon>Esplora Terra e Luna ↗</button></section>${events.length?`<section><h3>Soglie astronomiche del mese</h3>${events.map(event=>`<button type="button" class="calendar-event-link" data-calendar-select="event:${e(event.key)}"><span>${e(event.label)}</span><time datetime="${e(event.date)}">${e(utc(event.date))}</time></button>`).join('')}</section>`:''}<button type="button" class="natal-small-button" data-calendar-visit="${e(month.startDate)}">Visita questo mese in pausa ↗</button>`;
 }
 function seasonHTML(season){
  const months=season.sectorIndices.map(index=>calendar.sectors[index]);
  return `<p class="calendar-card-dates">${months.map(month=>e(month.name)).join(' · ')}</p><p>Il calendario meteorologico raccoglie tre mesi civili in ciascuna stagione. Questa fascia collega ${months.map(month=>e(month.name.toLowerCase())).join(', ')} lungo il percorso annuale della Terra.</p><p>I confini astronomici sono indicati dalle quattro linee tratteggiate, nelle date di equinozi e solstizi calcolate per ${calendar.year}.</p><div class="calendar-season-months">${months.map(month=>`<button type="button" data-calendar-select="${e(month.key)}">${e(month.name)} <span aria-hidden="true">↗</span></button>`).join('')}</div><p>Apri un mese per incontrare i suoi segni solari, gli Arcani, le botaniche e le fasi lunari.</p>`;
 }
 function eventHTML(event){
  const month=calendar.sectors.find(month=>event.date>=month.startDate&&event.date<month.endDate);
  const sign=SIGNS[event.longitude/30];
  const equinox=event.key.includes('equinox');
  return `<p class="calendar-card-dates"><time datetime="${e(event.date)}">${e(utc(event.date))}</time> · ${calendar.year}</p><p>${equinox?'Gli equinozi scandiscono i due passaggi del Sole attraverso l’equatore celeste.':'I solstizi scandiscono i due estremi annuali della declinazione del Sole.'} La data è calcolata per l’anno osservato e compare sul modello nella posizione terrestre corrispondente.</p><p>Questo passaggio apre anche il segno tropicale ${e(sign.name)}, alla longitudine solare di ${event.longitude}°.</p>${card(SIGN_ARCANA[event.longitude/30],`Corrispondenza di ${sign.name} · Golden Dawn`)}<p class="calendar-small">Le stagioni astronomiche iniziano agli equinozi e ai solstizi. Le fasce colorate raggruppano invece tre mesi meteorologici, così ogni mese mantiene il proprio nome e la propria durata.</p>${month?`<button type="button" class="natal-small-button" data-calendar-select="${e(month.key)}">Tutte le corrispondenze di ${e(month.name)} ↗</button>`:''}<button type="button" class="natal-small-button" data-calendar-visit="${e(event.date)}">Vai a questo istante, in pausa ↗</button>`;
 }
 function renderDetail(){
  if(!calendar||!selection)return;
  let title,html,kicker;
  if(selection.startsWith('season:')){const season=calendar.seasons.find(value=>'season:'+value.key===selection);if(!season)return;title=season.label;html=seasonHTML(season);kicker='Una stagione, tre mesi';}
  else if(selection.startsWith('event:')){const event=calendar.astronomicalEvents.find(value=>'event:'+value.key===selection);if(!event)return;title=event.label;html=eventHTML(event);kicker='Una soglia astronomica';}
  else{const month=calendar.sectors.find(value=>value.key===selection);if(!month)return;title=month.name;html=monthHTML(month);kicker='Il quaderno del mese';}
  const wasFocused=detail.contains(document.activeElement),activeAction=wasFocused?document.activeElement.dataset.calendarAction:null;
  const openCards=new Set([...detail.querySelectorAll('details[data-calendar-card][open]')].map(node=>node.dataset.calendarCard));
  detail.innerHTML=`<header><div><p class="section-caption">${e(kicker)} / ${calendar.year}</p><h2 id="calendar-detail-title">${e(title)}.</h2></div><button type="button" class="natal-reading-close" data-calendar-close aria-label="Chiudi la scheda del calendario">×</button></header>${nav()}${html}<footer><p>Dati astronomici: Astronomy Engine. Botaniche documentate e associazioni editoriali di Lavanda; tempi vegetali legati a luogo e clima. Corrispondenze Golden Dawn, con numerazione Rider–Waite–Smith.</p><button type="button" class="natal-small-button" data-calendar-close>Torna al calendario ↑</button></footer>`;
  for(const node of detail.querySelectorAll('details[data-calendar-card]'))if(openCards.has(node.dataset.calendarCard))node.open=true;
  for(const button of detail.querySelectorAll('button[data-calendar-select]'))button.dataset.calendarAction='select-'+button.dataset.calendarSelect;
  for(const button of detail.querySelectorAll('button[data-calendar-visit]'))button.dataset.calendarAction='visit';
  for(const [index,button] of [...detail.querySelectorAll('button[data-calendar-close]')].entries())button.dataset.calendarAction='close-'+index;
  for(const button of detail.querySelectorAll('button[data-calendar-focus],button[data-calendar-moon]'))button.dataset.calendarAction=button.hasAttribute('data-calendar-moon')?'moon':'focus';
  if(wasFocused)(activeAction?detail.querySelector(`[data-calendar-action="${CSS.escape(activeAction)}"]`)||detail:detail).focus({preventScroll:true});
 }
 function select(key,{trigger=null,focus=true}={}){
  if(!calendar)return;
  const valid=calendar.sectors.some(month=>month.key===key)||calendar.seasons.some(season=>'season:'+season.key===key)||calendar.astronomicalEvents.some(event=>'event:'+event.key===key);
  if(!valid)return;
  selection=key;lastTrigger=trigger||lastTrigger;renderDetail();detail.hidden=false;updateButtons();onOpenCard(detail);
  if(focus){detail.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});detail.focus({preventScroll:true});}
 }
 function close({restoreFocus=true}={}){
  detail.hidden=true;selection=null;onCloseCard(detail,{restoreFocus});updateButtons();
  const candidates=[lastTrigger,root.querySelector(`[data-calendar-select="${progress?.currentSectorKey}"]`)];
  if(restoreFocus)candidates.find(node=>node?.isConnected&&node.getClientRects().length)?.focus();
 }
 function handleClick(event){
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-calendar-close'))close();
  else if(target.dataset.calendarSelect)select(target.dataset.calendarSelect,{trigger:target});
  else if(target.dataset.calendarVisit)onVisitDate(new Date(target.dataset.calendarVisit));
  else if(target.hasAttribute('data-calendar-focus'))onFocusCalendar('calendar');
  else if(target.hasAttribute('data-calendar-moon'))onFocusCalendar('earth-moon');
 }
 root.addEventListener('click',event=>{if(!detail.contains(event.target))handleClick(event);});detail.addEventListener('click',handleClick);
 detail.addEventListener('change',event=>{if(event.target.matches('[data-calendar-month-select]'))select(event.target.value,{trigger:event.target,focus:false});});
 $('#solar-calendar-enabled').addEventListener('change',()=>{scene?.setCalendar($('#solar-calendar-enabled').checked?calendar:null);updateButtons();});
 function renderIndex(){
  $('#solar-calendar-year').textContent=String(calendar.year);
  $('#solar-calendar-months').innerHTML=calendar.sectors.map(month=>`<button type="button" data-calendar-select="${month.key}" aria-controls="solar-calendar-detail" aria-pressed="false" style="--season-color:${colors[month.seasonKey]}"><small>${String(month.month).padStart(2,'0')}</small>${e(month.name)}</button>`).join('');
  $('#solar-calendar-seasons').innerHTML=calendar.seasons.map(season=>`<button type="button" data-calendar-select="season:${season.key}" style="--season-color:${colors[season.key]}">${e(season.label)}</button>`).join('');
  $('#solar-calendar-events').innerHTML=calendar.astronomicalEvents.map(event=>`<button type="button" data-calendar-select="event:${event.key}"><span>${e(event.label)}</span><time datetime="${e(event.date)}">${e(utc(event.date))}</time></button>`).join('');
 }
 function update(date,engine){
  try{
   const year=date.getUTCFullYear();if(failedYear===year)return;
   if(calendar?.year!==year){calendar=computeSolarCalendar(date,{engine,hemisphere:'north'});progress=getSolarCalendarProgress(calendar,date);lastMonth=-1;scene?.setCalendar($('#solar-calendar-enabled').checked?calendar:null);renderIndex();if(selection)renderDetail();}
   progress=getSolarCalendarProgress(calendar,date);
   if(lastMonth!==progress.currentSectorIndex){lastMonth=progress.currentSectorIndex;$('#solar-calendar-current').textContent=`La Terra attraversa ${calendar.sectors[lastMonth].name.toLowerCase()}.`;updateButtons();}
   $('#solar-calendar-status').textContent='';
  }catch(error){failedYear=date.getUTCFullYear();$('#solar-calendar-status').textContent=error.message;}
 }
 fetch('/calendar-months.json').then(response=>{if(!response.ok)throw Error('unavailable');return response.json();}).then(data=>{content=data;const month=calendar?.sectors.find(month=>month.key===selection);if(month&&detail.querySelector('#calendar-botanics'))detail.querySelector('#calendar-botanics').innerHTML=plants(month);}).catch(()=>{contentError=true;const month=calendar?.sectors.find(month=>month.key===selection);if(month&&detail.querySelector('#calendar-botanics'))detail.querySelector('#calendar-botanics').innerHTML=plants(month);});
 return {update,select,close,detail,setScene(next){scene=next;scene?.setCalendar($('#solar-calendar-enabled').checked?calendar:null);updateButtons();}};
}
