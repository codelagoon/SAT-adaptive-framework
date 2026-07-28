export type ReplayEventKind = "question-presented" | "answer-submitted" | "confidence-recorded" |
  "error-classified" | "mastery-updated" | "calculator-used";

export interface ReplayEvent<T = unknown> {
  id: string;
  sessionId: string;
  questionId?: string;
  at: string;
  kind: ReplayEventKind;
  payload: T;
}

export interface ReplayFrame {
  offsetMs: number;
  event: ReplayEvent;
}

/** Replay is reconstructed from immutable events rather than UI state, making it
 * auditable and resilient to future presentation changes. */
export function buildSessionReplay(events: readonly ReplayEvent[]): ReplayFrame[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const start = Date.parse(sorted[0].at);
  return sorted.map((event) => ({offsetMs: Math.max(0, Date.parse(event.at) - start), event}));
}
