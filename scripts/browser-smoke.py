"""Optional local browser checks; requires Playwright Python and Chromium."""
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.artifacts'
ARTIFACTS.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:4173/legacy.html', wait_until='networkidle')
    page.locator('#portrait svg').wait_for()
    before = page.locator('#portrait').inner_html()
    page.locator('[data-preset="slender"]').click()
    assert page.locator('#eyeWidth').input_value() == '30'
    assert page.locator('#portrait').inner_html() != before
    page.locator('#eyeWidth').fill('42')
    page.locator('#eyeWidth').dispatch_event('input')
    page.locator('[data-outfit="lilac"]').click()
    page.locator('#save-face').click()
    page.reload(wait_until='networkidle')
    assert page.locator('#eyeWidth').input_value() == '42'
    assert 'active' in page.locator('[data-outfit="lilac"]').get_attribute('class')
    page.locator('#share-face').click()
    code = page.locator('#share-code').input_value()
    assert code.startswith('REVERIE1.')
    page.locator('#reset-face').click()
    page.locator('#share-code').fill(code)
    page.locator('#import-face').click()
    assert page.locator('#eyeWidth').input_value() == '42'
    invalid = json.loads(base64.b64decode(code[9:]))
    invalid['face']['eyeWidth'] = 999
    page.locator('#share-code').fill('REVERIE1.' + base64.b64encode(json.dumps(invalid).encode()).decode())
    page.locator('#import-face').click()
    assert page.locator('#eyeWidth').input_value() == '42'
    assert '无效' in page.locator('#toast').inner_text()
    page.locator('.import').evaluate('(e)=>e.open=false')
    page.screenshot(path=str(ARTIFACTS / 'face-desktop.png'), full_page=True)

    page.locator('[data-page="farm"]').click()
    page.locator('#seed').select_option('watermelon')
    page.locator('[data-plot="0"]').click()
    assert page.locator('#coins').inner_text() == '228'
    assert page.locator('[data-steal="0"]').is_disabled()
    page.locator('#advance').click()
    assert '40 / 40' in page.locator('[data-plot="0"]').inner_text()
    for who in ['小满', '南枝', '知夏', '云朵', '星河']:
        page.locator('#visitor').select_option(label=who)
        page.locator('[data-steal="0"]').click()
        assert page.locator('[data-steal="0"]').is_disabled()
    page.locator('#visitor').select_option(label='小鹿')
    assert page.locator('[data-steal="0"]').is_disabled()
    assert '20 / 40' in page.locator('[data-plot="0"]').inner_text()
    page.reload(wait_until='networkidle')
    page.locator('[data-page="farm"]').click()
    assert '20 / 40' in page.locator('[data-plot="0"]').inner_text()
    page.screenshot(path=str(ARTIFACTS / 'farm-desktop.png'), full_page=True)
    page.locator('[data-plot="0"]').click()
    assert page.locator('#coins').inner_text() == '248'
    assert '空地' in page.locator('[data-plot="0"]').get_attribute('aria-label')
    for mode in ['face', 'farm', 'ranch']:
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator(f'[data-page="{mode}"]').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), mode
        page.screenshot(path=str(ARTIFACTS / f'{mode}-mobile.png'), full_page=True)
    page.goto('http://127.0.0.1:4173/art.html', wait_until='networkidle')
    assert page.locator('img').evaluate('(img)=>img.complete && img.naturalWidth>0')
    assert not errors, errors
    browser.close()
print('PASS: face preset/slider/save/reload/share/import validation, planting/maturity/shared theft cap/harvest, mobile layouts, art image, no browser errors.')
