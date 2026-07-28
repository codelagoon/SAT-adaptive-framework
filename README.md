# Precision SAT

A local-first adaptive SAT practice instrument. The primary loop is: select a weak concept, generate an isomorphic item, capture time and confidence, correct immediately, classify misses, and update mastery.

## Run

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Progress is stored in a versioned IndexedDB snapshot with a local-storage fallback and portable JSON import/export. The calculator embed requires internet; generated and locally imported practice remains local-first.

## Implemented core

- 56 original procedural templates covering all 47 concepts in the eight Digital SAT content areas
- Multiple-choice, numeric, and grid-in responses with LaTeX rendering and SAT-style numeric equivalence
- Adaptive 10/20/40/unlimited Rush sessions, confidence capture, required error classification, immediate feedback, and focused redo
- Probabilistic mastery, retention scheduling, knowledge-graph propagation, fatigue detection, smart review, analytics, and replay
- Deterministic experiment assignment, a durable research ledger, question-quality gates, and calibration fitting with a held-out validation set
- Offline app shell, keyboard operation, themes, font scaling, reduced-motion support, local progress ownership, and an on-device importer with native OpenSAT/PineSAT JSON conversion

## Boundaries

Official College Board questions are not copied into the repository. Authorized question files can be imported into the on-device library and practiced as complete Rush sessions; their provenance and local-only license scope are preserved. Score prediction remains intentionally unavailable until a representative real-world calibration sample passes the documented out-of-sample gate.

Run the dependency-free engine/content gate with `npm run test:core`. See the completion matrix for build and browser gates that still require installed third-party packages.

See `docs/RESEARCH.md` for Phase 1 rationale, `docs/PHASE_2_INTELLIGENCE.md` for intelligence contracts, `docs/PHASE_3_RESEARCH.md` for the validation protocol, `docs/COMPLETION_MATRIX.md` for honest status, and `docs/HANDOFF.md` for verification and Git instructions.
