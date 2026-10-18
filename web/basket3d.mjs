import * as THREE from 'three';
import { BASKET_ITEMS, BASKET_TYPES, availableItems } from '/domain/basket.mjs';

/** Original procedural toy props. A shallow open basket keeps every top piece accessible. */
export function createBasketView({canvas,onPick=()=>{}}={}) {
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
  const M={wood:material('#d1ab7e'),weave:material('#e3c99f'),cream:material('#fff4dd'),pink:material('#ea9eac'),yellow:material('#f2d476'),green:material('#93b388'),purple:material('#b5a0d2'),red:material('#cc7589'),stem:material('#827759'),white:material('#fffbea')};
  const geo=g=>{geometries.push(g);return g;};
  const ball=geo(new THREE.SphereGeometry(1,12,8)),cube=geo(new THREE.BoxGeometry(1,1,1)),cyl=geo(new THREE.CylinderGeometry(1,1,1,16)),torus=geo(new THREE.TorusGeometry(1,.075,5,24));
  function part(parent,g,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
  const basket=new THREE.Group();scene.add(basket);
  part(basket,cube,M.wood,0,-.16,0,5.9,.18,4.45);
  for(let i=0;i<19;i++)part(basket,cube,M.weave,-2.79+i*.31,-.055,0,.065,.035,4.3);
  for(let i=0;i<14;i++)part(basket,cube,M.weave,0,-.03,-2.05+i*.315,5.7,.035,.065);
  for(const z of [-2.2,2.2]){part(basket,cube,M.wood,0,.10,z,6,.3,.13);part(basket,cube,M.weave,0,.27,z,6,.09,.18);}
  for(const x of [-2.94,2.94]){part(basket,cube,M.wood,x,.10,0,.13,.3,4.4);part(basket,cube,M.weave,x,.27,0,.18,.09,4.5);}
  for(const x of [-3.03,3.03]){const h=part(basket,torus,M.wood,x,.25,0,.35,.52,.35);h.rotation.y=Math.PI/2;}
  // A separate, non-pickable keepsake rests in the gap between the authored stacks.
  // Its cover opens with puzzle progress; neither reward nor cloth changes the puzzle.
  const keepsake=new THREE.Group();keepsake.position.set(0,.025,.63);keepsake.scale.setScalar(.72);scene.add(keepsake);
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
  const covers=[];for(const side of [-1,1]){const cloth=part(keepsake,ball,velvet,side*.25,.29,0,.48,.32,.47);covers.push({cloth,side});}
  let revealProgress=0,prizeAwake=false;
  function updatePrize(count,status){
    if(prizeAwake&&status!=='won'){camera.zoom=1;camera.updateProjectionMatrix();keepsake.scale.setScalar(.72);}
    revealProgress=Math.max(0,Math.min(1,1-count/entries.length));prizeAwake=status==='won';
    // A wrapped lump initially; an ear and wool peek out halfway through.
    const opening=Math.max(0,(revealProgress-.2)/.8);
    for(const {cloth,side}of covers){cloth.visible=!prizeAwake;cloth.position.x=side*(.25+opening*.17);cloth.position.z=-opening*.2;cloth.scale.set(.48*(1-opening*.8),.32*(1-opening*.92),.47*(1-opening*.2));cloth.position.y=.29*(1-opening*.85);}
    for(const eye of eyes)eye.scale.y=prizeAwake?.029:.008;
  }
  function model(type){
    const p=new THREE.Group();
    if(type==='flower'){
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;part(p,ball,M.pink,Math.sin(a)*.24,.16,Math.cos(a)*.24,.22,.10,.22);}
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
      for(let i=0;i<5;i++){const a=(i-2)*.31;const rib=part(p,ball,M.cream,Math.sin(a)*.22,.12,Math.cos(a)*.15,.09,.13,.35);rib.rotation.y=a;}
      part(p,ball,M.pink,0,.15,-.18,.15,.11,.13);
    }else if(type==='berry'){
      for(const [x,z] of [[-.15,.08],[.15,.08],[0,-.15]])part(p,ball,M.red,x,.19,z,.20,.22,.20);
      part(p,ball,M.green,0,.42,0,.20,.045,.11);
      part(p,cyl,M.stem,0,.48,0,.025,.12,.025);
    }else{
      const leaf=part(p,ball,M.green,0,.14,0,.23,.10,.44);leaf.rotation.y=-.3;
      const vein=part(p,cube,M.cream,0,.24,0,.025,.025,.63);vein.rotation.y=-.3;
    }
    return p;
  }
  const entries=Array.isArray(BASKET_ITEMS)?BASKET_ITEMS:Object.values(BASKET_ITEMS);
  const heights={flower:.35,pear:.75,thread:.51,shell:.26,berry:.55,leaf:.25};
  entries.forEach((item,index)=>{
    const root=new THREE.Group();const shape=model(item.type);root.add(shape);
    const col=index%12;root.position.set(Number.isFinite(item.x)?item.x*1.5:(col%4-1.5)*1.3,Number.isFinite(item.layer)?.035+entries.filter(v=>v.stack===item.stack&&v.layer<item.layer).reduce((h,v)=>h+heights[v.type]+.015,0):Math.floor(index/12)*.5,Number.isFinite(item.z)?item.z*1.4:(Math.floor(col/4)-1)*1.3);
    // The open ring is a persistent mobile-readable cue; lower layers have none.
    const ring=part(root,torus,M.white,0,.015,0,.43,.43,.43);ring.rotation.x=Math.PI/2;
    root.rotation.y=(index%5-2)*.16;
    root.traverse(o=>{if(o.isMesh)o.userData.itemId=item.id;});scene.add(root);
    records.set(item.id,{item,root,shape,ring});
  });
  let state=null,available=new Set(),active=false,disposed=false,angle=0,drag=null,frame=0;
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height;const half=aspect<1?4/aspect:4;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
  function positionCamera(){camera.position.set(Math.sin(angle)*3.4,11-(camera.zoom-1)/.65*4,Math.cos(angle)*3.4);camera.lookAt(0,.9-(camera.zoom-1),Math.max(0,(camera.zoom-1)/.65)*.63);camera.updateMatrixWorld();}
  function render(){if(!active||disposed)return;positionCamera();const targetZoom=prizeAwake?1.65:1;camera.zoom+=(targetZoom-camera.zoom)*.08;camera.updateProjectionMatrix();const targetScale=prizeAwake?1.8:.72;keepsake.scale.setScalar(keepsake.scale.x+(targetScale-keepsake.scale.x)*.08);if(prizeAwake){const t=performance.now()*.001;head.rotation.z=Math.sin(t*1.5)*.035;lamb.position.y=Math.sin(t*2)*.008;}else{head.rotation.z=0;lamb.position.y=0;}renderer.render(scene,camera);frame=requestAnimationFrame(render);}
  function setState(value){state=value;const ids=value?.remainingIDs??value?.remaining??entries.map(v=>v.id);const remaining=new Set(ids);updatePrize(remaining.size,value?.status);available=new Set(value?availableItems(value).map(v=>typeof v==='object'?v.id:v):[]);for(const [id,r]of records){r.root.visible=remaining.has(id);r.ring.visible=available.has(id);r.shape.scale.setScalar(available.has(id)?1:.94);}if(active)renderer.render(scene,camera);}
  function setActive(value){if(disposed)return;active=Boolean(value);cancelAnimationFrame(frame);if(active){resize();render();}}
  function rotate(direction){angle+=Math.sign(direction)*Math.PI/6;positionCamera();if(active)renderer.render(scene,camera);}
  function down(event){if(!active||event.button>0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,last:event.clientX,moved:false};canvas.setPointerCapture?.(event.pointerId);}
  function move(event){if(!drag||event.pointerId!==drag.id)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8)drag.moved=true;if(drag.moved){angle-=(event.clientX-drag.last)*.008;positionCamera();}drag.last=event.clientX;}
  function up(event){if(!drag||event.pointerId!==drag.id)return;const tap=!drag.moved;drag=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(!tap||!active||state?.status!=='playing')return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);scene.updateMatrixWorld(true);const targets=[basket,keepsake,...[...records.values()].filter(v=>v.root.visible).map(v=>v.root)];const hit=raycaster.intersectObjects(targets,true)[0];const id=hit?.object.userData.itemId;if(id!==undefined&&available.has(id))onPick(id);}
  function cancel(){drag=null;}
  canvas.style.touchAction='none';canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  const observer=new ResizeObserver(()=>{if(active)resize();});observer.observe(canvas);positionCamera();
  return {setState,setActive,rotate,get debug(){scene.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect();return {active,angle,revealProgress,prizeVisible:revealProgress>.2,prizeAwake,types:Object.keys(BASKET_TYPES),visibleCount:[...records.values()].filter(r=>r.root.visible).length,selectable:[...records.values()].filter(r=>r.root.visible&&available.has(r.item.id)).map(r=>{const p=r.root.localToWorld(new THREE.Vector3(0,.3,0)).project(camera);return{id:r.item.id,type:r.item.type,x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};})};},dispose(){disposed=true;active=false;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();}};
}
