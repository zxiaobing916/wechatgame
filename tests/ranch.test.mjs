import test from 'node:test';
import assert from 'node:assert/strict';
import { createRanchState, sellAnimal, canSellAnimal, animalBusy, setBreedingEnabled, RANCH_RULES, buyBreeder, rehomeBreeder, careRanch as applyRanchCare, advanceRanch, migrateRanchState,
  harvestOffspring, stealOffspring, sellOffspring, sellVisitorOffspring, validateRanchState } from '../src/domain/ranch.mjs';
const careRanch = (ranch,options) => applyRanchCare(ranch,{random:()=>.99,...options});
const error = code => e => e.code === code;
const buy = (ranch=createRanchState(), options={}) => buyBreeder(ranch,{speciesId:'sheep',level:1,coins:1000,now:0,random:()=>0,...options});
function supplied(sexes=[0,.5]) {
  let ranch = createRanchState();
  for (const sex of sexes) ranch = buy(ranch,{random:()=>sex}).ranch;
  ranch = {...ranch,animals:ranch.animals.map(a=>({...a,growthMs:RANCH_RULES.growthMs}))};
  ranch = careRanch(ranch,{action:'water',coins:100}).ranch;
  return careRanch(ranch,{action:'feed',coins:100}).ranch;
}
function pregnant() {
  const start = advanceRanch(supplied(),{now:0,random:()=>0}).ranch;
  return advanceRanch(start,{now:30000}).ranch;
}
const ready = RANCH_RULES.matingMs + RANCH_RULES.gestationMs;
const HOUR = 3600000;

