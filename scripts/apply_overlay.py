"""Fail-closed OpenTutor patcher. Original source backed up once per file.

Usage: python3 scripts/apply_overlay.py /path/to/OpenTutor
"""
from pathlib import Path
import sys
import shutil

ROOT=Path(__file__).resolve().parents[1]

ROUTER_ANCHOR='    for router, prefix, tags in CORE_ROUTERS:\n        _include_router(app, router, prefix=prefix, tags=tags)'
ROUTER_PATCH=ROUTER_ANCHOR+'\n\n    from mastery_ext.router import router as mastery_router\n    _include_router(app, mastery_router, prefix="/api/mastery", tags=["mastery-engine"])'
SUBMISSION_ANCHOR='    await db.commit()\n\n    if not is_correct and wa:'
SUBMISSION_PATCH='''    await db.commit()

    # Optional offline mastery telemetry. Independent of grading success.
    try:
        from mastery_ext.engine import record_attempt
        record_attempt(
            result_id=str(pr.id),user_id=str(user.id),course_id=str(problem.course_id),
            problem_id=str(problem.id),skills=kp_list,correct=is_correct,
            error_category=error_category,elapsed_ms=body.answer_time_ms,
        )
    except Exception:
        logger.exception("Optional mastery history update failed")

    if not is_correct and wa and problem.source != "mastery_offline":'''
RESPONSE_SCHEMA_ANCHOR='class AnswerResponse(BaseModel):\n    is_correct: bool'
RESPONSE_SCHEMA_PATCH='class AnswerResponse(BaseModel):\n    result_id: str | None = None\n    is_correct: bool'
RESPONSE_ID_ANCHOR='    return AnswerResponse(\n        is_correct=is_correct,'
RESPONSE_ID_PATCH='    return AnswerResponse(\n        result_id=str(pr.id),\n        is_correct=is_correct,'
CLASSIFIER_ANCHOR='    if not is_correct and problem.correct_answer:\n        try:'
CLASSIFIER_PATCH='    if not is_correct and problem.correct_answer and problem.source != "mastery_offline":\n        try:'
WEB_COURSE_ANCHOR='''        {
          source: "/api/:path*",
          destination: `${API_URL}/:path*`,
        },'''
WEB_COURSE_PATCH='''        {
          source: "/api/courses",
          destination: `${API_URL}/courses/`,
        },
        {
          source: "/api/courses/",
          destination: `${API_URL}/courses/`,
        },
'''+WEB_COURSE_ANCHOR
SIDEBAR_ANCHOR='''        <button
          type="button"
          onClick={() => onNavigate("/settings")}
'''
SIDEBAR_PATCH='''        <button
          type="button"
          onClick={() => onNavigate("/mastery")}
          className="px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors text-left flex items-center gap-2"
        >
          <Sparkles className="size-3.5" />
          Mastery Engine 2.0
        </button>
'''+SIDEBAR_ANCHOR
DELETE_COURSE_ANCHOR='''    course = await get_course_or_404(db, course_id, user_id=user.id)
    await db.delete(course)
    await db.commit()'''
DELETE_COURSE_PATCH='''    course = await get_course_or_404(db, course_id, user_id=user.id)
    from models.practice import PracticeProblem as MasteryPracticeProblem
    from mastery_ext.engine import forget_course
    owned = await db.execute(select(MasteryPracticeProblem.id).where(MasteryPracticeProblem.course_id == course_id))
    owned_problem_ids = [str(r[0]) for r in owned.all()]
    # Privacy first: delete extension history before OpenTutor destroys the
    # authoritative course, so failed purges cannot silently leave orphans.
    forget_course(str(user.id), str(course_id), owned_problem_ids)
    await db.delete(course)
    await db.commit()'''
