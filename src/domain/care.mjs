import {inspectBatch} from './harvest.mjs';

export const GROWTH = Object.freeze({
 corn:Object.freeze({durationMs:60000,water:12000,fertilize:18000,cost:2}),
 watermelon:Object.freeze({durationMs:90000,water:18000,fertilize:27000,cost:3}),
 'sheep-offspring':Object.freeze({durationMs:90000,water:18000,fertilize:27000,cost:3}),
});
export class CareError extends Error {constructor(code){super(code);this.code=code;this.name='CareError';}}
const fail=code=>{throw new CareError(code);};
export function inspectCare(batch,now){
 const view=inspectBatch(batch,now);
 const config=Object.hasOwn(GROWTH,batch.productId)?GROWTH[batch.productId]:null;
 if(!config)fail('INVALID_PRODUCT');
 const care=batch.care===undefined?{water:false,fertilize:false}:batch.care;
 if(!care||typeof care!=='object'||Array.isArray(care)||Object.keys(care).sort().join(',')!=='fertilize,water'||typeof care.water!=='boolean'||typeof care.fertilize!=='boolean')fail('INVALID_CARE');
 return Object.freeze({config,water:care.water,fertilize:care.fertilize,mature:view.mature,closed:view.collected,remainingMs:Math.max(0,batch.maturesAt-now)});
}
/** One use of each care action per batch; no yield or theft-budget changes. */
export function applyCare(batch,{action,actorId,coins,now}){
 const v=inspectCare(batch,now);
 if(actorId!==batch.ownerId)fail('NOT_OWNER');
 if(!['water','fertilize'].includes(action))fail('INVALID_ACTION');
 if(!Number.isSafeInteger(coins)||coins<0)fail('INVALID_COINS');
 if(v.closed||v.mature)fail('ALREADY_MATURE');
 if(v[action])fail('ALREADY_CARED');
 const cost=action==='water'?0:v.config.cost;
 if(coins<cost)fail('INSUFFICIENT_COINS');
 const savedMs=Math.min(v.remainingMs,v.config[action]);
 const care=Object.freeze({water:v.water,fertilize:v.fertilize,[action]:true});
 return Object.freeze({batch:Object.freeze({...batch,care,maturesAt:batch.maturesAt-savedMs}),coins:coins-cost,savedMs,cost});
}
