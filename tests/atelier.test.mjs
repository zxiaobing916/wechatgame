import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtelier,validateAtelier,grantHarvest,groomAnimal,claimTicket,craftSkin,equipSkin,exchangeDown,drawTicket,GROOM_COOLDOWN_MS} from '../src/domain/atelier.mjs';
import {createRanchState,buyBreeder,sellAnimal,RANCH_RULES} from '../src/domain/ranch.mjs';
const rich=()=>({...createAtelier(0),materials:{wool:100,goldDye:100,roseDye:100,moonDown:100}});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('atelier starts with three earned-only tickets; harvest dye and daily claims persist across reload',()=>{
 let a=createAtelier(0);assert.equal(a.tickets,3);assert.equal(a.coins,undefined);for(let i=0;i<3;i++)a=grantHarvest(a,{crop:'corn',now:1});assert.equal(a.materials.goldDye,6);
 a=claimTicket(a,{task:'harvest',now:2});assert.equal(a.tickets,4);a=JSON.parse(JSON.stringify(a));assert.equal(validateAtelier(a),true);err(()=>claimTicket(a,{task:'harvest',now:0}),'ALREADY_CLAIMED');
 err(()=>claimTicket(a,{task:'harvest',now:86400000}),'TASK_INCOMPLETE');a=grantHarvest(a,{crop:'watermelon',now:86400000});assert.equal(a.daily.harvest,1);assert.equal(a.materials.roseDye,2);assert.equal(a.daily.harvestClaimed,false);
 err(()=>grantHarvest(a,{crop:'fake',now:1}),'INVALID_CROP');
});
test('crafting consumes exact recipe; ownership/equip and deterministic down exchange',()=>{
 let a=rich();a=craftSkin(a,{skinId:'dawn'});assert.deepEqual(a.materials,{wool:96,goldDye:98,roseDye:98,moonDown:100});assert.equal(equipSkin(a,{skinId:'dawn'}).equipped,'dawn');err(()=>craftSkin(a,{skinId:'dawn'}),'ALREADY_OWNED');err(()=>equipSkin(a,{skinId:'moon'}),'SKIN_NOT_OWNED');err(()=>craftSkin(createAtelier(0),{skinId:'moon'}),'INSUFFICIENT_MATERIALS');
 const b=exchangeDown(a);assert.deepEqual(b.materials,{wool:90,goldDye:96,roseDye:96,moonDown:101});assert.equal(a.materials.wool,96);assert.ok(Object.isFrozen(b.materials));
});
test('draw thresholds, malformed RNG and no tickets cannot spend balances',()=>{
 for(const [n,key] of [[0,'wool'],[.399999,'wool'],[.4,'goldDye'],[.599999,'goldDye'],[.6,'roseDye'],[.799999,'roseDye'],[.8,'moonDown'],[.949999,'moonDown']]){const a=createAtelier(0);const r=drawTicket(a,{random:()=>n});assert.ok(r.reward.materials[key]);assert.equal(r.atelier.tickets,2);assert.equal(a.tickets,3);}
 const seq=[.95,0];assert.equal(drawTicket(createAtelier(0),{random:()=>seq.shift()}).reward.skinId,'dawn');
 for(const n of [NaN,Infinity,-1,1,'0'])err(()=>drawTicket(createAtelier(0),{random:()=>n}),'INVALID_RANDOM');err(()=>drawTicket({...createAtelier(0),tickets:0}),'NO_TICKETS');
});
test('tenth draw guarantees unowned skin; duplicate compensates without refund; history is bounded',()=>{
 let a={...createAtelier(0),tickets:40,owned:['dawn']};for(let i=0;i<9;i++)a=drawTicket(a,{random:()=>0}).atelier;assert.equal(a.pity,9);a=JSON.parse(JSON.stringify(a));let result=drawTicket(a,{random:()=>0});assert.equal(result.reward.skinId,'moon');assert.equal(result.reward.pity,true);assert.equal(result.atelier.pity,0);assert.equal(result.atelier.tickets,30);
 a=result.atelier;const seq=[.99,0];result=drawTicket(a,{random:()=>seq.shift()});assert.equal(result.reward.duplicate,true);assert.equal(result.atelier.materials.wool,a.materials.wool+8);assert.equal(result.atelier.materials.moonDown,a.materials.moonDown+2);assert.equal(result.atelier.tickets,29);
 a=result.atelier;for(let i=0;i<25;i++)a=drawTicket(a,{random:()=>0}).atelier;assert.equal(a.history.length,20);assert.equal(validateAtelier(a),true);
});
test('groom mature sheep once each four hours; independent animals, persistence, no mutation or breeding draw',()=>{
 let ranch=buyBreeder(createRanchState(),{speciesId:'sheep',coins:500,level:1,random:()=>.5,now:0}).ranch;
 const id=ranch.animals[0].id;err(()=>groomAnimal(createAtelier(0),ranch,{animalId:id,now:0}),'ANIMAL_IMMATURE');
 const now=RANCH_RULES.growthMs;let result=groomAnimal(createAtelier(0),ranch,{animalId:id,now});assert.equal(result.atelier.materials.wool,2);assert.equal(result.ranch.animals[0].groomReadyAt,now+GROOM_COOLDOWN_MS);assert.equal(ranch.animals[0].groomReadyAt,undefined);assert.equal(result.ranch.pairing,ranch.pairing);
 err(()=>groomAnimal(result.atelier,JSON.parse(JSON.stringify(result.ranch)),{animalId:id,now:now+GROOM_COOLDOWN_MS-1}),'GROOM_COOLDOWN');result=groomAnimal(result.atelier,result.ranch,{animalId:id,now:now+GROOM_COOLDOWN_MS});assert.equal(result.atelier.materials.wool,4);
 const claimed=claimTicket(result.atelier,{task:'groom',now:now+GROOM_COOLDOWN_MS});assert.equal(claimed.tickets,4);err(()=>claimTicket(claimed,{task:'groom',now:now}),'ALREADY_CLAIMED');
});
test('validation rejects unsafe quantities and invalid saves without changing source',()=>{
 const a=createAtelier(0);err(()=>validateAtelier({...a,pity:10}),'INVALID_ATELIER');err(()=>validateAtelier({...a,materials:{...a.materials,wool:-1}}),'INVALID_ATELIER');err(()=>createAtelier(-1),'INVALID_TIME');
 const full={...a,materials:{...a.materials,goldDye:Number.MAX_SAFE_INTEGER}};err(()=>grantHarvest(full,{crop:'corn',now:1}),'NUMERIC_OVERFLOW');assert.equal(full.materials.goldDye,Number.MAX_SAFE_INTEGER);
});

