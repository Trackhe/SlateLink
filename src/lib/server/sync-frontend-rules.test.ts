import { beforeEach, describe, expect, it, vi } from 'vitest';

const dataplaneMocks = vi.hoisted(() => ({
	getFrontends: vi.fn(),
	getHttpRequestRules: vi.fn(),
	createHttpRequestRule: vi.fn(),
	deleteHttpRequestRule: vi.fn(),
	replaceFrontendAcls: vi.fn(),
	replaceBackendSwitchingRules: vi.fn(),
	startTransaction: vi.fn(),
	commitTransaction: vi.fn()
}));

const databaseMocks = vi.hoisted(() => ({
	getAllFrontendRules: vi.fn()
}));

const domainMappingMocks = vi.hoisted(() => ({
	writeDomainMappingFile: vi.fn()
}));

vi.mock('$lib/server/dataplane', () => dataplaneMocks);
vi.mock('$lib/server/db', () => databaseMocks);
vi.mock('$lib/server/domain-mapping', () => domainMappingMocks);

import { syncAllFrontendRules, syncOneFrontendRules } from './sync-frontend-rules';

beforeEach(() => {
	vi.clearAllMocks();
	dataplaneMocks.startTransaction.mockResolvedValue('tx-1');
	dataplaneMocks.commitTransaction.mockResolvedValue(undefined);
	dataplaneMocks.replaceFrontendAcls.mockResolvedValue(undefined);
	dataplaneMocks.replaceBackendSwitchingRules.mockResolvedValue(undefined);
	dataplaneMocks.getHttpRequestRules.mockResolvedValue([]);
	dataplaneMocks.createHttpRequestRule.mockResolvedValue(undefined);
	dataplaneMocks.deleteHttpRequestRule.mockResolvedValue(undefined);
	domainMappingMocks.writeDomainMappingFile.mockResolvedValue(undefined);
});

describe('sync-frontend-rules', () => {
	it('syncOneFrontendRules creates ACLs, switching rules and redirects', async () => {
		await syncOneFrontendRules('fe_http', [
			{
				id: 11,
				domains: ['example.com', 'www.example.com'],
				backend_name: 'be_app',
				redirect_http_to_https: true
			}
		]);

		expect(dataplaneMocks.startTransaction).toHaveBeenCalledTimes(1);
		expect(dataplaneMocks.replaceFrontendAcls).toHaveBeenCalledWith(
			'fe_http',
			[
				{
					acl_name: 'rule_11',
					criterion: 'hdr(host)',
					value: '-i example.com -i www.example.com'
				}
			],
			{ transaction_id: 'tx-1' }
		);
		expect(dataplaneMocks.replaceBackendSwitchingRules).toHaveBeenCalledWith(
			'fe_http',
			[{ name: 'be_app', cond: 'if', cond_test: 'rule_11' }],
			{ transaction_id: 'tx-1' }
		);
		expect(dataplaneMocks.createHttpRequestRule).toHaveBeenCalledWith(
			'fe_http',
			expect.objectContaining({
				type: 'redirect',
				cond_test: '!{ ssl_fc } rule_11'
			}),
			0
		);
	});

	it('syncAllFrontendRules runs for every known frontend and writes mapping', async () => {
		databaseMocks.getAllFrontendRules.mockReturnValue([
			{
				id: 1,
				frontend_name: 'fe_one',
				domains: ['one.example.com'],
				backend_name: 'be_one',
				redirect_http_to_https: false
			}
		]);
		dataplaneMocks.getFrontends.mockResolvedValue([{ name: 'fe_one' }, { name: 'fe_two' }]);

		await syncAllFrontendRules();

		expect(dataplaneMocks.replaceFrontendAcls).toHaveBeenCalledTimes(2);
		expect(domainMappingMocks.writeDomainMappingFile).toHaveBeenCalledTimes(1);
	});
});
