import type { ScoreCalibration } from "./prediction.ts";

export type CalibrationObservation = {
	id: string;
	ability: number;
	officialScore: number;
	observedAt: string;
};

const hash = (value: string) => {
	let result = 2166136261;
	for (const character of value) {
		result ^= character.charCodeAt(0);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
};
const error = (
	rows: CalibrationObservation[],
	slope: number,
	intercept: number,
) =>
	Math.sqrt(
		rows.reduce(
			(sum, row) =>
				sum + (row.officialScore - (intercept + slope * row.ability)) ** 2,
			0,
		) / rows.length,
	);

/** Fits a transparent linear score map with a deterministic, ID-based holdout set. */
export function fitScoreCalibration(
	rows: CalibrationObservation[],
	options: {
		version?: string;
		scoreFloor?: number;
		scoreCeiling?: number;
	} = {},
): ScoreCalibration {
	if (rows.length < 20)
		throw new Error("At least 20 calibration observations are required");
	if (new Set(rows.map((row) => row.id)).size !== rows.length)
		throw new Error("Calibration observation IDs must be unique");
	const scoreFloor = options.scoreFloor ?? 400,
		scoreCeiling = options.scoreCeiling ?? 1600;
	for (const row of rows) {
		if (!Number.isFinite(row.ability) || row.ability < 0 || row.ability > 1)
			throw new Error("Ability must be between 0 and 1");
		if (
			!Number.isFinite(row.officialScore) ||
			row.officialScore < scoreFloor ||
			row.officialScore > scoreCeiling
		)
			throw new Error(
				"Official scores must be within the configured score range",
			);
	}
	const holdout = rows.filter((row) => hash(row.id) % 5 === 0),
		training = rows.filter((row) => hash(row.id) % 5 !== 0);
	if (holdout.length < 3 || training.length < 10)
		throw new Error(
			"The deterministic split did not produce enough training and holdout observations",
		);
	const meanAbility =
		training.reduce((sum, row) => sum + row.ability, 0) / training.length;
	const meanScore =
		training.reduce((sum, row) => sum + row.officialScore, 0) / training.length;
	const variance = training.reduce(
		(sum, row) => sum + (row.ability - meanAbility) ** 2,
		0,
	);
	if (variance < 0.01)
		throw new Error(
			"Calibration observations do not cover enough of the ability range",
		);
	const slope =
		training.reduce(
			(sum, row) =>
				sum + (row.ability - meanAbility) * (row.officialScore - meanScore),
			0,
		) / variance;
	const intercept = meanScore - slope * meanAbility;
	if (slope <= 0)
		throw new Error(
			"Calibration requires a positive relationship between ability and score",
		);
	return {
		version:
			options.version ?? `local-${new Date().toISOString().slice(0, 10)}`,
		sampleSize: rows.length,
		validatedAt: new Date().toISOString(),
		minAbility: Math.min(...rows.map((row) => row.ability)),
		maxAbility: Math.max(...rows.map((row) => row.ability)),
		scoreFloor,
		scoreCeiling,
		slope,
		intercept,
		rmse: error(training, slope, intercept),
		holdoutRmse: error(holdout, slope, intercept),
	};
}
