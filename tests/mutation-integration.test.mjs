import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatch,inspectBatch,harvestOwn,stealHarvest} from '../src/domain/harvest.mjs';
import {applyCare} from '../src/domain/care.mjs';
import {createRanchState,buyBreeder,careRanch,advanceRanch,sellAnimal,rehomeBreeder,validateRanchState,harvestOffspring,stealOffspring,sellOffspring,sellVisitorOffspring,RANCH_RULES} from '../src/domain/ranch.mjs';
import {mutationValue} from '../src/domain/nature.mjs';
const batch = () => createBatch({batchId:'corn-1',ownerId:'owner',productId:'corn',kind:'crop',initialYield:40,maturesAt:60000});
const cropCare = (b,action,random,now=0) => applyCare(b,{actorId:'owner',coins:100,action,now,random});
const buy = () => buyBreeder(createRanchState(),{speciesId:'sheep',level:1,coins:100,now:0,random:()=>.99}).ranch;
const forbidden = () => {throw new Error('unexpected random draw');};

test('crop care rolls at the 1% boundary before acceleration and repeated actions never reroll',()=>{
 const original=batch();
 assert.equal(cropCare(original,'water',()=>.01).batch.mutation,undefined);
 const watered=cropCare(original,'water',()=>.009999,59999).batch;
 assert.equal(watered.maturesAt,59999);assert.equal(watered.mutation,'dewdrop');
 assert.throws(()=>cropCare(watered,'water',forbidden,59999),{code:'ALREADY_MATURE'});
 const early=cropCare(original,'water',()=>0).batch;
 assert.throws(()=>cropCare(early,'water',forbidden),{code:'ALREADY_CARED'});
 assert.equal(cropCare(early,'fertilize',forbidden).batch.mutation,'dewdrop');
 assert.equal(cropCare(original,'fertilize',()=>0).batch.mutation,'lush');
 assert.equal(original.mutation,undefined);
});

test('ranch care only rolls for due immature animals, persists variants, and adult care cannot reroll',()=>{
 const original=buy();
 assert.equal(careRanch(original,{action:'feed',coins:100,now:0,random:()=>.01}).ranch.animals[0].mutation,undefined);
 const water=careRanch(original,{action:'water',coins:100,now:0,random:()=>0}).ranch;
 assert.equal(water.animals[0].mutation,'dewdrop');
 assert.throws(()=>careRanch(water,{action:'water',coins:100,now:1,random:forbidden}),{code:'CARE_NOT_DUE'});
 const fed=careRanch(JSON.parse(JSON.stringify(water)),{action:'feed',coins:100,now:0,random:forbidden}).ranch;
 assert.equal(fed.animals[0].mutation,'dewdrop');
 const adult=advanceRanch(original,{now:RANCH_RULES.growthMs}).ranch;
 const cared=careRanch(adult,{action:'feed',coins:100,now:RANCH_RULES.growthMs,random:forbidden}).ranch;
 assert.equal(cared.animals[0].mutation,undefined);
 const nearly={...original,animals:original.animals.map(a=>({...a,growthMs:RANCH_RULES.growthMs-1}))};
 const matured=careRanch(nearly,{action:'feed',coins:100,now:0,random:()=>0}).ranch;
 assert.equal(matured.animals[0].growthMs,RANCH_RULES.growthMs);assert.equal(matured.animals[0].mutation,'lush');
});

test('animal mutation raises adult sale value but juvenile rehoming stays fixed',()=>{
 const mutated=careRanch(buy(),{action:'water',coins:0,now:0,random:()=>0}).ranch;
 assert.equal(rehomeBreeder(mutated,{animalId:mutated.animals[0].id,coins:0,now:0}).income,30);
 const adult=advanceRanch(mutated,{now:RANCH_RULES.growthMs}).ranch;
 assert.equal(sellAnimal(adult,{animalId:adult.animals[0].id,coins:0,now:RANCH_RULES.growthMs}).income,mutationValue(90,'dewdrop'));
 assert.throws(()=>validateRanchState({...mutated,animals:mutated.animals.map(a=>({...a,mutation:'invalid'}))}),{code:'INVALID_RANCH'});
});

test('mutations propagate to theft and own harvest without changing the 50% theft ceiling',()=>{
 const mutated={...batch(),mutation:'frost'};
 const stolen=stealHarvest(mutated,{visitorId:'friend',requestedAmount:40,now:60000});
 assert.equal(stolen.reward.amount,20);assert.equal(stolen.reward.mutation,'frost');
 const own=harvestOwn(stolen.batch,{actorId:'owner',now:60000});
 assert.equal(own.reward.amount,20);assert.equal(own.reward.mutation,'frost');
 assert.throws(()=>inspectBatch({...mutated,mutation:'invalid'},0),{code:'INVALID_BATCH'});
});

test('offspring owner and visitor inventories retain variant premiums independently',()=>{
 const batch=createBatch({batchId:'offspring-1',ownerId:'local-owner',productId:'sheep-offspring',kind:'offspring',initialYield:4,maturesAt:0});
 let ranch={...buy(),cycle:1,batch:{...batch,mutation:'storm'}};
 ranch=stealOffspring(ranch,{visitorId:'friend',now:0}).ranch;
 ranch=harvestOffspring(ranch,{now:0}).ranch;
 const owner=sellOffspring(ranch,{coins:0});
 assert.equal(owner.amount,3);assert.equal(owner.coins,3*mutationValue(18,'storm'));
 const visitor=sellVisitorOffspring(owner.ranch,{visitorId:'friend'});
 assert.equal(visitor.amount,1);assert.equal(visitor.income,mutationValue(18,'storm'));
 assert.equal(visitor.ranch.visitorCoins.friend,mutationValue(18,'storm'));
 assert.throws(()=>validateRanchState({...ranch,inventory:ranch.inventory.map(i=>({...i,mutation:'invalid'}))}),{code:'INVALID_RANCH'});
});
