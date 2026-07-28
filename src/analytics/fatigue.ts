export interface PerformanceSample {
  correct: boolean;
  elapsedMs: number;
}

export interface FatigueAssessment {
  detected: boolean;
  confidence: "insufficient" | "low" | "moderate";
  accuracyDelta: number;
  speedDelta: number;
  recommendation: "continue" | "pause" | "end-session";
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** A conservative within-session change detector. It recommends stopping only when
 * both accuracy and speed deteriorate, avoiding a medical or psychological claim. */
export function detectPerformanceDecay(
  samples: readonly PerformanceSample[],
  windowSize = 5,
): FatigueAssessment {
  if (samples.length < windowSize * 2) {
    return {detected: false, confidence: "insufficient", accuracyDelta: 0, speedDelta: 0, recommendation: "continue"};
  }
  const early = samples.slice(0, windowSize);
  const late = samples.slice(-windowSize);
  const accuracy = (rows: readonly PerformanceSample[]) => mean(rows.map((row) => Number(row.correct)));
  const speed = (rows: readonly PerformanceSample[]) => mean(rows.map((row) => row.elapsedMs));
  const accuracyDelta = accuracy(late) - accuracy(early);
  const speedDelta = speed(late) / Math.max(1, speed(early)) - 1;
  const severe = accuracyDelta <= -0.3 && speedDelta >= 0.2;
  const moderate = accuracyDelta <= -0.2 && speedDelta >= 0.1;
  return {
    detected: severe || moderate,
    confidence: severe ? "moderate" : moderate ? "low" : "low",
    accuracyDelta,
    speedDelta,
    recommendation: severe ? "end-session" : moderate ? "pause" : "continue",
  };
}
