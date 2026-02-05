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
| Data Plane API Client | `src/lib/server/dataplane.ts` | getConfigurationVersion(), getInfo(), getFrontends(), getBackends(), getSslCertificates(), uploadSslCertificate(), replaceSslCertificate(), getDataplaneBaseUrl(), fetchWithAuth(). |
| Audit Logger | `src/lib/server/audit.ts` | logAction(entry), getAuditLog(options). |
| Datenbank | `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts` | SQLite (better-sqlite3). Tabellen: stats_snapshots, audit_log. getDatabase(), closeDatabase(). |
| Stats Collector | `src/lib/server/stats.ts` | writeStatsSnapshot(), getStatsHistory(), deleteSnapshotsOlderThanDays(), startStatsSnapshotTimer(). |
| API-Routen | `src/routes/api/**/+server.ts` | GET /api/health, /api/info, /api/audit, /api/frontends, /api/backends, /api/certificates, /api/stats, /api/stats/snapshot, /api/stats/history, POST /api/certificates/upload-from-certbot. |
| UI | `src/routes/+layout.svelte`, `+page.svelte`, `config/`, `certificates/`, `audit/` | Layout mit Navigation; Seiten rufen fetch("/api/...") auf (Same-Origin). |
| Build | `package.json`, `svelte.config.js`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js` | adapter-node, Tailwind 3, Vite 5. |
| Docker | `Dockerfile` | node:22-alpine, `bun run build`, node build, Port 3001. **Package Manager:** Bun (`bun install`, `bun run dev`, `bun test`). |

---

### M5 – Audit im UI

- Audit-Seite unter `/audit`: Tabelle mit Zeitpunkt, Aktion, Ressource, Details. Nutzt GET /api/audit?limit=50. Filter (from, to, action, resource_type) können später ergänzt werden.

---

| Hooks | `src/hooks.server.ts` | Startet Stats-Snapshot-Timer beim ersten Request. |
| Tests | `src/lib/server/**/*.test.ts` | Vitest: db, audit, stats, dataplane (17 Tests). `bun run test`. |

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
- **dataplane:** getConfigurationVersion(), getInfo(), getFrontends(), getBackends(), getSslCertificates(), uploadSslCertificate(), replaceSslCertificate(), getDataplaneBaseUrl(), fetchWithAuth(path, options)
- **audit:** logAction(entry), getAuditLog(options)
- **stats:** fetchAndParseStats(), writeStatsSnapshot(rows)
- **db:** getDatabase(), closeDatabase(), schemaStatements, StatsSnapshotRow, AuditLogRow (better-sqlite3)
- **UI:** Seiten Dashboard, Config, Certificates, Audit; rufen fetch("/api/...") auf

---

## 3. Tests

**Package Manager:** **Bun** – Tests mit `bun test`.  
**Ort:** z. B. `src/**/*.test.ts` oder `tests/**/*.test.ts` (noch nicht angelegt).

| Datei | Getestet |
|-------|----------|
| `db/index.test.ts` | Schema: audit_log, stats_snapshots; INSERT/SELECT. |
| `lib/audit.test.ts` | logAction (Eintrag + id, optionale Felder null); getAuditLog (alle, Filter action, limit/offset). |
| `lib/dataplane.test.ts` | getInfo (200/401); getConfigurationVersion (version/fehlt); getFrontends (Array/v2-Wrapper). |
| `lib/stats.test.ts` | fetchAndParseStats (CSV parsen, Zeilen); Fehler bei 502. |

**Hinweis:** Audit-Tests: setDatabaseOverride(inMemoryDb). Dataplane/Stats-Tests: globalThis.fetch mocken.

---

## 4. Noch nicht umgesetzt

- **Konfiguration schreiben:** Frontend/Backend/Server anlegen/ändern/löschen über DPA (mit Version-Handling und Audit-Log).
- **Optional:** Multipart-Upload für Certbot-Hook (aktuell nur JSON/text/plain); API-Key für Hook-Endpoint.

---

## 5. Code-Qualität (Plan)

- Keine Abkürzungen (außer id, url, ip).
- Modular: Dataplane, Audit, Stats, DB getrennt; Frontend API-Client + Seiten.
- DRY: gemeinsame Hilfsfunktionen zentral.
- Defensiv: Eingaben validieren; DPA-/Fetch-Fehler loggen und propagieren.

---

*Zuletzt aktualisiert: M2–M6; Unit-Tests (Vitest, 17 Tests); Stats-Snapshot-Timer + Retention; Komponentendiagramm in README.*
