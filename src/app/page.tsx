"use client";
import {
	Calculator,
	Download,
	Moon,
	Pause,
	Play,
	Sun,
	Timer,
	Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildLearningProfile } from "@/analytics/profile";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { MathText } from "@/components/math-text";
import { OfficialResources } from "@/components/official-resources";
import { SessionRecommendation } from "@/components/session-recommendation";
import { conceptById, concepts } from "@/core/concepts";
import { answersEqual } from "@/core/engine";
import {
	exportProgress,
	hydrate,
	importProgress,
	record,
	type State,
	save,
} from "@/core/store";
import { makeAdaptiveQuestion } from "@/core/templates";
import type { Attempt, Confidence, ErrorKind, Question } from "@/core/types";
import { aggregateAbility } from "@/intelligence/ability";
import {
	confidenceCalibration,
	recurringErrors,
} from "@/intelligence/calibration";
import { reviewQueue } from "@/intelligence/scheduling";
import { sessionSignals } from "@/intelligence/session";
import { certifyMastery } from "@/research/mastery-certification";

const EMPTY: State = {
	attempts: [],
	mastery: {},
	beliefs: {},
	sessions: [],
	research: { enrollments: [], pending: [], outcomes: [] },
	localQuestions: [],
};
const CONFIDENCE: Confidence[] = ["Guess", "Unsure", "Pretty Sure", "Certain"];
const ERRORS: ErrorKind[] = [
	"Didn't know concept",
	"Forgot formula",
	"Arithmetic",
	"Misread",
	"Time pressure",
	"Second guessed",
	"Logic error",
	"Other",
];
type View = "home" | "rush" | "results" | "review" | "library" | "analytics";

