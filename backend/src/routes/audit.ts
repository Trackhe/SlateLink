/**
 * Audit log API: GET /api/audit with filters and pagination.
 */

import { Elysia } from "elysia";
import { getAuditLog } from "../lib/audit";

export const auditRoutes = new Elysia({ prefix: "/api" }).get(
  "/audit",
  async ({ query }) => {
    const fromTimestamp = query.from ?? null;
    const toTimestamp = query.to ?? null;
    const action = query.action ?? null;
    const resourceType = query.resource_type ?? null;
    const limit = query.limit != null ? parseInt(String(query.limit), 10) : 100;
    const offset =
      query.offset != null ? parseInt(String(query.offset), 10) : 0;

    const entries = getAuditLog({
      fromTimestamp: fromTimestamp ?? undefined,
      toTimestamp: toTimestamp ?? undefined,
      action: action ?? undefined,
      resourceType: resourceType ?? undefined,
      limit: Number.isNaN(limit) ? 100 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });
    return { entries };
  }
);
