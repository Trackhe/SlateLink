/**
 * Whitelist und Pfadauflösung für bearbeitbare Konfigurationsdateien.
 * Nur diese Dateien dürfen über den File-Editor gelesen/geschrieben werden.
 */
import { join } from 'node:path';
import { getSslCertsWriteDir } from '$lib/server/config';

export type ConfigFileKey = 'domain_mapping' | 'haproxy_cfg' | 'dataplaneapi_yml';

const FILE_KEYS: ConfigFileKey[] = ['domain_mapping', 'haproxy_cfg', 'dataplaneapi_yml'];

/** Anzeigename und Dateiname pro Key. */
export const CONFIG_FILES: Record<
	ConfigFileKey,
	{ label: string; filename: string }
> = {
	domain_mapping: { label: 'domain_mapping.txt (crt_list)', filename: 'domain_mapping.txt' },
	haproxy_cfg: { label: 'haproxy.cfg', filename: 'haproxy.cfg' },
	dataplaneapi_yml: { label: 'dataplaneapi.yml', filename: 'dataplaneapi.yml' },
};

export function getConfigFileKeys(): ConfigFileKey[] {
	return [...FILE_KEYS];
}

export function isAllowedConfigFileKey(key: string): key is ConfigFileKey {
	return FILE_KEYS.includes(key as ConfigFileKey);
}

/**
 * Liefert den absoluten Dateipfad für einen erlaubten Key.
 * domain_mapping: getSslCertsWriteDir()/domain_mapping.txt
 * haproxy_cfg, dataplaneapi_yml: process.cwd()/haproxy/<filename>
 */
export function getConfigFilePath(key: ConfigFileKey): string {
	if (key === 'domain_mapping') {
		const baseDir = getSslCertsWriteDir();
		return baseDir ? join(baseDir, CONFIG_FILES[key].filename) : '';
	}
	const cwd = process.cwd();
	return join(cwd, 'haproxy', CONFIG_FILES[key].filename);
}
