import test from "node:test";
import assert from "node:assert/strict";
import {assignExperimentArm, learningEfficiencyIndex, measureExperiment} from "../src/research/experiments.ts";
import {certifyMastery, decayedRetention} from "../src/research/mastery-certification.ts";
import {buildLearningProfile} from "../src/analytics/profile.ts";
import {rankSmartReview} from "../src/analytics/review.ts";
import {detectPerformanceDecay} from "../src/analytics/fatigue.ts";
import {buildSessionReplay} from "../src/analytics/replay.ts";
import {calculatorAnalytics, categoricalDistribution, conceptHeatmap, masteryTimeline, timeDistribution} from "../src/analytics/aggregations.ts";
import {validateExplanation, verifySolutionPaths} from "../src/explanation/contracts.ts";
import {DeterministicQualityValidator, validateWithAll} from "../src/explanation/quality-validator.ts";

test("experiment assignment is stable and measurements remain bounded", () => {
  const experiment = {id: "spacing-v1", arms: [{id: "control", weight: 1}, {id: "spacing", weight: 1}]};
  const first = assignExperimentArm(experiment, "learner-17");
  assert.equal(assignExperimentArm(experiment, "learner-17"), first);
  const measured = measureExperiment([
    {learnerId: "a", armId: "control", observedAt: "2026-01-01", retention: 0.6, accuracy: 0.7, meanSolveTimeMs: 60_000, confidenceCalibration: 0.8, mastery: 0.7},
    {learnerId: "b", armId: "control", observedAt: "2026-01-02", retention: 0.8, accuracy: 0.9, meanSolveTimeMs: 30_000, confidenceCalibration: 0.6, mastery: 0.9},
  ])[0];
  assert.equal(measured.sampleSize, 2);
  assert.equal(measured.retention, 0.7);
  assert.ok(learningEfficiencyIndex(measured) >= 0 && learningEfficiencyIndex(measured) <= 1);
});

test("mastery certification requires broad current evidence and decays", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  const evidence = {accuracy: 0.92, speedRatio: 0.8, confidenceCalibration: 0.9, representationCount: 4, difficultyReached: 4, retention: 0.95, recentFailures: 0, successfulAttempts: 10, lastSuccessfulAt: now.toISOString()};
  assert.equal(certifyMastery(evidence, now).certified, true);
  assert.ok(decayedRetention(1, "2026-01-15T00:00:00Z", now, 45) <= 0.5);
  assert.equal(certifyMastery({...evidence, recentFailures: 1}, now).unmet.includes("recent failures"), true);
});

test("learning profile reports only repeatable actionable observations", () => {
  const rows = [0, 1, 2].flatMap((index) => [
    {conceptId: "algebra", representation: "equation", correct: true, elapsedMs: 30_000, expectedMs: 60_000, confidence: 0.9},
    {conceptId: "geometry", representation: "diagram", correct: false, elapsedMs: 90_000, expectedMs: 60_000, confidence: 0.9, errorKind: "Time pressure"},
  ]);
  const profile = buildLearningProfile(rows);
  assert.deepEqual(profile.strengths, ["algebra"]);
  assert.deepEqual(profile.weaknesses, ["geometry"]);
  assert.ok(profile.patterns.includes("Overconfident on repeated errors"));
});

test("smart review prioritizes expected learning return per minute", () => {
  const ranked = rankSmartReview([
    {conceptId: "low-return", currentMastery: 0.2, retention: 0.3, masteryThreshold: 0.85, downstreamDependents: 0, examFrequency: 0.2, expectedGain: 1, expectedMinutes: 20},
    {conceptId: "high-return", currentMastery: 0.8, retention: 0.6, masteryThreshold: 0.85, downstreamDependents: 4, examFrequency: 0.9, expectedGain: 5, expectedMinutes: 5},
  ]);
  assert.equal(ranked[0].conceptId, "high-return");
  assert.ok(ranked[0].reasons.includes("close to mastery"));
});

test("fatigue detector requires simultaneous accuracy and speed decay", () => {
  const early = Array.from({length: 5}, () => ({correct: true, elapsedMs: 30_000}));
  const late = Array.from({length: 5}, () => ({correct: false, elapsedMs: 45_000}));
  const result = detectPerformanceDecay([...early, ...late]);
  assert.equal(result.detected, true);
  assert.equal(result.recommendation, "end-session");
  assert.equal(detectPerformanceDecay(early).confidence, "insufficient");
});

test("session replay is stable, chronological, and relative", () => {
  const frames = buildSessionReplay([
    {id: "b", sessionId: "s", at: "2026-01-01T00:00:02Z", kind: "answer-submitted", payload: {}},
    {id: "a", sessionId: "s", at: "2026-01-01T00:00:00Z", kind: "question-presented", payload: {}},
  ]);
  assert.deepEqual(frames.map((frame) => frame.offsetMs), [0, 2000]);
  assert.equal(frames[0].event.id, "a");
});

test("professional analytics aggregate concepts, distributions, calculator use, and timeline", () => {
  const attempts = [
    {conceptId: "linear", at: "2026-01-01T10:00:00Z", correct: true, elapsedMs: 20_000, confidence: 0.8, difficulty: 2, representation: "equation", masteryBefore: 0.4, masteryAfter: 0.5, calculatorUsed: false},
    {conceptId: "linear", at: "2026-01-02T10:00:00Z", correct: false, elapsedMs: 80_000, confidence: 0.9, difficulty: 3, representation: "word", masteryBefore: 0.5, masteryAfter: 0.45, calculatorUsed: true, errorKind: "Misread"},
  ];
  assert.equal(conceptHeatmap(attempts)[0].accuracy, 0.5);
  assert.deepEqual(timeDistribution(attempts).map((bin) => bin.count), [1, 0, 1, 0]);
  assert.equal(categoricalDistribution(attempts, "representation").length, 2);
  assert.equal(calculatorAnalytics(attempts).usageRate, 0.5);
  assert.equal(masteryTimeline(attempts).length, 2);
});

test("solution verification and explanation contracts reject incomplete evidence", () => {
  const paths = [
    {id: "factor", name: "Factor", kind: "algebraic", steps: ["Factor the expression."], result: 3},
    {id: "graph", name: "Graph", kind: "graphical", steps: ["Find the x-intercept."], result: 3},
  ];
  assert.equal(verifySolutionPaths(paths, 3).valid, true);
  assert.deepEqual(validateExplanation({whyItWorks: "Both methods preserve the roots.", distractorReasons: {}, commonMisconception: "Sign error", fastestMethodId: "factor", alternatives: paths, calculatorGuidance: {useWhen: "Roots are not apparent.", avoidWhen: "Factoring is immediate."}}), []);
  assert.equal(verifySolutionPaths(paths.slice(0, 1), 3).valid, false);
});

test("offline quality gate rejects duplicates and composes validators fail-closed", async () => {
  const validator = new DeterministicQualityValidator();
  const question = {id: "q", prompt: "Which value solves the equation?", answer: "A", choices: [{id: "A", text: "3"}, {id: "B", text: "3"}, {id: "C", text: "4"}]};
  const report = validator.validate(question);
  assert.equal(report.accepted, false);
  assert.ok(report.issues.some((issue) => issue.check === "duplicate-answers"));
  assert.equal((await validateWithAll(question, [validator])).accepted, false);
});
