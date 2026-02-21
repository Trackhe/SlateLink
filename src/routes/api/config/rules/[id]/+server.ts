import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getFrontendRuleById,
	updateFrontendRule,
	deleteFrontendRule,
	type BindCertRef
} from '$lib/server/db';
import { syncAllFrontendRules } from '$lib/server/sync-frontend-rules';
import { getCrtLoads, resolveCertToStore } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { toDpaList } from '$lib/server/dpa-utils';
import { normalizeDomains, parseRuleId } from '$lib/server/rules-validation';

function parseCertRef(
	certificateInput: string | undefined,
	certRefBody: BindCertRef | undefined
): BindCertRef | null {
	if (certRefBody && typeof certRefBody === 'object') {
		if (certRefBody.type === 'store' && certRefBody.store && certRefBody.cert) return certRefBody;
		if (certRefBody.type === 'path' && certRefBody.cert) return certRefBody;
	}
	const trimmedInput = (certificateInput ?? '').trim();
	if (!trimmedInput) return null;
	if (trimmedInput.startsWith('store:')) {
		const store = trimmedInput.slice(6).trim();
		return { type: 'store', store, cert: '' };
	}
	if (trimmedInput.startsWith('cert:')) return { type: 'path', cert: trimmedInput.slice(5).trim() };
	return { type: 'path', cert: trimmedInput };
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const ruleId = parseRuleId(params.id);
		if (ruleId === null) {
			return json({ error: 'Ungültige Regel-ID' }, { status: 400 });
		}
		const rule = getFrontendRuleById(ruleId);
		if (!rule) return json({ error: 'Regel nicht gefunden' }, { status: 404 });
		return json({ rule });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const ruleId = parseRuleId(params.id);
		if (ruleId === null) {
			return json({ error: 'Ungültige Regel-ID' }, { status: 400 });
		}
		const existing = getFrontendRuleById(ruleId);
		if (!existing) return json({ error: 'Regel nicht gefunden' }, { status: 404 });

		const body = (await request.json()) as Record<string, unknown>;
		const domains = Array.isArray(body.domains)
			? normalizeDomains(body.domains)
			: existing.domains;
		const backend_name = typeof body.backend_name === 'string' ? body.backend_name.trim() : existing.backend_name;
		const redirect_http_to_https = body.redirect_http_to_https === true;
		let cert_ref: BindCertRef | null = parseCertRef(
			body.ssl_certificate as string | undefined,
			body.cert_ref as BindCertRef | undefined
		);
		if (cert_ref === undefined) cert_ref = existing.cert_ref;
		if (cert_ref?.type === 'path') {
			const resolved = await resolveCertToStore(cert_ref.cert);
			if (resolved) cert_ref = { type: 'store', store: resolved.store, cert: resolved.cert };
		}
		if (cert_ref && cert_ref.type === 'store' && !cert_ref.cert) {
			try {
				const loadsRaw = await getCrtLoads(cert_ref.store);
				const loads = toDpaList(loadsRaw) as { certificate?: string }[];
				const firstLoad = loads.find((load) => load?.certificate);
				cert_ref = firstLoad?.certificate
					? { type: 'store', store: cert_ref.store, cert: firstLoad.certificate }
					: null;
			} catch {
				cert_ref = null;
			}
		}

		updateFrontendRule(ruleId, { domains, backend_name, cert_ref, redirect_http_to_https });
		logAction({
			action: 'rule_updated',
			resource_type: 'frontend',
			resource_id: existing.frontend_name,
			details: `Regel ${ruleId} aktualisiert`
		});
		await syncAllFrontendRules();
		const rule = getFrontendRuleById(ruleId);
		return json({ ok: true, rule });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const ruleId = parseRuleId(params.id);
		if (ruleId === null) {
			return json({ error: 'Ungültige Regel-ID' }, { status: 400 });
		}
		const existing = getFrontendRuleById(ruleId);
		if (!existing) return json({ error: 'Regel nicht gefunden' }, { status: 404 });
		deleteFrontendRule(ruleId);
		logAction({
			action: 'rule_deleted',
			resource_type: 'frontend',
			resource_id: existing.frontend_name,
			details: `Regel ${ruleId} gelöscht`
		});
		await syncAllFrontendRules();
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
