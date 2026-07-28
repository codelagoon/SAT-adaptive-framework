import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseOpenSatQuestions } from "@/content/local-import";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const source = await readFile(
			path.join(process.cwd(), ".local", "opensat-questions.json"),
			"utf8",
		);
		return Response.json(parseOpenSatQuestions(source), {
			headers: { "Cache-Control": "no-store" },
		});
	} catch {
		return Response.json(
			{ error: "Local OpenSAT bank is not configured." },
			{ status: 404, headers: { "Cache-Control": "no-store" } },
		);
	}
}
