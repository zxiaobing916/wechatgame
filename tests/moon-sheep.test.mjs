import test from 'node:test';
import assert from 'node:assert/strict';
import {createRanchState,buyBreeder,validateRanchState,migrateRanchState,careRanch,advanceRanch,sellAnimal,rehomeBreeder,canSellAnimal,harvestOffspring,RANCH_RULES} from '../src/domain/ranch.mjs';
import {createAtelier,groomAnimal,claimTicket,GROOM_COOLDOWN_MS} from '../src/domain/atelier.mjs';
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
function moon(){const r=buyBreeder(createRanchState(),{speciesId:'sheep',coins:60,level:1,random:()=>.5,now:0}).ranch;return {...r,animals:r.animals.map(a=>({...a,breed:'moon',collection:true}))};}
test('moon identity is validated and survives care, offline growth and persisted reload',()=>{
 let r=moon();assert.equal(validateRanchState(r),true);
 for(const extra of [{breed:'invalid'},{collection:false},{breed:undefined,collection:true}])err(()=>validateRanchState({...r,animals:[{...r.animals[0],...extra}]}),'INVALID_RANCH');
 r=careRanch(r,{action:'water',coins:10,now:1,random:()=>0}).ranch;
 r=careRanch(r,{action:'feed',coins:10,now:2,random:()=>.5}).ranch;
 r=migrateRanchState(JSON.parse(JSON.stringify(r)));r=advanceRanch(r,{now:RANCH_RULES.growthMs}).ranch;
 assert.equal(r.animals[0].breed,'moon');assert.equal(r.animals[0].collection,true);assert.equal(r.animals[0].mutation,'dewdrop');assert.equal(r.animals[0].growthMs,RANCH_RULES.growthMs);
 assert.ok(Object.isFrozen(r.animals[0]));
});
test('unique collection sheep cannot be sold or rehomed at any age, normal sheep can',()=>{
 const r=moon(),id=r.animals[0].id;assert.equal(canSellAnimal(r,id),false);
 for(const now of [0,RANCH_RULES.growthMs])for(const remove of [sellAnimal,rehomeBreeder])err(()=>remove(r,{animalId:id,coins:0,now}),'COLLECTION_PROTECTED');
 const mature=advanceRanch(r,{now:RANCH_RULES.growthMs}).ranch;assert.equal(canSellAnimal(mature,id),false);
 const normal={...mature,animals:mature.animals.map(({breed,collection,...a})=>a)};assert.equal(canSellAnimal(normal,id),true);assert.equal(sellAnimal(normal,{animalId:id,coins:0,now:RANCH_RULES.growthMs}).refund,90);
});
test('mature moon sheep produces two moon down, independent four-hour cooldown and daily task credit',()=>{
 const r=moon(),id=r.animals[0].id,now=RANCH_RULES.growthMs;
 err(()=>groomAnimal(createAtelier(0),r,{animalId:id,now:0}),'ANIMAL_IMMATURE');
 let result=groomAnimal(createAtelier(0),r,{animalId:id,now});
 assert.deepEqual(result.reward.materials,{moonDown:2});assert.match(result.reward.label,/月光绒/);assert.equal(result.atelier.materials.wool,0);assert.equal(result.atelier.materials.moonDown,2);assert.equal(result.atelier.daily.groom,1);
 const restored=migrateRanchState(JSON.parse(JSON.stringify(result.ranch)));
 err(()=>groomAnimal(result.atelier,restored,{animalId:id,now:now+GROOM_COOLDOWN_MS-1}),'GROOM_COOLDOWN');
 result=groomAnimal(result.atelier,restored,{animalId:id,now:now+GROOM_COOLDOWN_MS});assert.equal(result.atelier.materials.moonDown,4);assert.equal(claimTicket(result.atelier,{task:'groom',now:now+GROOM_COOLDOWN_MS}).tickets,4);
});
test('moon parent offspring remain ordinary sell-only offspring, never duplicate collection rewards',()=>{
 let r=buyBreeder(moon(),{speciesId:'sheep',coins:60,level:1,random:()=>0,now:0}).ranch;
 const now=RANCH_RULES.growthMs;r=advanceRanch(r,{now}).ranch;
 for(const action of ['water','feed'])r=careRanch(r,{action,coins:10,now,random:()=>.5}).ranch;
 r=advanceRanch(r,{now,random:()=>0}).ranch;assert.ok(r.pairing);
 r=advanceRanch(r,{now:r.pairing.endsAt}).ranch;
 r=harvestOffspring(r,{now:r.batch.maturesAt}).ranch;
 assert.equal(r.inventory[0].breed,undefined);assert.equal(r.inventory[0].collection,undefined);assert.equal(r.inventory[0].sellOnly,true);assert.equal(r.animals.filter(a=>a.breed==='moon').length,1);
});
