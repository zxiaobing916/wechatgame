"""Deterministic wall-clock integration; never uses the demo maturity buttons."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__careTestNow')||'1800000000000')")
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/play.html')
 page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 assert page.locator('#waterCrop').is_disabled()
 page.locator('#plant').click()
 initial=page.evaluate('window.__qimeng3d.state.plots[0].batch.maturesAt')
 page.locator('#waterCrop').click()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.maturesAt')==initial-12000
 assert page.locator('#waterCrop').is_disabled()
 assert page.evaluate('window.__qimeng3d.renderInfo.careEffect.action')=='water'
 page.locator('#fertilizeCrop').click()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.maturesAt')==initial-30000
 assert page.locator('#coins').inner_text()=='190'
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 assert page.locator('#waterCrop').is_disabled() and page.locator('#fertilizeCrop').is_disabled()
 assert page.locator('#harvest').is_disabled()
 page.evaluate("localStorage.setItem('__careTestNow',String(Date.now()+30000))")
 page.wait_for_function('!document.getElementById("harvest").disabled')
 page.locator('#harvest').click();assert page.locator('#coins').inner_text()=='220'
 # A new batch gets fresh care quotas and its species-specific duration.
 page.locator('#seed').select_option('watermelon');page.locator('#plant').click()
 assert not page.locator('#waterCrop').is_disabled()
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.maturesAt-Date.now()')==90000
 # Single-sheep trough care is independent from mating in v0.7.
 page.locator('#ranchTab').click();assert page.locator('#waterRanch').is_disabled()
 page.locator('#buyBreeder').click()
 page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.supplies.water')==4
 assert page.evaluate('window.__qimeng3d.state.ranch.supplies.feed')==4
 assert page.evaluate('window.__qimeng3d.state.ranch.pairing') is None
 assert page.locator('#coins').inner_text()=='145'
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
 assert page.locator('#waterRanch').is_disabled() and page.locator('#fertilizeRanch').is_disabled()
 page.evaluate("localStorage.setItem('__careTestNow',String(Date.now()+45000))")
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.screenshot(path=str(root/'.artifacts/care-ranch-mobile.png'),full_page=True)
 # Watermelon matures naturally even with no care at all.
 page.evaluate("localStorage.setItem('__careTestNow',String(Date.now()+45000))")
 page.locator('#farmTab').click();page.wait_for_function('!document.getElementById("harvest").disabled')
 assert page.evaluate('window.__qimeng3d.state.plots[0].batch.care===undefined')
 page.screenshot(path=str(root/'.artifacts/care-farm-mobile.png'),full_page=True)
 offline=b.new_page();offline.on('pageerror',lambda e:errors.append(str(e)));requests=[]
 def block(route): requests.append(route.request.url);route.abort()
 offline.route('http://**/*',block);offline.route('https://**/*',block)
 offline.set_content((root/'web/play-offline.html').read_text());offline.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 offline.locator('#plant').click();offline.locator('#waterCrop').click()
 assert offline.evaluate('window.__qimeng3d.state.plots[0].batch.care.water')
 assert not requests,requests
 assert not errors,errors
 print('PASS: crop care times, cost/quotas, single-sheep troughs, persistence, natural maturity, mobile layout and embedded offline care.')
 b.close()
