/**
 * Application configuration from environment variables.
 * Use full names; no abbreviations except standard (e.g. url).
 */

function getRequired(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  dataplaneApiUrl: getOptional("DATAPLANE_API_URL", "http://localhost:5555"),
  dataplaneApiUser: getOptional("DATAPLANE_API_USER", "admin"),
  dataplaneApiPassword: getOptional("DATAPLANE_API_PASSWORD", "adminpwd"),
  databasePath: getOptional("DATABASE_PATH", "./data/app.db"),
  haproxyStatsUrl: getOptional("HAPROXY_STATS_URL", "http://localhost:8404/stats"),
  serverPort: parseInt(getOptional("PORT", "3000"), 10),
  /** Wenn gesetzt: statisches Frontend aus diesem Verzeichnis ausliefern (z. B. /app/frontend/build). */
  staticPath: getOptional("STATIC_PATH", ""),
} as const;

export function getConfigForTests(overrides: Partial<typeof config> = {}): typeof config {
  return { ...config, ...overrides };
}
