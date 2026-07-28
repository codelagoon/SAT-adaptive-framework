# Phase 2 intelligence contracts

This layer is exam-agnostic. Content supplies concepts, relationships, templates, representations, and item metadata; the learning system consumes evidence and returns beliefs and ranked candidates.

## Probabilistic mastery and retention

`memory.ts` maintains a bounded mean and variance per concept, a 95% interval, stability, an exponential retention estimate, trends, exposure count, difficulty ceiling, and representation coverage. Correctness is the primary observation; confidence changes evidence reliability and response time is bounded so speed cannot overwhelm accuracy.

This is a Bayesian-inspired filter, not BKT or IRT calibration. It is intentionally inspectable and cold-start capable. A production model should fit transition, slip, guess, item difficulty, and discrimination parameters against longitudinal response data, then compare held-out log loss and calibration error.

Basis: Corbett & Anderson (1994) for knowledge tracing; van der Linden & Hambleton (1997) for IRT/CAT; Pavlik & Anderson (2008) and Bjork & Bjork (2011) for practice and retention.

## Candidate selection

`selection.ts` ranks every candidate using expected challenge, uncertainty/information value, retention need, representation novelty, recent diversity, content frequency, and fatigue. The target success probability is approximately 0.72: demanding enough for retrieval without routinely producing failure. Weights are declared rather than hidden and must be experimentally calibrated.

Offline evaluation: replay historical streams and measure next-response log loss, concept coverage, repetition rate, and counterfactual policy estimates. Online outcome: delayed isomorphic accuracy and mastery gain per minute—not session length.

## Knowledge graph propagation

`graph.ts` sends only 8% of evidence to prerequisites and 5% to children while increasing uncertainty. This is deliberately conservative: related performance is weak evidence, not proof. Negative evidence follows the same direction. Edge-specific learned transfer coefficients are the future replacement.

## Confidence and error intelligence

`calibration.ts` reports Brier score, signed overconfidence, high-confidence errors, lucky correct answers, and recurring classified errors. Self-classification remains a hypothesis. Raw response evidence is never overwritten.

## Question validation

`validation.ts` rejects empty content, missing mappings, duplicate choices, absent correct choices, and non-four-option multiple-choice items. Domain generators must add mathematical invariants and ambiguity tests. Generated-item property tests should run thousands of seeds before a template ships.

## Score prediction boundary

The app must not show a numeric SAT prediction until a representative, linked calibration dataset exists. Required minimum contract:

1. Fit domain ability to official-style item outcomes with difficulty and discrimination.
2. Map ability to section scores using a documented concordance procedure.
3. Validate out-of-sample MAE, interval coverage, subgroup calibration, and temporal drift.
4. Label uncertainty and effective sample size in the UI.

Until then, concept mastery, retention, latency, and confidence calibration are actionable; a score would be false precision.
