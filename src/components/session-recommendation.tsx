import type { SessionSignals } from "@/intelligence/session";
export function SessionRecommendation({
	signal,
	end,
}: {
	signal: SessionSignals;
	end: () => void;
}) {
	if (signal.recommendation === "continue") return null;
	return (
		<aside className="card mt-4 border-amber-600 p-4" role="status">
			<b>
				{signal.recommendation === "pause"
					? "Consider a break"
					: "Stop and review"}
			</b>
			<p className="mt-1 text-sm text-muted">
				{signal.reason}. Continuing now is unlikely to be the best use of study
				time.
			</p>
			<button type="button" className="btn mt-3" onClick={end}>
				End session
			</button>
		</aside>
	);
}
