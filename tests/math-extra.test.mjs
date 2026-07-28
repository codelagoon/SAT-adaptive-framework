import test from "node:test";
import assert from "node:assert/strict";
import { mathExtraTemplates } from "../src/content/templates/math-extra.ts";

const seeded = (seed) => () =>
	(seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

test("extra math templates cover every targeted concept", () => {
	const expected = [
		"linear-functions",
		"inequalities",
		"slope",
		"equivalent-expressions",
		"radicals",
		"polynomials",
		"factoring",
		"quadratic-forms",
		"nonlinear-functions",
		"rational-expressions",
		"function-notation",
		"ratios",
		"units",
		"scatterplots",
		"conditional-probability",
		"sampling",
		"similarity",
		"angles",
		"right-triangles",
		"trigonometry",
		"circles",
		"area-volume",
		"coordinate-geometry",
	];
	assert.deepEqual(
		new Set(mathExtraTemplates.map((template) => template.conceptId)),
		new Set(expected),
	);
	assert.equal(
		new Set(mathExtraTemplates.map((template) => template.id)).size,
		mathExtraTemplates.length,
	);
});

test("extra generators satisfy structural properties for 100 seeds at every level", () => {
	for (const template of mathExtraTemplates)
		for (let level = 1; level <= 4; level++)
			for (let seed = 1; seed <= 100; seed++) {
				const generated = template.generate(seeded(seed), level);
				assert.equal(
					generated.templateId,
					template.id,
					`${template.id}: template mapping`,
				);
				assert.equal(
					generated.conceptId,
					template.conceptId,
					`${template.id}: concept mapping`,
				);
				assert.equal(generated.domain, "Math");
				assert.equal(generated.difficulty, level);
				assert.ok(generated.prompt.trim());
				assert.ok(generated.answer.trim());
				assert.ok(generated.explanation.trim());
				if (generated.kind === "multiple-choice") {
					assert.equal(
						generated.choices?.length,
						4,
						`${template.id}: choice count`,
					);
					const normalized = generated.choices.map((choice) =>
						choice.text.trim().toLowerCase(),
					);
					assert.equal(
						new Set(normalized).size,
						4,
						`${template.id}: unique choices`,
					);
					assert.ok(
						normalized.includes(generated.answer.trim().toLowerCase()),
						`${template.id}: answer appears among choices`,
					);
				}
			}
});

test("generated answers preserve representative mathematical invariants", () => {
	for (let seed = 1; seed <= 100; seed++) {
		const byId = (id) =>
			mathExtraTemplates
				.find((template) => template.id === id)
				.generate(seeded(seed), 4);
		const conditional = byId("extra-conditional-probability");
		const [numerator, denominator] = conditional.answer.split("/").map(Number);
		assert.ok(
			numerator > 0 && denominator > numerator,
			"conditional probability remains between zero and one",
		);

		const trig = byId("extra-trig-ratio");
		const [opposite, hypotenuse] = trig.answer.split("/").map(Number);
		assert.ok(
			opposite > 0 && hypotenuse > opposite,
			"sine ratio is geometrically valid",
		);

		const circle = byId("extra-circle-equation");
		const radius = Number(circle.answer);
		const squared = Number(circle.prompt.match(/=(\d+)\$/)?.[1]);
		assert.equal(radius * radius, squared, "circle equation uses r squared");

		const midpoint = byId("extra-coordinate-midpoint");
		const numbers = [...midpoint.prompt.matchAll(/-?\d+/g)].map((match) =>
			Number(match[0]),
		);
		const answer = [...midpoint.answer.matchAll(/-?\d+/g)].map((match) =>
			Number(match[0]),
		);
		assert.equal((numbers[0] + numbers[2]) / 2, answer[0]);
		assert.equal((numbers[1] + numbers[3]) / 2, answer[1]);
	}
});
