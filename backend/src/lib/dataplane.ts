/**
 * Data Plane API v3 HTTP client. All DPA calls go through this module (DRY).
 * Uses Basic Auth; no abbreviations in variable names.
 */

import { config } from "../config";

const baseUrl = config.dataplaneApiUrl.replace(/\/$/, "");
const credentials = Buffer.from(
  `${config.dataplaneApiUser}:${config.dataplaneApiPassword}`,
  "utf-8"
).toString("base64");

function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
    ...additionalHeaders,
  };
}

export async function getConfigurationVersion(): Promise<number> {
  const response = await fetch(`${baseUrl}/v3/services/haproxy/configuration/version`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data Plane API version failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { version?: number };
  if (typeof data.version !== "number") {
    throw new Error("Data Plane API version response missing version field");
  }
  return data.version;
}

export async function getInfo(): Promise<unknown> {
  const response = await fetch(`${baseUrl}/v3/info`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data Plane API info failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function getFrontends(): Promise<unknown[]> {
  const response = await fetch(
    `${baseUrl}/v3/services/haproxy/configuration/frontends`,
    { method: "GET", headers: getHeaders() }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data Plane API frontends failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) return data;
  const wrapped = data as { data?: unknown[] };
  return Array.isArray(wrapped.data) ? wrapped.data : [];
}

export async function getBackends(): Promise<unknown[]> {
  const response = await fetch(
    `${baseUrl}/v3/services/haproxy/configuration/backends`,
    { method: "GET", headers: getHeaders() }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Data Plane API backends failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) return data;
  const wrapped = data as { data?: unknown[] };
  return Array.isArray(wrapped.data) ? wrapped.data : [];
}

export async function getSslCertificates(): Promise<unknown[]> {
  const response = await fetch(
    `${baseUrl}/v3/services/haproxy/storage/ssl_certificates`,
    { method: "GET", headers: getHeaders() }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Data Plane API ssl_certificates failed: ${response.status} ${text}`
    );
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

export async function getDataplaneBaseUrl(): Promise<string> {
  return baseUrl;
}

/**
 * Upload new SSL certificate to Data Plane API (POST). Requires version from getConfigurationVersion().
 */
export async function uploadSslCertificate(
  storageName: string,
  pemBody: string,
  version: number
): Promise<unknown> {
  const formData = new FormData();
  const blob = new Blob([pemBody], { type: "application/x-pem-file" });
  formData.append("file_upload", blob, storageName);

  const response = await fetch(
    `${baseUrl}/v3/services/haproxy/storage/ssl_certificates?version=${version}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: formData,
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Data Plane API ssl_certificates upload failed: ${response.status} ${text}`
    );
  }
  return response.json();
}

/**
 * Replace existing SSL certificate (PUT). Requires version from getConfigurationVersion().
 */
export async function replaceSslCertificate(
  storageName: string,
  pemBody: string,
  version: number
): Promise<unknown> {
  const response = await fetch(
    `${baseUrl}/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(storageName)}?version=${version}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "text/plain",
      },
      body: pemBody,
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Data Plane API ssl_certificates replace failed: ${response.status} ${text}`
    );
  }
  return response.json();
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const extraHeaders = (options.headers as Record<string, string>) ?? {};
  return fetch(url, {
    ...options,
    headers: { ...getHeaders(extraHeaders), ...extraHeaders },
  });
}
