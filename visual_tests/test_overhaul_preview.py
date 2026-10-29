import os
"""Visual interaction checks for the redesigned UI preview.
Does NOT establish a passing live Next.js or native Mac application.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML=(Path(__file__).resolve().parents[1]/'design/overhaul_preview.html').read_text()


def test_navigation_focus_and_mobile_no_overflow():
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),args=['--no-sandbox'])
        for width,height in ((1440,900),(390,844)):
            page=browser.new_page(viewport={'width':width,'height':height})
            page.set_content(HTML)
            for slug,label in [('home','Home'),('learn','Learn'),('bank','Question Bank'),('solve','Solve'),('tests','Practice Tests'),('analytics','Analytics')]:
                if slug != 'home':
                    if page.locator('.shell').evaluate('(node) => node.classList.contains("focusMode")'):
                        page.locator('.back[data-target="bank"]').click()
                    if slug!='bank' or page.locator('#currentPage').inner_text()!='Question Bank':
                        page.locator(f'.navItem[data-target="{slug}"]').click()
                assert page.locator('#currentPage').inner_text()==label
                assert page.locator(f'#screen-{slug}').is_visible()
                assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth'),f'{slug} at {width}'
                assert page.locator('.shell').evaluate('(node) => node.classList.contains("focusMode")')==(slug=='solve')
                if slug=='solve':
                    assert not page.locator('.side').is_visible()
                else:
                    assert page.locator('.side').is_visible()
            page.close()
        browser.close()


def test_question_answer_and_separate_learning():
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.set_content(HTML)
        page.locator('.navItem[data-target="learn"]').click()
        assert page.locator('#screen-learn .lessonLayout').is_visible()
        assert not page.locator('#screen-bank').is_visible()
        page.locator('.navItem[data-target="bank"]').click()
        page.locator('.bankRow').first.click()
        assert page.locator('#screen-solve').is_visible()
        page.locator('.choice').nth(2).click()
        page.locator('#checkBtn').click()
        assert 'Correct' in page.locator('#solveDemoFeedback').inner_text()
        assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
        browser.close()
