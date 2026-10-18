import test from 'node:test';
import assert from 'node:assert/strict';
import {planBulk,runBulk} from '../src/domain/bulk.mjs';
import {createBatch,stealHarvest} from '../src/domain/harvest.mjs';
import {createRanchState} from '../src/domain/ranch.mjs';
import {createAtelier} from '../src/domain/atelier.mjs';
const now=100000;
const fresh=(coins=200)=>({coins,level:8,plots:Array.from({length:6},(_,id)=>({id,crop:null,batch:null})),ranch:createRanchState(),atelier:createAtelier(now),face:{preserve:true}});
function plot(crop='corn',maturesAt=now+50000,extra={}){return {crop,batch:{...createBatch({batchId:'test',ownerId:'local-owner',productId:crop,kind:'crop',initialYield:crop==='corn'?30:40,maturesAt}),...extra}};}
test('bulk plant plans an affordable empty-slot prefix without replacing occupied crops',()=>{
 const s=fresh(19);s.plots[1]=plot();const before=JSON.stringify(s);const plan=planBulk(s,{action:'plant',crop:'corn',now});
 assert.deepEqual(plan.indices,[0,2]);assert.equal(plan.cost,16);assert.equal(plan.eligible,5);assert.equal(plan.skipped,4);
 const r=runBulk(s,{action:'plant',now});assert.equal(r.state.coins,3);assert.equal(r.state.plots[1].batch,s.plots[1].batch);assert.equal(r.state.plots[0].batch.maturesAt,now+60000);assert.equal(r.state.plots[0].batch.weatherSlot,undefined);assert.equal(JSON.stringify(s),before);assert.equal(r.state.face,s.face);
 r.state.plots[0].crop='corn';assert.equal(Object.isFrozen(r.state),false);
 s.level=2;assert.equal(planBulk(s,{action:'plant',crop:'watermelon',now}).count,0);
});
test('bulk care skips mature/cared crops and fertilizer stops at next unaffordable crop',()=>{
 const s=fresh(4);s.plots=[plot('corn'),plot('watermelon'),plot('corn'),plot('corn',now),plot('corn',now+10000,{care:{water:true,fertilize:true}}),{crop:null,batch:null}];
 const r=runBulk(s,{action:'fertilize',now,random:()=>.5});assert.deepEqual(r.indices,[0]);assert.equal(r.state.coins,2);assert.equal(r.state.plots[0].batch.maturesAt,now+32000);assert.equal(r.state.plots[2].batch.care,undefined);
 const watered=runBulk(s,{action:'water',now,random:()=>0});assert.equal(watered.count,3);assert.equal(watered.cost,0);assert.equal(watered.state.plots[0].batch.mutation,'dewdrop');
 assert.equal(runBulk(watered.state,{action:'water',now,random:()=>{throw Error('unexpected');}}).count,0);
});
test('bulk harvest credits remaining yield and mutation premium once plus materials per batch',()=>{
 const s=fresh();s.plots[0]=plot('corn',now,{mutation:'frost'});s.plots[0].batch=stealHarvest(s.plots[0].batch,{visitorId:'friend',requestedAmount:15,now}).batch;s.plots[1]=plot('watermelon',now);s.plots[2]=plot('corn');
 const r=runBulk(s,{action:'harvest',now});assert.equal(r.count,2);assert.equal(r.income,70);assert.equal(r.state.coins,270);assert.equal(r.state.atelier.materials.goldDye,2);assert.equal(r.state.atelier.materials.roseDye,2);assert.equal(r.state.plots[2].batch,s.plots[2].batch);
 assert.equal(runBulk(r.state,{action:'harvest',now}).income,0);assert.equal(s.atelier.materials.goldDye,0);
});
test('bulk buy respects funds/capacity and makes independent sex draws for newborn lambs',()=>{
 const s=fresh();let calls=0;const r=runBulk(s,{action:'buySheep',now,random:()=>++calls===1?.01:.5});assert.equal(r.count,3);assert.equal(r.cost,180);assert.equal(r.state.coins,20);assert.deepEqual(r.state.ranch.animals.map(a=>a.sex),['male','female','female']);assert.ok(r.state.ranch.animals.every(a=>a.growthMs===0));assert.equal(s.ranch.animals.length,0);
 const capped=runBulk({...r.state,coins:1000},{action:'buySheep',now,random:()=>.5});assert.equal(capped.count,3);assert.equal(capped.state.ranch.animals.length,6);assert.equal(planBulk(capped.state,{action:'buySheep',now}).count,0);
});
test('invalid random after an earlier successful action rolls back the complete batch',()=>{
 for(const action of ['buySheep','water']){const s=fresh();if(action==='water'){s.plots[0]=plot();s.plots[1]=plot();}const before=JSON.stringify(s);let calls=0;assert.throws(()=>runBulk(s,{action,now,random:()=>++calls===1?.5:NaN}),/INVALID_RANDOM/);assert.equal(JSON.stringify(s),before);}
});
test('bulk planning rejects invalid state/time and overflow without mutating rewards',()=>{
 const s=fresh(Number.MAX_SAFE_INTEGER);s.plots[0]=plot('corn',now);const before=JSON.stringify(s);assert.throws(()=>runBulk(s,{action:'harvest',now}),/NUMERIC_OVERFLOW/);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>planBulk(fresh(),{action:'plant',now:Number.MAX_SAFE_INTEGER}),/NUMERIC_OVERFLOW/);
 assert.throws(()=>planBulk({...fresh(),coins:-1},{action:'water',now}),/INVALID_COINS/);
 assert.throws(()=>planBulk(fresh(),{action:'water',now:-1}),/INVALID_TIME/);
});
test('harvest excludes foreign batches and rolls back on material overflow after earlier credit',()=>{
 const s=fresh();s.plots[0]=plot('watermelon',now);s.plots[1]=plot('corn',now);s.plots[2]=plot('corn',now,{ownerId:'friend'});
 assert.deepEqual(planBulk(s,{action:'harvest',now}).indices,[0,1]);
 s.atelier={...s.atelier,materials:{...s.atelier.materials,goldDye:Number.MAX_SAFE_INTEGER}};const before=JSON.stringify(s);
 assert.throws(()=>runBulk(s,{action:'harvest',now}),/NUMERIC_OVERFLOW/);assert.equal(JSON.stringify(s),before);
});
