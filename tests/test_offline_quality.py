"""Systematic consistency and offline-safety checks of original practice.

These test deterministic generation properties; they do NOT claim full
human/editorial or psychometric validation of exam equivalence.
"""
import sys
import re
from fractions import Fraction
from pathlib import Path
from collections import Counter
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'overlay/apps/api'))
from mastery_ext.practice_bank import TRACKS,generate_verified
from mastery_ext.language_bank import READING,GRAMMAR
from mastery_ext.offline_coach import lesson_for
from mastery_ext import engine


def choice(q):
    return q['options'][q['correct_answer']]


@pytest.mark.parametrize('track',TRACKS)
def test_offline_practice_quality_and_key_stability(track):
    target=400 if track not in ('ACT Reading','ACT English','SAT Reading & Writing') else 400
    questions=generate_verified(track,'pack-0',target)
    assert len(questions)>=30
    assert len({q['question'] for q in questions})==len(questions)
    assert questions==generate_verified(track,'pack-0',target)
    for item in questions:
        assert len(item['question'])>=20
        assert item['question_type']=='mc'
        assert set(item['options'])==set('ABCD')
        assert len(set(item['options'].values()))==4
        assert item['correct_answer'] in 'ABCD'
        assert len(item['explanation'])>=27
        assert len(item['problem_metadata']['hint'])>=15
        assert item['difficulty_layer'] in (1,2,3)
        assert item['knowledge_points'][0]
        assert item['problem_metadata']['question_hash']
        coach=lesson_for(item['knowledge_points'],item['problem_metadata']['hint'])
        assert coach['skill']
        assert 'answer' not in coach


def test_human_authored_verbal_questions_are_finite_not_fake_variants():
    assert len(READING)>=30 and len(GRAMMAR)>=35
    assert len(generate_verified('SAT Reading & Writing','pack-0',400))==len(READING)+len(GRAMMAR)
    assert len(generate_verified('ACT English','pack-0',400))==len(GRAMMAR)
    assert len(generate_verified('ACT Reading','pack-0',400))==len(READING)
    # The authored questions keep their question fingerprints even when RNG order changes.
    for t in ('ACT English','ACT Reading'):
        a=generate_verified(t,'pack-0',400)
        b=generate_verified(t,'pack-1',400)
        assert {x['problem_metadata']['mastery_seed_key'] for x in a}=={x['problem_metadata']['mastery_seed_key'] for x in b}


def test_generator_constraints_and_no_external_io(monkeypatch):
    import socket
    monkeypatch.setattr(socket,'socket',lambda *a,**kw: (_ for _ in ()).throw(AssertionError('Network used')))
    for track in TRACKS:
        assert generate_verified(track,'offline',16)
    with pytest.raises(ValueError):generate_verified('not a track','one')
    with pytest.raises(ValueError):generate_verified('SAT Math','one',401)


def test_numeric_answer_independent_crosschecks():
    counts=Counter()
    for track in ('SAT Math','ACT Math','Algebra 2','Physics','ACT Science'):
        for seed in ('audit1','audit2','audit3'):
            for q in generate_verified(track,seed,350):
                family=q['problem_metadata']['family'];prompt=q['question'];answer=choice(q)
                if family=='_system':
                    nums=re.search(r'system (\d+)x ([+]\d+)y = (-?\d+) and (\d+)x ([+]\d+)y = (-?\d+)',prompt)
                    assert nums
                    a,b,p,c,d,t=map(int,nums.groups())
                    assert a*d-b*c!=0
                    assert answer==str(Fraction(p*d-t*b,a*d-b*c))
                elif family=='_physics_force':
                    mass,acc=map(int,re.search(r'A (\d+) kg cart accelerates at (\d+) m/s²',prompt).groups())
                    assert answer==f'{mass*acc} N'
                elif family=='_physics_freefall':
                    initial,t=map(int,re.search(r'initial speed of (\d+) m/s.* in (\d+) seconds',prompt).groups())
                    assert answer==f'{initial*t+5*t*t} m'
                elif family=='_physics_acceleration':
                    v0,v1,t=map(int,re.search(r'from (-?\d+) m/s to (-?\d+) m/s over (\d+) s',prompt).groups())
                    assert answer==f'{Fraction(v1-v0,t)} m/s²'
                elif family=='_ratio':
                    x,y,grams=map(int,re.search(r'ratio (\d+):(\d+).*uses (\d+) grams',prompt).groups())
                    assert answer==str(Fraction(y*grams,x))
                elif family=='_physics_position':
                    x0,t,x1=map(int,re.search(r'joins \(0 s, (-?\d+) m\) and \((\d+) s, (-?\d+) m\)',prompt).groups())
                    assert answer==f'{Fraction(x1-x0,t)} m/s'
                elif family=='_geometric':
                    a,r,n=map(int,re.search(r'first term (\d+) and common ratio (\d+).* (\d+)th term',prompt).groups())
                    assert answer==str(a*r**(n-1))
                elif family=='_sequence':
                    a,d,n=map(int,re.search(r'begins at (-?\d+) and has common difference (-?\d+).*term (\d+)',prompt).groups())
                    assert answer==str(a+(n-1)*d)
                else:continue
                counts[family]+=1
    assert len(counts)>=8 and min(counts.values())>15


def test_real_offline_graphs_have_valid_distinct_coordinates():
    for track in ('Physics','ACT Science'):
        qs=generate_verified(track,'graphs',300)
        graphs=[q['problem_metadata'].get('graph') for q in qs]
        present=[g for g in graphs if g]
        assert len(present)>=30
        for g in present:
            assert len(g['points'])>=2
            assert all(len(p)==2 for p in g['points'])
            assert len({p[0] for p in g['points']})>=2


