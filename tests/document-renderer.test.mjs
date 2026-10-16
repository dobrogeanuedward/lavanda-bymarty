import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCUMENT_PREFIX,documentHeadingId,documentMediaURL,parseDocument,renderDocument,renderInline,renderMarkdown,serializeDocument,validateDocument} from '../src/public-content.js';

const mediaId='11111111-1111-4111-8111-111111111111';
const doc=blocks=>({version:1,blocks});
const text=(id='text-1',value='Una domanda')=>({id,type:'text',text:value});

test('structured documents round-trip through a distinct validated sentinel',()=>{
 const original=doc([text()]),body=serializeDocument(original),parsed=parseDocument(body);
 assert.ok(body.startsWith(DOCUMENT_PREFIX));assert.equal(parsed.blocks[0].width,100);assert.equal(parsed.blocks[0].text,'Una domanda');
 assert.equal(original.blocks[0].width,undefined);assert.equal(parseDocument('## Testo Markdown'),null);
 assert.equal(serializeDocument(parsed),body);
});

test('chapters retain stable anchors when text and document order change',()=>{
 const heading={id:'chapter-1',type:'heading',text:'Il tempo',level:3,width:75};
 const first=renderDocument(doc([heading,text()])),second=renderDocument(doc([text(),{...heading,text:'I nostri tempi'}]));
 assert.equal(documentHeadingId(heading),'capitolo-chapter-1');
 assert.match(first,/<h3 id="capitolo-chapter-1">Il tempo<\/h3>/);
 assert.match(second,/<h3 id="capitolo-chapter-1">I nostri tempi<\/h3>/);
 assert.match(first,/document-width-75/);
});

test('rich text runs preserve selected bold and italic across paragraphs and lists',()=>{
 const block={id:'rich',type:'text',text:'Un pensiero\n\n- Primo\n- Secondo',runs:[{text:'Un ',marks:[]},{text:'pensiero',marks:['bold','bold','italic']},{text:'\n\n- Primo\n- ',marks:[]},{text:'Secondo',marks:['italic']}]};
 const normalized=validateDocument(doc([block]));assert.deepEqual(normalized.blocks[0].runs[1].marks,['bold','italic']);
 const html=renderDocument(normalized);assert.match(html,/<strong><em>pensiero<\/em><\/strong>/);
 assert.match(html,/<ul><li>Primo<\/li><li><em>Secondo<\/em><\/li><\/ul>/);
});

