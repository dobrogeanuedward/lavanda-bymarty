import {createHash,createHmac} from 'node:crypto';
import {lstat,readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';

export const DOGO_BUCKET='dogostudio';
export const DOGO_CDN='https://pub-b39e5084f7324516a4fe99c212a65c5f.r2.dev';
export const ASSET_CACHE='public, max-age=31536000, immutable';
const MAX_BYTES=25*1024*1024;
const TYPES={'.webp':'image/webp','.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.pdf':'application/pdf','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
const encodeKey=key=>key.split('/').map(encode).join('/');
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DEFAULT_STAGING=path.join(ROOT,'.cache','r2-assets');
const require=createRequire(import.meta.url);

export function normalizeKey(value){
 if(typeof value!=='string'||!value||value.includes('\\')||/[\u0000-\u001f\u007f]/.test(value)||value.startsWith('/')||/^[A-Za-z]:/.test(value))throw Error('Unsafe object key.');
 const segments=value.split('/');
 if(segments.some(segment=>!segment||segment==='.'||segment==='..'))throw Error('Unsafe object key.');
 return value;
}
export function lavandaPrefix(value='lavanda'){
 const prefix=normalizeKey(value);
 if(prefix!=='lavanda'&&!prefix.startsWith('lavanda/'))throw Error('The object prefix must stay inside lavanda/.');
 return prefix;
}

function assetRecord({relative,source,bytes,contentType,prefix,width,height}){
 const sha256=hash(bytes),ext=path.extname(relative),stem=relative.slice(0,-ext.length),key=normalizeKey(`${prefix}/${stem}.${sha256.slice(0,20)}${ext}`);
 return {source,key,path:'/r2/'+encodeKey(key),url:DOGO_CDN+'/'+encodeKey(key),sha256,bytes:bytes.length,contentType,cacheControl:ASSET_CACHE,status:'planned',...(width?{width,height}:{})};
}
export function imageRuntime(env=process.env){
 try{return require(env.LAVANDA_SHARP_MODULE||'sharp');}catch{throw Error('--optimize requires the existing Sharp runtime. Set LAVANDA_SHARP_MODULE to its package directory.');}
}

export async function buildAssetPlan({source=path.join(ROOT,'public'),prefix='lavanda',optimize=false,staging=DEFAULT_STAGING,sharp=optimize?imageRuntime():null}={}){
 const sourceRoot=path.resolve(source),safePrefix=lavandaPrefix(prefix),assets={};
 const stagingRoot=path.resolve(staging);
 if(optimize&&(stagingRoot===sourceRoot||stagingRoot.startsWith(sourceRoot+path.sep)))throw Error('Optimization staging must be outside the original asset directory.');
 async function walk(directory){
  const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
   if(entry.name.startsWith('.'))continue;
   const file=path.join(directory,entry.name),info=await lstat(file);
   if(info.isSymbolicLink())throw Error('Asset symlinks are not allowed.');
   if(info.isDirectory()){await walk(file);continue;}
   if(!info.isFile())throw Error('Assets must be regular files.');
   const ext=path.extname(entry.name).toLowerCase(),contentType=TYPES[ext];
   if(!contentType)continue; // Application HTML, JavaScript, CSS and JSON stay in the build.
   if(info.size>MAX_BYTES)throw Error('An asset exceeds the 25 MiB single-upload limit.');
   const relative=normalizeKey(path.relative(sourceRoot,file).split(path.sep).join('/'));
   const bytes=await readFile(file);
   if(optimize&&['.png','.jpg','.jpeg','.webp','.avif'].includes(ext)){
    const metadata=await sharp(bytes,{animated:true}).metadata();
    if((metadata.pages||1)===1){
     const originalWidth=[5,6,7,8].includes(metadata.orientation)?metadata.height:metadata.width;
     const widths=[...new Set([640,960,1536].map(width=>Math.min(width,originalWidth)))].sort((a,b)=>a-b);
     const variants={webp:[],avif:[]},originalHash=hash(bytes).slice(0,20),stem=relative.slice(0,-ext.length);
     for(const format of ['webp','avif'])for(const width of widths){
      const pipeline=sharp(bytes).rotate().resize({width,withoutEnlargement:true});
      const output=await (format==='webp'?pipeline.webp({quality:84,effort:6}):pipeline.avif({quality:54,effort:5})).toBuffer({resolveWithObject:true});
      const stagedRelative=normalizeKey(`${originalHash}/${stem}.${output.info.width}.${format}`),target=path.join(stagingRoot,stagedRelative);
      await mkdir(path.dirname(target),{recursive:true});await writeFile(target,output.data);
      variants[format].push(assetRecord({relative:`${stem}.${output.info.width}.${format}`,source:stagedRelative,bytes:output.data,contentType:TYPES['.'+format],prefix:safePrefix,width:output.info.width,height:output.info.height}));
     }
     assets['/'+relative]={...variants.webp.at(-1),originalSource:relative,originalBytes:bytes.length,variants};
     continue;
    }
   }
   if(optimize){const target=path.join(stagingRoot,relative);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
   assets['/'+relative]=assetRecord({relative,source:relative,bytes,contentType,prefix:safePrefix});
  }
 }
 const info=await lstat(sourceRoot);
 if(info.isSymbolicLink()||!info.isDirectory())throw Error('--source must be a regular directory.');
 await walk(sourceRoot);
 if(!Object.keys(assets).length)throw Error('No supported static assets found.');
 return {version:1,mode:'dry-run',bucket:DOGO_BUCKET,prefix:safePrefix,publicBase:DOGO_CDN,optimized:optimize,assets};
}

// SigV4 is also used by DOGO's existing R2 server. Credentials remain in memory.
// Reference: AWS S3 single-chunk SigV4; Cloudflare R2 region is "auto".
export function signS3Request({url,method,body=Buffer.alloc(0),headers={},accessKeyId,secretAccessKey,region='auto',now=new Date()}){
 const target=new URL(url),timestamp=now.toISOString().replace(/[:-]|\.\d{3}/g,''),date=timestamp.slice(0,8);
 const signedHeaders=Object.fromEntries(Object.entries(headers).map(([name,value])=>[name.toLowerCase(),String(value).trim().replace(/\s+/g,' ')]));
 Object.assign(signedHeaders,{host:target.host,'x-amz-content-sha256':hash(body),'x-amz-date':timestamp});
 const names=Object.keys(signedHeaders).sort(),canonicalHeaders=names.map(name=>`${name}:${signedHeaders[name]}\n`).join('');
 const query=[...target.searchParams].map(([name,value])=>[encode(name),encode(value)]).sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0).map(pair=>pair.join('=')).join('&');
 const canonical=[method.toUpperCase(),target.pathname,query,canonicalHeaders,names.join(';'),signedHeaders['x-amz-content-sha256']].join('\n');
 const scope=`${date}/${region}/s3/aws4_request`,stringToSign=`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`;
 const key=hmac(hmac(hmac(hmac('AWS4'+secretAccessKey,date),region),'s3'),'aws4_request');
 signedHeaders.authorization=`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope},SignedHeaders=${names.join(';')},Signature=${createHmac('sha256',key).update(stringToSign).digest('hex')}`;
 return signedHeaders;
}

export function r2Configuration(env=process.env){
 const bucket=env.R2_PUBLIC_BUCKET||env.R2_BUCKET||DOGO_BUCKET;
 if(bucket!==DOGO_BUCKET)throw Error('The configured bucket is not the verified DOGO bucket.');
 const endpoint=env.R2_ENDPOINT||(env.R2_ACCOUNT_ID?`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`:'');
 let target;try{target=new URL(endpoint);}catch{throw Error('Existing DOGO R2_ENDPOINT or R2_ACCOUNT_ID is required for --apply.');}
 if(target.protocol!=='https:'||!/^([a-f0-9]{32})(?:\.eu|\.fedramp)?\.r2\.cloudflarestorage\.com$/i.test(target.hostname)||target.pathname!=='/'||target.search||target.hash||target.username||target.password)throw Error('The R2 endpoint must be the existing Cloudflare account S3 origin.');
 if(!env.R2_ACCESS_KEY_ID||!env.R2_SECRET_ACCESS_KEY)throw Error('Existing DOGO R2 credentials are required for --apply. No token will be created.');
 return {endpoint:target.origin,bucket,accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY};
}

function verifyObject(response,item){
 if(Number(response.headers.get('content-length'))!==item.bytes||response.headers.get('content-type')?.split(';')[0]!==item.contentType.split(';')[0]||response.headers.get('x-amz-meta-sha256')!==item.sha256||!response.headers.get('etag'))throw Error('Remote asset verification failed; the existing object will not be overwritten.');
 return response.headers.get('etag');
}
const assetRecords=plan=>Object.values(plan.assets).flatMap(item=>[item,...Object.values(item.variants||{}).flat()]);

export async function stageAssetPlan(plan,{source=path.join(ROOT,'public'),directory}={}){
 if(!directory)throw Error('An explicit staging directory is required.');
 const destination=path.resolve(directory),root=path.resolve(source),staged=structuredClone(plan);
 if(destination===root||destination.startsWith(root+path.sep))throw Error('UI staging must be outside the source directory.');
 const records=assetRecords(staged);
 for(const item of records){
  if(!item.key.startsWith('lavanda/'))throw Error('Asset key escapes lavanda/.');
  const flat=item.key.slice('lavanda/'.length).split('/').join('--');
  item.key='lavanda/'+normalizeKey(flat);item.path='/r2/'+encodeKey(item.key);item.url=DOGO_CDN+'/'+encodeKey(item.key);
 }
 const unique=[...new Map(records.map(item=>[item.key,item])).values()],names=new Set(unique.map(item=>item.key.slice('lavanda/'.length)));
 await mkdir(destination,{recursive:true});
 const directoryInfo=await lstat(destination);if(directoryInfo.isSymbolicLink())throw Error('UI staging cannot be a symlink.');
 const existing=await readdir(destination);
 if(existing.some(name=>!names.has(name)))throw Error('UI staging contains older or unrelated files. Choose a new empty directory.');
 const files=[];
 for(const item of unique){
  normalizeKey(item.source);const filename=path.resolve(root,item.source),relative=path.relative(root,filename);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Asset source escapes the source directory.');
  const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink())throw Error('Asset source must be a regular file.');
  const body=await readFile(filename);if(body.length!==item.bytes||hash(body)!==item.sha256)throw Error('An asset changed after planning.');
  const target=path.join(destination,item.key.slice('lavanda/'.length));
  try{const found=await lstat(target);if(found.isSymbolicLink()||!found.isFile()||hash(await readFile(target))!==item.sha256)throw Error('UI staging contains a conflicting file.');}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,body,{flag:'wx'});}
  files.push(target);
 }
 for(const item of records)item.source=item.key.slice('lavanda/'.length);
 staged.prefix='lavanda';return {plan:staged,source:destination,files};
}

