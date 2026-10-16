import test from 'node:test';
import assert from 'node:assert/strict';
import {SolarClock,parseUTCDateTime,SOLAR_MIN_DATE,SOLAR_MAX_DATE} from '../src/solar-clock.js';
const fixture=()=>{let wall=Date.UTC(2026,9,16),tick=0;const clock=new SolarClock({wallNow:()=>wall,monotonicNow:()=>tick});return {clock,advance(ms){wall+=ms;tick+=ms;},jumpWall(ms){wall+=ms;}};};
test('live time follows UTC device time and recovers a wall-clock correction',()=>{
 const f=fixture();f.advance(5000);assert.equal(f.clock.snapshot().date.toISOString(),'2026-10-16T00:00:05.000Z');
 f.jumpWall(10000);assert.equal(f.clock.snapshot().date.toISOString(),'2026-10-16T00:00:15.000Z');assert.equal(f.clock.snapshot().live,true);
});
test('rate changes preserve the instant and advance according to the declared multiplier',()=>{
 const f=fixture();const start=f.clock.snapshot().date.getTime();f.clock.setRate(86400);f.advance(1000);
 assert.equal(f.clock.snapshot().date.getTime(),start+86400000);assert.equal(f.clock.snapshot().live,false);
 f.clock.setRate(60);f.advance(1000);assert.equal(f.clock.snapshot().date.getTime(),start+86400000+60000);
});
test('pause freezes the date, resume continues it, now resynchronizes without retaining acceleration',()=>{
 const f=fixture();f.clock.setRate(3600);f.advance(1000);f.clock.setPaused(true);const paused=f.clock.snapshot().date.getTime();f.advance(10000);
 assert.equal(f.clock.snapshot().date.getTime(),paused);f.clock.setPaused(false);f.advance(1000);assert.equal(f.clock.snapshot().date.getTime(),paused+3600000);
 const reset=f.clock.resetNow();assert.equal(reset.date.toISOString(),'2026-10-16T00:00:12.000Z');assert.equal(reset.rate,1);assert.equal(reset.paused,false);assert.equal(reset.live,true);
});
test('seeking UTC dates never applies the host timezone and validates Gregorian values',()=>{
 assert.equal(parseUTCDateTime('2024-03-31T02:30').toISOString(),'2024-03-31T02:30:00.000Z');
 for(const value of ['2024-02-30T12:00','2024-01-01T24:00','1899-12-31T23:59','2101-01-01T00:00','2024-03-31',''])assert.throws(()=>parseUTCDateTime(value));
 const f=fixture();f.clock.seek(parseUTCDateTime('1900-01-01T00:00'));assert.equal(f.clock.snapshot().date.getTime(),SOLAR_MIN_DATE);assert.equal(f.clock.snapshot().live,false);
});
test('the exploration stops at the supported boundary instead of wrapping time',()=>{
 const f=fixture();f.clock.seek(new Date(SOLAR_MAX_DATE-1000));f.clock.setRate(2592000);f.advance(1000);
 const state=f.clock.snapshot();assert.equal(state.date.getTime(),SOLAR_MAX_DATE);assert.equal(state.paused,true);assert.equal(state.limit,'max');
 assert.throws(()=>f.clock.seek(new Date('invalid')));assert.throws(()=>f.clock.setRate(-1));
});
