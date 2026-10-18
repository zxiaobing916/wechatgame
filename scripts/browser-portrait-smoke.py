"""Exercise the bundled game at phone sizes and capture actual rendered screens."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('Date.now=()=>1800000000000')
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded && window.__qimeng3d?.basketInfo',timeout=60000)
 page.locator('#bulkPlant').click()
 page.locator('#bulkWater').click()
 assert page.evaluate('window.__qimeng3d.state.plots.every(p=>p.batch.care.water)')
 for mode in ['farm','ranch','basket','face','wardrobe']:
  page.locator('#'+mode+'Tab').click()
  if mode=='ranch':page.locator('#buyBreeder').click()
  if mode=='basket':page.locator('#startBasket').click()
  page.evaluate("document.querySelector('.panel').scrollTop=0")
  page.wait_for_timeout(500)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.body.scrollHeight<=innerHeight')
  nav=page.locator('nav').bounding_box()
  assert nav['y']+nav['height']<=845
  stage=page.locator('.stage').bounding_box()
  page.evaluate("document.querySelector('.panel').scrollTop=9999")
  assert page.locator('.stage').bounding_box()==stage
  page.evaluate("document.querySelector('.panel').scrollTop=0")
  if mode=='basket':
   tray=page.locator('#basketTray').bounding_box()
   assert tray['y']+tray['height']<nav['y']
  page.screenshot(path=str(ROOT/'web/assets'/f'portrait-{mode}.png'))
 for w,h in [(360,740),(430,932),(1280,960)]:
  page.set_viewport_size({'width':w,'height':h})
  page.locator('#farmTab').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  body=page.locator('body').bounding_box()
  assert abs(body['width']-(390 if w>600 else w))<1
  assert page.locator('#farmTab').is_visible()
  page.locator('#bulkWater').scroll_into_view_if_needed()
  assert page.locator('#bulkWater').is_disabled()
 assert not errors,errors
 print('PASS bundled portrait: five modes, planting, purchase, basket start, fixed scene/navigation, visible tray, 360/390/430 phone widths and desktop frame')
 b.close()
