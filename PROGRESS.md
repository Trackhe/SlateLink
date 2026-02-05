# SlateLink – Fortschritt & Roadmap

**Regel:** Pro Feature / Meilenstein ein eigener Commit + ein Tag. Dieser Plan wird beim Abarbeiten abgehakt.

---

## Roadmap (Reihenfolge)

| # | Schritt | Tag | Status |
|---|--------|-----|--------|
| 1 | **Commit: Aktueller Stand** – SvelteKit-Grundgerüst, Control-Plane-Status (Dashboard), /api/info, Port 3001, Dataplane getInfo/getStats | `milestone/m2-app-base` | ⬜ |
| 2 | **Feature: GET /api/health** – Health-Check-Endpoint | `feature/health-api` | ⬜ |
| 3 | **Feature: Dataplane Config lesen** – getConfigurationVersion(), getFrontends(), getBackends() | `feature/dataplane-config-read` | ⬜ |
| 4 | **Feature: API-Routen** – GET /api/frontends, /api/backends, /api/stats | `feature/api-frontends-backends-stats` | ⬜ |
| 5 | **Feature: Layout + Navigation** – Nav: Dashboard, Config, Certificates, Audit | `feature/layout-navigation` | ⬜ |
| 6 | **Feature: DB + Audit** – SQLite-Schema, audit.ts, GET /api/audit | `feature/audit-db` | ⬜ |
| 7 | **Feature: Certificates API** – getSslCertificates, upload/replace, /api/certificates, Certbot-Hook | `feature/certificates-api` | ⬜ |
| 8 | **Feature: Stats Snapshot/History** – writeStatsSnapshot, /api/stats/snapshot, /api/stats/history | `feature/stats-snapshot-history` | ⬜ |
| 9 | **Feature: UI-Seiten** – Config-, Certificates-, Audit-Seiten mit fetch zu APIs | `feature/ui-pages` | ⬜ |
| 10 | **Meilenstein M2 abgeschlossen** | `milestone/m2-app-complete` | ⬜ |

---

## Später (laut IMPLEMENTATION.md)

- Konfiguration schreiben (Frontend/Backend/Server über DPA)
- Stats-Snapshot-Timer (periodisch + Retention)
- Optional: Multipart Certbot, API-Key für Hook

---

## Erledigt (zum Abhaken)

- [ ] 1. milestone/m2-app-base
- [ ] 2. feature/health-api
- [ ] 3. feature/dataplane-config-read
- [ ] 4. feature/api-frontends-backends-stats
- [ ] 5. feature/layout-navigation
- [ ] 6. feature/audit-db
- [ ] 7. feature/certificates-api
- [ ] 8. feature/stats-snapshot-history
- [ ] 9. feature/ui-pages
- [ ] 10. milestone/m2-app-complete

*Status wird bei jedem Commit aktualisiert.*
