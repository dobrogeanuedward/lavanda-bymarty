// Run explicitly to refresh the self-hosted GeoNames city index. Never runs at build time.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
const root = new URL('../',import.meta.url);
await mkdir(new URL('.cache/',root),{recursive:true});
await mkdir(new URL('data/',root),{recursive:true});
async function download(name){
 const file=new URL(`.cache/${name}`,root);
 try{return await readFile(file);}catch{}
 const response=await fetch(`https://download.geonames.org/export/dump/${name}`,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error(`GeoNames ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());await writeFile(file,bytes);return bytes;
}
await download('cities500.zip');
const adminText=(await download('admin1CodesASCII.txt')).toString('utf8');
const admins=new Map(adminText.trim().split('\n').map(line=>{const f=line.split('\t');return [f[0],f[1]];}));
const source=execFileSync('unzip',['-p',new URL('.cache/cities500.zip',root).pathname,'cities500.txt'],{maxBuffer:150*1024*1024,encoding:'utf8'});
const zones=new Map();
const rows=[];
for(const line of source.trim().split('\n')){
 const f=line.split('\t');const lat=Number(f[4]),lon=Number(f[5]),zone=f[17];
 if(!zone||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
 if(!zones.has(zone)){try{new Intl.DateTimeFormat('en',{timeZone:zone});zones.set(zone,true);}catch{zones.set(zone,false);}}
 if(!zones.get(zone))continue;
 const aliases=[...new Set([f[2],...f[3].split(',')].filter(s=>s&&s.length<=90))].slice(0,80);
 rows.push([Number(f[0]),f[1],aliases,lat,lon,f[8],admins.get(`${f[8]}.${f[10]}`)||'',zone,Number(f[14])||0]);
}
const data={source:'GeoNames cities500',license:'CC BY 4.0',retrieved:new Date().toISOString().slice(0,10),rows};
const gz=gzipSync(JSON.stringify(data),{level:9});
await writeFile(new URL('data/places.json.gz',root),gz);
console.log(`${rows.length} località, ${(gz.length/1024/1024).toFixed(2)} MiB compressi.`);
