"""Bounded, transparent adaptive study plans built from real evidence.

No LLM and no claim of diagnosed private reasoning. Prioritizes due review,
then errors with independent evidence, then coverage gaps, then mixed practice.
"""
from __future__ import annotations
from mastery_ext.curriculum import get_track


def recommend(track: str, metrics: dict, mastery: dict, *, minutes: int = 20) -> dict:
    if not 5 <= minutes <= 180:raise ValueError('Study duration out of range')
    blueprint=get_track(track)
    supported={s['name']:s for d in blueprint['domains'] for s in d['skills']}
    due=[s for s in mastery.get('skills',[]) if s.get('due') and s.get('skill') in supported]
    weaknesses=[s for s in metrics.get('weaknesses',[]) if s.get('skill') in supported and s.get('total',0)>=3]
    if due:
        target=min(due,key=lambda s:(s.get('p',1),s['skill']))['skill']
        reason='Due scheduled review; review debt takes priority over new questions.'
        stage='review'
    elif weaknesses and weaknesses[0].get('accuracy',1) < .8:
        target=weaknesses[0]['skill']
        reason=(f"{weaknesses[0]['correct']} of {weaknesses[0]['total']} recent recorded independent "
                f"first attempts were correct; this identifies an observed weakness, not its cause.")
        stage='repair'
    else:
        attempted={s['skill'] for s in metrics.get('skills',[]) if s.get('total',0)>0}
        target=next((s for s in supported if s not in attempted),None)
        if target:
            reason='No independent first-attempt evidence for this skill yet.'
            stage='diagnose'
        else:
            target=next(iter(supported))
            reason='No sufficiently evidenced weakness; continue varied unseen practice.'
            stage='mixed'
    skills=supported[target]
    stages=[]
    if stage in {'repair','diagnose'}:
        stages.append({'mode':'learn','skill':target,'minutes':max(2,minutes//4),
                       'task':'Read one worked example and explain its decisive step.'})
    first_minutes=sum(x['minutes'] for x in stages)
    stages.append({'mode':'solve','skill':target,'minutes':max(3,minutes-first_minutes-max(2,minutes//5)),
                   'task':'Answer fresh, appropriately difficult items independently; record hints separately.'})
    stages.append({'mode':'review','skill':target,'minutes':minutes-sum(x['minutes'] for x in stages),
                   'task':'Inspect wrong answers, verify one prerequisite with a new probe, and schedule later recall.'})
    return {'track':track,'stage':stage,'target_skill':target,'reason':reason,
            'prerequisites':skills['prerequisites'],'lesson':skills['lesson'],
            'duration_minutes':minutes,'steps':stages,
            'evidence_level':'provisional' if metrics.get('independent_first_attempts',{}).get('total',0)<20 else 'descriptive',
            'verification':'Mastery only after unseen independent and delayed transfer evidence; no score prediction.'}