export async function verifyPublicPlan(plan,{fetchImpl=fetch}={}){
 if(plan.bucket!==DOGO_BUCKET)throw Error('Unexpected asset bucket.');
 const result=structuredClone(plan),records=assetRecords(result),unique=[...new Map(records.map(item=>[item.key,item])).values()];
 for(const item of unique){
  normalizeKey(item.key);if(!item.key.startsWith('lavanda/')||item.url!==DOGO_CDN+'/'+encodeKey(item.key))throw Error('Unexpected public asset URL.');
  let response;try{response=await fetchImpl(item.url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Public R2 verification request failed.');}
  if(!response.ok)throw Error(`Public R2 asset is unavailable (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw Error('Public R2 asset checksum does not match the inventory.');
  if(response.headers.get('content-type')?.split(';')[0]!==item.contentType.split(';')[0])throw Error('Public R2 asset MIME does not match the inventory.');
  item.status='verified';item.etag=response.headers.get('etag')||null;item.remoteCacheControl=response.headers.get('cache-control')||null;
 }
 const verified=new Map(unique.map(item=>[item.key,item]));
 for(const item of records){const remote=verified.get(item.key);item.status=remote.status;item.etag=remote.etag;item.remoteCacheControl=remote.remoteCacheControl;}
 result.mode='verified';return result;
}

export async function uploadAssetPlan(plan,{source=path.join(ROOT,'public'),env=process.env,fetchImpl=fetch}={}){
 const config=r2Configuration(env);
 if(plan.bucket!==DOGO_BUCKET)throw Error('Unexpected asset bucket.');
 const result=structuredClone(plan);result.mode='verified';
 async function request(method,item,body){
  const url=config.endpoint+'/'+encode(config.bucket)+'/'+encodeKey(item.key);
  const headers=method==='PUT'?{'content-type':item.contentType,'cache-control':ASSET_CACHE,'x-amz-meta-sha256':item.sha256,'if-none-match':'*'}:{};
  const signed=signS3Request({url,method,body,headers,...config});
  let response;try{response=await fetchImpl(url,{method,headers:signed,...(method==='PUT'?{body}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('R2 request failed. Credentials and signed requests are not logged.');}
  return response;
 }
 const records=assetRecords(result);
 const unique=[...new Map(records.map(item=>[item.key,item])).values()];
 for(const item of unique){
  normalizeKey(item.source);normalizeKey(item.key);
  if(!item.key.startsWith(lavandaPrefix(plan.prefix)+'/'))throw Error('Asset key escapes the Lavanda prefix.');
  const filename=path.resolve(source,item.source),relative=path.relative(path.resolve(source),filename);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Asset source escapes the source directory.');
  const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink())throw Error('Asset source must remain a regular file.');
  const body=await readFile(filename);
  if(body.length!==item.bytes||hash(body)!==item.sha256)throw Error('An asset changed after planning. Generate the inventory again.');
  let response=await request('HEAD',item);
  if(response.ok){item.etag=verifyObject(response,item);item.status='existing';continue;}
  if(response.status!==404)throw Error(`R2 HEAD failed (${response.status}). No object was replaced.`);
  response=await request('PUT',item,body);
  if(!response.ok&&response.status!==412)throw Error(`R2 upload failed (${response.status}). No object was replaced.`);
  const verified=await request('HEAD',item);
  if(!verified.ok)throw Error('R2 post-upload verification failed.');
  item.etag=verifyObject(verified,item);item.status=response.status===412?'existing':'uploaded';
 }
 const verified=new Map(unique.map(item=>[item.key,item]));
 for(const item of records){const remote=verified.get(item.key);item.status=remote.status;item.etag=remote.etag;}
 return result;
}

export async function main(argv=process.argv.slice(2),{env=process.env,fetchImpl=fetch,output=console.log}={}){
 const {values}=parseArgs({args:argv,strict:true,allowPositionals:false,options:{source:{type:'string'},prefix:{type:'string',default:'lavanda'},manifest:{type:'string'},staging:{type:'string'},'stage-directory':{type:'string'},'verify-manifest':{type:'string'},optimize:{type:'boolean',default:false},apply:{type:'boolean',default:false},'dry-run':{type:'boolean',default:false},help:{type:'boolean',default:false}}});
 if(values.help){output('Usage: node scripts/upload-r2-assets.mjs [--source public] [--prefix lavanda] [--optimize] [--staging .cache/r2-assets] [--stage-directory path] [--manifest path] [--apply]\n       node scripts/upload-r2-assets.mjs --verify-manifest path --manifest path\nDefault: dry-run, no network and no credentials needed. --optimize creates WebP/AVIF widths 640/960/1536 without enlarging or editing originals. --stage-directory writes flat, hashed files for upload into the existing R2 lavanda folder. --verify-manifest checks public bytes and MIME after browser upload. --apply uses existing DOGO R2 environment credentials; no token creation or overwrite.');return 0;}
 if(values.apply&&values['dry-run'])throw Error('Choose --apply or --dry-run.');
 const source=path.resolve(values.source||path.join(ROOT,'public'));
 const staging=path.resolve(values.staging||DEFAULT_STAGING);
 let plan,uploadSource=values.optimize?staging:source,files;
 if(values['verify-manifest']){
  if(values.apply||values.optimize||values['stage-directory'])throw Error('--verify-manifest cannot be combined with staging or upload.');
  plan=await verifyPublicPlan(JSON.parse(await readFile(path.resolve(values['verify-manifest']),'utf8')),{fetchImpl});
 }else{
  plan=await buildAssetPlan({source,prefix:values.prefix,optimize:values.optimize,staging,sharp:values.optimize?imageRuntime(env):null});
  if(values['stage-directory']){const staged=await stageAssetPlan(plan,{source:uploadSource,directory:values['stage-directory']});plan=staged.plan;uploadSource=staged.source;files=staged.files;}
  if(values.apply)plan=await uploadAssetPlan(plan,{source:uploadSource,env,fetchImpl});
 }
 if(values.manifest){const file=path.resolve(values.manifest);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(plan,null,2)+'\n');}
 output(JSON.stringify({...plan,...(files?{uploadFiles:files}:{})},null,2));return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
