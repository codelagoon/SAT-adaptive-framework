import assert from "node:assert/strict";
import test from "node:test";
import {
	conceptHeatmap,
	masteryTimeline,
	timeDistribution,
} from "../src/analytics/aggregations.ts";
import { templates } from "../src/core/templates.ts";

const seeded = (initial) => {
	let seed = initial >>> 0;
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
};

test("procedural generation remains effectively instant at study scale", () => {
	const random = seeded(42),
		started = performance.now();
	for (let index = 0; index < 10_000; index++)
		templates[index % templates.length].generate(random, (index % 4) + 1);
	assert.ok(
		performance.now() - started < 2_500,
		"10,000 generated items exceeded the 2.5 second core budget",
	);
});

test("local analytics remain responsive for a long personal history", () => {
	const attempts = Array.from({ length: 25_000 }, (_, index) => ({
		conceptId: `concept-${index % 47}`,
		at: new Date(Date.UTC(2025, 0, 1 + (index % 365))).toISOString(),
		correct: index % 3 !== 0,
		elapsedMs: 20_000 + (index % 100_000),
		confidence: (index % 4) / 3,
		difficulty: (index % 4) + 1,
		representation: ["equation", "table", "passage"][index % 3],
		masteryBefore: 0.4,
		masteryAfter: 0.41,
		calculatorUsed: index % 5 === 0,
		errorKind: index % 3 === 0 ? "Arithmetic" : undefined,
	}));
	const started = performance.now();
	assert.equal(conceptHeatmap(attempts).length, 47);
	assert.equal(
		timeDistribution(attempts).reduce((sum, bin) => sum + bin.count, 0),
		attempts.length,
	);
	assert.equal(masteryTimeline(attempts).length, 365);
	assert.ok(
		performance.now() - started < 2_500,
		"25,000-attempt analytics exceeded the 2.5 second core budget",
	);
});
