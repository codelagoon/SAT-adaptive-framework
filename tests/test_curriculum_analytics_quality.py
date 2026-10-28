"""Independent cross-feature gates for new user-facing learning foundations."""
import sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'overlay/apps/api'))
from mastery_ext import analytics,engine
from mastery_ext.curriculum import DOMAINS,get_track,select_diagnostic
from mastery_ext.practice_bank import generate_verified
from mastery_ext.grammar_drills import generate_grammar_drills
from mastery_ext.question_audit import audit

TRACKS=tuple(DOMAINS)

@pytest.fixture(autouse=True)
def isolated_db(tmp_path,monkeypatch):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))

def attempt(rid, pid, *, user='u', course='math', correct=True, assisted=False,
            mode='challenge', skills=('Linear equations',),time=20000):
    engine.prepare_context(user,pid,4,'independent explanation' if not assisted else '',
                           mode=mode,difficulty_level=2,assisted=assisted)
    return engine.record_attempt(result_id=rid,user_id=user,course_id=course,
                                 problem_id=pid,skills=list(skills),correct=correct,elapsed_ms=time)

def metric(user='u',course='math'):
    with engine.connect() as db:return analytics.report(db,user,course)

def test_empty_metrics_are_honest():
    m=metric()
    assert m['independent_first_attempts']=={'correct':0,'total':0,'accuracy':None}
    assert m['skills']==[] and m['weaknesses']==[]

def test_first_attempt_not_inflated_by_guided_retry():
    attempt('r1','q1',correct=False,assisted=True)
    attempt('r2','q1',correct=True)
    attempt('r3','q2',correct=True)
    m=metric()
    assert m['sample_count']==3
    assert m['first_attempts']['total']==2
    assert m['independent_first_attempts']=={'correct':1,'total':1,'accuracy':1.0}
    assert m['repeat_attempts']['total']==1
    assert m['assisted_attempts']['total']==1

def test_repair_correct_does_not_count_as_independent_mastery():
    attempt('r1','q1',correct=True,mode='repair')
    attempt('r2','q2',correct=True,mode='challenge')
    assert metric()['independent_first_attempts']['total']==1

def test_idempotence_and_user_course_isolation():
    assert attempt('r1','q1',correct=True)
    assert not attempt('r1','q1',correct=True)
    attempt('r2','q2',user='other',correct=False)
    attempt('r3','q3',course='physics',correct=False)
    assert metric()['sample_count']==1
    assert metric('other')['independent_first_attempts']['accuracy']==0.0
    assert metric(course='physics')['sample_count']==1

def test_multi_skill_one_event_not_two_attempts():
    attempt('r1','q1',skills=['Linear equations','Systems of equations'])
    m=metric()
    assert m['sample_count']==1
    assert len(m['skills'])==2
    assert all(s['total']==1 for s in m['skills'])

def test_timing_uses_independent_attempts_only():
    attempt('r1','q1',correct=True,time=12000)
    attempt('r2','q2',correct=False,time=28000)
    attempt('r3','q3',correct=True,assisted=True,time=900000)
    m=metric()
    assert m['timing']['independent_median_ms']==20000
    assert m['timing']['correct_median_ms']==12000
    assert m['timing']['wrong_median_ms']==28000

def test_attempt_recorded_then_deleted_with_course():
    attempt('r1','q1')
    attempt('r2','q2',course='physics')
    result=engine.forget_course('u','math',['q1'])
    assert result['attempt_events']==1
    assert metric()['sample_count']==0
    assert metric(course='physics')['sample_count']==1

def test_negative_elapsed_rolls_back():
    with pytest.raises(ValueError, match='Negative elapsed'):
        attempt('r1','q1',time=-1)
    assert metric()['sample_count']==0

