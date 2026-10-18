"""Retired weather API and isolated legacy mutation renderer checks, without game-state edits."""
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
 assert page.evaluate('world.setWeather === undefined && world.debug.weather === undefined')
 page.evaluate("world.setPlots([{batchId:'a',productId:'corn',maturesAt:0}]);world.setRanch({animals:[{id:'a'},{id:'b',mutation:'frost'}]})")
 d=page.evaluate('world.debug');assert d['plotMutations'][0] is False;assert [a['mutation'] for a in d['sheepBehaviors']]==[None,'frost']
 assert not errors,errors
 b.close()
 print('PASS: weather removed, legacy mutation isolation, crop signature changes, no page errors.')
