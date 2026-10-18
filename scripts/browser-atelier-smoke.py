"""Crafting from farm/ranch production, without lottery."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':900});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("Date.now=()=>Number(localStorage.getItem('__time')||'1800000000000');Math.random=()=>.99")
 page.goto('http://127.0.0.1:4174/play.html');page.wait_for_function('window.__qimeng3d?.ready')
 assert page.locator('#drawTicket').count()==0
 assert page.evaluate('window.__qimeng3d.state.atelier.version')==2
 for crop in ['corn','watermelon']:
  page.locator('#seed').select_option(crop);page.locator('#plant').click();page.evaluate("localStorage.setItem('__time',String(Date.now()+90000))")
  page.wait_for_function('!document.querySelector("#harvest").disabled');page.locator('#harvest').click()
 page.locator('#ranchTab').click()
 for _ in range(2):page.locator('#buyBreeder').click()
 page.evaluate("localStorage.setItem('__time',String(Date.now()+8*3600000))")
 page.wait_for_function('!document.querySelector("[data-groom-animal]").disabled')
 for button in page.locator('[data-groom-animal]').all():button.click()
 assert page.evaluate('window.__qimeng3d.state.atelier.materials.wool')==4
 page.locator('#wardrobeTab').click();page.locator('[data-craft-skin="dawn"]').click();page.locator('[data-equip-skin="dawn"]').click()
 assert page.evaluate('window.__qimeng3d.renderInfo.wardrobeSkin')=='dawn'
 page.reload();page.wait_for_function('window.__qimeng3d?.ready');page.locator('#wardrobeTab').click()
 assert page.evaluate('window.__qimeng3d.renderInfo.wardrobeSkin')=='dawn'
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS no lottery, dyes from harvest + wool from grooming, craft/equip/reload, mobile layout')
 b.close()
