"""Optional Playwright smoke on the *actual running* Next app, not the reference HTML.

Run after authenticating a disposable local learner profile:
  MASTERY_E2E_URL=http://127.0.0.1:18766 \
  MASTERY_E2E_STORAGE_STATE=/path/to/test-account-storage.json \
    python -m pytest visual_tests/test_live_next_ui.py -q

Never paste real user cookies into CI. Use a disposable account and avoid a
production profile. This test skips rather than giving false assurance when the
real app/auth context is unavailable.
"""
import os
from pathlib import Path
from urllib.parse import urlsplit
import pytest
from playwright.sync_api import sync_playwright

BASE = os.getenv('MASTERY_E2E_URL','').strip().rstrip('/')
STATE = os.getenv('MASTERY_E2E_STORAGE_STATE','').strip()
SCREEN = Path(os.getenv('MASTERY_E2E_SCREENSHOTS','/tmp/mastery-e2e-screenshots'))
pytestmark = pytest.mark.skipif(not BASE or not STATE,
    reason='Real Next app and disposable authenticated storage state not supplied')

@pytest.fixture(scope='module')
def browser():
    parsed=urlsplit(BASE)
    if parsed.hostname not in {'127.0.0.1','localhost'}:
        pytest.skip('This test is intentionally restricted to a local disposable test app')
    if not Path(STATE).is_file():pytest.skip('No disposable auth state found')
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_EXECUTABLE'),args=['--no-sandbox'])
        yield b
        b.close()

@pytest.mark.parametrize('width,height',[(1440,900),(960,900),(390,844)])
def test_live_screens_render_without_overflow(browser,width,height):
    SCREEN.mkdir(parents=True,exist_ok=True)
    c=browser.new_context(viewport={'width':width,'height':height},storage_state=STATE)
    page=c.new_page()
    for route,heading in [('/mastery','Make progress'),('/mastery/learn','Understand the concept'),
          ('/mastery/bank','Choose your practice'),('/mastery/solve','Question Bank'),
          ('/mastery/tests','Test your knowledge'),('/mastery/analytics','Know what to improve')]:
        page.goto(BASE+route,wait_until='networkidle',timeout=60000)
        assert page.locator('main').count()>0,route
        assert heading in page.locator('body').inner_text(),route
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),route
        assert page.locator('[role="alert"]').count()==0,route
        page.screenshot(path=str(SCREEN/f'{route.replace("/","_")}_{width}.png'),full_page=True)
    c.close()
