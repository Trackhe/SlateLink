# SlateLink – Implementierungsstand und Dokumentation

**Zweck:** Beim Weiterarbeiten diese Datei lesen, um zu wissen, was bereits implementiert ist und Doppelungen zu vermeiden.

**Prozess (Plan §9.1):** Commits nach Features; **Tests vor jedem Commit** (`bun test`); Fortschritt in **PROGRESS.md** tracken; **Komponentendiagramm** (z. B. README oder hier) bei relevanten Änderungen aktualisieren; Meilensteine taggen.

---

## 1. Bereits umgesetzt

### M1 – Infrastruktur (Tag: `milestone/m1-infrastructure`)

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| Docker Compose | `docker-compose.yml` | Services: haproxy (s6), app (SvelteKit). Netz, Volumes. |
| HAProxy | `haproxy/haproxy.cfg` | global, userlist, defaults (forwardfor), Stats-Frontend :8404, HTTP-Beispiel, TCP/UDP auskommentiert. |
| .gitignore | `.gitignore` | node_modules, .env, dist, *.db, certbot, data. |

---

### M2 – App (ein SvelteKit-Projekt, Node + adapter-node)

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| Konfiguration | `src/lib/server/config.ts` | Env: DATAPLANE_API_*, DATABASE_PATH, HAPROXY_STATS_URL, STATS_SNAPSHOT_INTERVAL_MS, STATS_RETENTION_DAYS. |
| Data Plane API Client | `src/lib/server/dataplane.ts` | getInfo(), getFrontends(), getFrontend(name), getBackends(), getBackend(name); frontendNamesUsingBackend(raw, backendName); usedConfigNames(raw, raw); getAllUsedBindEndpoints(), bindEndpointKey(); createFrontend/Backend, updateFrontend/Backend, deleteFrontend/Backend; getBinds(), createBind(), deleteBind(); getServers(), createServer(), deleteServer(); getDefaults(), updateDefaults(); getSslCertificates(), upload/replaceSslCertificate(). |
| Audit Logger | `src/lib/server/audit.ts` | logAction(entry), getAuditLog(options). |
| Datenbank | `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts` | SQLite (better-sqlite3). Tabellen: stats_snapshots, audit_log. getDatabase(), closeDatabase(). |
| Stats Collector | `src/lib/server/stats.ts` | writeStatsSnapshot(), getStatsHistory(), deleteSnapshotsOlderThanDays(), startStatsSnapshotTimer(). |
| API-Routen | `src/routes/api/**/+server.ts` | GET /api/health, /api/info, /api/audit, /api/frontends, /api/backends, /api/certificates, /api/stats, /api/stats/snapshot, /api/stats/history; POST /api/config/backends, POST /api/config/frontends; PUT/DELETE /api/config/backends/[name], /api/config/frontends/[name]; POST/DELETE /api/config/backends/[name]/servers, /api/config/backends/[name]/servers/[server_name]; POST/DELETE /api/config/frontends/[name]/binds, /api/config/frontends/[name]/binds/[bind_name]. DELETE Backend nur wenn kein Frontend verweist (409). POST /api/config/proxies (Legacy); POST /api/certificates/upload-from-certbot. |
| UI | `src/routes/+layout.svelte`, `config/`, `config/backends/new/`, `config/frontends/new/`, `config/backends/[name]/`, `config/frontends/[name]/`, `certificates/`, `audit/` | Config: Liste; „Backend anlegen“, „Frontend anlegen“. Backend-Detail: Bearbeiten (Mode, Server hinzufügen/entfernen), Löschen wenn kein Frontend verweist. Frontend-Detail: Bearbeiten (default_backend, Binds hinzufügen/entfernen), Löschen. |
| Build | `package.json`, `svelte.config.js`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js` | adapter-node, Tailwind 3, Vite 5. |
| Docker | `Dockerfile` | node:22-alpine, `bun run build`, node build, Port 3001. **Package Manager:** Bun (`bun install`, `bun run dev`, `bun test`). |

---

### M5 – Audit im UI

- Audit-Seite unter `/audit`: Tabelle mit Zeitpunkt, Aktion, Ressource, Details. Nutzt GET /api/audit?limit=50. Filter (from, to, action, resource_type) können später ergänzt werden.

---

| Hooks | `src/hooks.server.ts` | Startet Stats-Snapshot-Timer beim ersten Request. |
| Tests | `src/lib/server/**/*.test.ts` | Vitest: db, audit, stats, dataplane (32 Tests). `npm run test` / `bun run test`. |

---

### M6 – Doku (teilweise)

| Datei | Inhalt |
|-------|--------|
| `.env.example` | DATAPLANE_API_*, DATABASE_PATH, HAPROXY_STATS_URL, PORT. |
| `README.md` | Architektur, Schnellstart, Entwicklung, API-Übersicht, Verweis auf IMPLEMENTATION.md, Meilensteine. |

**Certbot-Hook:** `POST /api/certificates/upload-from-certbot` – akzeptiert JSON `{ pem, storage_name }` oder text/plain mit Header `x-storage-name`. Holt Version von DPA, ersetzt vorhandenes Zertifikat (PUT) oder lädt neues (POST), schreibt Audit-Eintrag. Certbot-Skript kann z. B. `curl -X POST -H "Content-Type: application/json" -d '{"pem":"'$(cat fullchain.pem)$(cat privkey.pem)'", "storage_name":"example.com.pem"}'` nutzen.

---

## 2. Implementierte Funktionen (Übersicht)

- **config:** config (src/lib/server/config.ts)
- **dataplane:** getInfo(), getConfigurationVersion(), getFrontends(), getFrontend(name), getBackends(), getBackend(name); createFrontend/Backend(), updateFrontend/Backend(), deleteFrontend/Backend(); getSslCertificates(), upload/replaceSslCertificate()
- **audit:** logAction(entry), getAuditLog(options)
- **stats:** writeStatsSnapshot(), getStatsHistory(), deleteSnapshotsOlderThanDays(), startStatsSnapshotTimer()
- **db:** getDatabase(), closeDatabase(), schemaStatements, AuditLogRow, StatsSnapshotRow (better-sqlite3)
- **UI:** Seiten Dashboard, Config (Liste + Detail frontends/backends), Certificates, Audit

---

## 3. Tests

**Lauf:** `bun run test` (Vitest). Vor jedem Commit Tests ausführen; nur bei grün committen (Plan §9.1).  
**Ort:** `src/lib/server/**/*.test.ts`.

| Datei | Getestet |
|-------|----------|
| `src/lib/server/db/index.test.ts` | Schema audit_log, stats_snapshots; INSERT/SELECT. DB mit `:memory:` (vi.mock `$env/dynamic/private` → process.env). |
| `src/lib/server/audit.test.ts` | logAction (id, optionale Felder); getAuditLog (Reihenfolge, Filter action, limit). Nach Test: closeDatabase(). |
| `src/lib/server/stats.test.ts` | getStatsHistory (leer, mit Daten, limit); deleteSnapshotsOlderThanDays. |
| `src/lib/server/dataplane.test.ts` | getInfo, getConfigurationVersion, getFrontends, getFrontend, getBackends, getBackend; frontendNamesUsingBackend; usedConfigNames; bindEndpointKey; getAllUsedBindEndpoints; deleteBind, deleteServer (Pfad + method). globalThis.fetch mocken. |

**Regel:** Neue Module/Routen zeitnah testen; Test-Doku hier anpassen und mit committen.

---

## 4. Noch nicht umgesetzt

- **Optional:** Multipart-Upload für Certbot-Hook; API-Key für Hook-Endpoint.

---

## 5. Code-Qualität (Plan)

- Keine Abkürzungen (außer id, url, ip).
- Modular: Dataplane, Audit, Stats, DB getrennt; Frontend API-Client + Seiten.
- DRY: gemeinsame Hilfsfunktionen zentral.
- Defensiv: Eingaben validieren; DPA-/Fetch-Fehler loggen und propagieren.

---

*Zuletzt aktualisiert: Frontend/Backend bearbeiten (Detail-Seiten: Mode, Server, Binds, default_backend); deleteBind/deleteServer + API + Tests; IMPLEMENTATION.md.*
