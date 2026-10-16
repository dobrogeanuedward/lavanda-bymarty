import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/site.mjs';
import {contentImageURL,renderMarkdown} from '../src/public-content.js';
const originalFetch=globalThis.fetch;
const previous={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
after(()=>{globalThis.fetch=originalFetch;for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const enable=()=>{process.env.SUPABASE_URL='https://lavanda-test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test12345678';};
function response(){return {statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(value){this.body=value||'';}};}
test('unconfigured website serves initial static study',async()=>{delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;const res=response();await handler({method:'GET',url:'/api/site?view=home'},res);assert.equal(res.statusCode,200);assert.match(res.body,/La bottega della speziale/);});
test('published blog comes from database and filters publication dates',async()=>{enable();let requested;globalThis.fetch=async url=>{requested=new URL(url);return new Response('[]',{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});};const res=response();await handler({method:'GET',url:'/api/site?view=blog'},res);assert.equal(res.statusCode,200);assert.equal(requested.searchParams.get('status'),'in.(published,scheduled)');assert.match(requested.searchParams.get('published_at'),/^lte\./);assert.match(res.body,/Le prime letture stanno prendendo forma/);assert.doesNotMatch(res.body,/data-slug="il-ritmo-perduto"/);});
test('unpublished entry cannot fall back to static original',async()=>{enable();globalThis.fetch=async()=>new Response('[]',{status:200});const res=response();await handler({method:'GET',url:'/api/site?view=article&slug=il-ritmo-perduto'},res);assert.equal(res.statusCode,404);assert.match(res.body,/Questa lettura non è disponibile/);assert.doesNotMatch(res.body,/class="article-subtitle"/);});
test('public body and SEO are escaped and dollar replacement remains literal',async()=>{enable();globalThis.fetch=async()=>new Response(JSON.stringify([{id:'x',title:'$& <script>x</script>',slug:'test',body:'## Titolo\n\n<img src=x onerror=alert(1)>',excerpt:'Prova',metadata:{},seo:{title:'$& <script>x</script>',description:'" onload="x'}}]),{status:200});const res=response();await handler({method:'GET',url:'/api/site?slug=test'},res);assert.equal(res.statusCode,200);assert.match(res.body,/&lt;script&gt;x&lt;\/script&gt;/);assert.match(res.body,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.match(res.body,/\$&amp;/);assert.doesNotMatch(res.body,/<script>x/);});
test('invalid slugs are rejected before filesystem lookup',async()=>{const res=response();await handler({method:'GET',url:'/api/site?slug=..%2F..%2F.env'},res);assert.equal(res.statusCode,404);});
test('database errors fail closed without source draft fallback',async()=>{enable();globalThis.fetch=async()=>new Response('unavailable',{status:503});const res=response();await handler({method:'GET',url:'/api/site?view=article&slug=il-ritmo-perduto'},res);assert.equal(res.statusCode,503);assert.match(res.body,/Una breve pausa/);});

test('published Markdown preserves editor blocks without executing HTML or unsafe images',async()=>{
 enable();
 const body='## Una sezione\n\n> Una domanda <script>attacco</script>\n> Un’altra riga\n\n- Un punto\n- Un secondo punto\n\n---\n\n![Lavanda "in luce"](/assets/botanical.webp)\n\n![x](javascript:alert)\n\n![x](//attacker.example/x.png)\n\n<img src=x onerror=alert(1)>';
 const expected=renderMarkdown(body);
 assert.match(expected,/<h2>Una sezione<\/h2>/);
 assert.match(expected,/<blockquote><p>Una domanda &lt;script&gt;attacco&lt;\/script&gt;/);
 assert.match(expected,/<ul><li>Un punto<\/li><li>Un secondo punto<\/li><\/ul>/);
 assert.match(expected,/<hr>/);
 assert.match(expected,/<img src="\/assets\/botanical.webp" alt="Lavanda &quot;in luce&quot;" loading="lazy">/);
 assert.match(expected,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(expected,/<script|src="javascript:|attacker\.example/);
 globalThis.fetch=async()=>new Response(JSON.stringify([{title:'Scritto',slug:'scritto',body,metadata:{},seo:{}}]),{status:200});
 const res=response();await handler({method:'GET',url:'/api/site?view=article&slug=scritto'},res);
 assert.equal(res.statusCode,200);assert.ok(res.body.includes(expected));
});

test('content images accept local media and trusted site origins only',()=>{
 const origins=['https://lavanda.example'];
 assert.equal(contentImageURL('/api/media?id=123',origins),'/api/media?id=123');
 assert.equal(contentImageURL('https://lavanda.example/assets/test.webp',origins),'/assets/test.webp');
 for(const value of ['https://other.example/x.png','https://u:p@lavanda.example/x.png','//other.example/x.png','/\\other.example/x.png','/%5cother.example/x.png','data:image/svg+xml,<svg/>','javascript:alert(1)'])assert.equal(contentImageURL(value,origins),null,value);
});

test('published covers retain current and legacy image descriptions',async()=>{
 enable();
 for(const metadata of [{cover_url:'/assets/botanical.webp',image_alt:'Lavanda e radici',cover_alt:'Vecchia descrizione'},{cover_url:'/assets/botanical.webp',cover_alt:'Descrizione precedente'}]){
  globalThis.fetch=async()=>new Response(JSON.stringify([{title:'Scritto',slug:'scritto',body:'Testo',metadata,seo:{}}]),{status:200});
  const res=response();await handler({method:'GET',url:'/api/site?view=article&slug=scritto'},res);
  assert.equal(res.statusCode,200);assert.ok(res.body.includes(`alt="${metadata.image_alt||metadata.cover_alt}"`));
 }
});

test('fanzine reads only public articles and respects the selected article order',async()=>{
 enable();
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',hidden='33333333-3333-4333-8333-333333333333';
 const requests=[];
 globalThis.fetch=async url=>{
  const query=new URL(url).searchParams;if(query.has('type'))requests.push(query);
  const data=query.get('type')==='eq.fanzine'?[{title:'Il quaderno',slug:'quaderno',metadata:{article_ids:[second,hidden,first]},fanzine_pages:[],seo:{}}]:[{id:first,title:'Primo scritto',slug:'primo',body:'Testo del primo',metadata:{}},{id:second,title:'Secondo scritto',slug:'secondo',body:'Testo del secondo',metadata:{}}];
  return new Response(JSON.stringify(data),{status:200});
 };
 const res=response();await handler({method:'GET',url:'/api/site?view=fanzine'},res);
 assert.equal(res.statusCode,200);assert.match(res.body,/1 \/ 2/);
 assert.ok(res.body.indexOf('<h2>Secondo scritto</h2>')<res.body.indexOf('<h2>Primo scritto</h2>'));
 assert.match(res.body,/href="\/blog\/secondo\/"/);
 assert.equal(requests.length,2);
 assert.equal(requests[1].get('id'),`in.(${second},${hidden},${first})`);
 assert.equal(requests[1].get('status'),'in.(published,scheduled)');
 assert.equal(requests[1].get('published_at'),requests[0].get('published_at'));
 assert.equal(requests[1].get('type'),'eq.post');
 assert.doesNotMatch(requests[1].get('select'),/editorial_notes|author_id/);
});

test('fanzine honors custom page layouts and published media descriptions',async()=>{
 enable();const image='44444444-4444-4444-8444-444444444444';
 globalThis.fetch=async url=>{
  const parsed=new URL(url);
  if(parsed.pathname.endsWith('/cms_media')){assert.equal(parsed.searchParams.get('published'),'eq.true');return new Response(JSON.stringify([{id:image,alt:'Il ramo in luce'}]),{status:200});}
  return new Response(JSON.stringify([{title:'Le forme',slug:'forme',metadata:{},seo:{},fanzine_pages:[{title:'Copertina',body:'Un inizio',layout:'cover'},{title:'Fotografia',body:'La luce',layout:'photo',media_id:image},{title:'Citazione',body:'Il tempo ritorna',layout:'quote'},{title:'Testo',body:'## Una sezione\n\nUn pensiero',layout:'text'}]}]),{status:200});
 };
 const res=response();await handler({method:'GET',url:'/api/site?view=fanzine'},res);
 assert.equal(res.statusCode,200);assert.match(res.body,/1 \/ 4/);
 for(const layout of ['cover','photo','quote','text'])assert.ok(res.body.includes(`data-layout="${layout}"`));
 assert.match(res.body,/alt="Il ramo in luce"/);assert.match(res.body,/<blockquote><p>Il tempo ritorna<\/p><\/blockquote>/);
 assert.match(res.body,/<h2>Una sezione<\/h2>/);
});

test('an empty published fanzine has a useful empty state without invalid pagination',async()=>{
 enable();globalThis.fetch=async()=>new Response(JSON.stringify([{title:'In preparazione',slug:'preparazione',metadata:{},fanzine_pages:[],seo:{}}]),{status:200});
 const res=response();await handler({method:'GET',url:'/api/site?view=fanzine'},res);
 assert.equal(res.statusCode,200);assert.match(res.body,/Le pagine di questo quaderno stanno prendendo forma/);
 assert.doesNotMatch(res.body,/1 \/ 0|data-page-count|data-page-next/);
});

test('a live edited fanzine publishes its structured body before legacy pages',async()=>{
 enable();const body='LAVANDA_DOC_V1\n'+JSON.stringify({version:1,blocks:[{id:'new-chapter',type:'heading',width:100,level:2,text:'Capitolo aggiornato'},{id:'new-text',type:'text',width:100,text:'Testo salvato sulla pagina.'}]});
 globalThis.fetch=async url=>new Response(JSON.stringify(new URL(url).pathname.endsWith('/cms_entries')?[{title:'Quaderno live',slug:'quaderno',body,metadata:{},seo:{},fanzine_pages:[{title:'Titolo superato',body:'Testo superato',layout:'text'}]}]:[]),{status:200});
 const res=response();await handler({method:'GET',url:'/api/site?view=fanzine'},res);
 assert.equal(res.statusCode,200);assert.match(res.body,/href="#capitolo-new-chapter"/);assert.match(res.body,/id="capitolo-new-chapter"/);assert.match(res.body,/Testo salvato sulla pagina/);assert.doesNotMatch(res.body,/Titolo superato|Testo superato|LAVANDA_DOC_V1/);
});
