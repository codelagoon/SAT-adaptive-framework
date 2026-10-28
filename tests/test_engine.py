import os
import sys
from pathlib import Path
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'overlay/apps/api'))
from mastery_ext import engine

@pytest.fixture(autouse=True)
def isolate(tmp_path,monkeypatch):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))

def record(id='r1',user='u1',course='c1',skills=None,correct=False):
    return engine.record_attempt(result_id=id,user_id=user,course_id=course,problem_id='q1',
        skills=skills or ['Linear equations'], correct=correct, elapsed_ms=20000)

def test_bkt_correct_increases_and_wrong_decreases():
    assert engine.update_bkt(.5,True) > .5
    assert engine.update_bkt(.5,False) < .5
    assert 0 < engine.update_bkt(.99,False) < 1

def test_persistence_and_duplicate_no_double_count():
    assert record() is True
    assert record() is False
    rows=engine.summary('u1','c1')['skills']
    assert len(rows)==1 and rows[0]['n']==1

def test_own_user_and_course_isolation():
    record()
    assert engine.summary('another','c1')['skills']==[]
    assert engine.summary('u1','different')['skills']==[]

def test_confidence_and_reasoning_tracking():
    engine.prepare_context('u1','q1',5,'I assumed the sign is positive')
    record()
    report=engine.summary('u1','c1')
    assert report['high_confidence_mistakes']==1
    assert report['recent_errors'][0]['confidence']==5

def test_multi_skill_one_attempt_each():
    record(skills=['linear','algebra'])
    assert {r['skill'] for r in engine.summary('u1','c1')['skills']}=={'linear','algebra'}

def test_correct_answer_schedules_review():
    record(correct=True)
    s=engine.summary('u1','c1')['skills'][0]
    assert s['due'] is False

def test_question_ranking_prioritizes_hard_first():
    choices=[{'id':str(i),'question':'Q','knowledge_points':['X'], 'difficulty_layer':i} for i in (1,2,3)]
    assert engine.choose_next('u1','c1',choices)['id']=='3'

def test_avoid_recent_question():
    record()
    choices=[{'id':'q1','question':'Seen','knowledge_points':['Linear equations'],'difficulty_layer':3},
             {'id':'q2','question':'New','knowledge_points':['Linear equations'],'difficulty_layer':1}]
    assert engine.choose_next('u1','c1',choices)['id']=='q2'

def test_edges_reject_cycles_and_store_valid():
    assert engine.put_edges('u1','c1',[{'prerequisite':'A','dependent':'B'}])==1
    with pytest.raises(ValueError, match='cycle'):
        engine.put_edges('u1','c1',[{'prerequisite':'A','dependent':'B'}, {'prerequisite':'B','dependent':'A'}])
    assert engine.summary('u1','c1')['edges']==[{'prerequisite':'A','dependent':'B'}]

def test_optional_context_boundaries():
    with pytest.raises(ValueError):engine.prepare_context('u1','q1',6,'')
    with pytest.raises(ValueError):engine.prepare_context('u1','q1',1,'x'*2501)

def test_parses_generic_propositions_safely():
    assert engine.read_notes_json({'propositions':[{'claim':'F = ma','premises':['Newton second law']}]})[0]['claim']=='F = ma'
    with pytest.raises(ValueError):engine.read_notes_json({'propositions':'not an array'})

def test_history_hypotheses_are_not_mastery_data():
    from mastery_ext.starter import starting_priorities
    assert 'Conditional probability' in starting_priorities('SAT Math')
    assert 'Projectile motion' in starting_priorities('Physics')
    assert not engine.summary('u1','c1')['skills']

def test_multi_skill_wrong_answer_counts_once():
    engine.prepare_context('u1','q1',5,'High confidence')
    record(skills=['one','two'])
    assert engine.summary('u1','c1')['high_confidence_mistakes']==1

def test_reasoning_propositions_are_persistent_and_scoped():
    item=engine.add_proposition('u1','c1','Acceleration changes velocity',['Velocity is a vector'])
    assert item['id']
    assert len(engine.list_propositions('u1','c1'))==1
    assert engine.list_propositions('u2','c1')==[]
    with pytest.raises(ValueError):engine.add_proposition('u1','c1','A',[])
