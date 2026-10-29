"""Authenticated OpenTutor extension endpoints for Mastery Engine 2.0."""
from __future__ import annotations

import os
import asyncio
import json
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.practice import PracticeProblem, PracticeResult
from mastery_ext.question_bank import category_for
from mastery_ext.practice_bank import generate_verified, TRACKS
from mastery_ext.grammar_drills import generate_grammar_drills
from mastery_ext.offline_coach import lesson_for
from mastery_ext.offline_diagnosis import diagnose
from mastery_ext.offline_probes import probe_for, public_probe, evaluate
from services.auth.dependency import get_current_user
from services.course_access import get_course_or_404
from mastery_ext import engine, analytics, workspace
from mastery_ext.curriculum import get_track, select_diagnostic
from mastery_ext.question_audit import audit as audit_questions
from mastery_ext.study_planner import recommend as recommend_study

router=APIRouter()


def track_for(course):
    configured=(course.metadata_ or {}).get('mastery_track') if isinstance(course.metadata_,dict) else None
    return configured if configured in TRACKS else category_for(course.name)

class Prepared(BaseModel):
    course_id: uuid.UUID
    problem_id: uuid.UUID
    confidence: int | None = Field(None,ge=1,le=5)
    reasoning: str = Field('',max_length=2500)
    mode: str = Field('challenge',pattern='^(challenge|repair|review|transfer)$')
    assisted: bool = False

class BookmarkRequest(BaseModel):
    saved: bool

class DraftRequest(BaseModel):
    base_result_id: str | None = Field(None,max_length=80)
    response: str = Field('',max_length=1500)
    reasoning: str = Field('',max_length=2500)

class Edge(BaseModel):
    prerequisite: str = Field(min_length=1,max_length=120)
    dependent: str = Field(min_length=1,max_length=120)

class Edges(BaseModel):
    edges: list[Edge] = Field(max_length=120)

class TutorRequest(BaseModel):
    course_id: uuid.UUID
    question: str = Field(min_length=1,max_length=3000)
    mode: str = Field('hint',pattern='^(hint|explain|challenge)$')

class ProbeAnswer(BaseModel):
    probe_id: str = Field(min_length=12,max_length=64)
    attempt_id: uuid.UUID
    selected: str = Field(pattern="^[ABCD]$")

class SkipRepairRequest(BaseModel):
    skill: str = Field(min_length=1,max_length=120)

@router.get('/health')
async def health(user:User=Depends(get_current_user)):
    return {'status':'ok','instance_id':os.environ.get('MASTERY_INSTANCE_ID'),'deeptutor_available':shutil.which('deeptutor') is not None,
            'data_file':str(engine.db_path()),'user_id':str(user.id)}

