import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBackend, createServer, getFrontends, getBackends, usedConfigNames } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

type ServerInput = {
	name?: string;
	address: string;
	port?: number;
	check?: string;
	inter?: string | number;
	fall?: number;
	rise?: number;
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || !body.name) {
			return json(
				{ error: 'Body must be JSON with at least { "name": "..." }. Optional: mode, balance: { algorithm }, servers: [ { name?, address, port?, check?, inter?, fall?, rise? } ]' },
				{ status: 400 }
			);
		}
		const name = String(body.name).trim();
		const [frontendsRaw, backendsRaw] = await Promise.all([getFrontends(), getBackends()]);
		if (usedConfigNames(frontendsRaw, backendsRaw).has(name)) {
			return json(
				{ error: 'Name bereits vergeben (Frontend oder Backend). Namen müssen eindeutig sein.' },
				{ status: 409 }
			);
		}
		const backendPayload: Record<string, unknown> = {
			name,
			mode: body.mode ?? 'http',
			balance: body.balance ?? { algorithm: 'roundrobin' }
		};
		// HTTP-Check: Backend-Option „option httpchk [method] [uri]“ (DPA-Felder je nach Version)
		if (body.checkType === 'http' && body.httpchkMethod != null && body.httpchkUri != null) {
			const method = String(body.httpchkMethod).trim() || 'GET';
			const uri = String(body.httpchkUri).trim() || '/';
			backendPayload.httpchk_method = method;
			backendPayload.httpchk_uri = uri.startsWith('/') ? uri : `/${uri}`;
			// Optionale Status-Codes die als OK gelten (z. B. 200,404 → „http-check expect status 200 404“)
			const expectStatusRaw = body.httpchkExpectStatus != null ? String(body.httpchkExpectStatus).trim() : '';
			if (expectStatusRaw) {
				const codes = expectStatusRaw
					.split(/[,;\s]+/)
					.map((s) => s.trim())
					.filter((s) => /^\d{3}$/.test(s));
				if (codes.length > 0) {
					backendPayload.expect_status = codes.join(' ');
				}
			}
		}
		await createBackend(backendPayload);
		const servers = Array.isArray(body.servers) ? body.servers : [];
		for (const s of servers as ServerInput[]) {
			if (!s || typeof s.address !== 'string' || !s.address.trim()) continue;
			const port = Number(s.port);
			const serverPayload: Record<string, unknown> = {
				name: (s.name && String(s.name).trim()) || s.address.replace(/[.:]/g, '_'),
				address: s.address.trim(),
				port: Number.isInteger(port) && port > 0 ? port : 80
			};
			if (s.check !== undefined) serverPayload.check = String(s.check);
			if (s.inter !== undefined) serverPayload.inter = typeof s.inter === 'number' ? `${s.inter}s` : String(s.inter);
			if (s.fall !== undefined && Number.isInteger(s.fall)) serverPayload.fall = s.fall;
			if (s.rise !== undefined && Number.isInteger(s.rise)) serverPayload.rise = s.rise;
			await createServer(name, serverPayload);
		}
		logAction({
			action: 'backend_created',
			resource_type: 'backend',
			resource_id: name,
			details: 'POST /api/config/backends' + (servers.length ? ` (${servers.length} Server)` : '')
		});
		return json({ ok: true, name, servers: servers.length });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
