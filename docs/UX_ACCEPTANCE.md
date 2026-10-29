# Mastery Engine — UX architecture and acceptance contract

**Status:** Reference design and API contract, not a production-mounted UI. The interactive reference `design/mastery_reference.html` uses illustrative data; its real browser QA is separate from Next/OpenTutor and Cocoa/WebKit QA.

## Information architecture (OnePrep-shaped, original execution)

- **Home / Planner**: one explicit next action, resume active session, due review count, study plan; no question-bank clutter, no unsolicited tutorial.
- **Learn / Masterclass**: track → domain → skill → lesson → worked example → self-explanation → separate Solve handoff. Lessons have course identity and must render offline. A lesson is not a graded attempt.
- **Question Bank**: source, subject, domain, skill, difficulty, keyword, unseen/attempted/bookmarked, and family selectors; show licensing/difficulty honesty. Select a question to enter Solve. Never reveal solution/answer key in listings or pre-submit API.
- **Solve**: a focus mode with one current question, answer choices or free input, optional reference pane/graph, Desmos in authorized online modes, local graphing fallback/offline message, scratchpad, bookmark, controlled hint, submit, diagnosis and independent repair. Keyboard: Tab focus, A–D choices where appropriate, Enter to submit only when safe. Hints mark the current attempt assisted, with server-side durable audit.
- **Tests**: authentic timed practice blueprint when ready, no hints while clock runs, explicit pause/break rules, answer review only after submission, accessibility; **do not** claim existing bank is a calibrated SAT/ACT exam or produce scaled scores from raw accuracy.
- **Analytics / Review**: separate dashboards for new independent, assisted, repeated, missing provenance; skill × source × difficulty, attempt history, response time, review due, delayed transfer, sample-size and uncertainty labels. Every chart answers what happened, why it matters, and next independent check. No invented numeric trends.

## Shared interaction contracts

1. Navigation changes the entire primary workspace, not stacked cards on one screen. Persist track/course choice across page transitions.
2. Solving a selected bank question opens that *exact* ID; never silently switch to the next recommended question.
3. A question draft autosaves independently of attempts. Reloading restores its answer; submission removes the draft only after grading succeeds, not before. Bookmark and draft records are user/course/problem scoped.
4. Help clicked before submission must mark assistance even if the user later hides the hint. Assisted correct answers must not promote independent mastery or clear review debt.
5. Unknown difficulty is shown as unknown; original question family variants are not automatically treated as unfamiliar transfer questions.
6. Native app must use the actual authenticated `/mastery/*` API and OpenTutor `/quiz/submit`; reference HTML example data must never become production UI metrics.
7. Offer clear empty/no-data/offline/error/loading/resuming states. Do not display false zeros in lieu of unknown rates.
8. Accessible contrast, 44px-ish touch targets on mobile, visible focus, semantic labels, keyboard operation, reduced-motion preference. Test at 1440, 960, 390 widths plus M1 app dimensions.

## Current implementation hooks (source patch)

- `GET /mastery/courses/{course_id}/curriculum` → structured domains, lessons, prerequisites.
- `GET /mastery/courses/{course_id}/diagnostic?size=12` → one problem per available skill/domain, answer withheld.
- `GET /mastery/courses/{course_id}/questions?...` → source-safe browse with query, skill, difficulty, seen status, bookmark status.
- `GET /mastery/courses/{course_id}/questions/{problem_id}` → one public question for Solve.
- `PUT /mastery/courses/{course_id}/questions/{problem_id}/bookmark` → saved bool.
- `PUT/GET /mastery/courses/{course_id}/questions/{problem_id}/draft` → autosave without grading.
- `POST /mastery/prepare` with `assisted:true|false` → grade metadata; must be sent before `/quiz/submit`.
- `GET /mastery/courses/{course_id}/analytics` → audited independent/assisted/repeated events.
- `GET /mastery/courses/{course_id}/study-plan?minutes=20` → bounded, explainable suggested learning sequence.
- `GET /mastery/courses/{course_id}/question-audit` → structural errors and provenance warnings.

**Crucial integration:** The reference design does not yet replace the legacy combined `/mastery` page. Implement it in independent Next routes, connect live APIs, preserve existing Debate Prep and worksheet workflows, and run full production TypeScript/build + interactive Playwright checks before switching the default link. Avoid replacing a working screen with a mockup.

## Browser QA already performed

`python -m pytest visual_tests/test_visual_reference.py -q`: page navigation, separate workspace visibility, question bank filtering, solving, hint and next-question flow, lesson navigation, and horizontal overflow for 1440×900, 960×900 and 390×844. Screenshots live in `design/qa_*.png` and represent the *reference only*.

## Remaining release evidence

Real Next/OpenTutor screenshots; actual database-backed filter/solve/draft/analytics flow on Mac; source/credential safety; built-in Desmos with offline fallback; screen-reader and keyboard accessibility sweep; signed notarized install and updater verification. None of these is proven by a browser preview.

## 28 October — production route implementation (unmerged source)

The local source now contains *actual* Next routes at `/mastery`, `/mastery/learn`,
`/mastery/bank`, `/mastery/solve`, `/mastery/tests`, and `/mastery/analytics`,
plus the preserved combined screen at `/mastery/legacy`. Unlike the reference,
these routes call authenticated `/mastery/*` and `/quiz/submit` APIs. They expose
course selection, lesson navigation, searchable/expandable bank, draft autosave,
bookmarks, logged assistance, answer submission, diagnostic probes, online Desmos
iframe (availability **not yet verified**), first-attempt analytics and a truthful
practice-tests scope notice.

`tests/test_actual_ui_architecture.py` and
`tests/test_production_workspace_contract.py` are **source checks only**.
`visual_tests/test_live_next_ui.py` is a reproducible *real-app* screenshot test,
but requires a local test installation and disposable authenticated account.
It must be run and pass before the Next UI is claimed integrated or released.

Backend hint provenance is also persisted independently of client flags:
viewing question-specific help stores a scoped `hint_exposures` event and any
subsequent answer to that item remains assisted. Course deletion purges exposure
records only for that learner/course. Repeated help cannot inflate mastery.

**Important:** This source is based on the v0.9 Library snapshot, whose file
hashes differ from the GitHub `codex/mac-release-foundation` branch. Reconcile
edited existing backend/frontend files with the current branch rather than blindly
applying a wholesale patch. Protect the verified Mac release pipeline.
