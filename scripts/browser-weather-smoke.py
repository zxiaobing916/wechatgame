"""Actual WebGL weather and isolated mutation renderer checks, without game-state edits."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 html='''<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><script type="module">import {createWorld} from '/world3d.mjs';window.world=createWorld({canvas:document.querySelector('canvas')});await world.ready;window.testReady=true;</script>'''
 page.route('**/weather-test.html',lambda r:r.fulfill(body=html,content_type='text/html'))
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/weather-test.html')
 page.wait_for_function('window.testReady',timeout=60000)
 page.evaluate('''()=>{world.setPlots([{batchId:'a',productId:'corn',maturesAt:0,mutation:'dewdrop'},{batchId:'b',productId:'watermelon',maturesAt:0}]);world.setRanch({animals:[{id:'a',mutation:'storm'},{id:'b'}]});}''')
 d=page.evaluate('world.debug');assert d['plotMutations'][:2]==[True,False];assert [a['mutation'] for a in d['sheepBehaviors']]==['storm',None]
 artifacts=ROOT/'.artifacts';artifacts.mkdir(exist_ok=True)
 images={}
 for weather in ['clear','rain','snow','storm']:
  page.evaluate('(type)=>world.setWeather({type})',weather);page.wait_for_timeout(1100)
  d=page.evaluate('world.debug.weather');assert d['type']==weather
  assert d['particleCount']==(0 if weather=='clear' else 160)
  assert d['rainVisible']==(weather in ['rain','storm']);assert d['snowVisible']==(weather=='snow')
  images[weather]=page.locator('canvas').screenshot(path=str(artifacts/f'weather-{weather}.png'))
 assert len(set(images.values()))==4
 page.evaluate("world.setPlots([{batchId:'a',productId:'corn',maturesAt:0}]);world.setRanch({animals:[{id:'a'},{id:'b',mutation:'frost'}]});world.setWeather({type:'clear'})")
 d=page.evaluate('world.debug');assert d['plotMutations'][0] is False;assert [a['mutation'] for a in d['sheepBehaviors']]==[None,'frost'];assert d['weather']['particleCount']==0
 assert not errors,errors
 b.close()
 print('PASS: clear/rain/snow/storm render, bounded particles, per-animal mutation isolation, crop signature mutation changes, removal and no page errors.')
