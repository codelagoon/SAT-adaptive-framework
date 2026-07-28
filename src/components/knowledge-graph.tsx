import { conceptById, concepts } from "@/core/concepts";
import type { ProbabilisticMastery } from "@/core/types";
export function KnowledgeGraph({
	beliefs,
}: {
	beliefs: Record<string, ProbabilisticMastery>;
}) {
	const connected = concepts.filter((c) => c.prerequisites.length);
	return (
		<section className="mt-10">
			<h2 className="text-xl font-semibold">Dependency evidence</h2>
			<p className="mt-2 text-sm text-muted">
				Connections transfer only weak evidence. Mastering a prerequisite does
				not certify its descendants.
			</p>
			<div className="mt-4 grid gap-3 md:grid-cols-2">
				{connected.map((concept) => (
					<article className="card p-4" key={concept.id}>
						<div className="flex flex-wrap items-center gap-2 text-sm">
							{concept.prerequisites.map((id) => (
								<span className="rounded border border-line px-2 py-1" key={id}>
									{conceptById.get(id)?.name}{" "}
									{beliefs[id] ? `${Math.round(beliefs[id].mean * 100)}%` : "—"}
								</span>
							))}
							<span aria-hidden="true">→</span>
							<b>
								{concept.name}{" "}
								{beliefs[concept.id]
									? `${Math.round(beliefs[concept.id].mean * 100)}%`
									: "—"}
							</b>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
