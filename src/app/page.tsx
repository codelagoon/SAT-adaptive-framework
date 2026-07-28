"use client";
import { Calculator, Moon, Pause, Play, Sun, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { buildLearningProfile } from "@/analytics/profile";
import { MathText } from "@/components/math-text";
import { SessionRecommendation } from "@/components/session-recommendation";
import { SyncControl, type SyncStatus } from "@/components/sync-control";
import { conceptById, concepts } from "@/core/concepts";
import { answersEqual } from "@/core/engine";
import { hydrate, record, type State, save } from "@/core/store";
import type { Attempt, Confidence, ErrorKind, Question } from "@/core/types";
import { aggregateAbility } from "@/intelligence/ability";
import {
  confidenceCalibration,
  recurringErrors,
} from "@/intelligence/calibration";
import { reviewQueue } from "@/intelligence/scheduling";
import { sessionSignals } from "@/intelligence/session";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  loadCloudProgress,
  progressFromState,
  saveCloudProgress,
} from "@/lib/supabase/progress";
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
type DesmosInstance = {
  destroy: () => void;
  resize: () => void;
  focusFirstExpression: () => void;
};
type DesmosApi = {
  GraphingCalculator: (
    element: HTMLElement,
    options: Record<string, boolean>,
  ) => DesmosInstance;
};
let desmosApiPromise: Promise<DesmosApi> | null = null;

function loadDesmosApi(apiKey: string) {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  if (desmosApiPromise) return desmosApiPromise;
  desmosApiPromise = new Promise<DesmosApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.dataset.precisionDesmos = "true";
    script.onload = () =>
      window.Desmos
        ? resolve(window.Desmos)
        : reject(new Error("Desmos API unavailable"));
    script.onerror = () => reject(new Error("Desmos API failed to load"));
    document.head.appendChild(script);
  });
  return desmosApiPromise;
}

declare global {
  interface Window {
    Desmos?: DesmosApi;
  }
}

