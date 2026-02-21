# SlateLink – Implementierungsstand und Dokumentation

**Zweck:** Beim Weiterarbeiten diese Datei lesen, um zu wissen, was bereits implementiert ist und Doppelungen zu vermeiden.

**Prozess (Plan §9.1):** Commits nach Features; **Tests vor jedem Commit** (`bun test`); Fortschritt in **PROGRESS.md** tracken; **Komponentendiagramm** (z. B. README oder hier) bei relevanten Änderungen aktualisieren; Meilensteine taggen.

---

## 1. Bereits umgesetzt

### M1 – Infrastruktur (Tag: `milestone/m1-infrastructure`)

| Komponente     | Datei(en)             | Beschreibung                                                                                          |
| -------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| Docker Compose | `docker-compose.yml`  | Services: haproxy (s6), app (SvelteKit). Netz, Volumes.                                               |
| HAProxy        | `haproxy/haproxy.cfg` | global, userlist, defaults (forwardfor), Stats-Frontend :8404, HTTP-Beispiel, TCP/UDP auskommentiert. |
| .gitignore     | `.gitignore`          | node_modules, .env, dist, \*.db, certbot, data.                                                       |

---

### M2 – App (ein SvelteKit-Projekt, Node + adapter-node)

| Komponente            | Datei(en)                                                                                                                                                | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konfiguration         | `src/lib/server/config.ts`                                                                                                                               | Env: DATAPLANE*API*\*, DATABASE_PATH, HAPROXY_STATS_URL; optional: HAPROXY_SSL_CERTS_DIR (PEM von Disk, ohne Socket), HAPROXY_STATS_SOCKET (PEM via „dump ssl cert“), STATS_SNAPSHOT_INTERVAL_MS, STATS_RETENTION_DAYS.                                                                                                                                                                                                                                                                                                                                                                                |
| Data Plane API Client | `src/lib/server/dataplane.ts`                                                                                                                            | getInfo(), getFrontends(), getFrontend(name), getBackends(), getBackend(name); frontendNamesUsingBackend(raw, backendName); usedConfigNames(raw, raw); getAllUsedBindEndpoints(), bindEndpointKey(); createFrontend/Backend, updateFrontend/Backend, deleteFrontend/Backend; getBinds(), createBind(), deleteBind(); getServers(), createServer(), updateServer(), deleteServer(); getDefaults(), updateDefaults(). createServer: Default check: 'disabled'.                                                                                                                                      |
| Audit Logger          | `src/lib/server/audit.ts`                                                                                                                                | logAction(entry), getAuditLog(options).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Datenbank             | `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`                                                                                              | SQLite (better-sqlite3). Tabellen: stats_snapshots, audit_log. getDatabase(), closeDatabase().                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Stats Collector       | `src/lib/server/stats.ts`                                                                                                                                | writeStatsSnapshot(), getStatsHistory(), deleteSnapshotsOlderThanDays(), startStatsSnapshotTimer().                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| API-Routen            | `src/routes/api/**/+server.ts`                                                                                                                           | GET /api/health, /api/info, /api/audit, /api/frontends, /api/backends, /api/stats, /api/stats/snapshot, /api/stats/history; POST /api/config/backends, POST /api/config/frontends; PUT/DELETE /api/config/backends/[name], /api/config/frontends/[name]; POST/PUT/DELETE /api/config/backends/[name]/servers, /api/config/backends/[name]/servers/[server_name] (PUT z. B. { "check": "disabled" }); POST/PUT/DELETE /api/config/frontends/[name]/binds, /api/config/frontends/[name]/binds/[bind_name]. DELETE Backend nur wenn kein Frontend verweist (409). POST /api/config/proxies (Legacy). |
| UI                    | `src/routes/+layout.svelte`, `config/`, `config/backends/new/`, `config/frontends/new/`, `config/backends/[name]/`, `config/frontends/[name]/`, `audit/` | Config: Liste; „Backend anlegen“, „Frontend anlegen“. Backend-Detail: Bearbeiten (Mode, Server hinzufügen/entfernen), pro Server „Check deaktivieren“, Löschen wenn kein Frontend verweist. Frontend-Detail: Bearbeiten (default_backend, Binds hinzufügen/entfernen), Löschen.                                                                                                                                                                                                                                                                                                                   |
| Build                 | `package.json`, `svelte.config.js`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`                                                          | adapter-node, Tailwind 3, Vite 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Docker                | `Dockerfile`                                                                                                                                             | node:22-alpine, `bun run build`, node build, Port 3001. **Package Manager:** Bun (`bun install`, `bun run dev`, `bun test`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

### M5 – Audit im UI

- Audit-Seite unter `/audit`: Tabelle mit Zeitpunkt, Aktion, Ressource, Details. Nutzt GET /api/audit?limit=50. Filter (from, to, action, resource_type) können später ergänzt werden.

---

| Hooks | `src/hooks.server.ts` | Startet Stats-Snapshot-Timer beim ersten Request. |
| Tests | `src/lib/server/**/*.test.ts`, `src/lib/shared/**/*.test.ts` | Vitest: db, audit, stats, dataplane, dpa-utils, bind-validation, rules-validation, sync-frontend-rules, domain-mapping (51 Tests). `npm run test` / `bun run test`. |

---

### M6 – Doku (teilweise)

| Datei          | Inhalt                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `.env.example` | DATAPLANE*API*\*, DATABASE_PATH, HAPROXY_STATS_URL, PORT.                                           |
| `README.md`    | Architektur, Schnellstart, Entwicklung, API-Übersicht, Verweis auf IMPLEMENTATION.md, Meilensteine. |

---

## 2. Implementierte Funktionen (Übersicht)

- **config:** config (src/lib/server/config.ts)
- **dataplane:** getInfo(), getConfigurationVersion(), getFrontends(), getFrontend(name), getBackends(), getBackend(name); createFrontend/Backend(), updateFrontend/Backend(), deleteFrontend/Backend(); getServers(), createServer(), updateServer(), deleteServer(); getBinds(), createBind(), deleteBind()
- **audit:** logAction(entry), getAuditLog(options)
- **stats:** writeStatsSnapshot(), getStatsHistory(), deleteSnapshotsOlderThanDays(), startStatsSnapshotTimer()
- **db:** getDatabase(), closeDatabase(), schemaStatements, AuditLogRow, StatsSnapshotRow (better-sqlite3)
- **UI:** Seiten Dashboard, Config (Liste + Detail frontends/backends), Audit

---

## 3. Tests

**Lauf:** `bun run test` (Vitest). Vor jedem Commit Tests ausführen; nur bei grün committen (Plan §9.1).  
**Ort:** `src/lib/server/**/*.test.ts`.

| Datei                              | Getestet                                                                                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/index.test.ts`  | Schema audit_log, stats_snapshots; INSERT/SELECT. DB mit `:memory:` (vi.mock `$env/dynamic/private` → process.env).                                                                                                                            |
| `src/lib/server/audit.test.ts`     | logAction (id, optionale Felder); getAuditLog (Reihenfolge, Filter action, limit). Nach Test: closeDatabase().                                                                                                                                 |
| `src/lib/server/stats.test.ts`     | getStatsHistory (leer, mit Daten, limit); deleteSnapshotsOlderThanDays.                                                                                                                                                                        |
| `src/lib/server/dataplane.test.ts` | getInfo, getConfigurationVersion, getFrontends, getFrontend, getBackends, getBackend; frontendNamesUsingBackend; usedConfigNames; bindEndpointKey; getAllUsedBindEndpoints; deleteBind, deleteServer (Pfad + method). globalThis.fetch mocken. |
| `src/lib/server/dpa-utils.test.ts` | `toArray` und `toDpaList`: Array, `{ data: [] }`, null/undefined/ungueltige Payloads. |
| `src/lib/shared/bind-validation.test.ts` | `isValidBindAddress` und `getSafeBindName`: gueltige/ungueltige Bind-Adressen, sichere Name-Fallbacks. |
| `src/lib/server/rules-validation.test.ts` | `parseRuleId` und `normalizeDomains`: gueltige/ungueltige IDs, Domain-Normalisierung. |
| `src/lib/server/sync-frontend-rules.test.ts` | Sync-Flow mit Mocks: ACL/Switching/Redirect-Aufbau und domain_mapping-Write-Aufruf. |
| `src/lib/server/domain-mapping.test.ts` | `buildDomainMappingContent`: Inhalte aus Regeln + Default-Fallback ohne Regeln. |
| `src/lib/server/db/index.test.ts` | Erweitert um `frontend_rules` CRUD und Fallback bei ungueltigem JSON in DB-Spalten. |

