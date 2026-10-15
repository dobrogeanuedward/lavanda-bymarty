import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import configHandler from '../api/config.mjs';
import authHandler from '../api/auth.mjs';
import cmsHandler from '../api/cms.mjs';
import publicHandler from '../api/public.mjs';
import eventHandler from '../api/event.mjs';
import mediaHandler from '../api/media.mjs';
import { authorize, configuration, readBody, requireOrigin, safeUrl, validateEvent, validateMedia, validatePublish, validateResource, setSession, analyticsSignature } from '../lib/cms.mjs';

const ID='d7d460fe-7602-42c0-a47b-bb86f26d453d', OTHER='3ab58432-f4cf-4231-81f2-9f45616f2a76';
const ENV_KEYS=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','APP_ORIGIN','CMS_ALLOWED_ORIGINS','CMS_ANALYTICS_KEY','NODE_ENV','VERCEL','VERCEL_URL'];
const BASE_ENV={SUPABASE_URL:'https://lavandatest.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key',APP_ORIGIN:'https://lavanda.example',NODE_ENV:'production'};
const PROFILE={id:ID,display_name:'Martina',role:'admin',active:true,version:1};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
async function withEnv(env,run){const old=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];Object.assign(process.env,env);try{return await run();}finally{for(const k of ENV_KEYS){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}}
async function call(handler,{method='GET',url='/',body,headers={}}={}){
 const req={method,url,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers},body};
 const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(value){this.output=value;}};
 await handler(req,res);
 let value;try{value=JSON.parse(String(res.output));}catch{value=res.output;}
 return {status:res.statusCode,headers:res.headers,body:value};
}
const WRITE_HEADERS={origin:'https://lavanda.example','x-cms-request':'1',cookie:'__Host-lv_access=verified-token'};
async function mockFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}
function authMock(profile=PROFILE,extra=()=>reply([])){return async(url,options)=>{if(url.endsWith('/auth/v1/user'))return reply({id:ID,email:'martina@example.test',user_metadata:{role:'admin'}});if(url.includes('/rest/v1/cms_profiles?'))return reply(profile?[profile]:[]);return extra(url,options);};}

