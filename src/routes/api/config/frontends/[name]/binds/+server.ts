/**
 * Binds API: nur Adresse + Port. Domain/Zertifikat über Regeln (ACLs).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBind, getAllUsedBindEndpoints, bindEndpointKey } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { DOMAIN_MAPPING_CRT_LIST_PATH, writeDomainMappingFile } from '$lib/server/domain-mapping';
import { getSafeBindName, isValidBindAddress } from '$lib/shared/bind-validation';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const port = Number(body?.port);
		if (!body || typeof body !== 'object' || !Number.isInteger(port) || port < 1 || port > 65535) {
			return json(
				{ error: 'Body must be JSON with port (1–65535). Optional: name, address' },
				{ status: 400 }
			);
		}
		const rawAddress = (body.address ?? '*').trim() || '*';
		if (!isValidBindAddress(rawAddress)) {
			return json(
				{
					error:
						'Bind-Adresse muss eine IP oder * sein (z. B. * oder 0.0.0.0). Hostnamen/Domains sind nicht erlaubt.'
				},
				{ status: 400 }
			);
		}
		const address = rawAddress;
		const rawName = typeof body.name === 'string' ? body.name.trim() : '';
		const name = getSafeBindName(rawName || `bind_${port}`, port);
		const used = await getAllUsedBindEndpoints();
		if (used.has(bindEndpointKey(address, port))) {
			return json(
				{ error: `Bind ${address}:${port} ist bereits vergeben.` },
				{ status: 409 }
			);
		}

		const bindBody: Record<string, unknown> = { name, address, port };
		const useSsl = body.ssl === true || port === 443;
		if (useSsl) {
			bindBody.ssl = true;
			bindBody.crt_list = DOMAIN_MAPPING_CRT_LIST_PATH;
			await writeDomainMappingFile();
		}

		await createBind(params.name, bindBody);
		logAction({
			action: 'bind_added',
			resource_type: 'frontend',
			resource_id: params.name,
			details: `POST bind ${name} to frontend ${params.name}`
		});
		return json({ ok: true, name, address, port });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
