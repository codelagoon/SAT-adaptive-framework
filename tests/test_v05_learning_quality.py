"""Regressions for a genuine offline feedback -> repair -> transfer -> retention loop.

These scenarios are adversarial: they attempt to promote an equally difficult
item as a prerequisite or erase mistakes through unrelated practice.
"""
from datetime import datetime,timedelta,timezone
import os
import re
import sys
from collections import defaultdict
from fractions import Fraction
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'overlay/apps/api'))
from mastery_ext import engine
from mastery_ext.practice_bank import generate_verified
from mastery_ext.offline_probes import STATIC,probe_for,evaluate,public_probe


@pytest.fixture(autouse=True)
def isolated(tmp_path,monkeypatch):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))


def push(result, problem, correct, mode='challenge', level=3, skill='Conditional probability', user='u', course='c'):
    engine.prepare_context(user,problem,4,'I used the stated condition',mode,level)
    assert engine.record_attempt(result_id=result,user_id=user,course_id=course,problem_id=problem,skills=[skill],correct=correct)
    return engine.summary(user,course)


def item(id,skill,level):
    return dict(id=id,question=id,knowledge_points=[skill],difficulty_layer=level)


def test_failed_advanced_item_gets_true_foundation_and_hard_transfer():
    bank=[item('hard-a','Conditional probability',3),item('foundation','Conditional probability',1),
          item('hard-b','Conditional probability',3)]
    push('r1','hard-a',False,level=3)
    repair=engine.choose_next('u','c',bank)
    assert repair['effective_mode']=='repair' and repair['progression_supported']
    assert repair['id']=='foundation' and repair['difficulty_layer']==1
    before=engine.summary('u','c')['skills'][0]
    push('r2','foundation',True,mode='repair',level=1)
    after=engine.summary('u','c')['skills'][0]
    assert 0 < after['p']-before['p'] <= 0.031  # easy repair isn't hard mastery
    assert after['due_at']==before['due_at']   # review debt survives
    transfer=engine.choose_next('u','c',bank)
    assert transfer['effective_mode']=='transfer' and transfer['progression_supported']
    assert transfer['id']=='hard-b'
    completed=push('r3','hard-b',True,mode='transfer',level=3)
    assert completed['learning_phases']==[]
    due=datetime.fromisoformat(completed['skills'][0]['due_at'])
    assert timedelta(minutes=29)<due-engine.utcnow()<timedelta(minutes=31)


def test_same_level_repair_does_not_falsely_promote():
    bank=[item('hard-a','Conditional probability',3),item('hard-b','Conditional probability',3)]
    push('r1','hard-a',False,level=3)
    wrong_type=engine.choose_next('u','c',bank)
    assert wrong_type['effective_mode']=='repair'
    assert wrong_type['progression_supported'] is False
    assert 'does NOT count' in wrong_type['reason']
    push('r2','hard-b',True,mode='repair',level=3)
    assert engine.summary('u','c')['learning_phases'][0]['phase']=='repair'


def test_reviewing_a_pending_gap_does_not_erase_repair_queue():
    push('r1','hard',False,level=3)
    push('r2','other',True,mode='review',level=1)
    assert engine.summary('u','c')['learning_phases'][0]['phase']=='repair'


def test_automatic_due_review_is_recorded_as_review_not_regular_challenge():
    push('r1','first',True,level=3)
    with engine.connect() as conn:
        conn.execute('UPDATE mastery SET due_at=?',((datetime.now(timezone.utc)-timedelta(days=1)).isoformat(),))
    next_q=engine.choose_next('u','c',[item('another','Conditional probability',3)])
    assert next_q['reviewing'] is True
    assert next_q['effective_mode']=='review'


def test_repair_context_carries_trusted_level_and_rejects_invalid():
    with pytest.raises(ValueError):engine.prepare_context('u','q',3,'','repair',4)
    push('r1','q',False,level=3)
    with engine.connect() as c:
        assert c.execute('SELECT root_level FROM learning_queue').fetchone()['root_level']==3


def test_probe_is_private_until_attempt_and_does_not_change_mastery():
    skill='Free fall';p=probe_for(skill,'original-1')
    assert p['correct_answer']=='C'
    assert 'correct_answer' not in public_probe(p)
    assert 'explanation' not in public_probe(p)
    push('wrong-1','original-1',False,level=3,skill=skill)
    original=engine.summary('u','c')['skills'][0]
    outcome=evaluate(p,'A')
    assert outcome['correct'] is False
    assert engine.store_probe_result('u','c','original-1','wrong-1',p['probe_id'],skill,'A',False)
    assert not engine.store_probe_result('u','c','original-1','wrong-1',p['probe_id'],skill,'C',True)
    assert engine.get_probe_result('u','c','wrong-1',p['probe_id'])['answer']=='A'
    assert engine.get_probe_result('another','c','wrong-1',p['probe_id']) is None
    report=engine.summary('u','c')
    assert report['skills'][0]['p']==original['p']
    assert report['skills'][0]['due_at']==original['due_at']
    assert report['diagnostic_checks'][0]['correct']==0
    assert len(report['recent_errors'])==1


