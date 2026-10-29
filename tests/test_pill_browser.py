import os
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

HTML_PATH = Path(__file__).resolve().parents[1]/'design/tenet-neutral-ink-ui-preview.html'
SHOTS=Path(os.environ.get('TENET_PREVIEW_SCREENSHOTS',str(Path(__file__).resolve().parents[1]/'build/preview-screenshots')))

@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage'])
        yield b
        b.close()

@pytest.mark.parametrize('width,height',[(1440,900),(1280,800),(390,844)])
def test_one_viewport_and_nav_work(browser,width,height):
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(Path(HTML_PATH).read_text(),wait_until="load")
    page.locator('.dock').wait_for()
    assert page.locator('.navItem').count()==5
    assert page.locator('.navItem[aria-current="page"]').count()==1
    assert page.locator('.navItem[aria-label="Question Bank"]').is_visible()
    side=page.locator('.side').bounding_box()
    dock=page.locator('.dock').bounding_box()
    if width>760:
        assert side['width'] <= 80,side
        assert dock['width']<=60,dock
        assert dock['height']<450,dock
    else:
        assert dock['width']<=width-24,dock
        assert dock['height']<=68,dock
        assert dock['y']>=height-92,dock
    dims=page.evaluate('''() => ({ w:document.documentElement.scrollWidth, vw:innerWidth, h:document.documentElement.scrollHeight, vh:innerHeight, app:document.querySelector('.shell').getBoundingClientRect().height})''')
    assert dims['w']<=width and dims['h']<=height+1 and dims['app']<=height+1,dims
    page.locator('.navItem[aria-label="Learn"]').click()
    assert page.locator('#crumb').inner_text()=='Learn'
    assert page.locator('.navItem[aria-label="Learn"]').get_attribute('aria-current')=='page'
    assert page.locator('.navItem[aria-label="Home"]').get_attribute('aria-current') is None
    assert not errors,errors
    page.locator('.navItem[aria-label="Home"]').click()
    page.mouse.move(width-5,20)
    page.screenshot(path=str(SHOTS/f'home-{width}.png'),animations='disabled')
    page.close()


def test_tooltip_and_keyboard_navigation(browser):
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.set_content(Path(HTML_PATH).read_text(),wait_until="load")
    item=page.get_by_role('button',name='Question Bank')
    item.hover()
    page.wait_for_function("e=>getComputedStyle(e,'::after').visibility==='visible'",
                           arg=item.element_handle(),timeout=5000)
    assert item.evaluate("e=>getComputedStyle(e,'::after').visibility")=='visible'
    page.wait_for_function("() => getComputedStyle(document.querySelector('.navItem[data-page=\"Question Bank\"]'),'::after').opacity === '1'")
    item.focus()
    page.keyboard.press('Enter')
    assert page.locator('#crumb').inner_text()=='Question Bank'
    page.screenshot(path=str(SHOTS/'question-bank-1440.png'))
    page.close()


@pytest.mark.parametrize('name',["Learn","Question Bank","Practice Tests","Analytics","Solve"])
def test_every_page_retains_dock_and_viewport(browser,name):
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.set_content(Path(HTML_PATH).read_text(),wait_until="load")
    page.evaluate('(name)=>render(name)',name)
    assert page.locator('#crumb').inner_text()==name
    side=page.locator('.side')
    if name=='Solve':
        assert side.is_hidden()
    else:
        assert side.is_visible()
        assert page.locator('.navItem[aria-current="page"]').count()==1
    assert page.evaluate('document.documentElement.scrollHeight <= innerHeight+1')
    page.mouse.move(1400,20)
    page.screenshot(path=str(SHOTS/(name.lower().replace(' ','-')+'-1440.png')),animations='disabled')
    page.close()