FONT_IMPORT='import { Space_Grotesk } from "next/font/google";\n'
FONT_CONFIG='''const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

'''
FONT_CLASS='className={spaceGrotesk.variable}'
FONT_CSS_ANCHOR=':root {\n  --font-geist-sans: var(--font-space-grotesk), '
FONT_CSS_PATCH=':root {\n  --font-space-grotesk: "Avenir Next", system-ui, sans-serif;\n  --font-geist-sans: var(--font-space-grotesk), '
FASTSETUP_ANCHOR='log "  Installing Python dependencies ..."\n"${PIP_BIN}" install -q -r "${API_DIR}/requirements-core.txt"\nlog "  Done"'
WEB_BIND_ANCHOR='npx next dev --port "${WEB_PORT}"'
WEB_BIND_PATCH='npx next dev --hostname 127.0.0.1 --port "${WEB_PORT}"'
FASTSETUP_PATCH='''if [[ ! -f "${VENV_DIR}/.mastery-core-ready" || "${API_DIR}/requirements-core.txt" -nt "${VENV_DIR}/.mastery-core-ready" ]]; then
  log "  Installing Python dependencies (first setup needs internet) ..."
  "${PIP_BIN}" install -q -r "${API_DIR}/requirements-core.txt"
  touch "${VENV_DIR}/.mastery-core-ready"
else
  log "  Installed Python dependencies found; no internet required"
fi
log "  Done"'''


def apply(target:Path):
    if not (target/'apps/api/main.py').is_file() or not (target/'apps/web/package.json').is_file():
        raise RuntimeError('Expected an OpenTutor source checkout, not an arbitrary directory')
    rules=[
        ('apps/api/services/router_registry.py',ROUTER_ANCHOR,ROUTER_PATCH),
        ('apps/api/routers/quiz_submission.py',SUBMISSION_ANCHOR,SUBMISSION_PATCH),
        ('apps/api/routers/quiz_submission.py',CLASSIFIER_ANCHOR,CLASSIFIER_PATCH),
        ('apps/api/routers/courses_crud.py',DELETE_COURSE_ANCHOR,DELETE_COURSE_PATCH),
        ('apps/api/schemas/quiz.py',RESPONSE_SCHEMA_ANCHOR,RESPONSE_SCHEMA_PATCH),
        ('apps/api/routers/quiz_submission.py',RESPONSE_ID_ANCHOR,RESPONSE_ID_PATCH),
        ('apps/web/src/app/_components/dashboard-sidebar.tsx',SIDEBAR_ANCHOR,SIDEBAR_PATCH),
        ('apps/web/next.config.ts',WEB_COURSE_ANCHOR,WEB_COURSE_PATCH),
        ('apps/web/src/app/layout.tsx',FONT_IMPORT,''),
        ('apps/web/src/app/layout.tsx',FONT_CONFIG,''),
        ('apps/web/src/app/layout.tsx',FONT_CLASS,'className="font-sans"'),
        ('apps/web/src/app/globals.css',FONT_CSS_ANCHOR,FONT_CSS_PATCH),
        ('scripts/quickstart.sh',FASTSETUP_ANCHOR,FASTSETUP_PATCH),
        ('scripts/quickstart.sh',WEB_BIND_ANCHOR,WEB_BIND_PATCH),
    ]
    # All modifications calculated in-memory and validated before ANY mutation.
    originals={};staged={}
    for relative,old,new in rules:
        path=target/relative
        if path not in originals:
            originals[path]=path.read_text()
            staged[path]=originals[path]
        src=staged[path]
        if new and new in src:
            continue
        elif old in src:
            if src.count(old)!=1:raise RuntimeError(f'Ambiguous upstream anchor: {path}')
            staged[path]=src.replace(old,new)
        elif not new and old not in src:
            continue
        else:
            raise RuntimeError(f'Compatibility check failed: {path} (anchor not found)')
    overlay=ROOT/'overlay'
    copy_files=[p for p in overlay.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc']
    for p in copy_files:
        dest=target/p.relative_to(overlay)
        # Existing extension files can be updated, but unrelated files cannot.
        ours=('mastery_ext' in dest.parts or '/src/app/mastery/' in str(dest))
        if dest.exists() and dest.read_bytes()!=p.read_bytes() and not ours:
            raise RuntimeError(f'Would overwrite unrelated file: {dest}')
    for path,new in staged.items():
        if originals[path]!=new:
            backup=path.with_suffix(path.suffix+'.mastery-backup')
            if not backup.exists():backup.write_text(originals[path])
            path.write_text(new)
            print('Patched:',path)
    for p in copy_files:
        dest=target/p.relative_to(overlay)
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dest)
        print('Installed:',dest)
    print('Mastery Engine offline extension installed')


if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/apply_overlay.py /path/to/OpenTutor')
    apply(Path(sys.argv[1]).expanduser().resolve())
