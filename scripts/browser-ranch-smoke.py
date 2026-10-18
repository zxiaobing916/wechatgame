"""Current v0.7 ranch: deterministic clock/random, no forced maturity buttons."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__ranchNow')||'1800000000000'); Math.random=()=>Number(localStorage.getItem('__ranchRandom')||'.01');")
 page.goto(os.getenv('QIMENG_TEST_URL','http://127.0.0.1:4174')+'/play.html');page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 # Seed only money for coverage of three independent purchases; use public UI for mechanics.
 page.add_init_script("if(!localStorage.getItem('__moneyFixture')){const s=JSON.parse(localStorage.getItem('qimeng-3d-v1'));s.coins=500;localStorage.setItem('qimeng-3d-v1',JSON.stringify(s));localStorage.setItem('__moneyFixture','1');}")
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
 page.locator('#buyBreeder').click();assert '公 1 / 母 0' in page.locator('#ranchTitle').inner_text()
 assert page.locator('#feedBreeder').count()==0
 assert not page.locator('#waterRanch').is_disabled() and not page.locator('#fertilizeRanch').is_disabled()
 page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.supplies.water')==4
 assert page.evaluate('window.__qimeng3d.state.ranch.supplies.feed')==4
 assert page.locator('#coins').inner_text()=='437'
 assert page.locator('#fertilizeRanch').is_disabled()
 page.locator('#buyBreeder').click();assert '公 2 / 母 0' in page.locator('#ranchTitle').inner_text()
 assert page.evaluate('window.__qimeng3d.state.ranch.pairing') is None
 page.evaluate("localStorage.setItem('__ranchNow',String(Date.now()+240000))")
 page.wait_for_function('window.__qimeng3d.state.ranch.supplies.feed===0')
 page.evaluate("localStorage.setItem('__ranchRandom','.9')");page.locator('#buyBreeder').click()
 assert '公 2 / 母 1' in page.locator('#ranchTitle').inner_text()
 page.locator('#waterRanch').click();page.evaluate("localStorage.setItem('__ranchRandom','.01')");page.locator('#fertilizeRanch').click()
 page.evaluate("localStorage.setItem('__ranchNow',String(Date.now()+120000))")
 page.wait_for_function('window.__qimeng3d.state.ranch.pairing!==null')
 pair=page.evaluate('window.__qimeng3d.state.ranch.pairing');assert pair['outcome'] is True
 coins=page.locator('#coins').inner_text()
 page.evaluate("localStorage.setItem('__ranchRandom','.99')");page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded');page.locator('#ranchTab').click()
 assert page.evaluate('window.__qimeng3d.state.ranch.pairing')==pair
 page.evaluate("localStorage.setItem('__ranchNow',String(Date.now()+30000))")
 page.wait_for_function('window.__qimeng3d.state.ranch.batch!==null')
 assert page.locator('#coins').inner_text()==coins
 page.locator('#waterRanch').click();page.locator('#fertilizeRanch').click()
 end=page.evaluate('window.__qimeng3d.state.ranch.batch.maturesAt')
 assert end==pair['endsAt']+45000
 assert page.locator('#fertilizeRanch').is_disabled()
 page.evaluate("localStorage.setItem('__ranchNow',String(window.__qimeng3d.state.ranch.batch.maturesAt))")
 page.wait_for_function('!document.getElementById("harvestOffspring").disabled')
 page.locator('#ranchPanel .demo summary').click()
 for visitor in ['visitor-a','visitor-b']:
  page.locator('#ranchVisitor').select_option(visitor);page.locator('#stealOffspring').click()
 page.locator('#ranchVisitor').select_option('visitor-c');assert page.locator('#stealOffspring').is_disabled()
 page.locator('#harvestOffspring').click();assert '2 只' in page.locator('#ownerInventory').inner_text()
 # A second eligible male may pair, but the first father is resting.
 page.wait_for_function('window.__qimeng3d.state.ranch.pairing!==null')
 failed=page.evaluate('window.__qimeng3d.state.ranch.pairing');assert failed['outcome'] is False
 assert failed['maleId']!=pair['maleId']
 assert page.evaluate('(id)=>window.__qimeng3d.state.ranch.animals.find(a=>a.id===id).restUntil>Date.now()',pair['maleId'])
 page.evaluate("localStorage.setItem('__ranchNow',String(Date.now()+30000))")
 page.wait_for_function("window.__qimeng3d.state.ranch.lastOutcome==='failed'")
 assert page.evaluate('window.__qimeng3d.state.ranch.batch') is None
 assert page.evaluate('window.__qimeng3d.state.ranch.animals.length')==3
 assert page.evaluate('window.__qimeng3d.state.ranch.pairing===null')
 assert '休息' in page.locator('#animalList').inner_text()
 page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo(0,0)')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(ROOT/'.artifacts/ranch-v07-mobile.png'),full_page=True)
 # Legacy save migration preserves an existing batch even with only one former breeder.
 legacy=page.evaluate('window.__qimeng3d.state')
 legacy['ranch']={'speciesId':'sheep','cycle':1,'batch':{'batchId':'legacy','ownerId':'local-owner','productId':'sheep-offspring','kind':'offspring','initialYield':4,'maturesAt':1800000900000,'stolen':0,'visitors':[],'collected':False,'revision':0},'inventory':[],'visitorInventory':{},'visitorCoins':{}}
 page.add_init_script('if(!localStorage.getItem("__migrationFixture")){localStorage.setItem("qimeng-3d-v1",'+json.dumps(json.dumps(legacy))+');localStorage.setItem("__migrationFixture","1");}')
 page.reload();page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
 assert page.evaluate('window.__qimeng3d.state.ranch.animals[0].sex')=='female'
 assert page.evaluate('window.__qimeng3d.state.ranch.batch.batchId')=='legacy'
 assert page.evaluate('!!localStorage.getItem("qimeng-3d-v1-before-ranch-v4")')
 assert not errors,errors
 print('PASS: single-sheep care, random same-sex purchases, trough consumption, automatic pair, persisted outcome, success/failure, pregnancy acceleration, half theft, mobile layout and legacy migration.')
 browser.close()
