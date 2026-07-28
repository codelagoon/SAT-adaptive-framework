import type { Template } from "../../core/templates.ts";
import type { Difficulty, Question, Representation } from "../../core/types.ts";

const integer = (random: () => number, min: number, max: number) =>
	min + Math.floor(random() * (max - min + 1));
const choose = <T>(random: () => number, values: readonly T[]) => {
	const value = values[Math.floor(random() * values.length)];
	if (value === undefined) throw new Error("Cannot choose from an empty collection");
	return value;
};
const signed = (value: number) => (value < 0 ? String(value) : `+${value}`);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fraction = (numerator: number, denominator: number) => {
	const divisor = gcd(numerator, denominator);
	return `${numerator / divisor}/${denominator / divisor}`;
};
const shuffled = <T>(random: () => number, values: T[]) =>
	values
		.map((value) => ({ value, key: random() }))
		.sort((a, b) => a.key - b.key)
		.map((item) => item.value);
const multipleChoice = (
	random: () => number,
	answer: string,
	distractors: string[],
) => {
	const values = [answer, ...distractors.filter((value) => value !== answer)];
	if (new Set(values).size < 4)
		throw new Error(
			"A multiple-choice generator produced fewer than four unique options.",
		);
	return shuffled(random, values.slice(0, 4)).map((text, index) => ({
		id: String.fromCharCode(65 + index),
		text,
		reason:
			text === answer
				? "This value satisfies the stated relationships."
				: "This choice follows from a common setup, sign, or computation error.",
	}));
};
const question = (
	templateId: string,
	conceptId: string,
	difficulty: Difficulty,
	representation: Representation,
	prompt: string,
	answer: string,
	explanation: string,
	extra: Partial<Question> = {},
): Question => ({
	id: crypto.randomUUID(),
	templateId,
	conceptId,
	domain: "Math",
	difficulty,
	representation,
	prompt,
	kind: "numeric",
	answer,
	explanation,
	preferredMethod: "hand",
	...extra,
});

