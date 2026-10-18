"""Validate articulated motion and studio reset on the actual loaded model."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(os.getenv('QIMENG_TEST_URL', 'http://127.0.0.1:4174') + '/play.html')
    page.wait_for_function('window.__qimeng3d?.renderInfo?.assetLoaded')
    assert page.evaluate('window.__qimeng3d.renderInfo.motion.joints') == 10
    for garment in ['garden', 'court', 'ranger']:
        page.locator('#wardrobeTab').click()
        page.locator(f'[data-garment="{garment}"]').click()
        page.locator('#farmTab').click()
        page.locator('#world').click(position={'x': 50, 'y': 250})
        page.keyboard.down('a')
        page.wait_for_function('window.__qimeng3d.renderInfo.motion.active && window.__qimeng3d.renderInfo.motion.angles.some(a=>Math.abs(a)>.03)')
        page.keyboard.up('a')
        assert page.evaluate('window.__qimeng3d.renderInfo.motion.angles.every(Number.isFinite)')
        page.locator('#wardrobeTab').click()
        assert page.evaluate('window.__qimeng3d.renderInfo.motion.angles.every(a=>a===0)')
        assert page.evaluate('window.__qimeng3d.renderInfo.garmentVisible') == 1
    page.screenshot(path=str(root / '.artifacts/motion-ranger-rest.png'))
    page.locator('#faceTab').click()
    page.locator('[data-preset="long"]').click()
    assert page.locator('#number-eyeWidth').input_value() == '32'
    assert not errors, errors
    print('PASS: 10 limb pivots, all three garments animate, finite angles, studio reset and face controls; no script errors.')
    browser.close()
