"""Three same-sex lambs grow and sell, preserving clocks and old saves."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__growthNow')||1800000000000);Math.random=()=>.9;")
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/play.html');page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 page.locator('#ranchTab').click();page.locator('#autoBreeding').uncheck()
 for _ in range(3):page.locator('#buyBreeder').click()
 assert '母 3' in page.locator('#ranchTitle').inner_text()
 assert page.locator('[data-sell-animal]:disabled').count()==3
 page.evaluate("localStorage.setItem('__growthNow',String(Date.now()+60000))")
 page.wait_for_function('window.__qimeng3d.state.ranch.growthAt===Date.now()')
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.every(a=>a.growthMs===0)')
 page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
 page.evaluate("localStorage.setItem('__growthNow',String(Date.now()+60000))")
 page.wait_for_function('window.__qimeng3d.state.ranch.animals.every(a=>a.growthMs===60000)')
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
 assert not page.locator('#autoBreeding').is_checked()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.every(a=>a.growthMs===60000)')
 page.evaluate("localStorage.setItem('__growthNow',String(Date.now()+60000))")
 page.wait_for_function('document.querySelectorAll("[data-sell-animal]:enabled").length===3')
 assert page.evaluate('window.__qimeng3d.state.ranch.pairing===null')
 page.screenshot(path=str(ROOT/'.artifacts/grown-sheep-v08.png'),full_page=True)
 for _ in range(3):page.locator('[data-sell-animal]:enabled').first.click()
 assert page.locator('#coins').inner_text()=='287'
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length===0')
 assert page.evaluate('window.__qimeng3d.renderInfo.ranchCount===0')
 page.locator('#buyBreeder').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals[0].growthMs===0')
 assert page.locator('[data-sell-animal]').is_disabled()
 position=page.evaluate('window.__qimeng3d.renderInfo.sheepBehaviors[0].position')
 page.wait_for_function('(p)=>{const a=window.__qimeng3d.renderInfo.sheepBehaviors[0];return Math.hypot(a.position[0]-p[0],a.position[2]-p[2])>.02}',arg=position,timeout=45000)
 page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo(0,0)')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(ROOT/'.artifacts/sheep-life-v08-mobile.png'),full_page=True)
 prior=page.evaluate('window.__qimeng3d.state');r=prior['ranch'];r['version']=2
 r.pop('growthAt',None);r.pop('breedingEnabled',None)
 for a in r['animals']:a.pop('growthMs',None)
 page.add_init_script('if(!localStorage.getItem("__legacyInjected")){localStorage.setItem("qimeng-3d-v1",'+json.dumps(json.dumps(prior))+');localStorage.setItem("__legacyInjected","1");}')
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals[0].growthMs===120000')
 assert page.locator('[data-sell-animal]').is_enabled()
 assert not errors,errors
 print('PASS: three females grow/sell, dry growth pause, persistence, mating toggle, fresh lamb age, real movement, mobile layout, old adults migration.')
 b.close()
