import type { ContentProvenance } from "./provenance.ts";
export type OfficialSource = {
	id: string;
	name: string;
	description: string;
	url: string;
	access: "public-download" | "account-required" | "app-required";
	provenance: ContentProvenance;
};
const external = (
	id: string,
	name: string,
	description: string,
	url: string,
	access: OfficialSource["access"],
): OfficialSource => ({
	id,
	name,
	description,
	url,
	access,
	provenance: {
		origin: "official-external",
		publisher: "College Board",
		sourceUrl: url,
		sourceId: id,
		licenseScope: "external-reference-only",
	},
});
export const officialSources: OfficialSource[] = [
	external(
		"college-board-sqb",
		"Student Question Bank",
		"Thousands of filterable official SAT Suite practice questions. Content stays in College Board's signed-in experience.",
		"https://satsuite.collegeboard.org/practice/student-question-bank",
		"account-required",
	),
	external(
		"college-board-bluebook",
		"Bluebook practice",
		"Official adaptive full-length practice and test preview.",
		"https://bluebook.collegeboard.org/students/practice",
		"app-required",
	),
	external(
		"college-board-paper-tests",
		"Released paper practice bundles",
		"Official downloadable nonadaptive tests, scoring guides, and explanations.",
		"https://satsuite.collegeboard.org/practice/practice-tests/paper",
		"public-download",
	),
	...[4, 5, 6, 7, 8, 9, 10, 11].map((number) =>
		external(
			`college-board-practice-${number}`,
			`Official SAT Practice Test ${number}`,
			"Full-length official nonadaptive SAT practice test. Question text remains in College Board's PDF.",
			`https://satsuite.collegeboard.org/media/pdf/sat-practice-test-${number}-digital.pdf`,
			"public-download",
		),
	),
];
