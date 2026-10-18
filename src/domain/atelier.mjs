import {validateRanchState, RANCH_RULES} from './ranch.mjs';
export const MATERIALS = Object.freeze({wool:Object.freeze({name:'羊毛'}),goldDye:Object.freeze({name:'金盏染料'}),roseDye:Object.freeze({name:'蔷薇染料'}),moonDown:Object.freeze({name:'月光绒'})});
const skin = (name,garment,outfit,cost) => Object.freeze({name,garment,outfit,cost:Object.freeze(cost)});
export const SKINS = Object.freeze({dawn:skin('晨露花裙','garden','rose',{wool:4,goldDye:2,roseDye:2}),moon:skin('月羽礼服','court','lilac',{wool:6,moonDown:2,roseDye:3}),forest:skin('林间游侠','ranger','sage',{wool:6,goldDye:3})});
export const GROOM_COOLDOWN_MS = 4*60*60*1000;
export class AtelierError extends Error { constructor(code){super(code);this.name='AtelierError';this.code=code;} }
const fail = code => {throw new AtelierError(code);};
const int = x => Number.isSafeInteger(x) && x>=0;
const obj = x => x!==null && typeof x==='object' && !Array.isArray(x);
const time = now => {if(!int(now))fail('INVALID_TIME');return now;};
const add = (a,b) => {const n=a+b;if(!int(n))fail('NUMERIC_OVERFLOW');return n;};
const has = (map,key) => typeof key==='string' && Object.hasOwn(map,key);
function freeze(a){return Object.freeze({...a,materials:Object.freeze({...a.materials}),owned:Object.freeze([...a.owned]),daily:Object.freeze({...a.daily}),history:Object.freeze(a.history.map(r=>Object.freeze({...r,materials:Object.freeze({...r.materials})})))});}
export function createAtelier(now=Date.now()){return freeze({version:1,materials:Object.fromEntries(Object.keys(MATERIALS).map(k=>[k,0])),tickets:3,owned:[],equipped:null,pity:0,history:[],daily:{day:Math.floor(time(now)/86400000),harvest:0,groom:0,harvestClaimed:false,groomClaimed:false}});}
export function validateAtelier(a){
 if(!obj(a)||a.version!==1||!obj(a.materials)||Object.keys(a.materials).sort().join()!==Object.keys(MATERIALS).sort().join()||!Object.values(a.materials).every(int)||!int(a.tickets)||!int(a.pity)||a.pity>9||!Array.isArray(a.owned)||new Set(a.owned).size!==a.owned.length||!a.owned.every(k=>has(SKINS,k))||(a.equipped!==null&&!a.owned.includes(a.equipped))||!Array.isArray(a.history)||a.history.length>20)fail('INVALID_ATELIER');
 const d=a.daily;if(!obj(d)||!int(d.day)||!int(d.harvest)||!int(d.groom)||typeof d.harvestClaimed!=='boolean'||typeof d.groomClaimed!=='boolean')fail('INVALID_ATELIER');
 for(const r of a.history)if(!obj(r)||!['materials','skin'].includes(r.type)||typeof r.label!=='string'||typeof r.duplicate!=='boolean'||typeof r.pity!=='boolean'||!obj(r.materials)||!Object.entries(r.materials).every(([k,v])=>has(MATERIALS,k)&&int(v))||(r.type==='skin'&&!has(SKINS,r.skinId)))fail('INVALID_ATELIER');
 return true;
}
function daily(a,now){validateAtelier(a);const day=Math.floor(time(now)/86400000);return day>a.daily.day?{...a,daily:{day,harvest:0,groom:0,harvestClaimed:false,groomClaimed:false}}:a;}
function credit(a,amounts){const materials={...a.materials};for(const [key,n] of Object.entries(amounts))materials[key]=add(materials[key],n);return {...a,materials};}
function spend(a,cost){validateAtelier(a);for(const [k,n] of Object.entries(cost))if(a.materials[k]<n)fail('INSUFFICIENT_MATERIALS');const materials={...a.materials};for(const [k,n] of Object.entries(cost))materials[k]-=n;return {...a,materials};}
export function grantHarvest(a,{crop,now}){a=daily(a,now);if(!['corn','watermelon'].includes(crop))fail('INVALID_CROP');a=credit(a,crop==='corn'?{goldDye:2}:{roseDye:2});return freeze({...a,daily:{...a.daily,harvest:add(a.daily.harvest,1)}});}
export function groomAnimal(a,ranch,{animalId,now}){
 a=daily(a,now);validateRanchState(ranch);const animal=ranch.animals.find(x=>x.id===animalId);if(!animal||ranch.speciesId!=='sheep')fail('INVALID_ANIMAL');
 if(animal.groomReadyAt!==undefined&&!int(animal.groomReadyAt))fail('INVALID_GROOM_TIME');
 const elapsed=ranch.growthAt===null?0:Math.max(0,now-ranch.growthAt);
 if(animal.growthMs+elapsed<RANCH_RULES.growthMs)fail('ANIMAL_IMMATURE');
 if(now<(animal.groomReadyAt??0))fail('GROOM_COOLDOWN');
 const groomReadyAt=add(now,GROOM_COOLDOWN_MS),material=animal.breed==='moon'?'moonDown':'wool',materials={[material]:2};a=credit(a,materials);
 const updated=Object.freeze({...ranch,animals:Object.freeze(ranch.animals.map(x=>Object.freeze(x.id===animalId?{...x,groomReadyAt}:{...x})))});
 return {atelier:freeze({...a,daily:{...a.daily,groom:add(a.daily.groom,1)}}),ranch:updated,reward:Object.freeze({type:'materials',label:`梳理获得${MATERIALS[material].name} ×2`,materials:Object.freeze(materials),duplicate:false,pity:false})};
}
export function claimTicket(a,{task,now}){a=daily(a,now);if(!['harvest','groom'].includes(task))fail('INVALID_TASK');if(a.daily[`${task}Claimed`])fail('ALREADY_CLAIMED');if(a.daily[task]<(task==='harvest'?3:1))fail('TASK_INCOMPLETE');return freeze({...a,tickets:add(a.tickets,1),daily:{...a.daily,[`${task}Claimed`]:true}});}
export function craftSkin(a,{skinId}){validateAtelier(a);if(!has(SKINS,skinId))fail('INVALID_SKIN');if(a.owned.includes(skinId))fail('ALREADY_OWNED');return freeze({...spend(a,SKINS[skinId].cost),owned:[...a.owned,skinId]});}
export function equipSkin(a,{skinId}){validateAtelier(a);if(!a.owned.includes(skinId))fail('SKIN_NOT_OWNED');return freeze({...a,equipped:skinId});}
export function exchangeDown(a){return freeze(credit(spend(a,{wool:6,goldDye:2,roseDye:2}),{moonDown:1}));}
function roll(random){if(typeof random!=='function')fail('INVALID_RANDOM');const v=random();if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)fail('INVALID_RANDOM');return v;}
export function drawTicket(a,{random=Math.random}={}){
 validateAtelier(a);if(a.tickets<1)fail('NO_TICKETS');const pity=a.pity>=9;const n=pity?1:roll(random);let reward;
 if(n>=.95){const unowned=Object.keys(SKINS).filter(k=>!a.owned.includes(k));const pool=pity&&unowned.length?unowned:Object.keys(SKINS);const skinId=pool[Math.floor(roll(random)*pool.length)];const duplicate=a.owned.includes(skinId);reward={type:'skin',skinId,label:SKINS[skinId].name+(duplicate?'（重复转化为羊毛 ×8、月光绒 ×2）':''),materials:duplicate?{wool:8,moonDown:2}:{},duplicate,pity};}
 else {const [key,count]=n<.4?['wool',4]:n<.6?['goldDye',3]:n<.8?['roseDye',3]:['moonDown',1];reward={type:'materials',label:`${MATERIALS[key].name} ×${count}`,materials:{[key]:count},duplicate:false,pity:false};}
 const next=credit(a,reward.materials);return {atelier:freeze({...next,tickets:a.tickets-1,pity:reward.type==='skin'?0:a.pity+1,owned:reward.type==='skin'&&!reward.duplicate?[...a.owned,reward.skinId]:a.owned,history:[reward,...a.history].slice(0,20)}),reward:Object.freeze({...reward,materials:Object.freeze({...reward.materials})})};
}
