"""Exercise actual 3D basket picking, removal, drag, mobile framing and lifecycle."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':900,'height':800})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 html='''<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script><script type="module">import {createBasketView} from '/basket3d.mjs';import {createBasket,startBasket,pickBasket} from '/domain/basket.mjs';window.startBasket=startBasket;window.state=startBasket(createBasket());window.picks=[];window.view=createBasketView({canvas:document.querySelector('canvas'),onPick:id=>{picks.push(id);state=pickBasket(state,{itemId:id});view.setState(state);}});view.setState(state);view.setActive(true);window.ready=true;</script>'''
 page.route('**/__basket-test',lambda route:route.fulfill(body=html,content_type='text/html'))
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/__basket-test')
 page.wait_for_function('window.ready',timeout=30000)
 page.wait_for_timeout(500)
 assert page.evaluate('view.debug.visibleCount')==36
 assert page.evaluate('view.debug.revealProgress')==0
 assert not page.evaluate('view.debug.prizeVisible || view.debug.prizeAwake')
 assert len(page.evaluate('view.debug.selectable'))==12
 out=ROOT/'.artifacts';out.mkdir(exist_ok=True)
 page.screenshot(path=str(out/'basket-initial.png'))
 # Every initially available object's projected centre must hit itself.
 for item in page.evaluate('view.debug.selectable'):
  page.evaluate('state=startBasket(state);view.setState(state);picks.length=0')
  page.mouse.click(item['x'],item['y'])
  actual=page.evaluate('picks')
  assert actual==[item['id']],(item,actual)
  assert page.evaluate('view.debug.visibleCount')==35
 page.evaluate('state=startBasket(state);view.setState(state);picks.length=0')
 page.mouse.move(400,350);page.mouse.down();page.mouse.move(510,350,steps=8);page.mouse.up()
 assert page.evaluate('picks.length')==0
 assert abs(page.evaluate('view.debug.angle'))>.1
 page.evaluate('view.setActive(false)');assert not page.evaluate('view.debug.active')
 page.set_viewport_size({'width':390,'height':600})
 page.evaluate('view.setActive(true)');page.wait_for_timeout(300)
 assert all(0<i['x']<390 and 0<i['y']<600 for i in page.evaluate('view.debug.selectable'))
 page.screenshot(path=str(out/'basket-mobile.png'))
 # Drive a legal solution through domain actions and verify progressive reveal.
 page.evaluate('state=startBasket(state);view.setState(state)')
 path=page.evaluate('''async()=>{const m=await import('/domain/basket.mjs');window.pickBasket=m.pickBasket;const seen=new Set();function solve(s){if(s.status==='won')return [];if(s.status!=='playing')return null;const key=s.remaining.join(',')+'|'+[...s.tray].sort().join(',');if(seen.has(key))return null;seen.add(key);for(const i of m.availableItems(s)){const path=solve(m.pickBasket(s,{itemId:i.id}));if(path)return[i.id,...path];}return null;}return solve(state);}''')
 assert len(path)==36
 for i,item in enumerate(path):
  point=next(v for v in page.evaluate('view.debug.selectable') if v['id']==item)
  page.mouse.click(point['x'],point['y'])
  assert page.evaluate('state.moves')==i+1,(item,page.evaluate('picks'))
  if i==17:
   assert page.evaluate('view.debug.revealProgress')==.5
   assert page.evaluate('view.debug.prizeVisible && !view.debug.prizeAwake')
   page.screenshot(path=str(out/'basket-prize-mid.png'))
 page.wait_for_timeout(1400)
 assert page.evaluate('view.debug.visibleCount===0 && view.debug.prizeAwake && view.debug.revealProgress===1')
 page.screenshot(path=str(out/'basket-prize-won.png'))
 before=page.evaluate('picks.length')
 page.mouse.click(195,300)
 assert page.evaluate('picks.length')==before
 page.evaluate('view.dispose()');assert not page.evaluate('view.debug.active')
 assert not errors,errors
 b.close()
 print('PASS: 12 selectable centres hit correct 3D props, removal, drag without pick, inactive lifecycle, mobile framing, legal full solution and non-pickable gradual prize reveal.')
