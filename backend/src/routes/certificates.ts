/**
 * Certificates: list from Data Plane API; POST /api/certificates/upload-from-certbot for Certbot hook.
 */

import { Elysia } from "elysia";
import {
  getSslCertificates,
  getConfigurationVersion,
  uploadSslCertificate,
  replaceSslCertificate,
} from "../lib/dataplane";
import { logAction } from "../lib/audit";

export const certificatesRoutes = new Elysia({ prefix: "/api" })
  .get("/certificates", async () => {
    const certificates = await getSslCertificates();
    return { certificates };
  })
  .post("/certificates/upload-from-certbot", async ({ body, request }) => {
    const contentType = request.headers.get("content-type") ?? "";
    let pemBody: string;
    let storageName: string;

    if (contentType.includes("application/json")) {
      const json = (body ?? {}) as { pem?: string; storage_name?: string };
      if (!json.pem) throw new Error("Missing pem in JSON body");
      pemBody = json.pem;
      storageName = (json.storage_name ?? "certbot.pem").trim() || "certbot.pem";
    } else {
      pemBody = typeof body === "string" ? body : String(body ?? "");
      storageName =
        (request.headers.get("x-storage-name") ?? "certbot.pem").trim() || "certbot.pem";
    }

    if (!pemBody.trim()) throw new Error("Empty PEM body");

    logAction({
      action: "certificate.upload",
      resourceType: "certificate",
      resourceId: storageName,
      details: JSON.stringify({ source: "certbot-hook" }),
      sourceIp: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
    });

    const version = await getConfigurationVersion();
    const existing = await getSslCertificates();
    const exists = Array.isArray(existing) && existing.some(
      (cert: { storage_name?: string }) => (cert as { storage_name?: string }).storage_name === storageName
    );

    if (exists) {
      await replaceSslCertificate(storageName, pemBody, version);
      return { ok: true, action: "replaced", storageName };
    }
    await uploadSslCertificate(storageName, pemBody, version);
    return { ok: true, action: "uploaded", storageName };
  });
