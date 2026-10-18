"""Integrated mutation UI, care locks, persistence and premium sale with test-only RNG/clock."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1100,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__testTime')||'1800000000000');Math.random=()=>Number(localStorage.getItem('__testRandom')||'.99')")
 page.goto('http://127.0.0.1:4174/play.html');page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 page.locator('#plant').click();page.evaluate("localStorage.setItem('__testRandom','0')");page.locator('#waterCrop').click()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.mutation')=='dewdrop'
 assert '露华' in page.locator('#plotInfo').inner_text()
 page.locator('#fertilizeCrop').click()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.mutation')=='dewdrop'
 page.locator('#ranchTab').click();page.evaluate("localStorage.setItem('__testRandom','.9')");page.locator('#buyBreeder').click()
 page.evaluate("localStorage.setItem('__testRandom','0')");page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
 assert page.locator('#waterRanch').is_disabled()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals[0].mutation')=='dewdrop'
 assert '露华' in page.locator('#animalList').inner_text()
 assert page.locator('#weatherNow').count()==0
 # A legacy weather scheduler must be ignored, even after an offline interval.
 page.evaluate("const s=JSON.parse(localStorage.getItem('qimeng-3d-v1'));s.nature={version:1,seed:42,slot:0,type:'storm'};localStorage.setItem('qimeng-3d-v1',JSON.stringify(s))")
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 assert page.evaluate('window.__qimeng3d.state.nature === undefined')
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.mutation')=='dewdrop'
 page.evaluate("localStorage.setItem('__testTime',String(Date.now()+8*3600000))")
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 assert page.evaluate('window.__qimeng3d.state.nature === undefined')
 coins=page.evaluate('window.__qimeng3d.state.coins');page.locator('#harvest').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==coins+45
 page.locator('#ranchTab').click();coins=page.evaluate('window.__qimeng3d.state.coins')
 assert '135' in page.locator('[data-sell-animal]').inner_text()
 page.locator('[data-sell-animal]').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==coins+135
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS mutation on crop/animal care, no overwrite/repeat, reload, no offline weather, premium sales, mobile UI')
 b.close()
