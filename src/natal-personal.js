import {buildNatalLunarReading} from './natal-lunar-reading.js';
import {SIGN_ARCANA,TAROT_CARDS} from './natal-tarot.js';
import {cardSVG,escapeHTML as e} from './natal-visuals.js';

const utcFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const utc=value=>utcFormat.format(new Date(value))+' UTC';
const number=value=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
const join=values=>values.length<2?values.join(''):values.slice(0,-1).join(', ')+' e '+values.at(-1);
const source=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};

function phaseDisc(fraction,angle){
 const illumination=Math.max(0,Math.min(1,fraction)),direction=angle<180?1:-1,points=[];
 for(let sample=0;sample<=48;sample++){const theta=-Math.PI/2+Math.PI*sample/48;points.push([50+direction*42*Math.cos(theta),50+42*Math.sin(theta)]);}
 for(let sample=48;sample>=0;sample--){const theta=-Math.PI/2+Math.PI*sample/48;points.push([50+direction*(1-2*illumination)*42*Math.cos(theta),50+42*Math.sin(theta)]);}
 return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="none" stroke="#b58cff" stroke-width=".5"/><circle cx="50" cy="50" r="42" fill="#171124"/><path d="M${points.map(point=>point.map(value=>value.toFixed(3)).join(',')).join('L')}Z" fill="#faf4dd"/><circle cx="50" cy="50" r="42" fill="none" stroke="#bba8d2" stroke-width=".4"/></svg>`;
}

export function personalNarrative(model,voices){
  const sign=model.moonSign,alchemy=model.alchemy,phase=model.phase,options=model.phaseOptions;
  const voice=sign.certain?voices[sign.key]:null;
  const parts=[];
  if(!model.unknownTime){
   parts.push(`<p class="personal-lead">Alla tua nascita la Luna si trovava in ${e(sign.label)}, nella fase «${e(phase.label)}». Nel percorso di Lavanda questo tratto del ciclo prende il nome di ${e(alchemy.label)}.</p>`);
  }else{
   parts.push(`<p class="personal-lead">La tua giornata di nascita apre una lettura con alcuni fili ancora da precisare. ${sign.certain?`La Luna rimane in ${e(sign.label)} nell’intervallo calcolato.`:`Il segno della Luna può essere ${e(join(sign.options.map(item=>item.label)))}.`} ${alchemy.certain?`Il ciclo attraversa il passaggio di ${e(alchemy.label)}.`:'Anche il passaggio alchemico cambia durante la giornata.'}</p>`);
  }
  if(voice){
   parts.push(`<p>${e(voice.lens)}</p>`);
   if(alchemy.certain&&voice.bridge?.[alchemy.key])parts.push(`<p>${e(voice.bridge[alchemy.key])}</p>`);
  }else if(sign.options.length){
   parts.push(`<div class="personal-possibilities">${sign.options.map(item=>{const text=voices[item.key];return text?`<section><h4>Se la Luna fosse in ${e(item.label)}</h4><p>${e(text.lens)}</p>${alchemy.certain&&text.bridge?.[alchemy.key]?`<p>${e(text.bridge[alchemy.key])}</p>`:''}</section>`:'';}).join('')}</div>`);
  }
  if(sign.certain&&options.length===1&&options[0].content){
   const signCard=TAROT_CARDS.find(card=>card.number===SIGN_ARCANA[sign.signIndex]);
   const phaseCard=TAROT_CARDS.find(card=>card.number===options[0].content.arcana?.[0]);
   if(signCard&&phaseCard)parts.push(`<p>${signCard.number===phaseCard.number?`${e(signCard.name)} ritorna sia dal segno della Luna sia dal tratto del ciclo: il tema «${e(signCard.keyword)}» tiene insieme i due ingressi.`:`${e(signCard.name)} porta il tema «${e(signCard.keyword)}» dal segno della Luna; ${e(phaseCard.name)} gli accosta «${e(phaseCard.keyword)}» dal momento del ciclo.`} ${model.plants.length?`Accanto alle carte, ${e(join(model.plants.map(plant=>plant.commonName.toLowerCase())))} offrono immagini vegetali con cui osservare questo incontro.`:''}</p>`);
  }
  if(model.unknownTime&&(options.length>1||!alchemy.certain)){
   parts.push(`<section class="personal-phase-options"><h4>I passaggi possibili del giorno</h4>${options.map(option=>`<article><h5>${e(option.alchemyLabel)} · dal passaggio «${e(option.label)}»</h5>${option.content?`<p>${e(option.content.introduction)}</p>`:''}${[...new Set(model.alternatives.filter(path=>path.phaseKey===option.key).map(path=>path.signKey))].map(key=>{const text=voices[key],signOption=sign.options.find(item=>item.key===key);return text?.bridge?.[option.alchemyKey]?`<p class="personal-small">Se la nascita cade in questo tratto, con la Luna in ${e(signOption?.label||key)}:</p><p>${e(text.bridge[option.alchemyKey])}</p>`:'';}).join('')}${option.intervals?.length?`<p class="personal-small">${option.intervals.map(interval=>`${e(utc(interval.startDate||interval.start))} → ${e(utc(interval.endDate||interval.end))}`).join('<br>')}</p>`:''}</article>`).join('')}</section>`);
  }
  return parts.join('');
 }

/** Public editorial data is cached; each birth reading lives only in memory. */
export function createNatalPersonalReading({root,toggle,onExplore=()=>{}}){
 let chart=null,engine=null,model=null,version=0,opened=false,phaseContent={},voices={},contentReady=false,contentErrors=[],dataPromise=null,loadVersion=0;
 function load(){
  const requestVersion=++loadVersion;contentReady=false;
  dataPromise=Promise.allSettled(['/lunar-phases.json','/natal-lunar-voices.json'].map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Contenuto non disponibile');const value=await response.json();if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Formato non disponibile');return value;})).then(results=>{
   if(requestVersion!==loadVersion)return;
   phaseContent=results[0].status==='fulfilled'?results[0].value:{};voices=results[1].status==='fulfilled'?results[1].value:{};
   contentErrors=results.flatMap((result,index)=>result.status==='rejected'?[index===0?'Arcani del ciclo e botaniche':'Testi dell’intreccio']:[]);contentReady=true;
  });
  return dataPromise;
 }
 load();
 function rebuild(){model=buildNatalLunarReading(chart,{engine,phaseContent});}
 function arcanaHTML(){
  return model.cards.map(item=>{const card=TAROT_CARDS.find(card=>card.number===item.card);if(!card)return '';return `<details class="personal-arcana" data-personal-card="${card.number}"><summary data-personal-action="arcana-${card.number}">${cardSVG(card)}<span><strong>${e(card.roman)} · ${e(card.name)}</strong><small>${item.conditional?'Una possibilità da confermare':'Una figura nel tuo percorso'}</small></span><b aria-hidden="true">＋</b></summary><div><ul>${item.reasons.map(reason=>`<li>${e(reason)}</li>`).join('')}</ul><p>${e(card.description)}</p><blockquote>${e(card.question)}</blockquote><p>${e(card.practice)}</p></div></details>`;}).join('');
 }
 function plantHTML(){
  if(!model.plants.length)return '';
  return `<section class="personal-plants"><p class="section-caption">Le forme vegetali del tuo percorso</p><h4>${model.plants.length===2?'Due radici per l’immaginazione.':'Radici per l’immaginazione.'}</h4>${model.plants.length>2?'<p class="personal-small">Le alternative del ciclo aprono più botaniche: ogni accostamento resta legato al suo passaggio possibile.</p>':''}<div>${model.plants.map(plant=>{const url=source(plant.sourceUrl),phases=(plant.phaseKeys||[]).map(key=>model.phaseOptions.find(phase=>phase.key===key)?.label).filter(Boolean);return `<article><h5>${e(plant.commonName)}</h5><p class="personal-latin"><i>${e(plant.scientificName)}</i></p>${plant.conditional?`<p class="personal-conditional">Accostamento possibile${phases.length?': '+e(join(phases)):''}</p>`:''}<p>${e(plant.noteBotanicaBreve)}</p>${(plant.associations?.length>1?plant.associations:[{editorialAssociation:plant.editorialAssociation}]).map(association=>`<p>${e(association.editorialAssociation)}</p>`).join('')}${url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">Fonte botanica ↗</a>`:''}</article>`;}).join('')}</div></section>`;
 }
 function render(){
  if(!model)return;
  const wasFocused=root.contains(document.activeElement),action=wasFocused?document.activeElement.dataset.personalAction:null;
  const openCards=new Set([...root.querySelectorAll('details[data-personal-card][open]')].map(node=>node.dataset.personalCard));
  const voice=model.moonSign.certain?voices[model.moonSign.key]:null;
  const certain=model.alchemy.certain&&model.moonSign.certain;
  const title=certain?`${model.alchemy.label}, Luna in ${model.moonSign.label}.`:'Una lettura ancora aperta.';
  const fraction=model.unknownTime?model.representative?.illuminatedFraction:model.phase.illuminatedFraction;
  const angle=model.unknownTime?model.representative?.phaseAngle:model.phase.phaseAngle;
  const phaseLabel=model.phase.certain?model.phase.label:join((model.phase.options||[]).map(item=>item.label));
  root.dataset.alchemy=model.alchemy.certain?model.alchemy.key:'open';
  root.innerHTML=`<header><div><p class="section-caption">La tua lettura / Luna, materia, trasformazione</p><h3 id="natal-personal-title" data-personal-action="title" tabindex="-1">${e(title)}</h3><p class="personal-subtitle">${e(voice?.title||'Un filo fra cielo e immaginazione.')}</p></div><button type="button" class="natal-reading-close" data-personal-close data-personal-action="close" aria-label="Chiudi la lettura personale">×</button></header><div class="personal-sky">${Number.isFinite(fraction)&&Number.isFinite(angle)?`<figure>${phaseDisc(fraction,angle)}<figcaption>${model.unknownTime?'Immagine all’istante rappresentativo':'Forma del disco, vista convenzionale dal nord'}</figcaption></figure>`:''}<dl><div><dt>${model.unknownTime?'Fase nella giornata':'Fase della nascita'}</dt><dd>${e(phaseLabel||'Da confermare')}</dd></div><div><dt>Il passaggio alchemico</dt><dd>${e(model.alchemy.certain?model.alchemy.label:join(model.alchemy.options.map(item=>item.label)))}</dd></div><div><dt>La Luna nel segno</dt><dd>${e(model.moonSign.certain?model.moonSign.label:join(model.moonSign.options.map(item=>item.label)))}</dd></div>${Number.isFinite(fraction)?`<div><dt>${model.unknownTime?'Luce al riferimento del giorno':'Disco illuminato alla nascita'}</dt><dd>${number(fraction*100)}%</dd></div>`:''}</dl></div>${model.notices?.filter(notice=>!notice.startsWith('I contenuti editoriali')).length?`<aside class="personal-notice">${model.notices.filter(notice=>!notice.startsWith('I contenuti editoriali')).map(notice=>`<p>${e(notice)}</p>`).join('')}</aside>`:''}<div class="personal-prose">${personalNarrative(model,voices)}</div>${!contentReady?'<p class="personal-small" role="status">Preparo i testi, gli Arcani del ciclo e le botaniche…</p>':''}${contentErrors.length?`<p class="personal-small" role="status">Alcuni contenuti non sono disponibili: ${e(join(contentErrors))}.</p><button type="button" class="natal-small-button" data-personal-retry data-personal-action="retry">Ricarica i testi ↻</button>`:''}<section class="personal-cards"><p class="section-caption">Le immagini che tengono insieme i fili</p><h4>Gli Arcani del tuo intreccio.</h4><p class="personal-small">Apri una carta per leggere il significato e tutti i motivi del suo collegamento.</p><div>${arcanaHTML()}</div></section>${plantHTML()}${voice?`<section class="personal-practice"><p class="section-caption">Una domanda da portare con te</p><blockquote>${e(voice.question)}</blockquote><p>${e(voice.practice)}</p></section>`:''}<footer><button type="button" class="natal-small-button" data-personal-explore data-personal-action="explore">Esplora il tuo ciclo in 3D ↗</button><p>Una lettura simbolica di Lavanda composta dai dati della tua carta. Arcani del segno e della Luna: tradizione Golden Dawn. Arcani del ciclo, titoli alchemici, botaniche e testi d’intreccio: scelte editoriali di Lavanda. Le fonti botaniche accompagnano ogni pianta.</p><details><summary>Come nasce questa lettura?</summary><p>${model.unknownTime?'Verifichiamo tutti gli intervalli della giornata locale calcolata. Le alternative rimangono tali; l’istante rappresentativo serve soltanto alla mappa e all’immagine del disco.':`La fase è calcolata alla data e all’ora della carta, espresse in UTC: ${e(utc(model.utc))}. Il segno della Luna proviene dalla stessa carta.`} La fase visibile e il settore editoriale sono dati distinti: gli otto settori sono delimitati da passaggi di elongazione a 45°. Ogni coppia prende uno dei quattro nomi alchemici. La lettura riunisce gli Arcani del settore, l’Arcano del segno della Luna e La Papessa, conservando le ragioni delle coincidenze.</p><p>I testi sono inviti alla riflessione: puoi accogliere, discutere o riscrivere il significato di un’immagine. La lettura rimane nel browser e viene eliminata quando cambi o cancelli i dati.</p></details></footer>`;
  root.hidden=!opened;toggle.hidden=false;toggle.setAttribute('aria-expanded',String(opened));toggle.textContent=opened?'Chiudi la lettura lunare ↑':'Apri la tua lettura lunare ↗';
  for(const node of root.querySelectorAll('details[data-personal-card]'))if(openCards.has(node.dataset.personalCard))node.open=true;
  if(wasFocused)(action?root.querySelector(`[data-personal-action="${CSS.escape(action)}"]`)||root:root).focus({preventScroll:true});
 }
 function show({focus=true}={}){
  if(!model)return;opened=true;root.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.textContent='Chiudi la lettura lunare ↑';
  if(focus){root.querySelector('#natal-personal-title').focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 }
 function close(){opened=false;root.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Apri la tua lettura lunare ↗';toggle.focus({preventScroll:true});}
 function clear(){version++;chart=null;engine=null;model=null;opened=false;root.hidden=true;root.replaceChildren();delete root.dataset.alchemy;toggle.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function setChart(next,nextEngine){
  clear();chart=next;engine=nextEngine;opened=true;const token=version;rebuild();render();
  if(!contentReady)dataPromise.then(()=>{if(token!==version||!chart)return;rebuild();render();});
 }
 toggle.addEventListener('click',()=>opened?close():show());
 root.addEventListener('click',event=>{
  if(event.target.closest('[data-personal-close]'))close();
  if(event.target.closest('[data-personal-explore]'))onExplore();
  if(event.target.closest('[data-personal-retry]')){const token=version;load();render();dataPromise.then(()=>{if(token!==version||!chart)return;rebuild();render();});}
 });
 return {setChart,show,clear};
}