def test_thirty_two_skills_have_consistent_local_prerequisite_checks():
    skills=set(STATIC)|{'Conditional probability','Velocity–time graphs','Free fall',
      'Arithmetic sequences','Linear equations','Function composition','Quadratic functions',
      'Rational equations','Projectile motion','Average speed','Series & sigma notation',
      'Quadratic root relationships'}
    assert len(skills)>=28
    for skill in skills:
        for seed in range(80):
            probe=probe_for(skill,str(seed))
            assert probe is not None and len(probe['options'])==4
            assert len(set(probe['options'].values()))==4
            assert evaluate(probe,probe['correct_answer'])['correct'] is True
            wrong=next(c for c in 'ABCD' if c!=probe['correct_answer'])
            assert evaluate(probe,wrong)['correct'] is False
            assert all(x not in public_probe(probe) for x in ('correct_answer','explanation'))
            assert probe_for(skill,str(seed))==probe
    assert probe_for('Not known','1') is None


def test_offline_bank_has_genuine_contrasting_levels_per_priority_skill():
    required={
      'SAT Math':['Linear equations','Conditional probability','Quadratic functions',
        'Rational equations','Arithmetic sequences','Function composition'],
      'Algebra 2':['Linear equations','Quadratic functions','Rational equations','Arithmetic sequences'],
      'Physics':['Velocity–time graphs','Free fall','Projectile motion']}
    for track,skills in required.items():
        bank=generate_verified(track,'pack-0',160)
        levels=defaultdict(set)
        for entry in bank:
            levels[entry['knowledge_points'][0]].add(entry['difficulty_layer'])
        for skill in skills:
            assert len(levels[skill])>=2, (track,skill,levels[skill])
            assert 3 in levels[skill],(track,skill)


def test_independent_checks_of_new_multistep_families():
    counts=defaultdict(int)
    for track in ('SAT Math','Algebra 2','Physics'):
        for seed in ('v5-a','v5-b','v5-c'):
            for q in generate_verified(track,seed,380):
                family=q['problem_metadata']['family']; t=q['question']; answer=q['options'][q['correct_answer']]
                if family=='_conditional_foundation':
                    red,blue=map(int,re.search(r'contains (\d+) red and (\d+) blue',t).groups())
                    assert answer==str(Fraction(red,red+blue))
                elif family=='_composition_forward':
                    a,b,c,d,x=map(int,re.search(r'f\(x\)=(-?\d+)x ([+-]\d+) and g\(x\)=(-?\d+)x ([+-]\d+).*f\(g\((-?\d+)\)\)',t).groups())
                    assert answer==str(a*(c*x+d)+b)
                elif family=='_rational_exclusion':
                    a,b=map(int,re.search(r'\(x ([+-]\d+)\)/\(x ([+-]\d+)\)',t).groups())
                    assert answer==str(-b)
                elif family=='_velocity_constant':
                    v,t_sec=map(int,re.search(r'horizontal at (-?\d+) m/s from t=0 to t=(\d+) s',t).groups())
                    assert answer==f'{v*t_sec} m'
                elif family=='_model_substitution':
                    b,r,n=map(int,re.search(r'charges \$(\d+) plus \$(\d+) per mile.*for (\d+) miles',t).groups())
                    assert answer==str(b+r*n)
                elif family=='_sum_roots_basic':
                    a,b=map(int,re.search(r'roots are (-?\d+) and (-?\d+)',t).groups())
                    assert answer==str(a+b)
                elif family=='_arithmetic_reverse':
                    a,n,last=map(int,re.search(r'first term (-?\d+) and (\d+)th term (-?\d+)',t).groups())
                    assert answer==str(Fraction(last-a,n-1))
                elif family=='_freefall_interval':
                    v,t1,t2=map(int,re.search(r'initial speed (\d+) m/s.*BETWEEN t=(\d+) s and t=(\d+) s',t).groups())
                    assert answer==f'{v*(t2-t1)+5*(t2*t2-t1*t1)} m'
                elif family=='_linear_nested':
                    a,b,minus_c,d,e,b2=map(int,re.search(r'(\d+)\[2\(x ([+-]\d+)\) ([+-]\d+)\] ([+-]\d+) = (\d+)\(x ([+-]\d+)\)',t).groups())
                    assert b==b2
                    assert answer==str(Fraction(e*b-a*(2*b+minus_c)-d,2*a-e))
                elif family=='_simple_quadratic_vertex':
                    coeff,offset,k=map(int,re.search(r'parabola y=(-?\d+)\(x ([+-]\d+)\)² ([+-]\d+)',t).groups())
                    assert answer==str(-offset)
                else:continue
                counts[family]+=1
    assert len(counts)>=10,counts
    assert min(counts.values())>=6,counts


def test_exact_attempt_scoping_is_wired_into_grading_and_diagnosis():
    api=(ROOT/'overlay/apps/api/mastery_ext/router.py').read_text()
    ui=(ROOT/'overlay/apps/web/src/app/mastery/legacy/page.tsx').read_text()
    patcher=(ROOT/'scripts/apply_overlay.py').read_text()
    assert 'PracticeResult.id==attempt_id' in api
    assert 'PracticeResult.id==body.attempt_id' in api
    assert 'attempt_id=${result.result_id}' in ui
    assert 'attempt_id:grade?.result_id' in ui
    assert 'result_id=str(pr.id)' in patcher
    assert 'result_id: str | None = None' in patcher