test('single sheep has optional 15 minute care per need, independently gated for three hours',()=>{
  const single = buy(undefined,{coins:60}).ranch;
  assert.equal(single.animals[0].sex,'male');
  const water = careRanch(single,{action:'water',coins:0,now:0});
  assert.equal(water.coins,0); assert.equal(water.savedMs,900000);
  assert.throws(()=>careRanch(water.ranch,{action:'water',coins:0,now:1}),error('CARE_NOT_DUE'));
  assert.throws(()=>careRanch(single,{action:'feed',coins:2}),error('INSUFFICIENT_COINS'));
  const fed = careRanch(water.ranch,{action:'feed',coins:3,now:0});
  assert.equal(fed.coins,0);assert.equal(fed.ranch.animals[0].growthMs,1800000);
  const restored=JSON.parse(JSON.stringify(fed.ranch));
  assert.throws(()=>careRanch(restored,{action:'feed',coins:3,now:3*HOUR-1}),error('CARE_NOT_DUE'));
  const next=careRanch(restored,{action:'feed',coins:3,now:3*HOUR});
  assert.equal(next.savedMs,900000);assert.equal(next.ranch.animals[0].feedReadyAt,6*HOUR);
  const offline=advanceRanch(next.ranch,{now:8*HOUR}).ranch;
  assert.equal(offline.animals[0].growthMs,8*HOUR);assert.equal(offline.pairing,null);
});
test('purchases draw independent sexes, enforce capacity; rehoming frees same-sex capacity without touching offspring',()=>{
  let ranch = supplied([0,0,0,0,0,0]);
  assert.equal(advanceRanch(ranch,{now:0}).ranch.pairing,null);
  assert.throws(()=>buy(ranch),error('RANCH_FULL'));
  const reh = rehomeBreeder(ranch,{animalId:ranch.animals[0].id,coins:10});
  assert.equal(reh.coins,40); assert.equal(reh.ranch.animals.length,5);
  ranch = buy(reh.ranch,{random:()=>.5}).ranch;
  ranch = {...ranch,animals:ranch.animals.map(a=>({...a,growthMs:RANCH_RULES.growthMs}))};
  assert.equal(ranch.animals.at(-1).sex,'female');
  ranch=careRanch(ranch,{action:'water',coins:10,now:0}).ranch;
  ranch=careRanch(ranch,{action:'feed',coins:10,now:0}).ranch;
  ranch = advanceRanch(ranch,{now:0,random:()=>0}).ranch;
  assert.ok(ranch.pairing);
  assert.throws(()=>rehomeBreeder(ranch,{animalId:ranch.animals[0].id,coins:0}),error('BREEDING_ACTIVE'));
  assert.throws(()=>buy(undefined,{coins:59}),error('INSUFFICIENT_COINS'));
  assert.throws(()=>buy(undefined,{speciesId:'pegasus'}),error('LEVEL_LOCKED'));
  assert.throws(()=>buy(undefined,{speciesId:'qilin',level:60}),error('SPECIES_UNAVAILABLE'));
  assert.throws(()=>buy(undefined,{speciesId:'__proto__'}),error('INVALID_SPECIES'));
  assert.equal(RANCH_RULES.capacity,6);
});
test('pairing persists probability result before resolution, resolves once and uses correct time boundaries',()=>{
  const start = advanceRanch(supplied(),{now:0,random:()=>.649999});
  assert.equal(start.event,'started'); assert.equal(start.ranch.pairing.outcome,true);
  assert.deepEqual(start.ranch.supplies,{water:4,feed:4});
  const restored = JSON.parse(JSON.stringify(start.ranch));
  const forbidden = ()=>{throw Error('must not reroll');};
  assert.equal(advanceRanch(restored,{now:29999,random:forbidden}).ranch.pairing.outcome,true);
  const success = advanceRanch(restored,{now:30000,random:forbidden});
  assert.equal(success.event,'success'); assert.equal(success.ranch.batch.maturesAt,ready);
  assert.equal(success.ranch.cycle,1); assert.equal(success.ranch.attempts,1);
  assert.throws(()=>harvestOffspring(success.ranch,{now:ready-1}),error('NOT_MATURE'));
  assert.equal(advanceRanch(success.ranch,{now:1000000,random:forbidden}).ranch.cycle,1);
  const failStart = advanceRanch(supplied(),{now:0,random:()=>.65}).ranch;
  const fail = advanceRanch(failStart,{now:30000});
  assert.equal(fail.event,'failed'); assert.equal(fail.ranch.pairing,null); assert.equal(fail.ranch.batch,null);
  assert.equal(fail.ranch.attempts,1);
  const retry = advanceRanch(fail.ranch,{now:30001,random:()=>0}).ranch;
  assert.equal(retry.pairing,null); assert.equal(retry.attempts,1);
  assert.equal(retry.animals[0].restUntil,630000);
  const depleted = {...fail.ranch,supplies:{water:0,feed:0}};
  assert.equal(advanceRanch(depleted,{now:30001}).ranch.pairing,null);
});
test('adult care cannot repeatedly boost or alter the persisted pregnancy deadline',()=>{
  const ranch=pregnant();
  assert.throws(()=>careRanch(ranch,{action:'water',coins:10,now:30000}),error('CARE_NOT_DUE'));
  const water=careRanch(ranch,{action:'water',coins:10,now:3*HOUR});
  assert.equal(water.savedMs,0);assert.equal(water.ranch.batch.maturesAt,ready);
  const fed=careRanch(water.ranch,{action:'feed',coins:10,now:3*HOUR});
  assert.equal(fed.coins,7);assert.equal(fed.savedMs,0);
  assert.throws(()=>careRanch(fed.ranch,{action:'feed',coins:10,now:3*HOUR+1}),error('CARE_NOT_DUE'));
});
test('half theft cap and separate sale wallets survive automatic breeding; adults persist',()=>{
  let ranch = pregnant();
  assert.throws(()=>stealOffspring(ranch,{visitorId:'a',now:ready-1}),error('NOT_MATURE'));
  const first = stealOffspring(ranch,{visitorId:'a',now:ready});
  assert.equal(first.reward.sellOnly,true); assert.equal(first.reward.canBreed,false);
  assert.throws(()=>stealOffspring(first.ranch,{visitorId:'a',now:ready}),error('ALREADY_VISITED'));
  ranch = stealOffspring(first.ranch,{visitorId:'__proto__',now:ready}).ranch;
  assert.throws(()=>stealOffspring(ranch,{visitorId:'c',now:ready}),error('THEFT_CAP_REACHED'));
  ranch = sellVisitorOffspring(ranch,{visitorId:'__proto__'}).ranch;
  assert.equal(ranch.visitorCoins.__proto__,18);
  assert.equal(sellVisitorOffspring(ranch,{visitorId:'__proto__'}).income,0);
  ranch = harvestOffspring(ranch,{now:ready}).ranch;
  assert.equal(ranch.animals.length,2); assert.equal(ranch.inventory[0].amount,2);
  const sale = sellOffspring(ranch,{coins:10});
  assert.equal(sale.coins,46); assert.equal(sale.ranch.visitorCoins.__proto__,18);
  assert.equal(validateRanchState(JSON.parse(JSON.stringify(sale.ranch))),true);
  assert.throws(()=>rehomeBreeder(pregnant(),{animalId:'sheep-1',coins:0}),error('BREEDING_ACTIVE'));
});
test('migration keeps legacy active batches and inventories, sets deterministic single female',()=>{
  const current = pregnant();
  const {version,animals,supplies,pairing,lastOutcome,attempts,needsAt,...legacy} = current;
  legacy.batch = {...legacy.batch}; delete legacy.batch.parentIds;
  const migrated = migrateRanchState(legacy);
  assert.deepEqual(migrated.animals,[{id:'legacy-sheep',sex:'female',growthMs:RANCH_RULES.growthMs,restUntil:0,waterReadyAt:0,feedReadyAt:0,lastWaterAt:null,lastFeedAt:null}]);
  assert.deepEqual(migrated.batch,legacy.batch); assert.equal(migrated.needsAt,null);
  assert.equal(advanceRanch(migrated,{now:30000}).ranch.needsAt,null);
  const harvested = harvestOffspring(migrated,{now:ready}).ranch;
  const reh = rehomeBreeder(harvested,{animalId:'legacy-sheep',coins:0}).ranch;
  assert.equal(reh.animals.length,0); assert.equal(sellOffspring(reh,{coins:0}).coins,72);
  assert.equal(migrateRanchState(migrated).version,5);
});
test('corrupt saves, bad inputs and arithmetic overflow are rejected without mutation',()=>{
  const ranch = pregnant();
  const corruptions = [null,{}, {...ranch,cycle:-1}, {...ranch,speciesId:'qilin'}, {...ranch,speciesId:null},
    {...ranch,batch:{...ranch.batch,kind:'crop'}}, {...ranch,batch:{...ranch.batch,initialYield:40}},
    {...ranch,batch:{...ranch.batch,ownerId:'other'}}, {...ranch,visitorCoins:{friend:Infinity}},
    {...ranch,animals:[{id:'a',sex:'other'}]}, {...ranch,animals:[ranch.animals[0],ranch.animals[0]]},
    {...ranch,supplies:{water:5,feed:1}}, {...ranch,needsAt:-1},
    {...ranch,pairing:{maleId:'sheep-1',femaleId:'sheep-2',endsAt:30000,outcome:true}},
    {...ranch,inventory:[{productId:'sheep-offspring',amount:4,kind:'offspring',provenance:'harvested',sellOnly:false,canBreed:true}]}];
  for (const bad of corruptions) assert.throws(()=>validateRanchState(bad),error('INVALID_RANCH'));
  for (const value of [NaN,Infinity,-1,1,'0']) assert.throws(()=>buy(undefined,{random:()=>value}),error('INVALID_RANDOM'));
  for (const coins of [NaN,Infinity,-1,1.5,'100']) assert.throws(()=>careRanch(ranch,{action:'feed',coins}),error('INVALID_COINS'));
  assert.throws(()=>careRanch(buy().ranch,{action:'water',coins:0,now:Number.MAX_SAFE_INTEGER}),error('NUMERIC_OVERFLOW'));
  assert.throws(()=>advanceRanch(supplied(),{now:-1}),error('INVALID_TIME'));
  assert.throws(()=>careRanch(createRanchState(),{action:'water',coins:0}),error('NO_BREEDER'));
  assert.throws(()=>sellOffspring(harvestOffspring(ranch,{now:ready}).ranch,{coins:Number.MAX_SAFE_INTEGER}),error('NUMERIC_OVERFLOW'));
  assert.throws(()=>{ranch.animals[0].sex='female';},TypeError);
  assert.throws(()=>{ranch.supplies.water=99;},TypeError);
  assert.equal(ranch.batch.maturesAt,ready);
});

