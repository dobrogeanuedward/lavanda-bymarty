import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {makePaths,SEPHIROT_COUNT,PATH_COUNT} from '../src/geometry.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const problems=[];
async function walk(dir){let result=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const files=await walk(dist);
const htmls=files.filter(f=>f.endsWith('.html'));
let refs=0;
for(const file of htmls){
 const html=await readFile(file,'utf8');
 if(!/<html[^>]*lang="it"/.test(html))problems.push(`${path.relative(dist,file)}: lingua mancante`);
 if(!/<title>[^<]+<\/title>/.test(html))problems.push(`${file}: titolo mancante`);
 for(const match of html.matchAll(/\b(?:href|src)="([^"#]+)"/g)){
  const reference=match[1].replaceAll('&amp;','&');
  if(/^(?:https?:|mailto:|data:)/.test(reference))continue;
  const url=new URL(reference,'http://local/'+path.relative(dist,file));
  if(url.pathname.startsWith('/api/'))continue;
  let target=path.join(dist,decodeURIComponent(url.pathname));
  try{if((await stat(target)).isDirectory())target=path.join(target,'index.html');await stat(target);refs++;}catch{problems.push(`${path.relative(dist,file)}: riferimento mancante ${url.pathname}`);}
 }
 for(const image of html.matchAll(/<img\b[^>]*>/g))if(!/\balt=/.test(image[0]))problems.push(`${file}: alt immagine assente`);
}
const original=await readFile(path.join(root,'content/manifesto-original.md'));
assert.equal(createHash('sha256').update(original).digest('hex'),'ff4f1e6bec5285293cfa65f4edb0901e0ca4227141858e8734cdd6f8071a9172','Il manifesto originale è stato modificato');
const paths=makePaths();assert.equal(SEPHIROT_COUNT,10);assert.equal(paths.length,PATH_COUNT);assert.equal(new Set(paths.map(p=>p.join(':'))).size,22);assert.deepEqual(makePaths(),paths);assert(paths.every(([a,b])=>a>=0&&b<10&&a<b));
const articleData=JSON.parse(await readFile(path.join(root,'content/articles.json'),'utf8'));
assert.equal(new Set(articleData.map(a=>a.slug)).size,articleData.length);
for(const a of articleData){assert(a.title&&a.body.length&&a.status);assert(a.body.every(b=>b.heading&&b.text));}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log(`${htmls.length} HTML, ${refs} riferimenti locali, manifesto originale e geometria verificati.`);
