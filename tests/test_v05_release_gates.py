"""Quality gates for offline tutoring: independent truth, progression, coverage.

Covers the factual claims in the v0.5 release note, not just whether a
function successfully returns a question-shaped object.
"""
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'overlay/apps/api'))
from mastery_ext import engine
from mastery_ext.practice_bank import generate_verified
from mastery_ext.grammar_drills import generate_grammar_drills
from mastery_ext.language_bank import READING

@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))


def test_unverified_transfer_does_not_clear_repair_or_defer_review():
    engine.prepare_context('u','original',None,'','challenge',3)
    engine.record_attempt(result_id='a',user_id='u',course_id='c',problem_id='original',skills=['Algebra'],correct=False)
    initial=engine.summary('u','c')['skills'][0]['due_at']
    engine.prepare_context('u','hard-too-soon',None,'','transfer',3)
    engine.record_attempt(result_id='b',user_id='u',course_id='c',problem_id='hard-too-soon',skills=['Algebra'],correct=True)
    result=engine.summary('u','c')
    assert result['learning_phases'][0]['phase']=='repair'
    assert result['skills'][0]['due_at']==initial


def test_missing_difficulty_metadata_cannot_certify_foundation_or_transfer():
    engine.prepare_context('u','original',None,'','challenge')
    engine.record_attempt(result_id='a',user_id='u',course_id='c',problem_id='original',skills=['Algebra'],correct=False)
    engine.prepare_context('u','foundation-unknown',None,'','repair')
    engine.record_attempt(result_id='b',user_id='u',course_id='c',problem_id='foundation-unknown',skills=['Algebra'],correct=True)
    result=engine.summary('u','c')
    assert result['learning_phases'][0]['phase']=='repair'


def test_new_reading_passages_have_three_distinct_questions_and_full_rationales():
    from mastery_ext.extended_reading import PASSAGES, EXTRA_READING
    assert len(PASSAGES)>=10
    assert len(EXTRA_READING)>=30
    assert len(READING)==len(set((p,q) for p,q,*_ in READING))
    for passage, questions in PASSAGES:
        assert len(passage.split())>=95
        assert len(questions)==3
        assert len({q[0] for q in questions})==3
        for question,answer,wrong,explanation,hint,skill in questions:
            assert len(set([answer]+wrong))==4
            assert len(explanation)>45 and len(hint)>20
            assert answer not in wrong
    items=generate_verified('ACT Reading','authored',400)
    assert len(items)==len(READING)
    assert all(item['problem_metadata']['authored'] for item in items)


def test_grammar_rules_never_confuse_semicolon_plus_conjunction_with_invalid_syntax():
    questions=generate_grammar_drills('ACT English','grammar-review',240)
    assert len(questions)==240
    clauses=[q for q in questions if q['problem_metadata']['family']=='_clause_boundaries']
    assert len(clauses)>=25
    for q in clauses:
        assert 'semicolon' in q['question']
        correct=q['options'][q['correct_answer']]
        assert '; ' in correct and '; and ' not in correct
        assert 'violates that instruction' in q['explanation']
        assert len(set(q['options'].values()))==4
    tenses=[q for q in questions if q['problem_metadata']['family']=='_past_perfect']
    assert len(tenses)>=25
    for q in tenses:
        assert q['options'][q['correct_answer']].startswith('had ')
        assert 'By the time' in q['question']
        assert any(option.startswith('will ') for option in q['options'].values())