test('same-sex lambs grow by wall clock, sell as adults independently of offspring',()=>{
  let ranch = createRanchState();
  for(let i=0;i<3;i++) ranch=buy(ranch,{random:()=>.8}).ranch;
  assert.equal(ranch.animals[0].growthMs,0);
  assert.throws(()=>sellAnimal(ranch,{animalId:'sheep-1',coins:0,now:0}),error('ANIMAL_NOT_MATURE'));
  ranch=careRanch(ranch,{action:'water',coins:20,now:0}).ranch;
  ranch=careRanch(ranch,{action:'feed',coins:20,now:0}).ranch;
  ranch=advanceRanch(ranch,{now:ready}).ranch;
  assert.equal(ranch.pairing,null);
  assert.ok(ranch.animals.every(a=>a.growthMs===RANCH_RULES.growthMs));
  assert.equal(canSellAnimal(ranch,'sheep-1'),true);
  let coins=0;
  for(const id of ['sheep-1','sheep-2','sheep-3']) ({ranch,coins}=sellAnimal(ranch,{animalId:id,coins,now:ready}));
  assert.equal(coins,270);assert.equal(ranch.animals.length,0);assert.equal(ranch.inventory.length,0);
});
test('unattended growth continues offline and clock rollback never grants duplicate growth',()=>{
  let ranch=buy().ranch;
  ranch=advanceRanch(ranch,{now:5*HOUR}).ranch;
  assert.equal(ranch.animals[0].growthMs,5*HOUR);
  assert.deepEqual(ranch.supplies,{water:0,feed:0});
  const backwards=advanceRanch(ranch,{now:4*HOUR}).ranch;
  assert.equal(backwards.growthAt,5*HOUR);assert.equal(backwards.animals[0].growthMs,5*HOUR);
  assert.equal(advanceRanch(backwards,{now:6*HOUR}).ranch.animals[0].growthMs,6*HOUR);
  assert.throws(()=>sellAnimal(ranch,{animalId:'sheep-1',coins:0,now:8*HOUR-1}),error('ANIMAL_NOT_MATURE'));
  assert.equal(sellAnimal(ranch,{animalId:'sheep-1',coins:0,now:8*HOUR}).coins,90);
});
test('staggered purchases and care only credit eligible sheep, without global refill spam',()=>{
  let ranch=buy().ranch;
  ranch=careRanch(ranch,{action:'water',coins:20,now:0}).ranch;
  ranch=buy(ranch,{now:HOUR,random:()=>.9}).ranch;
  assert.equal(ranch.animals[0].growthMs,HOUR+900000);assert.equal(ranch.animals[1].growthMs,0);
  const cared=careRanch(ranch,{action:'water',coins:20,now:HOUR});
  assert.deepEqual(cared.affectedAnimalIds,['sheep-2']);assert.equal(cared.savedMs,900000);
  assert.equal(cared.ranch.animals[0].waterReadyAt,3*HOUR);
  assert.equal(cared.ranch.animals[1].waterReadyAt,4*HOUR);
  assert.throws(()=>careRanch(cared.ranch,{action:'water',coins:20,now:HOUR+1}),error('CARE_NOT_DUE'));
  const firstDue=careRanch(cared.ranch,{action:'water',coins:20,now:3*HOUR});
  assert.deepEqual(firstDue.affectedAnimalIds,['sheep-1']);
  assert.equal(advanceRanch(firstDue.ranch,{now:3*HOUR}).ranch.pairing,null);
});
test('pause blocks future mating only and parent locks permit unrelated mature sales',()=>{
  let ranch=supplied([0,.8,.8]);
  ranch=setBreedingEnabled(ranch,{enabled:false}).ranch;
  assert.equal(advanceRanch(ranch,{now:0}).ranch.pairing,null);
  ranch=setBreedingEnabled(ranch,{enabled:true}).ranch;
  ranch=advanceRanch(ranch,{now:0,random:()=>0}).ranch;
  assert.equal(animalBusy(ranch,'sheep-1'),true);assert.equal(animalBusy(ranch,'sheep-3'),false);
  assert.throws(()=>sellAnimal(ranch,{animalId:'sheep-2',coins:0,now:0}),error('BREEDING_ACTIVE'));
  ranch=sellAnimal(ranch,{animalId:'sheep-3',coins:0,now:0}).ranch;
  ranch=setBreedingEnabled(ranch,{enabled:false}).ranch;
  ranch=advanceRanch(ranch,{now:30000}).ranch;
  assert.deepEqual(ranch.batch.parentIds,['sheep-1','sheep-2']);
  assert.throws(()=>ranch.batch.parentIds.push('other'),TypeError);
  assert.equal(canSellAnimal(ranch,'sheep-2'),false);
  ranch=harvestOffspring(ranch,{now:ready}).ranch;
  assert.equal(canSellAnimal(ranch,'sheep-2'),true);
  assert.equal(advanceRanch(ranch,{now:ready}).ranch.pairing,null);
});
test('v2 animals migrate as sellable adults and legacy batches conservatively lock all animals',()=>{
  const current=supplied([.8,.8,.8]);
  const {growthAt,breedingEnabled,...old}=current;
  old.version=2;old.animals=old.animals.map(({growthMs,...a})=>a);
  const migrated=migrateRanchState(old);
  assert.equal(migrated.version,5);assert.equal(migrated.breedingEnabled,true);
  assert.ok(migrated.animals.every(a=>canSellAnimal(migrated,a.id)));
  assert.equal(sellAnimal(migrated,{animalId:'sheep-1',coins:0,now:100000}).coins,90);
  const legacy={...pregnant(),animals:[...pregnant().animals,{...pregnant().animals[1],id:'third'}],batch:{...pregnant().batch}};
  delete legacy.batch.parentIds;
  assert.equal(animalBusy(legacy,'third'),true);
  assert.throws(()=>validateRanchState({...migrated,animals:[{...migrated.animals[0],growthMs:RANCH_RULES.growthMs+1}]}),error('INVALID_RANCH'));
});

