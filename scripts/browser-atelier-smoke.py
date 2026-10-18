"""Public UI integration; only clock and random are test-controlled."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__time')||'1800000000000');Math.random=()=>Number(localStorage.getItem('__rng')||'.99')")
 page.goto('http://127.0.0.1:4174/play.html');page.wait_for_function('window.__qimeng3d?.ready')
 page.locator('#wardrobeTab').click()
 assert page.evaluate('window.__qimeng3d.state.atelier.tickets')==3
 for n in ['0','.4','.6']:
  page.evaluate('(n)=>localStorage.setItem("__rng",n)',n);page.locator('#drawTicket').click()
 assert page.locator('#drawTicket').is_disabled()
 page.locator('[data-craft-skin="dawn"]').click();page.locator('[data-equip-skin="dawn"]').click()
 assert page.evaluate('window.__qimeng3d.renderInfo.wardrobeSkin')=='dawn'
 page.reload();page.wait_for_function('window.__qimeng3d?.ready');page.locator('#wardrobeTab').click()
 assert page.evaluate('window.__qimeng3d.state.atelier.tickets')==0
 assert page.evaluate('window.__qimeng3d.renderInfo.wardrobeSkin')=='dawn'
 page.locator('#farmTab').click();page.evaluate("localStorage.setItem('__rng','.99')")
 for i in range(3):
  page.locator('#plant').click();page.evaluate("localStorage.setItem('__time',String(Date.now()+90000))")
  page.wait_for_function('!document.querySelector("#harvest").disabled');page.locator('#harvest').click()
 page.locator('#wardrobeTab').click();page.locator('#claimHarvestTicket').click()
 assert page.locator('#claimHarvestTicket').is_disabled()
 assert page.evaluate('window.__qimeng3d.state.atelier.tickets')==1
 page.locator('#ranchTab').click();page.locator('#buyBreeder').click()
 assert page.locator('[data-groom-animal]').is_disabled()
 page.evaluate("localStorage.setItem('__time',String(Date.now()+8*3600000))")
 page.wait_for_function('!document.querySelector("[data-groom-animal]").disabled')
 wool=page.evaluate('window.__qimeng3d.state.atelier.materials.wool')
 page.locator('[data-groom-animal]').click()
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.wool')==wool+2
 assert page.locator('[data-groom-animal]').is_disabled()
 page.locator('#wardrobeTab').click();page.locator('#claimGroomTicket').click()
 assert page.locator('#claimGroomTicket').is_disabled()
 page.reload();page.wait_for_function('window.__qimeng3d?.ready');page.locator('#ranchTab').click()
 assert page.locator('[data-groom-animal]').is_disabled()
 page.locator('#wardrobeTab').click();page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(ROOT/'.artifacts/atelier-mobile.png'),full_page=True)
 assert not errors,errors
 print('PASS starter tickets once, material draw/craft/equip/persistence, harvest task, mature grooming+cooldown, task claim once, mobile layout')
 b.close()
