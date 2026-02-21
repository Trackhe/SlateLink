const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IPV6_PATTERN = /^[\da-fA-F:]+$/;
const SAFE_BIND_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** HAProxy bind erlaubt nur IP oder "*" (keine Hostnamen/Domains). */
export function isValidBindAddress(inputValue: string): boolean {
	const trimmedAddress = inputValue.trim() || '*';
	if (trimmedAddress === '*' || trimmedAddress === '0.0.0.0' || trimmedAddress === '::') {
		return true;
	}
	return (
		IPV4_PATTERN.test(trimmedAddress) ||
		(trimmedAddress.startsWith('[') &&
			trimmedAddress.endsWith(']') &&
			IPV6_PATTERN.test(trimmedAddress.slice(1, -1)))
	);
}

/** Erzeugt einen sicheren Bind-Namen, falls ein Eingabename ungeeignet ist. */
export function getSafeBindName(inputName: string | undefined, port: number): string {
	const trimmedName = (inputName ?? '').trim();
	if (!trimmedName) return `bind_${port}`;
	if (/\*|\./.test(trimmedName)) return `bind_${port}`;
	if (isValidBindAddress(trimmedName)) return `bind_${port}`;
	return trimmedName.length <= 32 && SAFE_BIND_NAME_PATTERN.test(trimmedName)
		? trimmedName
		: `bind_${port}`;
}
