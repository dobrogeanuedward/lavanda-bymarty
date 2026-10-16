import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSeedPlan, applySeed, seedConfiguration, runSeed, SeedError } from '../scripts/seed-cms.mjs';
import { UUID } from '../lib/cms.mjs';

const AUTHOR = 'dd3ca191-1698-4aaf-bbac-87b79562b015';
const OTHER = '34d7c5b9-83f1-4d98-9a23-1365c5acb66b';
const ENV = { SUPABASE_URL:'https://lavanda-seed-test.supabase.co', SUPABASE_SECRET_KEY:'sb_secret_test_server_key', LAVANDA_CMS_PROJECT_REF:'lavanda-seed-test', LAVANDA_CMS_AUTHOR_ID:AUTHOR };
const source = JSON.parse(await readFile(new URL('../public/admin/seed.json',import.meta.url),'utf8'));
const assetUrls = Object.fromEntries(source.media.map(m => [m.public_url,`https://lavanda-assets.example${m.public_url}`]));
const plan = await createSeedPlan(source,{assetUrls});
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function remote({ active=true, failSecondEntry=false } = {}) {
  const tables = {
    cms_profiles:[{id:AUTHOR,role:'admin',active}], cms_entries:[], cms_taxonomies:[],
    cms_settings:[{id:OTHER,singleton:true,tagline:'Impostazioni già curate'}],
  };
  const calls = [];
  const fetchImpl = async (input,options) => {
    const url = new URL(input); calls.push({url,options});
    assert.equal(url.origin,ENV.SUPABASE_URL);
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.apikey,ENV.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization,undefined);
    assert.ok(['GET','POST'].includes(options.method));
    assert.ok(url.pathname.startsWith('/rest/v1/'));
    const table = url.pathname.split('/').at(-1), rows = tables[table];
    assert.ok(rows,`Unexpected table: ${table}`);
    if (options.method === 'GET') return json(rows.filter(row => [...url.searchParams].every(([key,value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3))));
    assert.match(options.headers.Prefer,/resolution=ignore-duplicates/);
    if (table === 'cms_entries' && failSecondEntry && rows.length === 1) { failSecondEntry=false; return json({message:ENV.SUPABASE_SECRET_KEY},500); }
    const row = JSON.parse(options.body), conflict = url.searchParams.get('on_conflict').split(',');
    if (rows.some(existing => conflict.every(key => existing[key] === row[key]))) return json([]);
    const saved = {id:OTHER,...row}; rows.push(saved); return json([saved],201);
  };
  return {tables,calls,fetchImpl};
}
const mutations = api => api.calls.filter(c => c.options.method !== 'GET');

test('real seed becomes stable CMS rows with external R2 covers and preserved drafts',async()=>{
  const repeated = await createSeedPlan(source,{assetUrls});
  assert.equal(plan.entries.length,source.entries.length); assert.equal(plan.assets.length,source.media.length);
  const shop=plan.entries.find(entry=>entry.type==='page'&&entry.slug==='shop');
  assert.ok(shop); assert.equal(shop.status,'draft'); assert.equal(shop.seo.noindex,true);
  assert.deepEqual(plan,repeated);
  for (const entry of plan.entries) {
    assert.match(entry.id,UUID); assert.equal(entry.status,'draft'); assert.equal(entry.seo.noindex,true);
    assert.equal(entry.published_at,null); assert.equal(Object.hasOwn(entry,'updated_at'),false);
    assert.equal(Object.hasOwn(entry.metadata,'cover_alt'),false); assert.equal(entry.cover_media_id,null);
    if (entry.type === 'post') {
      assert.ok(entry.metadata.image_alt);
      assert.ok(Object.values(assetUrls).includes(entry.metadata.cover_url));
    }
  }
  assert.equal(plan.entries.find(e => e.type === 'fanzine').fanzine_pages.length,4);
  for (const asset of plan.assets) { assert.ok(asset.sizeBytes>0); assert.match(asset.hash,/^[a-f0-9]{64}$/); }
});

test('default dry run validates offline and never reads or prints credentials',async()=>{
  const output=[]; let network=0;
  await runSeed({args:[],env:{SUPABASE_SECRET_KEY:'secret-must-not-appear'},fetchImpl:async()=>{network++;throw Error();},log:value=>output.push(value)});
  assert.equal(network,0); assert.match(output.join('\n'),/Dry run/);
  assert.doesNotMatch(output.join('\n'),/secret-must-not-appear/);
  await assert.rejects(runSeed({args:['--key=secret-must-not-appear'],log:()=>{}}),error => error instanceof SeedError && !error.message.includes('secret-must-not-appear'));
});

