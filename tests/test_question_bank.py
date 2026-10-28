import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'overlay/apps/api'))
from mastery_ext.question_bank import BANK, category_for, starter_questions


def test_starter_answers_and_keys():
    keys=[]
    for subject,items in BANK.items():
        assert len(items)>=3,subject
        for item in items:
            assert item['answer'] in item['options']
            assert len(item['question'])>30
            assert item['skill']
            assert 1 <= item['difficulty'] <=3
            assert item['explanation']
            keys.append(item['key'])
    assert len(keys)==len(set(keys))


def test_subject_mapping():
    assert category_for('SAT Math')=='SAT Math'
    assert category_for('SAT Reading and Writing')=='SAT Reading & Writing'
    assert category_for('ACT English')=='ACT English'
    assert category_for('Algebra 2')=='Algebra 2'
    assert category_for('Physics')=='Physics'
    assert starter_questions('Physics')[0]['key'].startswith('physics')


def test_worksheet_free_interface():
    ui=(ROOT/'overlay/apps/web/src/app/mastery/page.tsx').read_text()
    assert 'Upload a worksheet' not in ui
    assert 'Start practice' in ui
    assert 'starter-questions' in ui
    assert 'Pick a subject' in ui
