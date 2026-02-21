import { describe, expect, it } from 'vitest';
import { toArray, toDpaList } from './dpa-utils';

describe('dpa-utils', () => {
	it('toArray returns array values unchanged', () => {
		const values = [1, 2, 3];
		expect(toArray(values)).toEqual(values);
	});

	it('toArray returns [] for non-array values', () => {
		expect(toArray(null)).toEqual([]);
		expect(toArray(undefined)).toEqual([]);
		expect(toArray({ data: [1] })).toEqual([]);
		expect(toArray('text')).toEqual([]);
	});

	it('toDpaList returns raw array when provided', () => {
		const values = [{ name: 'frontend' }];
		expect(toDpaList(values)).toEqual(values);
	});

	it('toDpaList returns data array for wrapped payload', () => {
		expect(toDpaList({ data: [{ name: 'backend' }] })).toEqual([{ name: 'backend' }]);
	});

	it('toDpaList returns [] for invalid payloads', () => {
		expect(toDpaList({ data: null })).toEqual([]);
		expect(toDpaList({})).toEqual([]);
		expect(toDpaList(null)).toEqual([]);
		expect(toDpaList(undefined)).toEqual([]);
	});
});
