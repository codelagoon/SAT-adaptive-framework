# Research and measurement notes

## Implemented decisions

- **Retrieval with immediate corrective feedback.** The app shows feedback after a committed response, preserving retrieval effort while correcting errors quickly. Measure: accuracy and latency on later isomorphic attempts.
- **Confidence judgment after every response.** Calibration is stored as the distance between stated certainty and correctness. Measure: Brier-like calibration and high-confidence error rate.
- **Adaptive challenge.** Difficulty rises only after repeated strong evidence and falls after weak evidence. This conservative heuristic avoids oscillation. Measure: mastery gain per study minute and target success rate by level.
- **Error attribution.** Incorrect responses require a learner-selected cause. These labels are hypotheses, not objective diagnoses. Measure: recurrence of each label and later response to targeted interventions.
- **Minimal results.** The dashboard exposes learning evidence and one next action, not engagement counters. Measure: time from feedback to next productive retrieval.

## Evidence base

- Test-enhanced learning / retrieval practice: Roediger & Karpicke (2006).
- Feedback timing and content: Hattie & Timperley (2007); Butler & Roediger (2008).
- Metacognitive monitoring and judgments of learning: Dunlosky & Metcalfe (2009).
- Desirable difficulties and interleaving: Bjork & Bjork (2011); Rohrer (2012).
- Cognitive load and interface restraint: Sweller (1988); Mayer (2009).

## Explicit assumptions and limitations

- The mastery update is a transparent exponentially weighted heuristic, not calibrated IRT. Its score must not be interpreted as a probability until validated.
- Estimated SAT scores are intentionally not displayed yet. A score without representative content and empirical calibration would create false precision.
- Self-reported error classes can be biased. Preserve raw response, timing, and confidence so later models can reassess them.
- Browser local storage is a temporary MVP persistence layer. IndexedDB with migrations, checksums, export, and recovery is required before high-volume daily use.
- Desmos state persistence is limited by cross-origin embed constraints; a production integration needs the official calculator API and permitted offline behavior.

## Quality gate checklist

Each new feature must state: learning hypothesis, primary metric, failure mode, removal criterion, accessibility behavior, storage migration, and tests.
