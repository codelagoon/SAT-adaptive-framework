import test from "node:test";
import assert from "node:assert/strict";
import {
	assertBundleSafe,
	canBundle,
	validateProvenance,
} from "../src/content/provenance.ts";
import { officialSources } from "../src/content/official-sources.ts";
import {
	parseAuthorizedQuestions,
	parseOpenSatQuestions,
	parseQuestionFile,
} from "../src/content/local-import.ts";

test("official College Board sources remain external references", () => {
	for (const source of officialSources) {
		assert.equal(validateProvenance(source.provenance).valid, true);
		assert.equal(
			canBundle({ content: "restricted", provenance: source.provenance }),
			false,
		);
	}
});
test("restricted content fails the bundle gate", () => {
	const record = {
		content: "question text",
		provenance: officialSources[0].provenance,
	};
	assert.throws(() => assertBundleSafe([record]), /Refusing to bundle/);
});
test("procedural redistributable content passes the bundle gate", () => {
	const record = {
		content: { templateId: "linear" },
		provenance: {
			origin: "procedural",
			publisher: "Precision SAT",
			sourceId: "linear",
			licenseScope: "redistributable",
		},
	};
	assert.deepEqual(assertBundleSafe([record]), [record]);
});
test("authorized local questions become validated first-class practice records", () => {
	const content = {
		id: "local-1",
		templateId: "local-linear",
		conceptId: "linear-equations",
		domain: "Math",
		difficulty: 2,
		representation: "equation",
		prompt: "If 2x + 3 = 11, what is x?",
		kind: "numeric",
		answer: "4",
		explanation: "Subtract 3 and divide by 2.",
	};
	const [record] = parseAuthorizedQuestions(
		JSON.stringify([{ sourceId: "owned-set:1", content }]),
	);
	assert.deepEqual(record.content, content);
	assert.equal(record.provenance.licenseScope, "local-personal-use");
	assert.equal(canBundle(record), false);
	assert.throws(
		() =>
			parseAuthorizedQuestions(
				JSON.stringify([
					{ sourceId: "bad", content: { ...content, conceptId: "unknown" } },
				]),
			),
		/Invalid content/,
	);
});
test("native OpenSAT exports convert locally without bundling upstream content", () => {
	const row = {
		id: "original-demo-1",
		section: "MATH",
		domain: "Algebra",
		skill: "Linear equations",
		difficulty: "Medium",
		question: {
			paragraph: "A value satisfies a linear relationship.",
			question: "If 3x = 12, what is x?",
			choices: { A: "2", B: "3", C: "4", D: "6" },
			correct_answer: "C",
			explanation: "Divide both sides by 3 to obtain x = 4.",
		},
	};
	const [record] = parseQuestionFile(JSON.stringify({ questions: [row] }));
	assert.equal(record.content.answer, "4");
	assert.equal(record.content.conceptId, "linear-equations");
	assert.equal(record.provenance.publisher, "OpenSAT contributors");
	assert.equal(canBundle(record), false);
	assert.throws(
		() => parseOpenSatQuestions(JSON.stringify([{ ...row, id: "70ced8dc" }])),
		/rejected/,
	);
});
