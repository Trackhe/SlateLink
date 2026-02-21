export function parseRuleId(ruleIdParam: string): number | null {
	const parsedRuleId = Number.parseInt(ruleIdParam, 10);
	if (!Number.isInteger(parsedRuleId) || parsedRuleId < 1) return null;
	return parsedRuleId;
}

export function normalizeDomains(rawDomains: unknown): string[] {
	if (!Array.isArray(rawDomains)) return [];
	return rawDomains.map((domain) => String(domain).trim()).filter(Boolean);
}
