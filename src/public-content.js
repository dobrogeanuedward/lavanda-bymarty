function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
const publicURL=entry=>`/lettura/?slug=${encodeURIComponent(entry.slug)}`;
function safeMedia(value){if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return null;try{const u=new URL(value,location.origin);return u.origin===location.origin?u.pathname+u.search:null;}catch{return null;}}
function renderBody(body,container){
 for(const block of String(body||'').split(/\n\s*\n/)){
  if(!block.trim())continue;
  if(/^#{1,4}\s/.test(block)){const text=block.replace(/^#{1,4}\s+/,'');container.append(node('h2',text));}
  else container.append(node('p',block));
 }
}
function liveCard(entry){
 const card=node('article',undefined,'article-card');card.dataset.article='';card.dataset.category=entry.metadata?.category_name||'Dal blog';card.dataset.search=[entry.title,entry.excerpt,...(entry.tags||[])].join(' ').toLocaleLowerCase('it');card.dataset.slug=entry.slug;
 const a=node('a',undefined,'article-image');a.href=publicURL(entry);const url=safeMedia(entry.metadata?.cover_url)||(entry.cover_media_id?`/api/media?id=${encodeURIComponent(entry.cover_media_id)}`:null);
 if(url){const img=node('img');img.src=url;img.alt=entry.metadata?.cover_alt||'';img.loading='lazy';a.append(img);}else a.append(node('span','Lavanda','live-text-cover'));
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
   placeholder.replaceChildren(header,prose);
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
