"use client";
import { useRef, useState } from "react";
import { parseQuestionFile } from "@/content/local-import";
import type { ContentRecord } from "@/content/provenance";
import type { Question } from "@/core/types";

export function OfficialResources({
	count,
	onImport,
	onPractice,
}: {
	count: number;
	onImport: (records: ContentRecord<Question>[]) => void;
	onPractice: () => void;
}) {
	const input = useRef<HTMLInputElement>(null),
		[status, setStatus] = useState("");
	async function load(file?: File) {
		if (!file) return;
		try {
			const records = parseQuestionFile(await file.text());
			onImport(records);
			setStatus(`${records.length} questions imported into local practice.`);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "The question file is invalid.",
			);
		}
		if (input.current) input.current.value = "";
	}
	return (
		<section className="mt-12 card p-6">
			<h2 className="text-xl font-semibold">Local question library</h2>
			<p className="mt-2 text-sm text-muted">
				Import an authorized JSON question set or a native OpenSAT/PineSAT JSON
				export. Its full text stays on this device and becomes part of the
				practice loop; it is never uploaded or committed.
			</p>
			<p className="mt-3 text-sm">
				<b>{count}</b> locally imported questions
			</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<button
					type="button"
					className="btn primary"
					onClick={() => input.current?.click()}
				>
					Import questions
				</button>
				<button
					type="button"
					className="btn"
					disabled={!count}
					onClick={onPractice}
				>
					Practice imported set
				</button>
			</div>
			<input
				ref={input}
				type="file"
				accept="application/json"
				className="hidden"
				onChange={(event) => void load(event.target.files?.[0])}
			/>
			{status && (
				<p className="mt-3 text-sm text-muted" role="status">
					{status}
				</p>
			)}
			<details className="mt-4 text-sm text-muted">
				<summary className="cursor-pointer">Required JSON format</summary>
				<pre className="mt-2 overflow-auto rounded bg-line p-3 text-xs">{`[{"sourceId":"your-source-id","content":{"id":"q1","templateId":"local-q1","conceptId":"linear-equations","domain":"Math","difficulty":2,"representation":"equation","prompt":"Question text","kind":"numeric","answer":"4","explanation":"Concise solution"}}]`}</pre>
			</details>
		</section>
	);
}
