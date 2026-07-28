import type { SolutionPath } from "./contracts.ts";

export interface QualityQuestion {
  id: string;
  prompt: string;
  answer: string | number;
  choices?: readonly {id: string; text: string}[];
  solutionPaths?: readonly SolutionPath[];
  metadata?: Record<string, unknown>;
}

export type QualityCheck = "mathematical-correctness" | "style" | "ambiguity" |
  "duplicate-answers" | "realistic-values" | "grammar" | "answer-balance" | "distractor-quality";

export interface QualityIssue {
  check: QualityCheck;
  severity: "warning" | "error";
  message: string;
}

export interface QualityReport {
  accepted: boolean;
  issues: QualityIssue[];
  validatorId: string;
}

export interface QuestionQualityValidator {
  readonly id: string;
  validate(question: QualityQuestion): QualityReport | Promise<QualityReport>;
}

const normalize = (value: string | number) => String(value).trim().toLocaleLowerCase();

/** Offline baseline catches deterministic defects cheaply. It does not claim to
 * prove mathematical correctness or SAT authenticity; those checks require a
 * symbolic oracle, calibrated rubric, or reviewed local model. */
export class DeterministicQualityValidator implements QuestionQualityValidator {
  readonly id = "deterministic-quality-v1";

  validate(question: QualityQuestion): QualityReport {
    const issues: QualityIssue[] = [];
    const error = (check: QualityCheck, message: string) => issues.push({check, severity: "error", message});
    const warning = (check: QualityCheck, message: string) => issues.push({check, severity: "warning", message});
    const prompt = question.prompt.trim();
    if (prompt.length < 12) error("style", "Prompt is too short to establish a clear task.");
    if (!/[?.:]$/.test(prompt)) warning("grammar", "Prompt should end with task punctuation.");
    if (/\b(?:maybe|probably|approximately)\b/i.test(prompt)) warning("ambiguity", "Prompt contains an ambiguity marker.");
    if (question.choices) {
      const normalized = question.choices.map((choice) => normalize(choice.text));
      if (new Set(normalized).size !== normalized.length) error("duplicate-answers", "Choice text must be unique.");
      const ids = question.choices.map((choice) => choice.id);
      if (new Set(ids).size !== ids.length) error("duplicate-answers", "Choice identifiers must be unique.");
      const answerMatches = question.choices.filter((choice) => normalize(choice.id) === normalize(question.answer) || normalize(choice.text) === normalize(question.answer));
      if (answerMatches.length !== 1) error("mathematical-correctness", "Exactly one choice must match the declared answer.");
      if (question.choices.length < 3) warning("distractor-quality", "Fewer than three choices provides weak distractor evidence.");
    }
    const numbers = prompt.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e9)) warning("realistic-values", "Values require a domain-specific realism review.");
    if (!question.solutionPaths?.length) warning("mathematical-correctness", "No independently verifiable solution path was supplied.");
    return {accepted: issues.every((issue) => issue.severity !== "error"), issues, validatorId: this.id};
  }
}

/** Combines local or AI validators using fail-closed semantics. Network access is
 * never implied; callers must explicitly provide any model-backed implementation. */
export async function validateWithAll(
  question: QualityQuestion,
  validators: readonly QuestionQualityValidator[],
): Promise<QualityReport> {
  if (!validators.length) throw new Error("At least one validator is required.");
  const reports = await Promise.all(validators.map((validator) => validator.validate(question)));
  return {
    accepted: reports.every((report) => report.accepted),
    issues: reports.flatMap((report) => report.issues),
    validatorId: reports.map((report) => report.validatorId).join("+"),
  };
}