**Regel:** Neue Module/Routen zeitnah testen; Test-Doku hier anpassen und mit committen.

**Sinnvolle Tests & Strategie:** Siehe **docs/TODO.md** §6 (Was testen, Priorität, konkrete Test-Ideen für toDpaList, Validierung, frontend_rules, domain-mapping, sync). Defensives Verhalten (ungültige IDs, leere DPA-Response, kaputtes JSON) explizit abdecken.

---

## 3.1 SSL-Ordner und crt_base (v3-Spec)

Laut **v3-Spezifikation** (`crt_store`):
- **crt_base:** „Default directory to **fetch** SSL certificates from“ – Verzeichnis, aus dem Zertifikate gelesen werden. Die Spec legt nicht fest, wo ACME-Zertifikate hingeschrieben werden.
- **Storage:** Zertifikate auf Platte verwaltet die **Data Plane API** über `/services/haproxy/storage/ssl_certificates` im Verzeichnis **`resources.ssl_certs_dir`** (z. B. `/usr/local/etc/haproxy/ssl`).

**Empfehlung:** `crt_base` und `key_base` im CrtStore so wählen, dass sie auf dasselbe Verzeichnis zeigen wie **`resources.ssl_certs_dir`** in der DPA-Config – dann liegen Uploads und die von HAProxy/ACME erwarteten Dateien am gleichen Ort.

