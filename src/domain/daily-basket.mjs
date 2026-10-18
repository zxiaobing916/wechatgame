import {BASKET_TYPES as LEGACY_TYPES,validateBasket as validateLegacy,claimBasketReward as claimLegacy} from './basket.mjs';
import {validateAtelier} from './atelier.mjs';
export const BASKET_TYPES=Object.freeze({...LEGACY_TYPES,gem:Object.freeze({name:'宝石',color:'#8cc6d5'}),button:Object.freeze({name:'纽扣',color:'#d3b786'}),bell:Object.freeze({name:'铃铛',color:'#e3c35e'})});
const DAY=86400000,OFFSET=8*3600000;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const int=n=>Number.isSafeInteger(n)&&n>=0;
export function dayAt(now=Date.now()){if(!int(now))fail('INVALID_TIME');return Math.floor((now+OFFSET)/DAY);}
const cache=new Map();
export function dailyBoard(day,layout=2){
 if(!int(day)||![1,2].includes(layout))fail('INVALID_DAY');const key=day+':'+layout;if(cache.has(key))return cache.get(key);
 let seed=(day^0x76ac8291)>>>0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const types=Object.keys(BASKET_TYPES);for(let i=types.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
 const stacks=Array.from({length:12},()=>[]),path=[];
 for(let group=0;group<12;group++){
  const [a,b,c]=[types[(group*3)%9],types[(group*3+1)%9],types[(group*3+2)%9]];
  for(const type of [a,b,a,c,b,a,b,c,c]){
   const candidates=stacks.map((s,i)=>s.length<9?i:-1).filter(i=>i>=0),stack=candidates[Math.floor(rand()*candidates.length)];
   const item={id:'daily-'+path.length,type,stack,layer:8-stacks[stack].length,x:(stack%4-1.5)*.86,z:(Math.floor(stack/4)-1)*.9};
   stacks[stack].push(item);path.push(item);
  }
 }
 let items=path;
 if(layout===2){
  const placed=[];
  for(let n=path.length-1;n>=0;n--){
   const size=.84+rand()*.14,radius=.51*size;let best=null;
   for(let candidate=0;candidate<160;candidate++){
    const x=(rand()*2-1)*(2.78-radius),z=(rand()*2-1)*(3.48-radius);
    let y=radius+(Math.hypot(x,z-.63)<.95?.54:0);
    for(const other of placed){const d=Math.hypot(x-other.x,z-other.z),r=radius+other.radius;if(d<r)y=Math.max(y,other.y+Math.sqrt(r*r-d*d)+.008);}
    if(!best||y<best.y)best={x,y,z};
   }
   placed.push({id:path[n].id,type:path[n].type,...best,size,radius,pitch:(rand()*2-1)*1.25,yaw:rand()*Math.PI*2,roll:(rand()*2-1)*.65,blockers:[]});
  }
  items=placed.reverse();
  for(let i=0;i<items.length;i++)items[i].blockers=Object.freeze(items.slice(0,i).filter(top=>Math.hypot(top.x-items[i].x,top.z-items[i].z)<top.radius+items[i].radius&&top.y>items[i].y).map(top=>top.id));
 }
 const board=Object.freeze({items:Object.freeze(items.map(Object.freeze)),solution:Object.freeze(path.map(i=>i.id))});
 if(cache.size>8)cache.clear();cache.set(key,board);return board;
}
export function itemsFor(state){return dailyBoard(state.day,state.layout??1).items;}
const rewards=[{key:'wool',amount:4,label:'柔软羊毛 ×4'},{key:'goldDye',amount:3,label:'金盏染料 ×3'},{key:'moonDown',amount:1,label:'月光绒 ×1'},{key:'roseDye',amount:3,label:'蔷薇染料 ×3'},{key:'moon',amount:1,label:'月绒羊'}];
export function rewardFor(day,ownsMoon=false){if(!int(day))fail('INVALID_DAY');const reward=rewards[day%rewards.length];return reward.key==='moon'&&ownsMoon?{key:'moonDown',amount:2,label:'月光绒 ×2'}:{...reward};}
const freeze=s=>Object.freeze({...s,remaining:Object.freeze([...s.remaining]),tray:Object.freeze([...s.tray]),pending:Object.freeze(s.pending.map(x=>Object.freeze({...x}))),history:Object.freeze([...s.history])});
export function createBasket(now=Date.now()){
 const day=dayAt(now);
 return freeze({version:2,layout:2,day,remaining:dailyBoard(day).items.map(i=>i.id),tray:[],status:'ready',attempts:0,moves:0,wonOnce:false,claimed:false,wins:0,revives:0,pending:[],history:[]});
}
export function validateBasket(s){
 if(!s||s.version!==2||![undefined,1,2].includes(s.layout)||!int(s.day)||!Array.isArray(s.remaining)||!Array.isArray(s.tray)||!Array.isArray(s.pending)||!Array.isArray(s.history)||!['ready','playing','lost','won'].includes(s.status)||![s.attempts,s.moves,s.wins,s.revives].every(int)||s.revives>2||typeof s.wonOnce!=='boolean'||typeof s.claimed!=='boolean')fail('INVALID_BASKET');
 const items=itemsFor(s),byId=new Map(items.map(i=>[i.id,i])),active=[...s.remaining,...s.tray];
 if(active.some(id=>!byId.has(id))||new Set(active).size!==active.length||s.tray.length>7||s.moves!==108-s.remaining.length)fail('INVALID_BASKET');
 for(const type of Object.keys(BASKET_TYPES))if((12-active.filter(id=>byId.get(id).type===type).length)%3!==0||s.tray.filter(id=>byId.get(id).type===type).length>2)fail('INVALID_BASKET');
 const set=new Set(s.remaining);
 if((s.layout??1)===2?items.some(i=>!set.has(i.id)&&i.blockers.some(id=>set.has(id))):items.some(i=>set.has(i.id)&&items.some(j=>j.stack===i.stack&&j.layer<i.layer&&!set.has(j.id))))fail('INVALID_BASKET');
 if(s.wonOnce!==(s.wins>0)||s.wins>s.attempts||(s.claimed&&!s.wonOnce)||s.status==='ready'&&(s.moves||s.attempts||s.wins)||s.status!=='ready'&&!s.attempts||s.status==='won'&&(active.length||!s.wonOnce)||s.status==='lost'&&s.tray.length!==7||s.status==='playing'&&(s.tray.length>=7||!active.length))fail('INVALID_BASKET');
 if(s.history.length!==s.moves||new Set(s.history).size!==s.history.length||s.history.some(id=>!byId.has(id)||set.has(id)))fail('INVALID_BASKET');
 const keys=s.pending.map(p=>p.day);
 if(new Set(keys).size!==keys.length||s.pending.some(p=>p.day!=='legacy'&&(!int(p.day)||p.day>s.day)))fail('INVALID_REWARDS');
 return true;
}
export function migrateBasket(s,now=Date.now()){
 if(!s)return createBasket(now);
 if(s.version===2){validateBasket(s);return advanceDay((s.layout??1)===1?startBasket(s):s,now);}
 validateLegacy(s);const fresh=createBasket(now);
 return freeze({...fresh,pending:s.wonOnce&&!s.claimed?[{day:'legacy'}]:[]});
}
export function advanceDay(s,now=Date.now()){
 validateBasket(s);if(dayAt(now)<=s.day)return s;
 return freeze({...createBasket(now),pending:s.pending});
}
export function startBasket(s){
 validateBasket(s);if(s.attempts>=Number.MAX_SAFE_INTEGER)fail('NUMERIC_OVERFLOW');
 return freeze({...createBasket(Math.max(0,(s.day*DAY)-OFFSET)),attempts:s.attempts+1,status:'playing',wonOnce:s.wonOnce,claimed:s.claimed,wins:s.wins,pending:s.pending});
}
export function availableItems(s){
 validateBasket(s);const ids=new Set(s.remaining),top=new Map();
 if((s.layout??1)===2)return itemsFor(s).filter(i=>ids.has(i.id)&&!i.blockers.some(id=>ids.has(id)));
 for(const item of itemsFor(s))if(ids.has(item.id)&&(!top.has(item.stack)||item.layer>top.get(item.stack).layer))top.set(item.stack,item);
 return [...top.values()];
}
export function pickBasket(s,{itemId}){
 validateBasket(s);if(s.status!=='playing')fail('BASKET_NOT_PLAYING');
 const item=availableItems(s).find(i=>i.id===itemId);if(!item)fail('ITEM_BLOCKED');
 const remaining=s.remaining.filter(id=>id!==itemId),byId=new Map(itemsFor(s).map(i=>[i.id,i]));let tray=[...s.tray,itemId];
 if(tray.filter(id=>byId.get(id).type===item.type).length===3)tray=tray.filter(id=>byId.get(id).type!==item.type);
 const won=!remaining.length&&!tray.length;
 return freeze({...s,remaining,tray,history:[...s.history,itemId],moves:s.moves+1,status:won?'won':tray.length===7?'lost':'playing',wonOnce:s.wonOnce||won,wins:s.wins+Number(won),pending:won&&!s.wonOnce?[...s.pending,{day:s.day}]:s.pending});
}
/** Local adapter receives completion only; production must verify a WeChat ad completion receipt server-side. */
export function reviveBasket(s,{completed=false}={}){
 validateBasket(s);if(s.status!=='lost')fail('NOT_LOST');if(!completed)fail('AD_NOT_COMPLETED');if(s.revives>=2)fail('REVIVE_LIMIT');
 // Replay the last three moves backwards: all removed objects return to their exact layers.
 const keep=s.history.slice(0,-3);let replay=freeze({...startBasket(s),layout:s.layout??1});
 for(const itemId of keep)replay=pickBasket(replay,{itemId});
 return freeze({...replay,attempts:s.attempts,revives:s.revives+1});
}
export function claimBasketReward(s,ranch,{now,atelier}){
 validateBasket(s);validateAtelier(atelier);const pending=s.pending[0];if(!pending)fail('REWARD_LOCKED');
 let nextRanch=ranch,nextAtelier=atelier;
 const reward=pending.day==='legacy'?{key:'moon',label:'月绒羊'}:rewardFor(pending.day,ranch.animals.some(a=>a.breed==='moon'));
 if(reward.key==='moon'){
  if(!ranch.animals.some(a=>a.breed==='moon')){
   const legacy={version:1,remaining:[],tray:[],status:'won',attempts:1,moves:36,wonOnce:true,claimed:false,wins:1};
   nextRanch=claimLegacy(legacy,ranch,{now}).ranch;
  }
 }else{
  const value=atelier.materials[reward.key]+reward.amount;if(!int(value))fail('NUMERIC_OVERFLOW');
  nextAtelier={...atelier,materials:{...atelier.materials,[reward.key]:value}};validateAtelier(nextAtelier);
 }
 return {basket:freeze({...s,pending:s.pending.slice(1),claimed:s.claimed||pending.day===s.day}),ranch:nextRanch,atelier:nextAtelier,reward:reward.label};
}
