"""Fail-closed technical validation for locally generated MC question entries.

Passing structural validation does not certify human editorial quality or
psychometric calibration. Repeated parameterized families are not independent
exam-writing decisions.
"""
from __future__ import annotations
from collections import defaultdict
import hashlib
import re


def audit(items: list[dict]) -> dict:
    problems=[]; seen_stems=set(); seen_ids=set(); families=defaultdict(int)
    for i, item in enumerate(items):
        defects=[]
        stem=item.get('question')
        opts=item.get('options')
        key=item.get('correct_answer')
        tags=item.get('knowledge_points')
        meta=item.get('problem_metadata')
        if not isinstance(stem,str) or not stem.strip():defects.append('missing_stem')
        if not isinstance(opts,dict) or set(opts)!={'A','B','C','D'}:
            defects.append('invalid_options')
        elif any(not isinstance(v,str) or not v.strip() for v in opts.values()) or len(set(opts.values()))!=4:
            defects.append('non_distinct_or_empty_options')
        if key not in {'A','B','C','D'} or not isinstance(opts,dict) or key not in opts:
            defects.append('invalid_key')
        if not isinstance(item.get('explanation'),str) or len(item['explanation'].strip())<20:
            defects.append('missing_explanation')
        if not isinstance(tags,list) or not tags or not all(isinstance(t,str) and t.strip() for t in tags):
            defects.append('missing_skill_tags')
        if item.get('difficulty_layer') not in (1,2,3):defects.append('unsubstantiated_or_missing_layer')
        if not isinstance(meta,dict):
            defects.append('missing_metadata');meta={}
        if stem and isinstance(stem,str):
            normalized=re.sub(r'\s+',' ',stem.casefold()).strip()
            if normalized in seen_stems:defects.append('repeated_stem')
            seen_stems.add(normalized)
        seed_key=meta.get('mastery_seed_key')
        if seed_key:
            if seed_key in seen_ids:defects.append('repeated_seed_key')
            seen_ids.add(seed_key)
        family=meta.get('family') or ('authored/'+str(meta.get('track','unknown')) if meta.get('authored') is True else None)
        if not isinstance(family,str) or not family:
            defects.append('unidentified_problem_family')
        else:families[family]+=1
        if defects:problems.append({'index':i,'defects':defects})
    return {'total':len(items),'structural_passed':len(items)-len(problems),
            'structural_failed':len(problems),'failures':problems,
            'distinct_families':len(families),'family_counts':dict(sorted(families.items())),
            'human_editorial_review':'required', 'difficulty_calibration':'not established',
            'license_review':'required before adding third-party content'}
