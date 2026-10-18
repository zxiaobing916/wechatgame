import {applyCare,inspectCare,GROWTH} from '/domain/care.mjs';
import { createBatch, inspectBatch, stealHarvest, harvestOwn } from '/domain/harvest.mjs';
import { RANCH_SPECIES, RANCH_RULES, sellAnimal, canSellAnimal, setBreedingEnabled, migrateRanchState, advanceRanch, careRanch, rehomeBreeder, createRanchState, validateRanchState, buyBreeder, harvestOffspring, stealOffspring, sellOffspring as sellOwnerOffspring, sellVisitorOffspring } from '/domain/ranch.mjs';
const $ = id => document.getElementById(id);
const KEY = 'qimeng-3d-v1';
const FACE_KEYS = ['eyeWidth','eyeHeight','eyeTilt','eyeSpace','browHeight','noseWidth','mouthWidth','faceWidth'];
const LABELS = ['眼睛长度','眼睛开合','眼尾倾斜','双眼间距','眉毛高度','鼻翼宽度','嘴唇宽度','脸部宽度'];
const GARMENTS = ['garden','court','ranger'];
const OUTFITS = ['sage','lilac','rose'];
const CROPS = { corn:{name:'玉米',cost:8,seconds:GROWTH.corn.durationMs/1000,yield:30,level:5},watermelon:{name:'西瓜',cost:12,seconds:GROWTH.watermelon.durationMs/1000,yield:40,level:8} };
const defaults = () => Object.fromEntries(FACE_KEYS.map(k=>[k,0]));
const validFace = face => face && typeof face==='object' && !Array.isArray(face) && Object.keys(face).length===FACE_KEYS.length && FACE_KEYS.every(k=>Number.isInteger(face[k])&&face[k]>=-50&&face[k]<=50);
const fresh = () => ({version:2,garment:'garden',ranch:createRanchState(),coins:200,level:8,face:defaults(),outfit:'sage',plots:Array.from({length:6},(_,id)=>({id,crop:null,batch:null}))});
function validState(s){
 if(!s||![1,2].includes(s.version)||s.level!==8||!Number.isSafeInteger(s.coins)||s.coins<0||!validFace(s.face)||!OUTFITS.includes(s.outfit)||!Array.isArray(s.plots)||s.plots.length!==6)return false;
 try{if(s.version===2){if(!GARMENTS.includes(s.garment))return false;validateRanchState(s.ranch);}return s.plots.every((p,i)=>{if(!p||p.id!==i)return false;if(p.crop===null)return p.batch===null;const c=CROPS[p.crop];if(!c||!p.batch||p.batch.productId!==p.crop||p.batch.kind!=='crop'||p.batch.ownerId!=='local-owner'||p.batch.initialYield!==c.yield||p.batch.collected)return false;inspectBatch(p.batch,Date.now());inspectCare(p.batch,Date.now());return true;});}catch{return false;}
}
let state=fresh(),initialNotice='欢迎来到你的庄园。',selected=0,world=null,mode='farm';
try {const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version===2){const legacy=parsed.ranch?.version!==5;parsed.ranch=migrateRanchState(parsed.ranch);if(legacy){initialNotice='牧场已升级：保留成长比例与公羊休息时间，改用现实时间成长和间隔照料。';try{if(!localStorage.getItem(KEY+'-before-ranch-v5'))localStorage.setItem(KEY+'-before-ranch-v5',raw);}catch{}}}if(validState(parsed)){state=parsed.version===1?{...parsed,version:2,garment:'garden',ranch:createRanchState()}:parsed;if(parsed.version===1){initialNotice='已保留旧版金币、田地与外观，牧场和衣橱现已开放。';try{if(!localStorage.getItem(KEY+'-before-v2'))localStorage.setItem(KEY+'-before-v2',raw);}catch{/* A backup quota failure must not discard the loaded save. */}}}else initialNotice='旧存档格式无法读取，已开启新的本地体验。';}}catch{initialNotice='浏览器存储不可用，本次体验可能无法保存。';}
function notice(t){$('notice').textContent=t;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{notice('本地保存失败。请允许浏览器存储，并导出捏脸码留存。');}}
function updateWorld(){world?.setPlots(state.plots,Date.now());world?.setRanch?.(state.ranch,Date.now());}
function render(){
 $('coins').textContent=state.coins;
 renderRanch();
 renderCare('crop',state.plots[selected].batch);
 state.plots.forEach((p,i)=>{const b=$(`plot-${i}`);const view=p.batch?inspectBatch(p.batch,Date.now()):null;b.classList.toggle('selected',selected===i);b.setAttribute('aria-pressed',String(selected===i));b.querySelector('small').textContent=!p.batch?'空地':view.mature?'可以收获':`${Math.ceil((p.batch.maturesAt-Date.now())/1000)} 秒`;});
 const p=state.plots[selected],c=CROPS[p.crop],v=p.batch?inspectBatch(p.batch,Date.now()):null;
 $('plotTitle').textContent=`第 ${selected+1} 块田地${c?' · '+c.name:''}`;
 $('plotInfo').textContent=v?(v.mature?`剩余 ${v.remaining} 份 · 还可被偷 ${v.stealable} 份 · 主人保底 ${v.ownerGuarantee} 份`:`生长中，约 ${Math.ceil((p.batch.maturesAt-Date.now())/1000)} 秒后成熟。`):'土地已经准备好。收获自动按每份 1 金币出售。';
 $('plant').disabled=!!p.batch||state.coins<CROPS[$('seed').value].cost;
 $('harvest').disabled=!v?.mature;
 $('mature').disabled=!v||v.mature;
 $('steal').disabled=!v?.mature||v.stealable===0;
}
function renderCare(kind,batch){
 const farm=kind==='crop',water=$(farm?'waterCrop':'waterRanch'),fertilize=$(farm?'fertilizeCrop':'fertilizeRanch');
 const v=batch?inspectCare(batch,Date.now()):null,config=v?.config??GROWTH[farm?$('seed').value:'sheep-offspring'];
 water.textContent=`${farm?'浇水':'饮水照料'} · ${v?.water?'本批已用':`免费减 ${config.water/1000} 秒`}`;
 fertilize.textContent=`${farm?'施肥':'营养饲料'} · ${v?.fertilize?'本批已用':`${config.cost} 金币减 ${config.fertilize/1000} 秒`}`;
 water.disabled=!v||v.mature||v.closed||v.water;
 fertilize.disabled=!v||v.mature||v.closed||v.fertilize||state.coins<config.cost;
 $(farm?'cropProgress':'ranchProgress').value=v?Math.max(0,Math.min(100,100*(1-v.remainingMs/config.durationMs))):0;
 $(farm?'cropCareInfo':'ranchCareInfo').textContent=`基础时长 ${config.durationMs/1000} 秒 · 两种照料每批各一次，合计最多缩短基础时间的一半。${v?.mature?'已成熟，请收获。':''}`;
}
const careErrors={ALREADY_CARED:'本批已经进行过这项照料。',ALREADY_MATURE:'已经成熟，可以直接收获。',INSUFFICIENT_COINS:'金币不足，暂时不能购买营养补给。'};
function careAction(target,action){
 if(target==='ranch'){ranchAction(()=>careRanch(state.ranch,{action:action==='water'?'water':'feed',coins:state.coins,now:Date.now()}),r=>{world?.playCare?.({target:'ranch',action});return `${action==='water'?'已补水':'已添饲料，花费 3 金币'}，照料本次有需求的羊。每只幼羊最多提前15分钟成熟，3小时后才会再次需要这项照料。`;});return;}
 const batch=target==='farm'?state.plots[selected].batch:state.ranch.batch;
 if(!batch){notice(target==='farm'?'请先播种。':'请先喂养并开始繁殖。');return;}
 try{
  const result=applyCare(batch,{action,actorId:'local-owner',coins:state.coins,now:Date.now()});
  if(target==='farm')state.plots[selected].batch=result.batch;
  else{const next={...state.ranch,batch:result.batch};validateRanchState(next);state.ranch=next;}
  state.coins=result.coins;
  world?.playCare?.({target,plotIndex:selected,action});
  notice(`${action==='water'?(target==='farm'?'浇水':'饮水照料'):(target==='farm'?'施肥':'补充营养饲料')}完成，缩短 ${(result.savedMs/1000).toFixed(1)} 秒${result.cost?`，花费 ${result.cost} 金币`:''}。${result.batch.maturesAt<=Date.now()?'现在可以收获了。':''}`);
  persist();render();updateWorld();
 }catch(e){notice(careErrors[e.code]||'本次照料未完成，请刷新后重试。');}
}
for(const [id,target,action] of [['waterCrop','farm','water'],['fertilizeCrop','farm','fertilize'],['waterRanch','ranch','water'],['fertilizeRanch','ranch','fertilize']])$(id).addEventListener('click',()=>careAction(target,action));
const duration = ms => {const n=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(n/3600),m=Math.floor(n%3600/60);return `${h?`${h}小时`:''}${m?`${m}分`:''}${n%60}秒`;};
const countItems = items => (items||[]).reduce((sum,item)=>sum+item.amount,0);
function renderRanch(){
 const ranch=state.ranch,batch=ranch.batch,v=batch?inspectBatch(batch,Date.now()):null,visitor=$('ranchVisitor').value;
 const male=ranch.animals.filter(a=>a.sex==='male').length,female=ranch.animals.length-male;
 const matureMale=ranch.animals.some(a=>a.sex==='male'&&a.growthMs>=RANCH_RULES.growthMs),readyMale=ranch.animals.some(a=>a.sex==='male'&&a.growthMs>=RANCH_RULES.growthMs&&a.restUntil<=Date.now()),matureFemale=ranch.animals.some(a=>a.sex==='female'&&a.growthMs>=RANCH_RULES.growthMs);
 $('ranchTitle').textContent=`绵羊围栏 · ${ranch.animals.length}/${RANCH_RULES.capacity} 只 · 公 ${male} / 母 ${female}`;
 const animalList=$('animalList');
 for(const card of [...animalList.children])if(!ranch.animals.some(a=>a.id===card.dataset.animalId))card.remove();
 ranch.animals.forEach((a,i)=>{
  let card=[...animalList.children].find(c=>c.dataset.animalId===a.id);
  if(!card){card=document.createElement('div');card.className='animal-card';card.dataset.animalId=a.id;card.append(document.createElement('strong'),document.createElement('p'),document.createElement('progress'),document.createElement('button'),document.createElement('small'));animalList.append(card);}
  const [title,detail,progress,button,activity]=card.children;
  const behavior=world?.debug?.sheepBehaviors?.find(r=>r.id===a.id);
  activity.textContent=behavior?`活动：${behavior.queuedFor?(behavior.queuedFor==='water'?'等待饮水空位':'等待进食空位'):({walk:'散步',rest:'趴卧休息',graze:'吃草',drink:'前往水槽或饮水',eat:'前往饲料槽或进食'}[behavior.state]||'休息')}`:'';
  title.textContent=`绵羊 ${i+1} · ${a.sex==='male'?'♂ 公':'♀ 母'}`;
  const mature=a.growthMs>=RANCH_RULES.growthMs;
  const restSeconds=a.sex==='male'?Math.max(0,Math.ceil((a.restUntil-Date.now())/1000)):0;
  detail.textContent=mature?(restSeconds?`已成熟 · 公羊配对休息 ${Math.floor(restSeconds/60)}分${String(restSeconds%60).padStart(2,'0')}秒 · 仍可照料或出售`:'已成熟 · 可出售或留作繁殖'):`成长中 · 距成熟 ${duration(RANCH_RULES.growthMs-a.growthMs)} · 离线继续成长`;
  detail.textContent+=`。${Date.now()>=a.waterReadyAt?'口渴了':`下次饮水 ${duration(a.waterReadyAt-Date.now())}`} · ${Date.now()>=a.feedReadyAt?'肚子饿了':`下次进食 ${duration(a.feedReadyAt-Date.now())}`}`;
  progress.max=RANCH_RULES.growthMs;progress.value=a.growthMs;progress.setAttribute('aria-label',`绵羊 ${i+1} 成长进度`);
  button.dataset.sellAnimal=a.id;button.textContent=mature&&!canSellAnimal(ranch,a.id)?'正在交配或孕育，暂不可出售':`出售成羊 · ${RANCH_RULES.adultSale} 金币`;button.disabled=!canSellAnimal(ranch,a.id);
 });
 $('autoBreeding').checked=ranch.breedingEnabled;
 const waterDue=ranch.animals.filter(a=>Date.now()>=a.waterReadyAt).length,feedDue=ranch.animals.filter(a=>Date.now()>=a.feedReadyAt).length;
 const nextNeed=key=>ranch.animals.length?duration(Math.min(...ranch.animals.map(a=>a[key]))-Date.now()):'';
 $('troughInfo').textContent=`口渴 ${waterDue} 只 · 饥饿 ${feedDue} 只 · 只为有需求的羊补给`;
 $('waterRanch').textContent=waterDue?`补充饮水 · ${waterDue}只 · 免费`:(ranch.animals.length?`饮水充足 · ${nextNeed('waterReadyAt')}后需要`:'补充饮水 · 先购买幼羊');
 $('fertilizeRanch').textContent=feedDue?`添加饲料 · ${feedDue}只 · ${RANCH_RULES.feedCost}金币`:(ranch.animals.length?`暂不饥饿 · ${nextNeed('feedReadyAt')}后需要`:'添加饲料 · 先购买幼羊');
 $('waterRanch').disabled=!waterDue;
 $('fertilizeRanch').disabled=!feedDue||state.coins<RANCH_RULES.feedCost;
 $('ranchCareInfo').textContent='幼羊自然成长8小时，离线继续计时。每次饮水、进食各提前15分钟成熟；每只羊每项照料间隔3小时，不累积错过的次数。未照料也会自然长大。';
 let info=!ranch.animals.length?'先购买一只绵羊，就能给它加水和添饲料。':!ranch.breedingEnabled?'自动配对已关闭，可以专心养成并出售。':!matureMale||!matureFemale?'等待成熟异性伙伴：同性羊可以一起生活，但不会进入交配期。':!readyMale?'公羊正在休息，倒计时结束后才能再次配对。':!ranch.animals.some(a=>a.sex==='male'&&a.growthMs===RANCH_RULES.growthMs&&a.restUntil<=Date.now()&&a.waterReadyAt>Date.now()&&a.feedReadyAt>Date.now())||!ranch.animals.some(a=>a.sex==='female'&&a.growthMs===RANCH_RULES.growthMs&&a.waterReadyAt>Date.now()&&a.feedReadyAt>Date.now())?'成熟公母羊需要先完成饮水和进食，再自动配对。':'条件齐备，正在准备自动配对。';
 let progress=0;
 if(ranch.pairing){const left=Math.max(0,ranch.pairing.endsAt-Date.now());info=`交配期 · 还剩 ${Math.ceil(left/1000)} 秒 · 本次受孕概率 ${Math.round(RANCH_RULES.successChance*100)}%`;progress=100*(1-left/RANCH_RULES.matingMs);}
 else if(v){info=v.mature?`幼崽可收获 ${v.remaining} 只 · 还可被偷 ${v.stealable} 只 · 主人保底 ${v.ownerGuarantee} 只`:`孕育中 · ${duration(batch.maturesAt-Date.now())}后可收获`;progress=100*(1-Math.max(0,batch.maturesAt-Date.now())/RANCH_RULES.gestationMs);}
 if(ranch.lastOutcome==='failed'&&!v)info='上次未受孕。'+info;
 $('ranchInfo').textContent=info;$('ranchProgress').value=Math.max(0,Math.min(100,progress));
 $('pairRules').textContent=`每次一对公母自动尝试：交配 ${RANCH_RULES.matingMs/1000} 秒，受孕概率 ${Math.round(RANCH_RULES.successChance*100)}%；成功后孕育 ${duration(RANCH_RULES.gestationMs)}、产出 4 只幼崽；每次交配结束后，公羊休息 ${RANCH_RULES.maleRestMs/60000} 分钟，成功失败都一样。`;
 $('buyBreeder').disabled=ranch.animals.length>=RANCH_RULES.capacity||state.coins<60;
 $('harvestOffspring').disabled=!v?.mature;
 $('stealOffspring').disabled=!v?.mature||v.stealable===0||batch.visitors.includes(visitor);
 $('ownerInventory').textContent=`主人仓库：${countItems(ranch.inventory)} 只幼崽 · 每只出售 18 金币`;
 $('sellOffspring').disabled=countItems(ranch.inventory)===0;
 $('visitorInventory').textContent=`访客仓库：${countItems(ranch.visitorInventory[visitor])} 只 · 访客金币：${ranch.visitorCoins[visitor]||0}`;
 $('sellVisitorOffspring').disabled=countItems(ranch.visitorInventory[visitor])===0;
 const selectedAnimal=$('rehomeAnimal').value;
 $('rehomeAnimal').replaceChildren(...ranch.animals.map((a,i)=>{const o=document.createElement('option');o.value=a.id;o.textContent=`绵羊 ${i+1} · ${a.sex==='male'?'公':'母'}${a.growthMs>=RANCH_RULES.growthMs?' · 已成熟':''}`;return o;}));
 if(ranch.animals.some(a=>a.id===selectedAnimal))$('rehomeAnimal').value=selectedAnimal;
 $('rehomeBreeder').disabled=!ranch.animals.length||!!ranch.pairing||!!batch||ranch.animals.find(a=>a.id===$('rehomeAnimal').value)?.growthMs>=RANCH_RULES.growthMs;
}
function tickRanch(){
 try{const result=advanceRanch(state.ranch,{now:Date.now()});if(result.changed){state.ranch=result.ranch;persist();if(result.event==='success')notice('配对成功，已进入孕育期。');if(result.event==='failed')notice(`本次没有受孕。公羊休息 ${RANCH_RULES.maleRestMs/60000} 分钟后才能再次配对，不会自动扣金币。`);}}
 catch(e){console.error('Ranch progression failed',e);notice('牧场计时暂时无法更新，请刷新重试。');}
}
for(const [id,c] of Object.entries(RANCH_SPECIES)){const card=document.createElement('div');card.className='species-card'+(c.available?'':' locked');card.dataset.species=id;const name=document.createElement('strong');name.textContent=c.name;const detail=document.createElement('small');detail.textContent=c.available?`已开放 · 每只 60 金币 · 公 ${Math.round(RANCH_RULES.maleChance*100)}% / 母 ${Math.round((1-RANCH_RULES.maleChance)*100)}%`:`等级 ${c.level} 解锁 · 当前体验等级 ${state.level} · 此样板暂未开放`;card.append(name,detail);$('speciesCards').append(card);}
const ranchErrors={CARE_NOT_DUE:'羊还不需要这项照料，等需求倒计时结束后再来。',ANIMAL_NOT_MATURE:'这只羊还未成熟，请等待成长倒计时。',ANIMAL_BUSY:'这只羊正在交配或孕育，暂不可出售。',TROUGH_FULL:'槽中已经充足，无需重复添加。',CAPACITY_REACHED:'围栏已满，可转让空闲种羊后再购买。',RANCH_FULL:'围栏已满，可转让空闲种羊后再购买。',BREEDING_ACTIVE:'交配或孕育期间暂不可转让种羊。',INSUFFICIENT_COINS:'金币不足，先收获出售已有产物。',LEVEL_LOCKED:'尚未达到该动物的开放等级。',SPECIES_UNAVAILABLE:'该物种尚未在此样板中开放。',NO_BREEDER:'请先购买种畜。',BATCH_ACTIVE:'当前繁殖尚未收获。',NO_BATCH:'当前没有可收获幼崽，请等待公母配对与孕育。',NOT_MATURE:'幼崽尚未到可收获时间。',ALREADY_VISITED:'这位访客已经偷取过本批幼崽。',THEFT_CAP_REACHED:'本批累计已被偷一半，剩余全部留给主人。'};
function ranchAction(fn,message){try{const result=fn();state.ranch=result.ranch;if(Object.hasOwn(result,'coins'))state.coins=result.coins;notice(typeof message==='function'?message(result):message);persist();render();updateWorld();}catch(e){notice(ranchErrors[e.code]||`牧场操作失败（${e.code||'UNEXPECTED_ERROR'}），请刷新后重试。`);if(!ranchErrors[e.code])console.error('Ranch operation failed',e);}}
$('buyBreeder').addEventListener('click',()=>ranchAction(()=>buyBreeder(state.ranch,{speciesId:'sheep',level:state.level,coins:state.coins,now:Date.now()}),r=>`买到一只${r.animal.sex==='male'?'公':'母'}幼羊，花费 60 金币。自然成长8小时，饮水和进食可适度提前成熟。`));
$('animalList').addEventListener('click',e=>{const button=e.target.closest('[data-sell-animal]');if(!button||button.disabled)return;ranchAction(()=>sellAnimal(state.ranch,{animalId:button.dataset.sellAnimal,coins:state.coins,now:Date.now()}),r=>`成羊已出售，获得 ${RANCH_RULES.adultSale} 金币。`);});
$('autoBreeding').addEventListener('change',()=>ranchAction(()=>setBreedingEnabled(state.ranch,{enabled:$('autoBreeding').checked}),()=>'自动配对设置已保存；已开始的孕育仍会完成。'));
$('rehomeAnimal').addEventListener('change',renderRanch);
$('rehomeBreeder').addEventListener('click',()=>ranchAction(()=>rehomeBreeder(state.ranch,{animalId:$('rehomeAnimal').value,coins:state.coins,now:Date.now()}),'已转让所选种羊，返还 30 金币。'));
$('harvestOffspring').addEventListener('click',()=>ranchAction(()=>harvestOffspring(state.ranch,{now:Date.now()}),'本批幼崽已放入主人仓库。点击出售才会获得金币，种畜继续保留。'));
$('sellOffspring').addEventListener('click',()=>ranchAction(()=>sellOwnerOffspring(state.ranch,{coins:state.coins}),r=>`已出售 ${r.amount} 只幼崽，获得 ${r.amount*18} 金币。`));
$('ranchVisitor').addEventListener('change',renderRanch);
$('stealOffspring').addEventListener('click',()=>ranchAction(()=>stealOffspring(state.ranch,{visitorId:$('ranchVisitor').value,now:Date.now()}),'该模拟访客获得 1 只幼崽，只能出售。主人金币不变，种畜不会被拿走。'));
$('sellVisitorOffspring').addEventListener('click',()=>ranchAction(()=>sellVisitorOffspring(state.ranch,{visitorId:$('ranchVisitor').value}),r=>`访客出售 ${r.amount} 只幼崽，访客获得 ${r.income} 金币。主人金币没有变化。`));


