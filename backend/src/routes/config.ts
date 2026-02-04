/**
 * Config proxy: Frontends, Backends (read-only for now). Audit on write later.
 */

import { Elysia } from "elysia";
import { getFrontends, getBackends } from "../lib/dataplane";

export const configRoutes = new Elysia({ prefix: "/api" })
  .get("/frontends", async () => {
    const frontends = await getFrontends();
    return { frontends };
  })
  .get("/backends", async () => {
    const backends = await getBackends();
    return { backends };
  });
