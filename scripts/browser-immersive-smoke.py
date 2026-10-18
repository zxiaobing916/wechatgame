"""Real touch picking and full-screen scene layout in the bundled build."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True,device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('Date.now=()=>1800000000000')
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded && window.__qimeng3d?.basketInfo',timeout=60000)
 assert page.locator('#actionSheet').is_hidden()
 assert page.evaluate("document.querySelector('.stage').getBoundingClientRect().height / innerHeight")>=.9
 point=page.evaluate('window.__qimeng3d.renderInfo.interactionPoints.plots[0]')
 page.touchscreen.tap(point['x'],point['y'])
 assert page.locator('#actionSheet').is_visible()
 assert page.evaluate('window.__qimeng3d.selectedPlot')==0
 page.locator('#plant').tap()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch !== null')
 page.locator('#closeSheet').tap()
 page.wait_for_timeout(4600)
 page.screenshot(path=str(ROOT/'web/assets/immersive-farm.png'))
 # A drag that returns to its origin must not become a tap.
 point=page.evaluate('window.__qimeng3d.renderInfo.interactionPoints.plots[0]')
 page.mouse.move(point['x'],point['y']);page.mouse.down()
 page.mouse.move(point['x']+25,point['y'],steps=3)
 page.mouse.move(point['x'],point['y'],steps=3);page.mouse.up()
 assert page.locator('#actionSheet').is_hidden()
 # A two-finger gesture cannot open a plot or send the character walking.
 page.locator('#ranchTab').tap();page.locator('#farmTab').tap()
 point=page.evaluate('window.__qimeng3d.renderInfo.interactionPoints.plots[0]')
 cdp=page.context.new_cdp_session(page)
 pts=[{'x':point['x'],'y':point['y'],'id':1},{'x':point['x']+28,'y':point['y'],'id':2}]
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':pts})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.locator('#actionSheet').is_hidden()
 # Tap clear ground and verify actual avatar movement.
 before=page.evaluate('window.__qimeng3d.renderInfo.position')
 point=page.evaluate('window.__qimeng3d.renderInfo.interactionPoints.ground')
 page.touchscreen.tap(point['x'],point['y'])
 page.wait_for_function('(p)=>Math.hypot(window.__qimeng3d.renderInfo.position[0]-p[0],window.__qimeng3d.renderInfo.position[2]-p[2])>.1',arg=before,timeout=15000)
 page.locator('#ranchTab').tap();page.locator('#mainAction').tap();page.locator('#buyBreeder').tap();page.locator('#closeSheet').tap()
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/immersive-ranch.png'))
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 assert page.locator('#actionSheet').is_hidden()
 point=page.evaluate('window.__qimeng3d.basketInfo.selectable[0]')
 page.touchscreen.tap(point['x'],point['y'])
 assert page.evaluate('window.__qimeng3d.state.basket.tray.length')==1
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/immersive-basket.png'))
 for mode in ['face','wardrobe']:
  page.locator('#'+mode+'Tab').tap()
  assert page.locator('#actionSheet').is_hidden()
  page.locator('#mainAction').tap()
  assert page.locator('#'+mode+'Panel').is_visible()
  page.locator('#closeSheet').tap()
 for w,h in [(360,740),(430,932),(1280,960)]:
  page.set_viewport_size({'width':w,'height':h});page.locator('#farmTab').tap()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.evaluate("document.querySelector('.stage').clientHeight/document.body.clientHeight")>=.9
  assert page.locator('#actionSheet').is_hidden()
  hud=page.evaluate("['.brand','.wallet','body>nav','#helpButton','#mainAction'].reduce((sum,s)=>{const r=document.querySelector(s).getBoundingClientRect();return sum+r.width*r.height},0)/(document.body.clientWidth*document.body.clientHeight)")
  assert hud<=.1, (w,h,hud)
 page.locator('#helpButton').tap();assert page.locator('#helpDialog').is_visible()
 page.locator('#helpDialog button').tap();assert page.locator('#helpDialog').is_hidden()
 assert not errors,errors
 print('PASS: full-screen canvas, touch plot planting, drag/pinch suppression, tap-to-walk, ranch purchase, basket real touch pick, five modes and phone widths')
 b.close()
