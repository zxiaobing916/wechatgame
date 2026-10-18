from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__testTime')||1800000000000)")
 page.goto('http://127.0.0.1:4174/')
 page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 page.evaluate("async()=>{window.daily=await import('/domain/daily-basket.mjs')}")
 page.locator('#basketTab').tap();page.locator('#mainAction').tap()
 assert page.evaluate('window.__qimeng3d.state.basket.remaining.length')==108
 path=page.evaluate('daily.dailyBoard(window.__qimeng3d.state.basket.day).solution')
 for itemId in path[:6]:
  point=page.evaluate('(id)=>window.__qimeng3d.basketInfo.selectable.find(p=>p.id===id)',itemId)
  page.touchscreen.tap(point['x'],point['y'])
  assert page.evaluate('(id)=>!window.__qimeng3d.state.basket.remaining.includes(id)',itemId)
 page.screenshot(path=str(ROOT/'web/assets/daily-hard-basket.png'))
 # Lose through legal public pick buttons; deliberately avoid completing triples.
 page.evaluate("""()=>{while(window.__qimeng3d.state.basket.status==='playing'){
 const s=window.__qimeng3d.state.basket,items=daily.itemsFor(s),counts={};
 for(const id of s.tray){const t=items.find(i=>i.id===id).type;counts[t]=(counts[t]||0)+1;}
 const pick=daily.availableItems(s).sort((a,b)=>(counts[a.type]||0)-(counts[b.type]||0))[0];
 document.querySelector('[data-basket-item="'+pick.id+'"]').click();
 }}""")
 lost=page.evaluate('window.__qimeng3d.state.basket')
 assert lost['status']=='lost'
 page.locator('#mainAction').tap();page.locator('#reviveBasket').tap()
 page.locator('#adDialog form button').tap()
 assert page.evaluate('window.__qimeng3d.state.basket.revives')==0
 page.locator('#reviveBasket').tap();page.locator('#adComplete').tap()
 revived=page.evaluate('window.__qimeng3d.state.basket')
 assert revived['moves']==lost['moves']-3 and revived['revives']==1 and revived['status']=='playing'
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 assert page.evaluate('window.__qimeng3d.state.basket.revives')==1
 page.evaluate("async()=>{window.daily=await import('/domain/daily-basket.mjs')}")
 page.locator('#basketTab').tap();page.locator('#mainAction').tap();page.locator('#startBasket').tap()
 for start in range(0,108,12):
  page.evaluate("""ids=>{for(const id of ids)document.querySelector('[data-basket-item="'+id+'"]').click()}""",path[start:start+12])
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='won'
 assert page.evaluate('window.__qimeng3d.basketInfo.visibleCount')==0
 before=page.evaluate('window.__qimeng3d.state.atelier.materials')
 reward=page.evaluate('daily.rewardFor(window.__qimeng3d.state.basket.day)')
 page.locator('#mainAction').tap()
 after=page.evaluate('window.__qimeng3d.state.atelier.materials')
 assert after[reward['key']]==before[reward['key']]+reward['amount']
 assert page.evaluate('window.__qimeng3d.state.basket.pending.length')==0
 day=page.evaluate('window.__qimeng3d.state.basket.day')
 page.evaluate("localStorage.setItem('__testTime',String(Date.now()+86400000))")
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo',timeout=60000)
 assert page.evaluate('window.__qimeng3d.state.basket.day')==day+1
 assert page.evaluate('window.__qimeng3d.state.basket.status')=='ready'
 assert page.evaluate('window.__qimeng3d.state.atelier.materials')==after
 assert not errors,errors
 print('PASS 108-object touch picking, loss, cancelled/completed simulated ad, persisted revive, legal full victory, daily single reward and next-day rollover')
 b.close()
