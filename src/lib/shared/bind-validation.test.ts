import { describe, expect, it } from 'vitest';
import { getSafeBindName, isValidBindAddress } from './bind-validation';

describe('bind-validation', () => {
	it('accepts valid wildcard and ip bind addresses', () => {
		expect(isValidBindAddress('*')).toBe(true);
		expect(isValidBindAddress('0.0.0.0')).toBe(true);
		expect(isValidBindAddress('::')).toBe(true);
		expect(isValidBindAddress('192.168.1.10')).toBe(true);
		expect(isValidBindAddress('[::1]')).toBe(true);
	});

	it('rejects invalid bind addresses and treats empty as wildcard', () => {
		expect(isValidBindAddress('example.com')).toBe(false);
		expect(isValidBindAddress('invalid-address')).toBe(false);
		expect(isValidBindAddress('')).toBe(true);
	});

	it('returns safe fallback bind names when needed', () => {
		expect(getSafeBindName('', 80)).toBe('bind_80');
		expect(getSafeBindName('0.0.0.0', 443)).toBe('bind_443');
		expect(getSafeBindName('*.example.com', 8080)).toBe('bind_8080');
		expect(getSafeBindName('name.with.dot', 80)).toBe('bind_80');
		expect(getSafeBindName('invalid/name', 80)).toBe('bind_80');
	});

	it('keeps valid custom bind names', () => {
		expect(getSafeBindName('api_gateway', 80)).toBe('api_gateway');
		expect(getSafeBindName('frontend-1', 80)).toBe('frontend-1');
	});
});
