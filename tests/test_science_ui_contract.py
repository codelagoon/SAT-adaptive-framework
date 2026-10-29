from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
UI=(ROOT/'overlay/apps/web/src/app/mastery/workspace-ui.tsx').read_text()

def test_next_question_policy_controls_actual_grading_mode():
    # 'Challenge' may actually be auto-selected as a due review or repair.
    # The recorded mode must match the SERVER's effective mode.
    assert 'setPracticeMode(item.effective_mode)' in UI
    assert 'learning_guidance' in UI
    assert 'Attempt from memory' in UI

def test_learn_starts_with_self_check_not_shown_example():
    assert 'revealedSkill' in UI
    assert 'Reveal worked example' in UI
    assert 'chosenLesson.lesson?.check' in UI
    assert 'revealedSkill===chosenLesson.name' in UI

def test_analytics_exposes_retention_separately_from_independent_accuracy():
    assert 'delayed_retention' in UI
    assert 'independent_transfer' in UI
    assert 'Delayed retention' in UI

def test_next_after_feedback_requeries_adaptive_selector_instead_of_bypassing_it():
    # The next question must go through /next, allowing repair, review and mixing.
    assert 'Next adaptive question' in UI
    assert 'href={link("solve","&mode=challenge")}' in UI
    assert 'Next unseen question' not in UI

def test_remediation_uses_a_distinct_optional_worked_example_after_hint():
    # Help remains explicitly opted-in and is provenance-marked by the server.
    assert 'help.worked_example' in UI
    assert 'question.learning_guidance?.scaffold==="worked_example_available"' in UI
