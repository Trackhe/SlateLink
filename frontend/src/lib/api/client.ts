/**
 * Backend API base URL. No abbreviations in variable names.
 */

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    return (import.meta.env.PUBLIC_BACKEND_URL as string) || "http://localhost:3000";
  }
  return process.env.PUBLIC_BACKEND_URL || "http://localhost:3000";
}

export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getBackendUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  return fetch(url, { ...options });
}
