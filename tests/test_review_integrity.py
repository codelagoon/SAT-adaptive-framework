"""Reproductions from independent whole-branch review; real SQLite behavior."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'overlay/apps/api'))
from mastery_ext import engine,analytics,workspace

BASE=datetime(2026,10,20,12,tzinfo=timezone.utc)
@pytest.fixture(autouse=True)
def isolated(monkeypatch,tmp_path):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))
    monkeypatch.setattr(engine,'utcnow',lambda:BASE)

def grade(result,problem,skill='Algebra',correct=True,mode='challenge',level=3):
    engine.prepare_context('u',problem,None,'',mode,level)
    engine.record_attempt(result_id=result,user_id='u',course_id='c',problem_id=problem,skills=[skill],correct=correct)

def question(id,skill='Algebra'):
    return {'id':id,'question':'Independent check','knowledge_points':[skill],
            'difficulty_layer':3,'problem_metadata':{'hint':'Private instructional help'}}

def test_selection_cannot_bypass_server_logged_hint_exposure():
    selected=engine.choose_next('u','c',[question('q')])
    assert 'hint' not in selected
    assert 'Private instructional help' not in str(selected)

def test_late_pregrade_draft_cannot_resurrect_after_submission():
    with engine.connect() as c:workspace.save_draft(c,'u','c','q','A')
    grade('graded','q')
    with engine.connect() as c:
        assert workspace.read_draft(c,'u','c','q') is None
        with pytest.raises(ValueError,match='stale'):
            workspace.save_draft(c,'u','c','q','A')

def test_repeated_items_do_not_establish_skills_for_interleaving():
    for skill in ['Algebra','Statistics']:
        for i in range(3):grade(f'{skill}{i}',skill+'-same',skill)
    selected=engine.choose_next('u','c',[question('new-a'),question('new-s','Statistics')])
    assert selected['learning_guidance']['interleaved'] is False

def test_repeating_original_hard_item_cannot_certify_transfer():
    grade('miss','hard',correct=False)
    grade('repair','easy',mode='repair',level=1)
    before=engine.summary('u','c')['skills'][0]
    grade('repeat','hard',mode='transfer')
    after=engine.summary('u','c')
    assert any(p['phase']=='transfer' for p in after['learning_phases'])
    assert after['skills'][0]['due_at']==before['due_at']
    assert after['skills'][0]['p']==before['p']

def test_unsubmitted_help_resets_retention_cutoff(monkeypatch):
    grade('initial','q1')
    monkeypatch.setattr(engine,'utcnow',lambda:BASE+timedelta(days=2))
    engine.mark_hint_exposure('u','c','q-help-only')
    monkeypatch.setattr(engine,'utcnow',lambda:BASE+timedelta(days=2,minutes=1))
    grade('review','q2',mode='review')
    with engine.connect() as c:
        report=analytics.report(c,'u','c')
        assert report['delayed_retention']['total']==0
        assert c.execute('SELECT review_successes FROM review_progress').fetchone()[0]==0

def test_assisted_repeats_are_counted_once_in_other_attempts():
    engine.mark_hint_exposure('u','c','hinted')
    grade('first','hinted');grade('second','hinted')
    with engine.connect() as c:
        report=analytics.report(c,'u','c')
    assert report.get('other_attempts',{}).get('total')==2
