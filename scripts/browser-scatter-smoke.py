from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.testNow=1800000000000;Date.now=()=>window.testNow")
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 page.evaluate("async()=>{window.daily=await import('/domain/daily-basket.mjs')}")
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 assert page.evaluate('window.__qimeng3d.state.basket.layout')==4
 assert page.evaluate('window.__qimeng3d.basketInfo.visibleCount')==108
 page.screenshot(path=str(ROOT/'web/assets/scattered-basket.png'))
 assert not page.evaluate('window.__qimeng3d.basketInfo.prizeVisible')
 before=page.evaluate('window.__qimeng3d.state.basket')
 page.locator('#rockBasket').tap()
 page.wait_for_function('Math.abs(window.__qimeng3d.basketInfo.tilt[0])>.01')
 page.screenshot(path=str(ROOT/'web/assets/scattered-basket-rock.png'))
 assert page.evaluate('window.__qimeng3d.state.basket')==before
 page.wait_for_function('!window.__qimeng3d.basketInfo.rocking && Math.abs(window.__qimeng3d.basketInfo.tilt[0])<.005')
 # Real drag changes observation angle without picking.
 page.mouse.move(180,350);page.mouse.down();page.mouse.move(215,385,steps=8);page.mouse.up()
 assert page.evaluate('window.__qimeng3d.state.basket')==before
 assert page.evaluate('Math.max(...window.__qimeng3d.basketInfo.positions.map(p=>p.y))')<.08
 assert abs(page.evaluate('window.__qimeng3d.basketInfo.angle'))<=.121
 # Real ray hits on exposed objects. Retry several projected centres if a corner is occluded.
 successes=0
 for _ in range(5):
  prev=page.evaluate('window.__qimeng3d.state.basket.moves')
  for point in page.evaluate('window.__qimeng3d.basketInfo.selectable'):
   if 140<point['y']<630 and 15<point['x']<375:
    page.touchscreen.tap(point['x'],point['y'])
    if page.evaluate('window.__qimeng3d.state.basket.moves')>prev:
     successes+=1;break
 assert successes==5
 # Restart and execute the certificate through the game's public pick controls.
 page.locator('#mainAction').tap();page.locator('#startBasket').tap()
 path=page.evaluate('daily.dailyBoard(window.__qimeng3d.state.basket.day).solution')
 for i in range(0,108,12):
  page.evaluate('ids=>{for(const id of ids)document.querySelector(\'[data-basket-item="\'+id+\'"]\').click()}',path[i:i+12])
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='playing'
 assert page.evaluate('window.__qimeng3d.basketInfo.prizeVisible')
 page.screenshot(path=str(ROOT/'web/assets/basket-prize-reveal.png'))
 point=page.evaluate('window.__qimeng3d.basketInfo.prizePoint')
 page.touchscreen.tap(point['x'],point['y'])
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='won'
 page.evaluate("document.querySelector('#startBasket').click()")
 assert page.locator('#basketTimer').inner_text()=='10:00'
 page.evaluate('window.testNow+=600000')
 page.wait_for_function("window.__qimeng3d.state.basket.lossReason==='time'")
 page.locator('#mainAction').tap();page.locator('#reviveBasket').tap();page.locator('#adComplete').tap()
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='playing'
 assert page.locator('#basketTimer').inner_text()=='02:00'
 assert not errors,errors
 print('PASS irregular heap, bounded rocking and drag without state changes, real exposed-object picking, full legal solution')
 b.close()
