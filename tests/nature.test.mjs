import test from 'node:test';
import assert from 'node:assert/strict';
import {MUTATIONS,mutationName,mutationValue,validateMutation,rollMutation,weatherType,createNature,advanceNature,WEATHER_SLOT_MS as SLOT} from '../src/domain/nature.mjs';
const HOUR=3600000;
const fixture=(seed=10,slot=0)=>({nature:{version:1,seed,slot,type:weatherType(seed,slot)},plots:[{id:'p0',batch:{id:'crop0',startedAt:0,maturesAt:100*SLOT,weatherSlot:0}}],ranch:{growthAt:0,animals:[{id:'a0',growthMs:0,weatherSlot:0}],batch:null}});
function winningSeed(){for(let seed=0;seed<100000;seed++){const next=advanceNature(fixture(seed),SLOT);if(next.plots[0].batch.mutation)return seed;}throw Error('No seed found');}
const seed=winningSeed();
test('care and weather probability boundaries, variants do not stack or reroll',()=>{
 for(const [source,prob,key] of [['water',.01,'dewdrop'],['feed',.01,'lush'],['fertilize',.01,'lush'],['rain',.005,'dewdrop'],['snow',.005,'frost'],['storm',.003,'storm']]){
  const entity=Object.freeze({id:'a'});
  assert.equal(rollMutation(entity,{source,random:()=>prob}),entity);
  const win=rollMutation(entity,{source,random:()=>prob-1e-9});assert.equal(win.mutation,key);assert.equal(entity.mutation,undefined);
  assert.equal(rollMutation(win,{source,random:()=>{throw Error('Already mutated');}}),win);
 }
});
test('mutation values round down; invalid metadata cannot create extra sale income',()=>{
 assert.equal(mutationValue(3,'dewdrop'),4);assert.equal(mutationValue(90,'storm'),225);assert.equal(mutationValue(90,'frost'),180);assert.equal(mutationValue(90,null),90);
 assert.equal(mutationName('lush'),'丰盈');assert.equal(mutationName(undefined),'普通');
 assert.equal(validateMutation(null),true);assert.equal(validateMutation(undefined),true);assert.ok(Object.isFrozen(MUTATIONS.storm));
 for(const invalid of ['__proto__','unknown',{},3,false])assert.throws(()=>mutationValue(90,invalid),/INVALID_MUTATION/);
 assert.throws(()=>mutationValue(-1,'lush'),/INVALID_VALUE/);assert.throws(()=>mutationValue(Number.MAX_SAFE_INTEGER,'storm'),/NUMERIC_OVERFLOW/);
 for(const random of [()=>1,()=>-1,()=>NaN,null])assert.throws(()=>rollMutation({},{source:'water',random}),/INVALID_RANDOM/);
});
test('weather seed persists, types have approximate designed weights, invalid input rejected',()=>{
 const created=createNature(SLOT+1,()=>.5);assert.equal(created.seed,2147483648);assert.equal(created.slot,1);assert.equal(created.type,weatherType(created.seed,1));
 const counts={clear:0,rain:0,snow:0,storm:0};for(let slot=0;slot<10000;slot++)counts[weatherType(42,slot)]++;
 for(const [type,expected] of Object.entries({clear:5500,rain:2500,snow:1500,storm:500}))assert.ok(Math.abs(counts[type]-expected)<200,`${type}: ${counts[type]}`);
 assert.throws(()=>createNature(-1),/INVALID_TIME/);assert.throws(()=>weatherType(2**32,1),/INVALID_SEED/);assert.throws(()=>weatherType(1,.5),/INVALID_SLOT/);
});
test('weather rolls once per boundary, survives reload and never rolls backwards',()=>{
 const original=fixture(seed),before=JSON.stringify(original);
 const current=advanceNature(original,0);assert.equal(current,original);assert.equal(current.plots[0].batch.mutation,undefined);
 const next=advanceNature(original,SLOT);assert.ok(next.plots[0].batch.mutation);assert.equal(JSON.stringify(original),before);
 assert.equal(advanceNature(next,SLOT+1),next);assert.equal(advanceNature(next,0),next);
 assert.deepEqual(advanceNature(JSON.parse(JSON.stringify(next)),SLOT+2),next);
 assert.deepEqual(advanceNature(JSON.parse(JSON.stringify(original)),SLOT),next);
});
test('mature, collected and future crops and mature animals cannot mutate',()=>{
 for(const props of [{maturesAt:SLOT},{collected:true},{startedAt:SLOT+1}]){
  const state=fixture(seed);Object.assign(state.plots[0].batch,props);
  state.ranch.animals[0].growthMs=8*HOUR;
  const next=advanceNature(state,SLOT);assert.equal(next.plots[0].batch.mutation,undefined);assert.equal(next.ranch.animals[0].mutation,undefined);
 }
 const priorVariant=fixture(seed);priorVariant.plots[0].batch.mutation='lush';assert.equal(advanceNature(priorVariant,10*SLOT).plots[0].batch.mutation,'lush');
});
test('untagged legacy entities initialize now without retrospective exposure',()=>{
 const state=fixture(seed);delete state.plots[0].batch.weatherSlot;delete state.ranch.animals[0].weatherSlot;
 const next=advanceNature(state,5*SLOT);assert.equal(next.plots[0].batch.weatherSlot,5);assert.equal(next.plots[0].batch.mutation,undefined);assert.equal(next.ranch.animals[0].mutation,undefined);
 const fresh=fixture();delete fresh.nature;const init=advanceNature(fresh,0);assert.equal(init.nature.slot,0);assert.equal(init.plots[0].batch.mutation,undefined);
});
test('offline catchup covers at most recent 48 slots and respects actual maturity boundary',()=>{
 const long=fixture(seed);long.plots[0].batch.maturesAt=1000*SLOT;
 const clipped=structuredClone(long);clipped.nature.slot=952;clipped.nature.type=weatherType(seed,952);
 assert.deepEqual(advanceNature(long,1000*SLOT),advanceNature(clipped,1000*SLOT));
 // A mature-after-offline animal only had its first eight hours of opportunities.
 const full=fixture(seed),manual=structuredClone(full);let stepped=manual;
 for(let slot=1;slot<=20;slot++)stepped=advanceNature(stepped,slot*SLOT);
 assert.deepEqual(advanceNature(full,20*SLOT),stepped);
});
test('malformed weather and entity markers fail instead of silently rerolling',()=>{
 for(const edit of [s=>s.nature.type='invalid',s=>s.nature.seed=-1,s=>s.plots[0].batch.weatherSlot=-1,s=>s.ranch.animals[0].mutation='fake',s=>s.ranch.animals[0].growthMs=-1]){
  const s=fixture();edit(s);assert.throws(()=>advanceNature(s,SLOT));
 }
});
