/**
 * Proxy to Data Plane API /v3/info. No audit (read-only).
 */

import { Elysia } from "elysia";
import { getInfo } from "../lib/dataplane";

export const infoRoutes = new Elysia({ prefix: "/api" })
  .get("/info", async () => {
    const info = await getInfo();
    return info;
  });
