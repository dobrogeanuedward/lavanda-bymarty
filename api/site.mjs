import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {configuration,rows,SLUG,UUID} from '../lib/cms.mjs';
import {contentImageURL,renderMarkdown,parseDocument,DOCUMENT_PREFIX} from '../src/public-content.js';
import {applySitePresentation} from '../lib/site-presentation.mjs';
import {resolveRedirect} from './redirect.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields='id,type,title,slug,excerpt,body,cover_media_id,tags,seo,metadata,published_at,updated_at,fanzine_pages';
function media(row,origins=[]){if(UUID.test(row.cover_media_id||''))return `/api/media?id=${encodeURIComponent(row.cover_media_id)}`;return contentImageURL(row.metadata?.cover_url,origins);}
const imageAlt=row=>row.metadata?.image_alt||row.metadata?.cover_alt||'';
function card(row,origins=[]){const url=`/blog/${encodeURIComponent(row.slug)}/`;const image=media(row,origins);return `<article class="article-card" data-article data-slug="${escape(row.slug)}" data-category="${escape(row.metadata?.category_name||'Dal blog')}" data-search="${escape([row.title,row.excerpt,...(row.tags||[])].join(' ').toLocaleLowerCase('it'))}"><a class="article-image" href="${url}">${image?`<img src="${escape(image)}" alt="${escape(imageAlt(row))}" loading="lazy">`:'<span class="live-text-cover">Lavanda</span>'}</a><div class="article-meta"><span>${escape(row.metadata?.category_name||'Dal blog')}</span><span>Lavanda</span></div><h3><a href="${url}">${escape(row.title)}</a></h3><p>${escape(row.excerpt)}</p></article>`;}
function reading(row,origins=[]){
 const content=`${row.excerpt?`<p class="lead">${escape(row.excerpt)}</p>`:''}${renderMarkdown(row.body,{origins})}<div class="reading-end"><img src="/brand/emblem.svg" width="48" height="48" alt=""><p>Buon ritorno al centro.</p></div>`;
 let chapters=[];try{chapters=(parseDocument(row.body,{origins})?.blocks||[]).filter(block=>block.type==='heading');}catch{}
 if(!chapters.length)return `<div class="prose live-prose wrap">${content}</div>`;
 return `<div class="reading-layout wrap"><aside class="reading-index"><p>In questa lettura</p><nav aria-label="Indice dei capitoli">${chapters.map(block=>`<a href="#capitolo-${escape(block.id)}">${escape(block.text)}</a>`).join('')}</nav></aside><div class="prose">${content}</div></div>`;
}
function article(row,origins=[]){const image=media(row,origins);return `<article><header class="article-header wrap"><a class="text-link" href="/blog/">Torna agli scritti</a><div class="article-meta"><span>${escape(row.metadata?.category_name||'Lavanda')}</span></div><h1>${escape(row.title)}</h1>${row.metadata?.subtitle?`<p class="article-subtitle">${escape(row.metadata.subtitle)}</p>`:''}</header>${image?`<figure class="article-hero wrap"><img src="${escape(image)}" alt="${escape(imageAlt(row))}"></figure>`:''}${reading(row,origins)}</article>`;}

