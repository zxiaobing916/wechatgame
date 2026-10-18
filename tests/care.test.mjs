import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatch,harvestOwn,stealHarvest} from '../src/domain/harvest.mjs';
import {applyCare,inspectCare,GROWTH} from '../src/domain/care.mjs';
const batch=(productId='corn')=>createBatch({batchId:'b',ownerId:'owner',productId,kind:productId==='sheep-offspring'?'offspring':'crop',initialYield:40,maturesAt:100000+GROWTH[productId].durationMs});
const act=(b,action,extra={})=>applyCare(b,{action,actorId:'owner',coins:10,now:100000,...extra});
test('each product has distinct timing, two bounded care actions and persisted usage',()=>{
 for(const product of Object.keys(GROWTH)){
  const original=batch(product),water=act(original,'water'),fed=act(water.batch,'fertilize');
  assert.equal(water.coins,10);assert.equal(fed.coins,10-GROWTH[product].cost);
  assert.equal(fed.batch.maturesAt,100000+GROWTH[product].durationMs/2);
  assert.equal(original.care,undefined);assert.deepEqual(inspectCare(JSON.parse(JSON.stringify(fed.batch)),100000).water,true);
  assert.throws(()=>act(fed.batch,'water'),{code:'ALREADY_CARED'});
  assert.throws(()=>act(fed.batch,'fertilize'),{code:'ALREADY_CARED'});
 }
});
test('care clamps to now, maturity is automatic, harvest and half-theft stay valid',()=>{
 const b=batch(),r=act(b,'water',{now:159000});assert.equal(r.savedMs,1000);assert.equal(r.batch.maturesAt,159000);
 assert.throws(()=>act(r.batch,'fertilize',{now:159000}),{code:'ALREADY_MATURE'});
 const stolen=stealHarvest(r.batch,{visitorId:'v',requestedAmount:40,now:159000});assert.equal(stolen.reward.amount,20);
 assert.equal(harvestOwn(stolen.batch,{actorId:'owner',now:159000}).reward.amount,20);
});
test('invalid care, ownership, currency and time cannot alter a batch',()=>{
 const b=batch();
 for(const [extra,code] of [[{actorId:'visitor'},'NOT_OWNER'],[{coins:0},'INSUFFICIENT_COINS'],[{action:'unknown'},'INVALID_ACTION'],[{coins:NaN},'INVALID_COINS']])assert.throws(()=>act(b,'fertilize',extra),{code});
 assert.throws(()=>inspectCare({...b,care:{water:1,fertilize:false}},0),{code:'INVALID_CARE'});
 assert.throws(()=>act(b,'water',{now:-1}));assert.equal(b.maturesAt,160000);
});