def test_patcher_prevents_offline_model_calls():
    from importlib.util import spec_from_file_location,module_from_spec
    spec=spec_from_file_location('installer',ROOT/'scripts/apply_overlay.py')
    installer=module_from_spec(spec);spec.loader.exec_module(installer)
    assert 'problem.source != "mastery_offline"' in installer.CLASSIFIER_PATCH
    assert 'problem.source != "mastery_offline"' in installer.SUBMISSION_PATCH
    assert 'next/font/google' in installer.FONT_IMPORT
    assert '.mastery-core-ready' in installer.FASTSETUP_PATCH


def test_frontend_shows_graph_and_study_offline():
    page=(ROOT/'overlay/apps/web/src/app/mastery/page.tsx').read_text()
    assert 'offline-help' in page and 'expand' in page
    assert 'ProblemGraph' in page
    assert 'question.reason' in page
    assert 'offline-diagnosis' in page
    assert 'Offline ready' in page
    assert 'Start practice' in page


def test_extended_independent_answer_audit():
    """Solve a large sampled subset from stem numbers, not answer metadata."""
    import math
    verified=Counter()
    for track in ('SAT Math','ACT Math','Algebra 2','Physics','ACT Science'):
        for seed in ('sample-a','sample-b','sample-c'):
            for q in generate_verified(track,seed,400):
                family=q['problem_metadata']['family'];t=q['question'];got=choice(q)
                expected=None
                if family=='_linear':
                    a,b,c,d=map(int,re.search(r'(\d+)\(x ([+-]\d+)\) = (\d+)x ([+-]\d+)',t).groups())
                    expected=str(Fraction(d-a*b,a-c))
                elif family=='_quadratic':
                    b,c=map(int,re.search(r'x² ([+-]\d+)x ([+-]\d+) = 0',t).groups())
                    disc=b*b-4*c
                    assert math.isqrt(disc)**2==disc
                    expected=str(Fraction(-b+math.isqrt(disc),2))
                elif family=='_vertex':
                    a,nh,k=map(int,re.search(r'f\(x\) = (-?\d+)\(x ([+-]\d+)\)² ([+-]\d+)',t).groups())
                    expected=str(-nh)
                elif family=='_physics_projectile':
                    velocity,seconds=map(int,re.search(r'ledge at (\d+) m/s and is airborne for (\d+) seconds',t).groups())
                    expected=f'{velocity*seconds} m'
                elif family=='_physics_graph':
                    v0,seconds,v1=map(int,re.search(r'\(0 s, (-?\d+) m/s\) to \((\d+) s, (-?\d+) m/s\)',t).groups())
                    x=Fraction(v0+v1,2)*seconds
                    expected=f'{int(x) if x.denominator==1 else float(x):g} m'
                elif family=='_physics_velocity_sign':
                    speed,time=map(int,re.search(r'at −(\d+) m/s from t=0 to t=(\d+) s',t).groups())
                    expected=f'−{speed*time} m'
                elif family=='_rational_equation':
                    excl,s1,s2,k=map(int,re.search(r'x ≠ (-?\d+).*\(x ([+-]\d+)\) / \(x ([+-]\d+)\) = (-?\d+)',t).groups())
                    assert excl==-s2
                    expected=str(Fraction(k*s2-s1,1-k))
                elif family=='_roots_sum_difference':
                    s,d=map(int,re.search(r'have sum (-?\d+).*absolute value is (\d+)',t).groups())
                    expected=str(Fraction(s*s-d*d,4))
                elif family=='_composite_inverse':
                    a,b,c,d,target=map(int,re.search(r'f\(x\)=(-?\d+)x ([+-]\d+) and g\(x\)=(-?\d+)x ([+-]\d+).*f\(g\(t\)\)=(-?\d+)',t).groups())
                    expected=str(Fraction(target-b-a*d,a*c))
                elif family=='_two_dials':
                    f1,r,f2,s=map(int,re.search(r'A charges \$(\d+) plus \$(\d+) per mile; B charges \$(\d+) plus \$(\d+) per mile',t).groups())
                    expected=str(Fraction(f2-f1,r-s))
                elif family=='_conditional_drawing':
                    red,blue,green=map(int,re.search(r'has (\d+) red, (\d+) blue, and (\d+) green',t).groups())
                    expected=str(Fraction(red,red+blue+green-1))
                elif family=='_projectile_time_height':
                    vx,vy=map(int,re.search(r'horizontal speed (\d+) m/s and upward speed (\d+) m/s',t).groups())
                    expected=f'{vy*vy//20} m'
                else:continue
                assert got==expected,(track,family,t,got,expected)
                verified[family]+=1
    assert len(verified)>=12 and min(verified.values())>=10


def test_grammar_drill_bank_is_distinct_and_rule_controlled():
    from mastery_ext.grammar_drills import generate_grammar_drills
    for track in ('ACT English','SAT Reading & Writing'):
        qs=generate_grammar_drills(track,'pack-0',300)
        assert len(qs)==len({q['question'] for q in qs})==300
        assert all(len(set(q['options'].values()))==4 for q in qs)
        assert all(q['problem_metadata']['offline_grammar'] for q in qs)
        assert all(len(q['explanation'])>35 for q in qs)
    # Two common high-risk agreement constructions have exact expected keys.
    for q in generate_grammar_drills('ACT English','pack-9',100):
        if 'neither the' in q['question']:
            nearest=q['question'].split(' nor the ')[1].split(' ____')[0]
            from mastery_ext.grammar_drills import NOUNS_SINGULAR,NOUNS_PLURAL
            assert choice(q)==('was' if nearest in NOUNS_SINGULAR else 'were')
