import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {configuration,rows,SLUG} from '../lib/cms.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields='id,type,title,slug,excerpt,body,cover_media_id,tags,seo,metadata,published_at,updated_at,fanzine_pages';
function paragraphs(body){return String(body||'').split(/\n\s*\n/).filter(Boolean).map(p=>/^#{1,4}\s/.test(p)?`<h2>${escape(p.replace(/^#{1,4}\s+/,''))}</h2>`:`<p>${escape(p)}</p>`).join('');}
function media(row){if(row.cover_media_id)return `/api/media?id=${encodeURIComponent(row.cover_media_id)}`;const url=row.metadata?.cover_url;return typeof url==='string'&&url.startsWith('/')&&!url.startsWith('//')?url:null;}
function card(row){const url=`/blog/${encodeURIComponent(row.slug)}/`;const image=media(row);return `<article class="article-card" data-article data-slug="${escape(row.slug)}" data-category="${escape(row.metadata?.category_name||'Dal blog')}" data-search="${escape([row.title,row.excerpt,...(row.tags||[])].join(' ').toLocaleLowerCase('it'))}"><a class="article-image" href="${url}">${image?`<img src="${escape(image)}" alt="${escape(row.metadata?.cover_alt||'')}" loading="lazy">`:'<span class="live-text-cover">Lavanda</span>'}</a><div class="article-meta"><span>${escape(row.metadata?.category_name||'Dal blog')}</span><span>Lavanda</span></div><h3><a href="${url}">${escape(row.title)}</a></h3><p>${escape(row.excerpt)}</p></article>`;}
function article(row){const image=media(row);return `<article><header class="article-header wrap"><a class="text-link" href="/blog/">Torna agli scritti</a><div class="article-meta"><span>${escape(row.metadata?.category_name||'Lavanda')}</span></div><h1>${escape(row.title)}</h1>${row.metadata?.subtitle?`<p class="article-subtitle">${escape(row.metadata.subtitle)}</p>`:''}</header>${image?`<figure class="article-hero wrap"><img src="${escape(image)}" alt="${escape(row.metadata?.cover_alt||'')}"></figure>`:''}<div class="prose live-prose wrap">${row.excerpt?`<p class="lead">${escape(row.excerpt)}</p>`:''}${paragraphs(row.body)}<div class="reading-end"><img src="/brand/emblem.svg" width="48" height="48" alt=""><p>Buon ritorno al centro.</p></div></div></article>`;}
function issue(row){const pages=row.fanzine_pages||[];return `<section class="zine-intro wrap"><div><p class="section-caption">Digital fanzine</p><h1>${escape(row.title)}</h1></div><button class="print-button" type="button">Stampa il quaderno</button></section><section class="reader wrap" aria-label="Lettore della digital fanzine"><div class="reader-controls"><button data-page-prev type="button" disabled aria-label="Pagina precedente">←</button><span data-page-count role="status">1 / ${pages.length}</span><button data-page-next type="button" aria-label="Pagina successiva">→</button></div><div class="reader-stage" tabindex="0" aria-label="Pagine del quaderno">${pages.map((p,i)=>`<section class="zine-page ${i?'zine-essay':'zine-title'}" data-spread><h2>${escape(p.title)}</h2>${p.media_id?`<img src="/api/media?id=${encodeURIComponent(p.media_id)}" alt="">`:''}${paragraphs(p.body)}<span class="folio">${i+1}</span></section>`).join('')}</div></section>`;}
const empty=(title,text)=>`<section class="page-intro wrap"><h1>${escape(title)}</h1><p>${escape(text)}</p><a class="text-link" href="/">Torna a Lavanda</a></section>`;
const replaceMain=(html,main)=>html.replace(/(<main id="contenuto">)[\s\S]*?(<\/main>)/,(_,a,b)=>a+main+b);
async function template(view,slug){let file=view==='home'?'index.html':view==='blog'?'blog/index.html':view==='fanzine'?'fanzine/index.html':view==='page'&&slug==='progetto'?'progetto/index.html':view==='page'&&slug==='manifesto'?'manifesto/index.html':'lettura/index.html';return readFile(path.join(process.cwd(),'dist',file),'utf8');}
export default async function handler(req,res){
 const params=new URL(req.url,'https://lavanda.invalid').searchParams;
 for(const key of ['view','slug'])if(typeof req.query?.[key]==='string')params.set(key,req.query[key]);
 const view=params.get('view')||'article',slug=params.get('slug')||'';
 let html;
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
  if(slug&&(!SLUG.test(slug)||slug.length>150)){res.statusCode=404;res.end('Pagina non trovata');return;}
  html=await template(view,slug);
  const config=configuration();
  if(config.configured){
   const q=new URLSearchParams({select:fields,type:`eq.${view==='page'?'page':view==='fanzine'?'fanzine':'post'}`,status:'in.(published,scheduled)',published_at:`lte.${new Date().toISOString()}`,order:'published_at.desc',limit:(view==='home'?'3':view==='blog'?'100':'1')});
   if(slug)q.set('slug',`eq.${slug}`);
   const result=await rows(config,'cms_entries',q);
   if(view==='home'||view==='blog'){
    const cards=result.data.map(card).join('')||'<p>Le prime letture stanno prendendo forma.</p>';
    html=html.replace(/<!-- CMS:ARTICLES -->[\s\S]*?<!-- \/CMS:ARTICLES -->/,()=>`<!-- CMS:ARTICLES -->${cards}<!-- /CMS:ARTICLES -->`);
   }else if(result.data[0]){
    const row=result.data[0];html=replaceMain(html,view==='fanzine'?issue(row):article(row));
    html=html.replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escape(row.seo?.title||row.title)} | Lavanda</title>`).replace(/(<meta name="description" content=")[^"]*/,(_,prefix)=>prefix+escape(row.seo?.description||row.excerpt));
    // The publisher controls indexing per entry. Source drafts remain noindex.
    if(row.seo?.noindex===false)html=html.replace('name="robots" content="noindex,follow"','name="robots" content="index,follow"');
   }else{res.statusCode=404;html=replaceMain(html,empty('Questa lettura non è disponibile.','Puoi scegliere un altro percorso dal blog.'));}
  }else if(view==='article'&&slug){
   try{html=await readFile(path.join(process.cwd(),'dist','blog',slug,'index.html'),'utf8');}catch{res.statusCode=404;html=replaceMain(html,empty('Questa lettura non è disponibile.','Il quaderno iniziale è consultabile dal blog.'));}
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.end(req.method==='HEAD'?'':html);
 }catch{
  res.statusCode=503;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(html?replaceMain(html,empty('Una breve pausa.','La lettura non è disponibile in questo momento. Riprova tra poco.')):'La lettura non è disponibile in questo momento.');
 }
}
