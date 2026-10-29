"""Local durable mastery signal layer for OpenTutor quiz submissions.

BKT uses the traditional Bayesian knowledge tracing update. This module does not
claim to be a psychometrically calibrated SAT scoring model. OpenTutor continues
to own its native FSRS, LOOM and quiz grading; we add confidence, reasoning,
review prompts and hard-first question ranking.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import sqlite3
import threading
import json
import uuid
from mastery_ext import analytics, workspace

_LOCK = threading.RLock()
P_INIT, P_GUESS, P_SLIP, P_LEARN = 0.20, 0.20, 0.10, 0.12


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_utc(value: str) -> datetime:
    """Legacy SQLite dates may lack offsets; interpret them as UTC."""
    date = datetime.fromisoformat(value)
    return date if date.tzinfo else date.replace(tzinfo=timezone.utc)


def db_path() -> Path:
    directory = Path(os.environ.get('MASTERY_DATA_DIR', str(Path.home() / '.mastery-engine-2'))).expanduser()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return directory / 'mastery.sqlite3'


def connect():
    conn = sqlite3.connect(db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=10000')
    conn.execute('PRAGMA journal_mode=WAL')
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS attempts (
        result_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL, course_id TEXT NOT NULL, problem_id TEXT NOT NULL,
        skill TEXT NOT NULL, correct INTEGER NOT NULL, confidence INTEGER,
        reasoning TEXT NOT NULL DEFAULT '', error_category TEXT,
        elapsed_ms INTEGER, recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attempts_course ON attempts(user_id,course_id,recorded_at);
    CREATE TABLE IF NOT EXISTS mastery (
        user_id TEXT NOT NULL, course_id TEXT NOT NULL, skill TEXT NOT NULL,
        p REAL NOT NULL, n INTEGER NOT NULL, due_at TEXT NOT NULL,
        last_at TEXT NOT NULL, PRIMARY KEY (user_id,course_id,skill)
    );
    CREATE TABLE IF NOT EXISTS context (
        user_id TEXT NOT NULL, problem_id TEXT NOT NULL,
        confidence INTEGER, reasoning TEXT NOT NULL, prepared_at TEXT NOT NULL,
        PRIMARY KEY(user_id,problem_id)
    );
    CREATE TABLE IF NOT EXISTS edges (
        user_id TEXT NOT NULL, course_id TEXT NOT NULL,
        prerequisite TEXT NOT NULL, dependent TEXT NOT NULL,
        PRIMARY KEY(user_id,course_id,prerequisite,dependent)
    );
    CREATE TABLE IF NOT EXISTS propositions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
        claim TEXT NOT NULL, premises TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS prop_course ON propositions(user_id,course_id);
    CREATE TABLE IF NOT EXISTS diagnostic_probes (
        user_id TEXT NOT NULL, course_id TEXT NOT NULL, problem_id TEXT NOT NULL,
        result_id TEXT NOT NULL, probe_id TEXT NOT NULL, skill TEXT NOT NULL,
        answer TEXT NOT NULL, correct INTEGER NOT NULL, recorded_at TEXT NOT NULL,
        PRIMARY KEY(user_id,course_id,result_id,probe_id)
    );
    CREATE INDEX IF NOT EXISTS probe_course ON diagnostic_probes(user_id,course_id,recorded_at);
    CREATE TABLE IF NOT EXISTS learning_queue (
        user_id TEXT NOT NULL, course_id TEXT NOT NULL, skill TEXT NOT NULL,
        phase TEXT NOT NULL, updated_at TEXT NOT NULL, last_problem_id TEXT NOT NULL,
        PRIMARY KEY(user_id,course_id,skill)
    );
    ''')
    # Non-destructive migration of the original v0.3 database.
    if 'mode' not in {r['name'] for r in conn.execute('PRAGMA table_info(context)')}:
        conn.execute("ALTER TABLE context ADD COLUMN mode TEXT DEFAULT 'challenge'")
    if 'streak' not in {r['name'] for r in conn.execute('PRAGMA table_info(mastery)')}:
        conn.execute('ALTER TABLE mastery ADD COLUMN streak INTEGER NOT NULL DEFAULT 0')
    if 'difficulty_level' not in {r['name'] for r in conn.execute('PRAGMA table_info(context)')}:
        conn.execute('ALTER TABLE context ADD COLUMN difficulty_level INTEGER')
    if 'root_level' not in {r['name'] for r in conn.execute('PRAGMA table_info(learning_queue)')}:
        conn.execute('ALTER TABLE learning_queue ADD COLUMN root_level INTEGER')
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS hint_exposures (
      user_id TEXT NOT NULL, course_id TEXT NOT NULL, problem_id TEXT NOT NULL,
      shown_at TEXT NOT NULL,
      PRIMARY KEY(user_id,course_id,problem_id)
    );
    CREATE INDEX IF NOT EXISTS ix_hint_exposure_owner ON hint_exposures(user_id,course_id);
    ''')
    analytics.install(conn)
    workspace.install(conn)
    analytics.migrate_legacy(conn)
    if 'assisted' not in {r['name'] for r in conn.execute('PRAGMA table_info(context)')}:
        conn.execute('ALTER TABLE context ADD COLUMN assisted INTEGER NOT NULL DEFAULT 0')
    return conn


def update_bkt(prior: float, correct: bool) -> float:
    """Posterior update + opportunity to learn after observation."""
    prob_correct = prior * (1 - P_SLIP) + (1 - prior) * P_GUESS
    if correct:
        posterior = prior * (1 - P_SLIP) / prob_correct
    else:
        posterior = prior * P_SLIP / (1 - prob_correct)
    return max(0.0, min(1.0, posterior + (1 - posterior) * P_LEARN))


def prepare_context(user_id: str, problem_id: str, confidence: int | None, reasoning: str,
                    mode: str = 'challenge', difficulty_level: int | None = None, assisted: bool = False):
    if confidence is not None and not 1 <= confidence <= 5:
        raise ValueError('Confidence must be 1–5')
    if len(reasoning) > 2500:
        raise ValueError('Reasoning is too long')
    if mode not in ('challenge', 'repair', 'review', 'transfer'):
        raise ValueError('Invalid learning phase')
    if difficulty_level is not None and difficulty_level not in (1,2,3):
        raise ValueError('Difficulty must be 1, 2, or 3')
    with _LOCK, connect() as conn:
        conn.execute('''INSERT INTO context(user_id,problem_id,confidence,reasoning,prepared_at,mode,difficulty_level,assisted)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id,problem_id) DO UPDATE SET
          confidence=excluded.confidence, reasoning=excluded.reasoning,
          prepared_at=excluded.prepared_at, mode=excluded.mode, difficulty_level=excluded.difficulty_level, assisted=excluded.assisted''',
          (str(user_id), str(problem_id), confidence, reasoning, utcnow().isoformat(), mode, difficulty_level, int(assisted)))


def mark_hint_exposure(user_id: str, course_id: str, problem_id: str) -> None:
    # Server-owned sticky provenance, independent of client help flags.
    with _LOCK, connect() as conn:
        conn.execute('''INSERT OR IGNORE INTO hint_exposures
            (user_id,course_id,problem_id,shown_at) VALUES (?,?,?,?)''',
            (str(user_id),str(course_id),str(problem_id),utcnow().isoformat()))


def record_attempt(*, result_id: str, user_id: str, course_id: str,
                   problem_id: str, skills: list[str], correct: bool,
                   error_category: str | None = None,
                   elapsed_ms: int | None = None) -> bool:
    """Idempotent per OpenTutor PracticeResult id. One question may assess many skills."""
    skills = [str(s).strip()[:120] for s in skills if str(s).strip()]
    skills = list(dict.fromkeys(skills))[:8] or ['General reasoning']
    with _LOCK, connect() as conn:
        if conn.execute('SELECT 1 FROM attempts WHERE result_id=? LIMIT 1', (str(result_id),)).fetchone():
            return False
        ctx = conn.execute('SELECT confidence,reasoning,prepared_at,mode,difficulty_level,assisted FROM context WHERE user_id=? AND problem_id=?',
                           (str(user_id),str(problem_id))).fetchone()
        # Ignore stale pre-answer context older than an hour.
        if ctx and (utcnow() - parse_utc(ctx['prepared_at'])).total_seconds() > 3600:
            ctx = None
        conf = ctx['confidence'] if ctx else None
        reasoning = ctx['reasoning'] if ctx else ''
        exposure=conn.execute('''SELECT 1 FROM hint_exposures
            WHERE user_id=? AND course_id=? AND problem_id=?''',
            (str(user_id),str(course_id),str(problem_id))).fetchone()
        assisted = bool(ctx['assisted']) if ctx else False
        assisted = bool(assisted or exposure)
        mode = ctx['mode'] if ctx and ctx['mode'] in ('challenge','repair','review','transfer') else 'challenge'
        level = ctx['difficulty_level'] if ctx else None
        now = utcnow()
        analytics.add_event(conn, result_id=result_id, user_id=user_id, course_id=course_id,
            problem_id=problem_id, skills=skills, correct=correct,
            assisted=assisted, mode=mode,
            difficulty_level=level, elapsed_ms=elapsed_ms, confidence=conf,
            error_category=error_category, reasoning=reasoning,
            recorded_at=now.isoformat())
        for i, skill in enumerate(skills):
            event_id = str(result_id) if i == 0 else f'{result_id}:{i}'
            conn.execute('''INSERT INTO attempts VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
              (event_id, str(user_id), str(course_id), str(problem_id), skill,
               int(correct), conf, reasoning, error_category, elapsed_ms, now.isoformat()))
            previous = conn.execute('SELECT p,n,streak,due_at FROM mastery WHERE user_id=? AND course_id=? AND skill=?',
                                    (str(user_id),str(course_id),skill)).fetchone()
            queue = conn.execute('''SELECT phase,root_level,last_problem_id FROM learning_queue
                WHERE user_id=? AND course_id=? AND skill=?''',
                (str(user_id),str(course_id),skill)).fetchone()
            prior_phase = queue['phase'] if queue else 'challenge'
            root_level = queue['root_level'] if queue else None
            # Treat a transfer as confirmed only when it meets the missed
            # question's difficulty and follows an actual repair step.
            verified_transfer = (mode == 'transfer' and prior_phase == 'transfer'
                and root_level is not None and level is not None and level >= root_level)
            valid_foundation = (mode == 'repair' and prior_phase == 'repair'
                and root_level is not None and level is not None and level < root_level)
            prior = float(previous['p']) if previous else P_INIT
            # A solved foundation question after a miss is weak evidence of
            # mastery of the *hard* target. Credit it conservatively.
            p = min(1.0, prior + .03) if mode == 'repair' and correct else update_bkt(prior, correct)
            n = int(previous['n'])+1 if previous else 1
            streak = (int(previous['streak']) if previous else 0) + (1 if mode != 'repair' else 0) if correct else 0
            # An assisted correct answer is practice, not fresh independent mastery.
            if assisted and correct:
                p = prior
                streak = int(previous['streak']) if previous else 0
            # Graduated review intervals are a transparent heuristic, not calibrated FSRS.
            days = [0,1,3,7,14,30,60][min(streak,6)] if correct else 0
            due_at = now + (timedelta(days=days) if correct else timedelta(minutes=15))
            if mode == 'repair' and correct and previous:
                due_at = parse_utc(previous['due_at'])  # foundation pass cannot erase review debt
            if assisted and correct:
                due_at = parse_utc(previous['due_at']) if previous else now
            if verified_transfer and correct:
                due_at = now + timedelta(minutes=30)  # independent retention evidence still due
            elif mode == 'transfer' and correct and previous:
                due_at = parse_utc(previous['due_at'])  # unverified transfer cannot discharge review
            conn.execute('''INSERT INTO mastery(user_id,course_id,skill,p,n,due_at,last_at,streak)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(user_id,course_id,skill) DO UPDATE SET
              p=excluded.p,n=excluded.n,due_at=excluded.due_at,last_at=excluded.last_at,
              streak=excluded.streak''',
              (str(user_id),str(course_id),skill,p,n,due_at.isoformat(),now.isoformat(),streak))
            if assisted and correct:
                phase = prior_phase  # Guided answers cannot clear the repair queue.
            elif not correct:
                phase = 'repair'
                # A new failure redefines the target if it was a challenge.
                if prior_phase == 'challenge' or root_level is None:
                    root_level = level
            elif mode == 'repair' and prior_phase == 'repair':
                # Do not label an equally hard item a successful 'foundation'.
                phase = 'transfer' if valid_foundation else 'repair'
            elif mode == 'transfer' and prior_phase == 'transfer':
                phase = 'challenge' if verified_transfer else 'transfer'
            elif prior_phase != 'challenge':
                phase = prior_phase  # unrelated manual practice does not erase a repair queue
            else:
                phase = 'challenge'
            conn.execute('''INSERT INTO learning_queue
                (user_id,course_id,skill,phase,updated_at,last_problem_id,root_level)
                VALUES (?,?,?,?,?,?,?)
                ON CONFLICT(user_id,course_id,skill) DO UPDATE SET
                phase=excluded.phase,updated_at=excluded.updated_at,
                last_problem_id=excluded.last_problem_id,root_level=excluded.root_level''',
                (str(user_id),str(course_id),skill,phase,now.isoformat(),str(problem_id),root_level))
        workspace.clear_draft(conn,str(user_id),str(course_id),str(problem_id))
        conn.execute('DELETE FROM context WHERE user_id=? AND problem_id=?',(str(user_id),str(problem_id)))
    return True


def summary(user_id: str, course_id: str):
    with connect() as c:
        rows = c.execute('SELECT * FROM mastery WHERE user_id=? AND course_id=? ORDER BY p ASC',
                         (str(user_id),str(course_id))).fetchall()
        errors = c.execute('''SELECT result_id,skill,correct,confidence,reasoning,error_category,elapsed_ms,recorded_at
          FROM attempts WHERE user_id=? AND course_id=? ORDER BY recorded_at DESC LIMIT 60''',
          (str(user_id),str(course_id))).fetchall()
        edges = c.execute('SELECT prerequisite, dependent FROM edges WHERE user_id=? AND course_id=?',
                          (str(user_id),str(course_id))).fetchall()
        phases = c.execute('SELECT skill,phase,updated_at,root_level FROM learning_queue WHERE user_id=? AND course_id=?',
                           (str(user_id),str(course_id))).fetchall()
        probe_rows=c.execute('SELECT skill,correct,recorded_at FROM diagnostic_probes WHERE user_id=? AND course_id=? ORDER BY recorded_at DESC LIMIT 30',
                            (str(user_id),str(course_id))).fetchall()
    now = utcnow()
    return {'diagnostic_checks':[dict(r) for r in probe_rows[:12]], 'skills':[{**dict(r), 'due':parse_utc(r['due_at']) <= now} for r in rows],
            'recent_errors':[dict(r) for r in errors if not r['correct']][:20],
            'recent_attempts':[dict(r) for r in errors[:20]],
            'high_confidence_mistakes':sum(1 for r in errors if not r['correct'] and (r['confidence'] or 0) >= 4 and ':' not in r['result_id']),
            'edges':[dict(e) for e in edges], 'model':'BKT (uncalibrated)',
            'learning_phases':[dict(r) for r in phases if r['phase'] != 'challenge'],
            'review_policy':'Graduated heuristic intervals (1, 3, 7, 14, 30, 60 days); not calibrated FSRS'}


def choose_next(user_id: str, course_id: str, problems: list[dict],
                focus_skill: str = '', mode: str = 'challenge'):
    '''Select for durable learning, not just the largest unseen-question pool.

    Review debt has protected capacity in ordinary challenge sessions, as well
    as a dedicated review mode. Review is preferentially assessed on a *new*
    question from a due skill so the student cannot simply recall an answer.
    The rule is deterministic and does not depend on an LLM or network.
    '''
    if not problems:
        return None
    if mode not in ('challenge', 'repair', 'review', 'transfer'):
        raise ValueError('Bad selection mode')
    report = summary(user_id, course_id)
    by_skill = {s['skill']: s for s in report['skills']}
    with connect() as conn:
        attempts = conn.execute('''SELECT problem_id, COUNT(*) AS tries,
            MAX(recorded_at) AS last_at, SUM(correct) AS correct_count
            FROM attempts WHERE user_id=? AND course_id=? AND result_id NOT LIKE '%:%' GROUP BY problem_id''',
            (str(user_id), str(course_id))).fetchall()
        # Each PracticeResult may have multiple skill entries. Count actual
        # submitted questions rather than inflating turns by skill tags.
        turn_count = conn.execute('''SELECT COUNT(*) FROM attempts
            WHERE user_id=? AND course_id=? AND result_id NOT LIKE '%:%' ''',
            (str(user_id), str(course_id))).fetchone()[0]
        queue = conn.execute('''SELECT skill,phase,last_problem_id,root_level FROM learning_queue WHERE
            user_id=? AND course_id=? AND phase != 'challenge'
            ORDER BY updated_at DESC LIMIT 10''', (str(user_id), str(course_id))).fetchall()
    seen = {r['problem_id']: r for r in attempts}

    def skills_for(p):
        tags = p.get('knowledge_points') or ['General reasoning']
        return [str(t) for t in (tags if isinstance(tags, list) else [tags])]

    pool = problems
    # Automatically close the miss -> repair -> transfer loop, unless a
    # learner explicitly selected a different skill or mode.
    if mode == 'challenge':
        for entry in queue:
            if (not focus_skill or entry['skill'] == focus_skill) and any(
                    entry['skill'] in skills_for(p) for p in problems):
                focus_skill = entry['skill']
                mode = entry['phase']
                break
    if focus_skill:
        focused = [p for p in pool if focus_skill in skills_for(p)]
        if focused:
            pool = focused

    due_skills = {name for name, state in by_skill.items() if state['due']}
    due_pool = [p for p in pool if any(skill in due_skills for skill in skills_for(p))]
    # In a 5-turn challenge cycle, reserve the first three slots for due
    # retention checks. That prevents a massive fresh bank starving reviews.
    review_slot = (mode == 'review' or (mode == 'challenge' and turn_count % 5 < 3))
    reviewing = bool(due_pool) and review_slot
    if reviewing:
        pool = due_pool

    active = next((q for q in queue if q['skill'] == focus_skill), None)
    root_level = active['root_level'] if active else None
    progression_supported = True
    if mode == 'repair':
        # A repair question must actually require fewer steps than the miss.
        simpler = [p for p in pool if root_level is None or int(p.get('difficulty_layer') or 2) < root_level]
        progression_supported = bool(simpler)
        if simpler: pool = simpler
        min_level = min(int(p.get('difficulty_layer') or 2) for p in pool)
        pool = [p for p in pool if int(p.get('difficulty_layer') or 2) == min_level]
    elif mode == 'transfer':
        harder = [p for p in pool if root_level is None or int(p.get('difficulty_layer') or 2) >= root_level]
        progression_supported = bool(harder)
        if harder: pool = harder
        max_level = max(int(p.get('difficulty_layer') or 2) for p in pool)
        pool = [p for p in pool if int(p.get('difficulty_layer') or 2) == max_level]

    fresh = [p for p in pool if str(p['id']) not in seen]
    if fresh:
        pool = fresh  # Within the target skill/difficulty, test a new item.

    def rating(p):
        item_skills = skills_for(p)
        weakness = max((1.0 - float(by_skill[s]['p']) for s in item_skills if s in by_skill), default=.80)
        # Prefer low-mastery due skills, avoiding repeated items when possible.
        overdue = sum(1 for s in item_skills if s in due_skills)
        difficulty = int(p.get('difficulty_layer') or 2)
        previous = seen.get(str(p['id']))
        repeats = int(previous['tries']) if previous else 0
        last = previous['last_at'] if previous else ''
        if mode == 'repair':
            difficulty_score = 4 - difficulty
        else:
            difficulty_score = difficulty
        return (round(weakness * 4 + .55 * difficulty_score + (1.2 if reviewing else .15) * overdue
                      - .65 * repeats, 5),
                -repeats, '' if not last else '-'+last, str(p['id']))

    chosen = max(pool, key=rating)
    meta = chosen.get('problem_metadata') or {}
    reason = ('Due retention check on a different item' if reviewing else
              'Prerequisite repair, simplest available application' if mode == 'repair' else
              'Hard transfer check for the target skill' if mode == 'transfer' else
              'Challenging question selected from weaker and untested skills')
    if reviewing and str(chosen['id']) in seen:
        reason = 'Due review: no fresh item remains in this skill; repeating an earlier one'
    if mode in ('repair','transfer') and not progression_supported:
        reason = ('No verified simpler question is available for this skill; this item does NOT count as a foundation repair'
                  if mode == 'repair' else
                  'No equal-or-harder transfer item is available; this item does NOT complete transfer')
    if mode in ('repair','transfer'):
        target = next((entry for entry in queue if entry['skill'] == focus_skill), None)
        original = next((p for p in problems if target and str(p['id']) == target['last_problem_id']), None)
        if original and progression_supported:
            earlier = int(original.get('difficulty_layer') or 2)
            now_level = int(chosen.get('difficulty_layer') or 2)
            if mode == 'repair' and now_level >= earlier:
                reason = 'Repair practice: no simpler question available in this skill'
            elif mode == 'transfer' and now_level <= earlier:
                reason = 'Transfer practice: no harder question available in this skill'
    return {'id': str(chosen['id']), 'question': chosen['question'],
            'question_type': chosen.get('question_type', 'mc'),
            'options': chosen.get('options'), 'difficulty_layer': chosen.get('difficulty_layer'),
            'skills': skills_for(chosen), 'hint': meta.get('hint'),
            'graph': meta.get('graph'), 'reason': reason,
            'reviewing': reviewing, 'review_due_count': len(due_skills),
            'effective_mode': 'review' if reviewing else mode,
            'progression_supported':progression_supported, 'focus_skill': focus_skill}


def skip_repair(user_id: str, course_id: str, skill: str) -> bool:
    """Allow stopping a repair loop without erasing attempts or review debt."""
    with _LOCK, connect() as conn:
        count=conn.execute('''UPDATE learning_queue SET phase='challenge', updated_at=?
            WHERE user_id=? AND course_id=? AND skill=? AND phase IN ('repair','transfer')''',
            (utcnow().isoformat(),str(user_id),str(course_id),str(skill))).rowcount
    return bool(count)

def put_edges(user_id: str, course_id: str, edges: list[dict]):
    if len(edges) > 120: raise ValueError('Too many edges')
    clean = [(str(e['prerequisite']).strip()[:120],str(e['dependent']).strip()[:120]) for e in edges]
    if any(not a or not b or a==b for a,b in clean): raise ValueError('Invalid edge')
    graph={}
    for a,b in clean:graph.setdefault(a,[]).append(b)
    visiting=set(); visited=set()
    def visit(x):
        if x in visiting: raise ValueError('Prerequisite cycle detected')
        if x in visited:return
        visiting.add(x)
        for y in graph.get(x,[]):visit(y)
        visiting.remove(x);visited.add(x)
    for n in graph:visit(n)
    with _LOCK,connect() as c:
        c.execute('DELETE FROM edges WHERE user_id=? AND course_id=?',(str(user_id),str(course_id)))
        c.executemany('INSERT INTO edges VALUES (?,?,?,?)',[(str(user_id),str(course_id),a,b) for a,b in clean])
    return len(clean)


def read_notes_json(payload: dict) -> list[dict]:
    """Parse user-supplied proposition records, NOT LearnHarness proprietary files."""
    records=payload.get('propositions',[])
    if not isinstance(records,list) or len(records)>300:raise ValueError('Expected <=300 propositions')
    cleaned=[]
    for r in records:
        if not isinstance(r,dict):continue
        claim=str(r.get('claim','')).strip()[:500]
        premises=r.get('premises',[])
        if claim and isinstance(premises,list):
            cleaned.append({'claim':claim,'premises':[str(p)[:160] for p in premises[:12]]})
    return cleaned


def add_proposition(user_id:str,course_id:str,claim:str,premises:list[str]):
    claim=claim.strip()
    if not 4 <= len(claim) <= 500 or not isinstance(premises,list) or len(premises)>12:
        raise ValueError('Invalid claim or premises')
    premises=[str(p).strip()[:160] for p in premises if str(p).strip()]
    item={'id':str(uuid.uuid4()),'claim':claim,'premises':premises,'created_at':utcnow().isoformat()}
    with _LOCK,connect() as c:
        c.execute('INSERT INTO propositions VALUES (?,?,?,?,?,?)',
          (item['id'],str(user_id),str(course_id),claim,json.dumps(premises),item['created_at']))
    return item


def list_propositions(user_id:str,course_id:str):
    with connect() as c:
        rows=c.execute('SELECT id,claim,premises,created_at FROM propositions WHERE user_id=? AND course_id=? ORDER BY created_at DESC LIMIT 150',
                       (str(user_id),str(course_id))).fetchall()
    return [{**dict(r),'premises':json.loads(r['premises'])} for r in rows]


def store_probe_result(user_id: str, course_id: str, problem_id: str, result_id: str,
                       probe_id: str, skill: str, answer: str, correct: bool) -> bool:
    # One diagnostic answer per original wrong result, separate from mastery.
    with _LOCK, connect() as conn:
        existing=conn.execute('SELECT 1 FROM diagnostic_probes WHERE user_id=? AND course_id=? AND result_id=? AND probe_id=?',
                              (user_id,course_id,result_id,probe_id)).fetchone()
        if existing:return False
        conn.execute('''INSERT INTO diagnostic_probes VALUES (?,?,?,?,?,?,?,?,?)''',
                     (user_id,course_id,problem_id,result_id,probe_id,skill,answer,int(correct),utcnow().isoformat()))
    return True


def get_probe_result(user_id: str, course_id: str, result_id: str, probe_id: str) -> dict | None:
    with connect() as conn:
        row=conn.execute('''SELECT answer,correct,skill,recorded_at FROM diagnostic_probes
            WHERE user_id=? AND course_id=? AND result_id=? AND probe_id=?''',
            (user_id,course_id,result_id,probe_id)).fetchone()
    return dict(row) if row else None


def forget_course(user_id: str, course_id: str, problem_ids: list[str] | None = None) -> dict[str,int]:
    """Purge all private extension data for a deleted course.

    Context is keyed by user+problem (from legacy v0.3); use the owning
    OpenTutor course's IDs to remove only those records, not other courses.
    """
    names = ('hint_exposures','attempts','attempt_events','saved_questions','answer_drafts','mastery','edges','propositions','diagnostic_probes','learning_queue')
    removed: dict[str,int] = {}
    with _LOCK,connect() as conn:
        for name in names:
            row=conn.execute(f'DELETE FROM {name} WHERE user_id=? AND course_id=?',
                             (str(user_id),str(course_id)))
            removed[name]=row.rowcount
        cleaned_ids=list(dict.fromkeys(str(p) for p in (problem_ids or [])))
        removed['context']=0
        for start in range(0,len(cleaned_ids),400):
            chunk=cleaned_ids[start:start+400]
            if chunk:
                placeholders=','.join('?' for _ in chunk)
                removed['context']+=conn.execute(
                    f'DELETE FROM context WHERE user_id=? AND problem_id IN ({placeholders})',
                    [str(user_id),*chunk]).rowcount
    return removed
