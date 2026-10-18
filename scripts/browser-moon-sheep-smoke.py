"""Validate and render the actual collectible sheep model; start PORT=4174 npm start first."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get("QIMENG_TEST_URL","http://127.0.0.1:4174")
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':640,'height':640},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/moon-preview.html',lambda route:route.fulfill(content_type='text/html',body='''<html><head><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script></head><body style="margin:0"><canvas id="world" style="width:640px;height:640px"></canvas></body></html>'''))
 page.goto(BASE+'/moon-preview.html')
 result=page.evaluate('''async()=>{
 const THREE=await import('three'),{createWorld}=await import('/world3d.mjs');
 const world=createWorld({canvas:document.querySelector('canvas')});const result=await world.ready;
 const {buyBreeder,createRanchState}=await import('/domain/ranch.mjs');
 const r=buyBreeder(createRanchState(),{speciesId:'sheep',coins:60,level:1,random:()=>.5,now:0}).ranch;
 r.animals;const ranch={...r,animals:r.animals.map(a=>({...a,breed:'moon',collection:true,growthMs:28800000,mutation:'storm'}))};
 world.setRanch(ranch,0);world.setActive(false);
 const info=world.debug;if(info.active||info.sheepBehaviors[0].breed!=='moon'||!info.sheepBehaviors[0].moonPinVisible)throw Error('moon render/active failure');
 const original=result.scene.getObjectByName('MoonSheepDetails').parent.parent;
 const animal=original.clone(true);animal.position.set(0,-.4,0);animal.rotation.set(0,.3,0);animal.scale.setScalar(2.9);animal.getObjectByName('MutationGem').visible=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f7f0e7');scene.add(animal);
 scene.add(new THREE.HemisphereLight('#fff7e9','#b9afc7',2.4));const sun=new THREE.DirectionalLight('#fff3df',2.5);sun.position.set(-4,7,6);scene.add(sun);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(3,64),new THREE.MeshStandardMaterial({color:'#e5ddcc',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.4;scene.add(floor);
 const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(2.4,2.5,5.6);camera.lookAt(0,.85,0);
 const canvas=document.createElement('canvas');canvas.id='preview';document.body.append(canvas);document.getElementById('world').style.display='none';const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(640,640);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;renderer.render(scene,camera);window.previewRenderer=renderer;
 return info.sheepBehaviors[0];}''')
 page.locator('#preview').screenshot(path=str(ROOT/'web/assets/moon-sheep-preview.png'))
 assert not errors,errors
 print('PASS moon renderer identity, mutation-compatible crescent, setActive pause',result)
 b.close()
