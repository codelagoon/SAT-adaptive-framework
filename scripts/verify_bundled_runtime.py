"""Real HTTP + SQLite release checks. Runs only against isolated smoke data."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
import urllib.error
import urllib.request
import uuid

BASE = 'http://127.0.0.1:18766/api'
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TABLES = ('attempts', 'mastery', 'edges', 'propositions',
          'diagnostic_probes', 'learning_queue')


def call(path, method='GET', body=None):
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=payload, method=method,
                                     headers={'Content-Type': 'application/json'})
    with HTTP.open(request, timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def snapshot(data_dir, course):
    # Read-only: a missing DB must fail, never create an empty replacement.
    with sqlite3.connect((data_dir / 'mastery.sqlite3').as_uri() + '?mode=ro', uri=True) as conn:
        return {table: conn.execute(
            f'SELECT * FROM {table} WHERE course_id=? ORDER BY rowid', (course,)
        ).fetchall() for table in TABLES}


def exercise(state_path, data_dir):
    health = call('/mastery/health')
    assert Path(health['data_file']).resolve() == data_dir / 'mastery.sqlite3', health
    state = {'courses': []}
    # Save ownership immediately so failure cleanup never touches real courses.
    state_path.write_text(json.dumps(state))
    for track in ('SAT Math', 'Physics'):
        course = call('/courses/', 'POST', {
            'name': 'Release smoke ' + uuid.uuid4().hex[:10],
            'description': 'Isolated disposable release verification',
            'metadata': {'mastery_track': track},
        })['id']
        state['courses'].append(course)
        state_path.write_text(json.dumps(state))
        seeded = call(f'/mastery/courses/{course}/starter-questions', 'POST')
        assert seeded['added'] >= 100, seeded
        selection = call(f'/mastery/courses/{course}/next')
        assert selection['track'] == track, selection
        question = selection['question']
        assert question and len(question['options']) == 4 and 'correct_answer' not in question
        call('/mastery/prepare', 'POST', {
            'course_id': course, 'problem_id': question['id'], 'confidence': 2,
            'reasoning': 'Release verification', 'mode': 'challenge',
        })
        grade = call('/quiz/submit', 'POST', {
            'problem_id': question['id'], 'user_answer': 'Z', 'answer_time_ms': 1800,
        })
        assert grade['is_correct'] is False and grade.get('result_id'), grade
        diagnosis = call(f'/mastery/courses/{course}/offline-diagnosis/{question["id"]}'
                         f'?attempt_id={grade["result_id"]}')
        assert diagnosis['correct'] is False, diagnosis
        overview = call(f'/mastery/courses/{course}/overview')
        assert overview['recent_errors'] and overview['skills'], overview
        assert any(a['result_id'] == grade['result_id'] for a in overview['recent_attempts'])
        repair = call(f'/mastery/courses/{course}/next')['question']
        assert repair['effective_mode'] == 'repair' and repair['id'] != question['id'], repair
        state[course] = {'overview': overview, 'repair': repair,
                         'rows': snapshot(data_dir, course)}
        state_path.write_text(json.dumps(state))
    print('PASS: bundled HTTP grading, diagnosis, targeted repair, SAT/Physics separation')


def recover(state_path, data_dir):
    state = json.loads(state_path.read_text())
    for course in state['courses']:
        assert call(f'/mastery/courses/{course}/overview') == state[course]['overview']
        assert call(f'/mastery/courses/{course}/next')['question'] == state[course]['repair']
        # JSON round trip normalizes SQLite tuples to lists.
        assert json.loads(json.dumps(snapshot(data_dir, course))) == state[course]['rows']
    print('PASS: full service stop/restart preserves exact attempts, review dates and repair queue')
    first, sentinel = state['courses']
    call(f'/courses/{first}', 'DELETE')
    assert all(not rows for rows in snapshot(data_dir, first).values())
    assert call(f'/mastery/courses/{sentinel}/overview') == state[sentinel]['overview']
    assert json.loads(json.dumps(snapshot(data_dir, sentinel))) == state[sentinel]['rows']
    print('PASS: SAT course deletion purges history and preserves Physics course/history')


def cleanup(state_path, data_dir):
    if not state_path.exists():
        return
    for course in json.loads(state_path.read_text())['courses']:
        try:
            call(f'/courses/{course}', 'DELETE')
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise
        assert all(not rows for rows in snapshot(data_dir, course).values())
    print('PASS: disposable courses and extension history removed')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('exercise', 'recover', 'cleanup'))
    parser.add_argument('state', type=Path)
    args = parser.parse_args()
    data = Path(os.environ['MASTERY_DATA_DIR']).resolve()
    # The shell creates this marker in a new temporary directory. Refuse to
    # exercise/delete courses against the learner's ordinary database.
    assert (data / '.release-smoke').is_file(), 'Smoke requires isolated disposable data'
    globals()[args.phase](args.state, data)
