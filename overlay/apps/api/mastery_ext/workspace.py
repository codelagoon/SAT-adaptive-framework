"""User-scoped offline bookmarks and draft answers. No grading side effects.

A draft is not a submission. Saving an answer must never create a mastery event.
Deleting a course removes its drafts and bookmarks but preserves other courses.
"""
from __future__ import annotations
from datetime import datetime, timezone
import sqlite3


def install(conn:sqlite3.Connection) -> None:
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS saved_questions (
      user_id TEXT NOT NULL,course_id TEXT NOT NULL,problem_id TEXT NOT NULL,
      saved_at TEXT NOT NULL,PRIMARY KEY(user_id,course_id,problem_id)
    );
    CREATE TABLE IF NOT EXISTS answer_drafts (
      user_id TEXT NOT NULL,course_id TEXT NOT NULL,problem_id TEXT NOT NULL,
      response TEXT NOT NULL,reasoning TEXT NOT NULL DEFAULT '',
      saved_at TEXT NOT NULL,PRIMARY KEY(user_id,course_id,problem_id)
    );
    ''')


def bookmark(conn, user_id:str,course_id:str,problem_id:str,saved:bool) -> dict:
    install(conn)
    if saved:
        conn.execute('''INSERT INTO saved_questions(user_id,course_id,problem_id,saved_at)
           VALUES(?,?,?,?) ON CONFLICT DO NOTHING''',
           (user_id,course_id,problem_id,datetime.now(timezone.utc).isoformat()))
    else:
        conn.execute('DELETE FROM saved_questions WHERE user_id=? AND course_id=? AND problem_id=?',
                     (user_id,course_id,problem_id))
    return {'saved':saved,'problem_id':problem_id}


def saved_ids(conn,user_id:str,course_id:str) -> set[str]:
    install(conn)
    return {r[0] for r in conn.execute('SELECT problem_id FROM saved_questions WHERE user_id=? AND course_id=?',
                                      (user_id,course_id)).fetchall()}


def save_draft(conn,user_id:str,course_id:str,problem_id:str,response:str,reasoning:str='') -> dict:
    install(conn)
    if len(response)>1500 or len(reasoning)>2500:raise ValueError('Draft exceeds size limit')
    now=datetime.now(timezone.utc).isoformat()
    conn.execute('''INSERT INTO answer_drafts(user_id,course_id,problem_id,response,reasoning,saved_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,course_id,problem_id) DO UPDATE SET
      response=excluded.response,reasoning=excluded.reasoning,saved_at=excluded.saved_at''',
      (user_id,course_id,problem_id,response,reasoning,now))
    return {'saved':True,'problem_id':problem_id,'saved_at':now}


def read_draft(conn,user_id:str,course_id:str,problem_id:str) -> dict | None:
    install(conn)
    r=conn.execute('''SELECT response,reasoning,saved_at FROM answer_drafts
         WHERE user_id=? AND course_id=? AND problem_id=?''',
        (user_id,course_id,problem_id)).fetchone()
    return dict(r) if r else None


def clear_draft(conn,user_id:str,course_id:str,problem_id:str) -> None:
    install(conn)
    conn.execute('DELETE FROM answer_drafts WHERE user_id=? AND course_id=? AND problem_id=?',
                 (user_id,course_id,problem_id))
