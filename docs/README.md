# SlateLink – Dokumentation

Übersicht aller Dokumente und wo was steht.

## Projekt-Übersicht

| Datei | Inhalt |
|-------|--------|
| [../README.md](../README.md) | Schnellstart, Architektur (High-Level), API-Tabelle, Troubleshooting |
| [../IMPLEMENTATION.md](../IMPLEMENTATION.md) | Implementierungsstand, Tests, SSL/ACME-Hinweise, Code-Qualitätsplan |
| [../PROGRESS.md](../PROGRESS.md) | Roadmap, Meilensteine, erledigte Features |

## Technische Docs (in `docs/`)

| Datei | Inhalt |
|-------|--------|
| [ANBINDUNG-HAPROXY-SVELTEKIT.md](ANBINDUNG-HAPROXY-SVELTEKIT.md) | Server-only DPA-Anbindung, private Env, Ablauf Browser → SvelteKit → DPA |
| [plan-acl-regeln.md](plan-acl-regeln.md) | Plan: ACL/Regeln, Binds vereinfachen, Domain→Backend/Zertifikat/Redirect, Sync-Ablauf |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Komponentendiagramme (Server, API, UI, Datenfluss) |
| [TODO.md](TODO.md) | Offene Punkte, Fehlerquellen, Codequalität (Variablen ausschreiben) |

## Spezifikationen

| Datei | Inhalt |
|-------|--------|
| [v3_specification.yaml](v3_specification.yaml) | HAProxy Data Plane API v3 (Swagger/OpenAPI) |

## Konfiguration

- **Umgebung:** `.env` (siehe `.env.example`) – DATAPLANE_API_*, DATABASE_PATH, HAPROXY_*
- **HAProxy:** `haproxy/haproxy.cfg`, `haproxy/dataplaneapi.yml`
