function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
const publicURL=entry=>`/blog/${encodeURIComponent(entry.slug)}/`;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const DOCUMENT_PREFIX='LAVANDA_DOC_V1\n';
const DOGO_CDN='https://pub-b39e5084f7324516a4fe99c212a65c5f.r2.dev';
const DOCUMENT_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MEDIA_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES=['text','heading','quote','image','gallery','divider','audio','video','file'];
const byteLength=value=>new TextEncoder().encode(value).length;
function invalidDocument(message){const error=new Error(message);error.code='INVALID_DOCUMENT';throw error;}
function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function knownFields(value,fields){if(!plainObject(value)||Object.keys(value).some(key=>!fields.includes(key)))invalidDocument('Il documento contiene campi non validi.');}
function documentString(value,{max=500000,empty=true}={}){if(typeof value!=='string'||value.length>max||value.includes('\u0000')||(!empty&&!value))invalidDocument('Un testo del documento non è valido.');return value;}
function safePath(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\s\\<>"'\u0000-\u001f\u007f]/.test(value))return false;
 try{let decoded=value.split(/[?#]/,1)[0];for(let i=0;i<3;i++){const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}
  return !decoded.includes('%')&&!decoded.includes('\\')&&!decoded.includes('//')&&!/[<>"'\u0000-\u001f\u007f]/.test(decoded)&&!decoded.split('/').some(segment=>segment==='.'||segment==='..');
 }catch{return false;}
}

// Persistent document media has a deliberately narrow source allowlist.
// The known DOGO CDN is served through the site's same-origin /r2 proxy.
export function documentMediaURL(value,origins=[]){
 if(typeof value!=='string'||!value)return null;
 let local=value;
 if(!value.startsWith('/')){
  try{const raw=value.match(/^https:\/\/[^/?#]+(\/[^?#]*)?/i);if(!raw||!safePath(raw[1]||'/'))return null;const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return null;
   if(url.origin===DOGO_CDN){if(url.search||url.hash)return null;local='/r2'+url.pathname;}
   else if(origins.includes(url.origin))local=url.pathname+url.search+url.hash;
   else return null;
  }catch{return null;}
 }
 if(!safePath(local))return null;
 if(/^\/api\/media\?id=/.test(local)){
  const match=local.match(/^\/api\/media\?id=([0-9a-f-]+)$/i);return match&&MEDIA_UUID.test(match[1])?'/api/media?id='+match[1].toLowerCase():null;
 }
 if(/[?#]/.test(local)||!/^\/(?:assets|r2)\/.+/.test(local))return null;
 return local;
}
function safeDocumentLink(value,origins=[]){
 if(typeof value!=='string'||!value)return null;
 if(/^#[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(value))return value;
 const media=documentMediaURL(value,origins);if(media)return media;
 let local=value;
 if(!value.startsWith('/')){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!origins.includes(url.origin))return null;local=url.pathname+url.search+url.hash;}catch{return null;}}
 return safePath(local)?local:null;
}

function documentRuns(value,text){
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>5000)invalidDocument('La formattazione del testo non è valida.');
 const runs=value.map(run=>{knownFields(run,['text','marks']);const content=documentString(run.text);if(!Array.isArray(run.marks)||run.marks.some(mark=>!['bold','italic'].includes(mark)))invalidDocument('La formattazione del testo non è valida.');return {text:content,marks:[...new Set(run.marks)].sort()};});
 if(runs.map(run=>run.text).join('')!==text)invalidDocument('La formattazione non corrisponde al testo.');
 return runs;
}
function documentMedia(value,{origins=[],image=false}={}){
 knownFields(value,image?['media_id','src','alt','caption']:['media_id','src','caption','text']);
 const mediaId=value.media_id??null;if(mediaId!==null&&(typeof mediaId!=='string'||!DOCUMENT_ID.test(mediaId)))invalidDocument('Il riferimento al media non è valido.');
 const raw=value.src??'';documentString(raw,{max:2048});const src=raw?documentMediaURL(raw,origins):'';
 if(raw&&!src)invalidDocument('Il media deve usare la libreria o un indirizzo R2 autorizzato.');
 return {media_id:mediaId,src,caption:documentString(value.caption??'',{max:5000}),...(image?{alt:documentString(value.alt??'',{max:1000})}:{})};
}

export function validateDocument(document,{origins=[]}={}){
 knownFields(document,['version','blocks']);
 if(document.version!==1||!Array.isArray(document.blocks)||document.blocks.length>250)invalidDocument('Il documento può contenere fino a 250 blocchi.');
 let serialized;try{serialized=JSON.stringify(document);}catch{invalidDocument('Il documento non può essere salvato.');}
 if(byteLength(DOCUMENT_PREFIX+serialized)>500000)invalidDocument('Il documento supera il limite di 500000 byte.');
 const ids=new Set();
 const blocks=document.blocks.map(block=>{
  if(!plainObject(block)||!DOCUMENT_TYPES.includes(block.type))invalidDocument('Un tipo di blocco non è supportato.');
  const common=['id','type','width'],fields={text:['text','runs'],heading:['text','runs','level'],quote:['text','runs','cite'],image:['media_id','src','alt','caption'],gallery:['items'],divider:[],audio:['media_id','src','caption'],video:['media_id','src','caption'],file:['media_id','src','caption','text']}[block.type];
  knownFields(block,[...common,...fields]);
  if(typeof block.id!=='string'||!DOCUMENT_ID.test(block.id)||ids.has(block.id))invalidDocument('Ogni blocco deve avere un identificativo unico.');ids.add(block.id);
  const width=block.width??100;if(![25,50,75,100].includes(width))invalidDocument('La larghezza del blocco non è valida.');
  const result={id:block.id,type:block.type,width};
  if(['text','heading','quote'].includes(block.type)){
   result.text=documentString(block.text);const runs=documentRuns(block.runs,result.text);if(runs!==undefined)result.runs=runs;
   if(block.type==='heading'){result.level=block.level??2;if(![2,3,4].includes(result.level))invalidDocument('Il livello del capitolo non è valido.');}
   if(block.type==='quote')result.cite=documentString(block.cite??'',{max:500});
  }else if(block.type==='gallery'){
   if(!Array.isArray(block.items)||block.items.length>20)invalidDocument('Una galleria può contenere fino a 20 immagini.');
   result.items=block.items.map(item=>documentMedia(item,{origins,image:true}));
  }else if(['image','audio','video','file'].includes(block.type)){
   const mediaFields=Object.fromEntries(Object.entries(block).filter(([key])=>fields.includes(key)));
   Object.assign(result,documentMedia(mediaFields,{origins,image:block.type==='image'}));
   if(block.type==='file')result.text=documentString(block.text??'',{max:500});
  }
  return result;
 });
 const normalized={version:1,blocks};
 if(byteLength(DOCUMENT_PREFIX+JSON.stringify(normalized))>500000)invalidDocument('Il documento supera il limite di 500000 byte.');
 return normalized;
}
export function parseDocument(body,options={}){
 if(typeof body!=='string'||!body.startsWith(DOCUMENT_PREFIX))return null;
 if(byteLength(body)>500000)invalidDocument('Il documento supera il limite di 500000 byte.');
 let parsed;try{parsed=JSON.parse(body.slice(DOCUMENT_PREFIX.length));}catch{invalidDocument('Il documento salvato non è leggibile.');}
 return validateDocument(parsed,options);
}
export const serializeDocument=(document,options={})=>DOCUMENT_PREFIX+JSON.stringify(validateDocument(document,options));
export function documentHeadingId(block){if(!DOCUMENT_ID.test(block?.id||''))invalidDocument('Il capitolo non ha un identificativo valido.');return 'capitolo-'+block.id;}

export function renderInline(text,{origins=[],depth=0}={}){
 const source=String(text??'');if(depth>5)return escapeHTML(source);
 let html='',index=0,plainStart=0,noLinks=false;
 const nested=value=>renderInline(value,{origins,depth:depth+1});
 while(index<source.length){
  let end=-1,tag,content,consumed;
  if(source.startsWith('**',index)){end=source.indexOf('**',index+2);if(end>index+2){tag='strong';content=nested(source.slice(index+2,end));consumed=end+2;}}
  else if(source[index]==='_'){end=source.indexOf('_',index+1);if(end>index+1){tag='em';content=nested(source.slice(index+1,end));consumed=end+1;}}
  else if(source[index]==='['&&!noLinks){const close=source.indexOf('](',index+1);if(close<0)noLinks=true;else{end=source.indexOf(')',close+2);if(end>=0){const label=source.slice(index+1,close),href=safeDocumentLink(source.slice(close+2,end),origins);content=href?`<a href="${escapeHTML(href)}">${escapeHTML(label)}</a>`:escapeHTML(label);consumed=end+1;}else noLinks=true;}}
  if(consumed!==undefined){html+=escapeHTML(source.slice(plainStart,index));html+=tag?`<${tag}>${content}</${tag}>`:content;index=consumed;plainStart=index;}else index++;
 }
 return (html+escapeHTML(source.slice(plainStart))).replace(/\r?\n/g,'<br>');
}
const runOffsets=new WeakMap();
function richRange(block,start,end,options){
 if(!block.runs)return renderInline(block.text.slice(start,end),options);
 let ranges=runOffsets.get(block);if(!ranges){let position=0;ranges=block.runs.map(run=>{const range={run,start:position,end:position+run.text.length};position=range.end;return range;});runOffsets.set(block,ranges);}
 let lower=0,upper=ranges.length;while(lower<upper){const middle=(lower+upper)>>>1;if(ranges[middle].end<=start)lower=middle+1;else upper=middle;}
 let html='';
 for(let index=lower;index<ranges.length&&ranges[index].start<end;index++){const {run,start:position}=ranges[index],from=Math.max(0,start-position),to=Math.min(run.text.length,end-position);if(to>from){let part=renderInline(run.text.slice(from,to),options);if(run.marks.includes('italic'))part=`<em>${part}</em>`;if(run.marks.includes('bold'))part=`<strong>${part}</strong>`;html+=part;}}
 return html;
}
function richParagraphs(block,options){
 let cursor=0;
 return block.text.split(/\n\s*\n/).map(paragraph=>{
  const start=block.text.indexOf(paragraph,cursor);cursor=start+paragraph.length;
  const lines=paragraph.split('\n');
  if(lines.length&&lines.every(line=>/^[-*+]\s+/.test(line))){let offset=start;return '<ul>'+lines.map(line=>{const prefix=line.match(/^[-*+]\s+/)[0].length,html=richRange(block,offset+prefix,offset+line.length,options);offset+=line.length+1;return '<li>'+html+'</li>';}).join('')+'</ul>';}
  return '<p>'+richRange(block,start,start+paragraph.length,options)+'</p>';
 }).join('');
}
function blockMediaURL(media,origins){return MEDIA_UUID.test(media.media_id||'')?'/api/media?id='+media.media_id.toLowerCase():documentMediaURL(media.src,origins);}
function documentImage(media,options){const src=blockMediaURL(media,options.origins);return `<figure>${src?`<img src="${escapeHTML(src)}" alt="${escapeHTML(media.alt)}" loading="lazy" decoding="async">`:'<p class="document-media-pending">Immagine in preparazione.</p>'}${media.caption?`<figcaption>${renderInline(media.caption,options)}</figcaption>`:''}</figure>`;}
export function renderDocument(document,{origins=[]}={}){
 const normalized=validateDocument(document,{origins}),options={origins};
 return '<div class="lavanda-document">'+normalized.blocks.map(block=>{
  let html='';
  if(block.type==='text')html=richParagraphs(block,options);
  else if(block.type==='heading')html=`<h${block.level} id="${documentHeadingId(block)}">${richRange(block,0,block.text.length,options)}</h${block.level}>`;
  else if(block.type==='quote')html='<blockquote>'+richParagraphs(block,options)+(block.cite?'<cite>'+renderInline(block.cite,options)+'</cite>':'')+'</blockquote>';
  else if(block.type==='image')html=documentImage(block,options);
  else if(block.type==='gallery')html='<div class="document-gallery">'+block.items.map(item=>documentImage(item,options)).join('')+'</div>';
  else if(block.type==='divider')html='<hr>';
  else{const src=blockMediaURL(block,origins),caption=block.caption?'<figcaption>'+renderInline(block.caption,options)+'</figcaption>':'';
   if(block.type==='file')html=src?`<a class="document-file" href="${escapeHTML(src)}" download>${escapeHTML(block.text||block.caption||'Scarica il documento')}</a>`:'<p class="document-media-pending">Documento in preparazione.</p>';
   else html=`<figure>${src?`<${block.type} controls preload="metadata"${block.type==='video'?' playsinline':''} src="${escapeHTML(src)}"><a href="${escapeHTML(src)}">Scarica il contenuto</a></${block.type}>`:'<p class="document-media-pending">Contenuto in preparazione.</p>'}${caption}</figure>`;
  }
  return `<section class="document-block document-${block.type} document-width-${block.width}" data-block-id="${block.id}">${html}</section>`;
 }).join('')+'</div>';
}

// Content images use the site's media library. Absolute URLs on an explicitly
// trusted site origin are normalized to local paths; third-party URLs are omitted.
export function contentImageURL(value,origins=[]){
 if(typeof value!=='string'||/[\s\\<>"'\u0000-\u001f\u007f]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/i.test(value))return null;
 if(/^\/(?!\/)/.test(value))return value;
 try{const url=new URL(value);if(url.origin===DOGO_CDN)return documentMediaURL(value,origins);return url.protocol==='https:'&&!url.username&&!url.password&&origins.includes(url.origin)?url.pathname+url.search+url.hash:null;}catch{return null;}
}

// Shared by browser hydration and the server renderer. This deliberately small
// Markdown subset mirrors the editor's block tools and never interprets HTML.
export function renderMarkdown(body,{origins=[]}={}){
 if(typeof body==='string'&&body.startsWith(DOCUMENT_PREFIX)){
  try{return renderDocument(parseDocument(body,{origins}),{origins});}catch{return '<p class="document-unavailable">Questo contenuto è temporaneamente non disponibile.</p>';}
 }
 return String(body||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(value=>{
  const block=value.trim();if(!block)return '';
  if(/^(?:-{3,}|\*{3,}|_{3,})$/.test(block))return '<hr>';
  const heading=block.match(/^(#{1,6})\s+([^\n]+)$/);
  if(heading){const level=Math.max(2,heading[1].length);return `<h${level}>${renderInline(heading[2],{origins})}</h${level}>`;}
  const image=block.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if(image){const url=contentImageURL(image[2],origins);return url?`<figure><img src="${escapeHTML(url)}" alt="${escapeHTML(image[1])}" loading="lazy"></figure>`:'';}
  const lines=block.split('\n');
  if(lines.every(line=>/^>\s?/.test(line)))return `<blockquote><p>${renderInline(lines.map(line=>line.replace(/^>\s?/,'' )).join('\n'),{origins})}</p></blockquote>`;
  if(lines.every(line=>/^[-*+]\s+/.test(line)))return `<ul>${lines.map(line=>`<li>${renderInline(line.replace(/^[-*+]\s+/,''),{origins})}</li>`).join('')}</ul>`;
  return `<p>${renderInline(block,{origins})}</p>`;
 }).join('');
}
const safeMedia=value=>contentImageURL(value,[location.origin]);
function renderBody(body,container){container.innerHTML=renderMarkdown(body,{origins:[location.origin]});}
function liveCard(entry){
 const card=node('article',undefined,'article-card');card.dataset.article='';card.dataset.category=entry.metadata?.category_name||'Dal blog';card.dataset.search=[entry.title,entry.excerpt,...(entry.tags||[])].join(' ').toLocaleLowerCase('it');card.dataset.slug=entry.slug;
 const a=node('a',undefined,'article-image');a.href=publicURL(entry);const url=safeMedia(entry.metadata?.cover_url)||(entry.cover_media_id?`/api/media?id=${encodeURIComponent(entry.cover_media_id)}`:null);
 if(url){const img=node('img');img.src=url;img.alt=entry.metadata?.image_alt||entry.metadata?.cover_alt||'';img.loading='lazy';a.append(img);}else a.append(node('span','Lavanda','live-text-cover'));
 const meta=node('div',undefined,'article-meta');meta.append(node('span',card.dataset.category),node('span','Dal blog'));
 const h=node('h3');const title=node('a',entry.title);title.href=publicURL(entry);h.append(title);card.append(a,meta,h,node('p',entry.excerpt||''));return card;
}
async function request(query){const response=await fetch(`/api/public?${query}`,{headers:{Accept:'application/json'}});if(!response.ok)return null;return response.json();}
export async function hydratePublishedContent(){
 const slug=new URLSearchParams(location.search).get('slug');
 const placeholder=document.querySelector('[data-entry-placeholder]');
 if(placeholder){
  if(!slug){placeholder.replaceChildren(node('h1','Quale percorso cerchi?'),node('p','Scegli uno scritto dal blog.'));return;}
  try{const result=await request(`resource=entries&slug=${encodeURIComponent(slug)}`);const entry=Array.isArray(result?.data)?result.data[0]:result?.data;
   if(!entry){placeholder.replaceChildren(node('h1','Questa lettura non è disponibile.'),node('p','Potrebbe essere ancora in preparazione. Torna al blog per scegliere un altro scritto.'));return;}
   document.title=`${entry.seo?.title||entry.title} | Lavanda`;
   const description=document.querySelector('meta[name=description]');if(description)description.content=entry.seo?.description||entry.excerpt||'';
   const header=node('header',undefined,'article-header wrap');const back=node('a','Torna agli scritti','text-link');back.href='/blog/';header.append(back,node('h1',entry.title));if(entry.metadata?.subtitle)header.append(node('p',entry.metadata.subtitle,'article-subtitle'));
   const prose=node('div',undefined,'prose live-prose wrap');if(entry.excerpt)prose.append(node('p',entry.excerpt,'lead'));renderBody(entry.body,prose);const end=node('a','Torna agli scritti','text-link');end.href='/blog/';prose.append(end);
   const children=[header];
   const cover=safeMedia(entry.metadata?.cover_url)||(entry.cover_media_id?`/api/media?id=${encodeURIComponent(entry.cover_media_id)}`:null);
   if(cover){const figure=node('figure',undefined,'article-hero wrap');const image=node('img');image.src=cover;image.alt=entry.metadata?.image_alt||entry.metadata?.cover_alt||'';figure.append(image);children.push(figure);}
   placeholder.replaceChildren(...children,prose);
  }catch{placeholder.replaceChildren(node('h1','La lettura non è disponibile in questo momento.'),node('p','Puoi continuare a leggere gli scritti presenti nel blog.'));}
 }
 const archive=document.querySelector('.archive-grid');if(!archive)return;
 try{const result=await request('resource=entries&type=post&limit=100');if(!Array.isArray(result?.data)||!result.data.length)return;
  for(const entry of result.data){const existing=[...archive.children].find(el=>el.dataset.slug===entry.slug);if(existing)existing.replaceWith(liveCard(entry));else archive.prepend(liveCard(entry));}
  const filterGroup=document.querySelector('.filters');const categories=new Set([...filterGroup.querySelectorAll('[data-filter]')].map(el=>el.dataset.filter));
  for(const category of new Set(result.data.map(row=>row.metadata?.category_name||'Dal blog'))){if(!categories.has(category)){const b=node('button',category);b.type='button';b.dataset.filter=category;b.setAttribute('aria-pressed','false');filterGroup.append(b);}}
  document.dispatchEvent(new CustomEvent('lavanda-content-updated'));
 }catch{}
}
