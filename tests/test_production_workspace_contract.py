"""Source-level checks only. These cannot substitute for upstream Next/real-window QA."""
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]/'overlay/apps/web/src/app/mastery'
SRC=(BASE/'workspace-ui.tsx').read_text(encoding='utf-8')


def test_six_separate_navigation_routes_exist():
    for slug in ('learn','bank','solve','tests','analytics'):
        source=(BASE/slug/'page.tsx').read_text()
        assert 'MasteryWorkspace' in source
        assert f'section="{slug}"' in source
    assert 'section="home"' in (BASE/'page.tsx').read_text()


def test_old_quiz_page_replaced_without_losing_study_engine():
    old=(BASE/'legacy/page.tsx').read_text()
    assert 'redirect("/mastery")' in old
    assert 'Legacy study tools' not in SRC
    assert 'request<Grade>("/quiz/submit"' in SRC
    assert 'ProblemGraph' in SRC
    archive=(BASE.parents[5]/'docs/archive/mastery-v09-debate-page.tsx.txt').read_text()
    assert 'async function submit(' in archive


def test_curriculum_is_remote_not_illustrative():
    assert 'request<Curriculum>' in SRC
    assert '/curriculum' in SRC
    assert 'worked_example' in SRC


def test_bank_has_distinct_criteria_and_private_answer():
    assert 'status,difficulty,skill:skillFilter,query:search' in SRC.replace(' ', '')
    assert '/questions?' in SRC
    assert 'correct_answer' not in SRC.split('type BankQuestion = ')[1].split(';')[0]


def test_solver_calls_real_grade_and_marks_help_as_assisted():
    assert '/quiz/submit' in SRC
    assert '/mastery/prepare' in SRC
    assert 'assisted' in SRC
    assert 'setAssisted(true)' in SRC
    assert '<ProblemGraph data={question.graph}/>' in SRC


def test_unsaved_answer_is_persisted_but_not_grading():
    assert '/draft' in SRC
    assert 'answer,reasoning:reason' in SRC
    assert 'draftLoaded.current' in SRC
    assert 'clear_draft' in (Path(__file__).resolve().parents[1]/'overlay/apps/api/mastery_ext/engine.py').read_text()


def test_analytics_comes_from_recorded_events_and_tests_do_not_fake_scores():
    assert 'request<Analytics>' in SRC
    assert 'independent_first_attempts' in SRC
    assert 'Full-length, exam-calibrated SAT and ACT simulations remain a release gate.' in SRC
    assert 'Not an official' not in SRC or 'exam-calibrated' in SRC
