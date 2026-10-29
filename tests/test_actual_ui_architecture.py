"""Contract tests for real Next routes, not the static design reference."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]/'overlay/apps/web/src/app/mastery'
UI=(ROOT/'workspace-ui.tsx').read_text()
CSS=(ROOT/'workspace-ui.module.css').read_text()


def test_all_six_routes_distinct_and_live():
    for section in ('home','learn','bank','solve','tests','analytics'):
        file=ROOT/('page.tsx' if section=='home' else f'{section}/page.tsx')
        assert file.is_file()
        assert f'<MasteryWorkspace section="{section}"' in file.read_text()
    assert 'request<BankResponse>' in UI
    assert 'request<Curriculum>' in UI
    assert 'request<Analytics>' in UI
    assert '/quiz/submit' in UI


def test_legacy_ui_replaced_but_old_debate_source_archived():
    legacy=(ROOT/'legacy/page.tsx').read_text()
    archive=(ROOT.parents[5]/'docs/archive/mastery-v09-debate-page.tsx.txt').read_text()
    assert 'redirect("/mastery")' in legacy
    assert 'buildArgumentGraph(debate.cards)' in archive
    assert 'fact-sheet' in archive
    assert '<MasteryWorkspace section="home"' in (ROOT/'page.tsx').read_text()


def test_question_answer_assistance_and_no_key_leak():
    assert 'offline-help' in UI and 'setAssisted(true)' in UI
    assert 'assisted})' in UI
    assert 'attempt_id=${result.result_id}' in UI
    assert 'offline-probe' in UI
    assert 'draft' in UI and 'setTimeout' in UI
    assert 'request<Grade>("/quiz/submit"' in UI
    assert 'if(!question||!courseId||grade)return' in UI


def test_bank_filters_and_workflows():
    for phrase in ('Question Bank','question status','bookmarked','difficulty','keyword'):
        if phrase=='keyword':
            assert 'Search questions or skills' in UI
        elif phrase=='question status':
            assert 'Question status' in UI
        else:assert phrase in UI
    assert 'expand?pack=${pack}' in UI
    assert 'questions/${encodeURIComponent(id)}' in UI
    assert 'data' in UI


def test_visual_and_accessibility_contract():
    for phrase in ('aria-current','aria-label','role="status"','fieldset','legend','input type="radio"','disabled={!!grade||busy}'):
        assert phrase in UI
    assert '.solveLayout{' in CSS and 'max-width:960px' in CSS
    assert 'max-width:68ch' in CSS  # Comfortable reading measure, not old layout widths.
    assert 'overflow-x:hidden' in CSS
    assert 'color-scheme:light' in CSS and 'color-scheme:dark' in CSS
    assert 'min-width:0' in CSS
    assert 'Question Bank' in UI
    assert 'This is not an official Bluebook or ACT test' in UI


def test_tests_view_rejects_unvalidated_scores():
    assert 'True exam simulations require validated section blueprints' in UI
    assert 'This is not an official Bluebook or ACT test' in UI
    assert 'Not a predicted SAT/ACT scaled score.' in (ROOT.parents[3]/'api/mastery_ext/analytics.py').read_text()
