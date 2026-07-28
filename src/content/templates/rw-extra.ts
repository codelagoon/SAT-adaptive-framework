import type { Template } from "../../core/templates.ts";
import type { Difficulty, Question } from "../../core/types.ts";

type Item = {
	stem: string;
	answer: string;
	wrong: [string, string, string];
	explanation: string;
};
const pick = <T>(r: () => number, items: readonly T[]): T => {
	const item = items[Math.floor(r() * items.length)];
	if (item === undefined) throw new Error("Cannot pick from an empty item bank");
	return item;
};
const shuffle = <T>(r: () => number, items: readonly T[]) =>
	items
		.map((value) => ({ value, key: r() }))
		.sort((a, b) => a.key - b.key)
		.map((x) => x.value);
const mc = (
	r: () => number,
	t: Template,
	item: Item,
	d: Difficulty,
): Question => ({
	id: `${t.id}-${Math.floor(r() * 1e9)}`,
	templateId: t.id,
	conceptId: t.conceptId,
	domain: "Reading & Writing",
	difficulty: d,
	representation: "passage",
	prompt: item.stem,
	kind: "multiple-choice",
	answer: item.answer,
	explanation: item.explanation,
	choices: shuffle(r, [item.answer, ...item.wrong]).map((text, index) => ({
		id: String.fromCharCode(65 + index),
		text,
		reason:
			text === item.answer
				? item.explanation
				: "This choice conflicts with the text's logic, evidence, or Standard English conventions.",
	})),
});
const make = (
	id: string,
	conceptId: string,
	bank: readonly Item[],
): Template => {
	const t: Template = {
		id,
		conceptId,
		representation: "passage",
		generate: (r, d) => mc(r, t, pick(r, bank), d),
	};
	return t;
};

