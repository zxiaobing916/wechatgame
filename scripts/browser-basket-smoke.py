"""End-to-end challenge via public controls; solver computes actions, never mutates game state."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__testTime')||'1800000000000');Math.random=()=>.99")
 page.goto('http://127.0.0.1:4174/play.html');page.wait_for_function('window.__qimeng3d?.basketInfo')
 page.locator('#basketTab').click();page.locator('#startBasket').click()
 assert page.evaluate('window.__qimeng3d.basketInfo.active')
 assert not page.evaluate('window.__qimeng3d.renderInfo.active')
 page.screenshot(path=str(ROOT/'.artifacts/basket-game-ui.png'))
 page.locator('#basketPanel details').last.locator('summary').click()
 while page.evaluate('window.__qimeng3d.state.basket.status')=='playing':
  page.locator('[data-basket-item]').first.click()
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='lost'
 coins=page.evaluate('window.__qimeng3d.state.coins')
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo');page.locator('#basketTab').click()
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='lost'
 page.locator('#startBasket').click()
 path=page.evaluate('''async()=>{const m=await import('/domain/basket.mjs');const seen=new Set();function solve(s){if(s.status==='won')return [];if(s.status!=='playing')return null;const key=s.remaining.join(',')+'|'+[...s.tray].sort().join(',');if(seen.has(key))return null;seen.add(key);for(const i of m.availableItems(s)){const path=solve(m.pickBasket(s,{itemId:i.id}));if(path)return[i.id,...path];}return null;}return solve(window.__qimeng3d.state.basket);}''')
 assert len(path)==36
 page.locator('#basketPanel details').last.locator('summary').click()
 for item in path:page.locator('[data-basket-item="'+item+'"]').click()
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='won'
 assert page.locator('#claimBasket').is_visible()
 page.locator('#claimBasket').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==coins
 assert page.evaluate('window.__qimeng3d.state.ranch.animals[0].breed')=='moon'
 assert page.evaluate('window.__qimeng3d.state.basket.claimed')
 page.evaluate("localStorage.setItem('__testTime',String(Date.now()+8*3600000))")
 page.wait_for_function('!document.querySelector("[data-groom-animal]").disabled')
 page.locator('[data-groom-animal]').click()
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.moonDown')==2
 assert page.locator('[data-sell-animal]').is_disabled()
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo');page.locator('#basketTab').click()
 assert page.locator('#claimBasket').is_hidden()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length')==1
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS basket loss/reload/fixed retry/solvable win, unique free moon adoption, matured moonDown grooming, collection protection, mobile layout')
 b.close()