def test_date_windows_are_bounded():
    with engine.connect() as db:
        old=(datetime(2026,9,1,tzinfo=timezone.utc)).isoformat()
        new=(datetime(2026,10,27,tzinfo=timezone.utc)).isoformat()
        analytics.add_event(db,result_id='old',user_id='u',course_id='math',problem_id='q1',
          skills=['Linear equations'],correct=False,assisted=False,mode='challenge',
          difficulty_level=2,elapsed_ms=1000,confidence=None,error_category=None,reasoning='',recorded_at=old)
        analytics.add_event(db,result_id='new',user_id='u',course_id='math',problem_id='q2',
          skills=['Linear equations'],correct=True,assisted=False,mode='challenge',
          difficulty_level=2,elapsed_ms=1000,confidence=None,error_category=None,reasoning='',recorded_at=new)
    with engine.connect() as db:
        m=analytics.report(db,'u','math',as_of=datetime(2026,10,28,tzinfo=timezone.utc))
    assert m['recent_periods']['past_7_days']['total']==1
    assert m['recent_periods']['previous_7_days']['total']==0

@pytest.mark.parametrize('track',TRACKS)
def test_all_installed_skill_families_mapped_and_taught(track):
    questions=generate_verified(track,'pack-0',160)
    plan=get_track(track,questions=questions)
    assert plan['unmapped_question_skills']==[]
    assert plan['missing_lessons']==[]
    assert all(s['lesson'] for domain in plan['domains'] for s in domain['skills'])
    assert all(s['prerequisites'] is not None for d in plan['domains'] for s in d['skills'])
    assert sum(s['available_questions'] for d in plan['domains'] for s in d['skills'])==len(questions)

@pytest.mark.parametrize('track',TRACKS)
def test_bank_technical_validation_track(track):
    questions=generate_verified(track,'pack-0',160)
    result=audit(questions)
    assert result['structural_passed']==len(questions)
    assert result['structural_failed']==0
    assert result['distinct_families']>0

@pytest.mark.parametrize('track',TRACKS)
def test_diagnostic_no_answer_leak_and_domain_spread(track):
    questions=generate_verified(track,'pack-0',160)
    available=[{'id':f'q{i}','question':v['question'],'options':v['options'],
        'knowledge_points':v['knowledge_points'],'difficulty_layer':v['difficulty_layer'],
        'correct_answer':v['correct_answer'],'explanation':v['explanation']} for i,v in enumerate(questions)]
    result=select_diagnostic(available,track,max_questions=12)
    assert 0<len(result['questions'])<=12
    assert len(set(q['id'] for q in result['questions']))==len(result['questions'])
    assert all('correct_answer' not in q and 'explanation' not in q for q in result['questions'])
    assert len(set(q['domain'] for q in result['questions']))>=min(2,len(DOMAINS[track]))

def test_bad_questions_rejected():
    bad={'question':'What is 2+2?','options':{'A':'4','B':'4','C':'3','D':'2'},
         'correct_answer':'Z','explanation':'', 'knowledge_points':[],
         'difficulty_layer':None,'problem_metadata':{}}
    report=audit([bad,bad])
    assert report['structural_failed']==2
    assert 'invalid_key' in report['failures'][0]['defects']
    assert 'repeated_stem' in report['failures'][1]['defects']

def test_unknown_track_rejected():
    with pytest.raises(ValueError):get_track('Invented Exam')

def test_study_plan_due_review_wins_over_weakness():
    from mastery_ext.study_planner import recommend
    metrics={'independent_first_attempts':{'total':12},'skills':[],
             'weaknesses':[{'skill':'Linear equations','correct':0,'total':4,'accuracy':0.0}]}
    mastery={'skills':[{'skill':'Conditional probability','due':True,'p':.2}]}
    plan=recommend('SAT Math',metrics,mastery,minutes=30)
    assert plan['target_skill']=='Conditional probability'
    assert plan['stage']=='review'
    assert sum(s['minutes'] for s in plan['steps'])==30

def test_study_plan_weakness_after_three_independent_attempts():
    from mastery_ext.study_planner import recommend
    metrics={'independent_first_attempts':{'total':3},'skills':[],
             'weaknesses':[{'skill':'Linear equations','correct':1,'total':3,'accuracy':.3333}]}
    plan=recommend('SAT Math',metrics,{'skills':[]},minutes=20)
    assert plan['target_skill']=='Linear equations' and plan['stage']=='repair'
    assert [s['mode'] for s in plan['steps']]==['learn','solve','review']
    assert plan['lesson']

def test_study_plan_no_data_is_diagnostic_not_claimed_weakness():
    from mastery_ext.study_planner import recommend
    plan=recommend('Physics',{'independent_first_attempts':{'total':0},'weaknesses':[],'skills':[]},
                   {'skills':[]})
    assert plan['stage']=='diagnose' and 'No independent' in plan['reason']

