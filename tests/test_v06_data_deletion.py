import sys
from pathlib import Path
import pytest
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'overlay/apps/api'))
from mastery_ext import engine

@pytest.fixture(autouse=True)
def isolated(monkeypatch,tmp_path):
    monkeypatch.setenv('MASTERY_DATA_DIR',str(tmp_path))


def record(user,course,problem,result):
    engine.prepare_context(user,problem,4,'private note about work','challenge',3)
    engine.record_attempt(result_id=result,user_id=user,course_id=course,
                          problem_id=problem,skills=['Linear equations'],correct=False)
    engine.prepare_context(user,problem+'-pending',3,'unfinished work','challenge',2)
    engine.add_proposition(user,course,'Claims should be justified',['An example'])
    engine.put_edges(user,course,[{'prerequisite':'Arithmetic','dependent':'Algebra'}])
    engine.store_probe_result(user,course,problem,result,'probe-123','Linear equations','B',False)


def test_private_records_purged_for_only_deleted_course():
    record('user','delete-me','item-a','result-a')
    record('user','keep-me','item-b','result-b')
    record('other','delete-me','item-c','result-c')
    purged=engine.forget_course('user','delete-me',['item-a','item-a-pending'])
    assert purged['attempts']>=1 and purged['context']==1
    assert engine.summary('user','delete-me')['skills']==[]
    assert engine.list_propositions('user','delete-me')==[]
    assert engine.summary('user','delete-me')['diagnostic_checks']==[]
    assert engine.summary('user','delete-me')['learning_phases']==[]
    assert engine.summary('user','delete-me')['edges']==[]
    assert engine.summary('user','keep-me')['skills']
    assert engine.summary('other','delete-me')['skills']
    with engine.connect() as db:
        notes=db.execute('SELECT problem_id FROM context WHERE user_id=?',('user',)).fetchall()
        assert all(r['problem_id']!='item-a-pending' for r in notes)
        assert any(r['problem_id']=='item-b-pending' for r in notes)
    assert engine.forget_course('user','delete-me',['item-a','item-a-pending'])['context']==0


def test_patcher_links_real_course_deletion_to_mastery_purge():
    s=(BASE/'scripts/apply_overlay.py').read_text()
    assert 'DELETE_COURSE_PATCH' in s and 'forget_course(str(user.id), str(course_id), owned_problem_ids)' in s
    assert s.index('forget_course(str(user.id), str(course_id), owned_problem_ids)') < s.index('    await db.delete(course)',s.index('DELETE_COURSE_PATCH'))