const evidence: Item[] = [
	{
		stem: "Biologist Lena Ortiz claims that rooftop gardens can support urban pollinators. Which finding, if true, would most directly support Ortiz's claim?",
		answer:
			"Roofs with flowering gardens hosted more bee species than otherwise similar bare roofs.",
		wrong: [
			"Some building owners water rooftop gardens before sunrise.",
			"Several bee species also live in rural meadows.",
			"The oldest roof in the survey had recently been repaired.",
		],
		explanation:
			"The comparison directly links rooftop gardens with greater pollinator diversity.",
	},
	{
		stem: "A historian argues that a town's night market expanded after a rail station opened nearby. Which evidence would most strongly support the argument?",
		answer:
			"Vendor permits rose sharply in the two years after the station opened, especially near its entrance.",
		wrong: [
			"The station's bricks came from a neighboring county.",
			"Some vendors preferred selling cloth to selling food.",
			"The town also operated a daytime market decades earlier.",
		],
		explanation:
			"The timing and location of the permit increase directly support the proposed link.",
	},
];
const inference: Item[] = [
	{
		stem: "Mina tested two identical seedlings. She placed one beside a sunny window and the other in a dim hallway. After three weeks, the window seedling was taller and had more leaves. Which conclusion is best supported?",
		answer:
			"Greater access to light likely contributed to the window seedling's growth.",
		wrong: [
			"Light is the only factor that can affect any plant's growth.",
			"The hallway seedling received no water.",
			"Every plant grows fastest beside a window.",
		],
		explanation:
			"The controlled contrast supports a cautious link between light access and growth.",
	},
	{
		stem: "A library extended Saturday hours. During the next month, weekend visits increased while weekday visits remained stable. Which inference is best supported?",
		answer:
			"The added Saturday hours likely made weekend library use more convenient.",
		wrong: [
			"Most weekday visitors stopped borrowing books.",
			"The library's collection doubled during the month.",
			"All weekend visitors opposed the old schedule.",
		],
		explanation:
			"The change specific to weekends supports the convenience inference without overstating it.",
	},
];
const dataEvidence: Item[] = [
	{
		stem: "A study recorded the share of seeds that sprouted: untreated, 42%; soaked 6 hours, 61%; soaked 12 hours, 74%; soaked 24 hours, 55%. Which statement is best supported by the data?",
		answer: "Seeds soaked for 12 hours had the highest sprouting rate.",
		wrong: [
			"Longer soaking always increased sprouting.",
			"Untreated seeds never sprouted.",
			"Soaking for 24 hours doubled the untreated rate.",
		],
		explanation:
			"Seventy-four percent is the largest reported rate; the other claims misread the values or trend.",
	},
	{
		stem: "A transit survey reports average wait times: Route K, 8 minutes; Route L, 13 minutes; Route M, 7 minutes; Route N, 11 minutes. Which claim accurately uses the data?",
		answer: "Route M's average wait was one minute shorter than Route K's.",
		wrong: [
			"Route L had the shortest average wait.",
			"Route N's wait was twice Route M's.",
			"Routes K and N had equal average waits.",
		],
		explanation:
			"The reported averages are 7 minutes for M and 8 minutes for K, a one-minute difference.",
	},
];
const purpose: Item[] = [
	{
		stem: "Glass frogs are difficult to spot from below because light passes through parts of their bodies. Researchers recently found that the frogs adjust their apparent brightness when moving between leaves. The text primarily serves to",
		answer: "describe a feature that helps glass frogs remain inconspicuous.",
		wrong: [
			"argue that all frogs should live in trees.",
			"explain why researchers stopped studying camouflage.",
			"compare the diets of several frog species.",
		],
		explanation:
			"Both sentences describe camouflage-related features that make the frogs harder to detect.",
	},
	{
		stem: "Early maps of an island showed one continuous lake. Modern satellite images reveal two basins separated by a narrow ridge. Geologists now think seasonal flooding once hid the ridge. The text primarily serves to",
		answer:
			"explain how new evidence revised an earlier understanding of the lake.",
		wrong: [
			"prove that early mapmakers never visited the island.",
			"recommend draining both lake basins.",
			"list every method used to make satellite images.",
		],
		explanation:
			"The passage contrasts an earlier view with a revised explanation based on newer evidence.",
	},
];
const crossText: Item[] = [
	{
		stem: "Text 1: Researcher A argues that city trees cool streets mainly by providing shade. Text 2: Researcher B agrees that shade matters but emphasizes cooling from water released by leaves. How would Researcher B most likely respond to Researcher A?",
		answer:
			"By agreeing with the conclusion while proposing an additional mechanism.",
		wrong: [
			"By denying that trees affect street temperature.",
			"By claiming that shade warms streets.",
			"By changing the topic from trees to building materials.",
		],
		explanation:
			"Text 2 accepts the cooling claim and adds leaf-driven evaporative cooling.",
	},
	{
		stem: "Text 1: A critic praises a novel's spare dialogue for creating tension. Text 2: Another critic finds the dialogue restrained but argues that the vivid setting creates most of the tension. The critics would most likely agree that",
		answer: "the novel's dialogue is restrained.",
		wrong: [
			"the setting has no effect on tension.",
			"the novel contains too much dialogue.",
			"tension is absent from the novel.",
		],
		explanation:
			"Both critics characterize the dialogue as limited or restrained, though they differ about its effect.",
	},
];
const synthesis: Item[] = [
	{
		stem: "A student wants to emphasize a similarity. Notes: The luna moth is active at night. The polyphemus moth is active at night. Both are native to North America. Which choice most effectively uses the notes?",
		answer:
			"Both native North American species, the luna moth and the polyphemus moth are active at night.",
		wrong: [
			"The luna moth is active at night, but moths have wings.",
			"North America contains many animals, including two moths.",
			"The polyphemus moth is native; however, night is dark.",
		],
		explanation:
			"The sentence accurately and concisely highlights the requested similarity.",
	},
	{
		stem: "A student wants to contrast two materials. Notes: Bamboo reaches harvest size in several years. Many hardwood trees require decades. Both can be used for flooring. Which choice most effectively uses the notes?",
		answer:
			"Although both materials can be used for flooring, bamboo reaches harvest size much sooner than many hardwoods do.",
		wrong: [
			"Bamboo and hardwood are materials, and flooring is installed indoors.",
			"Many hardwood trees require decades, so they cannot be used for flooring.",
			"Bamboo reaches harvest size in several years because all plants grow quickly.",
		],
		explanation:
			"The sentence makes the requested contrast while accurately preserving the notes.",
	},
];
const formSense: Item[] = [
	{
		stem: "Marine biologist Asha Patel studies coral larvae, organisms that _____ ocean currents before attaching to reefs. Which choice completes the text according to Standard English conventions?",
		answer: "ride",
		wrong: ["rides", "is riding", "has rode"],
		explanation:
			"The plural antecedent “organisms” requires the plural present-tense verb “ride.”",
	},
	{
		stem: "The museum's new exhibit includes sketches _____ during the architect's 1924 expedition. Which choice completes the text according to Standard English conventions?",
		answer: "made",
		wrong: ["making", "were made", "makes"],
		explanation:
			"The past participle “made” correctly begins a phrase modifying “sketches.”",
	},
];
const agreement: Item[] = [
	{
		stem: "A set of newly restored murals _____ the entrance hall. Which choice completes the text according to Standard English conventions?",
		answer: "brightens",
		wrong: ["brighten", "have brighten", "are brightening them"],
		explanation:
			"The singular head noun “set” requires the singular verb “brightens.”",
	},
	{
		stem: "Neither the curator nor the assistants _____ the temperature controls unattended. Which choice completes the text according to Standard English conventions?",
		answer: "leave",
		wrong: ["leaves", "has left it", "leaving"],
		explanation:
			"With “neither...nor,” the verb agrees with the nearer plural subject “assistants.”",
	},
];
const pronouns: Item[] = [
	{
		stem: "When Elena interviewed Priya about the mural, Priya explained why _____ had chosen blue pigment. Which choice most clearly completes the text?",
		answer: "Priya",
		wrong: ["she", "her", "they"],
		explanation:
			"Repeating “Priya” removes the ambiguity created by a pronoun with two possible antecedents.",
	},
	{
		stem: "The two laboratories published _____ results in the same journal issue. Which choice completes the text according to Standard English conventions?",
		answer: "their",
		wrong: ["its", "it's", "there"],
		explanation:
			"The plural possessive pronoun “their” agrees with “laboratories” and modifies “results.”",
	},
];
const modifiers: Item[] = [
	{
		stem: "Covered in tiny ice crystals, _____ Which choice completes the sentence so that the modifier is logically placed?",
		answer: "the branch glittered in the morning light.",
		wrong: [
			"the hikers admired the branch.",
			"sunlight reached the hikers near the branch.",
			"the morning was bright beside the branch.",
		],
		explanation:
			"The branch—not the hikers, sunlight, or morning—is covered in ice crystals.",
	},
	{
		stem: "To measure the cave accurately, _____ Which choice completes the sentence so that the modifier is logically placed?",
		answer: "the surveyors used laser scanners.",
		wrong: [
			"laser scanners were available to the surveyors.",
			"the cave required several hours.",
			"accurate measurements appeared on the screen.",
		],
		explanation:
			"The surveyors are the people who intended to measure the cave.",
	},
];
const tense: Item[] = [
	{
		stem: "By the time the lecture began, the technician _____ the projector. Which choice completes the text according to Standard English conventions?",
		answer: "had repaired",
		wrong: ["repairs", "will repair", "is repairing"],
		explanation:
			"The past perfect “had repaired” marks an action completed before another past event.",
	},
	{
		stem: "Each spring, the river _____ its banks and deposits fresh soil on the plain. Which choice completes the text according to Standard English conventions?",
		answer: "overflows",
		wrong: ["overflowed yesterday", "will have overflowed", "overflowing"],
		explanation:
			"The simple present “overflows” expresses the recurring action signaled by “Each spring.”",
	},
];
const punctuation: Item[] = [
	{
		stem: "The research team studied three nocturnal animals _____ bats, owls, and moths. Which choice completes the text according to Standard English conventions?",
		answer: ":",
		wrong: [",", ";", "— and"],
		explanation:
			"A colon correctly introduces a list after a complete independent clause.",
	},
	{
		stem: "The first prototype was inexpensive _____ it was also unreliable. Which choice completes the text according to Standard English conventions?",
		answer: "; however,",
		wrong: [", however,", ": however", " however,"],
		explanation:
			"A semicolon before and a comma after “however” correctly join the independent clauses.",
	},
];
const central: Item[] = [
	{
		stem: "Engineers restored a wetland beside a coastal road. The wetland now absorbs stormwater that once flooded the pavement and also provides habitat for shorebirds. Which choice best states the main idea?",
		answer: "The restored wetland benefits both road drainage and wildlife.",
		wrong: [
			"The road was built exclusively for bird-watchers.",
			"Wetlands prevent every kind of coastal flooding.",
			"Engineers plan to replace the wetland with pavement.",
		],
		explanation:
			"The passage emphasizes two benefits: stormwater absorption and shorebird habitat.",
	},
	{
		stem: "A community archive invited residents to identify people in unlabeled photographs. Their contributions supplied names, dates, and stories that staff records lacked. Which choice best states the main idea?",
		answer: "Community knowledge helped enrich the archive's records.",
		wrong: [
			"The archive discarded all photographs without labels.",
			"Staff records already contained every relevant detail.",
			"Residents were asked to take new photographs only.",
		],
		explanation:
			"Residents added missing information, making the archival records more complete.",
	},
];
const transitions: Item[] = [
	{
		stem: "The first battery design stored substantial energy but degraded quickly. _____, the revised design lasted through hundreds of charge cycles. Which choice most logically completes the text?",
		answer: "By contrast",
		wrong: ["For example", "Likewise", "In other words"],
		explanation:
			"“By contrast” signals the opposition between rapid degradation and long durability.",
	},
	{
		stem: "The excavation uncovered charred seeds. _____, researchers gained evidence about crops prepared at the site. Which choice most logically completes the text?",
		answer: "Consequently",
		wrong: ["Nevertheless", "Meanwhile", "Similarly"],
		explanation:
			"“Consequently” signals that the evidence resulted from the discovery.",
	},
];
const context: Item[] = [
	{
		stem: "Because the manuscript survives only in fragments, any account of its original ending must remain _____. Which choice most logically completes the text?",
		answer: "tentative",
		wrong: ["definitive", "irrelevant", "unchanging"],
		explanation:
			"“Tentative” fits a conclusion that must remain uncertain because evidence is incomplete.",
	},
	{
		stem: "Rather than conceal the uncertainty in the measurements, the report was _____ about the study's limitations. Which choice most logically completes the text?",
		answer: "candid",
		wrong: ["evasive", "indifferent", "ornamental"],
		explanation:
			"“Candid” means frank or open, matching the report's refusal to conceal uncertainty.",
	},
];

export const rwExtraTemplates: Template[] = [
	make("rw-evidence-extra", "evidence", evidence),
	make("rw-inference-extra", "inferences", inference),
	make("rw-data-evidence-extra", "data-evidence", dataEvidence),
	make("rw-purpose-extra", "text-purpose", purpose),
	make("rw-cross-text-extra", "cross-text", crossText),
	make("rw-synthesis-extra", "rhetorical-synthesis", synthesis),
	make("rw-form-sense-extra", "form-structure-sense", formSense),
	make("rw-agreement-extra", "agreement", agreement),
	make("rw-pronouns-extra", "pronouns", pronouns),
	make("rw-modifiers-extra", "modifiers", modifiers),
	make("rw-tense-extra", "verb-tense", tense),
	make("rw-punctuation-extra", "punctuation", punctuation),
	make("rw-central-extra", "central-ideas", central),
	make("rw-transitions-extra", "transitions", transitions),
	make("rw-context-extra", "words-context", context),
];