test('inline formatting, internal links and raw HTML stay safe in legacy and structured text',()=>{
 const value='**Un <script>pensiero</script>** e _un ritmo_: [Leggi](/blog/ritmo/) [attacco](javascript:alert(1))';
 const inline=renderInline(value);
 assert.match(inline,/<strong>Un &lt;script&gt;pensiero&lt;\/script&gt;<\/strong>/);assert.match(inline,/<em>un ritmo<\/em>/);assert.match(inline,/<a href="\/blog\/ritmo\/">Leggi<\/a>/);
 assert.doesNotMatch(inline,/<script|javascript:|href="https?:/);
 assert.ok(renderMarkdown(value).includes(inline));assert.ok(renderDocument(doc([text('formatted',value)])).includes(inline));
});

test('image, gallery, divider, quote, audio, video and file blocks render without arbitrary HTML',()=>{
 const blocks=[
  {id:'quote',type:'quote',text:'Una **domanda**',cite:'Martina <script>x</script>',width:50},
  {id:'image',type:'image',media_id:mediaId,src:'',alt:'Lavanda "in luce"',caption:'La _materia_',width:25},
  {id:'gallery',type:'gallery',items:[{src:'/assets/botanical.webp',alt:'Radici',caption:'Una relazione'},{src:'/r2/lavanda/ritual.webp',alt:'Un gesto'}],width:100},
  {id:'divider',type:'divider'},
  {id:'audio',type:'audio',src:'/r2/lavanda/reading.mp3',caption:'Una lettura'},
  {id:'video',type:'video',src:'/r2/lavanda/gesture.mp4',caption:'Un passaggio'},
  {id:'file',type:'file',src:'/r2/lavanda/quaderno.pdf',text:'Il quaderno <img onerror=x>'}
 ];
 const html=renderDocument(doc(blocks));
 assert.match(html,/<blockquote><p>Una <strong>domanda<\/strong><\/p><cite>Martina &lt;script&gt;x&lt;\/script&gt;<\/cite><\/blockquote>/);
 assert.match(html,new RegExp('src="/api/media\\?id='+mediaId+'"'));assert.match(html,/alt="Lavanda &quot;in luce&quot;"/);
 assert.match(html,/document-gallery/);assert.match(html,/<hr>/);
 assert.match(html,/<audio controls preload="metadata" src="\/r2\/lavanda\/reading.mp3">/);
 assert.match(html,/<video controls preload="metadata" playsinline src="\/r2\/lavanda\/gesture.mp4">/);
 assert.match(html,/class="document-file" href="\/r2\/lavanda\/quaderno.pdf" download/);
 assert.match(html,/Il quaderno &lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<script|<img onerror|autoplay|style=/);
});

test('document media is restricted to the library, assets and the known R2 proxy',()=>{
 const cdn='https://pub-b39e5084f7324516a4fe99c212a65c5f.r2.dev';
 assert.equal(documentMediaURL(cdn+'/lavanda/photo.webp'),'/r2/lavanda/photo.webp');
 assert.equal(documentMediaURL('/api/media?id='+mediaId),'/api/media?id='+mediaId);
 assert.equal(documentMediaURL('https://lavanda.example/api/media?id='+mediaId,['https://lavanda.example']),'/api/media?id='+mediaId);
 for(const src of ['blob:123','data:image/png,123','javascript:alert(1)','//attacker.test/image.png','https://attacker.test/image.png','/admin/seed.json','/api/media?id=seed-image','/api/media?id='+mediaId+'&other=1','/assets/../secret','/assets/%2e%2e/secret','/assets/%252e%252e/secret','/assets/%2525252e%2525252e/secret','/assets/%2fsecret','/assets/a.webp?token=1','/assets/a.webp#x',cdn+'/lavanda/image.png?x=1'])assert.equal(documentMediaURL(src),null,src);
});

test('local IndexedDB media references remain persistable without publishing blob URLs',()=>{
 const html=renderDocument(doc([{id:'local-image',type:'image',media_id:'seed-local-image',src:'',alt:'Bozza'}]));
 assert.match(html,/Immagine in preparazione/);assert.doesNotMatch(html,/src=|blob:|data:/);
 assert.throws(()=>serializeDocument(doc([{id:'local-image',type:'image',media_id:mediaId,src:'blob:123',alt:''}])),error=>error.code==='INVALID_DOCUMENT');
});

test('invalid structured data is recoverable and never exposes raw JSON as public prose',()=>{
 for(const body of [DOCUMENT_PREFIX+'{bad json',DOCUMENT_PREFIX+JSON.stringify({version:2,blocks:[]}),DOCUMENT_PREFIX+JSON.stringify(doc([{...text(),style:'position:fixed'}]))]){
  assert.throws(()=>parseDocument(body),error=>error.code==='INVALID_DOCUMENT');
  const html=renderMarkdown(body);assert.match(html,/temporaneamente non disponibile/);assert.doesNotMatch(html,/LAVANDA_DOC_V1|position:fixed|bad json/);
 }
});

test('validation enforces IDs, widths, chapter levels and matching rich text',()=>{
 const invalid=[doc([text('same'),text('same')]),doc([{...text(),id:'bad" onclick=x'}]),doc([{...text(),width:'50'}]),doc([{...text(),width:80}]),doc([{id:'h',type:'heading',text:'Titolo',level:1}]),doc([{...text(),runs:[{text:'Differente',marks:[]}]}]),doc([{...text(),runs:[{text:'Una domanda',marks:['script']}]}]),doc([{id:'g',type:'gallery',items:Array.from({length:21},()=>({src:'/assets/a.webp'}))}])];
 for(const input of invalid)assert.throws(()=>validateDocument(input),error=>error.code==='INVALID_DOCUMENT');
});

test('document limits count UTF-8 bytes and refuse more than 250 blocks',()=>{
 assert.throws(()=>serializeDocument(doc(Array.from({length:251},(_,index)=>text('block-'+index)))),/250/);
 assert.throws(()=>serializeDocument(doc([text('large','é'.repeat(250000))])),/500000/);
 assert.ok(serializeDocument(doc([text('valid','a'.repeat(490000))])).length<500000);
});

test('long unclosed inline-link syntax remains text and leaves later emphasis readable',()=>{
 const value='['.repeat(30000)+' **Pensiero**';
 const html=renderInline(value);assert.match(html,/<strong>Pensiero<\/strong>$/);assert.ok(html.startsWith('['.repeat(30000)));
});