test('groom cooldown follows its sheep, survives ranch care updates, and does not attach to reused IDs',()=>{
 let ranch=buyBreeder(createRanchState(),{speciesId:'sheep',coins:500,level:1,random:()=>.5,now:0}).ranch;
 ranch=buyBreeder(ranch,{speciesId:'sheep',coins:500,level:1,random:()=>.5,now:0}).ranch;
 const now=RANCH_RULES.growthMs;const [one,two]=ranch.animals.map(a=>a.id);
 let r=groomAnimal(createAtelier(0),ranch,{animalId:one,now});r=groomAnimal(r.atelier,r.ranch,{animalId:two,now});assert.equal(r.atelier.materials.wool,4);
 // Selling settles growth and retains the other animal's custom cooldown field.
 ranch=sellAnimal(r.ranch,{animalId:one,coins:0,now}).ranch;assert.equal(ranch.animals[0].groomReadyAt,now+GROOM_COOLDOWN_MS);
 ranch=buyBreeder(ranch,{speciesId:'sheep',coins:500,level:1,random:()=>.5,now}).ranch;assert.equal(ranch.animals[1].groomReadyAt,undefined);
 err(()=>groomAnimal(r.atelier,ranch,{animalId:ranch.animals[1].id,now}),'ANIMAL_IMMATURE');
});
