import test from 'node:test';
import assert from 'node:assert/strict';
import {BASKET_ITEMS,createBasket,startBasket,pickBasket,availableItems,validateBasket,claimBasketReward} from '../src/domain/basket.mjs';
import {createRanchState,buyBreeder,RANCH_RULES} from '../src/domain/ranch.mjs';
const error=code=>e=>e.code===code;
const fresh=()=>startBasket(createBasket());
function solve(state,seen=new Set()){
 if(state.status==='won')return [];if(state.status!=='playing')return null;
 const key=state.remaining.join(',')+'|'+[...state.tray].sort().join(',');if(seen.has(key))return null;seen.add(key);
 for(const item of availableItems(state)){const path=solve(pickBasket(state,{itemId:item.id}),seen);if(path)return[item.id,...path];}return null;
}
const solution=solve(fresh());
const win=()=>solution.reduce((s,itemId)=>pickBasket(s,{itemId}),fresh());
test('authored basket has 36 objects, six balanced types and a legal complete solution',()=>{
 assert.equal(BASKET_ITEMS.length,36);assert.equal(new Set(BASKET_ITEMS.map(i=>i.stack)).size,12);
 assert.equal(solution.length,36);const s=win();assert.equal(s.status,'won');assert.equal(s.wins,1);assert.equal(s.moves,36);assert.equal(validateBasket(s),true);
});
test('blocked lower objects and repeated clicks cannot be selected',()=>{
 let s=fresh();assert.equal(availableItems(s).length,12);assert.throws(()=>pickBasket(s,{itemId:'basket-0'}),error('ITEM_BLOCKED'));
 s=pickBasket(s,{itemId:'basket-2'});assert.throws(()=>pickBasket(s,{itemId:'basket-2'}),error('ITEM_BLOCKED'));
 assert.throws(()=>pickBasket(createBasket(),{itemId:'basket-2'}),error('BASKET_NOT_PLAYING'));
});
test('a seventh pick completing a triple clears before capacity checking',()=>{
 let state=fresh(),found=false;
 for(const itemId of solution){const prev=state;state=pickBasket(state,{itemId});if(prev.tray.length===6&&state.tray.length===4){found=true;assert.equal(state.status,'playing');}}
 assert.equal(found,true);
});
test('real bad choices lose at seven; retry is same layout and progress survives reload',()=>{
 let s=fresh();while(s.status==='playing'){s=pickBasket(s,{itemId:availableItems(s)[0].id});}
 assert.equal(s.status,'lost');assert.equal(s.tray.length,7);assert.throws(()=>pickBasket(s,{itemId:availableItems(s)[0].id}),error('BASKET_NOT_PLAYING'));
 const retry=startBasket(JSON.parse(JSON.stringify(s)));assert.deepEqual(retry.remaining,fresh().remaining);assert.equal(retry.attempts,2);assert.equal(retry.moves,0);
 const victory=win();const reloaded=JSON.parse(JSON.stringify(victory));assert.equal(validateBasket(reloaded),true);assert.equal(startBasket(reloaded).wonOnce,true);
});
test('reject forged empty win, duplicates, broken conservation and inaccessible removals',()=>{
 for(const state of [{...fresh(),remaining:[],tray:[],status:'won'}, {...fresh(),remaining:[...fresh().remaining,'basket-2']}, {...fresh(),remaining:fresh().remaining.slice(1),moves:1}, {...win(),wonOnce:false}, {...fresh(),tray:['unknown']}])assert.throws(()=>validateBasket(state),error('INVALID_BASKET'));
});
test('claim once grants unique female moon lamb without spending supplies, even after retry',()=>{
 const state=startBasket(win());const ranch=createRanchState();const result=claimBasketReward(state,ranch,{now:100});
 assert.equal(result.basket.claimed,true);assert.equal(result.ranch.animals.length,1);assert.equal(result.ranch.animals[0].breed,'moon');assert.equal(result.ranch.animals[0].sex,'female');assert.equal(result.ranch.animals[0].collection,true);assert.equal(result.ranch.animals[0].growthMs,0);assert.deepEqual(result.ranch.supplies,ranch.supplies);
 assert.equal(ranch.animals.length,0);assert.equal(state.claimed,false);
 assert.throws(()=>claimBasketReward(result.basket,result.ranch,{now:100}),error('REWARD_CLAIMED'));
 assert.throws(()=>claimBasketReward(state,result.ranch,{now:100}),error('REWARD_CLAIMED'));
 assert.throws(()=>claimBasketReward(fresh(),ranch,{now:100}),error('REWARD_LOCKED'));
});
test('full ranch preserves unclaimed reward and existing resident growth settles on claim',()=>{
 let ranch=createRanchState();for(let i=0;i<RANCH_RULES.capacity;i++)ranch=buyBreeder(ranch,{speciesId:'sheep',level:1,coins:60,random:()=>.99,now:0}).ranch;
 const state=win();assert.throws(()=>claimBasketReward(state,ranch,{now:100}),error('RANCH_FULL'));assert.equal(state.claimed,false);assert.equal(ranch.animals.length,RANCH_RULES.capacity);
 const single=buyBreeder(createRanchState(),{speciesId:'sheep',level:1,coins:60,random:()=>.99,now:0}).ranch;
 const result=claimBasketReward(state,single,{now:3600000});assert.equal(result.ranch.animals[0].growthMs,3600000);assert.equal(result.ranch.animals[1].growthMs,0);
});
