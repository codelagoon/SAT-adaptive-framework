export interface ReviewCandidate {
  conceptId: string;
  currentMastery: number;
  retention: number;
  masteryThreshold: number;
  downstreamDependents: number;
  examFrequency: number;
  expectedGain: number;
  expectedMinutes: number;
  lastReviewedAt?: string;
}

export interface RankedReview extends ReviewCandidate {
  roi: number;
  reasons: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Expected score gain per minute is the north-star ranking. The factors expose
 * why an item ranks highly and can later be calibrated from experiment outcomes. */
export function rankSmartReview(candidates: readonly ReviewCandidate[]): RankedReview[] {
  return candidates.map((candidate) => {
    const forgotten = 1 - clamp01(candidate.retention);
    const nearMastery = Math.max(0, 1 - Math.abs(candidate.masteryThreshold - candidate.currentMastery) / 0.25);
    const leverage = Math.min(1, candidate.downstreamDependents / 4);
    const priority = 0.3 * forgotten + 0.2 * nearMastery + 0.2 * leverage +
      0.2 * clamp01(candidate.examFrequency) + 0.1 * (1 - clamp01(candidate.currentMastery));
    const reasons: string[] = [];
    if (forgotten >= 0.25) reasons.push("recently forgotten");
    if (nearMastery >= 0.7) reasons.push("close to mastery");
    if (leverage >= 0.5) reasons.push("unblocks dependent concepts");
    if (candidate.examFrequency >= 0.7) reasons.push("high exam frequency");
    return {
      ...candidate,
      roi: priority * Math.max(0, candidate.expectedGain) / Math.max(0.5, candidate.expectedMinutes),
      reasons,
    };
  }).sort((a, b) => b.roi - a.roi || a.conceptId.localeCompare(b.conceptId));
}
