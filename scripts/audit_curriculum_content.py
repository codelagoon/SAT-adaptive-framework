#!/usr/bin/env python3
"""Reproducible, local-only audit of all installed offline bank generators.

Outputs *structural* validity, not editorial or exam-calibration claims.
No network, provider API, or model inference required.
"""
from __future__ import annotations
from collections import defaultdict
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'overlay/apps/api'))
from mastery_ext.curriculum import DOMAINS,get_track
from mastery_ext.question_audit import audit
from mastery_ext.practice_bank import generate_verified
from mastery_ext.grammar_drills import generate_grammar_drills


def run():
    result={}
    for track in DOMAINS:
        generated=[]
        if track in ('SAT Reading & Writing','ACT English'):
            generated.extend(generate_verified(track,'authored',400))
            for n in range(21):generated.extend(generate_grammar_drills(track,f'pack-{n}',160))
        elif track=='ACT Reading':
            generated.extend(generate_verified(track,'authored',400))
        else:
            for n in range(21):generated.extend(generate_verified(track,f'pack-{n}',160))
        raw=audit(generated)
        # The installed bank deduplicates seed keys and stem/question hashes.
        seen_hashes=set();seen_seeds=set();unique=[]
        for item in generated:
            meta=item.get('problem_metadata',{})
            qhash=meta.get('question_hash');seed=meta.get('mastery_seed_key')
            if seed in seen_seeds or qhash in seen_hashes:continue
            seen_hashes.add(qhash);seen_seeds.add(seed);unique.append(item)
        valid=audit(unique)
        actual=sum(1 for q in generated if q.get('problem_metadata',{}).get('question_hash'))
        plan=get_track(track,questions=unique)
        result[track]={
            'generated_items_before_app_deduplication':len(generated),
            'unique_question_hashes':len(seen_hashes)-int(None in seen_hashes),
            'actual_app_eligible_after_deduplication':len(unique),
            'question_hash_metadata_present':actual==len(generated),
            'technical_audit':{'raw_duplicates_or_defects':raw['structural_failed'],
                'structurally_valid':valid['structural_passed'],
                'structurally_invalid':valid['structural_failed'],
                'first_failures':valid['failures'][:20],
                'distinct_problem_families':valid['distinct_families']},
            'curriculum':{'missing_lessons':plan['missing_lessons'],
                'unmapped_skills':plan['unmapped_question_skills'],
                'available_skills':sum(len(d['skills']) for d in plan['domains'])}}
    return {'scope':'Original, unofficial offline practice engine',
            'interpretation':'Parameter changes are NOT independent content authoring; numbers are not official calibrated exam-question counts.',
            'human_editorial_review':'not performed; required for release',
            'license_verification':'original items only; any external sources must be checked separately',
            'tracks':result}


if __name__=='__main__':
    output=run()
    target=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'docs'/'CONTENT_AUDIT.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Written {target}')
    for name,info in output['tracks'].items():
        print(f'{name}: {info["generated_items_before_app_deduplication"]} generated; '
              f'{info["unique_question_hashes"]} unique hashes; '
              f'{info["technical_audit"]["structurally_invalid"]} structurally invalid')
