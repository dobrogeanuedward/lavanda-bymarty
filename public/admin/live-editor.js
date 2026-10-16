// The browser and Node tests share the public renderer's document contract.
const format = await import(typeof window === 'undefined' ? '../../src/public-content.js' : '../public-content.js');
export const DOCUMENT_PREFIX = format.DOCUMENT_PREFIX;
export const parseDocument = format.parseDocument;
export const validateDocument = format.validateDocument;
export const serializeDocument = format.serializeDocument;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
export const STORAGE_KEY = 'lavanda-studio-v1';
// Add only the newly introduced shop page; existing author work is authoritative.
export function mergeMissingShopPage(current,seed) {
  if(!Array.isArray(current?.entries)||current.entries.some(row=>row.type==='page'&&row.slug==='shop'))return {state:current,added:false};
  const page=seed?.entries?.find(row=>row.type==='page'&&row.slug==='shop');
  if(!page)return {state:current,added:false};
  const normalized={...page,id:page.id||'seed-shop',type:'page',slug:'shop',title:page.title||'La piccola bottega',excerpt:page.excerpt||'',body:String(page.body||''),status:'draft',tags:page.tags||[],seo:page.seo||{},metadata:{...page.metadata},version:page.version||1,updated_at:page.updated_at||new Date().toISOString()};
  return {state:{...current,entries:[...current.entries,normalized]},added:true};
}
const IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
const uuid = () => globalThis.crypto.randomUUID();
const element = (tag,text,className) => {
  const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;
};
export function safeEditorURL(value,origin='') { return format.documentMediaURL(value,origin?[origin]:[]); }
export function createBlock(type,values={}) {
  const base={id:uuid(),type,width:100};
  if(['text','heading','quote'].includes(type))base.text='';
  if(type==='heading')base.level=2;
  if(type==='quote')base.cite='';
  if(type==='gallery')base.items=[];
  if(['image','audio','video','file'].includes(type))Object.assign(base,{media_id:null,src:'',caption:''});
  if(type==='image')base.alt='';
  if(type==='file')base.text='';
  return validateDocument({version:1,blocks:[{...base,...values}]}).blocks[0];
}
export function reorderBlocks(blocks,id,targetIndex) {
  const index=blocks.findIndex(block=>block.id===id);
  if(index<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=blocks.length)throw new Error('Scegli una posizione valida per il blocco.');
  const ordered=[...blocks];const [moved]=ordered.splice(index,1);ordered.splice(targetIndex,0,moved);return ordered;
}
export function validateUpload(file) {
  if(!file||!Number.isSafeInteger(file.size)||file.size<1)throw new Error('Il file è vuoto o non è leggibile.');
  if(![...IMAGE_TYPES,'application/pdf'].includes(file.type))throw new Error('Puoi importare immagini JPEG, PNG, WebP, GIF, AVIF e PDF. Per audio e video usa un URL R2.');
  if(file.size>MAX_IMPORT_BYTES)throw new Error('Il file supera 40 MB. Riducilo prima di importarlo.');
  if(file.type==='application/pdf'&&file.size>MAX_UPLOAD_BYTES)throw new Error('I PDF possono pesare fino a 3 MB. Comprimi il documento prima di importarlo.');
  if(file.type==='image/gif'&&file.size>MAX_UPLOAD_BYTES)throw new Error('Le GIF animate possono pesare fino a 3 MB. Riducile prima di importarle.');
  return {needsCompression:file.size>MAX_UPLOAD_BYTES,image:IMAGE_TYPES.includes(file.type)};
}
export function hasDocumentContent(doc) {
  return doc.blocks.some(block=>['text','heading','quote'].includes(block.type)?!!block.text.trim():block.type==='gallery'?block.items.some(item=>item.media_id||item.src):['image','audio','video','file'].includes(block.type)?!!(block.media_id||block.src):false);
}
export function documentFromBody(body,{origin=''}={}) {
  const parsed=parseDocument(body,{origins:origin?[origin]:[]});if(parsed)return parsed;
  const blocks=[];
  for(const chunk of String(body||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/)) {
    const text=chunk.trim();if(!text)continue;
    const heading=text.match(/^(#{1,6})\s+([^\n]+)(?:\n([\s\S]*))?$/);
    const image=text.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
    if(heading){blocks.push(createBlock('heading',{text:heading[2],level:Math.min(4,Math.max(2,heading[1].length))}));if(heading[3])blocks.push(createBlock('text',{text:heading[3]}));}
    else if(/^(?:-{3,}|\*{3,}|_{3,})$/.test(text))blocks.push(createBlock('divider'));
    else if(text.split('\n').every(line=>/^>\s?/.test(line)))blocks.push(createBlock('quote',{text:text.split('\n').map(line=>line.replace(/^>\s?/,'' )).join('\n')}));
    else if(image&&safeEditorURL(image[2],origin))blocks.push(createBlock('image',{src:safeEditorURL(image[2],origin),alt:image[1]}));
    else blocks.push(createBlock('text',{text}));
  }
  if(!blocks.length)blocks.push(createBlock('text'));
  return validateDocument({version:1,blocks},{origins:origin?[origin]:[]});
}
// contenteditable produces DOM, but only text and two explicit marks persist.
// Pasted HTML is prevented separately; no HTML string is ever executed or saved.
export function readRichText(root) {
  const runs=[];
  function append(text,marks){if(!text)return;const sorted=[...new Set(marks)].sort();const last=runs.at(-1);if(last&&JSON.stringify(last.marks)===JSON.stringify(sorted))last.text+=text;else runs.push({text,marks:sorted});}
  function walk(node,marks=[]) {
    if(node.nodeType===3){append(node.nodeValue||'',marks);return;}
    if(node.nodeType!==1)return;
    const tag=node.tagName?.toUpperCase();
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH'].includes(tag))return;
    if(tag==='BR'){append('\n',marks);return;}
    const next=[...marks];if(['B','STRONG'].includes(tag))next.push('bold');if(['I','EM'].includes(tag))next.push('italic');
    const paragraph=node!==root&&['DIV','P','LI'].includes(tag);
    if(paragraph&&runs.length&&!runs.at(-1).text.endsWith('\n'))append('\n',marks);
    for(const child of node.childNodes||[])walk(child,next);
    if(paragraph&&!runs.at(-1)?.text.endsWith('\n'))append('\n',marks);
  }
  walk(root);
  // Browser-generated wrapper paragraphs add one terminal line break.
  if(runs.at(-1)?.text.endsWith('\n')){runs.at(-1).text=runs.at(-1).text.slice(0,-1);if(!runs.at(-1).text)runs.pop();}
  const text=runs.map(run=>run.text).join('');
  return {text,...(runs.some(run=>run.marks.length)?{runs}:{})};
}

async function boot() {
  const $=selector=>document.querySelector(selector);
  const params=new URLSearchParams(location.search),requestedId=params.get('entry');
  let mode=params.get('mode')==='remote'?'remote':'local',entry,doc,state={},account=null,media=[],editable=false,preview=false,dirty=false,saving=false,revision=0,selected=null,selection=null,dragged=null,uploadTarget=null,autosave,timer;
  const blobURLs=new Map(),knownMedia=new Map();
  const statusNames={draft:'Bozza',review:'In revisione',scheduled:'Programmato',published:'Pubblicato',archived:'Archiviato',trash:'Cestino'};
  function toast(message){$('#live-toast').textContent=message;$('#live-toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#live-toast').hidden=true,6000);}
  function status(message,error=false){$('#live-status').textContent=message;$('#live-status').dataset.dirty=String(dirty);$('#live-status').dataset.error=String(error);}
  function canPublish(){return mode==='remote'&&account?.profile?.active&&['admin','editor'].includes(account.profile.role);}
  function permissions(){
    const role=account?.profile?.role;
    editable=mode==='local'||!!(account?.profile?.active&&['admin','editor','author'].includes(role)&&(role!=='author'||entry.author_id===account.user?.id&&['draft','review','trash'].includes(entry.status)));
    document.body.dataset.readonly=String(!editable);
    for(const control of ['#save-document','#save-draft'])$(control).disabled=!editable||saving;
    $('#publish-document').disabled=!editable||!canPublish()||saving;
    $('#publish-document').title=mode==='local'?'La pubblicazione richiede il CMS collegato.':canPublish()?'Pubblica questo contenuto e i media utilizzati.':'La pubblicazione richiede un editor o un amministratore.';
    document.querySelectorAll('[data-editable]').forEach(node=>{node.contentEditable=String(editable&&!preview);node.setAttribute('aria-readonly',String(!editable||preview));});
    document.querySelectorAll('.live-image-alt input').forEach(node=>node.disabled=!editable||preview);
  }
  async function request(url,options={}) {
    let response;try{response=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-CMS-Request':'1',...(options.headers||{})}});}catch{throw new Error('Il CMS non è raggiungibile. Il lavoro resta aperto: riprova a salvare.');}
    let payload;try{payload=await response.json();}catch{throw new Error('Il CMS non ha restituito una conferma valida.');}
    if(!response.ok){const error=new Error(payload.error?.message||(response.status===409?'Il testo è cambiato in un’altra finestra. Esporta la bozza prima di ricaricare.':response.status===401?'La sessione è scaduta. Accedi dalla redazione e poi riprova; il lavoro resta aperto.':'Operazione non riuscita.'));error.status=response.status;throw error;}
    return payload;
  }
  function readLocal(){let current;try{current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{throw new Error('Il salvataggio locale non è leggibile. Apri la redazione per recuperare un backup.');}return current||state;}
  function writeLocal(value){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{throw new Error('Lo spazio del browser è esaurito o non disponibile. Esporta la bozza prima di chiudere.');}}
  function blobStore(action,id,blob){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('lavanda-studio-media',1);
      open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('files'))open.result.createObjectStore('files');};
      open.onerror=()=>reject(new Error('La libreria locale non è disponibile.'));
      open.onsuccess=()=>{const database=open.result,tx=database.transaction('files',action==='get'?'readonly':'readwrite'),store=tx.objectStore('files');let result;
        const job=action==='get'?store.get(id):action==='delete'?store.delete(id):store.put(blob,id);job.onsuccess=()=>{result=job.result;};
        tx.oncomplete=()=>{database.close();resolve(result);};tx.onabort=tx.onerror=()=>{database.close();reject(new Error('Il file non è stato salvato nella libreria locale.'));};};
    });
  }
  async function hydrateMedia(){for(const row of media){knownMedia.set(row.id,row);if(row.local_file){const blob=await blobStore('get',row.id);if(blob){if(blobURLs.has(row.id))URL.revokeObjectURL(blobURLs.get(row.id));blobURLs.set(row.id,URL.createObjectURL(blob));}}}}
  function mediaSource(value){if(value?.media_id&&blobURLs.has(value.media_id))return blobURLs.get(value.media_id);const row=knownMedia.get(value?.media_id);return safeEditorURL(value?.src||row?.public_url||'',location.origin)||(mode==='remote'&&value?.media_id?`/api/media?id=${encodeURIComponent(value.media_id)}`:'');}
  function coverSource(){return mediaSource({media_id:entry.cover_media_id,src:entry.metadata?.cover_url});}
  function editableNode(tag,text,{field,placeholder,rich=false,className=''}={}) {
    const node=element(tag,undefined,className);node.dataset.editable='';node.contentEditable=String(editable&&!preview);node.spellcheck=true;node.setAttribute('role','textbox');node.setAttribute('aria-multiline','true');if(field)node.dataset.field=field;if(field==='title')node.id='live-title';if(placeholder){node.dataset.placeholder=placeholder;node.setAttribute('aria-label',placeholder);}if(rich)node.dataset.rich='';
    if(Array.isArray(text)){for(const run of text){let child=document.createTextNode(run.text);if(run.marks.includes('italic')){const em=element('em');em.append(child);child=em;}if(run.marks.includes('bold')){const strong=element('strong');strong.append(child);child=strong;}node.append(child);}}
    else node.textContent=text||'';
    return node;
  }
  function blockControls(block){const tools=element('div',undefined,'live-block-controls');tools.setAttribute('aria-label','Sposta o rimuovi il blocco');
    for(const [action,label,symbol] of [['drag','Trascina il blocco','⠿'],['up','Sposta il blocco prima','↑'],['down','Sposta il blocco dopo','↓'],['remove','Rimuovi il blocco','×']]){const button=element('button',symbol,action==='drag'?'live-drag':'');button.type='button';button.dataset.blockAction=action;button.setAttribute('aria-label',label);button.title=label;if(action==='drag')button.draggable=true;tools.append(button);}return tools;}
  function renderImage(item,index){const figure=element('figure');figure.dataset.imageIndex=String(index);const src=mediaSource(item);if(src){const img=element('img');img.src=src;img.alt=item.alt||'';img.loading='lazy';figure.append(img);}else figure.append(element('div','Immagine disponibile nella libreria locale.','live-media-placeholder'));
    figure.append(editableNode('figcaption',item.caption,{field:'caption',placeholder:'Una didascalia, se serve'}));
    const label=element('label','Descrizione immagine','live-image-alt'),input=element('input');input.value=item.alt||'';input.maxLength=1000;input.dataset.imageAlt='';input.setAttribute('aria-label','Testo alternativo dell’immagine');input.placeholder='Descrivi l’immagine per chi non può vederla';label.append(input);figure.append(label);return figure;}
  function renderBlock(block){
    const section=element('section',undefined,`live-block document-block document-${block.type} document-width-${block.width}`);section.dataset.blockId=block.id;section.dataset.width=String(block.width);section.dataset.type=block.type;section.id=format.documentHeadingId(block);section.append(blockControls(block));
    const rich=block.runs||block.text;
    if(block.type==='text')section.append(editableNode('p',rich,{field:'text',rich:true,placeholder:'Inizia a scrivere…',className:'live-block-content'}));
    else if(block.type==='heading')section.append(editableNode(`h${block.level}`,rich,{field:'text',rich:true,placeholder:'Titolo del capitolo',className:'live-block-content'}));
    else if(block.type==='quote'){const quote=element('blockquote');quote.append(editableNode('p',rich,{field:'text',rich:true,placeholder:'Una voce da ascoltare…',className:'live-block-content'}),editableNode('cite',block.cite,{field:'cite',placeholder:'Autrice, autore o fonte'}));section.append(quote);}
    else if(block.type==='image')section.append(renderImage(block,0));
    else if(block.type==='gallery'){const gallery=element('div',undefined,'live-gallery document-gallery');block.items.forEach((item,i)=>gallery.append(renderImage(item,i)));if(!block.items.length)gallery.append(element('div','Aggiungi immagini alla gallery.','live-media-placeholder'));section.append(gallery);}
    else if(block.type==='divider')section.append(element('hr'));
    else if(block.type==='file'){const link=element('a',undefined,'live-file-link');const src=mediaSource(block);if(src){link.href=src;link.target='_blank';link.rel='noopener';link.download='';}link.append(element('span','↗'),element('span',block.text||'Apri il documento','live-file-label'));section.append(link,editableNode('figcaption',block.caption,{field:'caption',placeholder:'Descrizione del documento'}));}
    else {const src=mediaSource(block);if(src){const player=element(block.type);player.controls=true;player.preload='metadata';player.src=src;if(block.type==='video')player.playsInline=true;section.append(player);}else section.append(element('div','Aggiungi l’indirizzo del contenuto.','live-media-placeholder'));section.append(editableNode('figcaption',block.caption,{field:'caption',placeholder:'Titolo o didascalia'}));}
    return section;
  }
  function outline(){const nav=$('#live-outline');if(!nav)return;nav.replaceChildren();const headings=doc.blocks.filter(block=>block.type==='heading');if(!headings.length)nav.append(element('span','I capitoli appariranno qui.'));for(const block of headings){const a=element('a',block.text||'Nuovo capitolo');a.href='#'+format.documentHeadingId(block);if(block.id===selected)a.setAttribute('aria-current','true');nav.append(a);}}
  function render(){
    const article=element('article',undefined,'live-article');
    const header=element('header',undefined,'article-header wrap'),meta=element('div',undefined,'article-meta');meta.append(element('span',entry.metadata?.category_name||({post:'Dal blog',page:'Il progetto',fanzine:'Il quaderno'}[entry.type]||'Lavanda')),element('span','Scrittura in corso'));
    header.append(meta,editableNode('h1',entry.title==='Senza titolo'?'':entry.title,{field:'title',placeholder:'Il titolo della tua ricerca',className:'live-title'}),editableNode('p',entry.metadata?.subtitle||'',{field:'subtitle',placeholder:'Un sottotitolo, una domanda…',className:'article-subtitle live-subtitle'}));
    const byline=element('div',undefined,'byline');byline.append(element('span',mode==='local'?'Lavanda / Bozza su questo dispositivo':`Lavanda / ${statusNames[entry.status]||entry.status}`),element('span','Clicca sul testo per scrivere'));header.append(byline);
    const cover=element('figure',undefined,'article-hero wrap live-cover');const source=coverSource();if(source){const img=element('img');img.src=source;img.alt=entry.metadata?.image_alt||entry.metadata?.cover_alt||'';cover.append(img);}else cover.classList.add('empty');const changeCover=element('button',source?'Cambia copertina':'+ Aggiungi una copertina');changeCover.type='button';changeCover.dataset.cover='';cover.append(changeCover);
    const layout=element('div',undefined,'reading-layout wrap live-reading-layout'),aside=element('aside',undefined,'reading-index live-reading-index');aside.append(element('p','In questa lettura'));const nav=element('nav');nav.id='live-outline';nav.setAttribute('aria-label','Capitoli dello scritto');aside.append(nav,element('p','Trascina un blocco dal piccolo segno accanto al testo, oppure usa le frecce.','live-index-note'));
    const prose=element('div',undefined,'prose live-prose-editor');prose.append(editableNode('p',entry.excerpt||'',{field:'excerpt',placeholder:'L’introduzione: il punto da cui partire…',className:'lead'}));const blocks=element('div');blocks.id='live-blocks';doc.blocks.forEach(block=>blocks.append(renderBlock(block)));prose.append(blocks);
    const add=element('button','+ Continua con un nuovo paragrafo','live-add-after');add.type='button';add.dataset.add='text';prose.append(add);const end=element('div',undefined,'live-end');const emblem=element('img');emblem.src='/brand/emblem.svg';emblem.alt='';emblem.width=44;emblem.height=44;end.append(emblem,element('p','Buon ritorno al centro.'));prose.append(end);layout.append(aside,prose);article.append(header,cover,layout);$('#live-main').replaceChildren(article);$('#live-main').setAttribute('aria-busy','false');outline();permissions();if(selected)selectBlock(selected);globalThis.LavandaBranding?.apply?.();
  }
  function sync(){
    if(!entry||!doc)return;
    const title=$('[data-field=title]');if(title)entry.title=title.textContent.trim()||'Senza titolo';
    const subtitle=$('[data-field=subtitle]');if(subtitle)entry.metadata={...entry.metadata,subtitle:subtitle.textContent};
    const excerpt=$('[data-field=excerpt]');if(excerpt)entry.excerpt=excerpt.textContent;
    for(const block of doc.blocks){const root=document.querySelector(`[data-block-id="${block.id}"]`);if(!root)continue;
      if(['text','heading','quote'].includes(block.type)){Object.assign(block,readRichText(root.querySelector('[data-rich]')));if(!root.querySelector('[data-rich] strong,[data-rich] b,[data-rich] em,[data-rich] i'))delete block.runs;}
      if(block.type==='quote')block.cite=root.querySelector('[data-field=cite]')?.textContent||'';
      if(block.type==='image'||block.type==='gallery'){for(const figure of root.querySelectorAll('[data-image-index]')){const item=block.type==='gallery'?block.items[Number(figure.dataset.imageIndex)]:block;item.caption=figure.querySelector('figcaption')?.textContent||'';item.alt=figure.querySelector('[data-image-alt]')?.value||'';}}
      else if(['audio','video','file'].includes(block.type))block.caption=root.querySelector('[data-field=caption]')?.textContent||'';
    }
  }
  function markDirty(){if(!editable)return;dirty=true;revision++;status('Modifiche da salvare');outline();clearTimeout(autosave);if(mode==='local')autosave=setTimeout(()=>save({silent:true}),1600);}
  function selectBlock(id){selected=id;document.querySelectorAll('.live-block').forEach(node=>node.dataset.selected=String(node.dataset.blockId===id));const block=doc.blocks.find(block=>block.id===id);if(block)$('#block-width').value=String(block.width);outline();}
  function focusBlock(id){const node=document.querySelector(`[data-block-id="${id}"]`);node?.querySelector('[contenteditable=true]')?.focus();node?.scrollIntoView({block:'nearest',behavior:'smooth'});}
  function addBlock(block,index){sync();const at=index??(selected?doc.blocks.findIndex(item=>item.id===selected)+1:doc.blocks.length);doc.blocks.splice(at,0,block);selected=block.id;markDirty();render();focusBlock(block.id);}
  async function publishMedia(){
    const ids=new Set([entry.cover_media_id,...doc.blocks.flatMap(block=>block.type==='gallery'?block.items.map(item=>item.media_id):block.media_id?[block.media_id]:[])]);ids.delete(null);ids.delete(undefined);ids.delete('');
    for(const id of ids){const result=await request(`/api/cms?resource=media&id=${encodeURIComponent(id)}`);const row=Array.isArray(result.data)?result.data[0]:result.data;if(!row)throw new Error('Un’immagine non è più nella libreria. Sostituiscila prima di pubblicare.');if(!row.published){const saved=(await request(`/api/cms?resource=media&id=${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({version:row.version,published:true})})).data;knownMedia.set(id,saved);}}
  }
  function metadata(){const allowed=['subtitle','cover_url','image_alt','source_note','category_name','source_status','issue_number','article_ids'];const value=Object.fromEntries(Object.entries(entry.metadata||{}).filter(([key])=>allowed.includes(key)));if(!value.image_alt&&entry.metadata?.cover_alt)value.image_alt=entry.metadata.cover_alt;return value;}
  async function save({publish=false,draft=false,silent=false}={}) {
    if(!editable||saving)return false;clearTimeout(autosave);sync();
    if(publish&&!canPublish()){toast(mode==='local'?'Questa è una bozza locale. Collega il CMS dalla redazione per pubblicare.':'La pubblicazione richiede un editor.');return false;}
    try{
      if(entry.title.length>240||entry.excerpt.length>1000||String(entry.metadata?.subtitle||'').length>500)throw new Error('Riduci titolo (240 caratteri), introduzione (1.000) o sottotitolo (500) prima di salvare.');
      const body=serializeDocument(doc,{origins:[location.origin]});if(publish&&!hasDocumentContent(doc))throw new Error('Aggiungi un testo o un’immagine prima di pubblicare.');
      const snapshot=revision,desiredStatus=mode==='local'?'draft':publish?'published':draft?'draft':entry.status;
      saving=true;permissions();status(publish?'Pubblicazione…':'Salvataggio…');
      const payload={title:entry.title,excerpt:entry.excerpt,body,metadata:metadata(),status:desiredStatus,version:entry.version};
      let saved;
      if(mode==='local'){
        const latest=readLocal(),old=latest.entries?.find(row=>row.id===entry.id);if(!old)throw new Error('La bozza non è più nello spazio locale. Esporta il lavoro prima di chiudere.');if((old.version||1)!==(entry.version||1))throw new Error('La bozza è stata modificata in un’altra finestra. Esporta il lavoro prima di ricaricare.');
        saved={...old,...payload,version:(old.version||1)+1,updated_at:new Date().toISOString()};
        latest.entries=latest.entries.map(row=>row.id===entry.id?saved:row);latest.revisions=[{id:uuid(),entry_id:old.id,snapshot:old,created_at:saved.updated_at},...(latest.revisions||[])].slice(0,120);latest.activity=[{id:uuid(),message:`Bozza salvata sulla pagina: ${saved.title}.`,date:saved.updated_at},...(latest.activity||[])].slice(0,40);writeLocal(latest);state=latest;
      }else{if(['published','scheduled'].includes(desiredStatus))await publishMedia();saved=(await request(`/api/cms?resource=entries&id=${encodeURIComponent(entry.id)}`,{method:'PATCH',body:JSON.stringify(payload)})).data;if(!saved?.id||!Number.isInteger(saved.version))throw new Error('Il CMS non ha confermato il salvataggio.');}
      const changed=snapshot!==revision;entry={...entry,...saved};dirty=changed;status(changed?'Modifiche da salvare':mode==='local'?'Bozza salvata qui':publish?'Pubblicato nel CMS':`Salvato · ${statusNames[entry.status]||entry.status}`);
      if(!silent)toast(mode==='local'?'Bozza salvata su questo dispositivo.':publish?'Contenuto pubblicato.':'Modifiche salvate nel CMS.');
      if(changed&&mode==='local')autosave=setTimeout(()=>save({silent:true}),1600);return true;
    }catch(error){status('Salvataggio non riuscito',true);toast(error.message||'Salvataggio non riuscito. Il lavoro resta aperto.');return false;}finally{saving=false;permissions();}
  }
  function closeDialog(){$('#live-dialog').close();}
  function showDialog(title,content){const root=$('#live-dialog-content'),h=element('h2',title);h.id='live-dialog-title';root.replaceChildren(h,content);$('#live-dialog').showModal();}
  function dialogActions(submit='Inserisci'){const actions=element('div',undefined,'live-dialog-actions'),cancel=element('button','Annulla');cancel.type='button';cancel.addEventListener('click',closeDialog);const add=element('button',submit,'live-primary');add.type='submit';actions.append(cancel,add);return actions;}
  function urlDialog(type){const form=element('form'),description=element('p',type==='file'?'Collega un PDF già nella libreria o su R2. Puoi anche caricarlo dal pulsante Documento PDF.':'Usa il collegamento diretto a un file audio o video già su R2. Le pagine YouTube, gli iframe e gli script non vengono incorporati.');const label=element('label','Indirizzo del file'),input=element('input');input.required=true;input.placeholder='https://… oppure /r2/…';label.append(input);const captionLabel=element('label','Titolo o didascalia'),caption=element('input');caption.maxLength=500;captionLabel.append(caption);form.append(description,label,captionLabel,dialogActions());form.addEventListener('submit',event=>{event.preventDefault();const src=safeEditorURL(input.value.trim(),location.origin);if(!src){toast('Scegli un URL della libreria o del bucket R2 di Lavanda.');return;}closeDialog();addBlock(createBlock(type,{src,caption:caption.value,...(type==='file'?{text:caption.value}:{})}));});showDialog(type==='audio'?'Aggiungi un audio':type==='video'?'Aggiungi un video':'Collega un documento',form);}
  function libraryDialog({cover=false}={}){
    const wrapper=element('div');wrapper.append(element('p','Scegli un’immagine della libreria oppure importa un nuovo file.'));const grid=element('div',undefined,'live-library');
    for(const row of media.filter(row=>row.mime_type?.startsWith('image/'))){const button=element('button'),source=mediaSource({media_id:row.id,src:row.public_url});button.type='button';if(source){const img=element('img');img.src=source;img.alt=row.alt||row.title||'';button.append(img);}button.append(element('span',row.title||'Immagine'));button.addEventListener('click',()=>{closeDialog();if(cover){sync();entry.cover_media_id=row.id;entry.metadata={...entry.metadata,cover_url:row.local_file?'':safeEditorURL(row.public_url,location.origin)||'',image_alt:row.alt||''};markDirty();render();}else addBlock(createBlock('image',{media_id:row.id,src:row.local_file?'':safeEditorURL(row.public_url,location.origin)||'',alt:row.alt||'',caption:row.caption||''}));});grid.append(button);}
    wrapper.append(grid);const actions=element('div',undefined,'live-dialog-actions'),upload=element('button','Importa un’immagine','live-primary');upload.type='button';upload.addEventListener('click',()=>{closeDialog();uploadTarget={type:'image',cover};$('#live-files').accept=IMAGE_TYPES.join(',');$('#live-files').multiple=!cover;$('#live-files').click();});const cancel=element('button','Chiudi');cancel.type='button';cancel.addEventListener('click',closeDialog);actions.append(cancel,upload);wrapper.append(actions);showDialog(cover?'Scegli la copertina':'Dalla tua libreria',wrapper);
  }
  async function prepareFile(file){
    const info=validateUpload(file);
    if(!info.image){if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw new Error('Il documento non è un PDF valido.');return file;}
    let image;try{image=await createImageBitmap(file);}catch{throw new Error('Questa immagine non è leggibile nel browser. Prova JPEG, PNG o WebP.');}
    try{
      if(image.width*image.height>100000000)throw new Error('L’immagine ha dimensioni troppo grandi. Riducila prima di importarla.');
      if(!info.needsCompression&&Math.max(image.width,image.height)<=2200)return file;
      let dimension=2200;
      while(dimension>=1000){const scale=Math.min(1,dimension/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('Il browser non può ridurre questa immagine.');context.drawImage(image,0,0,canvas.width,canvas.height);
        for(const quality of [.88,.76,.62,.48]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=MAX_UPLOAD_BYTES){const name=file.name.replace(/\.[^.]+$/,'')+'.webp';return new File([blob],name,{type:blob.type,lastModified:Date.now()});}}dimension-=400;}
      throw new Error('L’immagine resta oltre 3 MB. Riducila prima di importarla.');
    }finally{image.close();}
  }
  async function importFiles(files,target=uploadTarget||{type:'image'}){
    if(!editable)return;if(files.length>20){toast('Importa fino a 20 immagini alla volta.');return;}sync();const items=[];let failures=0;
    for(const original of files){try{
      status('Preparo il file…');const file=await prepareFile(original);let row;
      if(mode==='local'){const id=uuid();await blobStore('put',id,file);row={id,title:file.name.replace(/\.[^.]+$/,''),filename:file.name,mime_type:file.type,size_bytes:file.size,alt:'',caption:'',credit:'',folder:'Caricamenti',local_file:true,version:1,created_at:new Date().toISOString()};const latest=readLocal();latest.media=[row,...(latest.media||[])];try{writeLocal(latest);}catch(error){await blobStore('delete',id);throw error;}state=latest;blobURLs.set(id,URL.createObjectURL(file));}
      else {const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Il file non è leggibile.'));reader.readAsDataURL(file);});row=(await request('/api/media',{method:'POST',body:JSON.stringify({filename:file.name,mime_type:file.type,content_base64:base64,title:file.name.replace(/\.[^.]+$/,''),alt:'',folder:'Caricamenti'})})).data;if(!row?.id)throw new Error('Il caricamento non è stato confermato.');}
      media.unshift(row);knownMedia.set(row.id,row);const item={media_id:row.id,src:row.local_file?'':safeEditorURL(row.public_url,location.origin)||'',alt:row.alt||'',caption:row.caption||''};
      if(target.cover){entry.cover_media_id=row.id;entry.metadata={...entry.metadata,cover_url:item.src,image_alt:item.alt};}
      else if(row.mime_type==='application/pdf')addBlock(createBlock('file',{media_id:row.id,src:item.src,caption:'',text:row.title}),target.index);
      else items.push(item);
    }catch(error){failures++;toast(`${original.name}: ${error.message}`);}}
    if(items.length){if(target.type==='gallery'||items.length>1)addBlock(createBlock('gallery',{items}),target.index);else addBlock(createBlock('image',items[0]),target.index);}
    if(target.cover){markDirty();render();}
    if(items.length&&!failures)toast(mode==='local'?'Immagini aggiunte alla bozza locale.':'Immagini caricate nella libreria privata.');
    if(!dirty)status(mode==='local'?'Bozza su questo dispositivo':statusNames[entry.status]);$('#live-files').value='';uploadTarget=null;
  }
  function exportDraft(){sync();const value=JSON.stringify({format:'lavanda-live-draft',entry:{...entry,body:serializeDocument(doc,{origins:[location.origin]})}},null,2),url=URL.createObjectURL(new Blob([value],{type:'application/json'})),a=element('a');a.href=url;a.download=`lavanda-${entry.slug||'bozza'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function rememberSelection(){const current=window.getSelection();if(current?.rangeCount){const range=current.getRangeAt(0);if(range.commonAncestorContainer.parentElement?.closest('[data-rich]'))selection=range.cloneRange();}}
  function applyFormat(command){if(!editable||preview)return;const current=window.getSelection();if(selection){current.removeAllRanges();current.addRange(selection);}const node=current?.anchorNode?.parentElement;if(!node?.closest('[data-rich]')){toast('Seleziona una parola nel testo per formattarla.');return;}document.execCommand(command,false);sync();markDirty();rememberSelection();}
  document.addEventListener('input',event=>{if(event.target.closest('#live-main')&&editable&&!preview){sync();markDirty();}});
  document.addEventListener('focusin',event=>{const block=event.target.closest('.live-block');if(block)selectBlock(block.dataset.blockId);});
  document.addEventListener('mouseup',rememberSelection);document.addEventListener('keyup',rememberSelection);
  $('.live-tools').addEventListener('mousedown',event=>{if(event.target.closest('[data-format]'))event.preventDefault();});
  document.addEventListener('paste',event=>{const target=event.target.closest('[contenteditable=true]');if(!target)return;event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,text);sync();markDirty();});
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-block-action]');if(action&&editable&&!preview){const id=action.closest('.live-block').dataset.blockId,index=doc.blocks.findIndex(block=>block.id===id);sync();if(action.dataset.blockAction==='remove'){doc.blocks.splice(index,1);if(!doc.blocks.length)doc.blocks.push(createBlock('text'));selected=doc.blocks[Math.min(index,doc.blocks.length-1)].id;}else if(action.dataset.blockAction!=='drag'){const next=index+(action.dataset.blockAction==='up'?-1:1);if(next<0||next>=doc.blocks.length)return;doc.blocks=reorderBlocks(doc.blocks,id,next);selected=id;}else return;markDirty();render();focusBlock(selected);return;}
    const add=event.target.closest('[data-add]');if(add&&editable&&!preview){$('#insert-menu').open=false;const type=add.dataset.add;if(['image','gallery','file'].includes(type)){uploadTarget={type};$('#live-files').accept=type==='file'?'application/pdf':IMAGE_TYPES.join(',');$('#live-files').multiple=type!=='file';$('#live-files').click();}else if(type==='library')libraryDialog();else if(['audio','video'].includes(type))urlDialog(type);else addBlock(createBlock(type));return;}
    const convert=event.target.closest('[data-convert]');if(convert&&editable&&!preview){sync();const index=doc.blocks.findIndex(block=>block.id===selected);if(index<0||!['text','heading','quote'].includes(doc.blocks[index].type)){toast('Seleziona prima un blocco di testo.');return;}const old=doc.blocks[index],type=convert.dataset.convert;doc.blocks[index]=createBlock(type,{id:old.id,width:old.width,text:old.text,...(old.runs?{runs:old.runs}:{})});markDirty();render();focusBlock(selected);return;}
    const bold=event.target.closest('[data-format]');if(bold)applyFormat(bold.dataset.format);
    if(event.target.closest('[data-cover]')&&editable&&!preview)libraryDialog({cover:true});
    const link=event.target.closest('.live-file-link');if(link&&!preview&&editable)event.preventDefault();
  });
  $('#block-width').addEventListener('change',()=>{if(!editable||preview)return;sync();const block=doc.blocks.find(block=>block.id===selected);if(!block){toast('Seleziona prima un blocco.');return;}block.width=Number($('#block-width').value);markDirty();render();});
  $('#save-document').addEventListener('click',()=>save());$('#save-draft').addEventListener('click',()=>save({draft:true}));$('#publish-document').addEventListener('click',()=>save({publish:true}));
  $('#export-draft').addEventListener('click',exportDraft);
  $('#toggle-preview').addEventListener('click',()=>{sync();preview=!preview;document.body.dataset.preview=String(preview);$('#toggle-preview').setAttribute('aria-pressed',String(preview));$('#toggle-preview').textContent=preview?'Torna a scrivere':'Anteprima';permissions();});
  $('#live-files').addEventListener('change',event=>importFiles([...event.target.files]));
  $('#live-dialog').addEventListener('click',event=>{if(event.target===$('#live-dialog'))closeDialog();});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='e'){event.preventDefault();exportDraft();}if((event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())&&event.target.closest('[data-rich]')){event.preventDefault();rememberSelection();applyFormat(event.key.toLowerCase()==='b'?'bold':'italic');}if(event.key==='Escape')$('#insert-menu').open=false;});
  document.addEventListener('dragstart',event=>{const handle=event.target.closest('.live-drag');if(!handle||!editable||preview){if(event.target.closest('#live-main'))event.preventDefault();return;}sync();dragged=handle.closest('.live-block').dataset.blockId;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragged);});
  document.addEventListener('dragover',event=>{if(!editable||preview||!event.target.closest('#live-main'))return;event.preventDefault();document.querySelectorAll('[data-drop=true]').forEach(node=>delete node.dataset.drop);event.target.closest('.live-block')?.setAttribute('data-drop','true');});
  document.addEventListener('drop',event=>{if(!event.target.closest('#live-main'))return;event.preventDefault();document.querySelectorAll('[data-drop=true]').forEach(node=>delete node.dataset.drop);if(!editable||preview)return;const target=event.target.closest('.live-block'),index=target?doc.blocks.findIndex(block=>block.id===target.dataset.blockId):doc.blocks.length;
    if(event.dataTransfer.files.length){importFiles([...event.dataTransfer.files],{type:'image',index});dragged=null;return;}
    if(dragged){sync();const original=doc.blocks.findIndex(block=>block.id===dragged),next=Math.max(0,Math.min(index-(original<index?1:0),doc.blocks.length-1));doc.blocks=reorderBlocks(doc.blocks,dragged,next);selected=dragged;dragged=null;markDirty();render();focusBlock(selected);}});
  document.addEventListener('dragend',()=>{dragged=null;document.querySelectorAll('[data-drop=true]').forEach(node=>delete node.dataset.drop);});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{for(const url of blobURLs.values())URL.revokeObjectURL(url);});
  try{
    if(mode==='remote'){
      const config=await request('/api/config');if(!config.configured)throw new Error('Il CMS deve essere collegato prima di aprire questa pagina remota.');account=(await request('/api/auth')).data;entry=(await request(`/api/cms?resource=entries&id=${encodeURIComponent(requestedId||'')}`)).data;if(Array.isArray(entry))entry=entry[0];
      for(let offset=0;offset<10000;offset+=100){const result=await request(`/api/cms?resource=media&limit=100&offset=${offset}`);media.push(...(result.data||[]));if(result.data.length<100||media.length>=result.count)break;}
    }else{
      state=readLocal();if(!Array.isArray(state.entries)){const response=await fetch('/admin/seed.json');if(!response.ok)throw new Error('I materiali iniziali non sono disponibili.');state=await response.json();state.revisions=[];state.activity=[];state.entries=(state.entries||[]).map(row=>({...row,version:row.version||1,status:row.status||'draft',metadata:{...row.metadata,image_alt:row.metadata?.image_alt||row.metadata?.cover_alt||''}}));writeLocal(state);}
      if(!state.entries.some(row=>row.type==='page'&&row.slug==='shop')){try{const response=await fetch('/admin/seed.json');if(response.ok){const migrated=mergeMissingShopPage(state,await response.json());if(migrated.added){writeLocal(migrated.state);state=migrated.state;}}}catch{/* Existing local work remains usable while offline. */}}
      entry=state.entries.find(row=>row.id===requestedId)||(!requestedId?state.entries[0]:null);media=state.media||[];
    }
    if(!entry)throw new Error('Questo contenuto non è disponibile. Scegli uno scritto dalla redazione.');entry=structuredClone(entry);entry.metadata||={};entry.excerpt||='';entry.version||=1;doc=documentFromBody(entry.body,{origin:location.origin});
    // A quaderno's existing pages become a continuous editable reading on first use.
    if(entry.type==='fanzine'&&!String(entry.body||'').startsWith(DOCUMENT_PREFIX)&&entry.fanzine_pages?.length){const blocks=[];for(const page of entry.fanzine_pages){if(page.title)blocks.push(createBlock('heading',{text:page.title}));blocks.push(...documentFromBody(page.body,{origin:location.origin}).blocks);if(page.media_id)blocks.push(createBlock('image',{media_id:page.media_id,alt:page.title||'',caption:''}));}doc=validateDocument({version:1,blocks});}
    await hydrateMedia();permissions();render();$('#export-draft').disabled=false;$('#live-exit').href='/admin/#contents';
    $('#live-mode').textContent=mode==='local'?'Bozza locale · Salvataggio automatico su questo dispositivo. Per pubblicare, collega il CMS dalla redazione.':editable?'CMS collegato · Salva per sincronizzare. I file importati restano privati fino alla pubblicazione.':'Sola lettura · Il tuo ruolo non consente di modificare questo contenuto.';
    status(mode==='local'?'Bozza locale':statusNames[entry.status]||'CMS collegato');document.title=`${entry.title} · Scrivi sulla pagina | Lavanda`;
    if(globalThis.ResizeObserver){const measure=()=>{document.documentElement.style.setProperty('--live-bar-height',`${$('.live-bar').getBoundingClientRect().height}px`);document.documentElement.style.setProperty('--live-tools-height',`${$('.live-tools').getBoundingClientRect().height}px`);};const observer=new ResizeObserver(measure);observer.observe($('.live-bar'));observer.observe($('.live-tools'));measure();}
  }catch(error){$('#live-main').replaceChildren();const wrapper=element('div',undefined,'live-loading wrap');wrapper.append(element('h1','La pagina ha bisogno di un passaggio.'),element('p',error.message),element('p','Il contenuto originale è conservato. Torna alla redazione per accedere o scegliere uno scritto.'));const link=element('a','Torna alla redazione','text-link');link.href='/admin/';wrapper.append(link);$('#live-main').append(wrapper);$('#live-main').setAttribute('aria-busy','false');status('Pagina non disponibile',true);}
}
if(typeof document!=='undefined'&&document.querySelector('#live-editor'))boot();
