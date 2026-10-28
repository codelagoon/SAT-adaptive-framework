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