export default function Home() {
  const [state, setState] = useState<State>(EMPTY),
    [bankLoading, setBankLoading] = useState(true),
    [hydrated, setHydrated] = useState(false),
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
  const [cloudUser, setCloudUser] = useState<User | null>(null),
    [syncReady, setSyncReady] = useState(false),
    [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [practicePool, setPracticePool] = useState<Question[] | null>(null),
    [practiceCursor, setPracticeCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null),
    stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    void hydrate().then(async (stored) => {
      try {
        const response = await fetch("/api/local-questions", {
          cache: "no-store",
        });
        if (response.ok) {
          const localQuestions =
            (await response.json()) as State["localQuestions"];
          const next = { ...stored, localQuestions };
          setState(next);
          save(next);
        } else setState(stored);
      } catch {
        setState(stored);
      } finally {
        setBankLoading(false);
        setHydrated(true);
      }
    });
    setDark(localStorage.getItem("precision-theme") === "dark");
    setCalculator(localStorage.getItem("precision-calculator") === "open");
    setFontScale(Number(localStorage.getItem("precision-font-scale")) || 1);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("precision-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setSyncStatus("local");
      return;
    }
    let active = true;
    void client.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setCloudUser(data.user ?? null);
      setSyncStatus(error ? "error" : data.user ? "loading" : "signed-out");
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setCloudUser(session?.user ?? null);
      setSyncStatus(session?.user ? "loading" : "signed-out");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const client = getSupabaseClient();
    if (!client || !cloudUser) {
      setSyncReady(false);
      if (client) setSyncStatus("signed-out");
      return;
    }
    let active = true;
    setSyncReady(false);
    setSyncStatus("loading");
    void loadCloudProgress(client, cloudUser.id)
      .then(async (cloud) => {
        if (!active) return;
        if (cloud) {
          setState((current) => {
            const next = {
              ...cloud.state,
              localQuestions: current.localQuestions,
            };
            save(next);
            return next;
          });
        } else {
          const owner = localStorage.getItem("precision-cloud-owner");
          if (owner && owner !== cloudUser.id) {
            const blank = {
              ...progressFromState(EMPTY),
              localQuestions: stateRef.current.localQuestions,
            };
            setState(blank);
            save(blank);
            await saveCloudProgress(
              client,
              cloudUser.id,
              progressFromState(blank),
            );
          } else {
            await saveCloudProgress(
              client,
              cloudUser.id,
              progressFromState(stateRef.current),
            );
          }
        }
        if (!active) return;
        localStorage.setItem("precision-cloud-owner", cloudUser.id);
        setSyncReady(true);
        setSyncStatus("synced");
      })
      .catch(() => {
        if (active) setSyncStatus("error");
      });
    return () => {
      active = false;
    };
  }, [cloudUser, hydrated]);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !cloudUser || !syncReady) return;
    const progress = progressFromState(state);
    const timeout = window.setTimeout(() => {
      setSyncStatus("loading");
      void saveCloudProgress(client, cloudUser.id, progress)
        .then(() => {
          localStorage.setItem("precision-cloud-owner", cloudUser.id);
          setSyncStatus("synced");
        })
        .catch(() => setSyncStatus("error"));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [cloudUser, state, syncReady]);
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
    if (!pool?.length) return;
    const nextCursor = (cursor + 1) % pool.length;
    setPracticeCursor(nextCursor);
    presentQuestion({ ...pool[nextCursor], id: crypto.randomUUID() });
  }
  function begin(nextTarget: number | null, conceptId?: string) {
    const pool = state.localQuestions
      .map((record) => record.content)
      .filter((candidate) => !conceptId || candidate.conceptId === conceptId);
    if (!pool.length) return;
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
    setPracticePool(pool);
    setPracticeCursor(-1);
    setView("rush");
    nextQuestion(next, pool, -1);
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
  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-3 md:px-7 md:py-4">
      <header className="flex h-12 items-center justify-between border-b border-line">
        <button
          type="button"
          onClick={() => setView("home")}
          className="flex items-center gap-3 font-semibold"
        >
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>Precision SAT</span>
        </button>
        <nav aria-label="Primary" className="flex items-center gap-1.5">
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
          <SyncControl user={cloudUser} status={syncStatus} />
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
            bankLoading={bankLoading}
            begin={begin}
            setView={setView}
          />
        </>
      )}
      {view === "rush" && question && (
        <div className="viewport-stack">
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
        </div>
      )}
      {view === "results" && (
        <Results
          attempts={sessionAttempts}
          onReview={() => setView("review")}
          onHome={() => setView("home")}
        />
      )}
      {view === "review" && <Review attempts={state.attempts} onRedo={redo} />}
      {view === "library" && <Library state={state} />}
      {view === "analytics" && <Analytics state={state} />}
    </main>
  );
}

