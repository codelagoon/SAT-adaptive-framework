import os
"""Browser tests of the isolated UI reference, not native App QA.

A full OpenTutor/Next browser test remains necessary after integration.
"""
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

HTML=(Path(__file__).resolve().parents[1]/'design/mastery_reference.html').read_text(encoding='utf-8')

@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),args=['--no-sandbox'])
        yield b
        b.close()

@pytest.mark.parametrize('width,height',[(1440,900),(960,900),(390,844)])
def test_all_screens_navigation_and_overflow(browser,width,height):
    p=browser.new_page(viewport={'width':width,'height':height})
    p.set_content(HTML,wait_until="load")
    for title in ('Learn','Question Bank','Solve','Practice Tests','Analytics','Home'):
        slug={'Learn':'learn','Question Bank':'bank','Solve':'solve','Practice Tests':'tests','Analytics':'analytics','Home':'home'}[title]
        p.locator(f'[data-page="{slug}"]').click(timeout=5000)
        assert p.locator('#currentPage').inner_text()==title
        assert p.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),title
    p.screenshot(path=str(Path(__file__).resolve().parents[1]/'design'/f'qa_{width}.png'),full_page=True)
    p.close()

def test_bank_filter_and_separate_solve(browser):
    p=browser.new_page(viewport={'width':1440,'height':900});p.set_content(HTML,wait_until="load")
    p.locator('[data-page="bank"]').click()
    p.locator('#bankSearch').fill('percent')
    assert p.locator('#bankCount').inner_text()=='1'
    p.locator('#bankDifficulty').select_option('easy')
    assert p.locator('#bankCount').inner_text()=='0'
    p.locator('#bankDifficulty').select_option('all')
    p.locator('#bankSearch').fill('')
    p.locator('#bankResults .question-row').first.click()
    assert p.locator('#solve').is_visible()
    assert not p.locator('#bank').is_visible()
    p.locator('#hintButton').click()
    assert 'Hint' in p.locator('#solveFeedback').inner_text()
    p.locator('#choices button').nth(1).click()
    p.locator('#checkButton').click()
    assert 'Correct' in p.locator('#solveFeedback').inner_text()
    p.locator('#nextButton').click()
    assert 'Question 2 of 4' in p.locator('#questionNumber').inner_text()
    p.close()

def test_lesson_is_not_question_bank(browser):
    p=browser.new_page();p.set_content(HTML,wait_until="load")
    p.locator('[data-page="learn"]').click()
    assert p.locator('#lessonTitle').inner_text()=='Conditional probability'
    p.locator('[data-lesson="seq"]').click()
    assert p.locator('#lessonTitle').inner_text()=='Arithmetic sequences'
    assert not p.locator('#bank').is_visible()
    p.close()


def test_capture_distinct_workspace_screens(browser):
    p=browser.new_page(viewport={'width':1440,'height':900})
    p.set_content(HTML,wait_until="load")
    for slug in ('learn','bank','solve','tests','analytics'):
        p.locator(f'[data-page="{slug}"]').click()
        assert p.locator(f'#{slug}').is_visible()
        assert all(not p.locator(f'#{other}').is_visible() for other in ('home','learn','bank','solve','tests','analytics') if other!=slug)
        p.screenshot(path=str(Path(__file__).resolve().parents[1]/'design'/f'qa_{slug}.png'),full_page=True)
    p.close()
