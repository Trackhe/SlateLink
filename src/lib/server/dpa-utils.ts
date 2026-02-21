/**
 * Hilfsfunktionen für Data Plane API Antworten.
 * DPA liefert je nach Endpoint oft entweder ein Array oder { data: [] }.
 */
export function toArray(rawValue: unknown): unknown[] {
	return Array.isArray(rawValue) ? rawValue : [];
}

export function toDpaList(rawValue: unknown): unknown[] {
	if (Array.isArray(rawValue)) return rawValue;
	if (
		typeof rawValue === 'object' &&
		rawValue !== null &&
		Array.isArray((rawValue as { data?: unknown[] }).data)
	) {
		return (rawValue as { data: unknown[] }).data;
	}
	return [];
}
