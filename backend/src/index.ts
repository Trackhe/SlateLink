/**
 * SlateLink Backend: Elysia app, Data Plane API proxy, Audit log, Stats.
 * Optional: statisches Frontend aus STATIC_PATH ausliefern (ein Container).
 * Read IMPLEMENTATION.md for what is implemented and how to avoid duplicates.
 */

import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "fs";
import { config } from "./config";
import { infoRoutes } from "./routes/info";
import { auditRoutes } from "./routes/audit";
import { configRoutes } from "./routes/config";
import { certificatesRoutes } from "./routes/certificates";
import { statsRoutes } from "./routes/stats";

let application = new Elysia()
  .use(infoRoutes)
  .use(auditRoutes)
  .use(configRoutes)
  .use(certificatesRoutes)
  .use(statsRoutes)
  .get("/health", () => ({ status: "ok" }));

if (config.staticPath && existsSync(config.staticPath)) {
  application = application.use(
    staticPlugin({
      assets: config.staticPath,
      prefix: "/",
      indexHTML: true,
    })
  );
}

application = application.listen(config.serverPort);

console.log(
  `SlateLink Backend listening on http://localhost:${application.server?.port ?? config.serverPort}`
);
