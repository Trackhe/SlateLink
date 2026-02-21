import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
	getAllFrontendRules: vi.fn(),
	getConfig: vi.fn(),
	CONFIG_KEY_DEFAULT_SSL_CRT_LIST: 'default_ssl_cert_crt_list'
}));

const dataplaneMocks = vi.hoisted(() => ({
	resolveCertToStore: vi.fn(),
	getCrtLoads: vi.fn()
}));

const configMocks = vi.hoisted(() => ({
	getSslCertsWriteDir: vi.fn()
}));

vi.mock('$lib/server/db', () => databaseMocks);
vi.mock('$lib/server/dataplane', () => dataplaneMocks);
vi.mock('$lib/server/config', () => configMocks);

import { buildDomainMappingContent } from './domain-mapping';

beforeEach(() => {
	vi.clearAllMocks();
	dataplaneMocks.resolveCertToStore.mockResolvedValue(null);
	dataplaneMocks.getCrtLoads.mockResolvedValue([]);
	databaseMocks.getConfig.mockReturnValue(null);
	configMocks.getSslCertsWriteDir.mockReturnValue('/tmp');
});

describe('domain-mapping', () => {
	it('builds mapping content from frontend rules', async () => {
		databaseMocks.getAllFrontendRules.mockReturnValue([
			{
				id: 1,
				frontend_name: 'fe_http',
				domains: ['example.com'],
				backend_name: 'be_http',
				cert_ref: { type: 'store', store: 'default', cert: 'default.pem' },
				redirect_http_to_https: true,
				sort_order: 1
			}
		]);

		const content = await buildDomainMappingContent();

		expect(content).toContain('@default/default.pem example.com');
		expect(content).toContain('# Das default.pem Zertifikat aus dem Store');
	});

	it('adds default certificate when no rule has cert_ref', async () => {
		databaseMocks.getAllFrontendRules.mockReturnValue([]);
		databaseMocks.getConfig.mockReturnValue(null);

		const content = await buildDomainMappingContent();

		expect(content).toContain('@default/default.pem');
	});
});
