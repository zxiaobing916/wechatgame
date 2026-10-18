import test from 'node:test';
import assert from 'node:assert/strict';
import {createBasket,startBasket,pickBasket,availableItems,dailyBoard,validateBasket,advanceDay,dayAt,rewardFor,reviveBasket,claimBasketReward,migrateBasket} from '../src/domain/daily-basket.mjs';
import {createAtelier} from '../src/domain/atelier.mjs';
import {createRanchState,buyBreeder} from '../src/domain/ranch.mjs';
const now=1800000000000,DAY=86400000;
const win=(s=startBasket(createBasket(now)))=>dailyBoard(s.day).solution.reduce((s,itemId)=>pickBasket(s,{itemId}),s);
function lose(s=startBasket(createBasket(now))){while(s.status==='playing'){const counts={};for(const id of s.tray){const type=dailyBoard(s.day).items.find(i=>i.id===id).type;counts[type]=(counts[type]||0)+1;}const choices=availableItems(s).sort((a,b)=>(counts[a.type]||0)-(counts[b.type]||0));s=pickBasket(s,{itemId:choices[0].id});}return s;}
test('30 daily hard boards each contain 108 objects and a legal ad-free solution',()=>{
 const signatures=new Set();
 for(let day=0;day<30;day++){
  const s=startBasket(createBasket(now+day*DAY)),board=dailyBoard(s.day);
  assert.equal(board.items.length,108);assert.equal(new Set(board.items.map(i=>i.x)).size,108);
  assert.ok(board.items.every(i=>i.stack===undefined&&Number.isFinite(i.pitch)));
  const result=win(s);assert.equal(result.status,'won');assert.equal(result.revives,0);validateBasket(result);
  signatures.add(JSON.stringify(board.items));
 }
 assert.equal(signatures.size,30);
});
test('bad choices lose; retry keeps today layout, ad cancellation does not revive, revive rewinds three moves once',()=>{
 const lost=lose();assert.equal(lost.status,'lost');
 const json=JSON.stringify(lost);assert.throws(()=>reviveBasket(lost,{completed:false}),/AD_NOT_COMPLETED/);assert.equal(JSON.stringify(lost),json);
 const back=reviveBasket(JSON.parse(json),{completed:true});
 assert.equal(back.status,'playing');assert.equal(back.moves,lost.moves-3);assert.equal(back.revives,1);assert.equal(back.attempts,lost.attempts);
 validateBasket(back);assert.throws(()=>reviveBasket(back,{completed:true}),/NOT_LOST/);
 const secondLost=lose(back),second=reviveBasket(secondLost,{completed:true}),thirdLost=lose(second);
 assert.equal(second.revives,2);assert.throws(()=>reviveBasket(thirdLost,{completed:true}),/REVIVE_LIMIT/);
 const retry=startBasket(thirdLost);assert.deepEqual(retry.remaining,createBasket(now).remaining);assert.equal(retry.revives,0);assert.equal(retry.attempts,lost.attempts+1);
});
test('China midnight changes board/reward; earned reward survives rollover and grants only once',()=>{
 const s=win(),ranch=createRanchState(),atelier=createAtelier(now);
 const boundary=(s.day+1)*DAY-8*3600000;
 assert.equal(advanceDay(s,boundary-1),s);
 const next=advanceDay(s,boundary);assert.equal(next.day,s.day+1);assert.equal(next.status,'ready');assert.equal(next.pending.length,1);
 assert.notDeepEqual(rewardFor(next.day),rewardFor(s.day));
 const got=claimBasketReward(next,ranch,{now:boundary,atelier});const reward=rewardFor(s.day);
 assert.equal(got.atelier.materials[reward.key],atelier.materials[reward.key]+reward.amount);
 assert.equal(got.basket.pending.length,0);assert.throws(()=>claimBasketReward(got.basket,ranch,{now,atelier:got.atelier}),/REWARD_LOCKED/);
 assert.equal(advanceDay(next,now),next);
 const afterWin=win(startBasket(next));assert.equal(afterWin.pending.length,2);
});
test('repeat victory has no duplicate reward and legacy moon entitlement stays claimable',()=>{
 const victory=win();const repeat=win(startBasket(victory));assert.equal(repeat.pending.length,1);assert.equal(repeat.wins,2);
 const legacy={version:1,remaining:[],tray:[],status:'won',attempts:1,moves:36,wonOnce:true,claimed:false,wins:1};
 const migrated=migrateBasket(legacy,now);assert.deepEqual(migrated.pending,[{day:'legacy'}]);
 const result=claimBasketReward(migrated,createRanchState(),{now,atelier:createAtelier(now)});assert.equal(result.ranch.animals[0].breed,'moon');
 assert.equal(migrateBasket(JSON.parse(JSON.stringify(result.basket)),now).pending.length,0);
 assert.equal(dayAt(now),result.basket.day);
});
test('invalid state cannot revive, claim or select hidden pieces',()=>{
 const s=startBasket(createBasket(now)),hidden=dailyBoard(s.day).items.find(i=>i.blockers.length>0);
 assert.throws(()=>pickBasket(s,{itemId:hidden.id}),/ITEM_BLOCKED/);
 assert.throws(()=>validateBasket({...s,remaining:[],tray:[],status:'won'}),/INVALID_BASKET/);
 assert.throws(()=>validateBasket({...s,pending:[{day:s.day+1}]}),/INVALID_REWARDS/);
 assert.throws(()=>claimBasketReward(s,createRanchState(),{now,atelier:createAtelier(now)}),/REWARD_LOCKED/);
});
test('moon reward day retains a full-ranch entitlement and duplicate partner gives material',()=>{
 let time=now;while(rewardFor(dayAt(time)).key!=='moon')time+=DAY;
 const s=win(startBasket(createBasket(time))),atelier=createAtelier(time);
 let full=createRanchState();for(let i=0;i<6;i++)full=buyBreeder(full,{speciesId:'sheep',level:1,coins:60,random:()=>.9,now:time}).ranch;
 const before=JSON.stringify(s);assert.throws(()=>claimBasketReward(s,full,{now:time,atelier}),/RANCH_FULL/);assert.equal(JSON.stringify(s),before);
 const first=claimBasketReward(s,createRanchState(),{now:time,atelier});
 assert.equal(first.ranch.animals[0].breed,'moon');
 const repeatDay=win(startBasket(createBasket(time+5*DAY)));
 const second=claimBasketReward(repeatDay,first.ranch,{now:time+5*DAY,atelier});
 assert.equal(second.ranch.animals.length,1);
 assert.equal(second.atelier.materials.moonDown,atelier.materials.moonDown+2);
});
test('scattered layout has varied poses, safe packing bounds and no colliding bounding spheres',()=>{
 const items=dailyBoard(dayAt(now)).items;
 assert.equal(new Set(items.map(i=>i.x)).size,108);
 assert.ok(items.some(i=>Math.abs(i.pitch)>.9));
 for(let i=0;i<items.length;i++){
  const a=items[i];assert.ok(Math.abs(a.x)+a.radius<=2.781);assert.ok(Math.abs(a.z)+a.radius<=3.481);
  assert.ok(a.y>=a.radius);
  for(const b of items.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>=a.radius+b.radius-.0001);
 }
});
test('older column save upgrades without losing already earned rewards or granting again',()=>{
 const s=win(),old={...s,layout:1};
 // Won states contain no remaining objects and are valid across both layouts.
 const upgraded=migrateBasket(old,now);
 assert.equal(upgraded.layout,3);assert.equal(upgraded.status,'playing');
 assert.equal(upgraded.wonOnce,true);assert.deepEqual(upgraded.pending,s.pending);
 assert.equal(win(upgraded).pending.length,1);
});

