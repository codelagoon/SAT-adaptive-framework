export interface ProfileObservation {
  conceptId: string;
  representation: string;
  correct: boolean;
  elapsedMs: number;
  expectedMs: number;
  confidence: number;
  errorKind?: string;
}

export interface LearningProfile {
  strengths: string[];
  weaknesses: string[];
  patterns: string[];
  confidenceCalibrationError: number;
  conceptScores: Record<string, number>;
  representationScores: Record<string, number>;
}

const aggregate = (rows: readonly ProfileObservation[], key: (row: ProfileObservation) => string) => {
  const buckets = new Map<string, ProfileObservation[]>();
  for (const row of rows) buckets.set(key(row), [...(buckets.get(key(row)) ?? []), row]);
  return Object.fromEntries([...buckets].map(([id, values]) => {
    const accuracy = values.filter((value) => value.correct).length / values.length;
    const speed = values.reduce((sum, value) => sum + Math.min(1, value.expectedMs / Math.max(1, value.elapsedMs)), 0) / values.length;
    return [id, accuracy * 0.7 + speed * 0.3];
  }));
};

/** Profiles describe actionable observations, never fixed student traits. Small
 * samples are explicitly suppressed to reduce unstable labels. */
export function buildLearningProfile(
  observations: readonly ProfileObservation[],
  minimumSamples = 3,
): LearningProfile {
  const eligible = (id: string, selector: (row: ProfileObservation) => string) =>
    observations.filter((row) => selector(row) === id).length >= minimumSamples;
  const conceptScores = aggregate(observations, (row) => row.conceptId);
  const representationScores = aggregate(observations, (row) => row.representation);
  const orderedConcepts = Object.entries(conceptScores)
    .filter(([id]) => eligible(id, (row) => row.conceptId))
    .sort((a, b) => b[1] - a[1]);
  const calibration = observations.length === 0 ? 0 : observations.reduce(
    (sum, row) => sum + Math.abs(Math.max(0, Math.min(1, row.confidence)) - Number(row.correct)), 0,
  ) / observations.length;
  const patterns: string[] = [];
  const highConfidenceErrors = observations.filter((row) => !row.correct && row.confidence >= 0.75).length;
  if (highConfidenceErrors >= minimumSamples) patterns.push("Overconfident on repeated errors");
  const pressureErrors = observations.filter((row) => row.errorKind === "Time pressure").length;
  if (pressureErrors >= minimumSamples) patterns.push("Accuracy is vulnerable to time pressure");
  return {
    strengths: orderedConcepts.filter(([, score]) => score >= 0.8).slice(0, 3).map(([id]) => id),
    weaknesses: orderedConcepts.filter(([, score]) => score < 0.65).reverse().slice(0, 3).map(([id]) => id),
    patterns,
    confidenceCalibrationError: calibration,
    conceptScores,
    representationScores,
  };
}