async function issue(row,config,publishedAt){
 if(String(row.body||'').startsWith(DOCUMENT_PREFIX)){
  return `<section class="zine-intro wrap"><div><p class="section-caption">Digital fanzine</p><h1>${escape(row.title)}</h1></div><button class="print-button" type="button">Stampa il quaderno</button></section><article>${reading(row,config.origins)}</article>`;
 }
 const ids=[...new Set((Array.isArray(row.metadata?.article_ids)?row.metadata.article_ids:[]).filter(id=>typeof id==='string'&&UUID.test(id)))].slice(0,100);
 const customPages=Array.isArray(row.fanzine_pages)?row.fanzine_pages:[];
 const mediaIds=[...new Set(customPages.map(page=>page.media_id).filter(id=>typeof id==='string'&&UUID.test(id)))].slice(0,100);
 const [linked,images]=await Promise.all([
  ids.length?rows(config,'cms_entries',new URLSearchParams({select:fields,type:'eq.post',id:`in.(${ids.join(',')})`,status:'in.(published,scheduled)',published_at:`lte.${publishedAt}`,limit:'100'})):Promise.resolve({data:[]}),
  mediaIds.length?rows(config,'cms_media',new URLSearchParams({select:'id,alt',id:`in.(${mediaIds.join(',')})`,published:'eq.true',limit:'100'})):Promise.resolve({data:[]})
 ]);
 const byId=new Map(linked.data.map(entry=>[entry.id,entry]));
 const mediaById=new Map(images.data.map(image=>[image.id,image]));
 const pages=customPages.map(page=>({...page,image:mediaById.has(page.media_id)?`/api/media?id=${encodeURIComponent(page.media_id)}`:null,alt:mediaById.get(page.media_id)?.alt||''}));
 for(const id of ids){const entry=byId.get(id);if(entry)pages.push({title:entry.title,body:entry.body,layout:'text',image:media(entry,config.origins),alt:imageAlt(entry),article:entry});}
 const intro=`<section class="zine-intro wrap"><div><p class="section-caption">Digital fanzine</p><h1>${escape(row.title)}</h1></div>${pages.length?'<button class="print-button" type="button">Stampa il quaderno</button>':''}</section>`;
 if(!pages.length)return intro+'<section class="page-intro wrap"><p>Le pagine di questo quaderno stanno prendendo forma.</p><a class="text-link" href="/blog/">Continua a leggere nel blog</a></section>';
 const layouts={text:'zine-essay',photo:'zine-photo',cover:'zine-title',quote:'zine-political zine-quote'};
 return intro+`<section class="reader wrap" aria-label="Lettore della digital fanzine"><div class="reader-controls"><button data-page-prev type="button" disabled aria-label="Pagina precedente">←</button><span data-page-count role="status" aria-live="polite">1 / ${pages.length}</span><button data-page-next type="button" ${pages.length===1?'disabled ':''}aria-label="Pagina successiva">→</button></div><div class="reader-stage" tabindex="0" aria-label="Pagine del quaderno">${pages.map((page,index)=>{
  const layout=Object.hasOwn(layouts,page.layout)?page.layout:'text';
  const body=renderMarkdown(page.body,{origins:config.origins});
  return `<section class="zine-page zine-managed ${layouts[layout]}" data-layout="${layout}" data-spread aria-label="Pagina ${index+1}">${page.image?`<img src="${escape(page.image)}" alt="${escape(page.alt)}" loading="lazy">`:''}<div class="zine-page-copy"><h2>${escape(page.title)}</h2>${layout==='quote'?`<blockquote>${body}</blockquote>`:body}${page.article?`<a class="text-link" href="/blog/${encodeURIComponent(page.article.slug)}/">Leggi lo scritto</a>`:''}</div><span class="folio">${index+1}</span></section>`;
 }).join('')}</div></section>`;
}
const empty=(title,text)=>`<section class="page-intro wrap"><h1>${escape(title)}</h1><p>${escape(text)}</p><a class="text-link" href="/">Torna a Lavanda</a></section>`;
const replaceMain=(html,main)=>html.replace(/(<main id="contenuto">)[\s\S]*?(<\/main>)/,(_,a,b)=>a+(html.match(/<div class="world-backdrop"[^>]*>[\s\S]*?<\/div>/)?.[0]||'')+main+b);
async function template(view,slug){let file=view==='home'?'index.html':view==='blog'?'blog/index.html':view==='fanzine'?'fanzine/index.html':view==='page'&&['progetto','manifesto','shop'].includes(slug)?`${slug}/index.html`:'lettura/index.html';return readFile(path.join(process.cwd(),'dist',file),'utf8');}
export default async function handler(req,res){
 const params=new URL(req.url,'https://lavanda.invalid').searchParams;
 for(const key of ['view','slug'])if(typeof req.query?.[key]==='string')params.set(key,req.query[key]);
 const view=params.get('view')||'article',slug=params.get('slug')||'';
 let html,settings={},publishedEntry=null;
 const publicPath=view==='home'?'/':view==='blog'?'/blog/':view==='fanzine'?'/fanzine/':view==='page'?(['progetto','manifesto','shop'].includes(slug)?`/${slug}/`:`/pagina/${slug}/`):slug?`/blog/${slug}/`:'/lettura/';
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
  if(slug&&(!SLUG.test(slug)||slug.length>150)){res.statusCode=404;res.end('Pagina non trovata');return;}
  html=await template(view,slug);
  const config=configuration();
  if(config.configured){
   const redirect=await resolveRedirect(config,publicPath);
   if(redirect){res.statusCode=redirect.code;res.setHeader('Location',redirect.target);res.setHeader('Cache-Control','no-store');res.end();return;}
   const publishedAt=new Date().toISOString();
   const q=new URLSearchParams({select:fields,type:`eq.${view==='page'?'page':view==='fanzine'?'fanzine':'post'}`,status:'in.(published,scheduled)',published_at:`lte.${publishedAt}`,order:'published_at.desc',limit:(view==='home'?'3':view==='blog'?'100':'1')});
   if(slug)q.set('slug',`eq.${slug}`);
   const [settingRows,result]=await Promise.all([rows(config,'cms_settings','select=site_title,tagline,site_description,seo,social_links,navigation&limit=1'),rows(config,'cms_entries',q)]);
   settings=settingRows.data[0]||{};
   if(view==='home'||view==='blog'){
    const cards=result.data.map(row=>card(row,config.origins)).join('')||'<p>Le prime letture stanno prendendo forma.</p>';
    html=html.replace(/<!-- CMS:ARTICLES -->[\s\S]*?<!-- \/CMS:ARTICLES -->/,()=>`<!-- CMS:ARTICLES -->${cards}<!-- /CMS:ARTICLES -->`);
   }else if(result.data[0]){
    const row=result.data[0];publishedEntry=row;html=replaceMain(html,view==='fanzine'?await issue(row,config,publishedAt):article(row,config.origins));
    html=html.replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escape(row.seo?.title||row.title)} | Lavanda</title>`).replace(/(<meta name="description" content=")[^"]*/,(_,prefix)=>prefix+escape(row.seo?.description||row.excerpt));
    // The publisher controls indexing per entry. Source drafts remain noindex.
    if(row.seo?.noindex===false)html=html.replace('name="robots" content="noindex,follow"','name="robots" content="index,follow"');
   }else{res.statusCode=404;html=replaceMain(html,empty('Questa lettura non è disponibile.','Puoi scegliere un altro percorso dal blog.'));}
  }else if(view==='article'&&slug){
   try{html=await readFile(path.join(process.cwd(),'dist','blog',slug,'index.html'),'utf8');}catch{res.statusCode=404;html=replaceMain(html,empty('Questa lettura non è disponibile.','Il quaderno iniziale è consultabile dal blog.'));}
  }
  if(config.configured)html=applySitePresentation(html,{settings,entry:publishedEntry,view,path:publicPath,origin:process.env.APP_ORIGIN||'',...(res.statusCode===404?{noindex:true}:{})});
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.end(req.method==='HEAD'?'':html);
 }catch{
  res.statusCode=503;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(html?replaceMain(html,empty('Una breve pausa.','La lettura non è disponibile in questo momento. Riprova tra poco.')):'La lettura non è disponibile in questo momento.');
 }
}
