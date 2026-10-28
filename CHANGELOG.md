# Version 0.7.0 cloud-build kit

- Added self-contained M1 DMG build script (bundled Python, Node, OpenTutor).
- Added GitHub Actions macOS M1 workflow with real HTTP grading/cleanup smoke test.
- Added portable runtime script with no end-user installation steps.
- Added 5 automated portable packaging tests; total local suite 84 passing.
- IMPORTANT: No Mac CI build has completed yet. There is no prebuilt DMG in this ZIP.

---

## v0.6.1 — installation fix

- Fixed Mac install script Bash syntax (extra `fi`).
- Added automated shell syntax regression check.

## v0.6 — M1 launch safety, portable CLI installation and deletion cleanup (Oct 27, 2026)

- Builds on the existing v0.5 learning-quality changes: authored ACT Reading pool expanded to 62; distinct SAT Reading & Writing authored exercises now 102, in addition to local grammar drills; added separated prerequisite probes with answer keys hidden until an original mistake.
- Pin new OpenTutor installs to an upstream commit whose integration anchors were checked against GitHub; preserve older checkouts and fail closed if incompatible.
- Replace shell-executed `.env` parsing with data-only `python-dotenv` parsing. Both services bind to localhost. Startup refuses occupied ports and requires real API + Mastery health through the production frontend before signaling ready.
- Native Swift app checks JSON from the Mastery Engine API, not an arbitrary HTTP 200 from another process.
- Add live Bash launch tests with real local child HTTP processes; test clean termination, occupied ports, and hostile `.env` metacharacters without running OpenTutor itself.
- Deleting a course now erases per-user per-course extension data (attempts, mastery, graph edges, propositions, diagnostic probes and repair queue, plus known prepared contexts) before the upstream course is destroyed.
- Install optional DeepTutor CLI-only package from v1.6.15; pin its runtime home and keep model usage optional.
- Add Mac-only end-to-end smoke script exercising the full grade/diagnosis/cleanup cycle; it still requires a real Mac run to satisfy the release gate.
- **78 automated Python tests passing** on Linux. MacOS native compilation and full-stack OpenTutor start remain unverified.

# Changelog

## v0.4 — Core quality corrections (Oct 27, 2026)

Changes prompted by the realization that passing unit tests was not a substitute for a complete learning loop:

- Adaptive selector allocates 3/5 challenge slots to due reviews where available, instead of allowing new questions to starve memory work.
- After a miss, automatically choose the simplest available repair for that skill; a successful repair triggers the hardest available transfer; a failed transfer returns to repair.
- Do not claim a question is simpler/harder when the bank cannot supply one. Learners can skip repair while keeping review debt and attempt history.
- Add answer-specific, *tentative* misconception prompts matched to constructed distractors; expose them only after a submitted answer.
- Add graduated retention scheduling and backward-compatible database migration; do not claim the BKT estimates or schedule are psychometrically calibrated.
- Prevent arbitrary unrelated OpenTutor courses from being seeded with SAT Math. Offline practice only selects known local bank items, never questions that would invoke the LLM grading path.
- Move Python/npm installs and the production frontend build into the Mac installer. Finder launch runs prebuilt local services, never `next dev`, pip, npm, Git, or network downloads.
- Add adversarial tests for due-review starvation, remediation progression, invalid modes, database migration, skipped repair, and Mac launch boundaries.

**Not yet passed:** Complete real M1 cold/offline build, full-stack browser tests, editorial review across the bank, full authentic exam simulations, and calibration. This is an integration alpha.