def test_science_stems_independently_support_numeric_keys():
    samples=Counter()
    for seed in ['science-a','science-b','science-c','science-d']:
        for q in generate_verified('ACT Science',seed,400):
            family=q['problem_metadata']['family']; prompt=q['question']
            key=q['options'][q['correct_answer']]
            if family=='_rate_from_measurements':
                times=re.search(r'at 0 min: (\d+); at (\d+) min: (\d+); at (\d+) min: (\d+)',prompt)
                y0,t1,y1,t2,y2=map(int,times.groups())
                assert key==str(Fraction(y2-y1,t2-t1))
            elif family=='_controlled_comparison':
                a=int(re.search(r'Batch A: \d+°C, no fertilizer, average growth (\d+) mm',prompt).group(1))
                b=int(re.search(r'Batch B: \d+°C, fertilizer, growth (\d+) mm',prompt).group(1))
                assert key==f'{b-a} mm'
            elif family=='_calibration_interpolation':
                y0,x2,y2,target=map(int,re.search(r'0 mg/L \(signal (\d+) units\) and (\d+) mg/L \(signal (\d+) units\).*signal (\d+)',prompt).groups())
                assert key==f'{Fraction((target-y0)*x2,y2-y0)} mg/L'
            elif family=='_proportional_slope':
                signal=int(re.search(r'\(0 mM, (\d+) units\)',prompt).group(1))
                assert key==str(signal)
            elif family=='_replication_precision':
                a=list(map(int,re.search(r'Lab A reported readings (\d+), (\d+), (\d+)',prompt).groups()))
                b=list(map(int,re.search(r'Lab B reported (\d+), (\d+), (\d+)',prompt).groups()))
                assert sum(a)==sum(b)
                assert max(a)-min(a)<max(b)-min(b)
                assert key=='Both labs have the same mean, but Lab A has less variation.'
            else:continue
            samples[family]+=1
    assert len(samples)>=5,samples
    assert all(n>=50 for n in samples.values()),samples


def test_act_science_content_mix_is_predominantly_science_reasoning():
    pack=generate_verified('ACT Science','pack-0',160)
    kinds=Counter(q['problem_metadata']['family'] for q in pack)
    science_total=sum(n for family,n in kinds.items() if family.startswith(('_rate_','_controlled_','_replication_','_calibration_','_sample_','_identify_','_proportional_','_physics_science')))
    assert science_total/len(pack)>=0.70
    assert len(kinds)>=10


def test_offline_pack_regenerates_same_key_and_never_duplicates_internally():
    for track in ('ACT Science','SAT Math','Physics','ACT Math','Algebra 2'):
        q1=generate_verified(track,'pack-18',160)
        q2=generate_verified(track,'pack-18',160)
        assert q1==q2
        assert len({item['question'] for item in q1})==160
        assert all(len(set(item['options'].values()))==4 for item in q1)


def test_priority_skill_has_distinct_foundation_and_hard_families():
    # These contrasts are generated from different mathematical operations,
    # not the same item cosmetically relabeled.
    expected={
        'SAT Math':['Geometry & trigonometry','Conditional probability','Function composition'],
        'Physics':['Average speed','Average velocity vs. speed','Free fall','Velocity–time graphs'],
        'ACT Science':['ACT Science rates and trends','Experimental controls','Sampling and inference','Measurement reliability'],
    }
    for track,skills in expected.items():
        pool=generate_verified(track,'difficulty-contrasts',400)
        levels={skill:{q['difficulty_layer'] for q in pool if skill in q['knowledge_points']} for skill in skills}
        assert all(3 in available and any(x<3 for x in available) for available in levels.values()),levels


def test_independent_physics_and_geometry_transfer_oracles():
    verified=Counter()
    for track in ('Physics','SAT Math','ACT Math'):
        for item in generate_verified(track,'transfer-oracle',400):
            name=item['problem_metadata']['family']
            question=item['question']; answer=item['options'][item['correct_answer']]
            if name=='_average_speed_foundation':
                v,t=map(int,re.search(r'(\d+) m/s for (\d+) seconds',question).groups())
                assert answer==str(v*t)
            elif name=='_average_speed_multileg':
                numbers=re.findall(r'(\d+) m/s for (\d+) s',question)
                assert len(numbers)==3
                dist=sum(int(v)*int(t) for v,t in numbers)
                time=sum(int(t) for _,t in numbers)
                assert answer==f'{dist/time:.2f}'
            elif name=='_average_velocity_foundation':
                assert answer=='0 m/s'
            elif name=='_right_triangle_missing_leg':
                c,a=map(int,re.search(r'hypotenuse (\d+) and one leg (\d+)',question).groups())
                assert int(answer)**2 == c*c-a*a
            else:continue
            verified[name]+=1
    assert len(verified)==4,verified
    assert min(verified.values())>=9,verified
