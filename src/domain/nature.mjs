/** Care-triggered cosmetic/value variants; legacy variants remain readable. Server authority is required online. */
export const MUTATIONS = Object.freeze({
 dewdrop:Object.freeze({name:'露华',multiplier:1.5,color:'#9bdccd'}),
 lush:Object.freeze({name:'丰盈',multiplier:1.5,color:'#b6d995'}),
 frost:Object.freeze({name:'霜晶',multiplier:2,color:'#b8dff6'}),
 storm:Object.freeze({name:'雷光',multiplier:2.5,color:'#c2afe8'}),
});
const SOURCES=Object.freeze({water:[.01,'dewdrop'],feed:[.01,'lush'],fertilize:[.01,'lush']});
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
