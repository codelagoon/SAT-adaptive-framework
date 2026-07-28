/** Certification deliberately requires converging evidence; a high average alone
 * cannot mask weak retention, narrow representations, or recent failures. */
export interface MasteryEvidence {
  accuracy: number;
  speedRatio: number;
  confidenceCalibration: number;
  representationCount: number;
  difficultyReached: number;
  retention: number;
  recentFailures: number;
  successfulAttempts: number;
  lastSuccessfulAt?: string;
}

export interface CertificationPolicy {
  minimumAccuracy: number;
  maximumSpeedRatio: number;
  minimumCalibration: number;
  minimumRepresentations: number;
  minimumDifficulty: number;
  minimumRetention: number;
  maximumRecentFailures: number;
  minimumSuccessfulAttempts: number;
  halfLifeDays: number;
}

export interface CertificationResult {
  certified: boolean;
  score: number;
  effectiveRetention: number;
  unmet: string[];
}

export const DEFAULT_CERTIFICATION_POLICY: CertificationPolicy = {
  minimumAccuracy: 0.85,
  maximumSpeedRatio: 1,
  minimumCalibration: 0.75,
  minimumRepresentations: 3,
  minimumDifficulty: 3,
  minimumRetention: 0.8,
  maximumRecentFailures: 0,
  minimumSuccessfulAttempts: 6,
  halfLifeDays: 45,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function decayedRetention(
  retention: number,
  lastSuccessfulAt: string | undefined,
  now: Date,
  halfLifeDays: number,
): number {
  if (!lastSuccessfulAt) return 0;
  const ageDays = Math.max(0, (now.getTime() - new Date(lastSuccessfulAt).getTime()) / 86_400_000);
  return clamp01(retention) * 0.5 ** (ageDays / Math.max(1, halfLifeDays));
}

export function certifyMastery(
  evidence: MasteryEvidence,
  now = new Date(),
  policy = DEFAULT_CERTIFICATION_POLICY,
): CertificationResult {
  const effectiveRetention = decayedRetention(
    evidence.retention, evidence.lastSuccessfulAt, now, policy.halfLifeDays,
  );
  const checks: Array<[string, boolean]> = [
    ["accuracy", evidence.accuracy >= policy.minimumAccuracy],
    ["speed", evidence.speedRatio <= policy.maximumSpeedRatio],
    ["confidence calibration", evidence.confidenceCalibration >= policy.minimumCalibration],
    ["representation coverage", evidence.representationCount >= policy.minimumRepresentations],
    ["difficulty", evidence.difficultyReached >= policy.minimumDifficulty],
    ["retention", effectiveRetention >= policy.minimumRetention],
    ["recent failures", evidence.recentFailures <= policy.maximumRecentFailures],
    ["successful attempts", evidence.successfulAttempts >= policy.minimumSuccessfulAttempts],
  ];
  const factors = [
    clamp01(evidence.accuracy),
    clamp01(1 / Math.max(1, evidence.speedRatio)),
    clamp01(evidence.confidenceCalibration),
    clamp01(evidence.representationCount / policy.minimumRepresentations),
    clamp01(evidence.difficultyReached / policy.minimumDifficulty),
    effectiveRetention,
    clamp01(evidence.successfulAttempts / policy.minimumSuccessfulAttempts),
  ];
  return {
    certified: checks.every(([, passed]) => passed),
    score: factors.reduce((product, factor) => product * factor, 1) ** (1 / factors.length),
    effectiveRetention,
    unmet: checks.filter(([, passed]) => !passed).map(([name]) => name),
  };
}
