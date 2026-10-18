from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.DeviceMotionEvent=class {static async requestPermission(){return 'granted'}}")
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 before=page.evaluate('window.__qimeng3d.state.basket.remaining')
 page.locator('#motionBasket').tap()
 assert page.locator('#motionBasket').inner_text()=='关闭摇一摇'
 page.evaluate("()=>{const original=performance.now.bind(performance);let time=original();performance.now=()=>time;try{for(const x of [0,10,-10]){time+=60;const e=new Event('devicemotion');e.accelerationIncludingGravity={x,y:0,z:9.8};dispatchEvent(e);}}finally{performance.now=original;}}")
 page.wait_for_function('window.__qimeng3d.basketInfo.tossCount===1')
 assert page.evaluate('window.__qimeng3d.basketInfo.tossing.length')<=5
 assert page.evaluate('window.__qimeng3d.state.basket.remaining')==before
 page.screenshot(path=str(ROOT/'web/assets/basket-toss.png'))
 page.wait_for_function('!window.__qimeng3d.basketInfo.rocking && !window.__qimeng3d.basketInfo.tossing.length')
 page.locator('#motionBasket').tap()
 assert page.locator('#motionBasket').inner_text()=='开启摇一摇'
 page.locator('#rockBasket').tap()
 page.wait_for_function('window.__qimeng3d.basketInfo.tossCount===2')
 assert not errors,errors
 print('PASS simulated browser motion, capped surface toss, no picks, button fallback, sensor disable')
 b.close()
