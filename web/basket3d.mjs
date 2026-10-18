import {BASKET_TYPES,itemsFor,rewardFor,availableItems as dailyAvailable} from '/domain/daily-basket.mjs';
import * as THREE from 'three';
import { BASKET_ITEMS, availableItems as legacyAvailable } from '/domain/basket.mjs';

/** Original procedural toy props. A shallow open basket keeps every top piece accessible. */
export function createBasketView({canvas,onPick=()=>{},onPrize=()=>{}}={}) {
  if(!canvas)throw new Error('Basket canvas required');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eee8dc');
  const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,60);
  scene.add(new THREE.HemisphereLight('#fff9ef','#b5bca6',1.7));
  const light=new THREE.DirectionalLight('#fff5e0',2);light.position.set(-4,10,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:1,far:25});light.shadow.normalBias=.025;light.shadow.bias=-.0001;scene.add(light);
  const fill=new THREE.DirectionalLight('#dce6ff',1);fill.position.set(4,4,-5);scene.add(fill);
  const materials=[],geometries=[],records=new Map(),raycaster=new THREE.Raycaster();
  const material=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65});materials.push(m);return m;};
  const M={blue:material('#8cc6d5'),wood:material('#d1ab7e'),weave:material('#e3c99f'),cream:material('#fff4dd'),pink:material('#ea9eac'),yellow:material('#f2d476'),green:material('#93b388'),purple:material('#b5a0d2'),red:material('#cc7589'),stem:material('#827759'),white:material('#fffbea')};
  const geo=g=>{geometries.push(g);return g;};
  const ball=geo(new THREE.SphereGeometry(1,12,8)),cube=geo(new THREE.BoxGeometry(1,1,1)),cyl=geo(new THREE.CylinderGeometry(1,1,1,16)),torus=geo(new THREE.TorusGeometry(1,.075,5,24));
  function part(parent,g,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
  const contents=new THREE.Group();scene.add(contents);
  const basket=new THREE.Group();contents.add(basket);
  part(basket,cube,M.wood,0,-6.15,0,5.9,.18,7.4);
  for(let i=0;i<19;i++)part(basket,cube,M.weave,-2.79+i*.31,-6.04,0,.065,.035,7.2);
  for(let i=0;i<24;i++)part(basket,cube,M.weave,0,-6.02,-3.55+i*.31,5.7,.035,.065);
  for(const z of [-3.68,3.68]){part(basket,cube,M.wood,0,-2.9,z,6,6.3,.13);part(basket,cube,M.weave,0,.27,z,6,.09,.18);}
  for(const x of [-2.94,2.94]){part(basket,cube,M.wood,x,-2.9,0,.13,6.3,7.4);part(basket,cube,M.weave,x,.27,0,.18,.09,7.45);}
  for(const x of [-3.03,3.03]){const h=part(basket,torus,M.wood,x,.25,0,.35,.52,.35);h.rotation.y=Math.PI/2;}
  // A separate, non-pickable keepsake rests in the gap between the authored stacks.
  // Its cover opens with puzzle progress; neither reward nor cloth changes the puzzle.
  const keepsake=new THREE.Group();keepsake.position.set(0,-5.98,.63);keepsake.scale.setScalar(.72);contents.add(keepsake);
  const velvet=material('#c9b7dc'),face=material('#f8e8d5'),ink=material('#60596c'),gold=material('#ddb974');
  part(keepsake,ball,velvet,0,.025,0,.72,.055,.49);
  const lamb=new THREE.Group();keepsake.add(lamb);
  part(lamb,ball,M.cream,-.12,.24,0,.46,.25,.31);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;part(lamb,ball,i%3?M.cream:velvet,-.12+Math.cos(a)*.32,.29,Math.sin(a)*.23,.18,.16,.16);}
  for(const x of [-.3,.12])part(lamb,ball,face,x,.095,.23,.17,.075,.11);
  const head=new THREE.Group();head.position.set(.31,.33,.07);lamb.add(head);
  part(head,ball,face,0,0,0,.22,.21,.21);
  part(head,ball,M.cream,-.03,.15,-.025,.23,.12,.20);
  for(const x of [-.21,.21]){const ear=part(head,ball,velvet,x,.04,0,.16,.06,.085);ear.rotation.z=x>0?-.3:.3;}
  const eyes=[];for(const x of [-.085,.085])eyes.push(part(head,ball,ink,x,-.015,.191,.026,.008,.013));
  part(head,ball,M.pink,0,-.08,.207,.037,.024,.017);
  const crescent=geo(new THREE.TorusGeometry(.095,.024,6,20,Math.PI*1.5));
  const moon=part(head,crescent,gold,0,.16,.18,1,1,1);moon.rotation.z=-Math.PI/4;
  const gift=new THREE.Group();keepsake.add(gift);gift.visible=false;
  part(gift,cube,M.pink,0,.25,0,.8,.45,.6);part(gift,cube,M.cream,0,.49,0,.85,.08,.65);
  part(gift,cube,gold,0,.52,0,.12,.03,.67);part(gift,cube,gold,0,.52,0,.87,.03,.10);
  const covers=[];for(const side of [-1,1]){const cloth=part(keepsake,ball,velvet,side*.25,.29,0,.48,.32,.47);covers.push({cloth,side});}
  let revealProgress=0,prizeAwake=false;
  function updatePrize(count,status){
    if(prizeAwake&&status!=='won'){camera.zoom=1;camera.updateProjectionMatrix();keepsake.scale.setScalar(.72);}
    revealProgress=count===0?1:0;prizeAwake=status==='won';keepsake.visible=count===0;
    for(const {cloth}of covers)cloth.visible=false;
    for(const eye of eyes)eye.scale.y=prizeAwake?.029:.008;
  }
  function model(type){
    const p=new THREE.Group();
    if(type==='flower'){
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;part(p,ball,M.pink,Math.sin(a)*.24,.16,Math.cos(a)*.24,.22,.17,.22);}
      part(p,ball,M.yellow,0,.25,0,.17,.10,.17);
    }else if(type==='pear'){
      part(p,ball,M.yellow,0,.22,0,.30,.30,.29);part(p,ball,M.yellow,0,.45,0,.18,.23,.18);
      part(p,cyl,M.stem,0,.67,0,.035,.16,.035);const leaf=part(p,ball,M.green,.14,.65,0,.17,.035,.08);leaf.rotation.z=.3;
    }else if(type==='thread'){
      part(p,cyl,M.cream,0,.25,0,.25,.43,.25);
      for(const y of [.04,.46])part(p,cyl,M.wood,0,y,0,.31,.07,.31);
      part(p,cyl,M.purple,0,.25,0,.285,.31,.285);
      for(const y of [.13,.21,.29,.37]){const line=part(p,torus,M.white,0,y,0,.286,.286,.286);line.rotation.x=Math.PI/2;}
    }else if(type==='shell'){
      for(let i=0;i<5;i++){const a=(i-2)*.31;const rib=part(p,ball,M.cream,Math.sin(a)*.22,.12,Math.cos(a)*.15,.09,.19,.35);rib.rotation.y=a;}
      part(p,ball,M.pink,0,.15,-.18,.15,.11,.13);
    }else if(type==='berry'){
      for(const [x,z] of [[-.15,.08],[.15,.08],[0,-.15]])part(p,ball,M.red,x,.19,z,.20,.22,.20);
      part(p,ball,M.green,0,.42,0,.20,.045,.11);
      part(p,cyl,M.stem,0,.48,0,.025,.12,.025);
    }else if(type==='gem'){
      part(p,geo(new THREE.OctahedronGeometry(1)),M.blue,0,.30,0,.32,.34,.30);
      part(p,ball,M.white,-.12,.45,.15,.045,.06,.035);
    }else if(type==='button'){
      part(p,cyl,M.wood,0,.14,0,.34,.18,.34);
      for(const x of [-.10,.10])for(const z of [-.10,.10])part(p,ball,M.stem,x,.235,z,.045,.015,.045);
      const rim=part(p,torus,M.cream,0,.23,0,.29,.29,.29);rim.rotation.x=Math.PI/2;
    }else if(type==='bell'){
      part(p,geo(new THREE.CylinderGeometry(.14,.31,.38,16)),M.yellow,0,.29,0,1,1,1);
      part(p,ball,M.wood,0,.075,0,.10,.075,.10);
      const loop=part(p,torus,M.yellow,0,.55,0,.10,.10,.10);
    }else{
      const leaf=part(p,ball,M.green,0,.14,0,.23,.17,.44);leaf.rotation.y=-.3;
      const vein=part(p,cube,M.cream,0,.24,0,.025,.025,.63);vein.rotation.y=-.3;
    }
    return p;
  }
  keepsake.traverse(o=>{if(o.isMesh)o.userData.prize=true;});
  const icons={};
  const iconScene=new THREE.Scene();iconScene.background=new THREE.Color('#fffdf5');
  iconScene.add(new THREE.HemisphereLight('#fff9ef','#b5bca6',1.7));
  const iconLight=new THREE.DirectionalLight('#fff5e0',2);iconLight.position.set(-4,10,5);iconScene.add(iconLight);
  const iconCamera=new THREE.OrthographicCamera(-.58,.58,.58,-.58,.1,10);iconCamera.position.set(1,1.6,2);iconCamera.lookAt(0,.25,0);
  renderer.setSize(96,96,false);
  for(const type of Object.keys(BASKET_TYPES)){const object=model(type);iconScene.add(object);renderer.render(iconScene,iconCamera);icons[type]=canvas.toDataURL('image/png');iconScene.remove(object);}
  let entries=[],boardKey=null;
  const heights={flower:.35,pear:.75,thread:.51,shell:.26,berry:.55,leaf:.25,gem:.65,button:.26,bell:.66};
  function rebuild(newEntries,daily=false){
  for(const r of records.values())contents.remove(r.root);records.clear();entries=newEntries;
  entries.forEach((item,index)=>{
    const root=new THREE.Group();const shape=model(item.type);root.add(shape);
    const col=index%12;root.position.set(Number.isFinite(item.x)?item.x*1.5:(col%4-1.5)*1.3,Number.isFinite(item.layer)?.035+entries.filter(v=>v.stack===item.stack&&v.layer<item.layer).reduce((h,v)=>h+heights[v.type]*(daily?.5:1)+.015,0):Math.floor(index/12)*.5,Number.isFinite(item.z)?item.z*1.4:(Math.floor(col/4)-1)*1.3);
    // The open ring is a persistent mobile-readable cue; lower layers have none.
    const ring=part(root,torus,M.white,0,.015,0,.43,.43,.43);ring.rotation.x=Math.PI/2;
    const scattered=Number.isFinite(item.pitch);
    if(scattered){root.position.set(item.x,item.y,item.z);shape.position.y=-heights[item.type]*.5*item.size;shape.scale.setScalar(item.size);root.rotation.set(item.pitch,item.yaw,item.roll);ring.visible=false;}else root.rotation.y=(index%5-2)*.16;
    if(item.size===2.15){
      root.rotation.set(0,0,0);shape.position.set(0,0,0);shape.scale.setScalar(1);shape.rotation.set(item.pitch,item.yaw,item.roll);
      const box=new THREE.Box3().setFromObject(shape),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());
      shape.position.sub(center);const spread=1.90/Math.max(extent.x,extent.z);root.scale.set(spread,Math.min(spread,1.02/extent.y),spread);
    }
    ring.name='selection-ring';
    root.traverse(o=>{if(o.isMesh)o.userData.itemId=item.id;});contents.add(root);
    records.set(item.id,{item,root,shape,ring,daily,scattered,targetY:item.y,velocity:0});
  });
  }
  rebuild(BASKET_ITEMS);
  let state=null,available=new Set(),active=false,disposed=false,angle=0,drag=null,frame=0,rockRemaining=0,lastFrame=0;let tiltX=0,tiltZ=0,lastToss=-Infinity,tossCount=0;const pointers=new Set();
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height;const half=aspect<1?3.85/aspect:3.85;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
  function positionCamera(){camera.position.set(Math.sin(angle)*3.4,16-(camera.zoom-1)/.65*4,Math.cos(angle)*3.4);camera.lookAt(0,-1.2-(camera.zoom-1),Math.max(0,(camera.zoom-1)/.65)*.63);camera.updateMatrixWorld();}
  function settle(dt,wave){
    if(state?.layout!==4)return;
    const placed=[];
    for(const r of [...records.values()].reverse()){
      if(!r.root.visible)continue;
      const phase=Number(r.item.id.split('-')[1])*2.399,shift=(wave+tiltZ)*Math.sin(phase)*.35;
      r.root.position.x=THREE.MathUtils.clamp(r.item.x+(r.nudgeX||0)+shift,-1.98,1.98);
      r.root.position.z=THREE.MathUtils.clamp(r.item.z+(r.nudgeZ||0)+(wave+tiltX)*Math.cos(phase)*.35,-3.04,3.04);
      let support=-5.38;
      for(const other of placed)if(Math.abs(r.root.position.x-other.root.position.x)<1.78&&Math.abs(r.root.position.z-other.root.position.z)<1.13)support=Math.max(support,other.root.position.y+1.08);
      // Authored finite packing bounds are invariant during rocking and settling.
      support=Math.min(r.item.y,support);r.velocity-=9.8*dt;
      r.root.position.y=Math.max(support,r.root.position.y+r.velocity*dt);
      if(r.root.position.y<=support+.001)r.velocity=0;
      placed.push(r);
    }
  }
  function toss(strength=1){
    const now=performance.now();if(!active||state?.status!=='playing'||!state.remaining.length||now-lastToss<1400)return false;
    lastToss=now;tossCount++;rockRemaining=1200;
    const visible=[...records.values()].filter(r=>r.root.visible);
    const surface=visible.filter(r=>!visible.some(o=>o!==r&&o.root.position.y>r.root.position.y+.35&&Math.hypot(o.root.position.x-r.root.position.x,o.root.position.z-r.root.position.z)<1.3));
    surface.sort((a,b)=>Math.sin(Number(a.item.id.slice(6))+tossCount)-Math.sin(Number(b.item.id.slice(6))+tossCount));
    for(const r of surface.slice(0,5))r.toss={elapsed:0,strength:Math.max(.45,Math.min(1,strength)),phase:Number(r.item.id.slice(6))*2.399,offset:new THREE.Vector3()};
    return true;
  }
  function clearTossOffsets(){for(const r of records.values())if(r.toss)r.root.position.sub(r.toss.offset);}
  function animateToss(dt){
    for(const r of records.values())if(r.toss){const t=r.toss;t.elapsed+=dt;const p=Math.min(1,t.elapsed/.8),arc=Math.sin(Math.PI*p),amount=t.strength;
      t.offset.set(Math.sin(t.phase)*.09*arc*amount,.20*arc*amount,Math.cos(t.phase)*.07*arc*amount);r.root.position.add(t.offset);
      r.shape.rotation.x=r.item.pitch+arc*.18*amount;r.shape.rotation.z=r.item.roll+Math.sin(t.phase)*arc*.20*amount;
      if(p===1){
        const nx=THREE.MathUtils.clamp((r.nudgeX||0)+Math.sin(t.phase+tossCount)*.035,-.08,.08),nz=THREE.MathUtils.clamp((r.nudgeZ||0)+Math.cos(t.phase+tossCount)*.035,-.06,.06);
        const clear=[...records.values()].every(o=>o===r||!o.root.visible||Math.abs(o.root.position.y-r.root.position.y)>.4||Math.hypot(o.root.position.x-(r.item.x+nx),o.root.position.z-(r.item.z+nz))>1.1);
        if(clear){r.nudgeX=nx;r.nudgeZ=nz;}
        r.shape.rotation.x=r.item.pitch;r.shape.rotation.z=r.item.roll;r.toss=null;
      }
    }
  }
  function render(){if(!active||disposed)return;
    const time=performance.now(),dt=Math.min(100,lastFrame?time-lastFrame:16);lastFrame=time;
    rockRemaining=Math.max(0,rockRemaining-dt);
    const wave=rockRemaining>0?Math.sin((1200-rockRemaining)*.009)*.075*Math.min(1,rockRemaining/300):0;
    if(rockRemaining>0){contents.rotation.x=tiltX+wave;contents.rotation.z=tiltZ+wave*.65;}else{contents.rotation.x+=(tiltX-contents.rotation.x)*.25;contents.rotation.z+=(tiltZ-contents.rotation.z)*.25;}
    clearTossOffsets();settle(dt/1000,wave);animateToss(dt/1000);positionCamera();const targetZoom=prizeAwake?1.65:1;camera.zoom+=(targetZoom-camera.zoom)*.08;camera.updateProjectionMatrix();const targetScale=prizeAwake?1.8:.72;keepsake.scale.setScalar(keepsake.scale.x+(targetScale-keepsake.scale.x)*.08);if(prizeAwake){const t=performance.now()*.001;head.rotation.z=Math.sin(t*1.5)*.035;lamb.position.y=Math.sin(t*2)*.008;}else{head.rotation.z=0;lamb.position.y=0;}renderer.render(scene,camera);frame=requestAnimationFrame(render);}
  function setState(value){const key=value?.version===2?'daily:'+value.day+':'+(value.layout??1):'legacy';if(boardKey!==key){rebuild(value?.version===2?itemsFor(value):BASKET_ITEMS,value?.version===2);boardKey=key;}state=value;lamb.visible=value?.version!==2||rewardFor(value.day).key==='moon';gift.visible=!lamb.visible;const ids=value?.remainingIDs??value?.remaining??entries.map(v=>v.id);const remaining=new Set(ids);updatePrize(remaining.size,value?.status);available=new Set(value?(value.version===2?dailyAvailable(value):legacyAvailable(value)).map(v=>typeof v==='object'?v.id:v):[]);for(const [id,r]of records){r.root.visible=remaining.has(id);r.ring.visible=!r.scattered&&available.has(id);const size=r.item.size===2.15?1:r.scattered?r.item.size:available.has(id)?1:.94;r.shape.scale.set(size,size*(!r.scattered&&r.daily?.5:1),size);}if(active)renderer.render(scene,camera);}
  function setActive(value){if(disposed)return;active=Boolean(value);cancelAnimationFrame(frame);if(active){resize();render();}}
  function rotate(direction){angle=THREE.MathUtils.clamp(angle+Math.sign(direction)*.06,-.12,.12);positionCamera();if(active)renderer.render(scene,camera);}
  function down(event){if(!active||event.button>0)return;pointers.add(event.pointerId);if(pointers.size>1){if(drag)drag.moved=true;return;}drag={id:event.pointerId,x:event.clientX,y:event.clientY,last:event.clientX,moved:false};canvas.setPointerCapture?.(event.pointerId);}
  function move(event){if(!drag||event.pointerId!==drag.id)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8)drag.moved=true;if(drag.moved){angle=THREE.MathUtils.clamp(angle-(event.clientX-drag.last)*.002,-.12,.12);tiltX=THREE.MathUtils.clamp((event.clientY-drag.y)*.0015,-.1,.1);tiltZ=THREE.MathUtils.clamp((event.clientX-drag.x)*-.001,-.08,.08);positionCamera();}drag.last=event.clientX;}
  function up(event){pointers.delete(event.pointerId);tiltX=tiltZ=0;if(!drag||event.pointerId!==drag.id)return;const tap=!drag.moved;drag=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(!tap||!active||state?.status!=='playing')return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);scene.updateMatrixWorld(true);const targets=[];contents.traverseVisible(o=>{if(o.isMesh&&o.name!=='selection-ring')targets.push(o);});const hit=raycaster.intersectObjects(targets,false)[0];if(hit?.object.userData.prize){onPrize();return;}const id=hit?.object.userData.itemId;if(id!==undefined)onPick(id);}
  function cancel(){drag=null;pointers.clear();tiltX=tiltZ=0;}
  canvas.style.touchAction='none';canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  const observer=new ResizeObserver(()=>{if(active)resize();});observer.observe(canvas);positionCamera();
  return {icons:Object.freeze(icons),setState,setActive,rotate,rock:toss,get debug(){scene.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect();const prizePoint=keepsake.getWorldPosition(new THREE.Vector3()).project(camera);return {tossCount,tossing:[...records.values()].filter(r=>r.toss).map(r=>r.item.id),prizePoint:{x:rect.left+(prizePoint.x+1)*rect.width/2,y:rect.top+(1-prizePoint.y)*rect.height/2},active,angle,rocking:rockRemaining>0,tilt:[contents.rotation.x,contents.rotation.z],revealProgress,prizeVisible:keepsake.visible,prizeAwake,types:Object.keys(BASKET_TYPES),positions:[...records.values()].filter(r=>r.root.visible).map(r=>({id:r.item.id,x:r.root.position.x,y:r.root.position.y,z:r.root.position.z})),visibleCount:[...records.values()].filter(r=>r.root.visible).length,selectable:[...records.values()].filter(r=>r.root.visible&&available.has(r.item.id)).map(r=>{const p=r.root.localToWorld(new THREE.Vector3(0,r.scattered?0:.3,0)).project(camera);return{id:r.item.id,type:r.item.type,x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};})};},dispose(){disposed=true;active=false;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();}};
}
