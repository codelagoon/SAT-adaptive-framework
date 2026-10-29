# StudyOS additions to the current Tenet work

Added October 29, 2026, at the user's instruction to add these requirements to the current project. These extend the existing Tenet handoff and acceptance inventory; they do not replace them or restart implementation.

## Continue from the verified implementation

Continue on `codex/tenet-integrated`, preserving the Mac foundation, installer, native runtime, learning records, original worksheet/document support, and existing release gates. Application code last fully verified before this documentation addition is `a40b32ec2b6893678636e9ce9596288abdf5f41b`; see `STATUS.md` for exact evidence and limitations.

Older branch names inside the supplied documents describe earlier project states. They do not authorize reverting to those states. Retain the current Neutral Ink design and add the requested light theme alongside its dark theme.

## Locally supplied inputs

The complete package and separately supplied prompt are staged under the ignored directory `private/studyos/2026-10-29/`:

- `George_StudyOS_Codex_Prompt.md`: the additional implementation brief.
- `package/README.md`, `package/spec/`: import, selection, scheduling, content, theme, and acceptance specifications.
- `package/profile/`: the learner/course/evidence/event model and selection policy.
- `package/sources/`: original workbook and supporting school/course records.
- `input-receipt.json`: local integrity and staging receipt.

This repository is public. Keep learner records, grade/score history, the workbook, teacher materials, and the complete prompts local. Do not add their contents to public commits, CI artifacts, or logs. Public documentation records requirements rather than the supplied personal evidence.

## Additional acceptance requirements

1. Import the complete course/topic/evidence model with stable IDs and provenance. Preview and reconcile changes, back up existing databases, deduplicate historical evidence, and preserve newer attempts and edits. Historical scores, grades, estimates, prepared exercises, and aggregate results must retain their distinct meanings; do not manufacture independent attempts or proficiency.
2. Make Home practice/review/resume/recommendation actions construct or resume a specific persisted question set and open its first unanswered item directly in Solve. Keep Question Bank available through manual navigation. Failed retrieval can branch to the relevant lesson and return to a fresh independent item.
3. Add configurable study-day plans and assessment-driven school sets from the private policy and verified current evidence. Refresh assessment dates only from authorized sources; retain as-of dates and uncertainty when refresh is unavailable. Do not infer completion or current deadlines from old snapshots.
4. Use deterministic, auditable, curriculum- and assessment-aware selection over validated available items. Preserve assistance/independence separation, family deduplication, pacing, spaced review, and dynamic session selection. Demonstrate behavior with adversarial tests and supply-shortage handling.
5. Make the full supplied course catalog navigable, searchable, and structured by module. Topic seeds are not published lessons. Publish lessons only with verified suitable video/source references, original explanations, worked examples, and independent checks; surface honest pending states when content is unavailable. Preserve teacher-upload extension workflows and source/license constraints.
6. Implement both themes completely. The light theme must be predominantly white across the shell, controls, dropdowns, overlays, feedback, graphs, calculator/video wrappers, and all routes, with verified contrast and screenshots. Preserve the functional dark theme and current information architecture.
7. Add plan/session, import reconciliation, deep-link, persistence/resume, selection, content/source, and theme acceptance tests. Verify real Home-to-Solve journeys and the native M1/offline experience. Existing installer/signature, user/course isolation, migration, signing/notarization, and update gates still apply.

These are added requirements, not claims of implemented or verified behavior. Keep continuing progress and the next concrete action in `STATUS.md`.