test('male purchase probability is exactly 5 percent with deterministic boundary draws',()=>{
  assert.equal(RANCH_RULES.maleChance,.05);
  assert.equal(buy(undefined,{random:()=>.049999}).animal.sex,'male');
  assert.equal(buy(undefined,{random:()=>.05}).animal.sex,'female');
  assert.equal(buy(undefined,{random:()=>.999999}).animal.sex,'female');
});
test('failed attempt rests the male for ten minutes; refill and reload do not bypass boundary',()=>{
  let ranch=advanceRanch(supplied(),{now:0,random:()=>.8}).ranch;
  ranch=advanceRanch(ranch,{now:30000}).ranch;
  assert.equal(ranch.animals[0].restUntil,630000);
  ranch=JSON.parse(JSON.stringify(ranch));
  assert.throws(()=>careRanch(ranch,{action:'water',coins:10,now:600000}),error('CARE_NOT_DUE'));
  assert.throws(()=>careRanch(ranch,{action:'feed',coins:10,now:600000}),error('CARE_NOT_DUE'));
  assert.equal(advanceRanch(ranch,{now:629999,random:()=>0}).ranch.pairing,null);
  const next=advanceRanch(ranch,{now:630000,random:()=>0}).ranch;
  assert.equal(next.pairing.maleId,'sheep-1');assert.equal(next.attempts,2);
  assert.equal(canSellAnimal(ranch,'sheep-1'),true);
});
test('another mature male can pair while the failed first male rests',()=>{
  let ranch=advanceRanch(supplied([0,.8,0]),{now:0,random:()=>.9}).ranch;
  ranch=advanceRanch(ranch,{now:30000}).ranch;
  assert.equal(ranch.animals[0].restUntil,630000);
  assert.equal(ranch.animals[2].restUntil,0);
  const onlyFirst={...ranch,animals:ranch.animals.slice(0,2)};
  assert.equal(advanceRanch(onlyFirst,{now:30000}).ranch.pairing,null);
  ranch=advanceRanch(ranch,{now:30000,random:()=>0}).ranch;
  assert.equal(ranch.pairing.maleId,'sheep-3');
  const success=advanceRanch(ranch,{now:60000}).ranch;
  assert.equal(success.animals[2].restUntil,660000);
});
test('offline pairing resolves rest at original finish time, not load time, without multiple attempts',()=>{
  const start=advanceRanch(supplied(),{now:0,random:()=>.8}).ranch;
  const offline=advanceRanch(start,{now:1000000}).ranch;
  assert.equal(offline.animals[0].restUntil,630000);assert.equal(offline.attempts,1);assert.equal(offline.pairing,null);
  let ranch=offline;
  assert.ok(advanceRanch(ranch,{now:1000000,random:()=>0}).ranch.pairing);
});
test('v3 migration preserves growth, controls and saved pairing outcome; legacy attempt gains rest on resolution',()=>{
  let old=JSON.parse(JSON.stringify(advanceRanch(supplied(),{now:0,random:()=>.8}).ranch));
  old.version=3;old.breedingEnabled=false;
  old.animals.forEach(a=>{delete a.restUntil;a.growthMs/=240;});
  const migrated=migrateRanchState(old);
  assert.equal(migrated.version,5);assert.equal(migrated.breedingEnabled,false);
  assert.deepEqual(migrated.pairing,old.pairing);assert.deepEqual(migrated.supplies,{water:0,feed:0});
  assert.equal(migrated.growthAt,old.growthAt);assert.equal(migrated.animals[0].growthMs,old.animals[0].growthMs*240);
  assert.equal(migrated.animals[0].restUntil,0);
  assert.equal(advanceRanch(migrated,{now:30000}).ranch.animals[0].restUntil,630000);
  old={...old,pairing:null,animals:old.animals.map(a=>({...a,growthMs:1234}))};
  assert.equal(migrateRanchState(old).animals[0].growthMs,1234*240);
  assert.throws(()=>validateRanchState({...migrated,animals:migrated.animals.map(a=>({...a,restUntil:-1}))}),error('INVALID_RANCH'));
});
test('rest timestamp overflow rejects before probability draw and resource deduction',()=>{
  const now=Number.MAX_SAFE_INTEGER-500000;
  const base=supplied();
  const ranch={...base,growthAt:now,animals:base.animals.map(a=>({...a,lastWaterAt:now-RANCH_RULES.needsMs+1,lastFeedAt:now-RANCH_RULES.needsMs+1,waterReadyAt:now+1,feedReadyAt:now+1}))};
  let draws=0;
  assert.throws(()=>advanceRanch(ranch,{now,random:()=>{draws++;return 0;}}),error('NUMERIC_OVERFLOW'));
  assert.equal(draws,0);assert.deepEqual(ranch.supplies,{water:4,feed:4});assert.equal(ranch.attempts,0);
});

