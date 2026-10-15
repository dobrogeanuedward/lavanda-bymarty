import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const api=fileURLToPath(new URL('../api/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.json':'application/json','.md':'text/markdown; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){try{const name=url.pathname.slice(5);if(!/^[a-z-]+$/.test(name))throw Error('bad route');req.query=Object.fromEntries(url.searchParams);let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>13*1024*1024){res.writeHead(413);res.end();return;}}if(body){try{req.body=JSON.parse(body);}catch{req.body=body;}}res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};res.send=data=>res.end(data);const handler=(await import(path.join(api,name+'.mjs'))).default;await handler(req,res);}catch(err){if(!res.headersSent)res.writeHead(404);res.end('API non disponibile');}return;}
 try{let target=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!target.startsWith(root))throw Error();const s=await stat(target);if(s.isDirectory())target=path.join(target,'index.html');const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(path.join(root,'404.html')));}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Lavanda in ascolto su http://127.0.0.1:'+server.address().port));
