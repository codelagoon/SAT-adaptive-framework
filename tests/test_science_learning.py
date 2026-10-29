"""Test-first learning-science contracts; time-based evidence must be real."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'overlay/apps/api'))
from mastery_ext import engine, analytics

@pytest.fixture(autouse=True)
def isolated(monkeypatch,tmp_path):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))

BASE=datetime(2026,10,10,12,tzinfo=timezone.utc)

def grade(monkeypatch,when,id,problem,skill='Algebra',correct=True,mode='challenge',helped=False):
    monkeypatch.setattr(engine,'utcnow',lambda:when)
    engine.prepare_context('u',problem,4,'I chose a rule',mode,3,helped)
    assert engine.record_attempt(result_id=id,user_id='u',course_id='c',problem_id=problem,
                                 skills=[skill],correct=correct)

def due(skill='Algebra'):
    return next(x for x in engine.summary('u','c')['skills'] if x['skill']==skill)

def q(num,skill='Algebra'):
    return {'id':num,'question':'A new problem','knowledge_points':[skill],
            'difficulty_layer':2,'question_type':'mc'}

def test_true_spacing_same_day_correct_cannot_skip_due_review(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    first=datetime.fromisoformat(due()['due_at'])
    assert timedelta(hours=23) < first-BASE < timedelta(hours=25)
    grade(monkeypatch,BASE+timedelta(minutes=20),'r2','q2')
    assert datetime.fromisoformat(due()['due_at']) == first
    grade(monkeypatch,BASE+timedelta(days=1,minutes=5),'r3','q3',mode='review')
    second=datetime.fromisoformat(due()['due_at'])
    assert timedelta(days=2, hours=23)<second-(BASE+timedelta(days=1,minutes=5))<timedelta(days=3,hours=1)
    # State must survive process/reconnect and not leak into other courses.
    with engine.connect() as conn:
        assert conn.execute('SELECT review_successes FROM review_progress WHERE user_id=? AND course_id=? AND skill=?',('u','c','Algebra')).fetchone()[0]==1
        assert conn.execute('SELECT 1 FROM review_progress WHERE course_id=?',('other',)).fetchone() is None

def test_guided_review_cannot_extend_schedule_or_count_retention(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    first=due()['due_at']
    grade(monkeypatch,BASE+timedelta(days=2),'r2','q2',mode='review',helped=True)
    assert due()['due_at']==first
    with engine.connect() as conn:
        report=analytics.report(conn,'u','c',as_of=BASE+timedelta(days=3))
    assert report['delayed_retention']['total']==0

def test_delayed_retention_independent_fresh_item_only(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    grade(monkeypatch,BASE+timedelta(hours=2),'r2','q2',mode='review')
    grade(monkeypatch,BASE+timedelta(days=2),'r3','q3',mode='review')
    grade(monkeypatch,BASE+timedelta(days=4),'r4','q3',mode='review')
    with engine.connect() as conn:
        report=analytics.report(conn,'u','c',as_of=BASE+timedelta(days=5))
    assert report['delayed_retention']=={'correct':1,'total':1,'accuracy':1.0}
    assert report['retention_by_skill'][0]['total']==1
    assert report['retention_by_skill'][0]['skill']=='Algebra'

def test_novel_transfer_is_not_inflated_by_help_and_repeat(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1',mode='transfer',helped=True)
    grade(monkeypatch,BASE+timedelta(hours=1),'r2','q2',mode='transfer')
    grade(monkeypatch,BASE+timedelta(hours=2),'r3','q2',mode='transfer')
    with engine.connect() as conn: report=analytics.report(conn,'u','c')
    assert report['independent_transfer']=={'correct':1,'total':1,'accuracy':1.0}

def test_scaffolding_is_supported_by_error_history_and_fades(monkeypatch):
    problems=[q('new')]
    first=engine.choose_next('u','c',problems)
    assert first['learning_guidance']['first_step']=='attempt_before_hint'
    assert first['learning_guidance']['scaffold']=='independent'
    grade(monkeypatch,BASE,'r1','old1',correct=False)
    grade(monkeypatch,BASE+timedelta(minutes=1),'r2','old2',correct=False)
    guided=engine.choose_next('u','c',[q('new')],focus_skill='Algebra',mode='challenge')
    assert guided['learning_guidance']['scaffold']=='worked_example_available'
    # A successful independent streak should fade worked examples, not reward coached answers.
    for i in range(3):
        grade(monkeypatch,BASE+timedelta(days=i+1),'ok'+str(i),'success'+str(i),mode='challenge')
    faded=engine.choose_next('u','c',[q('new2')],focus_skill='Algebra',mode='challenge')
    assert faded['learning_guidance']['scaffold']=='independent'

def test_interleaving_rotates_previously_practiced_skills(monkeypatch):
    for i,skill in enumerate(['Algebra','Statistics']):
        for j in range(3):
            grade(monkeypatch,BASE+timedelta(minutes=i*5+j),'e'+str(i)+str(j),f'{skill}{j}',skill=skill)
    # The last challenge was Statistics; mix into Algebra even though stats is slightly harder.
    selection=engine.choose_next('u','c',[q('a','Algebra'),q('s','Statistics')])
    assert selection['id']=='a'
    assert selection['learning_guidance']['interleaved'] is True
    explicit=engine.choose_next('u','c',[q('a','Algebra'),q('s','Statistics')],focus_skill='Statistics')
    assert explicit['id']=='s'

def test_no_interleaving_for_unlearned_prerequisites(monkeypatch):
    grade(monkeypatch,BASE,'r1','old1',skill='Algebra')
    selected=engine.choose_next('u','c',[q('a','Algebra'),q('s','Statistics')])
    assert selected['learning_guidance']['interleaved'] is False

def test_course_deletion_removes_review_progress(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    result=engine.forget_course('u','c',['q1'])
    assert result['review_progress']==1
    with engine.connect() as conn:
        assert conn.execute('SELECT COUNT(*) FROM review_progress').fetchone()[0]==0

def test_review_lapse_resets_spaced_progress_and_schedules_repair(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    grade(monkeypatch,BASE+timedelta(days=1,minutes=10),'r2','q2',mode='review')
    with engine.connect() as conn:
        assert conn.execute('SELECT review_successes FROM review_progress').fetchone()[0]==1
    failed_at=BASE+timedelta(days=5)
    grade(monkeypatch,failed_at,'r3','q3',mode='review',correct=False)
    state=due()
    assert timedelta(minutes=14)<datetime.fromisoformat(state['due_at'])-failed_at<timedelta(minutes=16)
    with engine.connect() as conn:
        stage,misses=conn.execute('SELECT review_successes,retention_lapses FROM review_progress').fetchone()
    assert (stage,misses)==(0,1)


def test_early_review_correct_does_not_advance_schedule(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    initial=due()['due_at']
    grade(monkeypatch,BASE+timedelta(hours=2),'r2','q2',mode='review')
    assert due()['due_at']==initial
    with engine.connect() as conn:
        assert conn.execute('SELECT review_successes FROM review_progress').fetchone()[0]==0


def test_review_records_isolated_by_user(monkeypatch):
    grade(monkeypatch,BASE,'r1','q1')
    engine.record_attempt(result_id='other1',user_id='other',course_id='c',problem_id='x',skills=['Algebra'],correct=True)
    with engine.connect() as conn:
        a=conn.execute('SELECT COUNT(*) FROM review_progress WHERE user_id=?',('u',)).fetchone()[0]
        b=conn.execute('SELECT COUNT(*) FROM review_progress WHERE user_id=?',('other',)).fetchone()[0]
    assert a==b==1
    engine.forget_course('u','c',['q1'])
    with engine.connect() as conn:
        assert conn.execute('SELECT COUNT(*) FROM review_progress WHERE user_id=?',('other',)).fetchone()[0]==1
