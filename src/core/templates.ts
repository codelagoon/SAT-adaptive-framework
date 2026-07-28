import type {
	Attempt,
	Difficulty,
	ProbabilisticMastery,
	Question,
	Representation,
} from "./types.ts";
import { concepts } from "./concepts.ts";
import { generateValidated } from "../intelligence/validation.ts";
import { selectCandidate } from "../intelligence/selection.ts";
import { mathExtraTemplates } from "../content/templates/math-extra.ts";
import { rwExtraTemplates } from "../content/templates/rw-extra.ts";

const int = (r: () => number, min: number, max: number) =>
	min + Math.floor(r() * (max - min + 1));
const pick = <T>(r: () => number, x: readonly T[]) =>
	x[Math.floor(r() * x.length)]!;
const shuffle = <T>(r: () => number, x: T[]) =>
	x
		.map((v) => ({ v, k: r() }))
		.sort((a, b) => a.k - b.k)
		.map((x) => x.v);
const id = () => crypto.randomUUID();
const choices = (
	r: () => number,
	answer: string,
	wrong: string[],
	reason: string,
) =>
	shuffle(r, [answer, ...wrong.filter((x) => x !== answer)].slice(0, 4)).map(
		(text, i) => ({
			id: String.fromCharCode(65 + i),
			text,
			reason:
				text === answer
					? "This satisfies every condition in the question."
					: reason,
		}),
	);
export type Template = {
	id: string;
	conceptId: string;
	representation: Representation;
	generate: (r: () => number, d: Difficulty) => Question;
};

