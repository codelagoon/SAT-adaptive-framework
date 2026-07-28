# Phase completion matrix

Status values: **done** = implemented and executed; **partial** = implemented with a documented gap or an unavailable full-stack gate; **open** = not yet implemented.

## Phase 1

| Requirement | Status | Evidence / remaining gate |
|---|---|---|
| Next.js, TypeScript, Tailwind architecture | partial | Source complete; npm registry currently blocks dependency install and production build. |
| Local database and progress integrity | done | IndexedDB snapshot, local cache, schema version, import/export, legacy migration, and validated local question library. |
| Offline-first | partial | Service-worker app shell exists; browser offline test awaits full build. Desmos necessarily requires its external resource. |
| Keyboard and theme | done | Answer keys, Enter, pause, calculator, persisted dark/light theme. |
| Procedural question engine | done | 56 original reusable templates cover all 47 graph concepts; seeded structural and semantic property tests pass. |
| MCQ, numeric, grid-in, SAT format, LaTeX | done | All input modes represented; normalized fraction/decimal comparison and KaTeX component. |
| Adaptive Rush modes | done | 10/20/40/unlimited, pause-aware timer, adaptive policy, one-at-a-time flow, sessions. |
| Mastery and confidence evidence | done | Attempts, accuracy, time, confidence calibration, timestamps, ceiling, error history. |
| Immediate review | done | Correct answer, concise explanation, distractor reasons, alternate and calculator methods where applicable. |
| Error classification | done | Required on every incorrect answer before continuing. |
| SAT knowledge graph | done | All eight content areas and 47 granular nodes; the executable coverage audit has no missing or unknown concept mappings. |
| Results and next action | partial | Core outcomes and diagnostic next action exist; domain score withheld pending calibration. |
| Desmos experience | partial | Persistent visibility, resizable embed, shortcut, and usage time; graph-state API integration remains. |
| Review filters and active redo | done | Outcome, slow, confidence, concept, difficulty, date/natural-language search, plus one-click measured redo sessions. |
| Automated quality gates | partial | 47 dependency-free engine/content/performance tests pass; Next build, component, E2E, accessibility, and offline browser gates remain blocked by unavailable npm packages. |

## Phase 2

| Requirement | Status | Evidence / remaining gate |
|---|---|---|
| Probabilistic concept mastery | done | Mean, variance, 95% interval, trends, velocity, retention, stability, exposures, ceiling, representations. |
| Overall/domain ability | done | Coverage-aware aggregation with uncertainty is implemented and tested. |
| Knowledge graph propagation | done | Conservative bidirectional transfer with increased uncertainty and executable tests. |
| Learning-value question selection | done | Challenge, information, retention, novelty, diversity, frequency, and fatigue terms. |
| Spacing and interleaving | partial | Retention due dates and recent-concept/representation penalties integrated; scheduler analytics expanding. |
| Isomorphic generation and representations | done | Procedural families span seven representations and every graph concept; ship gate passes. |
| Template calibration | partial | Observation aggregation and provisional/release gates exist; real response volume remains required. |
| Error and confidence intelligence | done | Recurrence, Brier-style error, overconfidence, lucky/high-confidence classifications. |
| Learning analytics and heatmaps | done | Concept heatmap, uncertainty, distributions, velocity, error, confidence, calculator, and timeline summaries exist. |
| SAT score with valid interval | open | Intentionally gated until representative calibration data and out-of-sample validation exist. |
| Intelligent active review | done | Retrieval policy prioritizes retention and the filtered review UX launches measured redo sessions directly. |
| Desmos intelligence | partial | Usage duration captured; efficiency comparison and recommendation model remain. |
| Session intelligence | partial | Accuracy, latency, confidence errors, slow-correct and next action; gain/forgetting summaries expanding. |
| Question quality system | partial | Structural validator plus seeded property tests; semantic/math invariants expanding. |
| Research layer | done | Algorithm rationale, testable experiment contracts, durable local research ledger, delayed probes, and bounded outcome validation exist. |
| Performance and extensibility | partial | Exam-agnostic intelligence contracts and local computation; profiling awaits runnable build. |

This matrix is deliberately conservative. A feature is not marked done merely because an interface or placeholder exists.

## Phase 3 foundations

| Requirement | Status | Evidence / remaining gate |
|---|---|---|
| Learning experiments | partial | Deterministic assignment, durable enrollment/outcome ledger, delayed probes, and analysis contracts pass tests; real counterbalanced studies remain. |
| Question-quality AI | partial | Fail-closed deterministic validator and replaceable AI adapter contract exist; reviewed local model is not bundled. |
| Multiple solutions and explainability | partial | Verifiable contracts exist; not all 56 templates carry multiple complete solution paths. |
| Personalized profile | done | Repeatable, minimum-sample-gated strengths, weaknesses, patterns, and calibration signals. |
| Dependency analysis | done | Conservative propagation and visible prerequisite relationships with uncertainty. |
| Mastery certification | done | Accuracy, speed, calibration, representation, difficulty, retention, attempts, and recent-failure gates with decay. |
| Smart review and fatigue | done | Expected return-per-minute ranking and conservative within-session deterioration detection. |
| Replay, search, professional analytics | partial | Replay, natural filters, heatmap/distributions/calculator/error summaries exist; historical score remains calibration-gated. |
| Full Desmos integration | partial | Visibility and time telemetry exist; expression-level API events and strategy curriculum remain. |
| Accessibility and performance | partial | Keyboard, screen-reader status, contrast preferences, font scaling, reduced motion, local computation; browser audits/profiling await the full build. |
| Documentation and modularity | done | Phase-specific research contracts and replaceable core/intelligence/research/analytics/explanation modules. |
