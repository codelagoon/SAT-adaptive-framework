import test from "node:test";
import assert from "node:assert/strict";
import { rwExtraTemplates } from "../src/content/templates/rw-extra.ts";
import { validateQuestion } from "../src/intelligence/validation.ts";

const seeded = (seed) => () =>
	(seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

test("Reading and Writing expansion covers the requested skill families", () => {
	assert.ok(rwExtraTemplates.length >= 14);
	const concepts = new Set(
		rwExtraTemplates.map((template) => template.conceptId),
	);
	for (const concept of [
		"evidence",
		"inferences",
		"data-evidence",
		"text-purpose",
		"cross-text",
		"rhetorical-synthesis",
		"form-structure-sense",
		"agreement",
		"pronouns",
		"modifiers",
		"verb-tense",
		"punctuation",
		"central-ideas",
		"transitions",
		"words-context",
	]) {
		assert.ok(concepts.has(concept), `missing ${concept}`);
	}
});

test("every extra Reading and Writing template passes properties for 100 seeds and 4 levels", () => {
	const ids = new Set();
	for (const template of rwExtraTemplates) {
		assert.ok(!ids.has(template.id), `duplicate template id ${template.id}`);
		ids.add(template.id);
		for (let level = 1; level <= 4; level++)
			for (let seed = 1; seed <= 100; seed++) {
				const question = template.generate(seeded(seed), level);
				const result = validateQuestion(question);
				assert.equal(
					result.valid,
					true,
					`${template.id} level ${level} seed ${seed}: ${result.errors.join(", ")}`,
				);
				assert.equal(question.domain, "Reading & Writing");
				assert.equal(question.kind, "multiple-choice");
				assert.equal(question.templateId, template.id);
				assert.equal(question.conceptId, template.conceptId);
				assert.equal(question.difficulty, level);
				assert.equal(question.choices.length, 4);
				assert.equal(
					new Set(
						question.choices.map((choice) => choice.text.trim().toLowerCase()),
					).size,
					4,
				);
				assert.equal(
					question.choices.filter((choice) => choice.text === question.answer)
						.length,
					1,
				);
				assert.ok(question.prompt.trim().length > 20);
				assert.ok(question.explanation.trim().length > 20);
				assert.ok(
					question.choices.every((choice) => choice.reason.trim().length > 10),
				);
			}
	}
});
