from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1100,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__now')||'1800000000000');Math.random=()=>.99")
 page.goto('http://127.0.0.1:4174/play.html');page.wait_for_function('window.__qimeng3d?.basketInfo')
 assert page.locator('#drawTicket').count()==0
 page.locator('#basketTab').click();assert '月绒羊' not in page.locator('#basketPanel').inner_text()
 assert page.locator('#basketRewardImage').is_hidden()
 page.locator('#farmTab').click();page.locator('#bulkPlant').click()
 assert page.evaluate('window.__qimeng3d.state.plots.filter(p=>p.crop==="corn").length')==6
 assert page.evaluate('window.__qimeng3d.state.coins')==152
 assert page.locator('#bulkPlant').is_disabled()
 page.locator('#bulkWater').click();assert page.locator('#bulkWater').is_disabled()
 page.locator('#bulkFertilize').click();assert page.evaluate('window.__qimeng3d.state.coins')==140
 page.evaluate("localStorage.setItem('__now',String(Date.now()+30000))")
 page.wait_for_function('!document.querySelector("#bulkHarvest").disabled');page.locator('#bulkHarvest').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==320
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.goldDye')==12
 assert page.locator('#bulkHarvest').is_disabled()
 page.locator('#seed').select_option('watermelon');page.locator('#bulkPlant').click()
 page.locator('#ranchTab').click();assert '4只' in page.locator('#bulkBuySheep').inner_text();page.locator('#bulkBuySheep').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==8
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length')==4
 page.locator('#farmTab').click();page.locator('#bulkFertilize').click()
 assert page.evaluate('window.__qimeng3d.state.coins')==2
 assert page.evaluate('window.__qimeng3d.state.plots.filter(p=>p.batch.care?.fertilize).length')==2
 page.evaluate("localStorage.setItem('__now',String(Date.now()+90000))")
 page.wait_for_function('!document.querySelector("#bulkHarvest").disabled');page.locator('#bulkHarvest').click()
 page.locator('#ranchTab').click();page.locator('#bulkBuySheep').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length')==6
 assert page.locator('#bulkBuySheep').is_disabled()
 # Legacy migration preserves existing wealth and converts unused tickets once.
 page.evaluate('''()=>{const s=window.__qimeng3d.state;s.atelier={version:1,materials:{wool:1,goldDye:2,roseDye:3,moonDown:4},tickets:3,owned:['moon'],equipped:'moon',pity:5,history:[],daily:{day:0,harvest:0,groom:0,harvestClaimed:false,groomClaimed:false}};s.garment='court';s.outfit='lilac';localStorage.setItem('legacy_fixture',JSON.stringify(s));}''')
 # init script runs after prior pagehide save, before new page's migration.
 page.add_init_script("if(localStorage.getItem('legacy_fixture')){localStorage.setItem('qimeng-3d-v1',localStorage.getItem('legacy_fixture'));localStorage.removeItem('legacy_fixture');}")
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo')
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.wool')==7
 assert page.evaluate('window.__qimeng3d.state.atelier.owned')==['moon']
 assert page.evaluate('window.__qimeng3d.state.atelier.version')==2
 page.reload();page.wait_for_function('window.__qimeng3d?.basketInfo')
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.wool')==7
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS bulk plant/care/harvest/buy, money/capacity limits, no duplicate yields, mystery preview, no lottery, legacy possessions + one-time compensation, mobile')
 b.close()
