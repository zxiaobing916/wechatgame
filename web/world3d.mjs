import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createArtMaterials } from './art-materials.mjs';
import { createCharacterMotion } from './character-motion.mjs';

/** Original procedural world; imported avatar is a prototype, not final production art. */
export function createWorld({canvas,onPlotClick=()=>{},onRanchClick=()=>{},onRanchCare=()=>{},onMove=()=>{},onReady=()=>{},onError=()=>{}}={}) {
  if(!canvas) throw new Error('A canvas is required');
  let renderer;
  try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch(error){onError(new Error('当前设备无法启动 WebGL，请使用支持 3D 的浏览器。'));throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  const art=createArtMaterials(renderer);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5eddf');scene.fog=new THREE.Fog('#e5eddf',19,46);
  const camera=new THREE.PerspectiveCamera(39,1,.05,100);camera.position.set(10,9,12);
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,.6,0);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=19;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.18;controls.enablePan=false;
  scene.add(new THREE.HemisphereLight('#fff7e9','#9bab88',2.25));
  const sun=new THREE.DirectionalLight('#fff3df',2.5);sun.position.set(-7,13,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:45});sun.shadow.radius=4;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight('#e1e9ed',.45);fill.position.set(6,5,-6);scene.add(fill);
  const materials=new Set(),geometries=new Set();
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,...extra});materials.add(m);return m;};
  const M={grass:mat('#b6cda0'),soil:mat('#ac8868'),wood:mat('#dbbb8e'),woodDark:mat('#8b725a'),cream:mat('#fff2d9'),roof:mat('#a6b8a2'),stone:mat('#e8dcc2'),leaf:mat('#92b481'),leafLight:mat('#bdd39d'),gold:mat('#e7c777'),petal:mat('#e8b4bc'),white:mat('#fff7e8')};
  function mesh(geo,material,parent=scene,x=0,y=0,z=0){geometries.add(geo);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(p,x,y,z,w,h,d,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const rbox=(p,x,y,z,w,h,d,m,r=.08)=>mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.22,h*.22,d*.22)),m,p,x,y,z);
  const sphere=(p,x,y,z,r,m,sx=1,sy=1,sz=1)=>{const o=mesh(new THREE.SphereGeometry(r,16,12),m,p,x,y,z);o.scale.set(sx,sy,sz);return o;};
  const cylinder=(p,x,y,z,r1,r2,h,m)=>mesh(new THREE.CylinderGeometry(r1,r2,h,12),m,p,x,y,z);
  const mutationColors={dewdrop:'#8bd7ce',lush:'#b5cf8c',frost:'#abd9ee',storm:'#c7b0e4'};
  const mutationMaterials=Object.fromEntries(Object.entries(mutationColors).map(([key,color])=>[key,mat(color,{roughness:.42,metalness:.12})]));
  const mutationWool=Object.fromEntries(Object.entries(mutationColors).map(([key,color])=>[key,mat(new THREE.Color('#fff7e8').lerp(new THREE.Color(color),.48))]));
  const mutationKey=value=>typeof value==='string'?value:value?.key;
  function mutationGem(parent,key,x,y,z){if(!mutationMaterials[key])return null;const gem=mesh(new THREE.OctahedronGeometry(.12),mutationMaterials[key],parent,x,y,z);gem.name='MutationGem';return gem;}
  const ground=mesh(new THREE.CircleGeometry(45,96),M.grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.castShadow=false;
  const avatarRoot=new THREE.Group();avatarRoot.position.set(2.25,0,3.5);scene.add(avatarRoot);
  let motion=null;
  let avatar=new THREE.Group();avatarRoot.add(avatar);
  // A visible temporary figure until the actual local glTF is loaded.
  sphere(avatar,0,1.6,0,.16,mat('#ecc4ae'),.85,1.15,.9);
  cylinder(avatar,0,.8,0,.16,.33,1.25,mat('#8fa999'));
  let garment='garden',wardrobeSkin=null,ranchCount=0,ranchBabies=0;
  let face={},outfit='sage',mode='farm',active=true,disposed=false,frame=0,assetLoaded=false;
  const targets=[],cropGroups=[],plotSignatures=[];
  const plotPositions=[];
  for(let r=0;r<2;r++)for(let c=0;c<3;c++){
    const i=r*3+c,x=-4.2+c*2.45,z=-.1+r*2.5;plotPositions.push(new THREE.Vector3(x,0,z));
    const bed=new THREE.Group();bed.position.set(x,0,z);scene.add(bed);
    const dirt=rbox(bed,0,.13,0,2.05,.24,1.9,M.soil);dirt.userData.plot=i;targets.push(dirt);
    rbox(bed,0,.16,-1.01,2.25,.29,.13,M.wood);rbox(bed,0,.16,1.01,2.25,.29,.13,M.wood);
    rbox(bed,-1.06,.16,0,.13,.29,2.12,M.wood);rbox(bed,1.06,.16,0,.13,.29,2.12,M.wood);
    for(let k=0;k<3;k++)rbox(bed,-.6+k*.6,.252,0,.05,.014,1.54,M.soil);
    const crops=new THREE.Group();bed.add(crops);cropGroups.push(crops);
    const marker=box(bed,.82,.48,1.1,.25,.28,.04,M.cream);marker.rotation.y=-.12;
    cylinder(bed,.82,.23,1.1,.025,.025,.5,M.woodDark);
  }
  // A fixed-size feedback pool; repeated care actions never allocate more meshes.
  const careGroup=new THREE.Group();scene.add(careGroup);careGroup.visible=false;
  const careGeometry=new THREE.SphereGeometry(.065,8,6);geometries.add(careGeometry);
  const careMaterials={water:new THREE.MeshBasicMaterial({color:'#7fcfe8',transparent:true,depthWrite:false}),fertilize:new THREE.MeshBasicMaterial({color:'#d5df86',transparent:true,depthWrite:false})};
  Object.values(careMaterials).forEach(m=>materials.add(m));
  const careParticles=Array.from({length:12},()=>{const p=new THREE.Mesh(careGeometry,careMaterials.water);careGroup.add(p);return p;});
  let careStarted=-Infinity,careAction=null,careTarget=null,carePlot=null;
  function playCare({target:area='farm',plotIndex=0,action='water'}={}){
    if(disposed||!['farm','ranch'].includes(mode)||!['farm','ranch'].includes(area)||!Object.hasOwn(careMaterials,action))return false;
    if(area==='farm'&&(!Number.isInteger(plotIndex)||!plotPositions[plotIndex]))return false;
    careStarted=performance.now();careAction=action;careTarget=area;carePlot=area==='farm'?plotIndex:null;
    if(area==='farm')careGroup.position.copy(plotPositions[plotIndex]);else careGroup.position.set(6,0,action==='water'?-.9:.9);
    careParticles.forEach(p=>{p.material=careMaterials[action];p.scale.set(action==='water'?.65:1,action==='water'?1.6:1,.65);});
    updateCare(careStarted);return true;
  }
  function updateCare(now){
    const progress=(now-careStarted)/1200;
    careGroup.visible=progress>=0&&progress<1&&['farm','ranch'].includes(mode);
    if(!careGroup.visible)return;
    careMaterials[careAction].opacity=Math.min(1,(1-progress)*3);
    careParticles.forEach((p,i)=>{
      const angle=i*2.39996,radius=.24+(i%4)*.16;
      const phase=Math.min(1,Math.max(0,(progress-(i%3)*.06)/.88));
      p.position.set(Math.cos(angle)*radius,careAction==='water'?1.75-phase*1.35: .45+phase*1.2,Math.sin(angle)*radius);
      const pulse=careAction==='fertilize'? .7+Math.sin(phase*Math.PI)*.55:1;
      p.scale.set((careAction==='water'?.65:1)*pulse,(careAction==='water'?1.6:1)*pulse,.65*pulse);
    });
  }
  // A rounded cream cottage: broad readable forms, restrained colour blocks.
  const cottage=new THREE.Group();cottage.position.set(-3.8,0,-5.3);scene.add(cottage);
  rbox(cottage,0,1.22,0,4.1,2.44,2.8,M.cream,.14);
  rbox(cottage,0,.13,.33,4.65,.26,3.5,M.stone,.12);
  rbox(cottage,0,.08,2.15,1.55,.16,.55,M.stone);
  const gableShape=new THREE.Shape();gableShape.moveTo(-2.04,2.36);gableShape.lineTo(0,3.47);gableShape.lineTo(2.04,2.36);gableShape.closePath();
  mesh(new THREE.ExtrudeGeometry(gableShape,{depth:2.78,bevelEnabled:false}),M.cream,cottage,0,0,-1.39);
  for(const side of [-1,1]){
    const slope=rbox(cottage,side*1.12,2.98,0,2.66,.22,3.5,M.roof,.075);slope.rotation.z=-side*.48;
    const fascia=rbox(cottage,side*1.12,2.97,1.76,2.68,.18,.14,M.cream,.04);fascia.rotation.z=-side*.48;
  }
  rbox(cottage,0,3.57,0,.2,.15,3.55,M.roof,.06);
  rbox(cottage,0,1.06,1.43,.92,1.91,.11,M.wood,.1);
  rbox(cottage,0,1.08,1.5,.72,1.7,.07,M.roof,.08);
  rbox(cottage,0,1.45,1.55,.48,.6,.035,mat('#d8e7df'),.07);
  sphere(cottage,.24,.91,1.59,.046,M.gold);
  const glass=mat('#bedbd3',{roughness:.5});
  for(const x of [-1.3,1.3]){
    rbox(cottage,x,1.43,1.43,.98,.99,.12,M.wood,.1);
    rbox(cottage,x,1.43,1.51,.79,.8,.055,glass,.08);
    rbox(cottage,x,1.43,1.55,.055,.8,.035,M.cream,.015);
    rbox(cottage,x,1.43,1.55,.8,.055,.035,M.cream,.015);
    rbox(cottage,x,.86,1.63,1.12,.24,.35,M.cream,.06);
    for(let j=0;j<3;j++){
      sphere(cottage,x-.31+j*.31,1.04,1.64,.19,M.leafLight,1,.7,.7);
      sphere(cottage,x-.3+j*.3,1.14,1.71,.105,j===1?M.white:M.petal,1,.75,.7);
      sphere(cottage,x-.3+j*.3,1.16,1.78,.035,M.gold);
    }
  }
  rbox(cottage,1.2,3.12,-.5,.46,.95,.5,M.cream,.07);
  rbox(cottage,1.2,3.63,-.5,.61,.16,.64,M.wood,.05);
  // Single attic medallion is legible from the normal gameplay camera.
  const attic=mesh(new THREE.CircleGeometry(.23,24),M.roof,cottage,0,2.72,1.41);
  const atticRim=mesh(new THREE.TorusGeometry(.23,.045,6,24),M.wood,cottage,0,2.72,1.43);
  rbox(cottage,0,2.72,1.45,.035,.43,.025,M.cream,.01);
  for(const x of [-.76,.76]){
    cylinder(cottage,x,.22,1.95,.2,.15,.36,M.cream);
    sphere(cottage,x,.52,1.95,.27,M.leafLight,.85,1,.85);
    sphere(cottage,x,.71,1.98,.105,M.petal);
  }

  // Walkway with softly irregular stones.
  for(let n=0;n<12;n++){const p=mesh(new THREE.CylinderGeometry(.36,.4,.045,7),M.stone,scene,2.25+Math.sin(n*.7)*.13,.02,4.8-n*.82);p.rotation.y=n*.7;}
  function fence(x1,z1,x2,z2){const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),n=Math.ceil(len/1.5);for(let i=0;i<=n;i++)cylinder(scene,x1+dx*i/n,.43,z1+dz*i/n,.065,.08,.86,M.wood);for(const y of [.32,.66]){const bar=box(scene,(x1+x2)/2,y,(z1+z2)/2,len,.1,.09,M.cream);bar.rotation.y=-Math.atan2(dz,dx);}}
  fence(-7,-7,7,-7);fence(-7,-7,-7,6);fence(7,-7,7,6);fence(-7,6,-1,6);fence(2.4,6,7,6);
  fence(3.4,-2,6.6,-2);fence(3.4,-2,3.4,2.8);fence(3.4,2.8,6.6,2.8);
  // Open troughs have a recessed floor so an empty supply is visibly empty.
  const troughGroup=new THREE.Group();scene.add(troughGroup);
  const troughLevels={water:0,feed:0},troughContents={};
  const waterMaterial=mat('#8ecad5',{roughness:.35});
  const feedMaterial=mat('#d7b66f');
  const collarMaterials={male:mat('#8bbad5'),female:mat('#dfa6b4')};
  for(const [kind,z] of [['water',-.9],['feed',.9]]){
    const g=new THREE.Group();g.position.set(6,0,z);troughGroup.add(g);
    rbox(g,0,.055,0,.66,.1,1.24,M.woodDark);
    for(const x of [-.3,.3])rbox(g,x,.11,0,.1,.08,1.24,M.wood);
    for(const edge of [-.57,.57])rbox(g,0,.11,edge,.62,.08,.1,M.wood);
    const content=rbox(g,0,.095,0,.49,.04,1.03,kind==='water'?waterMaterial:feedMaterial,.025);
    if(kind==='water')content.castShadow=false;
    const contents=new THREE.Group();g.add(contents);contents.add(content);
    if(kind==='feed')for(let i=0;i<12;i++)sphere(contents,Math.sin(i*2.4)*.16,.12,Math.cos(i*1.7)*.41,.045,feedMaterial,1,.55,1);
    contents.visible=false;troughContents[kind]=contents;
    // Small drop / grain emblem differentiates the troughs even when empty.
    sphere(g,0,.105,.639,.09,kind==='water'?waterMaterial:feedMaterial,.65,1.15,.25);
    g.traverse(o=>{if(o.isMesh)o.userData.ranchCare=kind;});
  }
  const moonCream=mat('#fff0d8'),moonLilac=mat('#c4a8df'),moonGold=mat('#f0cc7f',{roughness:.38,metalness:.22});
  const sheep=[],sheepRecords=new Map(),ranchGroup=new THREE.Group();scene.add(ranchGroup);
  const paddock=box(scene,5,.035,.4,3.1,.035,4.5,mat('#adc797'));paddock.userData.ranch=true;
  const behaviorOrder=['walk','graze','rest'];
  const sheepGrowthMs=8*60*60*1000;
  const troughBounds=[{minX:5.65,maxX:6.35,minZ:-1.52,maxZ:-.28},{minX:5.65,maxX:6.35,minZ:.28,maxZ:1.52}];
  function clearOfTroughs(x,z,radius){return troughBounds.every(b=>Math.hypot(x-clamp(x,b.minX,b.maxX),z-clamp(z,b.minZ,b.maxZ))>=radius);}
  function safePosition(record,x,z){const radius=record.root.scale.x*.49;return clearOfTroughs(x,z,radius);}
  const troughReservations={water:null,feed:null},troughQueues={water:[],feed:[]};
  const troughKind=record=>record.state==='drink'?'water':record.state==='eat'?'feed':null;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function sheepRandom(record){record.seed=(Math.imul(record.seed,1664525)+1013904223)>>>0;return record.seed/4294967296;}
  function releaseTrough(record){
    for(const kind of ['water','feed']){
      if(troughReservations[kind]===record.id)troughReservations[kind]=null;
      troughQueues[kind]=troughQueues[kind].filter(id=>id!==record.id);
    }
    record.slot=null;record.queuedFor=null;record.serviceTime=0;
  }
  function reserveTroughs(){
    for(const kind of ['water','feed']){
      troughQueues[kind]=troughQueues[kind].filter(id=>{const r=sheepRecords.get(id);return r&&troughKind(r)===kind;});
      if(!troughReservations[kind]&&troughQueues[kind].length){
        const record=sheepRecords.get(troughQueues[kind].shift());
        troughReservations[kind]=record.id;record.slot=kind;record.queuedFor=null;record.serviceTime=0;record.remaining=30;record.approachLane=true;
        record.target.set(5.65-record.root.scale.x*.49-.04,0,kind==='water'?-.9:.9);
      }
    }
  }
  function nextSheepBehavior(record,initial=false){
    const hadSlot=record.slot;releaseTrough(record);
    if(!initial)record.phase=(record.phase+1)%behaviorOrder.length;
    const pendingKind=record.pendingCare.shift();
    let state=pendingKind==='water'?'drink':pendingKind==='feed'?'eat':behaviorOrder[record.phase];
    record.state=state;record.remaining=6+sheepRandom(record)*4;
    const kind=troughKind(record);
    if(kind){
      // Every waiting animal retains its own home target, never the shared service point.
      record.queuedFor=kind;troughQueues[kind].push(record.id);record.target.copy(record.home);
    }else if(state==='walk'||hadSlot){
      if(hadSlot){record.state='walk';record.target.copy(record.home);}
      else record.target.set(3.95+sheepRandom(record)*.65,0,-1.2+sheepRandom(record)*3.25);
    }else record.target.copy(record.root.position);
  }
  function addSheep(id,x,z,sex,index){
    const g=new THREE.Group();g.position.set(x,0,z);ranchGroup.add(g);
    const body=new THREE.Group();g.add(body);
    sphere(body,0,.55,0,.34,M.white,1.3,.95,.85);
    for(let i=0;i<8;i++)sphere(body,Math.cos(i*2.4)*.26,.57+Math.sin(i*1.8)*.12,Math.sin(i*2.4)*.2,.17,M.white);
    const neck=sphere(body,0,.55,.25,.12,M.woodDark,.8,1,1);
    const head=new THREE.Group();head.position.set(0,.58,.25);body.add(head);
    const dark=M.woodDark;sphere(head,0,.08,.15,.17,dark,.8,1.1,1);
    const legs=[];
    for(const side of [-1,1]){
      sphere(head,side*.16,.14,.13,.08,dark,1,.4,.6);sphere(head,side*.09,.11,.28,.025,M.white);sphere(head,side*.09,.11,.3,.012,dark);
      for(const t of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.19,.36,t*.18);body.add(leg);cylinder(leg,0,-.17,0,.045,.045,.35,dark);legs.push(leg);}
    }
    if(collarMaterials[sex]){const collar=mesh(new THREE.TorusGeometry(.155,.036,6,16),collarMaterials[sex],head,0,-.01,.13);collar.rotation.x=Math.PI/2;sphere(head,0,-.05,.28,.065,collarMaterials[sex],1,1,.35);}
    g.traverse(o=>{if(o.isMesh){o.userData.ranch=true;if(o.material===M.white&&o.parent===body)o.userData.wool=true;}});
    const moonDetails=new THREE.Group();moonDetails.name='MoonSheepDetails';body.add(moonDetails);moonDetails.visible=false;
    for(const side of [-1,1])for(let i=0;i<3;i++)sphere(moonDetails,side*(.28+i*.015),.59+i*.065,(i-1)*.15,.13,moonLilac,.65,1,.9);
    sphere(moonDetails,0,.83,-.1,.145,moonLilac,1.3,.65,1);
    // An actual crescent silhouette, not a whole ring or a texture decal.
    const crescent=new THREE.Shape();crescent.moveTo(.055,.115);crescent.absarc(0,0,.128,Math.PI/3,Math.PI*5/3,false);crescent.quadraticCurveTo(-.055,0,.055,.115);
    const pin=mesh(new THREE.ExtrudeGeometry(crescent,{depth:.035,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:16}),moonGold,head,0,.21,.32);pin.name='MoonCrescentPin';pin.scale.setScalar(.72);pin.visible=false;
    const mutationMarker=mutationGem(body,'dewdrop',0,1.04,0);mutationMarker.visible=false;
    let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    const record={id,root:g,body,head,neck,legs,moonDetails,moonPin:pin,breed:null,mutationMarker,mutation:null,seed,state:'walk',phase:index%3,pendingCare:[],lastCare:{water:0,feed:0},remaining:0,target:new THREE.Vector3(),home:index<5?new THREE.Vector3(4,0,-1.3+index*.8):index===5?new THREE.Vector3(5,0,1.9):new THREE.Vector3(x,0,z),slot:null,queuedFor:null,serviceTime:0,age:0,growthMs:sheepGrowthMs};
    sheepRecords.set(id,record);nextSheepBehavior(record,true);return record;
  }
  function setRanch(ranch={},now=Date.now()){
    const animals=Array.isArray(ranch.animals)?ranch.animals.slice(0,6):(ranch.speciesId==='sheep'?[{id:'legacy',sex:null}]:[]);
    const batch=ranch.batch,mature=Boolean(batch&&now>=batch.maturesAt);
    const count=mature&&!batch.collected?Math.min(4,Math.max(0,Math.floor((Number(batch.initialYield)||0)-(Number(batch.stolen)||0)))):0;
    for(const kind of ['water','feed']){
      const level=clamp(Number(ranch.supplies?.[kind])||0,0,4);troughLevels[kind]=level;
      troughContents[kind].visible=level>0;troughContents[kind].position.y=-.045+level*.0125;
    }
    const desired=animals.map((animal,i)=>({...animal,id:String(animal.id),x:4+(i%2)*.82,z:[-1.3,0,1.45][Math.floor(i/2)]}));
    for(let i=0;i<count;i++)desired.push({id:`offspring:${batch.batchId}:${i}`,x:3.95+i*.5,z:2.2,baby:true,mutation:batch.mutation});
    const ids=new Set(desired.map(a=>a.id));
    for(const [id,record] of sheepRecords)if(!ids.has(id)){releaseTrough(record);clearGroup(record.root);ranchGroup.remove(record.root);sheepRecords.delete(id);}
    desired.forEach((animal,i)=>{
      const existed=sheepRecords.has(animal.id);
      const record=sheepRecords.get(animal.id)||addSheep(animal.id,animal.x,animal.z,animal.sex,i);
      const mutation=mutationKey(animal.mutation);record.mutation=mutationMaterials[mutation]?mutation:null;
      record.mutationMarker.visible=Boolean(record.mutation);if(record.mutation)record.mutationMarker.material=mutationMaterials[record.mutation];
      record.breed=animal.breed==='moon'?'moon':null;record.moonDetails.visible=record.moonPin.visible=record.breed==='moon';
      record.body.children.forEach(o=>{if(o.userData.wool)o.material=record.breed==='moon'?moonCream:(mutationWool[record.mutation]||M.white);});
      record.growthMs=animal.baby?0:clamp(Number.isFinite(animal.growthMs)?animal.growthMs:sheepGrowthMs,0,sheepGrowthMs);
      record.root.scale.setScalar(animal.baby?.43:.6+.2*record.growthMs/sheepGrowthMs);
      for(const kind of ['water','feed']){
        const timestamp=Number(animal[kind==='water'?'lastWaterAt':'lastFeedAt'])||0;
        if(existed&&timestamp>record.lastCare[kind])record.pendingCare.push(kind);
        record.lastCare[kind]=timestamp;
      }
      if(record.pendingCare.length&&!record.slot&&!record.queuedFor)nextSheepBehavior(record,true);
    });
    sheep.length=0;sheep.push(...[...sheepRecords.values()].map(r=>r.root));ranchCount=animals.length;ranchBabies=count;reserveTroughs();
  }
  function sheepGap(a,b){return (a.root.scale.x+b.root.scale.x)*.49;}
  function atTrough(record){return Boolean(record.slot)&&record.root.position.distanceTo(record.target)<.09;}
  function updateSheep(dt){
    const records=[...sheepRecords.values()];reserveTroughs();
    for(const record of records){
      record.age+=dt;
      // FIFO waiting has no expiry; each reservation has a bounded travel/service time.
      if(!record.queuedFor)record.remaining-=dt;
      if(atTrough(record))record.serviceTime+=dt;
      if(record.remaining<=0||record.serviceTime>=4){
        // A blocked approach yields its reservation, but never discards the care event.
        if(record.slot&&record.serviceTime<4)record.pendingCare.unshift(record.slot);
        nextSheepBehavior(record);
      }
    }
    reserveTroughs();
    for(const record of records){
      const p=record.root.position;
      if(record.slot&&Math.abs(p.x-record.target.x)<.09)record.approachLane=false;
      const lane=record.slot&&record.approachLane;
      const dx=record.target.x-p.x,dz=lane?0:record.target.z-p.z,distance=Math.hypot(dx,dz);
      let walking=false;
      if(['walk','drink','eat'].includes(record.state)&&distance>.08&&!atTrough(record)){
        const step=Math.min(distance,dt*.34),heading=Math.atan2(dx,dz);
        // Reject penetrating steps before moving. Alternate steering directions let a
        // moving sheep pass stationary sheep instead of pushing them through each other.
        for(const turn of [0,.65,-.65,1.25,-1.25,1.8,-1.8]){
          const nx=clamp(p.x+Math.sin(heading+turn)*step,3.9,5.5),nz=clamp(p.z+Math.cos(heading+turn)*step,-1.3,2.2);
          if(Math.hypot(nx-p.x,nz-p.z)<step*.25||!safePosition(record,nx,nz))continue;
          const blocked=records.some(other=>other!==record&&Math.hypot(nx-other.root.position.x,nz-other.root.position.z)<sheepGap(record,other)&&Math.hypot(nx-other.root.position.x,nz-other.root.position.z)<Math.hypot(p.x-other.root.position.x,p.z-other.root.position.z)+.00001);
          if(blocked)continue;
          const wanted=Math.atan2(nx-p.x,nz-p.z);p.set(nx,0,nz);walking=true;
          record.root.rotation.y+=Math.atan2(Math.sin(wanted-record.root.rotation.y),Math.cos(wanted-record.root.rotation.y))*Math.min(1,dt*5);break;
        }
      }
      const serving=atTrough(record);
      if(serving)record.root.rotation.y+=Math.atan2(Math.sin(Math.PI/2-record.root.rotation.y),Math.cos(Math.PI/2-record.root.rotation.y))*Math.min(1,dt*5);
      const resting=record.state==='rest',bend=!walking&&(record.state==='graze'||serving);
      record.body.position.y=THREE.MathUtils.damp(record.body.position.y,resting?-.19:walking?Math.sin(record.age*9)*.012:0,7,dt);
      record.head.position.y=THREE.MathUtils.damp(record.head.position.y,serving?.57:.58,6,dt);
      record.head.position.z=THREE.MathUtils.damp(record.head.position.z,serving?.60:.25,6,dt);
      record.neck.position.z=THREE.MathUtils.damp(record.neck.position.z,serving?.42:.25,6,dt);
      record.neck.scale.z=THREE.MathUtils.damp(record.neck.scale.z,serving?2:1,6,dt);
      record.head.rotation.x=THREE.MathUtils.damp(record.head.rotation.x,resting?.2:bend?.72+Math.sin(record.age*3)*.07:0,6,dt);
      record.legs.forEach((leg,i)=>{const desired=resting?(i%2?1.15:-1.15):walking?Math.sin(record.age*9+(i===0||i===3?0:Math.PI))*.38:0;leg.rotation.x=THREE.MathUtils.damp(leg.rotation.x,desired,9,dt);});
    }
    // Resolve growth/spawn overlap gently. A stationary trough occupant is anchored;
    // all separation is assigned to the approaching animal, never the occupant.
    for(let pass=0;pass<3;pass++)for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
      const ra=records[i],rb=records[j],a=ra.root.position,b=rb.root.position,dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),minimum=sheepGap(ra,rb);
      if(d<minimum-.001){
        const push=Math.min(minimum-d,dt*.3),nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;
        const wa=atTrough(ra)?0:atTrough(rb)?1:.5,wb=1-wa;
        const ax=clamp(a.x-nx*push*wa,3.9,5.5),az=clamp(a.z-nz*push*wa,-1.3,2.2),bx=clamp(b.x+nx*push*wb,3.9,5.5),bz=clamp(b.z+nz*push*wb,-1.3,2.2);
        if(safePosition(ra,ax,az))a.set(ax,0,az);
        if(safePosition(rb,bx,bz))b.set(bx,0,bz);
      }
    }
  }
  function tree(x,z,size=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);scene.add(g);cylinder(g,0,1.15,0,.13,.22,2.3,M.woodDark);sphere(g,0,2.65,0,1.05,M.leaf,1,1.13,1);sphere(g,-.65,2.2,.1,.75,M.leafLight);sphere(g,.65,2.32,.13,.8,M.leaf);}
  tree(-8,-4,1.4);tree(6,-5,1.3);tree(-8,4,1);tree(9,3,1.5);tree(2,-9,1.5);tree(-3,-10,1.6);
  // Background banks and low flowers have deterministic positions for stable screenshots.
  for(let i=0;i<5;i++){sphere(scene,-19+i*9,-1.8,-19-Math.sin(i)*2,6,M.leafLight,1.3,.5,1);}
  for(let i=0;i<32;i++){const x=Math.sin(i*12.9898)*8,z=Math.cos(i*7.236)*7;if((x>-6.2&&x<6.8&&z>-6.8&&z<4.2)||Math.abs(x)<1.5)continue;cylinder(scene,x,.12,z,.015,.02,.24,M.leaf);sphere(scene,x,.27,z,.065,i%3?M.white:M.petal);}
  const fantasy=new THREE.Group();fantasy.position.set(5.2,0,-4.6);scene.add(fantasy);
  for(let i=0;i<5;i++){const x=Math.cos(i*1.3)*.4,z=Math.sin(i*1.3)*.4;cylinder(fantasy,x,.45,z,.025,.035,.9,M.leaf);const bloom=sphere(fantasy,x,1,z,.19,mat('#c6b4ed',{emissive:'#9c7cca',emissiveIntensity:.18}),.7,1.4,.7);bloom.rotation.z=i*.3;}
  function clearGroup(g){g.traverse(o=>{if(o.isMesh){o.geometry.dispose();geometries.delete(o.geometry);}});g.clear();}
  function setPlots(plots=[],now=Date.now()){
    plots.slice(0,6).forEach((entry,i)=>{
      const batch=entry && Object.hasOwn(entry,'batch') ? entry.batch : entry;
      const mature=batch&&now>=batch.maturesAt;const sig=batch?`${batch.batchId}:${batch.productId}:${mature}:${mutationKey(batch.mutation)}`:'empty';if(plotSignatures[i]===sig)return;plotSignatures[i]=sig;
      const g=cropGroups[i];clearGroup(g);if(!batch)return;
      for(let n=0;n<6;n++){const x=-.65+(n%3)*.65,z=-.47+Math.floor(n/3)*.94;
        if(!mature){for(const s of [-1,1]){const leaf=sphere(g,x+s*.075,.35,z,.13,M.leafLight,.45,1.2,.7);leaf.rotation.z=s*.6;}continue;}
        if(batch.productId==='watermelon'){sphere(g,x,.43,z,.24,M.leaf,1.2,.85,1);for(let k=-1;k<=1;k++){const stripe=mesh(new THREE.TorusGeometry(.238, .012,5,24),M.leafLight,g,x+k*.075,.43,z);stripe.rotation.y=Math.PI/2;stripe.scale.set(1,.86,1);}sphere(g,x-.2,.28,z,.14,M.leaf,.9,.2,1.5);}
        else if(batch.productId==='corn'){cylinder(g,x,.72,z,.025,.035,.92,M.leaf);for(const s of [-1,1]){const leaf=sphere(g,x+s*.13,.64,z,.27,M.leafLight,.24,1,.3);leaf.rotation.z=-s*.65;}sphere(g,x,.95,z,.14,M.gold,.6,1.8,.7);}
        else {cylinder(g,x,.55,z,.025,.035,.6,M.leaf);sphere(g,x,.88,z,.18,M.petal,.8,1.4,.8);for(const s of [-1,1])sphere(g,x+s*.12,.5,z,.15,M.leafLight,1,.3,.6);}
      }
      mutationGem(g,mutationKey(batch.mutation),.82,.82,.72);
      g.traverse(o=>{if(o.isMesh){o.userData.plot=i;}});
    });
  }
  const baseline=new Map();
  function remember(){avatar.traverse(o=>{baseline.set(o,{position:o.position.clone(),scale:o.scale.clone(),rotation:o.rotation.clone()});});}
  function setFace(next={}){face={...next};if(!assetLoaded)return;const n=k=>THREE.MathUtils.clamp(Number(face[k])||0,-50,50)/50;
    avatar.traverse(o=>{
      const b=baseline.get(o);if(!b)return;
      if(o.morphTargetDictionary&&o.morphTargetInfluences){for(const [name,index] of Object.entries(o.morphTargetDictionary)){const key=Object.keys(face).find(k=>k.toLowerCase()===name.toLowerCase());if(key)o.morphTargetInfluences[index]=n(key);}}
      const name=o.name.toLowerCase();if(/^eye[lr]$/.test(name)||/^eye_[lr]$/.test(name)){const sign=name.endsWith('l')?-1:1;o.scale.x=b.scale.x*(1+n('eyeWidth')*.22);o.scale.y=b.scale.y*(1+n('eyeHeight')*.3);o.position.x=b.position.x+sign*n('eyeSpace')*.025;o.rotation.z=b.rotation.z-sign*n('eyeTilt')*.15;}
      if(/^brow[_]?[lr]$/.test(name))o.position.y=b.position.y+n('browHeight')*.025;
      if(name==='nose')o.scale.x=b.scale.x*(1+n('noseWidth')*.3);
      if(name==='mouth')o.scale.x=b.scale.x*(1+n('mouthWidth')*.3);
    });
    if(next.outfit)setOutfit(next.outfit);
  }
  function setOutfit(id='sage'){outfit=id;const colors={sage:'#8fa793',lilac:'#a499c0',rose:'#c594a2'};cloth.color.set(colors[id]||colors.sage);avatar.traverse(o=>{if(o.isMesh&&/outfitskirt|dress/i.test(o.name)){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.color)m.color.set(colors[id]||colors.sage);}});}
  // Alternate silhouettes are original procedural garments on the same avatar identity.
  const garmentRoot=new THREE.Group();garmentRoot.name='WardrobeGarments';garmentRoot.scale.set(1.2,.72,1.2);avatarRoot.add(garmentRoot);
  const cloth=mat('#8fa793',{roughness:.7,side:THREE.DoubleSide});
  const clothLight=mat('#eee5d4',{roughness:.78,side:THREE.DoubleSide});
  const leather=mat('#494b54',{roughness:.8});
  const trim=mat('#b9a16b',{metalness:.45,roughness:.4});
  art.fabric(cloth,true);art.fabric(clothLight);
  const garments={court:new THREE.Group(),ranger:new THREE.Group()};
  Object.entries(garments).forEach(([id,g])=>{g.name=`Garment_${id}`;garmentRoot.add(g);});
  function hem(parent,y,radius,depth,material){const o=mesh(new THREE.TorusGeometry(radius,.007,6,64),material,parent,0,y,0);o.rotation.x=Math.PI/2;o.scale.y=depth;return o;}
  function skirt(parent,profile,material,depth=.8,start=0,length=Math.PI*2){
    const geo=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48,start,length);
    const o=mesh(geo,material,parent);o.scale.z=depth;return o;
  }
  // Court: bell silhouette with a separate overskirt, shoulder cape and pearl cuffs.
  const court=garments.court;
  skirt(court,[[.36,.12],[.39,.18],[.34,.38],[.27,.65],[.19,.85],[.137,1.04]],clothLight);
  skirt(court,[[.415,.27],[.36,.48],[.29,.72],[.195,.94],[.155,1.05]],cloth,.83,.2,Math.PI*2-.4);
  skirt(court,[[.137,.99],[.13,1.1],[.155,1.26],[.17,1.32]],cloth,.68);
  skirt(court,[[.19,1.31],[.21,1.27],[.23,1.18]],clothLight,.77,.7,Math.PI*2-1.4);
  hem(court,.14,.367,.8,trim);hem(court,.275,.414,.83,trim);hem(court,1.045,.14,.68,trim);
  for(const side of [-1,1]){
    const sleeve=sphere(court,side*.198,1.245,0,.082,clothLight,.8,1.2,.83);sleeve.rotation.z=side*.22;
    cylinder(court,side*.24,1.14,.003,.057,.061,.05,trim);
    for(let i=0;i<4;i++)sphere(court,side*(.155+i*.014),1.32-i*.025,.055,.01,trim);
  }
  sphere(court,0,1.27,.112,.019,trim,1,1.3,.4);
  // Ranger: separate trouser legs and tall boots under an open long coat.
  const ranger=garments.ranger;
  for(const side of [-1,1]){
    cylinder(ranger,side*.083,.57,0,.065,.065,.68,leather);
    cylinder(ranger,side*.085,.245,0,.073,.066,.34,leather);
    sphere(ranger,side*.085,.075,.04,.075,leather,.95,.72,1.65);
    cylinder(ranger,side*.085,.405,0,.076,.076,.026,trim);
    const sleeve=cylinder(ranger,side*.205,1.225,0,.061,.055,.24,cloth);sleeve.rotation.z=side*.22;
    cylinder(ranger,side*.24,1.105,.005,.055,.05,.09,leather);
  }
  skirt(ranger,[[.127,.86],[.122,1.04],[.127,1.17],[.145,1.32]],clothLight,.7);
  skirt(ranger,[[.235,.44],[.22,.65],[.155,.95],[.14,1.07],[.16,1.28],[.18,1.32]],cloth,.7,.42,Math.PI*2-.84);
  cylinder(ranger,0,1.045,0,.15,.15,.055,leather).scale.z=.72;
  box(ranger,0,1.045,.114,.052,.038,.012,trim);
  for(const side of [-1,1]){const lapel=box(ranger,side*.064,1.225,.105,.043,.18,.014,cloth);lapel.rotation.z=side*.25;}
  // Continuous shoulder/chest yoke reaches the existing neck; closed underlayers
  // prevent the background showing through the open coat or neckline.
  for(const g of [court,ranger]){
    skirt(g,[[.14,1.27],[.155,1.32],[.17,1.345],[.13,1.38],[.061,1.415],[.055,1.46]],clothLight,.72);
    hem(g,1.455,.056,.72,trim);
  }
  // Atelier ornaments are original lightweight meshes, allocated once and owned
  // by the world. Their materials never recolor shared scenery or animal meshes.
  const skinRoot=new THREE.Group();skinRoot.name='AtelierOrnaments';garmentRoot.add(skinRoot);
  const skinGroups=Object.fromEntries(['dawn','moon','forest'].map(id=>{const group=new THREE.Group();group.name=`Atelier_${id}`;skinRoot.add(group);return [id,group];}));
  const skinM={pink:mat('#e8a7a4',{roughness:.64}),peach:mat('#f7d4af'),pearl:mat('#fff3dc',{roughness:.48}),silver:mat('#b8c9de',{metalness:.3,roughness:.44}),violet:mat('#bbb0d7'),leaf:mat('#6b997e'),lightLeaf:mat('#b2cca2'),gold:mat('#d5b775',{metalness:.35,roughness:.5})};
  function atelierFlower(parent,x,y,z,r){
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5,p=sphere(g,Math.sin(a)*r*.57,Math.cos(a)*r*.57,0,r*.48,skinM.pink,.8,1,.32);p.rotation.z=-a;}
    sphere(g,0,0,r*.12,r*.29,skinM.peach,1,1,.45);return g;
  }
  function atelierLeaf(parent,x,y,z,r,angle,material=skinM.leaf){const leaf=sphere(parent,x,y,z,r,material,.5,1.6,.2);leaf.rotation.z=angle;return leaf;}
  const dawn=skinGroups.dawn;
  atelierFlower(dawn,-.11,1.07,.13,.064);
  for(let i=0;i<3;i++)atelierFlower(dawn,.07+i*.064,.43-i*.045,.27,.034);
  for(const side of [-1,1]){const ribbon=box(dawn,-.11+side*.025,.925,.133,.027,.22,.009,skinM.pearl);ribbon.rotation.z=side*.23;}
  const moon=skinGroups.moon;
  const crescent=mesh(new THREE.TorusGeometry(.046,.011,8,28,Math.PI*1.5),skinM.silver,moon,0,1.285,.147);crescent.rotation.z=Math.PI*.25;
  sphere(moon,.029,1.291,.154,.012,skinM.pearl);
  for(const side of [-1,1])for(let i=0;i<3;i++)atelierLeaf(moon,side*(.17+i*.021),1.27-i*.026,.085,.034,side*(.65+i*.2),i%2?skinM.violet:skinM.pearl);
  for(let i=0;i<5;i++){const x=(i-2)*.067;const bead=sphere(moon,x,.34+Math.abs(i-2)*.027,.30-Math.abs(i-2)*.017,.013,skinM.silver);sphere(moon,x,bead.position.y-.045,bead.position.z,.014,skinM.pearl,.7,1.4,.5);}
  const forest=skinGroups.forest;
  for(let i=0;i<5;i++)atelierLeaf(forest,-.1+i*.043,1.30-i*.058,.132,.036,i%2?.6:-.6,i%2?skinM.lightLeaf:skinM.leaf);
  atelierLeaf(forest,-.10,1.025,.142,.055,-.8);atelierLeaf(forest,-.042,1.02,.145,.045,.65,skinM.lightLeaf);
  sphere(forest,-.074,1.02,.16,.018,skinM.gold);
  for(const x of [-.10,-.04]){const cord=box(forest,x,.89,.13,.009,.20,.008,skinM.gold);cord.rotation.z=-.12;atelierLeaf(forest,x+.014,.78,.13,.028,-.2,skinM.lightLeaf);}
  function setWardrobeSkin(id=null){
    wardrobeSkin=Object.hasOwn(skinGroups,id)?id:null;
    for(const [key,group] of Object.entries(skinGroups))group.visible=key===wardrobeSkin;
    // The three silhouettes share torso coordinates but have different skirt depth.
    dawn.children.slice(1,4).forEach(o=>{o.position.z=garment==='court'?.32:garment==='ranger'?.18:.27;});
    moon.children.slice(-10).forEach(o=>{o.position.z=garment==='court'?.33:garment==='ranger'?.18:.27;});
    return wardrobeSkin;
  }
  function setGarment(id='garden'){
    garment=['garden','court','ranger'].includes(id)?id:'garden';
    avatar.traverse(o=>{if(/^(Outfit|EmbroideryPetal|FlowerCenter|SkirtGoldSeam)/.test(o.name))o.visible=garment==='garden';if(/^Boot[LR]$/.test(o.name))o.visible=garment!=='ranger';});
    for(const [id,g] of Object.entries(garments))g.visible=id===garment;
    setWardrobeSkin(wardrobeSkin);
  }
  setGarment(garment);
  const target=new THREE.Vector3().copy(avatarRoot.position);const keys=new Set();
  function moveTo(x,z){if(mode!=='farm')return;target.set(THREE.MathUtils.clamp(x,-6.3,6.3),0,THREE.MathUtils.clamp(z,-2.5,5.4));}
  function setMode(next){
    mode=['farm','ranch','wardrobe','face'].includes(next)?next:'farm';
    target.copy(avatarRoot.position);keys.clear();avatar.position.y=0;motion?.reset();
    const studio=mode==='face'||mode==='wardrobe';
    if(studio)careStarted=-Infinity;
    scene.children.forEach(o=>{if(o!==avatarRoot&&!o.isLight)o.visible=!studio;});
    updateCare(performance.now());
    scene.background.set(studio?'#e8e7db':'#e5eddf');scene.fog=studio?null:new THREE.Fog('#e5eddf',19,46);
    if(studio){
      avatarRoot.rotation.y=0;
      const p=avatarRoot.position,faceMode=mode==='face';
      camera.position.set(p.x,faceMode?1.30:1.0,p.z+(faceMode?1.55:3.15));
      controls.target.set(p.x,faceMode?1.25:.83,p.z);
      controls.minDistance=faceMode?.7:2.2;controls.maxDistance=faceMode?2.8:4.8;
      controls.minPolarAngle=.6;controls.maxPolarAngle=2.1;
    }else{
      camera.position.set(...(mode==='ranch'?[5,7,7]:[10,9,12]));
      controls.target.set(...(mode==='ranch'?[4.7,.5,.4]:[0,.6,0]));
      controls.minDistance=5;controls.maxDistance=19;controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI*.46;
    }
    controls.update();
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  function pointerDown(e){down={x:e.clientX,y:e.clientY,id:e.pointerId};}
  function pointerUp(e){if(!down||down.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>7||!['farm','ranch'].includes(mode))return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const ranchHits=ray.intersectObjects([paddock,ranchGroup,troughGroup],true);if(ranchHits.length){const care=ranchHits[0].object.userData.ranchCare;if(care)onRanchCare(care);else onRanchClick();return;}if(mode==='ranch')return;const hits=ray.intersectObjects([...targets,...cropGroups],true);if(hits.length){onPlotClick(hits[0].object.userData.plot);return;}const land=ray.intersectObject(ground);if(land.length)moveTo(land[0].point.x,land[0].point.z);}
  function keydown(e){if(/input|select|textarea|button/i.test(e.target?.tagName)||mode!=='farm')return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault();}}
  function keyup(e){keys.delete(e.key);}
  function blur(){keys.clear();down=null;}
  function resize(){const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',blur);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  function contextLost(e){e.preventDefault();onError(new Error('3D 显示上下文已中断，请刷新页面重试。'));}canvas.addEventListener('webglcontextlost',contextLost);
  let last=performance.now(),lastMove=0;
  function tick(t){if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min((t-last)/1000,.05);last=t;if(document.hidden||!active)return;
    let walking=false;
    if(mode==='farm'){const dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),dz=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);if(dx||dz)moveTo(avatarRoot.position.x+dx,avatarRoot.position.z+dz);const delta=target.clone().sub(avatarRoot.position);delta.y=0;const moving=delta.length()>.035;walking=moving;if(moving){avatarRoot.position.addScaledVector(delta.normalize(),Math.min(dt*2.2,target.distanceTo(avatarRoot.position)));avatarRoot.rotation.y=Math.atan2(delta.x,delta.z);avatar.position.y=Math.sin(t*.011)*.012;if(t-lastMove>200){onMove({x:avatarRoot.position.x,z:avatarRoot.position.z});lastMove=t;}}else avatar.position.y=0;}
    updateCare(t);motion?.update(dt,walking);garmentRoot.position.y=avatar.position.y;updateSheep(dt);controls.update();renderer.render(scene,camera);
  }
  frame=requestAnimationFrame(tick);
  const ready=new Promise(resolve=>{new GLTFLoader().load(globalThis.QIMENG_MODEL_URL || './assets/models/keeper.glb',gltf=>{if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});resolve({assetLoaded:false,disposed:true});return;}avatarRoot.remove(avatar);clearGroup(avatar);avatar=gltf.scene;avatarRoot.add(avatar);avatar.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});art.applyAvatar(avatar);assetLoaded=true;motion=createCharacterMotion(avatar,garments);remember();setFace(face);setOutfit(outfit);setGarment(garment);const result={assetLoaded:true,renderer:'three-webgl',scene};onReady(result);resolve(result);},undefined,error=>{const result={assetLoaded:false,renderer:'three-webgl',warning:'角色模型未能加载，当前显示占位角色。'};onError(new Error(result.warning));onReady(result);resolve(result);});});
  return {ready,setActive(value){active=Boolean(value);},playCare,setPlots,setRanch,setFace,setOutfit,setGarment,setWardrobeSkin,setMode,moveTo,get debug(){return {assetLoaded,active,mode,plotMutations:cropGroups.map(g=>g.children.some(c=>c.name==='MutationGem')),careEffect:{active:careGroup.visible,action:careAction,target:careTarget,plotIndex:carePlot,particleCount:careParticles.length},motion:motion?.debug,garment,wardrobeSkin,wardrobeSkinVisible:Object.values(skinGroups).filter(g=>g.visible).length,garmentVisible:garment==='garden'?1:Object.values(garments).filter(g=>g.visible).length,ranchCount,ranchBabies,troughLevels:{...troughLevels},troughReservations:{...troughReservations},troughQueues:{water:[...troughQueues.water],feed:[...troughQueues.feed]},ranchVisible:sheep.length,sheepBehaviors:[...sheepRecords.values()].map(r=>({id:r.id,breed:r.breed,moonPinVisible:r.moonPin.visible,mutation:r.mutation,state:r.state,slot:r.slot,queuedFor:r.queuedFor,target:r.target.toArray(),serviceTime:r.serviceTime,position:r.root.position.toArray(),growthMs:r.growthMs,pendingCare:[...r.pendingCare],scale:r.root.scale.x,headBend:r.head.rotation.x,bodyOffset:r.body.position.y})),plotCount:targets.length,position:avatarRoot.position.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,eyeScale:avatar.getObjectByName('EyeL')?.scale.toArray(),faceWidth:avatar.getObjectByName('Face')?.morphTargetInfluences?.[0]};},dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',blur);canvas.removeEventListener('webglcontextlost',contextLost);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());art.dispose();renderer.dispose();}};
}