**„Kein Zertifikat“ obwohl ACME ausgestellt?**  
Die v3-Spec definiert nicht, wo der ACME-Client die Datei speichert. Die Zertifikatsdatei muss im Verzeichnis liegen, auf das **crt_base** bzw. **ssl_certs_dir** zeigt; ggf. prüfen, wo das Zertifikat tatsächlich ankommt, oder per Hook/Manuell dorthin legen.

### 3.2 ACME-Server mit selbstsigniertem Zertifikat

Wenn **keine Anfrage** beim ACME-Server ankommt (z. B. lokaler Test-ACME auf dem Host), blockiert oft die **TLS-Verifizierung**: HAProxy bricht die Verbindung ab, bevor eine HTTP-Anfrage gesendet wird.

**Lösung:** In der Global-Config `httpclient.ssl.verify none` setzen. In der App: Store-Detail → „ACME-Scheduler + TLS-Verify aus (selbstsign. ACME-Server)“ klicken (setzt Scheduler auf „auto“ und `httpclient.ssl.verify none`). API: `POST /api/config/acme/enable-scheduler?insecure=1`.

Falls die Data Plane API das Feld `httpclient.ssl.verify` nicht unterstützt (PUT Global schlägt fehl oder ignoriert es), die Zeile manuell in `haproxy.cfg` unter `global` eintragen – beachten, dass die DPA die Config bei Änderungen überschreiben kann.

---

## 4. Noch nicht umgesetzt

- **Optional:** Multipart-Upload für Certbot-Hook; API-Key für Hook-Endpoint.

---

## 5. Code-Qualität (Plan)

- Keine Abkürzungen (außer id, url, ip). Konkret: Variablen ausschreiben – siehe **docs/TODO.md** §1.
- **Redundanzen vermeiden (DRY):** Eine Quelle für Validierung (z. B. isValidBindAddress), eine für DPA-Listen-Normalisierung (toDpaList); siehe **docs/TODO.md** §3.
- **Defensiv, aber ohne unnötige Checks:** An Grenzen (API-Input, DPA-Response, DB-JSON) validieren und absichern; intern keine doppelten Prüfungen für bereits validierte Werte – siehe **docs/TODO.md** §4.
- **Fehlervermeidung:** Validierung an der Grenze, einheitliche Fehlerantworten, Transaktionen bei Sync, keine stillen Fallbacks für kritische Daten – **docs/TODO.md** §5.
- Modular: Dataplane, Audit, Stats, DB getrennt; Frontend API-Client + Seiten.
- Defensiv: Eingaben validieren; DPA-/Fetch-Fehler loggen und propagieren.

**Komponentendiagramme:** Bei relevanten Änderungen [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) anpassen (System, Server-Module, API, UI, Datenfluss).

---

_Zuletzt aktualisiert: PUT Server (check: disabled), Backend-Detail „Check deaktivieren“; updateServer in dataplane; IMPLEMENTATION.md._
