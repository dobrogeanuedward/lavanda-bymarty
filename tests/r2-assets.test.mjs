import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildAssetPlan,DOGO_BUCKET,DOGO_CDN,imageRuntime,lavandaPrefix,main,normalizeKey,r2Configuration,signS3Request,stageAssetPlan,uploadAssetPlan,verifyPublicPlan} from '../scripts/upload-r2-assets.mjs';

const temporary=[];
after(async()=>{await Promise.all(temporary.map(directory=>rm(directory,{recursive:true,force:true})));});
async function fixture(){const directory=await mkdtemp(path.join(os.tmpdir(),'lavanda-r2-test-'));temporary.push(directory);await mkdir(path.join(directory,'assets'));await writeFile(path.join(directory,'assets','photo.webp'),Buffer.from('webp-test-fixture'));return directory;}
const env={R2_ENDPOINT:`https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,R2_ACCESS_KEY_ID:'test-access',R2_SECRET_ACCESS_KEY:'test-secret',R2_BUCKET:DOGO_BUCKET};
function head(item,extra={}){return new Response(null,{status:200,headers:{'content-length':String(item.bytes),'content-type':item.contentType,'x-amz-meta-sha256':item.sha256,etag:'"verified-test-etag"',...extra}});}

test('inventory isolates static assets with content hashes and immutable cache',async()=>{
 const source=await fixture();await mkdir(path.join(source,'fonts'));await writeFile(path.join(source,'fonts','font.woff2'),'font-fixture');await writeFile(path.join(source,'app.js'),'application');await writeFile(path.join(source,'.env'),'private');await writeFile(path.join(source,'seed.json'),'{}');
 const plan=await buildAssetPlan({source});
 assert.deepEqual(Object.keys(plan.assets),['/assets/photo.webp','/fonts/font.woff2']);
 const asset=plan.assets['/assets/photo.webp'];assert.match(asset.key,/^lavanda\/assets\/photo\.[a-f0-9]{20}\.webp$/);
 assert.equal(asset.path,'/r2/'+asset.key);assert.equal(asset.url,DOGO_CDN+'/'+asset.key);assert.match(asset.cacheControl,/immutable/);
 assert.equal(plan.mode,'dry-run');assert.equal(plan.bucket,DOGO_BUCKET);
});

test('dry-run is the default and neither reads credentials nor contacts R2',async()=>{
 const source=await fixture();let calls=0,result;
 await main(['--source',source],{env:{R2_SECRET_ACCESS_KEY:'never-print-this'},fetchImpl:()=>{calls++;throw Error('network');},output:value=>{result=JSON.parse(value);assert.ok(!value.includes('never-print-this'));}});
 assert.equal(calls,0);assert.equal(result.mode,'dry-run');
});

test('unsafe keys and prefixes cannot target DOGO objects',()=>{
 for(const value of ['../dogo','/dogo','dogo/../lavanda','C:/dogo','lavanda\\dogo','lavanda//x','lavanda/./x'])assert.throws(()=>normalizeKey(value));
 for(const value of ['dogo','lavanda-other','assets/lavanda'])assert.throws(()=>lavandaPrefix(value));
 assert.equal(lavandaPrefix('lavanda/edition-01'),'lavanda/edition-01');
 assert.throws(()=>r2Configuration({...env,R2_BUCKET:'another-bucket'}));
 assert.throws(()=>r2Configuration({...env,R2_ENDPOINT:'https://attacker.example'}));
});

test('asset inventory rejects symlinks before upload',async()=>{
 const source=await fixture();await symlink(path.join(source,'assets','photo.webp'),path.join(source,'linked.webp'));
 await assert.rejects(buildAssetPlan({source}),/symlinks/);
});

test('SigV4 matches the published AWS S3 GET Object test vector',()=>{
 // Public AWS example credentials; these are fixtures, never account credentials.
 const headers=signS3Request({url:'https://examplebucket.s3.amazonaws.com/test.txt',method:'GET',headers:{range:'bytes=0-9'},accessKeyId:'AKIAIOSFODNN7EXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',region:'us-east-1',now:new Date('2013-05-24T00:00:00Z')});
 assert.match(headers.authorization,/Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
 assert.equal(headers['x-amz-content-sha256'],'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('upload creates once and verifies bytes, MIME and digest before publishing manifest',async()=>{
 const source=await fixture(),plan=await buildAssetPlan({source}),item=Object.values(plan.assets)[0],calls=[];
 const result=await uploadAssetPlan(plan,{source,env,fetchImpl:async(url,request)=>{
  calls.push(request.method);assert.ok(new URL(url).pathname.startsWith('/dogostudio/lavanda/'));
  if(calls.length===1)return new Response(null,{status:404});
  if(request.method==='PUT'){assert.equal(request.headers['if-none-match'],'*');assert.equal(request.headers['x-amz-meta-sha256'],item.sha256);assert.equal(request.body.length,item.bytes);return new Response(null,{status:200});}
  return head(item);
 }});
 assert.deepEqual(calls,['HEAD','PUT','HEAD']);assert.equal(result.mode,'verified');assert.equal(Object.values(result.assets)[0].status,'uploaded');assert.equal(plan.mode,'dry-run');
});

test('matching existing objects are reused and conflicting ones are never overwritten',async()=>{
 const source=await fixture(),plan=await buildAssetPlan({source}),item=Object.values(plan.assets)[0];let calls=0;
 const result=await uploadAssetPlan(plan,{source,env,fetchImpl:async(url,request)=>{calls++;assert.equal(request.method,'HEAD');return head(item);}});
 assert.equal(calls,1);assert.equal(Object.values(result.assets)[0].status,'existing');
 await assert.rejects(uploadAssetPlan(plan,{source,env,fetchImpl:async(url,request)=>{assert.equal(request.method,'HEAD');return head(item,{'x-amz-meta-sha256':'different'});}}),/will not be overwritten/);
});

test('a concurrent conditional write can only reuse an identical verified object',async()=>{
 const source=await fixture(),plan=await buildAssetPlan({source}),item=Object.values(plan.assets)[0];let calls=0;
 const result=await uploadAssetPlan(plan,{source,env,fetchImpl:async(url,request)=>{calls++;if(calls===1)return new Response(null,{status:404});if(request.method==='PUT')return new Response(null,{status:412});return head(item);}});
 assert.equal(Object.values(result.assets)[0].status,'existing');
});

test('changed local source is rejected before any signed request',async()=>{
 const source=await fixture(),plan=await buildAssetPlan({source});await writeFile(path.join(source,'assets','photo.webp'),'changed');let calls=0;
 await assert.rejects(uploadAssetPlan(plan,{source,env,fetchImpl:()=>{calls++;}}),/changed after planning/);assert.equal(calls,0);
});

test('browser staging produces flat hashed objects and refuses unrelated existing files',async()=>{
 const source=await fixture(),directory=await mkdtemp(path.join(os.tmpdir(),'lavanda-r2-browser-'));temporary.push(directory);
 const plan=await buildAssetPlan({source}),staged=await stageAssetPlan(plan,{source,directory});
 assert.equal(staged.files.length,1);assert.ok(path.isAbsolute(staged.files[0]));
 const item=Object.values(staged.plan.assets)[0];assert.match(item.key,/^lavanda\/assets--photo\.[a-f0-9]{20}\.webp$/);assert.equal(path.basename(staged.files[0]),item.source);
 assert.deepEqual(await readFile(staged.files[0]),await readFile(path.join(source,'assets','photo.webp')));
 await writeFile(path.join(directory,'unrelated.webp'),'leave-this-alone');
 await assert.rejects(stageAssetPlan(plan,{source,directory}),/older or unrelated/);
 assert.equal(await readFile(path.join(directory,'unrelated.webp'),'utf8'),'leave-this-alone');
});

test('public verification authenticates browser-uploaded bytes without a token or private metadata',async()=>{
 const source=await fixture(),plan=await buildAssetPlan({source}),item=Object.values(plan.assets)[0],body=await readFile(path.join(source,item.source));
 const verified=await verifyPublicPlan(plan,{fetchImpl:async(url,options)=>{assert.equal(url,item.url);assert.equal(options.headers,undefined);return new Response(body,{headers:{'content-type':item.contentType}});}});
 assert.equal(verified.mode,'verified');assert.equal(Object.values(verified.assets)[0].status,'verified');
 await assert.rejects(verifyPublicPlan(plan,{fetchImpl:async()=>new Response('different',{headers:{'content-type':item.contentType}})}),/checksum/);
 await assert.rejects(verifyPublicPlan(plan,{fetchImpl:async()=>new Response(body,{headers:{'content-type':'text/html'}})}),/MIME/);
});

let sharp;try{sharp=imageRuntime();}catch{}
test('optimization stages responsive WebP/AVIF and keeps source files unchanged',{skip:!sharp},async()=>{
 const source=await mkdtemp(path.join(os.tmpdir(),'lavanda-r2-images-')),staging=await mkdtemp(path.join(os.tmpdir(),'lavanda-r2-staging-'));temporary.push(source,staging);
 const original=await sharp({create:{width:1600,height:1000,channels:4,background:{r:181,g:140,b:255,alpha:0.7}}}).png().toBuffer();
 await writeFile(path.join(source,'photo.png'),original);await writeFile(path.join(source,'mark.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 const plan=await buildAssetPlan({source,optimize:true,staging,sharp}),image=plan.assets['/photo.png'];
 assert.deepEqual(await readFile(path.join(source,'photo.png')),original);
 assert.equal(plan.optimized,true);assert.equal(image.contentType,'image/webp');assert.equal(image.width,1536);assert.match(image.key,/\.webp$/);
 for(const format of ['webp','avif']){
  assert.deepEqual(image.variants[format].map(item=>item.width),[640,960,1536]);
  for(const variant of image.variants[format]){const metadata=await sharp(await readFile(path.join(staging,variant.source))).metadata();assert.equal(metadata.width,variant.width);assert.equal(metadata.height,variant.height);assert.equal(metadata.hasAlpha,true);}
 }
 assert.equal(plan.assets['/mark.svg'].contentType,'image/svg+xml');assert.equal(await readFile(path.join(staging,'mark.svg'),'utf8'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 const all=[...image.variants.webp,...image.variants.avif,plan.assets['/mark.svg']],byKey=new Map(all.map(item=>[item.key,item]));let puts=0;
 const uploaded=await uploadAssetPlan(plan,{source:staging,env,fetchImpl:async(url,request)=>{
  const key=decodeURIComponent(new URL(url).pathname).replace('/dogostudio/',''),item=byKey.get(key);assert.ok(item);
  if(request.method==='PUT'){puts++;return new Response(null,{status:200});}
  if(!item.sent){item.sent=true;return new Response(null,{status:404});}return head(item);
 }});
 assert.equal(puts,7);assert.equal(uploaded.assets['/photo.png'].status,'uploaded');
 for(const variant of Object.values(uploaded.assets['/photo.png'].variants).flat())assert.equal(variant.status,'uploaded');
});