@router.get('/courses/{course_id}/overview')
async def overview(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    return engine.summary(str(user.id),str(course_id))

@router.get('/courses/{course_id}/analytics')
async def learning_analytics(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    with engine.connect() as conn:
        return analytics.report(conn,str(user.id),str(course_id))

class Proposition(BaseModel):
    claim: str = Field(min_length=4,max_length=500)
    premises: list[str] = Field(default_factory=list,max_length=12)

class DebateWorkspace(BaseModel):
    resolution: str = Field(min_length=8,max_length=1000)
    debate_date: str = Field('',max_length=40)

class DebateCard(BaseModel):
    side: str = Field(pattern='^(PRO|CON)$')
    claim: str = Field(min_length=4,max_length=500)
    warrant: str = Field('',max_length=1200)
    impact: str = Field('',max_length=600)
    evidence: str = Field('',max_length=1200)
    source: str = Field('',max_length=500)
    counter: str = Field('',max_length=900)
    response: str = Field('',max_length=900)

class DebateDrill(BaseModel):
    card_id: str | None = Field(None,max_length=64)
    prompt: str = Field(min_length=4,max_length=1200)
    response: str = Field(min_length=1,max_length=3000)
    elapsed_seconds: int = Field(ge=1,le=1800)

@router.get('/courses/{course_id}/propositions')
async def propositions(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    return {'propositions':engine.list_propositions(str(user.id),str(course_id))}

@router.post('/courses/{course_id}/propositions')
async def add_proposition(course_id:uuid.UUID,body:Proposition,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    try:
        return engine.add_proposition(str(user.id),str(course_id),body.claim,body.premises)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc

@router.get('/courses/{course_id}/debate')
async def get_debate(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    return engine.debate_workspace(str(user.id),str(course_id))

@router.put('/courses/{course_id}/debate')
async def put_debate(course_id:uuid.UUID,body:DebateWorkspace,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    try:return engine.save_debate_workspace(str(user.id),str(course_id),body.resolution,body.debate_date)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc

@router.post('/courses/{course_id}/debate/cards')
async def post_debate_card(course_id:uuid.UUID,body:DebateCard,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    try:return engine.add_debate_card(str(user.id),str(course_id),**body.model_dump())
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc

@router.post('/courses/{course_id}/debate/drills')
async def post_debate_drill(course_id:uuid.UUID,body:DebateDrill,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    try:return engine.add_debate_drill(str(user.id),str(course_id),body.prompt,body.response,body.elapsed_seconds,body.card_id)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc

@router.get('/courses/{course_id}/debate/fact-sheet')
async def get_debate_fact_sheet(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    return {'fact_sheet':engine.debate_fact_sheet(str(user.id),str(course_id))}

@router.get('/courses/{course_id}/study-plan')
async def study_plan(course_id:uuid.UUID,minutes:int=20,
        user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    course=await get_course_or_404(db,course_id,user_id=user.id)
    with engine.connect() as conn:
        data=analytics.report(conn,str(user.id),str(course_id))
    mastery=engine.summary(str(user.id),str(course_id))
    try:return recommend_study(track_for(course),data,mastery,minutes=minutes)
    except ValueError:raise HTTPException(422,'Invalid track or duration')

@router.put('/courses/{course_id}/questions/{problem_id}/bookmark')
async def set_bookmark(course_id:uuid.UUID,problem_id:uuid.UUID,body:BookmarkRequest,
        user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    problem=await db.scalar(select(PracticeProblem).where(PracticeProblem.id==problem_id,
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline'))
    if problem is None:raise HTTPException(404,'Question not found')
    with engine.connect() as conn:
        return workspace.bookmark(conn,str(user.id),str(course_id),str(problem_id),body.saved)

@router.put('/courses/{course_id}/questions/{problem_id}/draft')
async def save_question_draft(course_id:uuid.UUID,problem_id:uuid.UUID,body:DraftRequest,
        user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    problem=await db.scalar(select(PracticeProblem).where(PracticeProblem.id==problem_id,
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline'))
    if problem is None:raise HTTPException(404,'Question not found')
    with engine.connect() as conn:
        try:
            return workspace.save_draft(conn,str(user.id),str(course_id),str(problem_id),
                body.response,body.reasoning,body.base_result_id)
        except workspace.StaleDraftError as exc:
            raise HTTPException(409,str(exc)) from exc

@router.get('/courses/{course_id}/questions/{problem_id}/draft')
async def get_question_draft(course_id:uuid.UUID,problem_id:uuid.UUID,
        user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    problem=await db.scalar(select(PracticeProblem).where(PracticeProblem.id==problem_id,
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline'))
    if problem is None:raise HTTPException(404,'Question not found')
    with engine.connect() as conn:
        return {'draft':workspace.read_draft(conn,str(user.id),str(course_id),str(problem_id)),
                'base_result_id':workspace.draft_revision(conn,str(user.id),str(course_id),str(problem_id))}

@router.get('/courses/{course_id}/questions')
async def browse_questions(course_id:uuid.UUID, skill:str='', difficulty:int=0,
        query:str='', status:str='all',
        limit:int=120, offset:int=0, user:User=Depends(get_current_user),
        db:AsyncSession=Depends(get_db)):
    """Safe browsing metadata; never return keys, hints or solutions."""
    await get_course_or_404(db,course_id,user_id=user.id)
    if len(skill)>120 or len(query)>120 or status not in ('all','unseen','attempted','bookmarked') or difficulty not in (0,1,2,3) or not 1<=limit<=120 or not 0<=offset<=10000:
        raise HTTPException(422,'Invalid question filter')
    criteria=[PracticeProblem.course_id==course_id,PracticeProblem.is_archived==False,
              PracticeProblem.source=='mastery_offline']
    if difficulty:criteria.append(PracticeProblem.difficulty_layer==difficulty)
    # Filter after fetching canonical question records, since knowledge_points
    # is a JSON list and backend DB drivers vary in JSON containment support.
    rows=(await db.execute(select(PracticeProblem).where(*criteria)
             .order_by(PracticeProblem.order_index).limit(11000))).scalars().all()
    with engine.connect() as conn:
        bookmarks=workspace.saved_ids(conn,str(user.id),str(course_id))
        attempted={r[0] for r in conn.execute('SELECT DISTINCT problem_id FROM attempt_events WHERE user_id=? AND course_id=?',
                                           (str(user.id),str(course_id))).fetchall()}
    results=[]
    for p in rows:
        tags=p.knowledge_points if isinstance(p.knowledge_points,list) else []
        if skill and skill not in tags:continue
        if query and query.casefold() not in (p.question or '').casefold() and not any(query.casefold() in t.casefold() for t in tags):continue
        if status=='bookmarked' and str(p.id) not in bookmarks:continue
        if status=='attempted' and str(p.id) not in attempted:continue
        if status=='unseen' and str(p.id) in attempted:continue
        meta=p.problem_metadata if isinstance(p.problem_metadata,dict) else {}
        results.append({'id':str(p.id),'question':p.question,
            'skills':tags,'difficulty_layer':p.difficulty_layer,
            'family':meta.get('family') or ('authored' if meta.get('authored') else 'unknown'),
            'source':'mastery_offline','official':False,
            'bookmarked':str(p.id) in bookmarks,'attempted':str(p.id) in attempted})
    return {'total':len(results),'offset':offset,'limit':limit,'questions':results[offset:offset+limit],
            'notice':'Original unofficial exercises; levels are not independently calibrated.'}

@router.get('/courses/{course_id}/questions/{problem_id}')
async def get_solve_question(course_id:uuid.UUID,problem_id:uuid.UUID,
        user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    p=await db.scalar(select(PracticeProblem).where(PracticeProblem.id==problem_id,
          PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline',
          PracticeProblem.is_archived==False))
    if p is None:raise HTTPException(404,'Question not found')
    meta=p.problem_metadata if isinstance(p.problem_metadata,dict) else {}
    with engine.connect() as conn:
        bookmarked=str(p.id) in workspace.saved_ids(conn,str(user.id),str(course_id))
    return {'bookmarked':bookmarked,'id':str(p.id),'question':p.question,'question_type':p.question_type,
            'options':p.options,'difficulty_layer':p.difficulty_layer,
            'skills':p.knowledge_points or [],'graph':meta.get('graph'),
            'official':False,'source':'mastery_offline'}

@router.get('/courses/{course_id}/curriculum')
async def curriculum(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    course=await get_course_or_404(db,course_id,user_id=user.id)
    track=track_for(course)
    try:return get_track(track)
    except ValueError:raise HTTPException(422,'No verified curriculum for this track')

@router.get('/courses/{course_id}/diagnostic')
async def diagnostic(course_id:uuid.UUID,size:int=12,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    if not 4<=size<=20:raise HTTPException(422,'Diagnostic size must be 4–20')
    course=await get_course_or_404(db,course_id,user_id=user.id)
    result=await db.execute(select(PracticeProblem).where(
        PracticeProblem.course_id==course_id, PracticeProblem.is_archived==False,
        PracticeProblem.source=='mastery_offline').order_by(PracticeProblem.order_index).limit(3500))
    questions=[{'id':str(p.id),'question':p.question,'options':p.options,
                'knowledge_points':p.knowledge_points or [],'difficulty_layer':p.difficulty_layer}
               for p in result.scalars().all()]
    try:return select_diagnostic(questions,track_for(course),max_questions=size)
    except ValueError:raise HTTPException(422,'No verified diagnostic for this track')

@router.get('/courses/{course_id}/question-audit')
async def question_audit(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    result=await db.execute(select(PracticeProblem).where(
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline',
        PracticeProblem.is_archived==False).order_by(PracticeProblem.order_index).limit(3500))
    items=[{'question':p.question,'options':p.options,'correct_answer':p.correct_answer,
        'explanation':p.explanation,'knowledge_points':p.knowledge_points,
        'difficulty_layer':p.difficulty_layer,'problem_metadata':p.problem_metadata}
        for p in result.scalars().all()]
    return audit_questions(items)

@router.get('/courses/{course_id}/starting-priorities')
async def starting_priorities(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    from mastery_ext.starter import starting_priorities as topics_for
    course=await get_course_or_404(db,course_id,user_id=user.id)
    return {'topics':topics_for(course.name),
            'basis':'Initial priorities from prior self-reported study history, not a fresh diagnostic'}

@router.get('/courses/{course_id}/next')
async def next_problem(course_id:uuid.UUID, focus_skill:str='',mode:str='challenge',
                       user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    course=await get_course_or_404(db,course_id,user_id=user.id)
    if mode not in ('challenge','repair','review','transfer'):raise HTTPException(422,'Unsupported mode')
    if len(focus_skill)>120:raise HTTPException(422,'Invalid skill')
    result=await db.execute(select(PracticeProblem).where(
        PracticeProblem.course_id==course_id,PracticeProblem.is_diagnostic==False,
        PracticeProblem.is_archived==False,
        PracticeProblem.source=='mastery_offline').order_by(PracticeProblem.order_index).limit(3500))
    problems=[{'id':str(p.id),'question':p.question,'question_type':p.question_type,
               'options':p.options,'difficulty_layer':p.difficulty_layer,
               'knowledge_points':p.knowledge_points,'problem_metadata':p.problem_metadata} for p in result.scalars().all()]
    chosen=engine.choose_next(str(user.id),str(course_id),problems,focus_skill=focus_skill,mode=mode)
    if chosen:
        with engine.connect() as conn:
            chosen['bookmarked']=chosen['id'] in workspace.saved_ids(conn,str(user.id),str(course_id))
    return {'question':chosen,'available':len(problems),'track':track_for(course)}


@router.post('/courses/{course_id}/skip-repair')
async def skip_repair(course_id:uuid.UUID,body:SkipRepairRequest,
                      user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    return {'skipped':engine.skip_repair(str(user.id),str(course_id),body.skill),
            'note':'Mastery history and scheduled review are preserved'}


async def _populate(course_id:uuid.UUID, user:User, db:AsyncSession, size:int=160, pack:int=0):
    course=await get_course_or_404(db,course_id,user_id=user.id)
    track=track_for(course)
    if track not in TRACKS:raise HTTPException(422,'Unknown practice track')
    if not 0 <= pack <= 20:raise HTTPException(422,'Pack exceeds safety limit')
    # Reading passages are finite and authored; rule-driven grammar edits can
    # generate fresh, independently keyed exercises in future packs.
    if track in ('SAT Reading & Writing','ACT English'):
        authored=generate_verified(track,'authored',400) if pack==0 else []
        items=authored+generate_grammar_drills(track,f'pack-{pack}',160)
    elif track=='ACT Reading':
        pack=0
        items=generate_verified(track,'authored',400)
    else:
        items=generate_verified(track,f'pack-{pack}',size)
    stored=await db.execute(select(PracticeProblem.problem_metadata).where(
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline'))
    stored_meta=[meta for (meta,) in stored.all() if isinstance(meta,dict)]
    keys={meta.get('mastery_seed_key') for meta in stored_meta}
    hashes={meta.get('question_hash') for meta in stored_meta}
    added=0
    # Skip duplicate authored prompts from earlier packs or legacy sample bank.
    for i,entry in enumerate(items):
        meta=entry['problem_metadata']
        if meta['mastery_seed_key'] in keys or meta.get('question_hash') in hashes:continue
        keys.add(meta['mastery_seed_key']);hashes.add(meta.get('question_hash'))
        db.add(PracticeProblem(course_id=course_id,question_type='mc',
            question=entry['question'],options=entry['options'],
            correct_answer=entry['correct_answer'],explanation=entry['explanation'],
            knowledge_points=entry['knowledge_points'],difficulty_layer=entry['difficulty_layer'],
            source='mastery_offline',source_owner='user',order_index=20000+pack*1000+i,
            problem_metadata=meta,is_diagnostic=False,is_archived=False))
        added+=1
    if added:await db.commit()
    return {'added':added,'track':track,'pack':pack,'total_in_pack':len(items),
            'offline':True,'content':'Original practice drills (not official exam questions)'}


@router.post('/courses/{course_id}/starter-questions')
async def install_starter_questions(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    """Preserve the old launcher endpoint: now seeds the large offline bank."""
    return await _populate(course_id,user,db)


@router.post('/courses/{course_id}/expand')
async def expand_questions(course_id:uuid.UUID,pack:int=1,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    """Build another deterministic numerical pack, idempotently and with no AI calls."""
    return await _populate(course_id,user,db,size=160,pack=pack)


@router.get('/courses/{course_id}/bank-status')
async def bank_status(course_id:uuid.UUID,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    course=await get_course_or_404(db,course_id,user_id=user.id)
    rows=(await db.execute(select(PracticeProblem.problem_metadata).where(
        PracticeProblem.course_id==course_id,PracticeProblem.source=='mastery_offline'))).all()
    packs={}
    for (meta,) in rows:
        if isinstance(meta,dict):
            key=str(meta.get('mastery_seed_key',''))
            if '|pack-' in key:
                pack=int(key.split('|pack-',1)[1].split('|',1)[0]);packs[pack]=packs.get(pack,0)+1
    track=track_for(course)
    return {'track':track,'supported':track in TRACKS,'total_offline':len(rows),
            'packs':packs,'finite_verbal':track=='ACT Reading',
            'finite_reading':track in ('SAT Reading & Writing','ACT Reading'),
            'next_pack':max(packs,default=-1)+1}


@router.get('/courses/{course_id}/offline-help/{problem_id}')
async def offline_help(course_id:uuid.UUID,problem_id:uuid.UUID,
                       user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    p=await db.scalar(select(PracticeProblem).where(PracticeProblem.course_id==course_id,
                 PracticeProblem.id==problem_id))
    if p is None:raise HTTPException(404,'Question not found')
    meta=p.problem_metadata if isinstance(p.problem_metadata,dict) else {}
    skills=p.knowledge_points if isinstance(p.knowledge_points,list) else []
    # Persist hint provenance before returning even if the client later sends assisted=false.
    engine.mark_hint_exposure(str(user.id),str(course_id),str(problem_id),skills)
    return {**lesson_for(skills,meta.get('hint')),'offline':True,
            'answer_hidden':True}


@router.get('/courses/{course_id}/offline-diagnosis/{problem_id}')
async def offline_diagnosis(course_id:uuid.UUID,problem_id:uuid.UUID,attempt_id:uuid.UUID,
                           user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    """Unlocked only after this user has actually submitted the problem."""
    await get_course_or_404(db,course_id,user_id=user.id)
    p=await db.scalar(select(PracticeProblem).where(PracticeProblem.course_id==course_id,
                      PracticeProblem.id==problem_id))
    if p is None:raise HTTPException(404,'Question not found')
    attempt=await db.scalar(select(PracticeResult).where(
        PracticeResult.id==attempt_id,PracticeResult.problem_id==problem_id,PracticeResult.user_id==user.id))
    if attempt is None:raise HTTPException(403,'Submit your answer before accessing diagnosis')
    if attempt.is_correct:return {'correct':True,'offline':True}
    metadata=p.problem_metadata if p.source=='mastery_offline' and isinstance(p.problem_metadata,dict) else {}
    tags=p.knowledge_points if isinstance(p.knowledge_points,list) else []
    skill=str(tags[0]) if tags else 'this skill'
    probe=probe_for(skill,str(problem_id)) if p.source=='mastery_offline' else None
    result=engine.get_probe_result(str(user.id),str(course_id),str(attempt.id),probe['probe_id']) if probe else None
    response={'correct':False,**diagnose(metadata,attempt.user_answer,skill),
              'probe':public_probe(probe) if probe else None}
    if result:
        response['probe_result']={**evaluate(probe,result['answer']),'selected':result['answer'],'previously_submitted':True}
    return response


@router.post('/courses/{course_id}/offline-probe/{problem_id}')
async def submit_offline_probe(course_id:uuid.UUID,problem_id:uuid.UUID,body:ProbeAnswer,
                               user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    """A separate graded prerequisite check after a wrong offline question.

    Unlike regular practice, this answer never changes BKT or review timing.
    It is only evidence about the checked prerequisite, not the student's
    private reasoning on the original question.
    """
    await get_course_or_404(db,course_id,user_id=user.id)
    p=await db.scalar(select(PracticeProblem).where(PracticeProblem.course_id==course_id,
                       PracticeProblem.id==problem_id,PracticeProblem.source=='mastery_offline'))
    if p is None:raise HTTPException(404,'Offline question not found')
    last=await db.scalar(select(PracticeResult).where(PracticeResult.id==body.attempt_id,
                PracticeResult.problem_id==problem_id,PracticeResult.user_id==user.id))
    if last is None or last.is_correct:raise HTTPException(403,'A submitted wrong answer is required')
    tags=p.knowledge_points if isinstance(p.knowledge_points,list) else []
    skill=str(tags[0]) if tags else ''
    probe=probe_for(skill,str(problem_id))
    if not probe:raise HTTPException(404,'No vetted offline probe for this skill')
    if probe['probe_id']!=body.probe_id:raise HTTPException(422,'Probe does not match this question')
    previous=engine.get_probe_result(str(user.id),str(course_id),str(last.id),body.probe_id)
    selected=previous['answer'] if previous else body.selected
    result=evaluate(probe,selected)
    if not previous:
        engine.store_probe_result(str(user.id),str(course_id),str(problem_id),str(last.id),
                                  probe['probe_id'],skill,selected,result['correct'])
    return {**result,'selected':selected,'previously_submitted':bool(previous),'offline':True}


@router.post('/prepare')
async def prepare(body:Prepared,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,body.course_id,user_id=user.id)
    problem=await db.scalar(select(PracticeProblem).where(PracticeProblem.id==body.problem_id,
                                                         PracticeProblem.course_id==body.course_id))
    if problem is None:raise HTTPException(404,'Question not found in this course')
    engine.prepare_context(str(user.id),str(body.problem_id),body.confidence,body.reasoning,
                           body.mode,problem.difficulty_layer,body.assisted)
    return {'saved':True}

@router.put('/courses/{course_id}/edges')
async def edges(course_id:uuid.UUID,body:Edges,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await get_course_or_404(db,course_id,user_id=user.id)
    try:
        count=engine.put_edges(str(user.id),str(course_id),[e.model_dump() for e in body.edges])
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    return {'saved':count}

@router.post('/tutor')
async def tutor(body:TutorRequest,user:User=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    """Optional DeepTutor CLI adapter. No shell; no credentials handled by this route."""
    course=await get_course_or_404(db,body.course_id,user_id=user.id)
    binary=shutil.which('deeptutor')
    if binary is None:
        raise HTTPException(503,'DeepTutor is not installed. Install/configure deeptutor separately.')
    report=engine.summary(str(user.id),str(body.course_id))
    weak=[s['skill'] for s in report['skills'][:5]]
    directive={
        'hint':'Give one productive hint, not the answer. Ask for reasoning first.',
        'explain':'Give a precise explanation, a worked example, then a transfer check.',
        'challenge':'Give one difficult original challenge and hold back its solution.'
    }[body.mode]
    prompt=(f'You are assisting a student in {course.name}. Weak concepts: {weak}. '
            f'Instruction: {directive} Correct misconceptions rather than praising guesses. '
            f'Question: {body.question}')
    try:
        proc=await asyncio.create_subprocess_exec(binary,'run','chat',prompt,'--format','json',
                stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
        try:stdout,stderr=await asyncio.wait_for(proc.communicate(),timeout=85)
        except asyncio.TimeoutError:
            proc.kill();await proc.communicate();raise HTTPException(504,'DeepTutor timed out')
    except OSError as exc:raise HTTPException(503,'DeepTutor could not start') from exc
    if proc.returncode:
        raise HTTPException(503,'DeepTutor command failed; verify provider configuration in DeepTutor')
    text=[]
    for line in stdout.decode('utf-8','replace').splitlines():
        try:
            obj=json.loads(line)
            if obj.get('type')=='content' and isinstance(obj.get('content'),str):text.append(obj['content'])
        except ValueError:continue
    if not text:raise HTTPException(502,'DeepTutor returned no usable explanation')
    return {'answer':'\n'.join(text)[:18000], 'engine':'DeepTutor CLI', 'mode':body.mode}
