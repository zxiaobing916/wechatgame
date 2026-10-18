// Reproducible greedy-bot smoke benchmark, NOT an estimate of human win rate.
import {createBasket,startBasket,pickBasket,availableItems,itemsFor} from '../src/domain/daily-basket.mjs';
let wins=0;
for(let run=0;run<100;run++){
 let state=startBasket(createBasket(1800000000000+(run%10)*86400000)),seed=run+1;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const byId=new Map(itemsFor(state).map(i=>[i.id,i]));
 while(state.status==='playing'){
  const choices=availableItems(state),held={},top={};
  for(const id of state.tray){const type=byId.get(id).type;held[type]=(held[type]||0)+1;}
  for(const item of choices)top[item.type]=(top[item.type]||0)+1;
  const pick=choices.map(item=>({item,score:(held[item.type]||0)*10+top[item.type]+random()})).sort((a,b)=>b.score-a.score)[0].item;
  state=pickBasket(state,{itemId:pick.id});
 }
 wins+=Number(state.status==='won');
}
console.log(JSON.stringify({strategy:'greedy-triple-first',trials:100,days:10,wins,humanWinRate:false}));
