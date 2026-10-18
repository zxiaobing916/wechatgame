import test from 'node:test';
import * as atelierAPI from '../src/domain/atelier.mjs';
import assert from 'node:assert/strict';
import {createAtelier,migrateAtelier,validateAtelier,grantHarvest,groomAnimal,craftSkin,equipSkin,exchangeDown,GROOM_COOLDOWN_MS} from '../src/domain/atelier.mjs';
import {createRanchState,buyBreeder,sellAnimal,RANCH_RULES} from '../src/domain/ranch.mjs';
const rich=()=>({...createAtelier(0),materials:{wool:100,goldDye:100,roseDye:100,moonDown:100}});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
const legacy=()=>({version:1,materials:{wool:3,goldDye:4,roseDye:5,moonDown:6},tickets:3,owned:['dawn','moon'],equipped:'moon',pity:9,history:[{type:'skin',skinId:'moon',label:'月羽礼服',materials:{},duplicate:false,pity:true}],daily:{day:2,harvest:3,groom:1,harvestClaimed:true,groomClaimed:false}});
test('atelier has no lottery API or balances; harvest grants only dye across days',()=>{
 let a=createAtelier(0);assert.deepEqual(Object.keys(a).sort(),['equipped','materials','owned','version']);assert.ok(Object.values(a.materials).every(n=>n===0));assert.equal(atelierAPI.drawTicket,undefined);assert.equal(atelierAPI.claimTicket,undefined);
 for(let i=0;i<3;i++)a=grantHarvest(a,{crop:'corn',now:i});assert.equal(a.materials.goldDye,6);
 a=grantHarvest(a,{crop:'watermelon',now:86400000});assert.equal(a.materials.roseDye,2);assert.equal(validateAtelier(JSON.parse(JSON.stringify(a))),true);
 err(()=>grantHarvest(a,{crop:'fake',now:1}),'INVALID_CROP');
});
test('migration preserves all possessions and converts unused tickets exactly once',()=>{
 const old=legacy(),snapshot=JSON.stringify(old);const next=migrateAtelier(old);
 assert.equal(next.version,2);assert.deepEqual(next.materials,{wool:9,goldDye:4,roseDye:5,moonDown:6});assert.deepEqual(next.owned,old.owned);assert.equal(next.equipped,'moon');assert.equal(JSON.stringify(old),snapshot);
 assert.deepEqual(migrateAtelier(JSON.parse(JSON.stringify(next))),next);assert.equal(validateAtelier(next),true);assert.ok(Object.isFrozen(next.owned));
 assert.equal(migrateAtelier({...old,tickets:0}).materials.wool,3);
});
test('migration rejects malformed legacy state and unsafe compensation without mutation',()=>{
 for(const old of [{...legacy(),tickets:-1},{...legacy(),tickets:1.2},{...legacy(),pity:10},{...legacy(),equipped:'forest'},{...legacy(),history:[{}]},{...legacy(),daily:{...legacy().daily,groomClaimed:1}},{...legacy(),extra:1},{...legacy(),version:99}])err(()=>migrateAtelier(old),'INVALID_ATELIER');
 const huge={...legacy(),tickets:Number.MAX_SAFE_INTEGER};err(()=>migrateAtelier(huge),'NUMERIC_OVERFLOW');assert.equal(huge.materials.wool,3);
 err(()=>migrateAtelier({...legacy(),materials:{...legacy().materials,wool:Number.MAX_SAFE_INTEGER}}),'NUMERIC_OVERFLOW');
});
test('crafting consumes exact recipe; ownership/equip and deterministic down exchange',()=>{
 let a=rich();a=craftSkin(a,{skinId:'dawn'});assert.deepEqual(a.materials,{wool:96,goldDye:98,roseDye:98,moonDown:100});assert.equal(equipSkin(a,{skinId:'dawn'}).equipped,'dawn');err(()=>craftSkin(a,{skinId:'dawn'}),'ALREADY_OWNED');err(()=>equipSkin(a,{skinId:'moon'}),'SKIN_NOT_OWNED');err(()=>craftSkin(createAtelier(0),{skinId:'moon'}),'INSUFFICIENT_MATERIALS');
 const b=exchangeDown(a);assert.deepEqual(b.materials,{wool:90,goldDye:96,roseDye:96,moonDown:101});assert.equal(a.materials.wool,96);assert.ok(Object.isFrozen(b.materials));
});
test('groom mature sheep once each four hours; independent animals, persistence, no mutation or breeding draw',()=>{
 let ranch=buyBreeder(createRanchState(),{speciesId:'sheep',coins:500,level:1,random:()=>.5,now:0}).ranch;
 const id=ranch.animals[0].id;err(()=>groomAnimal(createAtelier(0),ranch,{animalId:id,now:0}),'ANIMAL_IMMATURE');
 const now=RANCH_RULES.growthMs;let result=groomAnimal(createAtelier(0),ranch,{animalId:id,now});assert.equal(result.atelier.materials.wool,2);assert.equal(result.ranch.animals[0].groomReadyAt,now+GROOM_COOLDOWN_MS);assert.equal(ranch.animals[0].groomReadyAt,undefined);assert.equal(result.ranch.pairing,ranch.pairing);
 err(()=>groomAnimal(result.atelier,JSON.parse(JSON.stringify(result.ranch)),{animalId:id,now:now+GROOM_COOLDOWN_MS-1}),'GROOM_COOLDOWN');result=groomAnimal(result.atelier,result.ranch,{animalId:id,now:now+GROOM_COOLDOWN_MS});assert.equal(result.atelier.materials.wool,4);
 assert.equal(result.atelier.daily,undefined);assert.equal(result.atelier.tickets,undefined);
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

test('moon sheep grooming produces moon down and rejects timestamp overflow',()=>{
 let ranch=buyBreeder(createRanchState(),{speciesId:'sheep',coins:500,level:1,random:()=>.5,now:0}).ranch;
 ranch={...ranch,animals:ranch.animals.map(a=>({...a,breed:'moon',collection:true}))};
 const id=ranch.animals[0].id;
 const result=groomAnimal(createAtelier(0),ranch,{animalId:id,now:RANCH_RULES.growthMs});assert.equal(result.atelier.materials.moonDown,2);assert.equal(result.atelier.materials.wool,0);
 err(()=>groomAnimal(createAtelier(0),ranch,{animalId:id,now:Number.MAX_SAFE_INTEGER}),'NUMERIC_OVERFLOW');
});