test('returning after missed care grants elapsed time only, not accumulated care bonuses',()=>{
  let ranch=buy().ranch;
  ranch=careRanch(ranch,{action:'water',coins:10,now:0}).ranch;
  ranch=careRanch(ranch,{action:'feed',coins:10,now:0}).ranch;
  ranch=JSON.parse(JSON.stringify(ranch));
  ranch=advanceRanch(ranch,{now:5*HOUR}).ranch;
  assert.equal(ranch.animals[0].growthMs,5.5*HOUR);
  assert.deepEqual(ranch.supplies,{water:0,feed:0});
  assert.equal(ranch.animals[0].lastWaterAt,0);
  const water=careRanch(ranch,{action:'water',coins:10,now:5*HOUR});
  assert.equal(water.ranch.animals[0].growthMs,5.75*HOUR);
  assert.equal(water.ranch.animals[0].waterReadyAt,8*HOUR);
  const feed=careRanch(water.ranch,{action:'feed',coins:10,now:5*HOUR});
  assert.equal(feed.ranch.animals[0].growthMs,6*HOUR);
  assert.throws(()=>sellAnimal(feed.ranch,{animalId:'sheep-1',coins:0,now:7*HOUR-1}),error('ANIMAL_NOT_MATURE'));
  assert.equal(sellAnimal(feed.ranch,{animalId:'sheep-1',coins:0,now:7*HOUR}).coins,90);
});
test('care clamps at adulthood and never overflows the growth limit',()=>{
  const ranch=buy().ranch;
  const cared=careRanch(ranch,{action:'water',coins:0,now:8*HOUR-1000});
  assert.equal(cared.savedMs,1000);
  assert.equal(cared.ranch.animals[0].growthMs,RANCH_RULES.growthMs);
  assert.equal(canSellAnimal(cared.ranch,'sheep-1'),true);
});
test('v4 migration scales partial progress and preserves gender, male rest and pregnancy deadline',()=>{
  const old=JSON.parse(JSON.stringify(pregnant()));
  old.version=4;
  old.animals.forEach(a=>a.growthMs=120000);
  old.animals.push({...old.animals[1],id:'young',growthMs:30000});
  const migrated=migrateRanchState(old);
  assert.equal(migrated.animals[0].restUntil,630000);
  assert.deepEqual(migrated.animals.map(a=>a.sex),old.animals.map(a=>a.sex));
  assert.equal(migrated.animals[2].growthMs,2*HOUR);
  assert.deepEqual(migrated.batch,old.batch);
  assert.equal(migrated.animals[2].lastWaterAt,null);
  assert.equal(migrated.animals[2].lastFeedAt,null);
  assert.equal(validateRanchState(JSON.parse(JSON.stringify(migrated))),true);
});
