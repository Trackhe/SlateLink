import { describe, expect, it } from 'vitest';
import { normalizeDomains, parseRuleId } from './rules-validation';

describe('rules-validation', () => {
	it('parseRuleId returns positive integer ids', () => {
		expect(parseRuleId('1')).toBe(1);
		expect(parseRuleId('42')).toBe(42);
	});

	it('parseRuleId rejects invalid values', () => {
		expect(parseRuleId('0')).toBeNull();
		expect(parseRuleId('-1')).toBeNull();
		expect(parseRuleId('abc')).toBeNull();
		expect(parseRuleId('')).toBeNull();
	});

	it('normalizeDomains trims and removes empty values', () => {
		expect(normalizeDomains([' example.com ', '', 'api.example.com'])).toEqual([
			'example.com',
			'api.example.com'
		]);
	});

	it('normalizeDomains returns [] for non-array inputs', () => {
		expect(normalizeDomains(null)).toEqual([]);
		expect(normalizeDomains(undefined)).toEqual([]);
		expect(normalizeDomains('example.com')).toEqual([]);
	});
});
