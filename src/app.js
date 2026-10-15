import {hydratePublishedContent} from './public-content.js';
const menu = document.querySelector('.menu-toggle');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));document.querySelector('.header')?.classList.toggle('open',open);menu.querySelector('span').textContent=open?'−':'+';});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.click();menu.focus();}});
document.querySelector('.back-top')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));

const search=document.querySelector('#search');
let currentFilter='all';
function applyFilters(){
 const query=(search?.value||'').trim().toLocaleLowerCase('it');
 let count=0;
 document.querySelectorAll('[data-article]').forEach(card=>{const show=(currentFilter==='all'||card.dataset.category===currentFilter)&&card.dataset.search.includes(query);card.hidden=!show;if(show)count++;});
 const countLabel=document.querySelector('.result-count');if(countLabel)countLabel.textContent=`${count} ${count===1?'scritto':'scritti'}`;
 const empty=document.querySelector('#no-results');if(empty)empty.hidden=count!==0;
}
search?.addEventListener('input',applyFilters);
document.querySelector('.filters')?.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;currentFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));applyFilters();});
document.addEventListener('lavanda-content-updated',applyFilters);
hydratePublishedContent();

document.querySelectorAll('[data-save]').forEach(button=>{
 const key=`lavanda-reading-${button.dataset.save}`;
 const setLabel=saved=>{button.setAttribute('aria-pressed',String(saved));button.textContent=saved?'Lettura salvata':'Salva lettura';};
 try{setLabel(localStorage.getItem(key)==='true');}catch{}
 button.addEventListener('click',()=>{const saved=button.getAttribute('aria-pressed')!=='true';try{localStorage.setItem(key,String(saved));setLabel(saved);}catch{button.textContent='Salvataggio non disponibile';button.setAttribute('aria-live','polite');}});
});

const tabs=[...document.querySelectorAll('[data-tab]')];
function selectTab(tab){tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;const panel=document.getElementById(t.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;});}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();selectTab(tabs[next]);tabs[next].focus();}});});

const spreads=[...document.querySelectorAll('[data-spread]')];
let page=0;
function showPage(next){page=Math.max(0,Math.min(spreads.length-1,next));spreads.forEach((s,i)=>s.hidden=i!==page);document.querySelector('[data-page-prev]').disabled=page===0;document.querySelector('[data-page-next]').disabled=page===spreads.length-1;document.querySelector('[data-page-count]').textContent=`${page+1} / ${spreads.length}`;}
if(spreads.length){showPage(0);document.querySelector('[data-page-prev]').addEventListener('click',()=>showPage(page-1));document.querySelector('[data-page-next]').addEventListener('click',()=>showPage(page+1));document.querySelector('.reader-stage').addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();showPage(page+1);}if(event.key==='ArrowLeft'){event.preventDefault();showPage(page-1);}});}
document.querySelector('.print-button')?.addEventListener('click',()=>window.print());

// Aggregate reading event; no cookies, persistent visitor ID, or raw IP are sent.
// Public deployments only: file previews and local development send nothing.
if(location.protocol==='https:'&&!location.hostname.match(/^(localhost|127\.)/)){
 const payload=JSON.stringify({event:'pageview',path:location.pathname});
 fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true}).catch(()=>{});
}
