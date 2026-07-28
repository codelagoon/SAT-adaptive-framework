export type ContentOrigin =
	| "procedural"
	| "official-external"
	| "authorized-local";
export type LicenseScope =
	| "redistributable"
	| "external-reference-only"
	| "local-personal-use";
export type ContentProvenance = {
	origin: ContentOrigin;
	publisher: string;
	sourceUrl?: string;
	sourceId: string;
	licenseScope: LicenseScope;
	retrievedAt?: string;
	contentHash?: string;
};
export type ContentRecord<T> = { content: T; provenance: ContentProvenance };

export function canBundle(record: ContentRecord<unknown>) {
	return record.provenance.licenseScope === "redistributable";
}
export function validateProvenance(provenance: ContentProvenance) {
	const errors: string[] = [];
	if (!provenance.publisher.trim()) errors.push("Missing publisher");
	if (!provenance.sourceId.trim()) errors.push("Missing source identifier");
	if (
		provenance.origin === "official-external" &&
		(!provenance.sourceUrl ||
			provenance.licenseScope !== "external-reference-only")
	)
		errors.push("Official external content must remain an external reference");
	if (
		provenance.origin === "authorized-local" &&
		provenance.licenseScope !== "local-personal-use"
	)
		errors.push("Authorized local content must remain local");
	return { valid: errors.length === 0, errors };
}
export function assertBundleSafe(records: ContentRecord<unknown>[]) {
	const blocked = records.filter((r) => !canBundle(r));
	if (blocked.length)
		throw new Error(
			`Refusing to bundle ${blocked.length} restricted content record(s)`,
		);
	return records;
}
