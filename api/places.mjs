import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export const normalizePlace=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const countryNames=new Intl.DisplayNames(['it'],{type:'region'});
const englishCountries=new Intl.DisplayNames(['en'],{type:'region'});
const italianCities={Rome:'Roma',Milan:'Milano',Turin:'Torino',Naples:'Napoli',Florence:'Firenze',Venice:'Venezia',Genoa:'Genova',Padua:'Padova',Leghorn:'Livorno',Mantua:'Mantova'};
const italianRegions={Lombardy:'Lombardia',Piedmont:'Piemonte',Tuscany:'Toscana',Sicily:'Sicilia',Sardinia:'Sardegna',Apulia:'Puglia',Liguria:'Liguria',Calabria:'Calabria',Campania:'Campania',Basilicata:'Basilicata',Marche:'Marche',Molise:'Molise',Umbria:'Umbria',Abruzzo:'Abruzzo','Aosta Valley':'Valle d’Aosta','Trentino-Alto Adige':'Trentino-Alto Adige','Emilia-Romagna':'Emilia-Romagna'};
let indexPromise;
export async function loadPlaces(){
 if(!indexPromise)indexPromise=readFile(new URL('../data/places.json.gz',import.meta.url)).then(bytes=>{
  const {rows}=JSON.parse(gunzipSync(bytes));
  return rows.map(([id,name,aliases,latitude,longitude,countryCode,admin,timezone,population])=>{
   const country=countryNames.of(countryCode)||countryCode;const displayName=countryCode==='IT'?(italianCities[name]||name):name;const displayAdmin=countryCode==='IT'?(italianRegions[admin]||admin):admin;
   return {id,name:displayName,label:[displayName,displayAdmin,country].filter(Boolean).join(', '),latitude,longitude,timezone,country,countryCode,population,
    search:[...new Set([name,...aliases].map(normalizePlace))],regions:[countryCode,country,englishCountries.of(countryCode)||'',admin,displayAdmin].map(normalizePlace)};
  });
 }).catch(error=>{indexPromise=undefined;throw error;});
 return indexPromise;
}
export function findPlaces(index,query){
 const [city,region]=String(query).split(',').map(normalizePlace);
 if(!city)return [];
 return index.flatMap(place=>{
  if(region&&!place.regions.some(r=>r===region||r.startsWith(region)))return [];
  const exact=place.search.includes(city);
  if(!exact&&!place.search.some(s=>s.startsWith(city)))return [];
  return [{place,score:(exact?1e12:0)+place.population}];
 }).sort((a,b)=>b.score-a.score||a.place.id-b.place.id).slice(0,8).map(({place:{search,regions,population,...place}})=>place);
}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;res.end(JSON.stringify({error:'Usa una richiesta GET.'}));return;}
 const query=req.query?.q??new URL(req.url,'http://local').searchParams.get('q');
 if(typeof query!=='string'||normalizePlace(query.split(',')[0]).length<2||query.length>80||/[\x00-\x1f]/.test(query)){
  res.statusCode=400;res.end(JSON.stringify({error:'Scrivi un luogo usando da 2 a 80 caratteri.'}));return;
 }
 try{
  const places=findPlaces(await loadPlaces(),query);
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  res.statusCode=200;res.end(JSON.stringify({places,source:'GeoNames',license:'CC BY 4.0'}));
 }catch{
  res.setHeader('Cache-Control','no-store');res.statusCode=503;res.end(JSON.stringify({error:'La ricerca dei luoghi è momentaneamente in pausa. Puoi inserire le coordinate manualmente.'}));
 }
}
