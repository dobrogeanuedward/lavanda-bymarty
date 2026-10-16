import {mkdir,writeFile,cp,access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'public/brand');
const archive=path.join(root,'docs/studies/sketch-translation');
try{await access(archive);}catch{await mkdir(archive,{recursive:true});await cp(out,archive,{recursive:true});}
await mkdir(out,{recursive:true});
// TrashHand by Luce Avérous, outlined for this name only.
const lettering=JSON.parse(await readFile(path.join(root,'scripts/trashhand-wordmark.json'),'utf8'));
function wordmark(color='#131116'){
 return {body:`<g fill="${color}"><path d="${lettering.path}"/></g>`,width:lettering.width};
}
function symbol(color='#131116',accent='#FF1685'){
 return `<g fill="none" stroke="${color}" stroke-linejoin="round"><path stroke-width="4.4" d="M108 31A58 58 0 1 0 111 104"/><path stroke-width="4.4" d="M46 27H76M50 28V56C50 68 32 79 32 98C32 123 94 123 94 98C94 79 72 68 72 56V28"/><path stroke-width="2.5" d="M40 98C55 91 73 108 86 98M52 18H70"/></g><circle cx="115" cy="87" r="4" fill="${accent||color}"/>`;
}
const svg=(w,h,body,title,desc)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d"><title id="t">${title}</title><desc id="d">${desc}</desc>${body}</svg>\n`;
async function save(name,w,h,body,title='Lavanda',desc=/^(?:logo|wordmark)/.test(name)?'Identità Lavanda. Nome in TrashHand di Luce Avérous, convertito in tracciati; simbolo e insegna indipendenti.':'Identità Lavanda. Logotipo originale, senza insegna o testi accessori.'){
 await writeFile(path.join(out,name),svg(w,h,body,title,desc));
}
for(const [suffix,color,accent]of [['','#131116','#FF1685'],['-inverse','#FFFFFF','#FF1685'],['-mono','#131116',null]]){
 const mark=wordmark(color);
 await save(`logo${suffix}.svg`,mark.width+170,150,`<g transform="translate(4 4) scale(.98)">${symbol(color,accent)}</g><g transform="translate(167 25)">${mark.body}</g>`);
 if(suffix!=='-mono')await save(`wordmark${suffix}.svg`,mark.width+4,116,`<g transform="translate(2 8)">${mark.body}</g>`);
 await save(`emblem${suffix}.svg`,132,140,`<g transform="translate(4 3)">${symbol(color,accent)}</g>`,'Lavanda simbolo','Flacone essenziale e orbita aperta. Il simbolo del marchio Lavanda.');
}
await save('emblem-periwinkle.svg',132,140,`<g transform="translate(4 3)">${symbol('#382096','#382096')}</g>`);
await save('favicon.svg',64,64,`<rect width="64" height="64" rx="16" fill="#B58CFF"/><g transform="translate(3 2) scale(.44)">${symbol('#131116','#131116')}</g>`);
await save('sign-frame.svg',360,270,'<g fill="none" stroke="#131116" stroke-width="2"><path d="M48 49H312M150 49 180 20 210 49M86 49V81M274 49V81"/><rect x="36" y="81" width="288" height="157" rx="2"/></g>','Insegna di Lavanda','Cornice indipendente per titoli, rubriche e nomi della bottega. Non è il logo.');
console.log('Lavanda: refined vector wordmark, emblem and separate sign frame generated.');
