import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Optional isolated PostgreSQL QA: no Supabase account, network or production credentials.
// LAVANDA_PGLITE_MODULE=/absolute/path/to/pinned/pglite/dist/index.js node --test tests/cms-database.test.mjs
const modulePath=process.env.LAVANDA_PGLITE_MODULE;
test('PostgreSQL bootstrap, RLS, atomic notes, revisions and storage publication', {skip:!modulePath}, async()=>{
 const {PGlite}=await import(modulePath),db=new PGlite();
 const ids={admin:'dd3ca191-1698-4aaf-bbac-87b79562b015',editor:'34d7c5b9-83f1-4d98-9a23-1365c5acb66b',author:'220eb072-2a22-4e85-8dc4-147d55e21a9d',other:'8643795e-f087-4a98-87e9-ff328a86702a',viewer:'c4c376bc-d5a1-400c-b372-305582a045b6',outsider:'044ce995-c2e4-4fd1-9d9d-d72500877cce'};
 const q=(sql,args=[])=>db.query(sql,args);
 const as=async(user=null)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user?ids[user]:'']);await db.exec(user?'set role authenticated':'set role anon');};
 const save=async(id,v,data,notes=null)=>(await q('select public.cms_save_entry($1,$2,$3::jsonb,$4)as entry',[id,v,JSON.stringify(data),notes])).rows[0].entry;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to anon,authenticated;
   grant execute on function auth.uid()to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
   alter table storage.objects enable row level security;
   grant select,insert,update,delete on storage.objects to anon,authenticated;
   create function storage.foldername(text)returns text[]language sql immutable as $$select string_to_array($1,'/')$$;
   -- Crypto is stubbed here; Node tests verify real HMAC. RLS/PLpgSQL use actual PostgreSQL.
   create function extensions.hmac(text,text,text)returns bytea language sql immutable as $$select decode(repeat('aa',32),'hex')$$;`);
  const sql=(await readFile(new URL('../database/bootstrap.sql',import.meta.url),'utf8')).replace('create extension if not exists pgcrypto with schema extensions;','-- pgcrypto stubbed in isolated test only');
  await db.exec(sql);
  for(const [name,id]of Object.entries(ids))await q('insert into auth.users(id,email)values($1,$2)',[id,`${name}@example.test`]);
  for(const name of['admin','editor','author','other','viewer'])await q('update public.cms_profiles set role=$1,active=true where id=$2',[name==='other'?'author':name,ids[name]]);
  assert.equal((await q('select active from public.cms_profiles where id=$1',[ids.outsider])).rows[0].active,false);
  await as('author');
  const draft=await save(null,null,{type:'post',title:'Bozza privata',slug:'bozza-privata',body:'Contenuto di prova'},'Ricerca privata');
  assert.equal(draft.version,1);assert.equal(draft.editorial_notes,'Ricerca privata');
  const changed=await save(draft.id,1,{title:'Bozza revisionata'},'Nuova nota privata');assert.equal(changed.version,2);
  await assert.rejects(save(draft.id,1,{title:'Salvataggio obsoleto'},'Non salvare'),e=>e.code==='40001');
  assert.equal((await q('select body from public.cms_entry_notes where entry_id=$1',[draft.id])).rows[0].body,'Nuova nota privata');
  assert.equal((await q('select count(*)::int as n from public.cms_revisions where entry_id=$1',[draft.id])).rows[0].n,2);
  await assert.rejects(save(draft.id,2,{status:'published'}),e=>e.code==='42501');
  await as('other');await assert.rejects(save(draft.id,2,{body:'Sovrascritto da altro autore'}));
  await as('viewer');await assert.rejects(save(draft.id,2,{body:'Viewer edit'}),e=>e.code==='42501');
  await as('outsider');assert.equal((await q('select*from public.cms_entries')).rows.length,0);assert.equal((await q('select*from public.cms_entry_notes')).rows.length,0);
  await as();assert.equal((await q('select*from public.cms_entries')).rows.length,0);await assert.rejects(q('select*from public.cms_entry_notes'),e=>e.code==='42501');
  await as('admin');
  const published=await save(draft.id,2,{status:'published'});assert.ok(published.published_at);assert.equal(published.version,3);
  await as();const publicEntries=(await q('select*from public.cms_entries')).rows;assert.equal(publicEntries.length,1);assert.ok(!Object.hasOwn(publicEntries[0],'editorial_notes'));
  await as('admin');await save(draft.id,3,{status:'draft'});await as();assert.equal((await q('select*from public.cms_entries')).rows.length,0);
  await as('author');
  const mediaId='e2c8e637-4507-4b0b-944a-898d0b38d50a',storagePath=`${ids.author}/${mediaId}.png`;
  await q("insert into storage.objects(bucket_id,name,owner_id)values('lavanda-media',$1,$2)",[storagePath,ids.author]);
  await q('insert into public.cms_media(id,title,mime_type,size_bytes,storage_path,public_url,author_id)values($1,$2,$3,$4,$5,$6,$7)',[mediaId,'Foto','image/png',20,storagePath,`/api/media?id=${mediaId}`,ids.author]);
  assert.equal((await q('delete from storage.objects where name=$1 returning*',[storagePath])).rows.length,0);
  await assert.rejects(q("insert into storage.objects(bucket_id,name)values('lavanda-media',$1)",[storagePath]),e=>e.code==='42501');
  await as('admin');await q('update public.cms_media set published=true where id=$1',[mediaId]);
  await as('author');assert.equal((await q('delete from storage.objects where name=$1 returning*',[storagePath])).rows.length,0);
  assert.equal((await q('update public.cms_media set published=false where id=$1 returning*',[mediaId])).rows.length,0);
  await as();assert.equal((await q('select*from storage.objects where name=$1',[storagePath])).rows.length,1);
  await db.exec('reset role');await q("insert into private.cms_secrets(name,value)values('analytics_hmac',$1)",['a'.repeat(40)]);
  await as();
  for(const args of[[null,'/',Math.floor(Date.now()/1000),'aa'.repeat(32)],['page_view',null,Math.floor(Date.now()/1000),'aa'.repeat(32)],['page_view','/',null,'aa'.repeat(32)],['page_view','/',Math.floor(Date.now()/1000),null]])await assert.rejects(q('select public.cms_record_event($1,$2,$3,$4)',args),e=>e.code==='42501');
  await assert.rejects(q('select public.cms_record_event($1,$2,$3,$4)',['page_view','/',Math.floor(Date.now()/1000),'ff'.repeat(32)]),e=>e.code==='42501');
  assert.equal((await q('select public.cms_record_event($1,$2,$3,$4)as recorded',['page_view','/',Math.floor(Date.now()/1000),'aa'.repeat(32)])).rows[0].recorded,true);
  await assert.rejects(q('select*from public.cms_analytics_daily'),e=>e.code==='42501');
  await as('admin');const metrics=(await q('select public.cms_analytics(30)as data')).rows[0].data;assert.equal(metrics.totals.page_view,1);assert.equal(metrics.daily.length,1);
 }finally{await db.close();}
});