export const mathExtraTemplates: Template[] = [
	{
		id: "extra-linear-function-table",
		conceptId: "linear-functions",
		representation: "table",
		generate: (random, difficulty) => {
			const rate = integer(random, -5 - difficulty, 6 + difficulty) || 2;
			const initial = integer(random, -8, 8),
				input = integer(random, 2, 5 + difficulty),
				output = rate * input + initial;
			return question(
				"extra-linear-function-table",
				"linear-functions",
				difficulty,
				"table",
				`A linear function has $f(0)=${initial}$ and $f(${input})=${output}$. What is its rate of change?`,
				String(rate),
				`The rate of change is $(${output}-${initial})/(${input}-0)=${rate}$.`,
				{ alternate: `The function is $f(x)=${rate}x${signed(initial)}$.` },
			);
		},
	},
	{
		id: "extra-compound-inequality",
		conceptId: "inequalities",
		representation: "equation",
		generate: (random, difficulty) => {
			const center = integer(random, -4, 7),
				radius = integer(random, 2, 4 + difficulty),
				left = center - radius,
				right = center + radius,
				answer = `${left}<x<${right}`;
			return question(
				"extra-compound-inequality",
				"inequalities",
				difficulty,
				"equation",
				`Which interval is the solution to $|x-${center}|<${radius}$?`,
				answer,
				`Distance from ${center} must be less than ${radius}, so $${center}-${radius}<x<${center}+${radius}$, or $${answer}$.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`${left}<x<${right + 1}`,
						`x<${left} or x>${right}`,
						`${left + 1}<x<${right}`,
					]),
				},
			);
		},
	},
	{
		id: "extra-parallel-slope",
		conceptId: "slope",
		representation: "graph",
		generate: (random, difficulty) => {
			const rise = integer(random, 1, 4 + difficulty),
				run = integer(random, 2, 6),
				divisor = gcd(rise, run),
				numerator = rise / divisor,
				denominator = run / divisor,
				answer =
					denominator === 1
						? String(-numerator)
						: fraction(-numerator, denominator);
			return question(
				"extra-parallel-slope",
				"slope",
				difficulty,
				"graph",
				`A line falls ${rise} units for every ${run} units it moves to the right. What is the slope of any line parallel to it?`,
				answer,
				`Slope is change in $y$ divided by change in $x$: $-${rise}/${run}=${answer}$.`,
				{ alternate: "Parallel lines have equal slopes." },
			);
		},
	},
	{
		id: "extra-equivalent-expression",
		conceptId: "equivalent-expressions",
		representation: "equation",
		generate: (random, difficulty) => {
			const a = integer(random, 2, 5 + difficulty),
				b = integer(random, 1, 7),
				c = integer(random, 1, 6),
				answer = `${a}x+${a * b - c}`;
			return question(
				"extra-equivalent-expression",
				"equivalent-expressions",
				difficulty,
				"equation",
				`Which expression is equivalent to $${a}(x+${b})-${c}$?`,
				answer,
				`Distribute ${a} and combine constants: $${a}x+${a * b}-${c}=${answer}$.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`${a}x+${b - c}`,
						`${a}x+${a * b + c}`,
						`${a + 1}x+${a * b - c}`,
					]),
				},
			);
		},
	},
	{
		id: "extra-radical-simplify",
		conceptId: "radicals",
		representation: "equation",
		generate: (random, difficulty) => {
			const outside = integer(random, 2, 5 + difficulty),
				inside = choose(random, [2, 3, 5, 6, 7]),
				radicand = outside * outside * inside,
				answer = `${outside}√${inside}`;
			return question(
				"extra-radical-simplify",
				"radicals",
				difficulty,
				"equation",
				`Which expression is equivalent to $\\sqrt{${radicand}}$?`,
				answer,
				`Since $${radicand}=${outside * outside}\\cdot${inside}$, $\\sqrt{${radicand}}=${outside}\\sqrt{${inside}}$.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`${outside + 1}√${inside}`,
						`${outside}√${inside + 1}`,
						String(outside * inside),
					]),
				},
			);
		},
	},
	{
		id: "extra-polynomial-coefficient",
		conceptId: "polynomials",
		representation: "equation",
		generate: (random, difficulty) => {
			const a = integer(random, 1, 4 + difficulty),
				b = integer(random, -5, 6),
				c = integer(random, 1, 5),
				e = integer(random, -4, 5),
				answer = String(a * e + b * c);
			return question(
				"extra-polynomial-coefficient",
				"polynomials",
				difficulty,
				"equation",
				`What is the coefficient of $x$ in $(${a}x+${b})(${c}x+${e})$?`,
				answer,
				`The $x$ terms are $${a * e}x$ and $${b * c}x$; their coefficients sum to ${answer}.`,
			);
		},
	},
	{
		id: "extra-factoring-leading",
		conceptId: "factoring",
		representation: "equation",
		generate: (random, difficulty) => {
			const p = integer(random, 1, 4 + difficulty),
				q = integer(random, 2, 7),
				answer = `(x-${p})(x+${q})`,
				middle = q - p,
				constant = -p * q;
			return question(
				"extra-factoring-leading",
				"factoring",
				difficulty,
				"equation",
				`Which expression is equivalent to $x^2${signed(middle)}x${signed(constant)}$?`,
				answer,
				`The factors need product ${constant} and sum ${middle}; ${-p} and ${q} meet both conditions.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`(x+${p})(x-${q})`,
						`(x-${p})(x-${q})`,
						`(x+${p})(x+${q})`,
					]),
				},
			);
		},
	},
	{
		id: "extra-quadratic-vertex",
		conceptId: "quadratic-forms",
		representation: "graph",
		generate: (random, difficulty) => {
			const h = integer(random, -5, 5) || 5,
				k = integer(random, -7, 7) || -7,
				a = integer(random, 1, 2 + difficulty),
				answer = `(${h}, ${k})`;
			return question(
				"extra-quadratic-vertex",
				"quadratic-forms",
				difficulty,
				"graph",
				`The graph of $y=${a}(x-${h})^2${signed(k)}$ is a parabola. What is its vertex?`,
				answer,
				`Vertex form $y=a(x-h)^2+k$ has vertex $(h,k)$, so the vertex is ${answer}.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`(${-h}, ${k})`,
						`(${h}, ${-k})`,
						`(${-h}, ${-k})`,
					]),
					desmos: "Enter the equation and inspect the turning point.",
					preferredMethod: "either",
				},
			);
		},
	},
	{
		id: "extra-exponential-growth",
		conceptId: "nonlinear-functions",
		representation: "table",
		generate: (random, difficulty) => {
			const initial = integer(random, 2, 8),
				factor = integer(random, 2, 3 + Math.floor(difficulty / 2)),
				step = integer(random, 2, 3),
				answer = String(initial * factor ** step);
			return question(
				"extra-exponential-growth",
				"nonlinear-functions",
				difficulty,
				"table",
				`A sequence follows $f(n)=${initial}(${factor})^n$. What is $f(${step})$?`,
				answer,
				`Substitute ${step}: $f(${step})=${initial}(${factor})^{${step}}=${answer}$.`,
				{
					alternate: `Starting at ${initial}, multiply by ${factor} a total of ${step} times.`,
				},
			);
		},
	},
	{
		id: "extra-rational-restriction",
		conceptId: "rational-expressions",
		representation: "equation",
		generate: (random, difficulty) => {
			const excluded = integer(random, -7, 7) || 3,
				answer = String(excluded);
			return question(
				"extra-rational-restriction",
				"rational-expressions",
				difficulty,
				"equation",
				`For what value of $x$ is $\\dfrac{x+${integer(random, 1, 8)}}{x${signed(-excluded)}}$ undefined?`,
				answer,
				`A rational expression is undefined when its denominator is zero. Solving $x${signed(-excluded)}=0$ gives $x=${excluded}$.`,
			);
		},
	},
	{
		id: "extra-function-composition",
		conceptId: "function-notation",
		representation: "equation",
		generate: (random, difficulty) => {
			const a = integer(random, 2, 5),
				b = integer(random, -4, 5),
				c = integer(random, 1, 4 + difficulty),
				x = integer(random, -3, 4),
				answer = String(a * (x + c) + b);
			return question(
				"extra-function-composition",
				"function-notation",
				difficulty,
				"equation",
				`Let $f(x)=${a}x${signed(b)}$ and $g(x)=x+${c}$. What is $f(g(${x}))$?`,
				answer,
				`First, $g(${x})=${x + c}$. Then $f(${x + c})=${a}(${x + c})${signed(b)}=${answer}$.`,
			);
		},
	},
	{
		id: "extra-ratio-mixture",
		conceptId: "ratios",
		representation: "word-problem",
		generate: (random, difficulty) => {
			const first = integer(random, 2, 5),
				second = integer(random, 3, 7),
				scale = integer(random, 2, 5 + difficulty),
				total = (first + second) * scale,
				answer = String(first * scale);
			return question(
				"extra-ratio-mixture",
				"ratios",
				difficulty,
				"word-problem",
				`Red and blue beads are in the ratio ${first}:${second}. If there are ${total} beads altogether, how many are red?`,
				answer,
				`There are ${first + second} ratio parts, so each part is ${scale}. The red count is $${first}(${scale})=${answer}$.`,
			);
		},
	},
	{
		id: "extra-unit-conversion",
		conceptId: "units",
		representation: "real-world",
		generate: (random, difficulty) => {
			const hours = integer(random, 2, 5),
				milesPerHour = integer(random, 8, 18 + difficulty),
				answer = String(hours * milesPerHour * 5280);
			return question(
				"extra-unit-conversion",
				"units",
				difficulty,
				"real-world",
				`A cyclist travels at ${milesPerHour} miles per hour for ${hours} hours. How many feet does the cyclist travel? (1 mile = 5,280 feet)`,
				answer,
				`Distance is $${milesPerHour}(${hours})=${milesPerHour * hours}$ miles. Multiplying by 5,280 gives ${answer} feet.`,
			);
		},
	},
	{
		id: "extra-scatterplot-association",
		conceptId: "scatterplots",
		representation: "graph",
		generate: (random, difficulty) => {
			const direction = choose(random, ["positive", "negative"] as const),
				strength = difficulty >= 3 ? "weak" : "strong",
				answer = `A ${strength} ${direction} association`;
			const opposite = direction === "positive" ? "negative" : "positive";
			return question(
				"extra-scatterplot-association",
				"scatterplots",
				difficulty,
				"graph",
				`A scatterplot's points follow a ${strength === "strong" ? "tight" : "widely dispersed"} pattern that generally moves ${direction === "positive" ? "upward" : "downward"} from left to right. Which description fits the association?`,
				answer,
				`The overall ${direction === "positive" ? "upward" : "downward"} direction is ${direction}; the ${strength === "strong" ? "tight" : "dispersed"} clustering makes it ${strength}.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`A ${strength} ${opposite} association`,
						`A ${strength === "strong" ? "weak" : "strong"} ${direction} association`,
						`No association`,
					]),
				},
			);
		},
	},
	{
		id: "extra-conditional-probability",
		conceptId: "conditional-probability",
		representation: "table",
		generate: (random, difficulty) => {
			const group = integer(random, 12, 20 + difficulty),
				success = integer(random, 3, group - 3),
				answer = fraction(success, group);
			return question(
				"extra-conditional-probability",
				"conditional-probability",
				difficulty,
				"table",
				`In a survey, ${group} respondents chose option A, and ${success} of those respondents were under age 18. If a respondent who chose A is selected at random, what is the probability that the respondent is under 18?`,
				answer,
				`The condition restricts the sample to the ${group} respondents who chose A. Of these, ${success} are under 18, so the probability is $${success}/${group}=${answer}$.`,
			);
		},
	},
	{
		id: "extra-sampling-inference",
		conceptId: "sampling",
		representation: "real-world",
		generate: (random, difficulty) => {
			const population = integer(random, 8, 30) * 100,
				answer =
					"Randomly select students from every grade level in proportion to grade size";
			return question(
				"extra-sampling-inference",
				"sampling",
				difficulty,
				"real-world",
				`A school wants to estimate the opinions of its ${population} students. Which sampling plan is most likely to produce a representative estimate?`,
				answer,
				"Proportional random selection across every grade gives all major grade-level groups appropriate representation.",
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						"Survey only students in the library after school",
						"Survey the first students who answer an online post",
						"Randomly select students from one advanced mathematics class",
					]),
				},
			);
		},
	},
	{
		id: "extra-similar-triangles",
		conceptId: "similarity",
		representation: "diagram",
		generate: (random, difficulty) => {
			const small = integer(random, 3, 7),
				large = integer(random, small + 2, small + 7),
				side = integer(random, 4, 9),
				answer = String(side * large);
			return question(
				"extra-similar-triangles",
				"similarity",
				difficulty,
				"diagram",
				`Two similar triangles have corresponding base lengths ${small} and ${large}. A side of the smaller triangle has length ${side * small}. What is the corresponding side length of the larger triangle?`,
				answer,
				`The scale factor is $${large}/${small}$. Thus the new side is $${side * small}(${large}/${small})=${answer}$.`,
			);
		},
	},
	{
		id: "extra-angle-pair",
		conceptId: "angles",
		representation: "diagram",
		generate: (random, difficulty) => {
			const angle = integer(random, 25, 75 + difficulty),
				answer = String(180 - angle);
			return question(
				"extra-angle-pair",
				"angles",
				difficulty,
				"diagram",
				`Two adjacent angles form a straight line. One angle measures ${angle} degrees. What is the measure, in degrees, of the other angle?`,
				answer,
				`Angles on a straight line sum to $180^\\circ$, so the missing measure is $180-${angle}=${answer}$.`,
			);
		},
	},
	{
		id: "extra-right-triangle",
		conceptId: "right-triangles",
		representation: "diagram",
		generate: (random, difficulty) => {
			const triples = [
					[3, 4, 5],
					[5, 12, 13],
					[8, 15, 17],
				] as const,
				[a, b, c] = choose(random, triples),
				scale = integer(random, 1, 1 + difficulty),
				answer = String(c * scale);
			return question(
				"extra-right-triangle",
				"right-triangles",
				difficulty,
				"diagram",
				`A right triangle has legs of lengths ${a * scale} and ${b * scale}. What is the length of its hypotenuse?`,
				answer,
				`By the Pythagorean theorem, $c=\\sqrt{${a * a * scale * scale}+${b * b * scale * scale}}=${answer}$.`,
			);
		},
	},
	{
		id: "extra-trig-ratio",
		conceptId: "trigonometry",
		representation: "diagram",
		generate: (random, difficulty) => {
			const triples = [
					[3, 4, 5],
					[5, 12, 13],
					[8, 15, 17],
				] as const,
				[opposite, , hypotenuse] = choose(random, triples),
				answer = fraction(opposite, hypotenuse);
			return question(
				"extra-trig-ratio",
				"trigonometry",
				difficulty,
				"diagram",
				`In a right triangle, the side opposite angle $\\theta$ has length ${opposite} and the hypotenuse has length ${hypotenuse}. What is $\\sin \\theta$?`,
				answer,
				`Sine is opposite over hypotenuse, so $\\sin \\theta=${opposite}/${hypotenuse}=${answer}$.`,
			);
		},
	},
	{
		id: "extra-circle-equation",
		conceptId: "circles",
		representation: "equation",
		generate: (random, difficulty) => {
			const h = integer(random, -6, 6),
				k = integer(random, -6, 6),
				radius = integer(random, 2, 5 + difficulty),
				answer = String(radius);
			return question(
				"extra-circle-equation",
				"circles",
				difficulty,
				"equation",
				`The equation $(x-${h})^2+(y-${k})^2=${radius * radius}$ represents a circle. What is its radius?`,
				answer,
				`In $(x-h)^2+(y-k)^2=r^2$, the right side is $r^2$. Therefore $r=\\sqrt{${radius * radius}}=${radius}$.`,
				{
					desmos:
						"Graph the equation and measure from the center to an intercept.",
					preferredMethod: "either",
				},
			);
		},
	},
	{
		id: "extra-cylinder-volume",
		conceptId: "area-volume",
		representation: "diagram",
		generate: (random, difficulty) => {
			const radius = integer(random, 2, 5),
				height = integer(random, 3, 7 + difficulty),
				answer = String(radius * radius * height);
			return question(
				"extra-cylinder-volume",
				"area-volume",
				difficulty,
				"diagram",
				`A right circular cylinder has radius ${radius} and height ${height}. Its volume is $k\\pi$ cubic units. What is $k$?`,
				answer,
				`Using $V=\\pi r^2h$, $V=\\pi(${radius})^2(${height})=${answer}\\pi$.`,
			);
		},
	},
	{
		id: "extra-coordinate-midpoint",
		conceptId: "coordinate-geometry",
		representation: "graph",
		generate: (random, difficulty) => {
			const mx = integer(random, -5, 6),
				my = integer(random, -5, 6),
				dx = integer(random, 1, 4 + difficulty),
				dy = integer(random, 1, 4 + difficulty),
				answer = `(${mx}, ${my})`;
			return question(
				"extra-coordinate-midpoint",
				"coordinate-geometry",
				difficulty,
				"graph",
				`What is the midpoint of the segment with endpoints $(${mx - dx},${my - dy})$ and $(${mx + dx},${my + dy})$?`,
				answer,
				`Average the x-coordinates and the y-coordinates: the midpoint is $(${mx},${my})$.`,
				{
					kind: "multiple-choice",
					choices: multipleChoice(random, answer, [
						`(${mx + 1}, ${my})`,
						`(${mx}, ${my + 1})`,
						`(${mx + 1}, ${my + 1})`,
					]),
				},
			);
		},
	},
];
