"""Integration checks for the real WebGL prototype. Start PORT=4174 npm start first."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.artifacts'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('QIMENG_TEST_URL', 'http://127.0.0.1:4174')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/play.html', wait_until='networkidle')
    page.wait_for_function('window.__qimeng3d?.ready && window.__qimeng3d.renderInfo?.assetLoaded', timeout=45000)
    assert page.evaluate('window.__qimeng3d.renderInfo.triangles > 0')
    page.locator('#seed').select_option('watermelon')
    page.locator('#plant').click()
    assert page.locator('#coins').inner_text() == '188'
    page.locator('#farmPanel .demo summary').click()
    assert page.locator('#steal').is_disabled()
    page.locator('#mature').click()
    for suffix in 'abcde':
        page.locator('#visitor').select_option('visitor-' + suffix)
        page.locator('#steal').click()
        if suffix == 'a':
            page.locator('#steal').click()
            assert '已经摘取' in page.locator('#notice').inner_text()
    page.locator('#visitor').select_option('visitor-f')
    assert page.locator('#steal').is_disabled()
    assert page.evaluate('window.__qimeng3d.state.plots[0].batch.stolen') == 20
    page.screenshot(path=str(OUT / '3d-farm-desktop.png'))
    page.locator('#harvest').click()
    assert page.locator('#coins').inner_text() == '208'
    page.locator('#faceTab').click()
    initial_scale = page.evaluate('window.__qimeng3d.renderInfo.eyeScale')
    page.locator('[data-preset="long"]').click()
    assert page.locator('#number-eyeWidth').input_value() == '32'
    assert page.evaluate('window.__qimeng3d.renderInfo.eyeScale') != initial_scale
    page.locator('#number-faceWidth').fill('35')
    page.locator('#number-faceWidth').dispatch_event('input')
    assert abs(page.evaluate('window.__qimeng3d.renderInfo.faceWidth') - 0.7) < 0.001
    page.locator('[data-outfit="lilac"]').click()
    page.locator('#exportFace').click()
    page.wait_for_function('document.getElementById("faceCode").value.startsWith("QM3D2:")')
    code = page.locator('#faceCode').input_value()
    page.locator('#resetFace').click()
    page.locator('#faceCode').fill(code)
    page.locator('#importFace').click()
    assert page.locator('#number-eyeWidth').input_value() == '32'
    bad = json.loads(base64.b64decode(code[6:]))
    bad['face']['eyeWidth'] = 900
    page.locator('#faceCode').fill('QM3D2:' + base64.b64encode(json.dumps(bad).encode()).decode())
    page.locator('#importFace').click()
    assert '导入失败' in page.locator('#notice').inner_text()
    assert page.locator('#number-eyeWidth').input_value() == '32'
    page.reload(wait_until='networkidle')
    page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded', timeout=45000)
    assert page.locator('#coins').inner_text() == '208'
    page.locator('#faceTab').click()
    assert page.locator('#number-faceWidth').input_value() == '35'
    assert page.evaluate('window.__qimeng3d.state.outfit') == 'lilac'
    page.screenshot(path=str(OUT / '3d-face-desktop.png'))
    page.locator('#farmTab').click()
    position = page.evaluate('window.__qimeng3d.renderInfo.position')
    page.locator('#world').click(position={'x': 50, 'y': 250})
    page.keyboard.down('w')
    page.wait_for_function('(z)=>Math.abs(window.__qimeng3d.renderInfo.position[2]-z)>.02', arg=position[2])
    page.keyboard.up('w')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT / '3d-farm-mobile.png'), full_page=True)
    page.locator('#faceTab').click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT / '3d-face-mobile.png'), full_page=True)

    offline = browser.new_page(viewport={'width': 1280, 'height': 900})
    offline.on('pageerror', lambda e: errors.append(str(e)))
    blocked = []
    def block_network(route):
        blocked.append(route.request.url)
        route.abort()
    offline.route('http://**/*', block_network)
    offline.route('https://**/*', block_network)
    offline.set_content((ROOT / 'web/play-offline.html').read_text(), wait_until='load')
    offline.wait_for_function('window.__qimeng3d?.ready && window.__qimeng3d.renderInfo?.assetLoaded', timeout=45000)
    assert not blocked, blocked
    offline.locator('#faceTab').click()
    offline.locator('[data-preset="long"]').click()
    assert offline.locator('#number-eyeWidth').input_value() == '32'
    assert not errors, errors
    print('PASS: actual GLB/WebGL, model eye transforms and face morph, share validation, persistence, shared theft/harvest, movement, mobile layout, fully embedded build with network blocked.')
    print('Renderer diagnostic only (not mobile performance):', page.evaluate('window.__qimeng3d.renderInfo'))
    browser.close()
