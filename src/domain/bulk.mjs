import {awardHarvestXp} from './progression.mjs';
/** Pure batch planning and atomic local transitions; production requires server transactions. */
import {GROWTH,inspectCare,applyCare} from './care.mjs';
import {createBatch,inspectBatch,harvestOwn} from './harvest.mjs';
import {RANCH_RULES,RANCH_SPECIES,validateRanchState,buyBreeder} from './ranch.mjs';
import {grantHarvest,validateAtelier} from './atelier.mjs';
import {mutationValue} from './nature.mjs';
export const BULK_CROPS=Object.freeze({corn:Object.freeze({cost:8,level:1,yield:30}),watermelon:Object.freeze({cost:12,level:3,yield:40})});
export class BulkError extends Error{constructor(code){super(code);this.name='BulkError';this.code=code;}}
const fail=code=>{throw new BulkError(code);};
const int=n=>Number.isSafeInteger(n)&&n>=0;
const add=(a,b)=>{const n=a+b;if(!int(n))fail('NUMERIC_OVERFLOW');return n;};
const OWNER='local-owner';
function validate(state,action,crop,now){
 if(!state||!Array.isArray(state.plots))fail('INVALID_STATE');
 if(!int(state.coins))fail('INVALID_COINS');
 if(!int(state.level)||state.level<1)fail('INVALID_LEVEL');
 if(!int(now))fail('INVALID_TIME');
 if(!['plant','harvest','water','fertilize','buySheep'].includes(action))fail('INVALID_ACTION');
 if(action==='plant'&&!Object.hasOwn(BULK_CROPS,crop))fail('INVALID_CROP');
 for(const plot of state.plots){
  if(!plot||typeof plot!=='object')fail('INVALID_PLOT');
  if(plot.batch){inspectCare(plot.batch,now);if(plot.crop!==plot.batch.productId||!Object.hasOwn(BULK_CROPS,plot.crop)||plot.batch.kind!=='crop')fail('INVALID_PLOT');}
  else if(plot.crop!=null)fail('INVALID_PLOT');
 }
 if(action==='buySheep')validateRanchState(state.ranch);
 if(action==='harvest')validateAtelier(state.atelier);
}
export function planBulk(state,{action,crop='corn',now}){
 validate(state,action,crop,now);
 const total=action==='buySheep'?RANCH_RULES.capacity:state.plots.length;
 const candidates=[];
 if(action==='buySheep'){
  if(state.ranch.speciesId===null||state.ranch.speciesId==='sheep')for(let i=state.ranch.animals.length;i<total;i++)candidates.push({index:i,cost:RANCH_SPECIES.sheep.buy,income:0});
 }else for(let index=0;index<state.plots.length;index++){
  const p=state.plots[index],batch=p.batch;
  if(p.unlocked===false)continue;
  if(action==='plant'){
   if(!batch&&state.level>=BULK_CROPS[crop].level)candidates.push({index,cost:BULK_CROPS[crop].cost,income:0});
  }else if(batch&&batch.ownerId===OWNER){
   const view=inspectBatch(batch,now);
   if(action==='harvest'&&view.mature&&!view.collected)candidates.push({index,cost:0,income:mutationValue(view.remaining,batch.mutation)});
   if(['water','fertilize'].includes(action)){
    const care=inspectCare(batch,now);
    if(!care.mature&&!care.closed&&!care[action])candidates.push({index,cost:action==='water'?0:care.config.cost,income:0});
   }
  }
 }
 let cost=0,income=0;const indices=[];
 for(const c of candidates){if(c.cost>state.coins-cost)break;cost=add(cost,c.cost);income=add(income,c.income);indices.push(c.index);}
 add(state.coins-cost,income);
 if(action==='plant'&&indices.length)add(now,GROWTH[crop].durationMs);
 return Object.freeze({count:indices.length,cost,income,eligible:candidates.length,skipped:total-indices.length,indices:Object.freeze(indices)});
}
export function runBulk(state,{action,crop='corn',now,random=Math.random}){
 const plan=planBulk(state,{action,crop,now});
 if(!plan.count)return Object.freeze({...plan,state});
 let next={...state,plots:state.plots.map(p=>({...p}))},coins=state.coins;
 for(const index of plan.indices){
  const p=next.plots[index];
  if(action==='buySheep'){
   const result=buyBreeder(next.ranch,{speciesId:'sheep',level:state.level,coins,now,random});next.ranch=result.ranch;coins=result.coins;
  }else if(action==='plant'){
   const config=BULK_CROPS[crop];coins-=config.cost;
   const batch=Object.freeze({...createBatch({batchId:`plot-${index}-${now}`,ownerId:OWNER,productId:crop,kind:'crop',initialYield:config.yield,maturesAt:add(now,GROWTH[crop].durationMs)}),startedAt:now});
   next.plots[index]=({...p,crop,batch});
  }else if(action==='harvest'){
   const result=harvestOwn(p.batch,{actorId:OWNER,now});coins=add(coins,mutationValue(result.reward.amount,result.reward.mutation));
   next=awardHarvestXp(next,p.crop);next.atelier=grantHarvest(next.atelier,{crop:p.crop,now});next.plots[index]=({...p,crop:null,batch:null});
  }else{
   const result=applyCare(p.batch,{action,actorId:OWNER,coins,now,random});coins=result.coins;next.plots[index]=({...p,batch:result.batch});
  }
 }
 next={...next,coins};
 return Object.freeze({...plan,state:next});
}
