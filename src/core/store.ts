"use client";
import type {
	Attempt,
	Mastery,
	ProbabilisticMastery,
	Question,
	Session,
} from "./types";
import type { ContentRecord } from "@/content/provenance";
import { updateMastery } from "./engine";
import { updateBelief } from "@/intelligence/memory";
import { propagate } from "@/intelligence/graph";
import { concepts } from "./concepts";
import { readSnapshot, writeSnapshot } from "./database";
import { emptyResearchLedger, type ResearchLedger } from "@/research/ledger";
const KEY = "precision-sat:v4",
	LEGACY_KEYS = ["precision-sat:v3", "precision-sat:v2", "precision-sat:v1"];
export type State = {
	attempts: Attempt[];
	mastery: Record<string, Mastery>;
	beliefs: Record<string, ProbabilisticMastery>;
	sessions: Session[];
	research: ResearchLedger;
	localQuestions: ContentRecord<Question>[];
};
const makeEmpty = (): State => ({
	attempts: [],
	mastery: {},
	beliefs: {},
	sessions: [],
	research: emptyResearchLedger(),
	localQuestions: [],
});
const normalize = (value: Partial<State> | undefined): State => {
	const empty = makeEmpty();
	return {
		...empty,
		...value,
		beliefs: value?.beliefs ?? {},
		research: value?.research ?? empty.research,
		localQuestions: Array.isArray(value?.localQuestions)
			? value.localQuestions
			: [],
	};
};
export function load(): State {
	if (typeof window === "undefined") return makeEmpty();
	try {
		const raw =
			localStorage.getItem(KEY) ??
			LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) ??
			"{}";
		const state = normalize(JSON.parse(raw));
		if (!localStorage.getItem(KEY)) save(state);
		return state;
	} catch {
		return makeEmpty();
	}
}
export async function hydrate(): Promise<State> {
	try {
		const durable = await readSnapshot<Partial<State>>();
		if (durable) {
			const state = normalize(durable);
			localStorage.setItem(KEY, JSON.stringify(state));
			return state;
		}
	} catch {}
	return load();
}
export function save(s: State) {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		// Large authorized question libraries can exceed the synchronous
		// localStorage quota; IndexedDB remains the durable source of truth.
	}
	void writeSnapshot(s);
}
export function exportProgress(s: State) {
	return JSON.stringify(
		{ schemaVersion: 4, exportedAt: new Date().toISOString(), state: s },
		null,
		2,
	);
}
export function importProgress(raw: string): State {
	const parsed = JSON.parse(raw) as {
		schemaVersion?: number;
		state?: Partial<State>;
	};
	if (
		![2, 3, 4].includes(parsed.schemaVersion ?? 0) ||
		!parsed.state ||
		!Array.isArray(parsed.state.attempts) ||
		!Array.isArray(parsed.state.sessions)
	)
		throw new Error("Unsupported or invalid progress file");
	const state = normalize(parsed.state);
	save(state);
	return state;
}
export function record(s: State, a: Attempt): State {
	const belief = updateBelief(s.beliefs[a.question.conceptId], a),
		old = s.beliefs[a.question.conceptId]?.mean ?? 0.35,
		beliefs = propagate(
			{ ...s.beliefs, [a.question.conceptId]: belief },
			concepts,
			a.question.conceptId,
			belief.mean - old,
		);
	const next = {
		...s,
		attempts: [...s.attempts, a],
		mastery: {
			...s.mastery,
			[a.question.conceptId]: updateMastery(s.mastery[a.question.conceptId], a),
		},
		beliefs,
		sessions: s.sessions.map((x) =>
			x.id === a.sessionId ? { ...x, attemptIds: [...x.attemptIds, a.id] } : x,
		),
	};
	save(next);
	return next;
}
