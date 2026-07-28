export type CoverageConcept = {
	id: string;
	domain: string;
	area: string;
};

export type CoverageTemplate = {
	id: string;
	conceptId: string;
	representation?: string;
	/** A parameterized template may omit these fields; it then covers every expected level. */
	difficulty?: string | number;
	difficulties?: readonly (string | number)[];
	supportedDifficulties?: readonly (string | number)[];
};

export type ShipGateThresholds = {
	minimumConceptCoverage: number;
	minimumDomainCoverage: number;
	minimumAreaCoverage: number;
	minimumRepresentations: number;
	minimumDifficultyLevels: number;
	maximumDuplicateIds: number;
	maximumUnknownConceptReferences: number;
};

export type CoverageAuditOptions = {
	expectedDifficulties?: readonly (string | number)[];
	thresholds?: Partial<ShipGateThresholds>;
};

export type GroupCoverage = {
	name: string;
	conceptCount: number;
	coveredConceptCount: number;
	coverage: number;
	missingConceptIds: string[];
};

export type CoverageAudit = {
	totals: { concepts: number; templates: number; coveredConcepts: number };
	missingConceptIds: string[];
	unknownConceptReferences: string[];
	representationCounts: Record<string, number>;
	difficultyCoverage: {
		expected: (string | number)[];
		counts: Record<string, number>;
		missingLevels: (string | number)[];
		missingByConcept: Record<string, (string | number)[]>;
	};
	duplicateIds: { concepts: string[]; templates: string[] };
	domainCoverage: GroupCoverage[];
	areaCoverage: GroupCoverage[];
	shipGate: {
		passed: boolean;
		thresholds: ShipGateThresholds;
		metrics: {
			conceptCoverage: number;
			domainCoverage: number;
			areaCoverage: number;
			representations: number;
			difficultyLevels: number;
			duplicateIds: number;
			unknownConceptReferences: number;
		};
		failures: string[];
	};
};

const DEFAULT_DIFFICULTIES = [1, 2, 3, 4] as const;
const DEFAULT_THRESHOLDS: ShipGateThresholds = {
	minimumConceptCoverage: 1,
	minimumDomainCoverage: 1,
	minimumAreaCoverage: 1,
	minimumRepresentations: 4,
	minimumDifficultyLevels: 4,
	maximumDuplicateIds: 0,
	maximumUnknownConceptReferences: 0,
};

const sorted = (values: Iterable<string>) =>
	[...values].sort((a, b) => a.localeCompare(b));
const ratio = (covered: number, total: number) =>
	total === 0 ? 1 : covered / total;

function duplicates(values: readonly string[]) {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return sorted(
		[...counts].filter(([, count]) => count > 1).map(([value]) => value),
	);
}

function levelsFor(
	template: CoverageTemplate,
	expected: readonly (string | number)[],
) {
	const explicit =
		template.supportedDifficulties ??
		template.difficulties ??
		(template.difficulty === undefined ? undefined : [template.difficulty]);
	return explicit ? [...new Set(explicit)] : [...expected];
}

function groups(
	concepts: readonly CoverageConcept[],
	covered: ReadonlySet<string>,
	key: (concept: CoverageConcept) => string,
) {
	const result = new Map<string, Set<string>>();
	for (const concept of concepts) {
		const name = key(concept);
		const ids = result.get(name) ?? new Set<string>();
		ids.add(concept.id);
		result.set(name, ids);
	}
	return sorted(result.keys()).map((name): GroupCoverage => {
		const ids = result.get(name) ?? new Set<string>();
		const coveredIds = [...ids].filter((id) => covered.has(id));
		return {
			name,
			conceptCount: ids.size,
			coveredConceptCount: coveredIds.length,
			coverage: ratio(coveredIds.length, ids.size),
			missingConceptIds: sorted([...ids].filter((id) => !covered.has(id))),
		};
	});
}

/**
 * Audits metadata only; generation and subject-specific correctness belong to separate validators.
 * Area names are qualified by domain so identically named areas in different exams stay distinct.
 */