def test_legacy_migration_marks_old_events_unverified(tmp_path):
    # Old versions only recorded legacy attempts; a new version must NOT treat
    # the second answer to the same problem as the user's independent first.
    with engine.connect() as db:
        db.execute('''INSERT INTO attempts(result_id,user_id,course_id,problem_id,skill,correct,
          confidence,reasoning,error_category,elapsed_ms,recorded_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
          ('old','u','math','q1','Linear equations',0,None,'',None,20000,
           '2026-10-20T10:00:00+00:00'))
    with engine.connect() as db:
        m=analytics.report(db,'u','math')
    assert m['legacy_unverified_attempts']['total']==1
    assert m['independent_first_attempts']['total']==0
    attempt('new','q1',correct=True)
    m=metric()
    assert m['repeat_attempts']['total']==1
    assert m['independent_first_attempts']['total']==0

def test_assisted_correct_does_not_inflate_bkt_or_discharge_review_debt():
    attempt('r1','q1',correct=False,assisted=False)
    before=engine.summary('u','math')['skills'][0]
    attempt('r2','q2',correct=True,assisted=True)
    after=engine.summary('u','math')['skills'][0]
    assert before['p']==after['p']
    assert before['due_at']==after['due_at']
    assert engine.summary('u','math')['learning_phases'][0]['phase']=='repair'

def test_guided_first_attempt_does_not_increase_bkt():
    attempt('r1','q1',correct=True,assisted=True)
    m=engine.summary('u','math')['skills'][0]
    assert m['p']==engine.P_INIT
    assert m['streak']==0
    assert metric()['independent_first_attempts']['total']==0

def test_bookmark_draft_survive_restart_without_grading():
    from mastery_ext import workspace
    with engine.connect() as db:
        workspace.bookmark(db,'u','math','q1',True)
        workspace.save_draft(db,'u','math','q1','B','because denominator = group')
    with engine.connect() as db:
        assert workspace.saved_ids(db,'u','math')=={'q1'}
        assert workspace.read_draft(db,'u','math','q1')['response']=='B'
    assert metric()['sample_count']==0  # autosave is NOT grading

def test_drafts_and_bookmarks_are_user_and_course_scoped():
    from mastery_ext import workspace
    with engine.connect() as db:
        workspace.bookmark(db,'u','math','q1',True)
        workspace.save_draft(db,'u','math','q1','A')
        assert workspace.saved_ids(db,'another','math')==set()
        assert workspace.saved_ids(db,'u','physics')==set()
        assert workspace.read_draft(db,'another','math','q1') is None
        assert workspace.read_draft(db,'u','physics','q1') is None

def test_grading_clears_only_correct_draft():
    from mastery_ext import workspace
    with engine.connect() as db:
        workspace.save_draft(db,'u','math','q1','A')
        workspace.save_draft(db,'u','physics','q1','C')
    attempt('r1','q1',correct=False)
    with engine.connect() as db:
        assert workspace.read_draft(db,'u','math','q1') is None
        assert workspace.read_draft(db,'u','physics','q1')['response']=='C'

def test_course_delete_clears_drafts_but_not_other_courses():
    from mastery_ext import workspace
    with engine.connect() as db:
        for course in ('math','physics'):
            workspace.bookmark(db,'u',course,'q1',True)
            workspace.save_draft(db,'u',course,'q1','A')
    result=engine.forget_course('u','math',['q1'])
    assert result['answer_drafts']==1 and result['saved_questions']==1
    with engine.connect() as db:
        assert workspace.saved_ids(db,'u','math')==set()
        assert workspace.saved_ids(db,'u','physics')=={'q1'}


def test_draft_cleanup_does_not_implicitly_commit_grade_transaction():
    from mastery_ext import workspace
    with pytest.raises(RuntimeError):
        with engine.connect() as db:
            db.execute('''INSERT INTO saved_questions(user_id,course_id,problem_id,saved_at)
                VALUES (?,?,?,?)''',('u','math','q2','2026-10-28T00:00:00+00:00'))
            workspace.clear_draft(db,'u','math','q1')
            raise RuntimeError('synthetic failure must roll back')
    with engine.connect() as db:
        assert workspace.saved_ids(db,'u','math')==set()
