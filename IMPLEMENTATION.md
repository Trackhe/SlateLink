# SlateLink – Implementierungsstand und Dokumentation

**Zweck:** Beim Weiterarbeiten diese Datei lesen, um zu wissen, was bereits implementiert ist, Doppelungen zu vermeiden und Tests als Absicherung zu nutzen.

---

## 1. Bereits umgesetzt

### M1 – Infrastruktur (Tag: `milestone/m1-infrastructure`)

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| Docker Compose | `docker-compose.yml` | Services: haproxy (s6), backend (Bun), frontend (SvelteKit). Netz, Volumes. |
| HAProxy | `haproxy/haproxy.cfg` | global, userlist, defaults (forwardfor), Stats-Frontend :8404, HTTP-Beispiel, TCP/UDP auskommentiert. |
| .gitignore | `.gitignore` | node_modules, .env, dist, *.db, certbot, data. |

---

### M2 – Backend (Bun/Elysia)

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| Konfiguration | `backend/src/config.ts` | Env: DATAPLANE_API_*, DATABASE_PATH, HAPROXY_STATS_URL, PORT. getConfigForTests(overrides). |
| Data Plane API Client | `backend/src/lib/dataplane.ts` | getConfigurationVersion(), getInfo(), getFrontends(), getBackends(), getSslCertificates(), getDataplaneBaseUrl(), fetchWithAuth(). |
| Audit Logger | `backend/src/lib/audit.ts` | logAction(entry), getAuditLog(options). |
| Datenbank | `backend/src/db/schema.ts`, `backend/src/db/index.ts` | Tabellen: stats_snapshots, audit_log. getDatabase(), closeDatabase(), setDatabaseOverride(). |
| Routen | `backend/src/routes/*.ts`, `backend/src/index.ts` | /health, /api/info, /api/audit, /api/frontends, /api/backends, /api/certificates, /api/stats, /api/stats/snapshot, /api/stats/history. |
| Docker | `backend/Dockerfile` | oven/bun:1-alpine, PORT 3000. |

---

### M3 – Statistiken

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| Stats Collector | `backend/src/lib/stats.ts` | fetchAndParseStats() – HAProxy Stats CSV abrufen/parsen. writeStatsSnapshot(rows) – in stats_snapshots schreiben. |
| Stats-Routen | `backend/src/routes/stats.ts` | GET /api/stats (Live), GET /api/stats/snapshot (Snapshot schreiben), GET /api/stats/history (SQLite). |

---

### M4 – Frontend (SvelteKit + Tailwind)

| Komponente | Datei(en) | Beschreibung |
|------------|-----------|--------------|
| App | `frontend/src/app.html`, `frontend/src/app.css`, `frontend/src/routes/+layout.svelte` | Layout mit Navigation (Dashboard, Konfiguration, Zertifikate, Audit-Log). Tailwind. |
| API-Client | `frontend/src/lib/api/client.ts` | getBackendUrl(), fetchApi(path, options). |
| Seiten | `frontend/src/routes/+page.svelte`, `config/+page.svelte`, `certificates/+page.svelte`, `audit/+page.svelte` | Dashboard (API-Info), Konfiguration (Frontends/Backends), Zertifikate (Liste), Audit-Log (Tabelle). |
| Build | `frontend/package.json`, `svelte.config.js`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js` | adapter-static, Tailwind 3, Vite 5. |
| Docker | `frontend/Dockerfile` | node:22-alpine, npm run dev, Port 5173. |

---

### M5 – Audit im UI

- Audit-Seite unter `/audit`: Tabelle mit Zeitpunkt, Aktion, Ressource, Details. Nutzt GET /api/audit?limit=50. Filter (from, to, action, resource_type) können später ergänzt werden.

---

### M6 – Doku (teilweise)

| Datei | Inhalt |
|-------|--------|
| `.env.example` | DATAPLANE_API_*, DATABASE_PATH, HAPROXY_STATS_URL, PORT, PUBLIC_BACKEND_URL. |
| `README.md` | Architektur, Schnellstart, Entwicklung, API-Übersicht, Verweis auf IMPLEMENTATION.md, Meilensteine. |

**Certbot-Hook:** `POST /api/certificates/upload-from-certbot` – akzeptiert JSON `{ pem, storage_name }` oder text/plain mit Header `x-storage-name`. Holt Version von DPA, ersetzt vorhandenes Zertifikat (PUT) oder lädt neues (POST), schreibt Audit-Eintrag. Certbot-Skript kann z. B. `curl -X POST -H "Content-Type: application/json" -d '{"pem":"'$(cat fullchain.pem)$(cat privkey.pem)'", "storage_name":"example.com.pem"}'` nutzen.

---

## 2. Implementierte Funktionen (Übersicht)

- **config:** config, getConfigForTests(overrides)
- **dataplane:** getConfigurationVersion(), getInfo(), getFrontends(), getBackends(), getSslCertificates(), uploadSslCertificate(), replaceSslCertificate(), getDataplaneBaseUrl(), fetchWithAuth(path, options)
- **audit:** logAction(entry), getAuditLog(options)
- **stats:** fetchAndParseStats(), writeStatsSnapshot(rows)
- **db:** getDatabase(), closeDatabase(), setDatabaseOverride(db), schemaStatements, StatsSnapshotRow, AuditLogRow
- **Frontend:** getBackendUrl(), fetchApi(); Seiten Dashboard, Config, Certificates, Audit

---

## 3. Tests

**Ort:** `backend/src/**/*.test.ts`  
**Ausführen:** `cd backend && bun test`

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
- **Stats-Snapshot-Timer:** Periodisches Schreiben von Snapshots (z. B. alle 1 min) per Timer/Cron; optional Retention (z. B. 30 Tage).
- **Optional:** Multipart-Upload für Certbot-Hook (aktuell nur JSON/text/plain); API-Key für Hook-Endpoint.

---

## 5. Code-Qualität (Plan)

- Keine Abkürzungen (außer id, url, ip).
- Modular: Dataplane, Audit, Stats, DB getrennt; Frontend API-Client + Seiten.
- DRY: gemeinsame Hilfsfunktionen zentral.
- Defensiv: Eingaben validieren; DPA-/Fetch-Fehler loggen und propagieren.

---

*Zuletzt aktualisiert: M2–M6 (ohne Certbot-Hook) implementiert, 15 Tests grün.*