test('setup fails closed and no secrets are returned',async()=>withEnv({},async()=>{
 let network=0;
 await mockFetch(async()=>{network++;throw Error('must not call');},async()=>{
  const config=await call(configHandler);assert.equal(config.body.configured,false);assert.equal(config.body.setupRequired,true);
  for(const handler of[authHandler,cmsHandler,publicHandler,mediaHandler]){const r=await call(handler);assert.equal(r.status,503);assert.equal(r.body.error.code,'SETUP_REQUIRED');}
  assert.equal(network,0);assert.doesNotMatch(JSON.stringify(config.body),/SUPABASE|service_role|sb_publishable/);
 });
}));
test('configuration rejects SSRF URLs, elevated keys and wildcard origins',()=>{
 for(const url of['http://localhost:54321','https://attacker.test','https://good.supabase.co/evil','https://u:p@good.supabase.co'])assert.equal(configuration({...BASE_ENV,SUPABASE_URL:url}).configured,false);
 assert.equal(configuration({...BASE_ENV,SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_allowed'}).configured,false);
 const service=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;
 assert.equal(configuration({...BASE_ENV,SUPABASE_PUBLISHABLE_KEY:service}).configured,false);
 assert.deepEqual(configuration({...BASE_ENV,CMS_ALLOWED_ORIGINS:'https://*.vercel.app'}).origins,['https://lavanda.example']);
});
test('CSRF enforces an exact origin and custom browser request header',()=>{
 const c=configuration(BASE_ENV);
 for(const h of[{}, {origin:'https://evil.example','x-cms-request':'1'},{origin:'https://lavanda.example'},{origin:'https://lavanda.example','x-cms-request':'1','sec-fetch-site':'cross-site'}])assert.throws(()=>requireOrigin({headers:h},c),e=>e.status===403);
 assert.doesNotThrow(()=>requireOrigin({headers:WRITE_HEADERS},c));
});
test('body limit and invalid JSON are rejected before processing',async()=>{
 await assert.rejects(readBody({headers:{'content-type':'text/html'},body:'{}'}),e=>e.status===415);
 await assert.rejects(readBody({headers:{'content-type':'application/json'},body:'{invalid'}),e=>e.code==='INVALID_JSON');
 await assert.rejects(readBody({headers:{'content-type':'application/json'},body:{text:'x'.repeat(2000)}},100),e=>e.status===413);
});
test('resource schemas reject privilege and query injection fields',()=>{
 assert.throws(()=>validateResource('entries',{type:'post',title:'x',slug:'x',author_id:OTHER},true),e=>e.code==='UNKNOWN_FIELD');
 assert.throws(()=>validateResource('entries',{type:'post',title:'x',slug:'x&status=eq.draft'},true),e=>e.code==='INVALID_SLUG');
 assert.throws(()=>validateResource('entries',{title:'changed'},false),e=>e.code==='VERSION_REQUIRED');
 assert.throws(()=>validateResource('profiles',{version:1,role:'superadmin'},false));
 assert.throws(()=>validateResource('settings',{version:1,navigation:[{label:'X',href:'javascript:alert(1)'}]},false),e=>e.code==='UNSAFE_URL');
 assert.throws(()=>validateResource('entries',{version:1,metadata:{raw_html:'<script>'}},false),e=>e.code==='UNKNOWN_FIELD');
});
test('body remains text while URL-bearing fields disallow executable schemes',()=>{
 const value=validateResource('entries',{type:'post',title:'<script>x</script>',slug:'titolo',body:'<img src=x onerror=alert(1)>'},true);
 assert.equal(value.body,'<img src=x onerror=alert(1)>'); // Renderers must escape text; no raw HTML API format.
 for(const url of['javascript:alert(1)','data:text/html,x','//evil.example/x','/\\evil.example/x','/x%0aHeader:x'])assert.throws(()=>safeUrl(url,'url',{local:true}));
 assert.equal(safeUrl('/assets/ritual.webp','cover',{local:true}),'/assets/ritual.webp');
});
test('role and ownership checks prevent publish, IDOR and viewer edits',()=>{
 const author={...PROFILE,role:'author'};
 assert.throws(()=>authorize(author,'entries','PATCH',{author_id:OTHER,status:'draft'},{status:'review'}),e=>e.status===403);
 assert.throws(()=>authorize(author,'entries','POST',null,{status:'published'}),e=>e.code==='PUBLISH_FORBIDDEN');
 assert.throws(()=>authorize(author,'media','PATCH',{author_id:ID},{published:true}),e=>e.code==='PUBLISH_FORBIDDEN');
 assert.throws(()=>authorize({...PROFILE,role:'viewer'},'entries','POST'),e=>e.status===403);
 assert.throws(()=>authorize({...PROFILE,active:false},'entries','GET'),e=>e.code==='NOT_A_MEMBER');
 assert.doesNotThrow(()=>authorize(author,'entries','PATCH',{author_id:ID,status:'draft'},{status:'review'}));
});
test('publish requires real content and schedule requires a future date',()=>{
 assert.throws(()=>validatePublish({status:'published',title:'Titolo',slug:'titolo',body:''}),e=>e.code==='INCOMPLETE_PUBLICATION');
 assert.throws(()=>validatePublish({status:'scheduled',title:'Titolo',slug:'titolo',body:'Contenuto',published_at:'2020-01-01T00:00:00Z'}),e=>e.code==='INVALID_SCHEDULE');
 assert.doesNotThrow(()=>validatePublish({status:'published',title:'Titolo',slug:'titolo',body:'Contenuto'}));
});
test('media uses signature detection, byte caps and blocks SVG/HTML',()=>{
 const base={filename:'photo.png',mime_type:'image/png',content_base64:Buffer.from('89504e470d0a1a0a00000000','hex').toString('base64')};
 assert.equal(validateMedia(base).mime,'image/png');
 assert.throws(()=>validateMedia({...base,mime_type:'image/svg+xml',content_base64:Buffer.from('<svg/>').toString('base64')}));
 assert.throws(()=>validateMedia({...base,content_base64:Buffer.from('<html><script>alert(1)</script>').toString('base64')}),e=>e.code==='MIME_MISMATCH');
 assert.throws(()=>validateMedia({...base,content_base64:Buffer.alloc(3145729).toString('base64')}),e=>e.status===413);
});
test('session cookies are HttpOnly, strict, secure and not public JSON',()=>{
 const res={setHeader(k,v){this[k]=v;}};setSession(res,{access_token:'token',refresh_token:'refresh',expires_in:3600},configuration(BASE_ENV));
 for(const cookie of res['Set-Cookie']){assert.match(cookie,/^__Host-lv_/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/; Secure/);assert.doesNotMatch(cookie,/Domain=/);}
});
test('forged or absent sessions never reach private collections',async()=>withEnv(BASE_ENV,async()=>{
 let calls=0;
 await mockFetch(async()=>{calls++;return reply({message:'invalid'},401);},async()=>{
  const absent=await call(cmsHandler,{url:'/api/cms?resource=entries'});assert.equal(absent.status,401);assert.equal(calls,0);
  const forged=await call(cmsHandler,{url:'/api/cms?resource=entries',headers:{cookie:'__Host-lv_access=fake.jwt.token'}});assert.equal(forged.status,401);assert.equal(calls,1);
 });
}));
test('user metadata cannot assign a role without an active DB membership',async()=>withEnv(BASE_ENV,async()=>mockFetch(authMock(null),async()=>{
 const r=await call(cmsHandler,{url:'/api/cms?resource=entries',headers:WRITE_HEADERS});assert.equal(r.status,403);assert.equal(r.body.error.code,'NOT_A_MEMBER');
})));
test('stale versions fail before mutation and valid saves use the transactional RPC',async()=>withEnv(BASE_ENV,async()=>{
 const original={id:OTHER,type:'post',title:'Prima',slug:'prima',body:'Testo',status:'draft',version:4,author_id:ID};let writes=0,lastRequest=null;
 await mockFetch(authMock(PROFILE,(url,opts)=>{if(url.endsWith('/rpc/cms_save_entry')){writes++;lastRequest=JSON.parse(opts.body);return reply({...original,...lastRequest.p_entry,editorial_notes:lastRequest.p_editorial_notes,version:5});}return reply([original]);}),async()=>{
  const stale=await call(cmsHandler,{method:'PATCH',url:`/api/cms?resource=entries&id=${OTHER}`,headers:WRITE_HEADERS,body:{version:3,title:'Dopo'}});assert.equal(stale.status,409);assert.equal(writes,0);
  const saved=await call(cmsHandler,{method:'PATCH',url:`/api/cms?resource=entries&id=${OTHER}`,headers:WRITE_HEADERS,body:{version:4,title:'Dopo',editorial_notes:'Nota privata'}});assert.equal(saved.status,200);assert.equal(saved.body.data.version,5);assert.equal(writes,1);assert.equal(lastRequest.p_expected_version,4);assert.equal(lastRequest.p_editorial_notes,'Nota privata');assert.ok(!Object.hasOwn(lastRequest.p_entry,'editorial_notes'));
 });
}));
test('published public endpoint cannot request draft, audit or profile data',async()=>withEnv(BASE_ENV,async()=>{
 let lastUrl='';await mockFetch(async(url)=>{lastUrl=url;return reply([]);},async()=>{
  const r=await call(publicHandler,{url:'/api/public?resource=entries&status=draft&select=author_id'});assert.equal(r.status,200);const u=new URL(lastUrl);assert.equal(u.searchParams.get('status'),'in.(published,scheduled)');assert.match(u.searchParams.get('published_at'),/^lte\./);assert.ok(!u.searchParams.get('select').includes('author_id'));
  for(const resource of['profiles','audit','revisions'])assert.equal((await call(publicHandler,{url:`/api/public?resource=${resource}`})).status,404);
 });
}));
test('content search strips PostgREST syntax and filter type is allowlisted',async()=>withEnv(BASE_ENV,async()=>{
 let url='';await mockFetch(authMock(PROFILE,(u)=>{url=u;return reply([]);}),async()=>{
  const r=await call(cmsHandler,{url:'/api/cms?resource=entries&type=post&search=%25%2Cor%28id.neq.x%29',headers:WRITE_HEADERS});assert.equal(r.status,200);const q=new URL(url).searchParams;assert.equal(q.get('type'),'eq.post');assert.doesNotMatch(q.get('title'),/[,()%]/);
  assert.equal((await call(cmsHandler,{url:'/api/cms?resource=entries&type=post%2Cstatus.eq.draft',headers:WRITE_HEADERS})).status,422);
 });
}));
test('analytics accepts no visitor identifiers and respects privacy signals',async()=>withEnv({...BASE_ENV,CMS_ANALYTICS_KEY:'a'.repeat(40)},async()=>{
 for(const body of[{event:'pageview',path:'/blog/',ip:'1.2.3.4'},{event:'pageview',path:'/blog/?email=a'},{event:'pageview',path:'/admin/'},{event:'pageview',path:'//attacker.test'}])assert.throws(()=>validateEvent(body));
 let calls=0;await mockFetch(async(_url,opts)=>{calls++;const b=JSON.parse(opts.body);assert.equal(b.p_event,'page_view');assert.equal(b.p_signature,analyticsSignature('a'.repeat(40),b.p_timestamp,{event:'page_view',path:'/blog/'}));return reply(true);},async()=>{
  const dnt=await call(eventHandler,{method:'POST',url:'/api/event',headers:{origin:'https://lavanda.example',dnt:'1'},body:{event:'pageview',path:'/blog/'}});assert.equal(dnt.status,200);assert.equal(dnt.body.data.recorded,false);assert.equal(calls,0);
  const valid=await call(eventHandler,{method:'POST',url:'/api/event',headers:{origin:'https://lavanda.example'},body:{event:'pageview',path:'/blog/'}});assert.equal(valid.body.data.recorded,true);assert.equal(calls,1);
 });
}));
test('database bootstrap has RLS on all public CMS tables and no service bypass',async()=>{
 const sql=await readFile(new URL('../database/bootstrap.sql',import.meta.url),'utf8');
 for(const table of['cms_profiles','cms_entries','cms_media','cms_taxonomies','cms_settings','cms_redirects','cms_revisions','cms_comments','cms_audit','cms_analytics_daily'])assert.ok(sql.includes(`'${table}'`),`${table} must be in RLS loop`);
 assert.match(sql,/enable row level security/);assert.match(sql,/new\.id,'Redazione','viewer',false/);assert.match(sql,/published_at<=now\(\)/);assert.match(sql,/private\.cms_secrets/);assert.doesNotMatch(sql,/grant\s+(?:all|insert|update|delete)\s+on\s+public\.cms_(?:revisions|audit|analytics_daily)/i);
});
