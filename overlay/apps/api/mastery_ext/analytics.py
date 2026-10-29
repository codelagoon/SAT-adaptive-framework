"""Auditable analytics: one immutable event per graded response, not per skill.

Counts guided/repeated responses separately from new independent answers.
The legacy BKT signal is deliberately separate and uncalibrated.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import json
import sqlite3


def install(conn: sqlite3.Connection) -> None:
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS attempt_events (
      result_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
      problem_id TEXT NOT NULL, skills_json TEXT NOT NULL,
      correct INTEGER NOT NULL CHECK(correct IN (0,1)),
      assisted INTEGER NOT NULL DEFAULT 0 CHECK(assisted IN (0,1)),
      mode TEXT NOT NULL, difficulty_level INTEGER,
      elapsed_ms INTEGER CHECK(elapsed_ms IS NULL OR elapsed_ms >= 0),
      confidence INTEGER CHECK(confidence IS NULL OR confidence BETWEEN 1 AND 5),
      error_category TEXT, reasoning TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_event_owner_date ON attempt_events(user_id,course_id,recorded_at);
    CREATE INDEX IF NOT EXISTS ix_event_owner_problem ON attempt_events(user_id,course_id,problem_id,recorded_at);
    ''')


def add_event(conn: sqlite3.Connection, *, result_id: str, user_id: str,
              course_id: str, problem_id: str, skills: list[str],
              correct: bool, assisted: bool, mode: str, difficulty_level: int | None,
              elapsed_ms: int | None, confidence: int | None,
              error_category: str | None, reasoning: str, recorded_at: str) -> None:
    """Called within an existing grade transaction; duplicate IDs never inflate results."""
    if mode not in {'challenge','repair','review','transfer','exam','legacy_unverified'}:
        raise ValueError('Unsupported attempt mode')
    if elapsed_ms is not None and elapsed_ms < 0:
        raise ValueError('Negative elapsed time')
    conn.execute('''INSERT OR IGNORE INTO attempt_events
        (result_id,user_id,course_id,problem_id,skills_json,correct,assisted,mode,
         difficulty_level,elapsed_ms,confidence,error_category,reasoning,recorded_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (str(result_id),str(user_id),str(course_id),str(problem_id),
         json.dumps(list(dict.fromkeys(skills))),int(correct),int(assisted),mode,
         difficulty_level,elapsed_ms,confidence,error_category,reasoning,recorded_at))


def migrate_legacy(conn: sqlite3.Connection) -> int:
    """Preserve pre-upgrade attempts as unverified, not new first mastery."""
    exists=conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='attempts'").fetchone()
    if not exists:return 0
    rows=conn.execute('''SELECT a.* FROM attempts a
        WHERE a.result_id NOT LIKE '%:%'
          AND NOT EXISTS (SELECT 1 FROM attempt_events e WHERE e.result_id=a.result_id)
        ORDER BY a.recorded_at,a.result_id''').fetchall()
    for r in rows:
        add_event(conn,result_id=r['result_id'],user_id=r['user_id'],course_id=r['course_id'],
                  problem_id=r['problem_id'],skills=[r['skill']],correct=bool(r['correct']),
                  assisted=False,mode='legacy_unverified',difficulty_level=None,
                  elapsed_ms=r['elapsed_ms'],confidence=r['confidence'],
                  error_category=r['error_category'],reasoning=r['reasoning'],recorded_at=r['recorded_at'])
    return len(rows)


def _rate(rows: list[dict]) -> dict:
    n=len(rows)
    successes=sum(x['correct'] for x in rows)
    return {'correct':successes,'total':n,'accuracy':round(successes/n,4) if n else None}


def _median(values: list[int]) -> float | None:
    if not values:return None
    s=sorted(values); n=len(s)
    return float(s[n//2]) if n%2 else (s[n//2-1]+s[n//2])/2


def report(conn: sqlite3.Connection, user_id: str, course_id: str,
           *, as_of: datetime | None = None) -> dict:
    """First unassisted response on a *new* question = independent evidence.

    A question attempted with hints first stays ineligible for first-attempt
    independent accuracy even when solved on a later attempt.
    """
    install(conn)
    rows=[dict(r) for r in conn.execute('''SELECT * FROM attempt_events
      WHERE user_id=? AND course_id=? ORDER BY recorded_at,rowid''',
      (str(user_id),str(course_id))).fetchall()]
    seen=set(); first=[]; eligible=[]; repeats=[]; guided=[]; groups=defaultdict(list)
    delayed=[]; delayed_skills=defaultdict(list); transfer=[]
    prior_independent_by_skill={}; prior_exposure_by_skill={}
    def parse_time(iso):
        d=datetime.fromisoformat(iso)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    for row in rows:
        row['skills']=json.loads(row.pop('skills_json'))
        fresh=row['problem_id'] not in seen
        seen.add(row['problem_id'])
        independent=bool(fresh and not row['assisted'] and row['mode'] in ('challenge','review','transfer','exam'))
        if fresh:first.append(row)
        else:repeats.append(row)
        if row['assisted']:guided.append(row)
        if independent:eligible.append(row)
        if independent and row['mode']=='transfer':transfer.append(row)
        confirmed_delayed=False
        at=parse_time(row['recorded_at'])
        for skill in row['skills']:
            last=prior_exposure_by_skill.get(skill)
            earlier_independent=prior_independent_by_skill.get(skill)
            # Only a new, independently solved, delayed review is retention evidence.
            if (independent and row['mode']=='review'
                    and last is not None and earlier_independent is not None
                    and at-last>=timedelta(hours=20)):
                delayed_skills[skill].append(row)
                confirmed_delayed=True
            groups[skill].append((row,independent))
            prior_exposure_by_skill[skill]=at
            if independent:prior_independent_by_skill[skill]=at
        if confirmed_delayed:delayed.append(row)
    skills=[]
    for skill,group in sorted(groups.items()):
        independent=[r for r,ok in group if ok]
        times=[r['elapsed_ms'] for r in independent if r['elapsed_ms'] is not None]
        skills.append({'skill':skill,**_rate(independent),'all_attempts':len(group),
                       'independent_median_ms':_median(times),
                       'sample_warning':len(independent)<10,'last_seen':group[-1][0]['recorded_at']})
    weaknesses=sorted([s for s in skills if s['total']],key=lambda s:(s['accuracy'],-s['total'],s['skill']))
    retention_by_skill=[{'skill':skill,**_rate(group),'sample_warning':len(group)<5}
                        for skill,group in sorted(delayed_skills.items())]
    evidence_by_skill=[{'skill':item['skill'],
                        'independent_n':item['total'],
                        'delayed_n':len(delayed_skills[item['skill']]),
                        'provisional':item['total']<10 or len(delayed_skills[item['skill']])<3}
                        for item in skills]
    daily=defaultdict(list)
    for row in eligible:daily[row['recorded_at'][:10]].append(row)
    times=[r['elapsed_ms'] for r in eligible if r['elapsed_ms'] is not None]
    good=[r['elapsed_ms'] for r in eligible if r['correct'] and r['elapsed_ms'] is not None]
    wrong=[r['elapsed_ms'] for r in eligible if not r['correct'] and r['elapsed_ms'] is not None]
    now=as_of or datetime.now(timezone.utc)
    def ts(r):
        d=datetime.fromisoformat(r['recorded_at'])
        return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).timestamp()
    this_week=[r for r in eligible if now.timestamp()-604800 <= ts(r) <= now.timestamp()]
    last_week=[r for r in eligible if now.timestamp()-1209600 <= ts(r) < now.timestamp()-604800]
    return {
      'sample_count':len(rows),'first_attempts':_rate(first),
      'delayed_retention':_rate(delayed),
      'retention_by_skill':retention_by_skill,
      'independent_transfer':_rate(transfer),
      'mastery_evidence_by_skill':evidence_by_skill,
      'independent_first_attempts':_rate(eligible),'assisted_attempts':_rate(guided),
      'repeat_attempts':_rate(repeats),
      'legacy_unverified_attempts':_rate([r for r in rows if r['mode']=='legacy_unverified']),
      'timing':{'independent_median_ms':_median(times),'correct_median_ms':_median(good),
                'wrong_median_ms':_median(wrong),'timed_independent_n':len(times)},
      'skills':skills,'weaknesses':weaknesses[:8],
      'daily':[{'date':day,**_rate(group)} for day,group in sorted(daily.items())],
      'recent_periods':{'past_7_days':_rate(this_week),'previous_7_days':_rate(last_week)},
      'limitations':['Not a predicted SAT/ACT scaled score.',
          'Difficulty and psychometric calibration are not established.',
          'Older attempts without assistance provenance are legacy-unverified and excluded from independent mastery.',
          'Hints outside recorded sessions cannot be inferred.',
          'Skill tags on one answer are correlated, not independent observations.',
          'Small samples are descriptive and cannot establish improvement.',
          'Delayed retention requires a fresh unaided review at least 20 hours after previous exposure.',
          'Transfer means a fresh independent answer tagged by the tutor as transfer; far-transfer validity is not established.',
          'Review intervals are heuristic and have not been experimentally calibrated.'],
      'next_action':('Collect at least five fresh independent answers in a target skill.'
          if len(eligible)<5 else ('Review '+weaknesses[0]['skill']+' on a fresh question family, then retest later.'
          if weaknesses and weaknesses[0]['accuracy']<.8 else 'Continue fresh mixed practice and delayed review.'))}