test('apply accepts only server credentials for the explicitly matched HTTPS project',()=>{
  const config=seedConfiguration(ENV); assert.equal(config.legacy,false);
  for(const url of ['http://localhost:54321','https://attacker.test','https://lavanda-seed-test.supabase.co/extra','https://user:pass@lavanda-seed-test.supabase.co','https://lavanda-seed-test.supabase.co/#secret','https://lavanda-seed-test.supabase.co:444'])assert.throws(()=>seedConfiguration({...ENV,SUPABASE_URL:url}),SeedError);
  for(const override of [{LAVANDA_CMS_PROJECT_REF:'other'},{LAVANDA_CMS_AUTHOR_ID:'seed-author'},{SUPABASE_SECRET_KEY:'sb_publishable_test_key'},{SUPABASE_SECRET_KEY:'sb_secret_bad key'}])assert.throws(()=>seedConfiguration({...ENV,...override}),SeedError);
  const legacy=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;
  assert.equal(seedConfiguration({...ENV,SUPABASE_SECRET_KEY:undefined,SUPABASE_SERVICE_ROLE_KEY:legacy}).legacy,true);
  const anon=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`;
  assert.throws(()=>seedConfiguration({...ENV,SUPABASE_SECRET_KEY:anon}),SeedError);
});

test('repeat import keeps existing editorial edits and settings without Storage calls',async()=>{
  const api=remote(), config=seedConfiguration(ENV);
  const first=await applySeed(plan,config,api);
  assert.equal(first.entries,source.entries.length); assert.equal(first.settings,0);
  assert.equal(api.tables.cms_entries[0].author_id,AUTHOR);
  api.tables.cms_entries[0].body='Modifica redazionale da conservare';
  api.tables.cms_entries[0].status='published';
  const writes=mutations(api).length;
  const second=await applySeed(plan,config,api);
  assert.equal(second.entries,0); assert.equal(mutations(api).length,writes);
  assert.equal(api.tables.cms_entries[0].body,'Modifica redazionale da conservare');
  assert.equal(api.tables.cms_entries[0].status,'published');
  assert.equal(api.tables.cms_settings[0].tagline,'Impostazioni già curate');
});

test('a partial import resumes without duplicate rows or upstream secrets in errors',async()=>{
  const api=remote({failSecondEntry:true}), config=seedConfiguration(ENV);
  await assert.rejects(applySeed(plan,config,api),error => error instanceof SeedError && /HTTP 500/.test(error.message) && !error.message.includes(config.key));
  assert.equal(api.tables.cms_entries.length,1);
  const retried=await applySeed(plan,config,api);
  assert.equal(retried.entries,source.entries.length-1); assert.equal(api.tables.cms_entries.length,source.entries.length);
});

test('inactive administrator and missing schema fail during read-only preflight',async()=>{
  const api=remote({active:false});
  await assert.rejects(applySeed(plan,seedConfiguration(ENV),api),/amministratore attivo/);
  assert.equal(mutations(api).length,0);
  let writes=0;
  await assert.rejects(applySeed(plan,seedConfiguration(ENV),{fetchImpl:async(_url,options)=>{if(options.method!=='GET')writes++;return json({message:'sensitive upstream detail'},403);}}),error=>!error.message.includes('sensitive'));
  assert.equal(writes,0);
});

test('local hosted assets work without R2 and an optional R2 mapping must be complete and HTTPS',async()=>{
  const dryPlan=await createSeedPlan(source), api=remote();
  const result=await applySeed(dryPlan,seedConfiguration(ENV),api);
  assert.equal(result.entries,source.entries.length);
  assert.ok(api.tables.cms_entries.filter(entry=>entry.type==='post').every(entry=>entry.metadata.cover_url.startsWith('/assets/')));
  for(const mapping of [{}, {...assetUrls,[source.media[0].public_url]:'http://unsafe.example/a.webp'}, {...assetUrls,[source.media[0].public_url]:'https://user:pass@unsafe.example/a.webp'}, {...assetUrls,[source.media[0].public_url]:'https://assets.example/a.webp?X-Amz-Credential=private'}])await assert.rejects(createSeedPlan(source,{assetUrls:mapping}),SeedError);
});

test('existing natural keys keep their identity and remap fanzine references',async()=>{
  const input=structuredClone(source);
  input.entries.find(e=>e.type==='fanzine').metadata.article_ids=[input.entries[0].id];
  const linked=await createSeedPlan(input,{assetUrls}), api=remote();
  api.tables.cms_entries.push({...linked.entries[0],id:OTHER,body:'Testo già presente'});
  const result=await applySeed(linked,seedConfiguration(ENV),api);
  assert.equal(result.entries,source.entries.length-1);
  assert.equal(api.tables.cms_entries[0].body,'Testo già presente');
  assert.deepEqual(api.tables.cms_entries.find(e=>e.type==='fanzine').metadata.article_ids,[OTHER]);
});

test('bad seed references, private notes, unsafe assets and duplicate slugs are rejected locally',async()=>{
  for(const mutate of [
    s=>s.entries.push({...s.entries[0],id:'different'}),
    s=>s.entries[0].cover_media_id='missing-media',
    s=>s.entries[0].editorial_notes='Private research',
    s=>s.media[0].public_url='/assets/../../secret.webp',
    s=>s.entries[0].metadata.cover_url='javascript:alert(1)',
  ]) { const input=structuredClone(source);mutate(input);await assert.rejects(createSeedPlan(input),SeedError); }
  await assert.rejects(createSeedPlan(source,{readAsset:async()=>Buffer.from('not an image')}),SeedError);
});
