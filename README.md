# SlateLink – HAProxy Management Web Interface

Web-Interface zur Verwaltung von HAProxy über die offizielle **HAProxy Data Plane API**. Unterstützt HTTP-, TCP- und UDP-Stream-Proxy, Client-IP-Weitergabe (X-Forwarded-For / PROXY protocol), Statistiken (Live + Historie), Audit-Log und Zertifikatsverwaltung (Certbot-Hook).

## Architektur

- **HAProxy** (mit Data Plane API) – Reverse Proxy, Stats-Frontend auf Port 8404
- **App** (ein Container: Bun + Elysia + SvelteKit-Build) – Backend-API (Data Plane API-Proxy, Audit-Log, Statistiken, SQLite) und statisches Frontend (Dashboard, Konfiguration, Zertifikate, Audit-Log) auf Port 3000

## Voraussetzungen

- Docker und Docker Compose
- Optional: Bun (für lokale Backend-Entwicklung), Node.js (für Frontend)

## Schnellstart

```bash
cp .env.example .env
# Optional: .env anpassen (DPA-Credentials, etc.)
docker compose up -d
```

- **HAProxy:** http://localhost:80, https://localhost:443, Stats http://localhost:8404/stats  
- **App (Backend + Frontend):** http://localhost:3000 – API unter `/api/*`, Health unter `/health`, Frontend (Dashboard etc.) unter `/`

## Entwicklung

### Backend (Bun)

```bash
cd backend
bun install
bun run dev
bun test
```

Umgebungsvariablen wie in `.env.example` (z. B. `DATAPLANE_API_URL=http://localhost:5555`, wenn HAProxy lokal läuft).

### Frontend (SvelteKit, nur für lokale Entwicklung)

```bash
cd frontend
npm install
npm run dev
```

Mit `PUBLIC_BACKEND_URL=http://localhost:3000` (oder leer für Same-Origin, wenn später vom Backend ausgeliefert).

## API (Backend)

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /health` | Health-Check |
| `GET /api/info` | Data Plane API Info |
| `GET /api/frontends` | Frontends (DPA) |
| `GET /api/backends` | Backends (DPA) |
| `GET /api/certificates` | SSL-Zertifikate (DPA) |
| `GET /api/stats` | Live-Statistiken (HAProxy Stats) |
| `GET /api/stats/snapshot` | Snapshot in DB schreiben |
| `GET /api/stats/history` | Historie aus SQLite (from, to, limit, offset) |
| `GET /api/audit` | Audit-Log (from, to, action, resource_type, limit, offset) |
| `POST /api/certificates/upload-from-certbot` | Certbot-Hook: JSON `{ pem, storage_name }` oder text/plain + x-storage-name |

## Dokumentation

- **Implementierungsstand:** [IMPLEMENTATION.md](IMPLEMENTATION.md) – listet alle implementierten Funktionen, Tests und nächste Schritte. Vor Weiterentwicklung lesen, um Doppelungen zu vermeiden und Tests zu nutzen.

## Meilensteine (Git-Tags)

- `milestone/m1-infrastructure` – Docker Compose, HAProxy-Konfiguration

## Lizenz

Projekt-spezifisch.
