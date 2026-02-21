import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllFrontendRules, createFrontendRule, getFrontendRuleById, type BindCertRef } from '$lib/server/db';
import { syncAllFrontendRules } from '$lib/server/sync-frontend-rules';
import { getCrtLoads, resolveCertToStore } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { toDpaList } from '$lib/server/dpa-utils';
import { normalizeDomains } from '$lib/server/rules-validation';

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
		// Cert-Dateiname aus Store: wir speichern nur store + Platzhalter oder ersten Load
		return { type: 'store', store, cert: '' };
	}
	if (trimmedInput.startsWith('cert:')) return { type: 'path', cert: trimmedInput.slice(5).trim() };
	return { type: 'path', cert: trimmedInput };
}

export const GET: RequestHandler = async () => {
	try {
		const rules = getAllFrontendRules();
		return json({ rules });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const frontend_name = typeof body.frontend_name === 'string' ? body.frontend_name.trim() : '';
		const backend_name = typeof body.backend_name === 'string' ? body.backend_name.trim() : '';
		if (!frontend_name || !backend_name) {
			return json(
				{ error: 'frontend_name und backend_name sind Pflichtfeld.' },
				{ status: 400 }
			);
		}
		const domains = normalizeDomains(body.domains);
		const redirect_http_to_https = body.redirect_http_to_https === true;
		let cert_ref: BindCertRef | null = parseCertRef(
			body.ssl_certificate as string | undefined,
			body.cert_ref as BindCertRef | undefined
		);
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

		const id = createFrontendRule({
			frontend_name,
			domains,
			backend_name,
			cert_ref,
			redirect_http_to_https,
			sort_order: 0
		});
		logAction({
			action: 'rule_added',
			resource_type: 'frontend',
			resource_id: frontend_name,
			details: `Regel ${id} für Frontend ${frontend_name}`
		});
		await syncAllFrontendRules();
		const rule = getFrontendRuleById(id);
		return json({ ok: true, rule });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
