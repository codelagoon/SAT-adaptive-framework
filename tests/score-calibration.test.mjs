import assert from "node:assert/strict";
import test from "node:test";
import { fitScoreCalibration } from "../src/intelligence/fit-calibration.ts";
import { calibrationGate } from "../src/intelligence/prediction.ts";

test("calibration fitting recovers a stable score relationship", () => {
	const rows = Array.from({ length: 300 }, (_, index) => {
		const ability = index / 299;
		return {
			id: `student-${index}`,
			ability,
			officialScore: Math.max(
				400,
				Math.min(1600, 400 + 1200 * ability + ((index % 5) - 2) * 3),
			),
			observedAt: "2026-01-01T00:00:00.000Z",
		};
	});
	const model = fitScoreCalibration(rows, { version: "synthetic-validation" });
	assert.ok(Math.abs(model.slope - 1200) < 10);
	assert.ok(Math.abs(model.intercept - 400) < 10);
	assert.ok(model.holdoutRmse < 10);
	assert.equal(calibrationGate(model).ready, true);
});

test("calibration fitting rejects duplicate IDs and narrow samples", () => {
	const rows = Array.from({ length: 25 }, (_, index) => ({
		id: `student-${index}`,
		ability: 0.5,
		officialScore: 1000,
		observedAt: "2026-01-01T00:00:00.000Z",
	}));
	assert.throws(() => fitScoreCalibration(rows), /ability range/);
	rows[1] = { ...rows[1], id: rows[0].id };
	assert.throws(() => fitScoreCalibration(rows), /unique/);
});
