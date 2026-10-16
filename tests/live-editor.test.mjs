import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOCUMENT_PREFIX, STORAGE_KEY, MAX_UPLOAD_BYTES, MAX_IMPORT_BYTES, createBlock, reorderBlocks, validateUpload, hasDocumentContent, documentFromBody, readRichText, parseDocument, serializeDocument, safeEditorURL, mergeMissingShopPage } from '../public/admin/live-editor.js';
import { renderDocument } from '../src/public-content.js';

const ID='dd3ca191-1698-4aaf-bbac-87b79562b015';
const FILE='/api/media?id='+ID;
const CDN='https://pub-b39e5084f7324516a4fe99c212a65c5f.r2.dev';

test('editor round trip uses the same structured contract as the public renderer',()=>{
  const document={version:1,blocks:[
    createBlock('text',{text:'Una voce chiara',runs:[{text:'Una voce ',marks:[]},{text:'chiara',marks:['bold','italic']}]}),
    createBlock('heading',{text:'Un capitolo',level:3}),createBlock('quote',{text:'Una citazione',cite:'La sua fonte'}),
    createBlock('image',{media_id:ID,src:FILE,alt:'Una radice',caption:'Studio botanico',width:50}),
    createBlock('gallery',{items:[{media_id:null,src:'/assets/manifesto.webp',alt:'Luce',caption:''}],width:75}),
    createBlock('divider'),createBlock('audio',{src:'/r2/lavanda/audio.ogg'}),createBlock('video',{src:'/r2/lavanda/video.mp4'}),
    createBlock('file',{media_id:ID,text:'Documento originale'}),
  ]};
  const saved=serializeDocument(document);assert.ok(saved.startsWith(DOCUMENT_PREFIX));assert.deepEqual(parseDocument(saved),document);
  const html=renderDocument(parseDocument(saved));assert.match(html,/<strong><em>chiara<\/em><\/strong>/);assert.match(html,/document-width-50/);assert.match(html,/<audio controls/);assert.match(html,/Documento originale/);
  assert.equal(STORAGE_KEY,'lavanda-studio-v1');
});

test('stored documents cannot contain HTML, blob URLs, unsupported marks or arbitrary sizing',()=>{
  const harmless=createBlock('text',{text:'<img src=x onerror=alert(1)>'});
  assert.doesNotMatch(renderDocument({version:1,blocks:[harmless]}),/<img src=x/);
  for(const block of [
    {...harmless,html:'<script>alert(1)</script>'}, {...harmless,width:42},
    {...harmless,runs:[{text:harmless.text,marks:['script']}]},
    {id:'image',type:'image',src:'blob:https://site.test/private'},
    {id:'image',type:'image',src:'data:image/png;base64,AAAA'},
  ])assert.throws(()=>serializeDocument({version:1,blocks:[block]}));
  assert.throws(()=>parseDocument(DOCUMENT_PREFIX+'{broken'));
  assert.equal(parseDocument('Un normale testo'),null);
});

test('persistent media URL allowlist blocks executable and external sources',()=>{
  assert.equal(safeEditorURL(FILE),FILE);
  assert.equal(safeEditorURL(CDN+'/lavanda/assets/photo.webp'),'/r2/lavanda/assets/photo.webp');
  assert.equal(safeEditorURL('https://lavanda.example/assets/photo.webp','https://lavanda.example'),'/assets/photo.webp');
  for(const url of ['javascript:alert(1)','//evil.example/photo.webp','https://evil.example/photo.webp','/admin/secret','/assets/../admin/secret','/assets/%2e%2e/admin/secret','/r2/%252e%252e/admin/secret','/api/media?id=seed-local','/api/media?id='+ID+'&admin=1',CDN+'/file.webp?secret=token','/assets/evil\\file.png'])assert.equal(safeEditorURL(url),null,url);
});

test('reordering keeps block identities, content and input array unchanged',()=>{
  const blocks=[createBlock('text',{text:'Primo'}),createBlock('image',{src:'/assets/manifesto.webp'}),createBlock('heading',{text:'Terzo'})];
  const changed=reorderBlocks(blocks,blocks[0].id,2);
  assert.deepEqual(changed.map(block=>block.id),[blocks[1].id,blocks[2].id,blocks[0].id]);
  assert.equal(changed[2].text,'Primo');assert.equal(blocks[0].text,'Primo');assert.notEqual(changed,blocks);
  assert.throws(()=>reorderBlocks(blocks,'missing',1));assert.throws(()=>reorderBlocks(blocks,blocks[0].id,3));
});

