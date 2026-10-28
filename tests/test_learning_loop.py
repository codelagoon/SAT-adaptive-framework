"""Adversarial core-flow checks: no review starvation or fake diagnosis."""
from datetime import datetime,timedelta,timezone
import os
from pathlib import Path
import sys
import sqlite3
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'overlay/apps/api'))
from mastery_ext import engine
from mastery_ext.offline_diagnosis import diagnose
from mastery_ext.practice_bank import generate_verified

@pytest.fixture(autouse=True)
def isolated(tmp_path,monkeypatch):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))


def question(number,skill='Algebra',difficulty=3):
    return {'id':str(number),'question':str(number),'knowledge_points':[skill],
            'difficulty_layer':difficulty,'question_type':'mc'}


def attempt(id,problem,skill,correct,mode='challenge',level=None):
    engine.prepare_context('u','c_'+str(problem),4,'My first method',mode,level)
    return engine.record_attempt(result_id=str(id),user_id='u',course_id='course',
            problem_id='c_'+str(problem),skills=[skill],correct=correct)


def test_wrong_repair_correct_transfer_correct_challenge():
    qs=[question('c_1','Algebra',3),question('c_2','Algebra',1),question('c_3','Algebra',3),
        question('c_4','Statistics',3)]
    attempt('r1',1,'Algebra',False,level=3)
    selected=engine.choose_next('u','course',qs)
    assert selected['effective_mode']=='repair'
    assert selected['difficulty_layer']==1
    assert selected['focus_skill']=='Algebra'
    attempt('r2',2,'Algebra',True,'repair',level=1)
    selected=engine.choose_next('u','course',qs)
    assert selected['effective_mode']=='transfer'
    assert selected['difficulty_layer']==3
    assert selected['id']!='c_1'
    attempt('r3',3,'Algebra',True,'transfer',level=3)
    assert engine.summary('u','course')['learning_phases']==[]
    assert engine.choose_next('u','course',qs)['effective_mode']=='challenge'


def test_wrong_transfer_causes_another_repair():
    qs=[question('c_1','Algebra',3),question('c_2','Algebra',1),question('c_3','Algebra',3)]
    attempt('r1',1,'Algebra',False,level=3)
    attempt('r2',2,'Algebra',True,'repair',level=1)
    attempt('r3',3,'Algebra',False,'transfer')
    assert engine.choose_next('u','course',qs)['effective_mode']=='repair'


def test_due_review_cannot_be_starved_by_thousands_of_new_items():
    attempt('r1',1,'Kinematics',True)
    with engine.connect() as conn:
        conn.execute('UPDATE mastery SET due_at=? WHERE user_id=?',
                     ((datetime.now(timezone.utc)-timedelta(days=2)).isoformat(),'u'))
    qs=[question('c_1','Kinematics',3),question('c_2','Kinematics',3)]
    qs.extend(question(f'unseen-{i}', 'Other skill',3) for i in range(2000))
    chosen=engine.choose_next('u','course',qs,mode='review')
    assert chosen['id']=='c_2'
    assert chosen['reviewing'] is True
    # Normal challenge also reserves a reliable part of its cycle for reviews.
    chosen=engine.choose_next('u','course',qs,mode='challenge')
    assert chosen['id']=='c_2'


def test_study_turn_count_not_inflated_by_multiple_skill_rows():
    engine.record_attempt(result_id='r1',user_id='u',course_id='course',problem_id='p1',
                          skills=['A','B','C'],correct=True)
    with engine.connect() as conn:
        turn_count=conn.execute("SELECT COUNT(*) FROM attempts WHERE result_id NOT LIKE '%:%'").fetchone()[0]
    assert turn_count==1


def test_streak_schedule_and_reset():
    for i in range(3):
        attempt(f'r{i}',i,'Reading',True)
    state=engine.summary('u','course')['skills'][0]
    assert state['streak']==3
    due=datetime.fromisoformat(state['due_at'])
    assert timedelta(days=6) < due-datetime.now(timezone.utc) < timedelta(days=8)
    attempt('wrong',5,'Reading',False)
    state=engine.summary('u','course')['skills'][0]
    assert state['streak']==0
    assert timedelta(minutes=14)<datetime.fromisoformat(state['due_at'])-datetime.now(timezone.utc)<timedelta(minutes=16)


def test_diagnosis_is_hypothetical_and_matches_constructed_choice():
    for q in generate_verified('SAT Math','diagnose',160):
        meta=q['problem_metadata']
        if meta['family'] not in ('_linear','_quadratic','_sequence','_geometric','_functions','_percent'):
            continue
        for letter,index in meta['distractor_index'].items():
            result=diagnose(meta,letter,q['knowledge_points'][0])
            assert result['certainty']=='possible, not confirmed'
            assert result['offline'] is True
            assert result['evidence']=='constructed_distractor'
            assert len(result['hypothesis'])>30
            assert letter!=q['correct_answer']
    unknown=diagnose({'family':'unknown'},'B','Physics')
    assert unknown['evidence']=='insufficient'
    assert 'does not identify' in unknown['hypothesis']


def test_old_v03_database_migrates_without_losing_mastery():
    db=engine.db_path()
    with sqlite3.connect(db) as conn:
        conn.executescript('''CREATE TABLE mastery(user_id TEXT,course_id TEXT,skill TEXT,p REAL,n INTEGER,due_at TEXT,last_at TEXT,PRIMARY KEY(user_id,course_id,skill));
          CREATE TABLE context(user_id TEXT,problem_id TEXT,confidence INTEGER,reasoning TEXT,prepared_at TEXT,PRIMARY KEY(user_id,problem_id));''')
        conn.execute("INSERT INTO mastery VALUES ('u','c','Existing skill',0.7,2,'2026-01-01','2026-01-01')")
    result=engine.summary('u','c')
    assert result['skills'][0]['p']==.7
    with engine.connect() as conn:
        assert 'streak' in [r['name'] for r in conn.execute('PRAGMA table_info(mastery)')]
        assert 'mode' in [r['name'] for r in conn.execute('PRAGMA table_info(context)')]


def test_phase_is_scoped_per_user_and_course():
    attempt('r1',1,'Algebra',False)
    assert not engine.summary('another','course')['learning_phases']
    assert not engine.summary('u','other')['learning_phases']


def test_selector_refuses_invalid_modes():
    with pytest.raises(ValueError):engine.choose_next('u','course',[question('q')],mode='untrusted')
    with pytest.raises(ValueError):engine.prepare_context('u','q',None,'',mode='untrusted')

def test_skip_repair_does_not_erase_mistakes_or_reviews():
    attempt('r1',1,'Algebra',False)
    before=engine.summary('u','course')
    assert before['learning_phases']
    assert engine.skip_repair('u','course','Algebra') is True
    after=engine.summary('u','course')
    assert after['learning_phases']==[]
    assert len(after['recent_errors'])==1
    assert after['skills'][0]['n']==1
    assert engine.skip_repair('u','course','Algebra') is False

def test_no_false_claim_of_simpler_repair_when_only_hard_items_exist():
    attempt('r1',1,'Rare reading skill',False)
    choice=engine.choose_next('u','course',[question('c_1','Rare reading skill',3),question('c_2','Rare reading skill',3)])
    assert choice['effective_mode']=='repair'
    assert 'no simpler question' in choice['reason']


def test_focused_skill_auto_progresses_queued_repair():
    attempt('r1',1,'Algebra',False)
    choice=engine.choose_next('u','course',[question('c_1','Algebra',3),question('c_2','Algebra',1)],focus_skill='Algebra')
    assert choice['effective_mode']=='repair'