test('timer expires at ten minutes, survives reload and prevents picking after expiry',async()=>{
 const {expireBasket}=await import('../src/domain/daily-basket.mjs');
 const s=startBasket(createBasket(now),now);
 assert.equal(s.deadline,now+600000);
 assert.equal(expireBasket(s,now+599999).status,'playing');
 const lost=expireBasket(JSON.parse(JSON.stringify(s)),now+600000);
 assert.equal(lost.status,'lost');assert.equal(lost.lossReason,'time');validateBasket(lost);
 assert.throws(()=>pickBasket(s,{itemId:dailyBoard(s.day).solution[0],now:now+600000}),/BASKET_NOT_PLAYING/);
 assert.throws(()=>reviveBasket(lost,{completed:false,now:now+600000}),/AD_NOT_COMPLETED/);
 const back=reviveBasket(lost,{completed:true,now:now+700000});
 assert.equal(back.deadline,now+820000);assert.deepEqual(back.remaining,s.remaining);assert.equal(back.revives,1);
 assert.equal(startBasket(lost,now+900000).deadline,now+1500000);
});

test('ray-exposed lower pieces may be removed, saved and replayed by revival',()=>{
 let s=startBasket(createBasket(now));
 const lower=dailyBoard(s.day).items.find(i=>i.blockers.length>0);
 assert.throws(()=>pickBasket(s,{itemId:lower.id}),/ITEM_BLOCKED/);
 s=pickBasket(s,{itemId:lower.id,exposed:true});validateBasket(JSON.parse(JSON.stringify(s)));
 while(s.status==='playing'){
  const items=dailyBoard(s.day).items,counts={};for(const id of s.tray){const type=items.find(i=>i.id===id).type;counts[type]=(counts[type]||0)+1;}
  const candidates=items.filter(i=>s.remaining.includes(i.id)).sort((a,b)=>(counts[a.type]||0)-(counts[b.type]||0));
  s=pickBasket(s,{itemId:candidates[0].id,exposed:true});
 }
 const revived=reviveBasket(s,{completed:true});validateBasket(revived);assert.equal(revived.moves,s.moves-3);
});
