import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[process.env.LAVANDA_NODE_MODULES||'/Users/martinapontolillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
const root=fileURLToPath(new URL('../',import.meta.url));
const uri=async(p,type)=>`data:${type};base64,${(await readFile(root+p)).toString('base64')}`;
const [word,emblem,frame,photo]=await Promise.all([uri('public/brand/wordmark.svg','image/svg+xml'),uri('public/brand/emblem.svg','image/svg+xml'),uri('public/brand/sign-frame.svg','image/svg+xml'),uri('docs/image-originals/bottega-manifesto.png','image/png')]);
const colors=['#FF1685','#FFD600','#B58CFF','#382096','#131116','#FFFFFF'];
const names=['Magenta','Giallo','Lilla','Viola','Nero','Bianco'];
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1480" viewBox="0 0 1800 1480">
<rect width="1800" height="1480" fill="#fff"/><g font-family="Arial,sans-serif" fill="#131116">
<text x="80" y="65" font-size="23">LAVANDA / Identità visiva</text><text x="1720" y="65" font-size="23" text-anchor="end">02 — Dallo sketch al sistema</text><path d="M80 90H1720" stroke="#131116"/>
<image href="${word}" x="80" y="150" width="1640" height="280"/>
<text x="80" y="470" font-size="20">01 / IL LOGOTIPO</text><text x="1720" y="470" font-size="20" text-anchor="end">TrashHand. Tratto manoscritto, ritmo, spazio.</text>
<rect x="80" y="520" width="460" height="450" fill="#B58CFF"/><image href="${emblem}" x="206" y="595" width="208" height="230"/><text x="115" y="930" font-size="20">02 / IL SIMBOLO</text>
<rect x="565" y="520" width="460" height="450" fill="#FFD600"/><image href="${frame}" x="595" y="555" width="400" height="300"/>
<text x="795" y="715" font-size="22" text-anchor="middle" letter-spacing="3">LA BOTTEGA</text><text x="795" y="758" font-family="Georgia,serif" font-size="35" text-anchor="middle">della speziale</text>
<text x="600" y="900" font-size="20">03 / BOTANICA — L’INSEGNA</text><text x="600" y="930" font-size="18">Strega di quartiere. Un elemento autonomo.</text>
<image href="${photo}" x="1050" y="520" width="670" height="450" preserveAspectRatio="xMidYMid slice"/>
<text x="80" y="1050" font-size="20">04 / IL MONDO VISIVO</text><text x="80" y="1120" font-family="Georgia,serif" font-size="48">Tarocchi, botanica, storie.</text><text x="80" y="1164" font-size="22">Materia vera, colore netto, luce e ombra.</text>
<text x="1050" y="1050" font-size="20">VOCE / MARTINA</text><text x="1050" y="1120" font-family="Georgia,serif" font-size="36">Buona lettura</text><text x="1050" y="1164" font-family="Georgia,serif" font-size="36">e buon ritorno al centro.</text>
${colors.map((c,i)=>`<rect x="${80+i*273.333}" y="1220" width="273.333" height="130" fill="${c}" stroke="${i===5?'#ccc':'none'}"/><text x="${100+i*273.333}" y="1260" font-size="19" fill="${i===3||i===4?'white':'#131116'}">${names[i]}</text><text x="${100+i*273.333}" y="1322" font-size="17" fill="${i===3||i===4?'white':'#131116'}">${c.toUpperCase()}</text>`).join('')}
<path d="M80 1400H1720" stroke="#131116"/><text x="80" y="1440" font-size="19">LAVANDA / THE RIOT WITCH</text><text x="1720" y="1440" font-size="19" text-anchor="end">Un progetto di Martina</text></g></svg>`;
await mkdir(root+'output',{recursive:true});
await sharp(Buffer.from(board)).png().toFile(root+'output/identity-board.png');
await sharp(Buffer.from(board)).webp({quality:88}).toFile(root+'public/brand/identity-board.webp');
await writeFile(root+'output/identity-board.svg',board);
console.log('Refined identity board rendered.');
