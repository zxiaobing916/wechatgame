from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__testTime')||1800000000000)")
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded && window.__qimeng3d?.basketInfo',timeout=60000)
 s=page.evaluate('window.__qimeng3d.state')
 assert s['level']==1 and len(s['plots'])==9 and sum(p['unlocked'] for p in s['plots'])==1
 assert page.evaluate('window.__qimeng3d.renderInfo.plotCount')==9
 page.locator('#mainAction').tap();page.locator('.plot-picker>summary').tap();page.locator('#plot-1').tap();assert page.locator('#unlockPlot').is_disabled()
 page.locator('#plot-0').tap();page.locator('#plant').tap()
 page.evaluate("localStorage.setItem('__testTime',String(Date.now()+61000))")
 page.wait_for_function('!document.querySelector("#harvest").disabled')
 page.locator('#harvest').tap()
 s=page.evaluate('window.__qimeng3d.state');assert s['xp']==10 and s['level']==2 and s['coins']==62
 page.locator('#plot-1').tap();page.locator('#unlockPlot').tap()
 assert page.evaluate('window.__qimeng3d.state.coins')==42
 assert page.locator('#unlockPlot').is_hidden()
 page.locator('#closeSheet').tap();page.wait_for_timeout(4600)
 page.screenshot(path=str(ROOT/'web/assets/land-progression.png'))
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 assert page.evaluate('window.__qimeng3d.state.plots.filter(p=>p.unlocked).length')==2
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 item=page.evaluate('window.__qimeng3d.basketInfo.selectable[0]')
 page.touchscreen.tap(item['x'],item['y'])
 img=page.locator('#basketTray img');assert img.count()==1
 assert img.get_attribute('src').startswith('data:image/png;base64,')
 assert img.get_attribute('alt')
 assert page.evaluate('document.querySelector("#basketTray img").complete && document.querySelector("#basketTray img").naturalWidth>0')
 page.wait_for_timeout(4600);page.screenshot(path=str(ROOT/'web/assets/basket-icons.png'))
 for w,h in [(360,740),(430,932)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for point in page.evaluate('window.__qimeng3d.basketInfo.selectable'):
   assert 0<point['x']<w and 104<point['y']<h-190,point
 assert not errors,errors
 print('PASS first harvest XP, paid sequential unlock, nine plots, reload, real basket touch and matching model thumbnail, mobile framing')
 b.close()
