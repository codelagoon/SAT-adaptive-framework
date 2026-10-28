#!/bin/bash
# Run only after opening the native app. Exercises the ACTUAL OpenTutor API.
set -euo pipefail
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || {
  echo 'Run this on an Apple Silicon Mac with Mastery Engine 2 open.' >&2; exit 1;
}
PYTHON="$(command -v python3.11 || command -v python3.12 || command -v python3.13 || true)"
[[ -n "${PYTHON}" ]] || { echo 'Python required to run the smoke test' >&2;exit 1; }
"${PYTHON}" - <<'PY'
"""Create a temporary SAT track, grade a wrong answer and delete everything."""
import json,urllib.request,urllib.error,uuid,sys,sqlite3
from pathlib import Path
base='http://127.0.0.1:18766/api'

def call(path,method='GET',data=None):
    headers={'Content-Type':'application/json'}
    raw=json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(base+path,data=raw,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=12) as response:
        content=response.read()
        return json.loads(content) if content else None

course=None
try:
    health=call('/mastery/health')
    assert health['status']=='ok',health
    title='Mastery Engine smoke test '+uuid.uuid4().hex[:8]
    course=call('/courses/','POST',{'name':title,'description':'Temporary test; automatically deleted',
                                   'metadata':{'mastery_track':'SAT Math'}})['id']
    seeded=call(f'/mastery/courses/{course}/starter-questions','POST')
    assert seeded['added']>=100,seeded
    q=call(f'/mastery/courses/{course}/next')['question']
    assert q and len(q['options'])==4 and 'correct_answer' not in q,q
    call('/mastery/prepare','POST',{'course_id':course,'problem_id':q['id'],
        'reasoning':'Automated release test; not real student work','confidence':2,'mode':'challenge'})
    grade=call('/quiz/submit','POST',{'problem_id':q['id'],'user_answer':'Z',
                                     'answer_time_ms':2400})
    assert grade['is_correct'] is False and grade.get('result_id'),grade
    state=call(f'/mastery/courses/{course}/overview')
    assert state['recent_errors'] and state['skills'],state
    diagnosis=call(f'/mastery/courses/{course}/offline-diagnosis/{q["id"]}?attempt_id={grade["result_id"]}')
    assert diagnosis['correct'] is False,diagnosis
    print('PASS: full API routing, local course, offline bank, hard-first question, OpenTutor grade, mastery storage, diagnosis')
finally:
    if course:
        try:
            call(f'/courses/{course}','DELETE')
            db=Path.home()/'Library/Application Support/MasteryEngine2/mastery.sqlite3'
            if db.exists():
                with sqlite3.connect(db) as conn:
                    for table in ('attempts','mastery','edges','propositions','diagnostic_probes','learning_queue'):
                        n=conn.execute(f'SELECT COUNT(*) FROM {table} WHERE course_id=?',(course,)).fetchone()[0]
                        assert n==0,(table,n)
            print('PASS: temporary test course deleted and learning history purged')
        except Exception as exc:
            print('ERROR: temporary course cleanup failed:',exc,file=sys.stderr)
            raise
PY
