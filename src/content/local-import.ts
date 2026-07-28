import type { ContentRecord } from "./provenance.ts";
import type { Question } from "../core/types.ts";
import { conceptById } from "../core/concepts.ts";
/** Parses a user's locally supplied, authorized JSON file. It never fetches or republishes official content. */
export function parseAuthorizedLocal<T>(
  raw: string,
  validate: (value: unknown) => value is T,
): ContentRecord<T>[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed))
    throw new Error("Local content file must be an array");
  return parsed.map((row, index) => {
    if (!row || typeof row !== "object")
      throw new Error(`Invalid record ${index + 1}`);
    const value = row as {
      content?: unknown;
      sourceId?: unknown;
      contentHash?: unknown;
    };
    if (!validate(value.content))
      throw new Error(`Invalid content at record ${index + 1}`);
    if (typeof value.sourceId !== "string" || !value.sourceId.trim())
      throw new Error(`Missing source ID at record ${index + 1}`);
    return {
      content: value.content,
      provenance: {
        origin: "authorized-local",
        publisher: "College Board",
        sourceId: value.sourceId,
        contentHash:
          typeof value.contentHash === "string" ? value.contentHash : undefined,
        licenseScope: "local-personal-use",
      },
    };
  });
}

const domains = new Set(["Math", "Reading & Writing"]);
const kinds = new Set(["multiple-choice", "numeric", "grid-in"]);
const representations = new Set([
  "equation",
  "graph",
  "table",
  "word-problem",
  "diagram",
  "real-world",
  "passage",
]);

export function isImportableQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<Question>;
  if (
    ![
      question.id,
      question.templateId,
      question.conceptId,
      question.prompt,
      question.answer,
      question.explanation,
    ].every((field) => typeof field === "string" && field.trim())
  )
    return false;
  if (
    !domains.has(question.domain ?? "") ||
    !kinds.has(question.kind ?? "") ||
    ![1, 2, 3, 4].includes(question.difficulty ?? 0)
  )
    return false;
  if (!conceptById.has(question.conceptId ?? "")) return false;
  if (
    question.representation !== undefined &&
    !representations.has(question.representation)
  )
    return false;
  if (question.kind === "multiple-choice") {
    if (!Array.isArray(question.choices) || question.choices.length !== 4)
      return false;
    const texts = question.choices.map((choice) =>
      choice.text.trim().toLowerCase(),
    );
    if (
      new Set(texts).size !== 4 ||
      !texts.includes(question.answer?.trim().toLowerCase() ?? "")
    )
      return false;
    if (
      question.choices.some(
        (choice) => !choice.id?.trim() || !choice.reason?.trim(),
      )
    )
      return false;
  }
  return true;
}

export function parseAuthorizedQuestions(raw: string) {
  return parseAuthorizedLocal<Question>(raw, isImportableQuestion);
}

type OpenSatRecord = {
  id?: unknown;
  domain?: unknown;
  section?: unknown;
  difficulty?: unknown;
  question?: {
    paragraph?: unknown;
    question?: unknown;
    choices?: unknown;
    correct_answer?: unknown;
    explanation?: unknown;
  };
};
const rejectedOpenSatIds = new Set(["70ced8dc"]);
const mathDomains = new Set([
  "algebra",
  "advanced math",
  "problem-solving and data analysis",
  "problem solving and data analysis",
  "geometry and trigonometry",
]);
const openSatDomains = new Map([
  ["algebra", "algebra"],
  ["advanced math", "advanced-math"],
  ["problem-solving and data analysis", "problem-solving-data-analysis"],
  ["problem solving and data analysis", "problem-solving-data-analysis"],
  ["geometry and trigonometry", "geometry-trigonometry"],
  ["information and ideas", "information-ideas"],
  ["craft and structure", "craft-structure"],
  ["expression of ideas", "expression-ideas"],
  ["standard english conventions", "standard-english-conventions"],
]);
const openSatDifficulty = (value: unknown): 1 | 2 | 3 | 4 => {
  if (typeof value === "number" && [1, 2, 3, 4].includes(value))
    return value as 1 | 2 | 3 | 4;
  const text = String(value ?? "").toLowerCase();
  if (text.includes("hard")) return 4;
  if (text.includes("medium")) return 2;
  return 1;
};
const openSatText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return ["null", "undefined", "n/a"].includes(text.toLowerCase()) ? "" : text;
};

/** Converts a user-supplied OpenSAT/PineSAT export. It does not fetch or bundle the upstream database. */
export function parseOpenSatQuestions(raw: string): ContentRecord<Question>[] {
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!rows)
    throw new Error("OpenSAT file must contain an array or a questions array");
  return rows.map((unknownRow, index) => {
    if (!unknownRow || typeof unknownRow !== "object")
      throw new Error(`Invalid OpenSAT record ${index + 1}`);
    const row = unknownRow as OpenSatRecord,
      id = String(row.id ?? "").trim(),
      body = row.question;
    if (!id || rejectedOpenSatIds.has(id))
      throw new Error(
        `OpenSAT record ${index + 1} has rejected or missing provenance`,
      );
    if (
      !body?.choices ||
      typeof body.choices !== "object" ||
      Array.isArray(body.choices)
    )
      throw new Error(`Invalid OpenSAT choices at record ${index + 1}`);
    const entries = Object.entries(
        body.choices as Record<string, unknown>,
      ).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
      correctId = String(body.correct_answer ?? "").trim(),
      answer = entries.find(([choiceId]) => choiceId === correctId)?.[1];
    if (entries.length !== 4 || !answer)
      throw new Error(`Invalid OpenSAT answer at record ${index + 1}`);
    const domainText = String(row.domain ?? "")
        .trim()
        .toLowerCase(),
      sectionText = String(row.section ?? "").toLowerCase(),
      isMath = sectionText.includes("math") || mathDomains.has(domainText),
      conceptId = openSatDomains.get(domainText);
    if (!conceptId)
      throw new Error(`Unknown OpenSAT domain at record ${index + 1}`);
    const paragraph = openSatText(body.paragraph),
      task = openSatText(body.question),
      explanation = openSatText(body.explanation) || null;
    if (!explanation)
      throw new Error(`Missing OpenSAT explanation at record ${index + 1}`);
    const question: Question = {
      id: `opensat-${id}`,
      templateId: `opensat-${id}`,
      conceptId,
      domain: isMath ? "Math" : "Reading & Writing",
      difficulty: openSatDifficulty(row.difficulty),
      prompt: [paragraph, task].filter(Boolean).join("\n\n"),
      kind: "multiple-choice",
      choices: entries.map(([choiceId, text]) => ({
        id: choiceId,
        text,
        reason:
          choiceId === correctId
            ? explanation
            : "This choice does not match the keyed OpenSAT answer; verify the source explanation before relying on it.",
      })),
      answer,
      explanation,
    };
    if (!isImportableQuestion(question))
      throw new Error(
        `Invalid converted OpenSAT content at record ${index + 1}`,
      );
    return {
      content: question,
      provenance: {
        origin: "authorized-local",
        publisher: "OpenSAT contributors",
        sourceId: `opensat:${id}`,
        sourceUrl: "https://github.com/Anas099X/OpenSAT",
        licenseScope: "local-personal-use",
      },
    };
  });
}

export function parseQuestionFile(raw: string) {
  try {
    return parseAuthorizedQuestions(raw);
  } catch (authorizedError) {
    try {
      return parseOpenSatQuestions(raw);
    } catch {
      throw authorizedError;
    }
  }
}
