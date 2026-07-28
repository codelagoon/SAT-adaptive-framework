/** Experiment primitives are exam-agnostic: treatments affect a declared learning
 * intervention, while outcomes remain observable metrics. Assignment uses a stable
 * hash so the same learner cannot drift between arms across devices or reloads. */
export interface ExperimentArm {
  id: string;
  weight: number;
}

export interface ExperimentDefinition {
  id: string;
  arms: readonly ExperimentArm[];
  salt?: string;
}

export interface LearningOutcome {
  learnerId: string;
  armId: string;
  observedAt: string;
  retention: number;
  accuracy: number;
  meanSolveTimeMs: number;
  confidenceCalibration: number;
  mastery: number;
}

export interface ArmMeasurement {
  armId: string;
  sampleSize: number;
  retention: number;
  accuracy: number;
  meanSolveTimeMs: number;
  confidenceCalibration: number;
  mastery: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignExperimentArm(
  experiment: ExperimentDefinition,
  learnerId: string,
): string {
  const arms = experiment.arms.filter((arm) => arm.weight > 0);
  const totalWeight = arms.reduce((sum, arm) => sum + arm.weight, 0);
  if (!experiment.id.trim() || !learnerId.trim() || totalWeight <= 0) {
    throw new Error("Experiment, learner, and at least one positive arm are required.");
  }
  const unit = stableHash(`${experiment.salt ?? "v1"}:${experiment.id}:${learnerId}`) / 2 ** 32;
  let cursor = unit * totalWeight;
  for (const arm of arms) {
    cursor -= arm.weight;
    if (cursor < 0) return arm.id;
  }
  return arms[arms.length - 1].id;
}

export function measureExperiment(outcomes: readonly LearningOutcome[]): ArmMeasurement[] {
  const groups = new Map<string, LearningOutcome[]>();
  for (const outcome of outcomes) {
    const group = groups.get(outcome.armId) ?? [];
    group.push(outcome);
    groups.set(outcome.armId, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([armId, rows]) => {
    const mean = (select: (row: LearningOutcome) => number) =>
      rows.reduce((sum, row) => sum + select(row), 0) / rows.length;
    return {
      armId,
      sampleSize: rows.length,
      retention: clamp01(mean((row) => row.retention)),
      accuracy: clamp01(mean((row) => row.accuracy)),
      meanSolveTimeMs: Math.max(0, mean((row) => row.meanSolveTimeMs)),
      confidenceCalibration: clamp01(mean((row) => row.confidenceCalibration)),
      mastery: clamp01(mean((row) => row.mastery)),
    };
  });
}

/** Standardized, direction-aware composite. It is descriptive—not causal—and must
 * not ship treatment changes without adequate sample size and predeclared analysis. */
export function learningEfficiencyIndex(measurement: ArmMeasurement): number {
  const speed = 1 / (1 + measurement.meanSolveTimeMs / 60_000);
  return clamp01(
    measurement.retention * 0.3 + measurement.accuracy * 0.2 +
    measurement.confidenceCalibration * 0.15 + measurement.mastery * 0.25 + speed * 0.1,
  );
}
