# Phase 3 research and validation protocol

Phase 3 treats every adaptive rule as a falsifiable policy, not a product claim. A model may influence practice only when its inputs, outputs, uncertainty, version, and outcome measure are recorded locally.

## Experiment contract

Experiments must declare in advance:

- a learning hypothesis and plausible harm;
- deterministic assignment unit (learner, concept, or session);
- control and treatment policies;
- primary delayed outcome and minimum retention interval;
- guardrails for frustration, time, and accessibility;
- exclusion and stopping rules;
- analysis method and minimum sample requirement.

The default outcome is delayed isomorphic accuracy per minute. Same-session accuracy is diagnostic, not proof of learning. Confidence calibration, latency, retention, and transfer are secondary outcomes. Engagement is never the primary outcome.

Single-user experiments should prefer within-learner, counterbalanced concept assignment because a conventional between-person A/B test is impossible. Results must be labeled exploratory until replicated with adequate learners and items.

## Evidence informing the protocol

- Retrieval can improve later recall, but the best expanding or uniform spacing depends on interference and retention conditions: Storm, Bjork, & Storm (2010), [DOI 10.3758/MC.38.2.244](https://doi.org/10.3758/MC.38.2.244).
- Large-scale observational evidence indicates that optimal spacing grows with the desired retention interval: Cepeda et al.-related real-world analysis, [PMID 30623389](https://pubmed.ncbi.nlm.nih.gov/30623389/).
- A randomized spaced-repetition study prioritized confidently incorrect answers and measured retention and transfer, supporting confidence as a scheduling signal rather than a decorative prompt: [PMID 39250798](https://pubmed.ncbi.nlm.nih.gov/39250798/).
- Interleaved mathematics practice can lower practice performance while improving later discrimination and test performance. The product must therefore avoid optimizing same-session success: Rohrer & Taylor evidence summarized in [ERIC ED536926](https://files.eric.ed.gov/fulltext/ED536926.pdf).
- Constrained CAT maximizes information while enforcing content constraints, motivating a selection objective that combines information with coverage rather than selecting only the locally most difficult item: van der Linden & Reese (1998), [University of Twente record](https://research.utwente.nl/en/publications/a-model-for-optimal-constrained-adaptive-testing-2/).
- Automatic item generation still requires psychometric calibration; structural correctness alone does not establish difficulty or discrimination: Arendasy & Sommer (2012), [DOI 10.1016/j.lindif.2011.11.005](https://doi.org/10.1016/j.lindif.2011.11.005).

## Validation hierarchy

1. **Invariant tests:** bounds, monotonicity, determinism, data integrity, and question constraints.
2. **Simulation:** recovery of known mastery, forgetting, difficulty, and discrimination parameters.
3. **Replay:** next-response prediction and policy behavior on held-out historical sequences.
4. **N-of-1 exploration:** counterbalanced concepts and delayed isomorphic outcomes for one learner.
5. **Multi-learner study:** preregistered analysis, subgroup calibration, attrition analysis, and interval coverage.

No layer may be skipped when making a stronger claim. A green unit test means the algorithm follows its contract; it does not mean the algorithm improves SAT scores.

## AI boundary

AI may propose items, explanations, solution paths, or error labels. Deterministic validation remains mandatory, and AI output is rejected unless it conforms to a versioned schema and all applicable invariants. Mathematical equivalence should be checked symbolically or numerically over a declared domain. Ambiguity and SAT style still require audited human samples. Raw student data is local by default and must not be transmitted without explicit opt-in.

## Score prediction boundary

A score interval is eligible for display only after out-of-sample validation reports mean absolute error, empirical 95% interval coverage, subgroup calibration, item-bank coverage, and drift. Until then, the interface exposes actionable mastery and uncertainty without manufacturing a score.
