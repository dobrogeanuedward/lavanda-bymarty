export const SOLAR_MIN_DATE=Date.UTC(1900,0,1);
export const SOLAR_MAX_DATE=Date.UTC(2101,0,1)-1;
const RATES=new Set([1,60,3600,86400,2592000]);
export function parseUTCDateTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Inserisci data e ora UTC complete.');
 const date=new Date(value+':00.000Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,16)!==value)throw Error('La data o l’ora non è valida.');
 if(date.getTime()<SOLAR_MIN_DATE||date.getTime()>SOLAR_MAX_DATE)throw Error('Scegli una data fra il 1900 e il 2100.');
 return date;
}

/** UTC live time uses the device clock; exploration advances at an explicit multiplier. */
export class SolarClock{
 constructor({wallNow=()=>Date.now(),monotonicNow=()=>performance.now()}={}){
  this.wallNow=wallNow;this.monotonicNow=monotonicNow;this.rate=1;this.paused=false;this.live=true;this.limit=null;
  this.anchorDate=wallNow();this.anchorTick=monotonicNow();
 }
 snapshot(){
  let milliseconds=this.live&&!this.paused?this.wallNow():this.anchorDate+(this.paused?0:(this.monotonicNow()-this.anchorTick)*this.rate);
  if(!Number.isFinite(milliseconds))throw Error('L’orologio del dispositivo non è disponibile.');
  if(milliseconds<SOLAR_MIN_DATE||milliseconds>SOLAR_MAX_DATE){
   this.limit=milliseconds<SOLAR_MIN_DATE?'min':'max';milliseconds=Math.max(SOLAR_MIN_DATE,Math.min(SOLAR_MAX_DATE,milliseconds));
   this.anchorDate=milliseconds;this.anchorTick=this.monotonicNow();this.paused=true;this.live=false;
  }
  return {date:new Date(milliseconds),rate:this.rate,paused:this.paused,live:this.live,limit:this.limit};
 }
 anchor(){this.anchorDate=this.snapshot().date.getTime();this.anchorTick=this.monotonicNow();}
 setRate(rate){
  if(!RATES.has(rate))throw Error('Scegli una velocità prevista dai controlli.');
  this.anchor();this.rate=rate;if(rate!==1)this.live=false;this.limit=null;return this.snapshot();
 }
 setPaused(paused){this.anchor();this.paused=Boolean(paused);this.live=false;this.limit=null;return this.snapshot();}
 seek(date){
  const milliseconds=date instanceof Date?date.getTime():Number(date);
  if(!Number.isFinite(milliseconds)||milliseconds<SOLAR_MIN_DATE||milliseconds>SOLAR_MAX_DATE)throw Error('Scegli una data valida fra il 1900 e il 2100.');
  this.anchorDate=milliseconds;this.anchorTick=this.monotonicNow();this.live=false;this.limit=null;return this.snapshot();
 }
 resetNow(){this.anchorDate=this.wallNow();this.anchorTick=this.monotonicNow();this.rate=1;this.paused=false;this.live=true;this.limit=null;return this.snapshot();}
}