function HomeView({
  state,
  bankLoading,
  begin,
  setView,
}: {
  state: State;
  bankLoading: boolean;
  begin: (n: number | null, conceptId?: string) => void;
  setView: (v: View) => void;
}) {
  const beliefs = Object.values(state.beliefs),
    mean = beliefs.length
      ? beliefs.reduce((s, b) => s + b.mean, 0) / beliefs.length
      : null,
    inventory = new Map<string, number>();
  for (const record of state.localQuestions) {
    inventory.set(
      record.content.conceptId,
      (inventory.get(record.content.conceptId) ?? 0) + 1,
    );
  }
  const ranked = concepts
      .map((concept) => ({
        concept,
        belief: state.beliefs[concept.id],
        bankCount: inventory.get(concept.id) ?? 0,
        gap: state.beliefs[concept.id]
          ? 1 - state.beliefs[concept.id].mean
          : null,
      }))
      .filter((item) => item.bankCount > 0)
      .sort((a, b) => {
        if (a.gap === null && b.gap !== null) return -1;
        if (a.gap !== null && b.gap === null) return 1;
        return (b.gap ?? 0) - (a.gap ?? 0);
      }),
    mission = ranked[0],
    missionQuestionCount = mission ? Math.min(10, mission.bankCount) : 0,
    secondsPerQuestion =
      mission?.concept.domain === "Math" ? (70 * 60) / 44 : (64 * 60) / 54,
    missionMinutes = Math.ceil(
      (missionQuestionCount * secondsPerQuestion) / 60,
    ),
    mathBeliefs = beliefs.filter(
      (belief) => conceptById.get(belief.conceptId)?.domain === "Math",
    ),
    readingBeliefs = beliefs.filter(
      (belief) =>
        conceptById.get(belief.conceptId)?.domain === "Reading & Writing",
    ),
    average = (rows: typeof beliefs, key: "mean" | "retention") =>
      rows.length
        ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length
        : null,
    recent = state.attempts.slice(-4).reverse();
  return (
    <section className="mission-dashboard py-3">
      <article className="card projection-panel control-panel">
        <PanelHeading
          label="SAT PROJECTION"
          title="Score system"
          meta="CALIBRATING"
        />
        <div className="flex min-h-0 flex-1 items-center justify-between gap-5">
          <div>
            <strong className="font-mono text-6xl tabular-nums">—</strong>
            <p className="mt-2 text-sm text-muted">
              Representative calibration required
            </p>
          </div>
          <div
            className="projection-ring"
            aria-label="Projection confidence unavailable"
          >
            <span>CONF</span>
            <b>—</b>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
          <Metric value="—" label="target" compact />
          <Metric value="—" label="remaining" compact />
          <Metric
            value={String(state.sessions.length)}
            label="missions"
            compact
          />
        </div>
      </article>

      <article className="card mission-panel control-panel">
        <PanelHeading
          label="TODAY'S MISSION"
          title="Evidence-based focus"
          meta={missionQuestionCount ? "READY" : "UNAVAILABLE"}
        />
        {mission ? (
          <>
            <div className="grid flex-1 items-center gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm text-accent">{mission.concept.area}</p>
                <h1 className="mt-1 text-balance text-4xl font-semibold">
                  {mission.concept.name}
                </h1>
                <p className="mt-3 max-w-xl text-pretty text-sm text-muted">
                  {mission.belief
                    ? "Selected because it has the largest observed mastery gap among concepts available in this OpenSAT bank."
                    : "Selected as an untested concept that is available in this OpenSAT bank."}
                </p>
              </div>
              <div className="mission-specs">
                <div>
                  <span>QUESTIONS</span>
                  <b>{missionQuestionCount}</b>
                </div>
                <div>
                  <span>TIME BUDGET</span>
                  <b>{missionMinutes} min</b>
                </div>
                <div>
                  <span>EVIDENCE GAP</span>
                  <b>
                    {mission.gap === null
                      ? "—"
                      : `${Math.round(mission.gap * 100)}%`}
                  </b>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn primary w-full disabled:opacity-40"
              disabled={bankLoading || !missionQuestionCount}
              onClick={() => begin(missionQuestionCount, mission.concept.id)}
            >
              {bankLoading
                ? "Connecting to OpenSAT bank"
                : state.localQuestions.length
                  ? "Begin OpenSAT mission"
                  : "OpenSAT bank unavailable"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </>
        ) : (
          <p className="my-auto text-pretty text-sm text-muted">
            No compatible concepts are available in the local OpenSAT bank.
          </p>
        )}
      </article>

      <article className="card health-panel control-panel">
        <PanelHeading label="SYSTEM HEALTH" title="Knowledge status" />
        <div className="mt-3 grid gap-3">
          <SignalBar label="Overall model estimate" value={mean} />
          <SignalBar
            label="Math model estimate"
            value={average(mathBeliefs, "mean")}
          />
          <SignalBar
            label="Reading model estimate"
            value={average(readingBeliefs, "mean")}
          />
          <SignalBar
            label="Modeled retention"
            value={average(beliefs, "retention")}
          />
        </div>
      </article>

      <article className="card opportunity-panel control-panel">
        <PanelHeading label="PRACTICE QUEUE" title="Evidence gaps" />
        <ol className="mt-2 grid gap-2">
          {ranked.slice(0, 4).map((item, index) => (
            <li className="opportunity-row" key={item.concept.id}>
              <span className="font-mono text-xs text-muted">0{index + 1}</span>
              <div className="min-w-0">
                <b className="block truncate">{item.concept.name}</b>
                <span className="text-xs text-muted">{item.concept.area}</span>
              </div>
              <b className="font-mono tabular-nums">
                {item.gap === null ? "NEW" : `${Math.round(item.gap * 100)}%`}
              </b>
            </li>
          ))}
        </ol>
      </article>

      <article className="card feed-panel control-panel">
        <PanelHeading label="MISSION FEED" title="Recent evidence" />
        <ol className="mt-2 grid gap-2">
          {recent.map((attempt) => (
            <li className="feed-row" key={attempt.id}>
              <i
                className={attempt.correct ? "bg-accent" : "bg-red-600"}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <b className="block truncate">
                  {conceptById.get(attempt.question.conceptId)?.name}
                </b>
                <span className="text-xs text-muted">
                  {attempt.correct
                    ? "Retrieval confirmed"
                    : "Review opportunity"}{" "}
                  · {formatTime(attempt.elapsedMs)}
                </span>
              </div>
            </li>
          ))}
          {!recent.length && (
            <li className="text-pretty text-sm text-muted">
              Launch the first mission to begin the evidence feed.
            </li>
          )}
        </ol>
        <div className="mt-auto flex gap-2 pt-3">
          <button
            type="button"
            className="btn flex-1"
            onClick={() => setView("review")}
          >
            Review
          </button>
          <button
            type="button"
            className="btn flex-1"
            onClick={() => setView("analytics")}
          >
            Analytics
          </button>
        </div>
      </article>

      <article className="card library-panel control-panel">
        <PanelHeading
          label="OPENSAT BANK"
          title="Mission source"
          meta={
            bankLoading
              ? "CONNECTING"
              : state.localQuestions.length
                ? "LOCAL / READY"
                : "UNAVAILABLE"
          }
        />
        <div className="my-auto">
          <strong className="font-mono text-4xl tabular-nums">
            {state.localQuestions.length.toLocaleString()}
          </strong>
          <span className="block text-sm text-muted">
            structurally compatible questions
          </span>
        </div>
        <p className="text-pretty text-xs text-muted">
          OpenSAT contributors are the sole question source. This local
          community archive is not presented as an official College Board bank.
        </p>
        {!state.localQuestions.length && (
          <a
            className="btn mt-3"
            href="https://github.com/Anas099X/OpenSAT"
            target="_blank"
            rel="noreferrer"
          >
            View OpenSAT source
          </a>
        )}
      </article>
    </section>
  );
}

function PanelHeading({
  label,
  title,
  meta,
}: {
  label: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="eyebrow">{label}</p>
        <h2 className="mt-1 text-balance text-lg font-semibold">{title}</h2>
      </div>
      {meta && (
        <span className="status-chip">
          <i aria-hidden="true" />
          {meta}
        </span>
      )}
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number | null }) {
  const percent = value === null ? null : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <b className="font-mono tabular-nums">
          {percent === null ? "—" : `${percent}%`}
        </b>
      </div>
      <div className="signal-track">
        <div style={{ width: `${percent ?? 0}%` }} />
      </div>
    </div>
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
    <section className="practice-shell py-3">
      <header className="practice-hud card">
        <div>
          <span>MISSION</span>
          <b>{concept?.name}</b>
        </div>
        <div>
          <span>PROGRESS</span>
          <b className="tabular-nums">
            {p.count + 1}
            {p.target ? ` / ${p.target}` : ""}
          </b>
        </div>
        <div>
          <span>DIFFICULTY</span>
          <b>{difficultyLabel(p.question.difficulty)}</b>
        </div>
        <div>
          <span>PROJECTION</span>
          <b>CALIBRATING</b>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Timer size={16} aria-hidden="true" />
          <b className="font-mono tabular-nums">{formatTime(p.elapsedMs)}</b>
          <button
            type="button"
            className="hud-control"
            aria-label={p.paused ? "Resume" : "Pause"}
            onClick={() => p.setPaused((v) => !v)}
          >
            {p.paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      </header>
      {p.paused ? (
        <div className="card grid place-items-center text-center">
          <div>
            <p className="eyebrow">MISSION HOLD</p>
            <h2 className="mt-2 text-balance text-3xl font-semibold">
              Session paused
            </h2>
            <button
              type="button"
              className="btn primary mt-5"
              onClick={() => p.setPaused((v) => !v)}
            >
              Resume
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`practice-canvas ${p.calculator ? "with-calculator" : ""}`}
        >
          <article className="card min-h-0 overflow-auto p-5 md:p-7">
            <p className="text-pretty text-lg leading-7 md:text-xl md:leading-8">
              <MathText text={p.question.prompt} />
            </p>
            {p.question.choices ? (
              <div className="mt-5 grid gap-2">
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
            <fieldset className="mt-5 border-t border-line pt-4">
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
                className="btn primary mt-4 w-full disabled:opacity-40"
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
          {p.calculator && <DesmosPanel />}
        </div>
      )}
    </section>
  );
}

function DesmosPanel() {
  const hostRef = useRef<HTMLDivElement>(null),
    [status, setStatus] = useState<"loading" | "ready" | "slow">("loading");
  useEffect(() => {
    const apiKey =
      process.env.NEXT_PUBLIC_DESMOS_API_KEY ??
      (process.env.NODE_ENV === "development"
        ? "dcb31709b452b1cf9dc26972add0fda6"
        : "");
    if (!apiKey || !hostRef.current) {
      setStatus("slow");
      return;
    }
    let active = true,
      calculator: DesmosInstance | undefined;
    const timeout = window.setTimeout(() => {
      if (active) setStatus("slow");
    }, 12_000);
    void loadDesmosApi(apiKey)
      .then((Desmos) => {
        if (!active || !hostRef.current) return;
        calculator = Desmos.GraphingCalculator(hostRef.current, {
          expressions: true,
          keypad: true,
          keypadActivated: true,
          allowKeypadToBeDismissedWhenNarrow: false,
          graphpaper: true,
          settingsMenu: true,
          zoomButtons: true,
          expressionsCollapsed: false,
          autosize: true,
        });
        calculator.focusFirstExpression();
        window.clearTimeout(timeout);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("slow");
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      calculator?.destroy();
    };
  }, []);
  return (
    <aside
      className="card relative min-h-0 overflow-hidden"
      aria-label="Desmos calculator panel"
    >
      <div
        ref={hostRef}
        className="h-full w-full"
        aria-label="Desmos graphing calculator"
      />
      {status !== "ready" && (
        <div
          className="absolute inset-x-3 top-3 rounded-md border border-line bg-paper p-3 text-sm shadow-sm"
          role="status"
        >
          <b>
            {status === "loading"
              ? "Loading Desmos…"
              : "Desmos is taking longer than expected."}
          </b>
          {status === "slow" && (
            <a
              className="ml-2 underline"
              href="https://www.desmos.com/calculator"
              target="_blank"
              rel="noreferrer"
            >
              Open Desmos ↗
            </a>
          )}
        </div>
      )}
    </aside>
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
    patterns = recurringErrors(attempts, 2),
    accuracy = attempts.length
      ? Math.round((100 * correct) / attempts.length)
      : null,
    averageMs = attempts.length
      ? attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) /
        attempts.length
      : null,
    conceptResults = [
      ...new Set(attempts.map((attempt) => attempt.question.conceptId)),
    ]
      .map((id) => {
        const rows = attempts.filter(
          (attempt) => attempt.question.conceptId === id,
        );
        return {
          id,
          correct: rows.filter((attempt) => attempt.correct).length,
          total: rows.length,
        };
      })
      .slice(0, 5);
  return (
    <section className="results-grid py-3">
      <article className="card results-hero control-panel">
        <p className="eyebrow">MISSION COMPLETE</p>
        <h1 className="mt-2 text-balance text-4xl font-semibold">
          Evidence secured.
        </h1>
        <div className="mt-auto flex items-end justify-between gap-5">
          <div>
            <strong className="font-mono text-6xl tabular-nums">
              {accuracy === null ? "—" : `${accuracy}%`}
            </strong>
            <span className="block text-sm text-muted">mission accuracy</span>
          </div>
          <div className="text-right">
            <b className="font-mono text-2xl tabular-nums">
              {correct}/{attempts.length}
            </b>
            <span className="block text-sm text-muted">
              retrievals confirmed
            </span>
          </div>
        </div>
      </article>
      <article className="card results-metrics control-panel">
        <PanelHeading label="PERFORMANCE" title="Mission telemetry" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric
            value={averageMs === null ? "—" : formatTime(averageMs)}
            label="average solve"
          />
          <Metric
            value={String(cal.highConfidenceErrors)}
            label="confidence errors"
          />
          <Metric value={String(slow)} label="slow correct" />
          <Metric
            value={String(conceptResults.length)}
            label="concepts touched"
          />
        </div>
      </article>
      <article className="card results-concepts control-panel">
        <PanelHeading label="CONCEPT OUTCOMES" title="Session accuracy" />
        <div className="mt-3 grid gap-3">
          {conceptResults.map((result) => (
            <SignalBar
              key={result.id}
              label={conceptById.get(result.id)?.name ?? result.id}
              value={result.correct / result.total}
            />
          ))}
        </div>
      </article>
      <article className="card results-next control-panel">
        <PanelHeading
          label="NEXT MISSION"
          title="Recommended action"
          meta="READY"
        />
        <p className="my-auto text-pretty text-lg">
          {cal.highConfidenceErrors
            ? "Review a high-confidence error first; it carries the greatest misconception risk."
            : patterns[0]
              ? `Address the recurring pattern: ${patterns[0].key.replace(":", " — ")}.`
              : "Continue with spaced, mixed retrieval when the next concept becomes due."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn primary flex-1"
            onClick={onReview}
          >
            Review evidence
          </button>
          <button type="button" className="btn" onClick={onHome}>
            Mission Control
          </button>
        </div>
      </article>
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
    [query, setQuery] = useState(""),
    [selectedId, setSelectedId] = useState("");
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
      .sort((a, b) => b.at.localeCompare(a.at)),
    selected =
      filtered.find((attempt) => attempt.id === selectedId) ?? filtered[0];
  return (
    <section className="review-shell py-3">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">EVIDENCE REVIEW</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">
            Mission debrief
          </h1>
        </div>
        <p className="font-mono text-sm tabular-nums text-muted">
          {filtered.length} OBSERVATIONS
        </p>
      </header>
      <div className="review-filters">
        <select
          className="btn min-w-0"
          aria-label="Filter by outcome"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All outcomes</option>
          <option value="incorrect">Incorrect</option>
          <option value="slow">Slow</option>
        </select>
        <select
          className="btn min-w-0"
          aria-label="Filter by confidence"
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
        >
          <option value="all">All confidence</option>
          {CONFIDENCE.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          className="btn min-w-0"
          aria-label="Filter by concept"
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
          className="btn min-w-0"
          aria-label="Filter by difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="all">All levels</option>
          {[1, 2, 3, 4].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          className="btn min-w-0"
          aria-label="Search attempts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in plain language"
        />
      </div>
      <div className="review-workspace">
        <aside
          className="card min-h-0 overflow-auto p-2"
          aria-label="Attempt list"
        >
          {filtered.map((attempt, index) => (
            <button
              type="button"
              className={`attempt-row ${selected?.id === attempt.id ? "active" : ""}`}
              onClick={() => setSelectedId(attempt.id)}
              key={attempt.id}
            >
              <span className="font-mono text-xs text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-left">
                <b className="block truncate">
                  {conceptById.get(attempt.question.conceptId)?.name}
                </b>
                <small className="text-muted">
                  {formatTime(attempt.elapsedMs)} · {attempt.confidence}
                </small>
              </span>
              <i
                className={attempt.correct ? "bg-accent" : "bg-red-600"}
                aria-label={attempt.correct ? "Correct" : "Incorrect"}
              />
            </button>
          ))}
          {!filtered.length && (
            <div className="grid h-full place-items-center p-5 text-center">
              <div>
                <p className="text-pretty text-muted">
                  No evidence matches these filters.
                </p>
                <button
                  type="button"
                  className="btn mt-3"
                  onClick={() => {
                    setStatus("all");
                    setConfidence("all");
                    setConcept("all");
                    setDifficulty("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </aside>
        <article className="card min-h-0 overflow-auto p-5 md:p-6">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">SELECTED EVIDENCE</p>
                  <h2 className="mt-1 text-balance text-xl font-semibold">
                    {conceptById.get(selected.question.conceptId)?.name}
                  </h2>
                </div>
                <span
                  className={`status-chip ${selected.correct ? "" : "error"}`}
                >
                  {selected.correct ? "CONFIRMED" : "REVIEW"}
                </span>
              </div>
              <p className="mt-5 text-pretty">
                <MathText text={selected.question.prompt} />
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 md:grid-cols-4">
                <Metric
                  compact
                  value={difficultyLabel(selected.question.difficulty)}
                  label="difficulty"
                />
                <Metric
                  compact
                  value={formatTime(selected.elapsedMs)}
                  label="solve time"
                />
                <Metric
                  compact
                  value={selected.confidence}
                  label="confidence"
                />
                <Metric
                  compact
                  value={selected.errorKind ?? "—"}
                  label="error"
                />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="eyebrow">RESPONSE</p>
                  <p className="mt-1 text-sm">{selected.response}</p>
                </div>
                <div>
                  <p className="eyebrow">KEY</p>
                  <p className="mt-1 text-sm">
                    <MathText text={selected.question.answer} />
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="eyebrow">EXPLANATION</p>
                <p className="mt-2 text-pretty text-sm text-muted">
                  <MathText text={selected.question.explanation} />
                </p>
              </div>
              <button
                type="button"
                className="btn primary mt-5"
                onClick={() => onRedo(selected.question)}
              >
                Launch focused redo
              </button>
            </>
          ) : (
            <div className="grid h-full place-items-center text-muted">
              Select an observation to inspect.
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function Library({ state }: { state: State }) {
  const availableIds = new Set(
      state.localQuestions.map((record) => record.content.conceptId),
    ),
    visibleConcepts = concepts.filter(
      (concept) => availableIds.has(concept.id) || state.beliefs[concept.id],
    ),
    ranked = visibleConcepts
      .map((concept) => ({ concept, belief: state.beliefs[concept.id] }))
      .sort((a, b) => (a.belief?.mean ?? 0) - (b.belief?.mean ?? 0)),
    observed = ranked.filter((item) => item.belief),
    mastered = observed.filter(
      (item) => (item.belief?.mean ?? 0) >= 0.8,
    ).length,
    review = observed.filter(
      (item) => (item.belief?.retention ?? 1) < 0.6,
    ).length;
  return (
    <section className="concept-shell py-3">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">KNOWLEDGE SYSTEM</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">
            Concept radar
          </h1>
        </div>
        <p className="max-w-md text-pretty text-right text-sm text-muted">
          Untested concepts remain unknown—not failed. Node intensity reflects
          current evidence.
        </p>
      </header>
      <div className="concept-workspace">
        <article className="card min-h-0 overflow-auto p-4">
          <div
            className="concept-radar"
            role="img"
            aria-label="SAT concept mastery radar"
          >
            {visibleConcepts.map((concept) => {
              const belief = state.beliefs[concept.id],
                value = belief?.mean ?? 0;
              return (
                <div
                  className="concept-node"
                  style={{ "--mastery": value } as React.CSSProperties}
                  title={`${concept.name}: ${belief ? `${Math.round(value * 100)}% mastery, ${Math.round(belief.retention * 100)}% retention` : "untested"}`}
                  key={concept.id}
                >
                  <span>{concept.name}</span>
                  <b className="font-mono tabular-nums">
                    {belief ? `${Math.round(value * 100)}%` : "—"}
                  </b>
                </div>
              );
            })}
          </div>
        </article>
        <aside className="concept-rail">
          <section className="card control-panel">
            <PanelHeading label="SYSTEM STATUS" title="Coverage" />
            <div className="mt-4 grid grid-cols-3 divide-x divide-line text-center">
              <Metric
                compact
                value={String(observed.length)}
                label="observed"
              />
              <Metric compact value={String(mastered)} label="model ≥80%" />
              <Metric compact value={String(review)} label="retention <60%" />
            </div>
          </section>
          <section className="card control-panel min-h-0 overflow-auto">
            <PanelHeading label="CONCEPTS" title="Model estimates" />
            <ol className="mt-3 grid gap-2">
              {ranked.slice(0, 8).map((item, index) => (
                <li className="opportunity-row" key={item.concept.id}>
                  <span className="font-mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate">{item.concept.name}</b>
                    <span className="text-xs text-muted">
                      {item.concept.area}
                    </span>
                  </div>
                  <b className="font-mono tabular-nums">
                    {item.belief
                      ? `${Math.round(item.belief.mean * 100)}%`
                      : "—"}
                  </b>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Analytics({ state }: { state: State }) {
  const attempts = state.attempts,
    availableIds = new Set(
      state.localQuestions.map((record) => record.content.conceptId),
    ),
    visibleConcepts = concepts.filter(
      (concept) => availableIds.has(concept.id) || state.beliefs[concept.id],
    ),
    cal = confidenceCalibration(attempts),
    calc = attempts.filter((a) => a.calculator?.opened),
    accuracy = attempts.length
      ? attempts.filter((attempt) => attempt.correct).length / attempts.length
      : null,
    errors = ERRORS.map((kind) => ({
      kind,
      count: attempts.filter((a) => a.errorKind === kind).length,
    })).sort((a, b) => b.count - a.count),
    representations = [
      ...new Set(
        attempts.map((a) => a.question.representation ?? "unspecified"),
      ),
    ].map((rep) => ({
      rep,
      count: attempts.filter(
        (a) => (a.question.representation ?? "unspecified") === rep,
      ).length,
    }));
  return (
    <section className="analytics-shell py-3">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">PERFORMANCE CONTROL</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">
            Learning telemetry
          </h1>
        </div>
        <p className="max-w-md text-pretty text-right text-sm text-muted">
          Live evidence explains learning state; it does not reward activity.
        </p>
      </header>
      <div className="analytics-metrics card">
        <Metric value={String(attempts.length)} label="retrievals" compact />
        <Metric
          value={accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`}
          label="accuracy"
          compact
        />
        <Metric
          value={attempts.length ? cal.brier.toFixed(2) : "—"}
          label="confidence error"
          compact
        />
        <Metric
          value={
            attempts.length
              ? `${Math.round((calc.length / attempts.length) * 100)}%`
              : "—"
          }
          label="calculator"
          compact
        />
        <Metric
          value={String(
            new Set(attempts.map((attempt) => attempt.question.conceptId)).size,
          )}
          label="concept coverage"
          compact
        />
      </div>
      <div className="analytics-grid">
        <div className="card control-panel">
          <PanelHeading label="MASTERY MAP" title="Concept heatmap" />
          <div
            className="mt-3 grid grid-cols-8 gap-2"
            role="img"
            aria-label="Concept mastery heatmap"
          >
            {visibleConcepts.map((c) => {
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
          <div className="mt-auto flex gap-4 pt-3 text-xs text-muted">
            <span>No evidence</span>
            <span className="text-accent">Higher model estimate</span>
          </div>
        </div>
        <div className="card control-panel min-h-0 overflow-auto">
          <PanelHeading label="ERROR SYSTEM" title="Error trends" />
          <BarList
            items={errors.map((x) => ({ label: x.kind, value: x.count }))}
          />
        </div>
        <div className="card control-panel min-h-0 overflow-auto">
          <PanelHeading label="SOURCE METADATA" title="Representations" />
          {attempts.some((attempt) => attempt.question.representation) ? (
            <BarList
              items={representations.map((x) => ({
                label: x.rep,
                value: x.count,
              }))}
            />
          ) : (
            <p className="my-auto text-pretty text-sm text-muted">
              The local OpenSAT archive does not supply representation tags.
            </p>
          )}
        </div>
        <div className="card control-panel">
          <PanelHeading label="CONFIDENCE SYSTEM" title="Calibration" />
          <div className="my-auto grid grid-cols-3 divide-x divide-line text-center">
            <Metric
              compact
              value={String(cal.highConfidenceErrors)}
              label="high-conf errors"
            />
            <Metric
              compact
              value={String(cal.luckyCorrect)}
              label="lucky correct"
            />
            <Metric
              compact
              value={cal.overconfidence.toFixed(2)}
              label="bias"
            />
          </div>
          <SignalBar label="Observed accuracy" value={accuracy} />
        </div>
      </div>
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

function Metric({
  value,
  label,
  compact = false,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "px-2" : "card p-5"}>
      <b className="font-mono text-2xl tabular-nums">{value}</b>
      <span className="mt-1 block text-sm text-muted">{label}</span>
    </div>
  );
}
function formatTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function difficultyLabel(value: Question["difficulty"]) {
  if (value === 1) return "EASY";
  if (value === 2) return "MEDIUM";
  if (value === 4) return "HARD";
  return `LEVEL ${value}`;
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