export default function Home() {
	const [state, setState] = useState<State>(EMPTY),
		[view, setView] = useState<View>("home"),
		[question, setQuestion] = useState<Question | null>(null);
	const [response, setResponse] = useState(""),
		[confidence, setConfidence] = useState<Confidence>("Unsure"),
		[feedback, setFeedback] = useState<Attempt | null>(null),
		[errorKind, setErrorKind] = useState<ErrorKind>();
	const [sessionId, setSessionId] = useState(""),
		[target, setTarget] = useState<number | null>(10),
		[elapsedMs, setElapsedMs] = useState(0),
		[calculatorMs, setCalculatorMs] = useState(0),
		[paused, setPaused] = useState(false),
		[calculator, setCalculator] = useState(false),
		[dark, setDark] = useState(false),
		[fontScale, setFontScale] = useState(1);
	const [practicePool, setPracticePool] = useState<Question[] | null>(null),
		[practiceCursor, setPracticeCursor] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null),
		fileRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		void hydrate().then(setState);
		setDark(localStorage.getItem("precision-theme") === "dark");
		setCalculator(localStorage.getItem("precision-calculator") === "open");
		setFontScale(Number(localStorage.getItem("precision-font-scale")) || 1);
	}, []);
	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		localStorage.setItem("precision-theme", dark ? "dark" : "light");
	}, [dark]);
	useEffect(
		() =>
			localStorage.setItem(
				"precision-calculator",
				calculator ? "open" : "closed",
			),
		[calculator],
	);
	useEffect(() => {
		document.documentElement.style.fontSize = `${fontScale * 100}%`;
		localStorage.setItem("precision-font-scale", String(fontScale));
	}, [fontScale]);
	useEffect(() => {
		if (view !== "rush" || paused || feedback) return;
		const handle = setInterval(() => setElapsedMs((ms) => ms + 250), 250);
		return () => clearInterval(handle);
	}, [view, paused, feedback]);
	useEffect(() => {
		if (view !== "rush" || paused || feedback || !calculator) return;
		const handle = setInterval(() => setCalculatorMs((ms) => ms + 250), 250);
		return () => clearInterval(handle);
	}, [view, paused, feedback, calculator]);
	const activeSession = state.sessions.find((s) => s.id === sessionId),
		count = activeSession?.attemptIds.length ?? 0;
	const sessionAttempts = useMemo(
		() =>
			activeSession?.attemptIds
				.map((id) => state.attempts.find((a) => a.id === id))
				.filter((a): a is Attempt => Boolean(a)) ?? [],
		[activeSession, state.attempts],
	);

	function presentQuestion(next: Question) {
		setQuestion(next);
		setResponse("");
		setConfidence("Unsure");
		setFeedback(null);
		setErrorKind(undefined);
		setElapsedMs(0);
		setCalculatorMs(0);
		setPaused(false);
		queueMicrotask(() => inputRef.current?.focus());
	}
	function nextQuestion(
		source = state,
		pool = practicePool,
		cursor = practiceCursor,
	) {
		if (pool?.length) {
			const nextCursor = (cursor + 1) % pool.length;
			setPracticeCursor(nextCursor);
			presentQuestion({ ...pool[nextCursor], id: crypto.randomUUID() });
			return;
		}
		presentQuestion(
			makeAdaptiveQuestion(
				Math.random,
				source.beliefs,
				source.attempts.slice(-12),
			),
		);
	}
	function begin(nextTarget: number | null) {
		const id = crypto.randomUUID(),
			session = {
				id,
				startedAt: new Date().toISOString(),
				target: nextTarget,
				attemptIds: [],
			};
		const next = { ...state, sessions: [...state.sessions, session] };
		setState(next);
		save(next);
		setSessionId(id);
		setTarget(nextTarget);
		setPracticePool(null);
		setPracticeCursor(0);
		setView("rush");
		nextQuestion(next, null, 0);
	}
	function beginImported() {
		const pool = state.localQuestions.map((record) => record.content);
		if (!pool.length) return;
		const id = crypto.randomUUID(),
			next = {
				...state,
				sessions: [
					...state.sessions,
					{
						id,
						startedAt: new Date().toISOString(),
						target: pool.length,
						attemptIds: [],
					},
				],
			};
		setState(next);
		save(next);
		setSessionId(id);
		setTarget(pool.length);
		setPracticePool(pool);
		setPracticeCursor(0);
		setView("rush");
		presentQuestion({ ...pool[0], id: crypto.randomUUID() });
	}
	function importLocalQuestions(records: State["localQuestions"]) {
		const merged = new Map(
			state.localQuestions.map((record) => [
				record.provenance.sourceId,
				record,
			]),
		);
		for (const record of records)
			merged.set(record.provenance.sourceId, record);
		const next = { ...state, localQuestions: [...merged.values()] };
		setState(next);
		save(next);
	}
	function redo(source: Question) {
		const id = crypto.randomUUID();
		const next = {
			...state,
			sessions: [
				...state.sessions,
				{
					id,
					startedAt: new Date().toISOString(),
					target: 1,
					attemptIds: [],
				},
			],
		};
		setState(next);
		save(next);
		setSessionId(id);
		setTarget(1);
		setPracticePool(null);
		setPracticeCursor(0);
		setQuestion({ ...source, id: crypto.randomUUID() });
		setResponse("");
		setConfidence("Unsure");
		setFeedback(null);
		setErrorKind(undefined);
		setElapsedMs(0);
		setCalculatorMs(0);
		setPaused(false);
		setView("rush");
		queueMicrotask(() => inputRef.current?.focus());
	}
	function check() {
		if (!question || !response.trim()) return;
		setFeedback({
			id: crypto.randomUUID(),
			sessionId,
			question,
			response: response.trim(),
			correct: answersEqual(response, question.answer),
			elapsedMs,
			confidence,
			calculator: { opened: calculatorMs > 0, elapsedMs: calculatorMs },
			at: new Date().toISOString(),
		});
	}
	function continueRush() {
		if (!feedback || (!feedback.correct && !errorKind)) return;
		const completed = { ...feedback, errorKind },
			next = record(state, completed),
			done = target !== null && count + 1 >= target;
		if (done) {
			const finished = {
				...next,
				sessions: next.sessions.map((s) =>
					s.id === sessionId ? { ...s, endedAt: new Date().toISOString() } : s,
				),
			};
			save(finished);
			setState(finished);
			setView("results");
		} else {
			setState(next);
			nextQuestion(next);
		}
	}
	function endUnlimited() {
		if (!sessionId) return;
		const next = {
			...state,
			sessions: state.sessions.map((s) =>
				s.id === sessionId ? { ...s, endedAt: new Date().toISOString() } : s,
			),
		};
		save(next);
		setState(next);
		setView("results");
	}
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement) return;
			if (event.key.toLowerCase() === "c") {
				event.preventDefault();
				setCalculator((v) => !v);
			}
			if (event.code === "Space" && view === "rush" && !feedback) {
				event.preventDefault();
				setPaused((v) => !v);
			}
			if (event.key === "Enter" && view === "rush") {
				event.preventDefault();
				feedback ? continueRush() : check();
			}
			if (
				question?.choices &&
				!feedback &&
				["1", "2", "3", "4"].includes(event.key)
			) {
				const value = question.choices[Number(event.key) - 1]?.text;
				if (value) setResponse(value);
			}
		};
		addEventListener("keydown", handler);
		return () => removeEventListener("keydown", handler);
	});
	function download() {
		const blob = new Blob([exportProgress(state)], {
				type: "application/json",
			}),
			url = URL.createObjectURL(blob),
			a = document.createElement("a");
		a.href = url;
		a.download = `precision-sat-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
	async function upload(file?: File) {
		if (!file) return;
		try {
			setState(importProgress(await file.text()));
		} catch {
			alert("This progress file is invalid or unsupported.");
		}
	}

	return (
		<main className="mx-auto min-h-screen max-w-6xl p-5 md:p-9">
			<header className="flex items-center justify-between border-b border-line pb-4">
				<button
					type="button"
					onClick={() => setView("home")}
					className="text-lg font-semibold"
				>
					Precision SAT
				</button>
				<nav aria-label="Primary" className="flex items-center gap-2">
					<button
						type="button"
						className="btn hidden md:block"
						onClick={() => setView("library")}
					>
						Concepts
					</button>
					<button
						type="button"
						className="btn hidden md:block"
						onClick={() => setView("review")}
					>
						Review
					</button>
					<button
						type="button"
						className="btn hidden md:block"
						onClick={() => setView("analytics")}
					>
						Analytics
					</button>
					<button
						type="button"
						className="btn hidden md:block"
						aria-label="Decrease text size"
						disabled={fontScale <= 0.9}
						onClick={() => setFontScale((x) => Math.max(0.9, x - 0.1))}
					>
						A−
					</button>
					<button
						type="button"
						className="btn hidden md:block"
						aria-label="Increase text size"
						disabled={fontScale >= 1.3}
						onClick={() => setFontScale((x) => Math.min(1.3, x + 0.1))}
					>
						A+
					</button>
					<button
						type="button"
						className="btn"
						title="Calculator (C)"
						aria-label="Toggle calculator"
						onClick={() => setCalculator((v) => !v)}
					>
						<Calculator size={18} />
					</button>
					<button
						type="button"
						className="btn"
						aria-label="Toggle color theme"
						onClick={() => setDark((v) => !v)}
					>
						{dark ? <Sun size={18} /> : <Moon size={18} />}
					</button>
				</nav>
			</header>
			{view === "home" && (
				<>
					<HomeView
						state={state}
						begin={begin}
						setView={setView}
						download={download}
						fileRef={fileRef}
						upload={upload}
					/>
					<OfficialResources
						count={state.localQuestions.length}
						onImport={importLocalQuestions}
						onPractice={beginImported}
					/>
				</>
			)}
			{view === "rush" && question && (
				<>
					<RushView
						question={question}
						response={response}
						setResponse={setResponse}
						confidence={confidence}
						setConfidence={setConfidence}
						feedback={feedback}
						errorKind={errorKind}
						setErrorKind={setErrorKind}
						count={count}
						target={target}
						elapsedMs={elapsedMs}
						paused={paused}
						setPaused={setPaused}
						calculator={calculator}
						check={check}
						next={continueRush}
						endUnlimited={endUnlimited}
						inputRef={inputRef}
					/>
					<SessionRecommendation
						signal={sessionSignals(sessionAttempts)}
						end={endUnlimited}
					/>
				</>
			)}
			{view === "results" && (
				<Results
					attempts={sessionAttempts}
					onReview={() => setView("review")}
					onHome={() => setView("home")}
				/>
			)}
			{view === "review" && <Review attempts={state.attempts} onRedo={redo} />}
			{view === "library" && (
				<>
					<Library state={state} />
					<KnowledgeGraph beliefs={state.beliefs} />
				</>
			)}
			{view === "analytics" && (
				<>
					<Analytics state={state} />
					<ScientificSummary state={state} />
				</>
			)}
		</main>
	);
}

function HomeView({
	state,
	begin,
	setView,
	download,
	fileRef,
	upload,
}: {
	state: State;
	begin: (n: number | null) => void;
	setView: (v: View) => void;
	download: () => void;
	fileRef: React.RefObject<HTMLInputElement | null>;
	upload: (f?: File) => void;
}) {
	const beliefs = Object.values(state.beliefs),
		mean =
			beliefs.reduce((s, b) => s + b.mean, 0) / Math.max(1, beliefs.length);
	return (
		<section className="mx-auto max-w-3xl py-14">
			<p className="text-sm text-muted">MOST USEFUL NEXT ACTION</p>
			<h1 className="mt-2 text-4xl font-semibold tracking-tight">
				Retrieve what is closest to being forgotten.
			</h1>
			<p className="mt-4 max-w-2xl text-muted">
				Questions are selected for learning value, uncertainty, retention need,
				and variety. Progress stays on this device.
			</p>
			<div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
				{(
					[
						[10, "10 questions"],
						[20, "20 questions"],
						[40, "40 questions"],
						[null, "Unlimited"],
					] as const
				).map(([n, label]) => (
					<button
						type="button"
						key={label}
						className="card p-5 text-left hover:border-ink"
						onClick={() => begin(n)}
					>
						<b>{label}</b>
						<span className="mt-2 block text-sm text-muted">Adaptive Rush</span>
					</button>
				))}
			</div>
			<div className="mt-5 flex flex-wrap gap-2">
				<button type="button" className="btn" onClick={() => setView("review")}>
					Review evidence
				</button>
				<button
					type="button"
					className="btn"
					onClick={() => setView("library")}
				>
					Concept library
				</button>
				<button type="button" className="btn" onClick={download}>
					<Download className="mr-2 inline" size={16} />
					Export
				</button>
				<button
					type="button"
					className="btn"
					onClick={() => fileRef.current?.click()}
				>
					<Upload className="mr-2 inline" size={16} />
					Import
				</button>
				<input
					ref={fileRef}
					type="file"
					accept="application/json"
					className="hidden"
					onChange={(e) => upload(e.target.files?.[0])}
				/>
			</div>
			<div className="mt-12 grid grid-cols-3 gap-3 text-center">
				<Metric value={String(beliefs.length)} label="concepts observed" />
				<Metric value={String(state.attempts.length)} label="retrievals" />
				<Metric
					value={`${Math.round(mean * 100)}%`}
					label="estimated mastery"
				/>
			</div>
		</section>
	);
}

type RushProps = {
	question: Question;
	response: string;
	setResponse: (x: string) => void;
	confidence: Confidence;
	setConfidence: (x: Confidence) => void;
	feedback: Attempt | null;
	errorKind?: ErrorKind;
	setErrorKind: (x: ErrorKind) => void;
	count: number;
	target: number | null;
	elapsedMs: number;
	paused: boolean;
	setPaused: (f: (x: boolean) => boolean) => void;
	calculator: boolean;
	check: () => void;
	next: () => void;
	endUnlimited: () => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
};
function RushView(p: RushProps) {
	const concept = conceptById.get(p.question.conceptId);
	return (
		<section className="py-7">
			<div className="mb-6 flex items-center justify-between gap-3 text-sm text-muted">
				<span>
					{p.count + 1}
					{p.target ? ` of ${p.target}` : ""} · {concept?.name} · Level{" "}
					{p.question.difficulty}
				</span>
				<div className="flex items-center gap-2">
					<Timer size={16} />
					{formatTime(p.elapsedMs)}
					<button
						type="button"
						aria-label={p.paused ? "Resume" : "Pause"}
						onClick={() => p.setPaused((v) => !v)}
					>
						{p.paused ? <Play size={17} /> : <Pause size={17} />}
					</button>
				</div>
			</div>
			{p.paused ? (
				<div className="card p-16 text-center">
					<h2 className="text-2xl">Paused</h2>
					<button
						type="button"
						className="btn primary mt-5"
						onClick={() => p.setPaused((v) => !v)}
					>
						Resume
					</button>
				</div>
			) : (
				<div className={`grid gap-5 ${p.calculator ? "lg:grid-cols-2" : ""}`}>
					<article className="card p-6 md:p-9">
						<p className="text-xl leading-8">
							<MathText text={p.question.prompt} />
						</p>
						{p.question.choices ? (
							<div className="mt-7 grid gap-3">
								{p.question.choices.map((choice, i) => (
									<button
										type="button"
										key={choice.id}
										onClick={() => p.setResponse(choice.text)}
										aria-pressed={p.response === choice.text}
										className={`btn text-left ${p.response === choice.text ? "border-ink bg-ink text-paper" : ""}`}
									>
										<b className="mr-3">{choice.id}</b>
										<MathText text={choice.text} />
										<span className="float-right opacity-50">{i + 1}</span>
									</button>
								))}
							</div>
						) : (
							<input
								ref={p.inputRef}
								aria-label="Answer"
								inputMode="decimal"
								className="mt-7 w-full rounded-lg border border-line bg-transparent p-4 text-xl"
								value={p.response}
								onChange={(e) => p.setResponse(e.target.value)}
								placeholder="Enter your answer"
							/>
						)}
						<fieldset className="mt-7">
							<legend className="mb-2 text-sm text-muted">
								How confident are you?
							</legend>
							<div className="flex flex-wrap gap-2">
								{CONFIDENCE.map((c) => (
									<button
										type="button"
										className={`btn text-sm ${p.confidence === c ? "border-ink" : ""}`}
										aria-pressed={p.confidence === c}
										onClick={() => p.setConfidence(c)}
										key={c}
									>
										{c}
									</button>
								))}
							</div>
						</fieldset>
						{!p.feedback && (
							<button
								type="button"
								disabled={!p.response.trim()}
								className="btn primary mt-7 w-full disabled:opacity-40"
								onClick={p.check}
							>
								Check answer <span className="opacity-60">↵</span>
							</button>
						)}
						<Feedback {...p} />
						{p.target === null && p.count > 0 && !p.feedback && (
							<button
								type="button"
								className="mt-5 text-sm text-muted underline"
								onClick={p.endUnlimited}
							>
								End practice
							</button>
						)}
					</article>
					{p.calculator && (
						<aside className="card min-h-[560px] resize-x overflow-hidden">
							<iframe
								title="Desmos graphing calculator"
								className="h-full min-h-[560px] w-full"
								src="https://www.desmos.com/calculator?embed"
							/>
						</aside>
					)}
				</div>
			)}
		</section>
	);
}

function Feedback(p: RushProps) {
	if (!p.feedback) return null;
	return (
		<div
			className="mt-7 border-t border-line pt-6"
			role="status"
			aria-live="polite"
		>
			<h2
				className={`text-xl font-semibold ${p.feedback.correct ? "text-accent" : "text-red-600"}`}
			>
				{p.feedback.correct ? "Correct" : "Incorrect"}
			</h2>
			<p className="mt-3">
				<b>Answer:</b> <MathText text={p.question.answer} />
			</p>
			<p className="mt-2 text-muted">
				<MathText text={p.question.explanation} />
			</p>
			{p.question.choices && (
				<details className="mt-4 text-sm text-muted">
					<summary>Why the other choices are wrong</summary>
					{p.question.choices
						.filter((c) => c.text !== p.question.answer)
						.map((c) => (
							<p className="mt-2" key={c.id}>
								<b>{c.id}:</b> {c.reason}
							</p>
						))}
				</details>
			)}
			{p.question.alternate && (
				<p className="mt-3 text-sm">
					<b>Alternate solution:</b> <MathText text={p.question.alternate} />
				</p>
			)}
			{p.question.desmos && (
				<p className="mt-2 text-sm">
					<b>Calculator method:</b> <MathText text={p.question.desmos} />
				</p>
			)}
			{!p.feedback.correct && (
				<fieldset className="mt-5">
					<legend className="text-sm font-semibold">
						What caused the miss?
					</legend>
					<div className="mt-2 flex flex-wrap gap-2">
						{ERRORS.map((x) => (
							<button
								type="button"
								key={x}
								className={`btn text-sm ${p.errorKind === x ? "border-ink" : ""}`}
								aria-pressed={p.errorKind === x}
								onClick={() => p.setErrorKind(x)}
							>
								{x}
							</button>
						))}
					</div>
				</fieldset>
			)}
			<button
				type="button"
				disabled={!p.feedback.correct && !p.errorKind}
				className="btn primary mt-6 disabled:opacity-40"
				onClick={p.next}
			>
				{p.target && p.count + 1 >= p.target ? "See results" : "Next question"}{" "}
				<span className="opacity-60">↵</span>
			</button>
		</div>
	);
}

function Results({
	attempts,
	onReview,
	onHome,
}: {
	attempts: Attempt[];
	onReview: () => void;
	onHome: () => void;
}) {
	const correct = attempts.filter((a) => a.correct).length,
		cal = confidenceCalibration(attempts),
		slow = attempts.filter((a) => a.correct && a.elapsedMs > 90000).length,
		patterns = recurringErrors(attempts, 2);
	return (
		<section className="mx-auto max-w-4xl py-12">
			<p className="text-sm text-muted">RUSH COMPLETE</p>
			<h1 className="mt-2 text-4xl font-semibold">
				{correct}/{attempts.length} correct
			</h1>
			<div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Metric
					label="Accuracy"
					value={`${Math.round((100 * correct) / Math.max(1, attempts.length))}%`}
				/>
				<Metric
					label="Average time"
					value={formatTime(
						attempts.reduce((s, a) => s + a.elapsedMs, 0) /
							Math.max(1, attempts.length),
					)}
				/>
				<Metric
					label="High-confidence errors"
					value={String(cal.highConfidenceErrors)}
				/>
				<Metric label="Slow correct" value={String(slow)} />
			</div>
			<div className="card mt-6 p-6">
				<h2 className="font-semibold">Do this next</h2>
				<p className="mt-2 text-muted">
					{cal.highConfidenceErrors
						? "Review a high-confidence error first; it carries the greatest misconception risk."
						: patterns[0]
							? `Address the recurring pattern: ${patterns[0].key.replace(":", " — ")}.`
							: "Continue with spaced, mixed retrieval when the next concept becomes due."}
				</p>
				<div className="mt-5 flex gap-2">
					<button type="button" className="btn primary" onClick={onReview}>
						Review attempts
					</button>
					<button type="button" className="btn" onClick={onHome}>
						Home
					</button>
				</div>
			</div>
		</section>
	);
}

function Review({
	attempts,
	onRedo,
}: {
	attempts: Attempt[];
	onRedo: (question: Question) => void;
}) {
	const [status, setStatus] = useState("all"),
		[confidence, setConfidence] = useState("all"),
		[concept, setConcept] = useState("all"),
		[difficulty, setDifficulty] = useState("all"),
		[query, setQuery] = useState("");
	const filtered = attempts
		.filter(
			(a) =>
				(status === "all" ||
					(status === "incorrect" ? !a.correct : a.elapsedMs > 90000)) &&
				(confidence === "all" || a.confidence === confidence) &&
				(concept === "all" || a.question.conceptId === concept) &&
				(difficulty === "all" ||
					String(a.question.difficulty) === difficulty) &&
				matchesSearch(a, query),
		)
		.sort((a, b) => b.at.localeCompare(a.at));
	return (
		<section className="py-10">
			<h1 className="text-3xl font-semibold">Review evidence</h1>
			<p className="mt-2 text-muted">
				Filter observations. Try “geometry mistakes,” “guessed,” or “over 90
				seconds.”
			</p>
			<div className="mt-6 grid gap-2 md:grid-cols-5">
				<select
					className="btn"
					value={status}
					onChange={(e) => setStatus(e.target.value)}
				>
					<option value="all">All outcomes</option>
					<option value="incorrect">Incorrect</option>
					<option value="slow">Slow</option>
				</select>
				<select
					className="btn"
					value={confidence}
					onChange={(e) => setConfidence(e.target.value)}
				>
					<option value="all">All confidence</option>
					{CONFIDENCE.map((x) => (
						<option key={x}>{x}</option>
					))}
				</select>
				<select
					className="btn"
					value={concept}
					onChange={(e) => setConcept(e.target.value)}
				>
					<option value="all">All concepts</option>
					{concepts.map((x) => (
						<option value={x.id} key={x.id}>
							{x.name}
						</option>
					))}
				</select>
				<select
					className="btn"
					value={difficulty}
					onChange={(e) => setDifficulty(e.target.value)}
				>
					<option value="all">All levels</option>
					{[1, 2, 3, 4].map((x) => (
						<option key={x}>{x}</option>
					))}
				</select>
				<input
					className="btn"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search in plain language"
				/>
			</div>
			<p className="mt-4 text-sm text-muted">{filtered.length} attempts</p>
			<div className="mt-4 grid gap-3">
				{filtered.map((a) => (
					<article className="card p-5" key={a.id}>
						<div className="flex justify-between gap-4">
							<b>{conceptById.get(a.question.conceptId)?.name}</b>
							<span className={a.correct ? "text-accent" : "text-red-600"}>
								{a.correct ? "Correct" : "Incorrect"}
							</span>
						</div>
						<p className="mt-2 text-sm">
							<MathText text={a.question.prompt} />
						</p>
						<p className="mt-2 text-sm text-muted">
							Level {a.question.difficulty} ·{" "}
							{a.question.representation ?? "default"} ·{" "}
							{formatTime(a.elapsedMs)} · {a.confidence}
							{a.errorKind ? ` · ${a.errorKind}` : ""} ·{" "}
							{new Date(a.at).toLocaleDateString()}
						</p>
						<button
							type="button"
							className="btn mt-4 text-sm"
							onClick={() => onRedo(a.question)}
						>
							Redo this question
						</button>
					</article>
				))}
				{!filtered.length && (
					<p className="card p-8 text-muted">
						No attempts match these filters.
					</p>
				)}
			</div>
		</section>
	);
}

function Library({ state }: { state: State }) {
	return (
		<section className="py-10">
			<h1 className="text-3xl font-semibold">Concept library</h1>
			<p className="mt-2 text-muted">
				Probabilistic estimates include uncertainty. Untested concepts remain
				unknown, not failed.
			</p>
			{["Math", "Reading & Writing"].map((domain) => (
				<div key={domain} className="mt-8">
					<h2 className="text-xl font-semibold">{domain}</h2>
					<div className="mt-3 grid gap-3 md:grid-cols-2">
						{concepts
							.filter((c) => c.domain === domain)
							.map((c) => {
								const b = state.beliefs[c.id];
								return (
									<article className="card p-4" key={c.id}>
										<div className="flex justify-between gap-3">
											<div>
												<b>{c.name}</b>
												<span className="block text-sm text-muted">
													{c.area}
												</span>
											</div>
											<span>{b ? `${Math.round(b.mean * 100)}%` : "—"}</span>
										</div>
										{b && (
											<>
												<div className="mt-3 h-2 overflow-hidden rounded bg-line">
													<div
														className="h-full bg-accent"
														style={{ width: `${b.mean * 100}%` }}
													/>
												</div>
												<p className="mt-2 text-xs text-muted">
													95% interval {Math.round(b.lower95 * 100)}–
													{Math.round(b.upper95 * 100)}% · retention{" "}
													{Math.round(b.retention * 100)}% · {b.exposures}{" "}
													exposures
												</p>
											</>
										)}
									</article>
								);
							})}
					</div>
				</div>
			))}
		</section>
	);
}

function Analytics({ state }: { state: State }) {
	const attempts = state.attempts,
		cal = confidenceCalibration(attempts),
		calc = attempts.filter((a) => a.calculator?.opened),
		errors = ERRORS.map((kind) => ({
			kind,
			count: attempts.filter((a) => a.errorKind === kind).length,
		})).sort((a, b) => b.count - a.count),
		representations = [
			...new Set(attempts.map((a) => a.question.representation ?? "default")),
		].map((rep) => ({
			rep,
			count: attempts.filter(
				(a) => (a.question.representation ?? "default") === rep,
			).length,
		}));
	return (
		<section className="py-10">
			<h1 className="text-3xl font-semibold">Learning analytics</h1>
			<p className="mt-2 text-muted">
				These measures explain learning evidence; they do not reward activity.
			</p>
			<div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Metric
					value={String(attempts.length)}
					label="retrieval observations"
				/>
				<Metric
					value={
						attempts.length
							? `${Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100)}%`
							: "—"
					}
					label="accuracy"
				/>
				<Metric
					value={attempts.length ? cal.brier.toFixed(2) : "—"}
					label="confidence error"
				/>
				<Metric
					value={
						attempts.length
							? `${Math.round((calc.length / attempts.length) * 100)}%`
							: "—"
					}
					label="calculator use"
				/>
			</div>
			<div className="mt-7 grid gap-5 lg:grid-cols-2">
				<div className="card p-6">
					<h2 className="font-semibold">Concept heatmap</h2>
					<div
						className="mt-4 grid grid-cols-6 gap-2"
						role="img"
						aria-label="Concept mastery heatmap"
					>
						{concepts.map((c) => {
							const b = state.beliefs[c.id];
							return (
								<div
									key={c.id}
									title={`${c.name}: ${b ? `${Math.round(b.mean * 100)}%` : "untested"}`}
									className="aspect-square rounded border border-line"
									style={{
										background: b
											? `color-mix(in srgb, var(--accent) ${Math.round(b.mean * 100)}%, var(--paper))`
											: "var(--paper)",
									}}
								/>
							);
						})}
					</div>
				</div>
				<div className="card p-6">
					<h2 className="font-semibold">Error trends</h2>
					<BarList
						items={errors.map((x) => ({ label: x.kind, value: x.count }))}
					/>
				</div>
				<div className="card p-6">
					<h2 className="font-semibold">Representation coverage</h2>
					<BarList
						items={representations.map((x) => ({
							label: x.rep,
							value: x.count,
						}))}
					/>
				</div>
				<div className="card p-6">
					<h2 className="font-semibold">Confidence diagnostic</h2>
					<p className="mt-3 text-sm text-muted">
						{cal.highConfidenceErrors} high-confidence errors ·{" "}
						{cal.luckyCorrect} lucky correct · signed overconfidence{" "}
						{cal.overconfidence.toFixed(2)}
					</p>
				</div>
			</div>
			<SessionReplay state={state} />
		</section>
	);
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
	const max = Math.max(1, ...items.map((x) => x.value));
	return (
		<div className="mt-4 grid gap-3">
			{items.map((x) => (
				<div key={x.label}>
					<div className="flex justify-between text-sm">
						<span>{x.label}</span>
						<span>{x.value}</span>
					</div>
					<div className="mt-1 h-2 rounded bg-line">
						<div
							className="h-full rounded bg-accent"
							style={{ width: `${(x.value / max) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
function SessionReplay({ state }: { state: State }) {
	const sessions = state.sessions.filter((s) => s.attemptIds.length),
		[selected, setSelected] = useState(sessions.at(-1)?.id ?? ""),
		session = state.sessions.find((s) => s.id === selected),
		attempts =
			session?.attemptIds
				.map((id) => state.attempts.find((a) => a.id === id))
				.filter((a): a is Attempt => Boolean(a)) ?? [];
	return (
		<div className="card mt-7 p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold">Session replay</h2>
					<p className="text-sm text-muted">
						Evidence and mastery updates in sequence.
					</p>
				</div>
				<select
					className="btn"
					value={selected}
					onChange={(e) => setSelected(e.target.value)}
				>
					{sessions.map((s) => (
						<option value={s.id} key={s.id}>
							{new Date(s.startedAt).toLocaleString()} · {s.attemptIds.length}{" "}
							questions
						</option>
					))}
				</select>
			</div>
			<ol className="mt-5 grid gap-3">
				{attempts.map((a, i) => (
					<li key={a.id} className="border-l-2 border-line pl-4">
						<b>
							{i + 1}. {conceptById.get(a.question.conceptId)?.name}
						</b>
						<p className="text-sm text-muted">
							{a.correct ? "Correct" : "Incorrect"} · {formatTime(a.elapsedMs)}{" "}
							· {a.confidence}
							{a.errorKind ? ` · ${a.errorKind}` : ""}
						</p>
					</li>
				))}
				{!attempts.length && (
					<li className="text-muted">No completed session to replay.</li>
				)}
			</ol>
		</div>
	);
}

function ScientificSummary({ state }: { state: State }) {
	const math = aggregateAbility(
			concepts
				.filter((c) => c.domain === "Math")
				.map((c) => ({ id: c.id, weight: c.frequency })),
			state.beliefs,
		),
		reading = aggregateAbility(
			concepts
				.filter((c) => c.domain === "Reading & Writing")
				.map((c) => ({ id: c.id, weight: c.frequency })),
			state.beliefs,
		),
		queue = reviewQueue(state.beliefs, new Date(), 3),
		confidenceValue: Record<Confidence, number> = {
			Guess: 0.25,
			Unsure: 0.5,
			"Pretty Sure": 0.75,
			Certain: 1,
		},
		profile = buildLearningProfile(
			state.attempts.map((attempt) => ({
				conceptId: attempt.question.conceptId,
				representation: attempt.question.representation ?? "default",
				correct: attempt.correct,
				elapsedMs: attempt.elapsedMs,
				expectedMs: attempt.question.domain === "Math" ? 95_000 : 70_000,
				confidence: confidenceValue[attempt.confidence],
				errorKind: attempt.errorKind,
			})),
		),
		certified = concepts.filter((concept) => {
			const rows = state.attempts.filter(
				(attempt) => attempt.question.conceptId === concept.id,
			);
			if (!rows.length) return false;
			const correct = rows.filter((attempt) => attempt.correct);
			const calibration =
				1 -
				rows.reduce(
					(sum, attempt) =>
						sum +
						Math.abs(
							confidenceValue[attempt.confidence] - Number(attempt.correct),
						),
					0,
				) /
					rows.length;
			return certifyMastery({
				accuracy: correct.length / rows.length,
				speedRatio:
					rows.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) /
					rows.length /
					(concept.domain === "Math" ? 95_000 : 70_000),
				confidenceCalibration: calibration,
				representationCount: new Set(
					rows.map((attempt) => attempt.question.representation ?? "default"),
				).size,
				difficultyReached: Math.max(
					...correct.map((attempt) => attempt.question.difficulty),
					0,
				),
				retention: state.beliefs[concept.id]?.retention ?? 0,
				recentFailures: rows.slice(-3).filter((attempt) => !attempt.correct)
					.length,
				successfulAttempts: correct.length,
				lastSuccessfulAt: correct.at(-1)?.at,
			}).certified;
		});
	return (
		<div className="card mt-7 p-6">
			<h2 className="font-semibold">Ability and review uncertainty</h2>
			<div className="mt-4 grid gap-4 md:grid-cols-2">
				<p>
					<b>Math</b>
					<span className="block text-sm text-muted">
						{Math.round(math.mean * 100)}% · 95% interval{" "}
						{Math.round(math.lower95 * 100)}–{Math.round(math.upper95 * 100)}% ·
						coverage {Math.round(math.coverage * 100)}%
					</span>
				</p>
				<p>
					<b>Reading & Writing</b>
					<span className="block text-sm text-muted">
						{Math.round(reading.mean * 100)}% · 95% interval{" "}
						{Math.round(reading.lower95 * 100)}–
						{Math.round(reading.upper95 * 100)}% · coverage{" "}
						{Math.round(reading.coverage * 100)}%
					</span>
				</p>
			</div>
			<h3 className="mt-5 font-semibold">Highest-value review</h3>
			<ol className="mt-2 text-sm text-muted">
				{queue.map((item) => (
					<li key={item.conceptId}>
						{conceptById.get(item.conceptId)?.name} · {item.reason} · current
						retention {Math.round(item.retention * 100)}%
					</li>
				))}
			</ol>
			{!queue.length && (
				<p className="mt-2 text-sm text-muted">
					Complete a Rush to estimate review priority.
				</p>
			)}
			<div className="mt-6 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
				<div>
					<h3 className="font-semibold">Personalized learning profile</h3>
					<p className="mt-2 text-sm text-muted">
						{profile.strengths.length
							? `Observed strengths: ${profile.strengths.map((id) => conceptById.get(id)?.name ?? id).join(", ")}.`
							: "More repeated evidence is needed before naming a strength."}
					</p>
					<p className="mt-2 text-sm text-muted">
						{profile.weaknesses.length
							? `Review opportunities: ${profile.weaknesses.map((id) => conceptById.get(id)?.name ?? id).join(", ")}.`
							: "No repeatable weakness has crossed the reporting threshold."}
					</p>
					{profile.patterns.map((pattern) => (
						<p className="mt-2 text-sm text-muted" key={pattern}>
							{pattern}.
						</p>
					))}
				</div>
				<div>
					<h3 className="font-semibold">True mastery certification</h3>
					<p className="mt-2 text-sm text-muted">
						{certified.length} of {concepts.length} concepts currently meet the
						accuracy, speed, confidence, representation, difficulty, and
						retention gates.
					</p>
					{certified.length > 0 && (
						<p className="mt-2 text-sm text-muted">
							{certified.map((concept) => concept.name).join(", ")}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function Metric({ value, label }: { value: string; label: string }) {
	return (
		<div className="card p-5">
			<b className="text-2xl">{value}</b>
			<span className="mt-1 block text-sm text-muted">{label}</span>
		</div>
	);
}
function formatTime(ms: number) {
	const seconds = Math.round(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function matchesSearch(a: Attempt, raw: string) {
	const q = raw.trim().toLowerCase();
	if (!q) return true;
	const concept = conceptById.get(a.question.conceptId),
		haystack =
			`${a.question.prompt} ${concept?.name} ${concept?.area} ${a.errorKind ?? ""} ${a.confidence} ${a.question.representation ?? ""}`.toLowerCase();
	if (q.includes("mistake") && a.correct) return false;
	if (q.includes("guessed") && a.confidence !== "Guess") return false;
	const seconds = q.match(/(?:over|more than)\s+(\d+)\s*seconds?/);
	if (seconds && a.elapsedMs <= Number(seconds[1]) * 1000) return false;
	if (
		q.includes("last month") &&
		Date.now() - new Date(a.at).getTime() > 31 * 86_400_000
	)
		return false;
	const ignored = [
		"mistakes",
		"mistake",
		"questions",
		"question",
		"guessed",
		"over",
		"more",
		"than",
		"seconds",
		"last",
		"month",
		"from",
	];
	const terms = q
		.replace(/\d+/g, "")
		.split(/\s+/)
		.filter((x) => x && !ignored.includes(x));
	return terms.every((term) => haystack.includes(term));
}
