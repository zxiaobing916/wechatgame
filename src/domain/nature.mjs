/** Local, persisted weather and rare cosmetic/value variants. Server authority is required online. */
export const MUTATIONS = Object.freeze({
 dewdrop:Object.freeze({name:'露华',multiplier:1.5,color:'#9bdccd'}),
 lush:Object.freeze({name:'丰盈',multiplier:1.5,color:'#b6d995'}),
 frost:Object.freeze({name:'霜晶',multiplier:2,color:'#b8dff6'}),
 storm:Object.freeze({name:'雷光',multiplier:2.5,color:'#c2afe8'}),
});
export const WEATHER_SLOT_MS=1800000;
export const WEATHER_CATCHUP_SLOTS=48;
const GROWTH_MS=28800000;
const SOURCES=Object.freeze({water:[.01,'dewdrop'],feed:[.01,'lush'],fertilize:[.01,'lush'],rain:[.005,'dewdrop'],snow:[.005,'frost'],storm:[.003,'storm']});
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export function validateMutation(value){if(value!==undefined&&value!==null&&!(typeof value==='string'&&Object.hasOwn(MUTATIONS,value)))fail('INVALID_MUTATION');return true;}
export function mutationName(key){validateMutation(key);return key==null?'普通':MUTATIONS[key].name;}
export function mutationValue(base,mutation){
 if(!integer(base))fail('INVALID_VALUE');validateMutation(mutation);
 const value=Math.floor(base*(mutation==null?1:MUTATIONS[mutation].multiplier));
 if(!integer(value))fail('NUMERIC_OVERFLOW');return value;
}
function draw(random){if(typeof random!=='function')fail('INVALID_RANDOM');const n=random();if(!Number.isFinite(n)||n<0||n>=1)fail('INVALID_RANDOM');return n;}
export function rollMutation(entity,{source,random=Math.random}={}){
 if(!record(entity))fail('INVALID_ENTITY');validateMutation(entity.mutation);
 if(typeof source!=='string'||!Object.hasOwn(SOURCES,source))fail('INVALID_SOURCE');
 if(entity.mutation!=null)return entity;
 const [chance,key]=SOURCES[source];return draw(random)<chance?{...entity,mutation:key}:entity;
}
// FNV-1a plus avalanche; independent streams keep weather and entity results stable.
function hash(text){let x=2166136261;for(let i=0;i<text.length;i++){x^=text.charCodeAt(i);x=Math.imul(x,16777619);}x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return (x^(x>>>16))>>>0;}
function validSeed(seed){if(!integer(seed)||seed>0xffffffff)fail('INVALID_SEED');}
export function weatherType(seed,slot){validSeed(seed);if(!integer(slot))fail('INVALID_SLOT');const p=hash(`weather:${seed}:${slot}`)/4294967296;return p<.55?'clear':p<.8?'rain':p<.95?'snow':'storm';}
export function createNature(now,random=Math.random){if(!integer(now))fail('INVALID_TIME');const seed=Math.floor(draw(random)*4294967296),slot=Math.floor(now/WEATHER_SLOT_MS);return {version:1,seed,slot,type:weatherType(seed,slot)};}
function validateNature(n){if(!record(n)||n.version!==1||!integer(n.slot))fail('INVALID_NATURE');validSeed(n.seed);if(n.type!==weatherType(n.seed,n.slot))fail('INVALID_NATURE');}
/** Each growing entity gets at most one deterministic roll per weather boundary, never per frame. */
export function advanceNature(state,now){
 if(!record(state)||!Array.isArray(state.plots)||!record(state.ranch)||!Array.isArray(state.ranch.animals))fail('INVALID_STATE');
 if(!integer(now))fail('INVALID_TIME');
 const nature=state.nature??createNature(now);validateNature(nature);
 const target=Math.max(nature.slot,Math.floor(now/WEATHER_SLOT_MS));
 const first=Math.max(nature.slot+1,target-WEATHER_CATCHUP_SLOTS+1);
 function update(entity,id,eligible){
  if(!record(entity))fail('INVALID_ENTITY');validateMutation(entity.mutation);
  if(entity.weatherSlot!==undefined&&!integer(entity.weatherSlot))fail('INVALID_SLOT');
  // Legacy/new untagged entities receive no retrospective weather exposure.
  const previous=entity.weatherSlot??target;
  if(previous>target)fail('INVALID_SLOT');
  let result=entity;
  for(let slot=Math.max(first,previous+1);slot<=target;slot++){
   const eventTime=slot*WEATHER_SLOT_MS;
   if(!Number.isSafeInteger(eventTime))fail('NUMERIC_OVERFLOW');
   const type=weatherType(nature.seed,slot);
   if(type!=='clear'&&eligible(eventTime))result=rollMutation(result,{source:type,random:()=>hash(`mutation:${nature.seed}:${id}:${slot}`)/4294967296});
  }
  return previous===target&&entity.weatherSlot!==undefined?result:{...result,weatherSlot:target};
 }
 const batchEligible=batch=>{if(!integer(batch.maturesAt))fail('INVALID_ENTITY');if(batch.startedAt!==undefined&&!integer(batch.startedAt))fail('INVALID_ENTITY');return time=>!batch.collected&&batch.maturesAt>time&&(batch.startedAt===undefined||batch.startedAt<=time);};
 const plots=state.plots.map((plot,index)=>{if(!record(plot))fail('INVALID_ENTITY');if(!plot.batch)return plot;const batch=update(plot.batch,`plot:${plot.id??index}:${plot.batch.id??plot.batch.startedAt??''}`,batchEligible(plot.batch));return batch===plot.batch?plot:{...plot,batch};});
 const animals=state.ranch.animals.map(animal=>{
  if(!record(animal)||typeof animal.id!=='string'||!animal.id||!integer(animal.growthMs)||animal.growthMs>GROWTH_MS)fail('INVALID_ENTITY');
  const growthAt=state.ranch.growthAt;if(growthAt!=null&&!integer(growthAt))fail('INVALID_TIME');
  return update(animal,`animal:${animal.id}`,time=>animal.growthMs+Math.max(0,time-(growthAt??time))<GROWTH_MS);
 });
 const oldBatch=state.ranch.batch;
 const batch=oldBatch?update(oldBatch,`offspring:${oldBatch.id??state.ranch.cycle??''}`,batchEligible(oldBatch)):oldBatch;
 const nextNature=target===nature.slot?nature:{...nature,slot:target,type:weatherType(nature.seed,target)};
 const samePlots=plots.every((p,i)=>p===state.plots[i]),sameAnimals=animals.every((a,i)=>a===state.ranch.animals[i]);
 if(state.nature===nextNature&&samePlots&&sameAnimals&&batch===oldBatch)return state;
 return {...state,nature:nextNature,plots:samePlots?state.plots:plots,ranch:sameAnimals&&batch===oldBatch?state.ranch:{...state.ranch,animals:sameAnimals?state.ranch.animals:animals,batch}};
}
