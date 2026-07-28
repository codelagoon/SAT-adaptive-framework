export interface AnalyticsAttempt {
  conceptId: string;
  at: string;
  correct: boolean;
  elapsedMs: number;
  confidence: number;
  difficulty: number;
  representation: string;
  masteryBefore: number;
  masteryAfter: number;
  calculatorUsed?: boolean;
  errorKind?: string;
}

export interface ConceptMetric {
  conceptId: string;
  attempts: number;
  accuracy: number;
  averageTimeMs: number;
  averageConfidence: number;
  masteryChange: number;
}

export interface DistributionBin {
  label: string;
  count: number;
}

const mean = (values: readonly number[]) => values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export function conceptHeatmap(attempts: readonly AnalyticsAttempt[]): ConceptMetric[] {
  const groups = new Map<string, AnalyticsAttempt[]>();
  for (const attempt of attempts) groups.set(attempt.conceptId, [...(groups.get(attempt.conceptId) ?? []), attempt]);
  return [...groups.entries()].map(([conceptId, rows]) => ({
    conceptId,
    attempts: rows.length,
    accuracy: mean(rows.map((row) => Number(row.correct))),
    averageTimeMs: mean(rows.map((row) => row.elapsedMs)),
    averageConfidence: mean(rows.map((row) => row.confidence)),
    masteryChange: rows[rows.length - 1].masteryAfter - rows[0].masteryBefore,
  })).sort((a, b) => a.conceptId.localeCompare(b.conceptId));
}

export function timeDistribution(attempts: readonly AnalyticsAttempt[]): DistributionBin[] {
  const bins = [
    {label: "under 30s", maximum: 30_000},
    {label: "30–60s", maximum: 60_000},
    {label: "60–90s", maximum: 90_000},
    {label: "over 90s", maximum: Infinity},
  ];
  return bins.map((bin, index) => ({
    label: bin.label,
    count: attempts.filter((row) => row.elapsedMs > (index === 0 ? -1 : bins[index - 1].maximum) && row.elapsedMs <= bin.maximum).length,
  }));
}

export function categoricalDistribution(
  attempts: readonly AnalyticsAttempt[],
  field: "difficulty" | "representation" | "errorKind",
): DistributionBin[] {
  const counts = new Map<string, number>();
  for (const row of attempts) {
    const raw = row[field];
    if (raw === undefined) continue;
    const label = String(raw);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface CalculatorMetric {
  usageRate: number;
  accuracyWithCalculator: number;
  accuracyWithoutCalculator: number;
  timeSavedMs: number;
}

export function calculatorAnalytics(attempts: readonly AnalyticsAttempt[]): CalculatorMetric {
  const used = attempts.filter((row) => row.calculatorUsed);
  const unused = attempts.filter((row) => !row.calculatorUsed);
  const accuracy = (rows: readonly AnalyticsAttempt[]) => mean(rows.map((row) => Number(row.correct)));
  return {
    usageRate: attempts.length === 0 ? 0 : used.length / attempts.length,
    accuracyWithCalculator: accuracy(used),
    accuracyWithoutCalculator: accuracy(unused),
    timeSavedMs: mean(unused.map((row) => row.elapsedMs)) - mean(used.map((row) => row.elapsedMs)),
  };
}

export interface DailyTrend {
  date: string;
  attempts: number;
  accuracy: number;
  averageMastery: number;
}

export function masteryTimeline(attempts: readonly AnalyticsAttempt[]): DailyTrend[] {
  const days = new Map<string, AnalyticsAttempt[]>();
  for (const attempt of attempts) {
    const date = attempt.at.slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), attempt]);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
    date,
    attempts: rows.length,
    accuracy: mean(rows.map((row) => Number(row.correct))),
    averageMastery: mean(rows.map((row) => row.masteryAfter)),
  }));
}
