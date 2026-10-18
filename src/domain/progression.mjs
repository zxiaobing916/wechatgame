/** Harvest XP is awarded only when an owned crop batch is collected. */
export const LEVEL_XP=Object.freeze([0,10,35,75,140,230,350,500,700]);
export const LAND_COSTS=Object.freeze([0,20,50,90,140,210,300,420,560]);
export const CROP_XP=Object.freeze({corn:10,watermelon:16});
const int=n=>Number.isSafeInteger(n)&&n>=0;
const fail=c=>{throw new Error(c);};
export function levelForXp(xp){if(!int(xp))fail('INVALID_XP');return LEVEL_XP.filter(n=>xp>=n).length;}
export function newPlots(){return Array.from({length:9},(_,id)=>({id,crop:null,batch:null,unlocked:id===0}));}
export function validateProgress(s){
 if(!s||s.progressVersion!==1||s.level!==levelForXp(s.xp)||s.plots?.length!==9)fail('INVALID_PROGRESS');
 let locked=false;
 for(const [i,p] of s.plots.entries()){
  if(p.id!==i||typeof p.unlocked!=='boolean'||(i===0&&!p.unlocked))fail('INVALID_PLOT');
  if(!p.unlocked){locked=true;if(p.batch||p.crop!==null)fail('LOCKED_CROP');}
  else if(locked||i+1>s.level)fail('INVALID_UNLOCK_ORDER');
 }
 return true;
}
export function migrateProgress(s){
 if(s.progressVersion===1){validateProgress(s);return s;}
 if(s.progressVersion!==undefined||s.level!==8||s.plots?.length!==6)fail('INVALID_LEGACY_PROGRESS');
 const next={...s,progressVersion:1,xp:LEVEL_XP[7],level:8,plots:[...s.plots.map(p=>({...p,unlocked:true})),...newPlots().slice(6)]};
 validateProgress(next);return next;
}
export function awardHarvestXp(s,crop){
 if(!Object.hasOwn(CROP_XP,crop))fail('INVALID_CROP');
 const xp=(s.xp??LEVEL_XP[Math.min(9,s.level)-1])+CROP_XP[crop];
 return {...s,xp,level:levelForXp(xp)};
}
export function unlockPlot(s,index){
 validateProgress(s);
 if(!Number.isInteger(index)||index<1||index>8)fail('INVALID_PLOT');
 if(s.plots[index].unlocked)fail('ALREADY_UNLOCKED');
 if(!s.plots[index-1].unlocked)fail('UNLOCK_PREVIOUS');
 if(s.level<index+1)fail('LEVEL_REQUIRED');
 if(!int(s.coins)||s.coins<LAND_COSTS[index])fail('INSUFFICIENT_COINS');
 return {...s,coins:s.coins-LAND_COSTS[index],plots:s.plots.map((p,i)=>i===index?{...p,unlocked:true}:p)};
}