function selectPlot(id){const n=Number(typeof id==='object'?id.id:id);if(Number.isInteger(n)&&n>=0&&n<6){selected=n;render();}}
for(let i=0;i<6;i++){const b=document.createElement('button');b.id=`plot-${i}`;b.innerHTML=`田地 ${i+1}<small>空地</small>`;b.addEventListener('click',()=>selectPlot(i));$('plots').append(b);}
$('seed').addEventListener('change',render);
$('plant').addEventListener('click',()=>{const p=state.plots[selected],crop=$('seed').value,c=CROPS[crop];if(p.batch||state.coins<c.cost||state.level<c.level)return;state.coins-=c.cost;p.crop=crop;p.batch=createBatch({batchId:`plot-${selected}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,ownerId:'local-owner',productId:crop,kind:'crop',initialYield:c.yield,maturesAt:Date.now()+c.seconds*1000});notice(`已种下${c.name}，扣除 ${c.cost} 金币。`);persist();render();updateWorld();});
$('harvest').addEventListener('click',()=>{const p=state.plots[selected];if(!p.batch)return;try{const result=harvestOwn(p.batch,{actorId:'local-owner',now:Date.now()});state.coins+=result.reward.amount;p.crop=null;p.batch=null;notice(`收获并出售 ${result.reward.amount} 份，获得 ${result.reward.amount} 金币。`);persist();render();updateWorld();}catch(e){notice(e.code==='NOT_MATURE'?'作物尚未成熟，暂时不能收获。':`收获失败（${e.code||'UNEXPECTED_ERROR'}），请刷新后重试。`);if(e.code!=='NOT_MATURE')console.error(e);}});
$('mature').addEventListener('click',()=>{const p=state.plots[selected];if(!p.batch)return;p.batch={...p.batch,maturesAt:Date.now()};notice('本地演示：当前作物已成熟。正式游戏不提供这个按钮。');persist();render();updateWorld();});
$('steal').addEventListener('click',()=>{const p=state.plots[selected];if(!p.batch)return;try{const result=stealHarvest(p.batch,{visitorId:$('visitor').value,requestedAmount:4,now:Date.now()});p.batch=result.batch;notice(`模拟访客取走 ${result.reward.amount} 份，你的金币不变。主人仍保留至少 ${Math.ceil(p.batch.initialYield/2)} 份。`);persist();render();updateWorld();}catch(e){notice(({ALREADY_VISITED:'这位访客本批已经摘取过了。',THEFT_CAP_REACHED:'已达到累计一半上限，不能再偷。',NOT_MATURE:'还未成熟，不能摘取。'})[e.code]||'本次摘取未完成。');}});
function syncFace(){FACE_KEYS.forEach(k=>{$(`range-${k}`).value=state.face[k];$(`number-${k}`).value=state.face[k];});document.querySelectorAll('[data-outfit]').forEach(b=>{b.classList.toggle('active',b.dataset.outfit===state.outfit);b.setAttribute('aria-pressed',String(b.dataset.outfit===state.outfit));});world?.setFace(state.face);world?.setOutfit(state.outfit);world?.setGarment?.(state.garment);document.querySelectorAll('[data-garment]').forEach(b=>{b.classList.toggle('active',b.dataset.garment===state.garment);b.setAttribute('aria-pressed',String(b.dataset.garment===state.garment));});}
FACE_KEYS.forEach((key,i)=>{const row=document.createElement('div');row.className='slider-row';row.innerHTML=`<div class="slider-label"><label for="range-${key}">${LABELS[i]}</label><input id="number-${key}" type="number" min="-50" max="50" step="1" aria-label="${LABELS[i]}数值"></div><input id="range-${key}" type="range" min="-50" max="50" step="1" aria-label="${LABELS[i]}">`;$('sliders').append(row);for(const prefix of ['range','number'])$(`${prefix}-${key}`).addEventListener('input',e=>{if(e.target.value==='')return;const n=Number(e.target.value);if(!Number.isFinite(n))return;state.face[key]=Math.max(-50,Math.min(50,Math.round(n)));document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));syncFace();persist();});});
const presets={round:{eyeWidth:-10,eyeHeight:28,eyeTilt:0},long:{eyeWidth:32,eyeHeight:-18,eyeTilt:3},lift:{eyeWidth:16,eyeHeight:0,eyeTilt:30}};
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{Object.assign(state.face,presets[b.dataset.preset]);document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));syncFace();persist();notice('眼型已应用，可以继续调整每一个参数。');}));
document.querySelectorAll('[data-outfit]').forEach(b=>b.addEventListener('click',()=>{state.outfit=b.dataset.outfit;syncFace();persist();notice('服装配色已更新。可在衣橱切换服装轮廓。');}));
document.querySelectorAll('[data-garment]').forEach(b=>b.addEventListener('click',()=>{state.garment=b.dataset.garment;syncFace();persist();notice('服装轮廓已切换，捏脸参数保持不变。');}));
function encodeFace(){return 'QM3D2:'+btoa(JSON.stringify({v:2,model:'qimeng-procedural-v1',face:state.face,outfit:state.outfit,garment:state.garment}));}
function decodeFace(code){
 if(typeof code!=='string'||code.length>4096||!/^QM3D[12]:[A-Za-z0-9+/]+={0,2}$/.test(code))throw Error('格式');
 const data=JSON.parse(atob(code.slice(6))),legacy=code.startsWith('QM3D1:');
 if(!data||Object.keys(data).sort().join(',')!==(legacy?'face,model,outfit,v':'face,garment,model,outfit,v')||data.v!==(legacy?1:2)||data.model!=='qimeng-procedural-v1'||!validFace(data.face)||!OUTFITS.includes(data.outfit)||(!legacy&&!GARMENTS.includes(data.garment)))throw Error('版本或参数');
 return {...data,garment:legacy?'garden':data.garment};
}
$('exportFace').addEventListener('click',async()=>{const code=encodeFace();$('faceCode').value=code;try{await navigator.clipboard.writeText(code);notice('分享码已生成并复制，可导入此版本样板。');}catch{$('faceCode').focus();$('faceCode').select();notice('分享码已生成。浏览器未允许自动复制，请手动复制文本。');}});
$('importFace').addEventListener('click',()=>{try{const d=decodeFace($('faceCode').value.trim());state.face={...d.face};state.outfit=d.outfit;state.garment=d.garment;syncFace();persist();notice('分享码已导入，可以继续微调。');}catch{notice('导入失败：请使用完整的 QM3D2 或 QM3D1 分享码，检查版本和参数。现有外观没有改变。');}});
$('resetFace').addEventListener('click',()=>{state.face=defaults();syncFace();persist();notice('五官已恢复默认，服装配色保持不变。');});
function setMode(next){mode=next;for(const k of ['farm','ranch','face','wardrobe']){$(k+'Panel').hidden=next!==k;$(k+'Tab').classList.toggle('active',next===k);$(k+'Tab').setAttribute('aria-selected',String(next===k));}const titles={farm:'一小片属于你的田园',ranch:'陪伴，在牧场慢慢长大',face:'每一点不同，都属于你',wardrobe:'把喜欢的自己，穿进日常'};$('sceneTitle').textContent=titles[next];$('hint').textContent=next==='farm'?'拖动旋转视角 · 滚轮或双指缩放 · 点击地面行走':'拖动查看造型 · 滚轮或双指缩放';world?.setMode(next);}
for(const k of ['farm','ranch','face','wardrobe'])$(k+'Tab').addEventListener('click',()=>setMode(k));
function worldError(e){$('loading').hidden=false;$('loading').textContent='3D 场景未能启动。请使用支持 WebGL 的较新浏览器，开启硬件加速后刷新。下方经营与捏脸参数仍可操作。';console.error('3D startup error',e);}
notice(initialNotice);tickRanch();render();syncFace();
window.__qimeng3d=Object.freeze({get ready(){return !!world&&$('loading').hidden;},get renderInfo(){return world?.debug;},get state(){return JSON.parse(JSON.stringify(state));},get selectedPlot(){return selected;},get mode(){return mode;}});
try{const {createWorld}=await import('./world3d.mjs');world=createWorld({canvas:$('world'),onPlotClick:selectPlot,onRanchClick:()=>setMode('ranch'),onRanchCare:action=>{setMode('ranch');careAction('ranch',action==='water'?'water':'fertilize');},onMove:()=>{},onReady:()=>{$('loading').hidden=true;},onError:worldError});const result=await world.ready;updateWorld();syncFace();world.setMode(mode);$('loading').hidden=true;if(result?.assetLoaded===false)notice('角色模型加载失败，当前为占位角色。请刷新页面重试；经营功能仍可使用。');}catch(e){worldError(e);}
setInterval(()=>{tickRanch();render();updateWorld();},1000);
window.addEventListener('pagehide',persist);
