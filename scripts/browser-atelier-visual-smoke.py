"""Render real atelier ornaments independently of UI progression."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':800,'height':900})
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:4174/play.html',wait_until='networkidle')
    page.evaluate('''async()=>{const {createWorld}=await import('./world3d.mjs');const canvas=document.createElement('canvas');canvas.style='position:fixed;inset:0;width:800px;height:900px;z-index:99999';document.body.append(canvas);window.atelierWorld=createWorld({canvas});await atelierWorld.ready;atelierWorld.setMode('wardrobe');}''')
    baseline=page.evaluate('atelierWorld.debug.triangles')
    for skin,garment,outfit in [('dawn','garden','rose'),('moon','court','lilac'),('forest','ranger','sage')]:
        page.evaluate('([skin,garment,outfit])=>{atelierWorld.setGarment(garment);atelierWorld.setOutfit(outfit);atelierWorld.setWardrobeSkin(skin);}',[skin,garment,outfit])
        page.wait_for_timeout(800)
        info=page.evaluate('atelierWorld.debug')
        assert info['wardrobeSkin']==skin and info['wardrobeSkinVisible']==1,info
        assert info['assetLoaded']
        page.screenshot(path=str(OUT/f'atelier-{skin}.png'))
    page.evaluate('atelierWorld.setWardrobeSkin(null)')
    assert page.evaluate('atelierWorld.debug.wardrobeSkinVisible')==0
    page.evaluate('atelierWorld.setWardrobeSkin("invalid")')
    assert page.evaluate('atelierWorld.debug.wardrobeSkin') is None
    page.evaluate('atelierWorld.dispose()')
    assert not errors,errors
    browser.close()
print('PASS: three distinct atelier ornaments render, clear safely, and dispose without browser errors.')
