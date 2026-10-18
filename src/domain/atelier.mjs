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
const exactKeys = (value, keys) => obj(value) && Object.keys(value).sort().join()===keys.slice().sort().join();
function freeze(a){return Object.freeze({version:2,materials:Object.freeze({...a.materials}),owned:Object.freeze([...a.owned]),equipped:a.equipped});}
export function createAtelier(now=Date.now()){time(now);return freeze({materials:Object.fromEntries(Object.keys(MATERIALS).map(k=>[k,0])),owned:[],equipped:null});}
function validatePossessions(a){
 if(!obj(a)||!exactKeys(a.materials,Object.keys(MATERIALS))||!Object.values(a.materials).every(int)||!Array.isArray(a.owned)||new Set(a.owned).size!==a.owned.length||!a.owned.every(k=>has(SKINS,k))||(a.equipped!==null&&!a.owned.includes(a.equipped)))fail('INVALID_ATELIER');
}
export function validateAtelier(a){
 validatePossessions(a);
 if(a.version!==2||!exactKeys(a,['version','materials','owned','equipped']))fail('INVALID_ATELIER');
 return true;
}
export function migrateAtelier(a){
 if(a?.version===2){validateAtelier(a);return freeze(a);}
 validatePossessions(a);
 if(a.version!==1||!exactKeys(a,['version','materials','tickets','owned','equipped','pity','history','daily'])||!int(a.tickets)||!int(a.pity)||a.pity>9||!Array.isArray(a.history)||a.history.length>20)fail('INVALID_ATELIER');
 const d=a.daily;
 if(!exactKeys(d,['day','harvest','groom','harvestClaimed','groomClaimed'])||!int(d.day)||!int(d.harvest)||!int(d.groom)||typeof d.harvestClaimed!=='boolean'||typeof d.groomClaimed!=='boolean')fail('INVALID_ATELIER');
 for(const r of a.history){
  if(!obj(r)||!['materials','skin'].includes(r.type)||!exactKeys(r,r.type==='skin'?['type','skinId','label','materials','duplicate','pity']:['type','label','materials','duplicate','pity'])||typeof r.label!=='string'||typeof r.duplicate!=='boolean'||typeof r.pity!=='boolean'||!obj(r.materials)||!Object.entries(r.materials).every(([k,v])=>has(MATERIALS,k)&&int(v))||(r.type==='skin'&&!has(SKINS,r.skinId)))fail('INVALID_ATELIER');
 }
 const compensation=add(a.tickets,a.tickets);
 return freeze({...a,materials:{...a.materials,wool:add(a.materials.wool,compensation)}});
}
function credit(a,amounts){const materials={...a.materials};for(const [key,n] of Object.entries(amounts))materials[key]=add(materials[key],n);return {...a,materials};}
function spend(a,cost){validateAtelier(a);for(const [k,n] of Object.entries(cost))if(a.materials[k]<n)fail('INSUFFICIENT_MATERIALS');const materials={...a.materials};for(const [k,n] of Object.entries(cost))materials[k]-=n;return {...a,materials};}
export function grantHarvest(a,{crop,now}){validateAtelier(a);time(now);if(!['corn','watermelon'].includes(crop))fail('INVALID_CROP');a=credit(a,crop==='corn'?{goldDye:2}:{roseDye:2});return freeze(a);}
export function groomAnimal(a,ranch,{animalId,now}){
 validateAtelier(a);time(now);validateRanchState(ranch);const animal=ranch.animals.find(x=>x.id===animalId);if(!animal||ranch.speciesId!=='sheep')fail('INVALID_ANIMAL');
 if(animal.groomReadyAt!==undefined&&!int(animal.groomReadyAt))fail('INVALID_GROOM_TIME');
 const elapsed=ranch.growthAt===null?0:Math.max(0,now-ranch.growthAt);
 if(animal.growthMs+elapsed<RANCH_RULES.growthMs)fail('ANIMAL_IMMATURE');
 if(now<(animal.groomReadyAt??0))fail('GROOM_COOLDOWN');
 const groomReadyAt=add(now,GROOM_COOLDOWN_MS),material=animal.breed==='moon'?'moonDown':'wool',materials={[material]:2};a=credit(a,materials);
 const updated=Object.freeze({...ranch,animals:Object.freeze(ranch.animals.map(x=>Object.freeze(x.id===animalId?{...x,groomReadyAt}:{...x})))});
 return {atelier:freeze(a),ranch:updated,reward:Object.freeze({type:'materials',label:`梳理获得${MATERIALS[material].name} ×2`,materials:Object.freeze(materials)})};
}
export function craftSkin(a,{skinId}){validateAtelier(a);if(!has(SKINS,skinId))fail('INVALID_SKIN');if(a.owned.includes(skinId))fail('ALREADY_OWNED');return freeze({...spend(a,SKINS[skinId].cost),owned:[...a.owned,skinId]});}
export function equipSkin(a,{skinId}){validateAtelier(a);if(!a.owned.includes(skinId))fail('SKIN_NOT_OWNED');return freeze({...a,equipped:skinId});}
export function exchangeDown(a){return freeze(credit(spend(a,{wool:6,goldDye:2,roseDye:2}),{moonDown:1}));}
