# SlateLink – Fortschritt & Roadmap

**Regeln (siehe auch Plan §9.1):**

- Pro Feature ein eigener Commit; Meilensteine werden getaggt.
- **Vor jedem Commit:** Tests ausführen (`bun test`); nur bei grün committen. Tests zwischendurch ausführen.
- **Fortschritt:** Diese Datei bei jedem erledigten Schritt abhaken und mit committen.
- **Dokumentation:** Komponentendiagramm (z. B. in README/IMPLEMENTATION/docs) bei relevanten Änderungen aktualisieren.

---

## Roadmap (Reihenfolge)

| # | Schritt | Tag | Status |
|---|--------|-----|--------|
| 1 | **Commit: Aktueller Stand** – SvelteKit-Grundgerüst, Control-Plane-Status (Dashboard), /api/info, Port 3001, Dataplane getInfo/getStats | `milestone/m2-app-base` | ✅ |
| 2 | **Feature: GET /api/health** – Health-Check-Endpoint | `feature/health-api` | ✅ |
| 3 | **Feature: Dataplane Config lesen** – getConfigurationVersion(), getFrontends(), getBackends() | `feature/dataplane-config-read` | ✅ |
| 4 | **Feature: API-Routen** – GET /api/frontends, /api/backends, /api/stats | `feature/api-frontends-backends-stats` | ✅ |
| 5 | **Feature: Layout + Navigation** – Nav: Dashboard, Config, Certificates, Audit | `feature/layout-navigation` | ✅ |
| 6 | **Feature: DB + Audit** – SQLite-Schema, audit.ts, GET /api/audit | `feature/audit-db` | ✅ |
| 7 | **Feature: Certificates API** – getSslCertificates, upload/replace, /api/certificates, Certbot-Hook | `feature/certificates-api` | ✅ |
| 8 | **Feature: Stats Snapshot/History** – writeStatsSnapshot, /api/stats/snapshot, /api/stats/history | `feature/stats-snapshot-history` | ✅ |
| 9 | **Feature: UI-Seiten** – Config-, Certificates-, Audit-Seiten mit fetch zu APIs | `feature/ui-pages` | ✅ |
| 10 | **Meilenstein M2 abgeschlossen** | `milestone/m2-app-complete` | ✅ |
| 11 | **Feature: Unit-Tests** – Vitest, db/audit/stats/dataplane (17 Tests) | `feature/unit-tests` | ✅ |
| 12 | **Feature: Stats-Snapshot-Timer** – periodisch, Retention, hooks.server | `feature/stats-snapshot-timer` | ✅ |
| 13 | **Feature: Komponentendiagramm** – Mermaid in README | `feature/component-diagram` | ✅ |

---

## Später (laut IMPLEMENTATION.md)

- Konfiguration schreiben (Frontend/Backend/Server über DPA)
- Optional: Multipart Certbot, API-Key für Hook

---

## Erledigt (zum Abhaken)

- [x] 1. milestone/m2-app-base
- [x] 2. feature/health-api
- [x] 3. feature/dataplane-config-read
- [x] 4. feature/api-frontends-backends-stats
- [x] 5. feature/layout-navigation
- [x] 6. feature/audit-db
- [x] 7. feature/certificates-api
- [x] 8. feature/stats-snapshot-history
- [x] 9. feature/ui-pages
- [x] 10. milestone/m2-app-complete
- [x] 11. feature/unit-tests
- [x] 12. feature/stats-snapshot-timer
- [x] 13. feature/component-diagram

*Status wird bei jedem Commit aktualisiert.*