export function auditContentCoverage(
	concepts: readonly CoverageConcept[],
	templates: readonly CoverageTemplate[],
	options: CoverageAuditOptions = {},
): CoverageAudit {
	const expected = [
		...new Set(options.expectedDifficulties ?? DEFAULT_DIFFICULTIES),
	];
	const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
	const conceptIds = new Set(concepts.map((concept) => concept.id));
	const knownTemplates = templates.filter((template) =>
		conceptIds.has(template.conceptId),
	);
	const covered = new Set(knownTemplates.map((template) => template.conceptId));
	const missingConceptIds = sorted(
		[...conceptIds].filter((id) => !covered.has(id)),
	);
	const unknownConceptReferences = sorted(
		new Set(
			templates
				.filter((template) => !conceptIds.has(template.conceptId))
				.map((template) => template.conceptId),
		),
	);

	const representationCounts: Record<string, number> = {};
	for (const template of templates) {
		const representation = template.representation?.trim() || "unspecified";
		representationCounts[representation] =
			(representationCounts[representation] ?? 0) + 1;
	}

	const counts: Record<string, number> = Object.fromEntries(
		expected.map((level) => [String(level), 0]),
	);
	const levelsByConcept = new Map<string, Set<string>>();
	for (const template of knownTemplates) {
		const supported = levelsFor(template, expected);
		const conceptLevels =
			levelsByConcept.get(template.conceptId) ?? new Set<string>();
		for (const level of supported) {
			const key = String(level);
			conceptLevels.add(key);
			if (Object.hasOwn(counts, key)) counts[key] += 1;
		}
		levelsByConcept.set(template.conceptId, conceptLevels);
	}
	const missingByConcept: Record<string, (string | number)[]> = {};
	for (const conceptId of sorted(conceptIds)) {
		const present = levelsByConcept.get(conceptId) ?? new Set<string>();
		const missing = expected.filter((level) => !present.has(String(level)));
		if (missing.length) missingByConcept[conceptId] = missing;
	}

	const domainCoverage = groups(concepts, covered, (concept) => concept.domain);
	const areaCoverage = groups(
		concepts,
		covered,
		(concept) => `${concept.domain} / ${concept.area}`,
	);
	const conceptCoverage = ratio(covered.size, conceptIds.size);
	const domainCoverageRate = ratio(
		domainCoverage.filter((group) => group.coverage === 1).length,
		domainCoverage.length,
	);
	const areaCoverageRate = ratio(
		areaCoverage.filter((group) => group.coverage === 1).length,
		areaCoverage.length,
	);
	const duplicateIds = {
		concepts: duplicates(concepts.map((concept) => concept.id)),
		templates: duplicates(templates.map((template) => template.id)),
	};
	const metrics = {
		conceptCoverage,
		domainCoverage: domainCoverageRate,
		areaCoverage: areaCoverageRate,
		representations: Object.keys(representationCounts).filter(
			(key) => key !== "unspecified",
		).length,
		difficultyLevels: expected.filter((level) => counts[String(level)] > 0)
			.length,
		duplicateIds: duplicateIds.concepts.length + duplicateIds.templates.length,
		unknownConceptReferences: unknownConceptReferences.length,
	};
	const failures: string[] = [];
	if (metrics.conceptCoverage < thresholds.minimumConceptCoverage)
		failures.push("concept coverage below threshold");
	if (metrics.domainCoverage < thresholds.minimumDomainCoverage)
		failures.push("domain coverage below threshold");
	if (metrics.areaCoverage < thresholds.minimumAreaCoverage)
		failures.push("area coverage below threshold");
	if (metrics.representations < thresholds.minimumRepresentations)
		failures.push("representation coverage below threshold");
	if (metrics.difficultyLevels < thresholds.minimumDifficultyLevels)
		failures.push("difficulty coverage below threshold");
	if (metrics.duplicateIds > thresholds.maximumDuplicateIds)
		failures.push("duplicate IDs exceed threshold");
	if (
		metrics.unknownConceptReferences >
		thresholds.maximumUnknownConceptReferences
	)
		failures.push("unknown concept references exceed threshold");

	return {
		totals: {
			concepts: conceptIds.size,
			templates: templates.length,
			coveredConcepts: covered.size,
		},
		missingConceptIds,
		unknownConceptReferences,
		representationCounts: Object.fromEntries(
			Object.entries(representationCounts).sort(([a], [b]) =>
				a.localeCompare(b),
			),
		),
		difficultyCoverage: {
			expected,
			counts,
			missingLevels: expected.filter((level) => counts[String(level)] === 0),
			missingByConcept,
		},
		duplicateIds,
		domainCoverage,
		areaCoverage,
		shipGate: { passed: failures.length === 0, thresholds, metrics, failures },
	};
}
