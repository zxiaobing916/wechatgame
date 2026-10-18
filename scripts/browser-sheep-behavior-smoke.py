"""Renderer-only deterministic contention and animation checks against actual Three objects.
A route-local hook controls private animation state; no testing API ships in the game.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'web/world3d.mjs').read_text().replace(';updateSheep(dt);controls.update()', ';controls.update()')
source=source.replace('  return {ready,playCare,', '''  globalThis.__sheepTest={
 step:updateSheep,
 geometry(){scene.updateMatrixWorld(true);return [...sheepRecords.values()].map(r=>{
 const walls=[];troughGroup.traverse(o=>{if(o.isMesh&&o.material===M.wood)walls.push(new THREE.Box3().setFromObject(o));});
 const solids=r.body.children.filter(o=>o!==r.head).map(o=>new THREE.Box3().setFromObject(o));
 return {id:r.id,mouth:r.head.localToWorld(new THREE.Vector3(0,-.04,.30)).toArray(),rim:.15,clear:solids.every(s=>walls.every(w=>!s.intersectsBox(w))),headMin:new THREE.Box3().setFromObject(r.head).min.y};});},
 demand(kind){for(const r of sheepRecords.values())releaseTrough(r);for(const r of sheepRecords.values()){r.pendingCare.push(kind);nextSheepBehavior(r,true);}reserveTroughs();}
 };\n  return {ready,playCare,''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800})
 page.route('**/world3d.mjs',lambda route:route.fulfill(body=source,content_type='text/javascript'))
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/play.html')
 page.set_content('''<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><script type="module">import {createWorld} from '/world3d.mjs';window.world=createWorld({canvas:document.querySelector('canvas')});await world.ready;world.setMode('ranch');window.testReady=true;</script>''')
 page.wait_for_function('window.testReady',timeout=60000)
 result=page.evaluate('''()=>{
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const set=(n=3)=>{world.setRanch({animals:[],supplies:{water:0,feed:0}});world.setRanch({animals:Array.from({length:n},(_,i)=>({id:String(i)})),supplies:{water:4,feed:4}});};
 const step=(seconds)=>{for(let i=0;i<seconds*20;i++)__sheepTest.step(.05);};
 set(6);const initial=world.debug.sheepBehaviors;step(2);
 let current=world.debug.sheepBehaviors;
 check(current.some(r=>r.bodyOffset<-.12),'rest pose');check(current.some(r=>r.headBend>.3),'grazing pose');
 check(current.some((r,i)=>Math.hypot(r.position[0]-initial[i].position[0],r.position[2]-initial[i].position[2])>.08),'actual movement');
 const before=world.debug.sheepBehaviors;
 world.setRanch({animals:Array.from({length:6},(_,i)=>({id:String(i),growthMs:i===0?14400000:28800000})),supplies:{water:4,feed:4}});
 current=world.debug.sheepBehaviors;
 check(current.every((r,i)=>JSON.stringify(r.position)===JSON.stringify(before[i].position)),'growth preserves positions');check(Math.abs(current[0].scale-.7)<.001,'growth scale');
 const reports=[];
 for(const [kind,young] of [['water',false],['feed',false],['water',true],['feed',true]]){
  set();if(young)world.setRanch({animals:Array.from({length:3},(_,i)=>({id:String(i),growthMs:0})),supplies:{water:4,feed:4}});__sheepTest.demand(kind);
  let d=world.debug;check(d.troughQueues[kind].length===2,'two queued');check(d.troughReservations[kind]==='0','first request owns slot');
  check(new Set(d.sheepBehaviors.map(r=>JSON.stringify(r.target))).size===3,'distinct targets');
  const served=new Set();let minimum=10;
  for(let i=0;i<6000;i++){
   const previous=world.debug;__sheepTest.step(.05);d=world.debug;
   for(const k of ['water','feed']){const holders=d.sheepBehaviors.filter(r=>r.slot===k);check(holders.length<=1,'exclusive slot');check((holders[0]?.id??null)===d.troughReservations[k],'reservation matches owner');}
   for(const r of d.sheepBehaviors){
    check(r.position[0]>=3.9&&r.position[0]<=5.5&&r.position[2]>=-1.3&&r.position[2]<=2.2,'bounds');
    if(r.slot===kind&&r.serviceTime>3){served.add(r.id);
     const geometry=__sheepTest.geometry().find(g=>g.id===r.id);
     check(geometry.mouth[1]>geometry.rim,'mouth stays above rim');check(geometry.headMin>geometry.rim,'whole head clears solid rim');
     check(geometry.mouth[0]>5.75,'mouth reaches over near rim '+JSON.stringify({geometry,r}));
    }
    check(__sheepTest.geometry().find(g=>g.id===r.id).clear,'body stays outside trough solids');
    const old=previous.sheepBehaviors.find(a=>a.id===r.id);
    if(old.slot&&old.slot===r.slot&&old.serviceTime>0&&r.serviceTime>old.serviceTime)check(Math.hypot(r.position[0]-old.position[0],r.position[2]-old.position[2])<.000001,'serving occupant anchored');
   }
   for(let a=0;a<d.sheepBehaviors.length;a++)for(let b=a+1;b<d.sheepBehaviors.length;b++){
    const x=d.sheepBehaviors[a],y=d.sheepBehaviors[b],gap=Math.hypot(x.position[0]-y.position[0],x.position[2]-y.position[2]);minimum=Math.min(minimum,gap);check(gap>=(x.scale+y.scale)*.49-.002,'no overlapping bodies');
   }
  }
  check(served.size===3,'every queued sheep eventually served: '+kind+' '+[...served]);reports.push({kind,young,served:[...served],minimum});
 }
 set();__sheepTest.demand('water');
 world.setRanch({animals:[{id:'1'},{id:'2'}],supplies:{water:4,feed:4}});
 check(world.debug.troughReservations.water==='1','removing owner immediately advances FIFO');
 step(180);
 check(Object.values(world.debug.troughReservations).every(v=>v===null),'care animation finishes once');
 check(Object.values(world.debug.troughQueues).every(q=>q.length===0),'care queues drained');
 set();step(180);check(world.debug.sheepBehaviors.every(r=>!r.slot&&!r.queuedFor),'stock alone never triggers care');
 const cared=Array.from({length:3},(_,i)=>({id:String(i),lastWaterAt:1000,lastFeedAt:1000}));
 world.setRanch({animals:cared,supplies:{water:0,feed:0}});
 check(world.debug.sheepBehaviors.filter(r=>r.slot||r.queuedFor).length===3,'actual care events trigger animation even final stock consumed');
 step(240);world.setRanch({animals:cared,supplies:{water:4,feed:4}});step(180);
 check(world.debug.sheepBehaviors.every(r=>!r.slot&&!r.queuedFor&&!r.pendingCare.length),'same care timestamps never replay');
 set();__sheepTest.demand('water');
 for(let i=0;i<1200;i++){__sheepTest.step(.05);if(world.debug.sheepBehaviors.some(r=>r.slot==='water'&&r.serviceTime>2))break;}
 return reports;
}''')
 (ROOT/'.artifacts').mkdir(exist_ok=True)
 page.screenshot(path=str(ROOT/'.artifacts/sheep-behavior.png'))
 print('PASS animation, bounds, growth continuity, 3-way contention for both troughs, exclusivity, independent targets, safe body separation, anchored occupant, FIFO removal, trough solid clearance, lowered head, event-only care, eventual service:',result)
 b.close()
