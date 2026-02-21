/**
 * Synchronisiert Frontend-Regeln (frontend_rules) nach HAProxy:
 * ACLs, Backend-Switching, selektive HTTP→HTTPS-Redirects, domain_mapping.txt.
 */
import {
	getFrontends,
	getHttpRequestRules,
	createHttpRequestRule,
	deleteHttpRequestRule,
	replaceFrontendAcls,
	replaceBackendSwitchingRules,
	startTransaction,
	commitTransaction
} from '$lib/server/dataplane';
import { getAllFrontendRules } from '$lib/server/db';
import { writeDomainMappingFile } from '$lib/server/domain-mapping';
import { toDpaList } from '$lib/server/dpa-utils';

function frontendNames(raw: unknown): string[] {
	const list = toDpaList(raw);
	return list
		.filter((x): x is { name?: string } => typeof x === 'object' && x !== null && 'name' in x)
		.map((x) => x.name)
		.filter((n): n is string => typeof n === 'string');
}

/** Eindeutiger ACL-Name pro Regel (HAProxy: nur [A-Za-z0-9_-]). */
function aclNameForRule(ruleId: number): string {
	return `rule_${ruleId}`;
}

/**
 * Synchronisiert alle Regeln für alle Frontends nach HAProxy (ACLs, Backend-Switching, Redirects)
 * und schreibt domain_mapping.txt.
 */
export async function syncAllFrontendRules(): Promise<void> {
	const rules = getAllFrontendRules();
	const byFrontend = new Map<string, typeof rules>();
	for (const r of rules) {
		if (!byFrontend.has(r.frontend_name)) byFrontend.set(r.frontend_name, []);
		byFrontend.get(r.frontend_name)!.push(r);
	}

	const frontendsRaw = await getFrontends();
	const feNames = frontendNames(frontendsRaw);

	for (const feName of feNames) {
		const feRules = byFrontend.get(feName) ?? [];
		await syncOneFrontendRules(feName, feRules);
	}

	await writeDomainMappingFile();
}

/**
 * Synchronisiert Regeln für ein Frontend: ACLs, Backend-Switching, Redirect-Regeln.
 */
export async function syncOneFrontendRules(
	frontendName: string,
	rules: { id: number; domains: string[]; backend_name: string; redirect_http_to_https: boolean }[]
): Promise<void> {
	// 1. ACLs und 2. Backend-Switching in einer Transaktion, damit die Config gemeinsam validiert wird
	// (Switching-Regeln verweisen auf ACL-Namen; ohne Transaktion kann die DPA die Reihenfolge falsch anwenden).
	const acls: { acl_name: string; criterion: string; value: string }[] = [];
	for (const r of rules) {
		const domains = (r.domains ?? []).filter((d) => typeof d === 'string' && d.trim());
		const value = domains.map((d) => `-i ${d.trim()}`).join(' ') || '-i .';
		acls.push({
			acl_name: aclNameForRule(r.id),
			criterion: 'hdr(host)',
			value
		});
	}
	const switchingRules = rules.map((r) => ({
		name: r.backend_name,
		cond: 'if' as const,
		cond_test: aclNameForRule(r.id)
	}));

	const transactionId = await startTransaction();
	try {
		await replaceFrontendAcls(frontendName, acls, { transaction_id: transactionId });
		await replaceBackendSwitchingRules(frontendName, switchingRules, { transaction_id: transactionId });
		await commitTransaction(transactionId);
	} catch (error) {
		// Transaktion verwerfen (DPA löscht in_progress-Transaktionen)
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`syncOneFrontendRules failed for frontend "${frontendName}" (transaction ${transactionId}): ${message}`
		);
		throw error;
	}

	// 3. HTTP→HTTPS-Redirect: pro Regel mit redirect_http_to_https eine http-request redirect Regel
	const existingRules = (await getHttpRequestRules(frontendName)) as {
		type?: string;
		redir_type?: string;
		cond_test?: string;
		index?: number;
	}[];
	// Alte selektive Redirects entfernen (cond_test enthält "!ssl_fc" bzw. "!{ ssl_fc }" und rule_<id>)
	const toDelete = existingRules
		.map((r, i) => ({ r, index: r.index ?? i }))
		.filter(
			({ r }) =>
				r?.type === 'redirect' &&
				r?.redir_type === 'scheme' &&
				typeof r?.cond_test === 'string' &&
				(r.cond_test.startsWith('!{ ssl_fc } rule_') || r.cond_test.startsWith('!ssl_fc rule_'))
		)
		.sort((a, b) => b.index - a.index);
	for (const { index } of toDelete) {
		await deleteHttpRequestRule(frontendName, index);
	}
	// Neue Redirect-Regeln (oben einfügen, index 0, 1, 2, …)
	const redirectRules = rules.filter((r) => r.redirect_http_to_https);
	for (let i = 0; i < redirectRules.length; i++) {
		await createHttpRequestRule(
			frontendName,
			{
				type: 'redirect',
				redir_type: 'scheme',
				redir_value: 'https',
				redir_code: 301,
				cond: 'if',
				cond_test: `!{ ssl_fc } ${aclNameForRule(redirectRules[i].id)}`
			},
			i
		);
	}
}
