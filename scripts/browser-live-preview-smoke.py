"""Check actual live edits while the scene remains clear of its controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__testTime')||1800000000000)")
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.basketInfo && document.querySelectorAll("[data-garment] img").length===3',timeout=60000)
 def clear_preview():
  stage=page.locator('.stage').bounding_box();panel=page.locator('#actionSheet').bounding_box()
  assert stage['height']>250
  assert stage['y']+stage['height']<=panel['y']+1,(stage,panel)
  assert page.locator('#mainAction').is_hidden()
 # All primary sections must remain siblings, not become nested by folded UI.
 assert page.evaluate("['farm','ranch','face','wardrobe','basket'].every(k=>document.getElementById(k+'Panel').parentElement.id==='actionSheet')")
 page.locator('#mainAction').tap();clear_preview()
 page.locator('#plant').tap();assert page.locator('#actionSheet').is_visible()
 point=page.evaluate('window.__qimeng3d.renderInfo.interactionPoints.plots[0]')
 stage=page.locator('.stage').bounding_box()
 assert stage['y']<point['y']<stage['y']+stage['height']
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/live-farm.png'))
 page.evaluate("localStorage.setItem('__testTime',String(Date.now()+61000))")
 page.wait_for_function('!document.querySelector("#harvest").disabled');page.locator('#harvest').tap()
 page.locator('#faceTab').tap();page.locator('#mainAction').tap();clear_preview()
 before=page.evaluate('window.__qimeng3d.renderInfo.eyeScale')
 page.locator('#range-eyeWidth').fill('40');page.locator('#range-eyeWidth').dispatch_event('input')
 assert page.evaluate('window.__qimeng3d.state.face.eyeWidth')==40
 assert page.evaluate('window.__qimeng3d.renderInfo.eyeScale')!=before
 assert page.locator('#actionSheet').is_visible()
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/live-face.png'))
 page.locator('#wardrobeTab').tap();page.locator('#mainAction').tap();clear_preview()
 assert page.locator('[data-garment] img').count()==3
 previews=page.locator('[data-garment] img').evaluate_all('(imgs)=>imgs.map(i=>i.src)')
 assert len(set(previews))==3
 page.locator('[data-garment=court]').tap()
 assert page.evaluate('window.__qimeng3d.renderInfo.garment')=='court'
 assert page.locator('#actionSheet').is_visible()
 page.screenshot(path=str(ROOT/'web/assets/live-wardrobe.png'))
 page.locator('#ranchTab').tap();page.locator('#mainAction').tap();clear_preview()
 page.locator('#buyBreeder').tap()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length')==1
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/live-ranch.png'))
 for w,h in [(360,740),(430,932)]:
  page.set_viewport_size({'width':w,'height':h})
  for mode in ['farm','face','wardrobe','ranch']:
   page.locator('#'+mode+'Tab').tap();page.locator('#mainAction').tap()
   page.wait_for_timeout(150);clear_preview()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('#closeSheet').tap()
 assert page.evaluate("document.querySelector('.stage').clientHeight===document.body.clientHeight")
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 assert '剩余' not in page.locator('body').inner_text()
 assert page.locator('#mainAction').inner_text()=='选项'
 assert not errors,errors
 print('PASS non-overlapping viewports, live face and outfit edits, model garment cards, farm planting/ranch purchase visible, compact layouts and no basket remaining counter')
 b.close()
