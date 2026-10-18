"""Ranch real-time growth and care gates using a browser-only clock fixture."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("Date.now=()=>Number(localStorage.getItem('__ranchTime')||'1800000000000');Math.random=()=>.8;")
    url=os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/play.html'
    page.goto(url);page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
    page.locator('#ranchTab').click()
    for _ in range(3):page.locator('#buyBreeder').click()
    assert '8小时' in page.locator('#animalList').inner_text()
    page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
    assert page.locator('#waterRanch').is_disabled()
    assert page.locator('#fertilizeRanch').is_disabled()
    assert all(a['growthMs']==1800000 for a in page.evaluate('window.__qimeng3d.state.ranch.animals'))
    page.wait_for_timeout(3000)
    assert page.locator('#waterRanch').is_disabled(), 'animation must not reset care eligibility'
    page.evaluate("localStorage.setItem('__ranchTime',String(Date.now()+3*3600000-1))")
    page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
    assert page.locator('#waterRanch').is_disabled()
    page.evaluate("localStorage.setItem('__ranchTime',String(Date.now()+1))")
    page.wait_for_function('!document.querySelector("#waterRanch").disabled')
    page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
    assert all(a['growthMs']==4*3600000 for a in page.evaluate('window.__qimeng3d.state.ranch.animals'))
    page.evaluate("localStorage.setItem('__ranchTime',String(Date.now()+2*3600000))")
    page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
    assert all(a['growthMs']==6*3600000 for a in page.evaluate('window.__qimeng3d.state.ranch.animals'))
    assert page.locator('#waterRanch').is_disabled()
    page.evaluate("localStorage.setItem('__ranchTime',String(Date.now()+2*3600000))")
    page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
    page.wait_for_function('!document.querySelector("[data-sell-animal]").disabled')
    coins=page.evaluate('window.__qimeng3d.state.coins')
    page.locator('[data-sell-animal]').first.click()
    assert page.evaluate('window.__qimeng3d.state.coins')==coins+90
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'.artifacts/ranch-time-mobile.png'),full_page=True)
    assert not errors,errors
    print('PASS: 3 female sheep, 8h growth, 15min care, 3h gate exact boundary, offline/reload, sale, mobile layout')
    browser.close()
