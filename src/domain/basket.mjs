/** Authored, deterministic prototype puzzle. Production rewards require server validation. */
import {buyBreeder, validateRanchState} from './ranch.mjs';
export const BASKET_TYPES = Object.freeze(Object.fromEntries([
  ['flower','花朵','#edb4ca'],['pear','梨','#e3d58b'],['thread','线团','#b6a3d3'],
  ['shell','贝壳','#f2cfb5'],['berry','莓果','#ce8198'],['leaf','叶片','#98bca0'],
].map(([key,name,color])=>[key,Object.freeze({name,color})])));
// Each row is one physical stack, bottom to top. Positions remain fixed across retries.
const stacks = [
 ['flower','pear','thread'],['shell','berry','leaf'],['thread','flower','pear'],['leaf','shell','berry'],
 ['pear','thread','flower'],['berry','leaf','shell'],['flower','shell','leaf'],['pear','berry','thread'],
 ['thread','leaf','flower'],['shell','flower','pear'],['berry','pear','shell'],['leaf','thread','berry'],
];
export const BASKET_ITEMS = Object.freeze(stacks.flatMap((types,stack)=>types.map((type,layer)=>Object.freeze({
 id:`basket-${stack*3+layer}`,type,stack,layer,x:(stack%4-1.5)*.86,z:(Math.floor(stack/4)-1)*.9,y:.25+layer*.35,
}))));
const byId = new Map(BASKET_ITEMS.map(item=>[item.id,item]));
const integer = n=>Number.isSafeInteger(n)&&n>=0;
const fail = code=>{const error=new Error(code);error.code=code;throw error;};
const freeze = s=>Object.freeze({...s,remaining:Object.freeze([...s.remaining]),tray:Object.freeze([...s.tray])});
export function createBasket(){return freeze({version:1,remaining:BASKET_ITEMS.map(i=>i.id),tray:[],status:'ready',attempts:0,moves:0,wonOnce:false,claimed:false,wins:0});}
export function validateBasket(state){
 if(!state||state.version!==1||!Array.isArray(state.remaining)||!Array.isArray(state.tray)||!['ready','playing','lost','won'].includes(state.status)
 ||![state.attempts,state.moves,state.wins].every(integer)||typeof state.wonOnce!=='boolean'||typeof state.claimed!=='boolean')fail('INVALID_BASKET');
 const active=[...state.remaining,...state.tray];
 if(active.some(id=>!byId.has(id))||new Set(active).size!==active.length||state.tray.length>7||state.moves!==36-state.remaining.length)fail('INVALID_BASKET');
 for(const type of Object.keys(BASKET_TYPES)){
  if((6-active.filter(id=>byId.get(id).type===type).length)%3!==0||state.tray.filter(id=>byId.get(id).type===type).length>2)fail('INVALID_BASKET');
 }
 const remaining = new Set(state.remaining);
 for(const item of BASKET_ITEMS)if(remaining.has(item.id)&&BASKET_ITEMS.some(upper=>upper.stack===item.stack&&upper.layer<item.layer&&!remaining.has(upper.id)))fail('INVALID_BASKET');
 if(state.wonOnce!==(state.wins>0)||state.wins>state.attempts||(state.claimed&&!state.wonOnce))fail('INVALID_BASKET');
 if(state.status==='ready'&&(state.moves||state.attempts||state.wins||state.claimed))fail('INVALID_BASKET');
 if(state.status!=='ready'&&!state.attempts)fail('INVALID_BASKET');
 if(state.status==='won'&&(active.length||!state.wonOnce||state.moves!==36))fail('INVALID_BASKET');
 if(state.status==='lost'&&(state.tray.length!==7||state.wins>=state.attempts))fail('INVALID_BASKET');
 if(state.status==='playing'&&(state.tray.length>=7||!active.length||state.wins>=state.attempts))fail('INVALID_BASKET');
 return true;
}
export function startBasket(state){validateBasket(state);if(state.attempts===Number.MAX_SAFE_INTEGER)fail('NUMERIC_OVERFLOW');return freeze({...createBasket(),attempts:state.attempts+1,status:'playing',wonOnce:state.wonOnce,claimed:state.claimed,wins:state.wins});}
export function availableItems(state){validateBasket(state);const ids=new Set(state.remaining);return BASKET_ITEMS.filter(item=>ids.has(item.id)&&!BASKET_ITEMS.some(above=>above.stack===item.stack&&above.layer>item.layer&&ids.has(above.id)));}
export function pickBasket(state,{itemId}){
 validateBasket(state);if(state.status!=='playing')fail('BASKET_NOT_PLAYING');
 if(!availableItems(state).some(i=>i.id===itemId))fail('ITEM_BLOCKED');
 const remaining=state.remaining.filter(id=>id!==itemId);let tray=[...state.tray,itemId];
 const type=byId.get(itemId).type;
 if(tray.filter(id=>byId.get(id).type===type).length===3)tray=tray.filter(id=>byId.get(id).type!==type);
 const won=!remaining.length&&!tray.length;
 return freeze({...state,remaining,tray,moves:state.moves+1,status:won?'won':tray.length===7?'lost':'playing',wonOnce:state.wonOnce||won,wins:state.wins+(won?1:0)});
}
export function claimBasketReward(state,ranch,{now}){
 validateBasket(state);validateRanchState(ranch);
 if(!state.wonOnce)fail('REWARD_LOCKED');if(state.claimed)fail('REWARD_CLAIMED');
 if(ranch.animals.some(a=>a.breed==='moon'))fail('REWARD_CLAIMED');
 const result=buyBreeder(ranch,{speciesId:'sheep',level:1,coins:60,random:()=>.99,now});
 const animals=Object.freeze(result.ranch.animals.map(a=>a.id===result.animal.id?Object.freeze({...a,breed:'moon',collection:true}):a));
 const nextRanch=Object.freeze({...result.ranch,animals});validateRanchState(nextRanch);
 return Object.freeze({basket:freeze({...state,claimed:true}),ranch:nextRanch});
}