test('images up to 40 MB can be reduced but PDFs and animated GIFs keep the server limit',()=>{
  assert.equal(validateUpload({type:'image/jpeg',size:MAX_IMPORT_BYTES}).needsCompression,true);
  assert.equal(validateUpload({type:'image/webp',size:MAX_UPLOAD_BYTES}).needsCompression,false);
  assert.equal(validateUpload({type:'application/pdf',size:MAX_UPLOAD_BYTES}).image,false);
  for(const file of [{type:'image/jpeg',size:MAX_IMPORT_BYTES+1},{type:'application/pdf',size:MAX_UPLOAD_BYTES+1},{type:'image/gif',size:MAX_UPLOAD_BYTES+1},{type:'image/svg+xml',size:20},{type:'text/html',size:20},{type:'video/mp4',size:20},{type:'image/png',size:0}])assert.throws(()=>validateUpload(file));
});

test('large documents are rejected before persistence and empty draft blocks cannot imply publication',()=>{
  const empty={version:1,blocks:[createBlock('text'),createBlock('divider'),createBlock('gallery')]};assert.equal(hasDocumentContent(empty),false);
  assert.equal(hasDocumentContent({version:1,blocks:[createBlock('image',{media_id:ID})]}),true);
  assert.throws(()=>serializeDocument({version:1,blocks:[createBlock('text',{text:'à'.repeat(260000)})]}));
});

test('legacy Markdown turns into editable blocks and malformed structured bodies stay errors',()=>{
  const legacy='## Il primo capitolo\n\nUna ricerca.\n\n> Una voce\n> e la sua pausa\n\n![Luce](/assets/manifesto.webp)\n\n---';
  const doc=documentFromBody(legacy);assert.deepEqual(doc.blocks.map(block=>block.type),['heading','text','quote','image','divider']);
  assert.equal(doc.blocks[2].text,'Una voce\ne la sua pausa');assert.equal(doc.blocks[3].alt,'Luce');
  assert.throws(()=>documentFromBody(DOCUMENT_PREFIX+'{"version":9,"blocks":[]}'));
});

test('rich text capture keeps only plaintext, bold and italic without HTML persistence',()=>{
  const text=value=>({nodeType:3,nodeValue:value});
  const tag=(name,...children)=>({nodeType:1,tagName:name,childNodes:children});
  const root=tag('P',text('Una '),tag('STRONG',text('voce '),tag('EM',text('viva'))),tag('BR'),text('qui'),tag('SCRIPT',text('alert(1)')));
  const captured=readRichText(root);
  assert.equal(captured.text,'Una voce viva\nqui');
  assert.deepEqual(captured.runs,[{text:'Una ',marks:[]},{text:'voce ',marks:['bold']},{text:'viva',marks:['bold','italic']},{text:'\nqui',marks:[]}]);
  assert.deepEqual(parseDocument(serializeDocument({version:1,blocks:[createBlock('text',captured)]})).blocks[0].runs,captured.runs);
});

test('entry links preserve mode and save pending form changes before navigation',async()=>{
  const script=await readFile(new URL('../public/admin/admin.js',import.meta.url),'utf8');
  assert.match(script,/\/admin\/live\.html\?entry=\$\{encodeURIComponent\(id\)\}&mode=\$\{mode\}/);
  assert.match(script,/data-action="live-edit"[^>]+>\$\{icon\('external'\)\}Modifica sulla pagina/);
  assert.match(script,/action==='live-edit'\)\{if\(currentRoute==='editor'&&!await saveEditor\(false\)\)return;location.href=liveEditorURL\(id\)/);
  assert.match(script,/protectStructuredBody\(entry\);if\(!canEditEntry/);
  assert.match(script,/area\.hidden=true;area\.style\.display='none'/);
  assert.match(script,/function markdownPreview\(text\)\{return renderLiveBody/);
});

test('shop migration adds only a missing page and preserves existing author content',()=>{
  const original={id:'author-post',type:'post',slug:'ricerca',title:'Il lavoro di Martina',body:'Testo modificato',version:9};
  const settings={site_title:'Lavanda personalizzata'},state={entries:[original],settings,media:[{id:'my-image'}]};
  const seed={entries:[{id:'seed-shop',type:'page',slug:'shop',title:'La piccola bottega',body:'La vetrina',status:'draft',seo:{noindex:true}},{id:'other',type:'page',slug:'manifesto',body:'Non importare'}]};
  const migrated=mergeMissingShopPage(state,seed);
  assert.equal(migrated.added,true);assert.equal(migrated.state.entries.length,2);
  assert.equal(migrated.state.entries[0],original);assert.equal(migrated.state.settings,settings);assert.equal(migrated.state.media,state.media);
  assert.equal(migrated.state.entries[1].id,'seed-shop');assert.equal(migrated.state.entries[1].status,'draft');
  assert.equal(state.entries.length,1);
  const customized={...migrated.state,entries:[original,{id:'my-shop',type:'page',slug:'shop',title:'La mia bottega',body:'Catalogo scritto da Martina',version:8}]};
  const unchanged=mergeMissingShopPage(customized,seed);
  assert.equal(unchanged.added,false);assert.equal(unchanged.state,customized);assert.equal(unchanged.state.entries[1].body,'Catalogo scritto da Martina');
  assert.equal(mergeMissingShopPage(state,{entries:[]}).state,state);
});