export const templates: Template[] = [
	{
		id: "linear-solve",
		conceptId: "linear-equations",
		representation: "equation",
		generate: (r, d) => {
			const x = int(r, 2, 7 + d),
				a = int(r, 2, 4 + d),
				b = int(r, 1, 12),
				c = a * x + b,
				z = String(x);
			return {
				id: id(),
				templateId: "linear-solve",
				conceptId: "linear-equations",
				domain: "Math",
				difficulty: d,
				representation: "equation",
				prompt: `If $${a}x+${b}=${c}$, what is the value of $x$?`,
				kind: "multiple-choice",
				choices: choices(
					r,
					z,
					[String(x + 1), String(x - 1), String(c - b)],
					"It results from an inverse-operation or arithmetic error.",
				),
				answer: z,
				explanation: `Subtract ${b}, then divide by ${a}: $x=(${c}-${b})/${a}=${x}$.`,
				alternate: "Substitute the choices into the original equation.",
				desmos: `Graph $y=${a}x+${b}$ and $y=${c}$; use the intersection's x-coordinate.`,
				preferredMethod: "either",
			};
		},
	},
	{
		id: "systems-context",
		conceptId: "systems",
		representation: "word-problem",
		generate: (r, d) => {
			const adult = int(r, 8, 15),
				student = int(r, 3, 7),
				a = int(r, 2, 5 + d),
				s = int(r, 3, 7 + d),
				tickets = a + s,
				revenue = adult * a + student * s;
			return {
				id: id(),
				templateId: "systems-context",
				conceptId: "systems",
				domain: "Math",
				difficulty: d,
				representation: "word-problem",
				prompt: `A venue sold ${tickets} tickets. Adult tickets cost $${adult} and student tickets cost $${student}. Revenue was $${revenue}. How many adult tickets were sold?`,
				kind: "grid-in",
				answer: String(a),
				explanation: `Let $a+s=${tickets}$ and $${adult}a+${student}s=${revenue}$. Substitution gives $a=${a}$.`,
				desmos: "Graph both equations and read the adult-ticket coordinate.",
				preferredMethod: "either",
			};
		},
	},
	{
		id: "percent-change",
		conceptId: "percent",
		representation: "real-world",
		generate: (r, d) => {
			const base = pick(r, [40, 50, 80, 100, 120]),
				p = pick(r, [10, 20, 25, 30]) + 5 * (d - 1),
				ans = base * (1 + p / 100);
			return {
				id: id(),
				templateId: "percent-change",
				conceptId: "percent",
				domain: "Math",
				difficulty: d,
				representation: "real-world",
				prompt: `A quantity of ${base} is increased by ${p}%. What is the new value?`,
				kind: "numeric",
				answer: String(ans),
				explanation: `Multiply by $1+${p}/100$: $${base}(${1 + p / 100})=${ans}$.`,
				alternate: `Find ${p}% of ${base}, then add it to ${base}.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "mean-missing",
		conceptId: "statistics-center",
		representation: "table",
		generate: (r, d) => {
			const n = 4 + d,
				target = int(r, 6, 15),
				vals = Array.from({ length: n - 1 }, () => int(r, 2, 16)),
				missing = target * n - vals.reduce((a, b) => a + b, 0);
			return {
				id: id(),
				templateId: "mean-missing",
				conceptId: "statistics-center",
				domain: "Math",
				difficulty: d,
				representation: "table",
				prompt: `The values are ${vals.join(", ")}, and $x$. If their mean is ${target}, what is $x$?`,
				kind: "numeric",
				answer: String(missing),
				explanation: `The required total is $${target}\\times${n}=${target * n}$. Subtract the known sum ${vals.reduce((a, b) => a + b, 0)} to get $x=${missing}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "probability-count",
		conceptId: "probability",
		representation: "real-world",
		generate: (r, d) => {
			const red = int(r, 2, 7 + d),
				blue = int(r, 3, 9 + d),
				z = `${red}/${red + blue}`;
			return {
				id: id(),
				templateId: "probability-count",
				conceptId: "probability",
				domain: "Math",
				difficulty: d,
				representation: "real-world",
				prompt: `A bag contains ${red} red tokens and ${blue} blue tokens. One token is selected at random. What is the probability it is red?`,
				kind: "grid-in",
				answer: z,
				explanation: `Favorable outcomes over total outcomes gives $${red}/(${red}+${blue})=${z}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "triangle-area",
		conceptId: "triangles",
		representation: "diagram",
		generate: (r, d) => {
			const base = int(r, 4, 12 + d),
				height = int(r, 3, 10 + d),
				ans = (base * height) / 2;
			return {
				id: id(),
				templateId: "triangle-area",
				conceptId: "triangles",
				domain: "Math",
				difficulty: d,
				representation: "diagram",
				prompt: `A triangle has base ${base} and perpendicular height ${height}. What is its area?`,
				kind: "numeric",
				answer: String(ans),
				explanation: `Use $A=\\frac12 bh$: $A=\\frac12(${base})(${height})=${ans}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "quadratic-roots",
		conceptId: "quadratics",
		representation: "equation",
		generate: (r, d) => {
			const p = int(r, 1, 4 + d),
				q = int(r, p + 1, 7 + d),
				b = -(p + q),
				c = p * q,
				z = String(p);
			return {
				id: id(),
				templateId: "quadratic-roots",
				conceptId: "quadratics",
				domain: "Math",
				difficulty: d,
				representation: "equation",
				prompt: `One solution to $x^2${b}x+${c}=0$ is ${q}. What is the other solution?`,
				kind: "numeric",
				answer: z,
				explanation: `The expression factors as $(x-${p})(x-${q})$, so the other solution is ${p}.`,
				alternate: `The solutions sum to ${-b}; subtract ${q}.`,
				desmos: "Graph the quadratic and inspect its x-intercepts.",
				preferredMethod: "either",
			};
		},
	},
	{
		id: "exponent-product",
		conceptId: "exponents",
		representation: "equation",
		generate: (r, d) => {
			const a = int(r, 2, 6),
				b = int(r, 2, 5 + d),
				z = String(a + b);
			return {
				id: id(),
				templateId: "exponent-product",
				conceptId: "exponents",
				domain: "Math",
				difficulty: d,
				representation: "equation",
				prompt: `For $x>0$, $x^{${a}}\\cdot x^{${b}}=x^n$. What is $n$?`,
				kind: "numeric",
				answer: z,
				explanation: `When multiplying like bases, add exponents: $n=${a}+${b}=${z}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "slope-table",
		conceptId: "slope",
		representation: "table",
		generate: (r, d) => {
			const x1 = int(r, -4, 1),
				step = int(r, 1, 3),
				m = int(r, 2, 4 + d),
				b = int(r, -5, 5),
				x2 = x1 + step,
				y1 = m * x1 + b,
				y2 = m * x2 + b;
			return {
				id: id(),
				templateId: "slope-table",
				conceptId: "slope",
				domain: "Math",
				difficulty: d,
				representation: "table",
				prompt: `The table contains the points $(${x1},${y1})$ and $(${x2},${y2})$. What is the slope of the line through them?`,
				kind: "grid-in",
				answer: String(m),
				explanation: `$m=(${y2}-${y1})/(${x2}-${x1})=${m}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "function-value",
		conceptId: "function-notation",
		representation: "equation",
		generate: (r, d) => {
			const a = int(r, 2, 4 + d),
				b = int(r, -6, 6),
				x = int(r, -3, 5),
				ans = a * x + b;
			return {
				id: id(),
				templateId: "function-value",
				conceptId: "function-notation",
				domain: "Math",
				difficulty: d,
				representation: "equation",
				prompt: `If $f(x)=${a}x${b < 0 ? b : `+${b}`}$, what is $f(${x})$?`,
				kind: "numeric",
				answer: String(ans),
				explanation: `Substitute ${x}: $f(${x})=${a}(${x})${b < 0 ? b : `+${b}`}=${ans}$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "circle-area",
		conceptId: "circles",
		representation: "diagram",
		generate: (r, d) => {
			const radius = int(r, 2, 6 + d),
				coefficient = radius * radius;
			return {
				id: id(),
				templateId: "circle-area",
				conceptId: "circles",
				domain: "Math",
				difficulty: d,
				representation: "diagram",
				prompt: `A circle has radius ${radius}. Its area can be written as $k\\pi$. What is $k$?`,
				kind: "grid-in",
				answer: String(coefficient),
				explanation: `$A=\\pi r^2=\\pi(${radius})^2=${coefficient}\\pi$.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "inequality-context",
		conceptId: "inequalities",
		representation: "word-problem",
		generate: (r, d) => {
			const fee = int(r, 2, 6),
				each = int(r, 3, 5 + d),
				budget = int(r, 25, 60),
				ans = Math.floor((budget - fee) / each);
			return {
				id: id(),
				templateId: "inequality-context",
				conceptId: "inequalities",
				domain: "Math",
				difficulty: d,
				representation: "word-problem",
				prompt: `A service charges a $${fee} fee plus $${each} per item. With at most $${budget}, what is the greatest number of items that can be purchased?`,
				kind: "grid-in",
				answer: String(ans),
				explanation: `Solve $${fee}+${each}x\\le ${budget}$. Thus $x\\le ${(budget - fee) / each}$, so the greatest whole number is ${ans}.`,
				preferredMethod: "hand",
			};
		},
	},
	{
		id: "transition-logic",
		conceptId: "transitions",
		representation: "passage",
		generate: (r, d) => {
			const bank = [
					{
						p: "The trial was small. ___, its result justified a larger study.",
						a: "Nevertheless",
						w: ["Similarly", "For example", "Therefore"],
					},
					{
						p: "The material is light and inexpensive. ___, it is widely used in packaging.",
						a: "Therefore",
						w: ["However", "Meanwhile", "For instance"],
					},
					{
						p: "The team measured rainfall. ___, it recorded soil moisture at each site.",
						a: "In addition",
						w: ["Instead", "Nevertheless", "Consequently"],
					},
				],
				q = pick(r, bank);
			return {
				id: id(),
				templateId: "transition-logic",
				conceptId: "transitions",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt: q.p,
				kind: "multiple-choice",
				choices: choices(
					r,
					q.a,
					q.w,
					"It signals a logical relationship unsupported by the surrounding claims.",
				),
				answer: q.a,
				explanation: `“${q.a}” precisely signals the relationship between the claims.`,
			};
		},
	},
	{
		id: "sentence-boundary",
		conceptId: "boundaries",
		representation: "passage",
		generate: (r, d) => {
			const subject = pick(r, [
					"The telescope",
					"The archive",
					"The experiment",
				]),
				detail = pick(r, [
					"was completed in May",
					"contains rare letters",
					"produced an unexpected result",
				]),
				answer = `${subject} ${detail}; researchers published their analysis later.`,
				wrong = [
					`${subject} ${detail}, researchers published their analysis later.`,
					`${subject} ${detail} researchers, published their analysis later.`,
					`${subject} ${detail}: and researchers published their analysis later.`,
				];
			return {
				id: id(),
				templateId: "sentence-boundary",
				conceptId: "boundaries",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt:
					"Which choice completes the text so that it conforms to Standard English conventions?",
				kind: "multiple-choice",
				choices: choices(
					r,
					answer,
					wrong,
					"It joins or separates the independent clauses incorrectly.",
				),
				answer,
				explanation:
					"A semicolon correctly joins the two closely related independent clauses.",
			};
		},
	},
	{
		id: "words-context",
		conceptId: "words-context",
		representation: "passage",
		generate: (r, d) => {
			const topic = pick(r, ["the result", "the pattern", "the discrepancy"]),
				answer = "subtle",
				wrong = ["obvious", "irrelevant", "uniform"];
			return {
				id: id(),
				templateId: "words-context",
				conceptId: "words-context",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt: `Although initially overlooked, ${topic} became clear after repeated measurements. Which choice most logically completes the text? The pattern was _____.`,
				kind: "multiple-choice",
				choices: choices(
					r,
					answer,
					wrong,
					"It conflicts with the clue that repeated measurement was needed.",
				),
				answer,
				explanation:
					"“Subtle” matches something initially difficult to notice but later detectable.",
			};
		},
	},
	{
		id: "central-idea",
		conceptId: "central-ideas",
		representation: "passage",
		generate: (r, d) => {
			const organism = pick(r, [
					"urban birds",
					"desert plants",
					"coastal insects",
				]),
				answer = `Adaptation can help ${organism} persist under changing conditions.`,
				wrong = [
					`All ${organism} respond identically to change.`,
					`Environmental change always eliminates ${organism}.`,
					`Researchers no longer study ${organism}.`,
				];
			return {
				id: id(),
				templateId: "central-idea",
				conceptId: "central-ideas",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt: `Researchers observed that some ${organism} changed their behavior when conditions shifted. Populations showing the change remained stable, while others declined. Which choice best states the main idea?`,
				kind: "multiple-choice",
				choices: choices(
					r,
					answer,
					wrong,
					"It is absolute or introduces a claim the text does not support.",
				),
				answer,
				explanation:
					"The text links an adaptive change with population stability.",
			};
		},
	},
	{
		id: "inference",
		conceptId: "inferences",
		representation: "passage",
		generate: (r, d) => {
			const answer =
					"The coating likely reduced the metal's exposure to moisture.",
				wrong = [
					"The coated samples contained no metal.",
					"Moisture never affects uncoated metal.",
					"The researchers expected both groups to corrode equally.",
				];
			return {
				id: id(),
				templateId: "inference",
				conceptId: "inferences",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt:
					"Researchers placed coated and uncoated metal samples in humid chambers. After a week, the uncoated samples showed substantially more corrosion. Which conclusion is best supported?",
				kind: "multiple-choice",
				choices: choices(
					r,
					answer,
					wrong,
					"It overstates or contradicts the evidence.",
				),
				answer,
				explanation:
					"The controlled difference supports a protective effect of the coating.",
			};
		},
	},
	{
		id: "subject-verb",
		conceptId: "agreement",
		representation: "passage",
		generate: (r, d) => {
			const noun = pick(r, [
					"A collection of manuscripts",
					"The series of experiments",
					"A group of volunteers",
				]),
				answer = "is",
				wrong = ["are", "were being", "have been"];
			return {
				id: id(),
				templateId: "subject-verb",
				conceptId: "agreement",
				domain: "Reading & Writing",
				difficulty: d,
				representation: "passage",
				prompt: `${noun} _____ available for review. Which choice completes the text according to Standard English conventions?`,
				kind: "multiple-choice",
				choices: choices(
					r,
					answer,
					wrong,
					"It does not agree with the singular head noun.",
				),
				answer,
				explanation:
					"The head noun is singular, so the singular verb “is” agrees.",
			};
		},
	},
	...mathExtraTemplates,
	...rwExtraTemplates,
];

export function makeQuestion(
	r: () => number,
	d: Difficulty,
	conceptId?: string,
) {
	const pool = conceptId
		? templates.filter((t) => t.conceptId === conceptId)
		: templates;
	return generateValidated(() =>
		pick(r, pool.length ? pool : templates).generate(r, d),
	);
}
export function makeAdaptiveQuestion(
	r: () => number,
	beliefs: Record<string, ProbabilisticMastery>,
	recent: Attempt[],
) {
	const ranked = selectCandidate(
		templates.map((t) => ({
			templateId: t.id,
			conceptId: t.conceptId,
			representation: t.representation,
			difficulty: Math.max(
				1,
				Math.min(4, Math.round((beliefs[t.conceptId]?.mean ?? 0.35) * 4)),
			),
		})),
		beliefs,
		recent,
		concepts,
	);
	const t =
			templates.find((x) => x.id === ranked?.candidate.templateId) ??
			pick(r, templates),
		d = (ranked?.candidate.difficulty ?? 1) as Difficulty;
	return generateValidated(() => t.generate(r, d));
}
