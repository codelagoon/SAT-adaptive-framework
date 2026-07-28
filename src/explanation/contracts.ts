export type SolutionMethodKind = "algebraic" | "graphical" | "calculator" | "logical" | "numerical" | "other";

export interface SolutionPath {
  id: string;
  name: string;
  kind: SolutionMethodKind;
  steps: readonly string[];
  result: string | number;
  estimatedSeconds?: number;
  whenToUse?: string;
}

export interface ExplainabilityBundle {
  whyItWorks: string;
  distractorReasons: Record<string, string>;
  commonMisconception: string;
  fastestMethodId: string;
  alternatives: readonly SolutionPath[];
  calculatorGuidance: {
    useWhen: string;
    avoidWhen: string;
    steps?: readonly string[];
  };
}

export interface SolutionVerification {
  valid: boolean;
  errors: string[];
  distinctMethodKinds: number;
}

/** Structural verification is intentionally separate from symbolic verification.
 * A deterministic result normalizer can be replaced by a CAS without changing
 * the content contract. */
export function verifySolutionPaths(
  paths: readonly SolutionPath[],
  expectedAnswer: string | number,
  equivalent: (actual: string | number, expected: string | number) => boolean =
    (actual, expected) => String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase(),
): SolutionVerification {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const path of paths) {
    if (ids.has(path.id)) errors.push(`Duplicate solution id: ${path.id}`);
    ids.add(path.id);
    if (!path.steps.length || path.steps.some((step) => !step.trim())) errors.push(`${path.id} has empty steps`);
    if (!equivalent(path.result, expectedAnswer)) errors.push(`${path.id} reaches a different result`);
  }
  const distinctMethodKinds = new Set(paths.map((path) => path.kind)).size;
  if (paths.length < 2) errors.push("At least two verified solution paths are required");
  if (distinctMethodKinds < 2) errors.push("Solution paths must use distinct method kinds");
  return {valid: errors.length === 0, errors, distinctMethodKinds};
}

export function validateExplanation(bundle: ExplainabilityBundle): string[] {
  const errors: string[] = [];
  if (!bundle.whyItWorks.trim()) errors.push("Missing why-it-works explanation");
  if (!bundle.commonMisconception.trim()) errors.push("Missing misconception");
  if (!bundle.alternatives.some((path) => path.id === bundle.fastestMethodId)) errors.push("Fastest method is not present");
  if (!bundle.calculatorGuidance.useWhen.trim() || !bundle.calculatorGuidance.avoidWhen.trim()) {
    errors.push("Calculator use and avoidance guidance are both required");
  }
  return errors;
}
