import test from "node:test";
import assert from "node:assert/strict";
import { auditContentCoverage } from "../src/content/coverage.ts";
import { proceduralConcepts } from "../src/core/concepts.ts";
import { templates } from "../src/core/templates.ts";

test("current bank covers every concept and passes the completeness gate", () => {
  const audit = auditContentCoverage(proceduralConcepts, templates);
  assert.equal(audit.totals.concepts, proceduralConcepts.length);
  assert.equal(audit.totals.templates, templates.length);
  assert.deepEqual(audit.missingConceptIds, []);
  assert.equal(audit.representationCounts.passage, 21);
  assert.deepEqual(audit.difficultyCoverage.missingLevels, []);
  assert.equal(audit.shipGate.passed, true);
  assert.deepEqual(audit.shipGate.failures, []);
});

test("complete synthetic bank passes an exam-agnostic configured gate", () => {
  const syntheticConcepts = [
    { id: "a", domain: "Science", area: "Reasoning" },
    { id: "b", domain: "Language", area: "Reasoning" },
  ];
  const syntheticTemplates = [
    {
      id: "a-chart",
      conceptId: "a",
      representation: "chart",
      supportedDifficulties: ["intro", "advanced"],
    },
    {
      id: "b-text",
      conceptId: "b",
      representation: "text",
      supportedDifficulties: ["intro", "advanced"],
    },
  ];
  const audit = auditContentCoverage(syntheticConcepts, syntheticTemplates, {
    expectedDifficulties: ["intro", "advanced"],
    thresholds: { minimumRepresentations: 2, minimumDifficultyLevels: 2 },
  });
  assert.deepEqual(audit.missingConceptIds, []);
  assert.deepEqual(
    audit.areaCoverage.map((group) => group.name),
    ["Language / Reasoning", "Science / Reasoning"],
  );
  assert.equal(audit.shipGate.passed, true);
});

test("audit exposes duplicates, unknown references, and per-concept difficulty gaps", () => {
  const syntheticConcepts = [
    { id: "known", domain: "Exam", area: "Area" },
    { id: "known", domain: "Exam", area: "Area" },
    { id: "uncovered", domain: "Exam", area: "Other" },
  ];
  const syntheticTemplates = [
    {
      id: "duplicate",
      conceptId: "known",
      representation: "table",
      difficulty: 1,
    },
    {
      id: "duplicate",
      conceptId: "missing",
      representation: "table",
      difficulty: 2,
    },
    { id: "no-representation", conceptId: "known" },
  ];
  const audit = auditContentCoverage(syntheticConcepts, syntheticTemplates, {
    expectedDifficulties: [1, 2, 3],
  });
  assert.deepEqual(audit.duplicateIds, {
    concepts: ["known"],
    templates: ["duplicate"],
  });
  assert.deepEqual(audit.unknownConceptReferences, ["missing"]);
  assert.deepEqual(audit.missingConceptIds, ["uncovered"]);
  assert.deepEqual(
    audit.difficultyCoverage.missingByConcept.uncovered,
    [1, 2, 3],
  );
  assert.equal(audit.representationCounts.unspecified, 1);
  assert.equal(audit.shipGate.passed, false);
});
