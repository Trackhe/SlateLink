# SlateLink – HAProxy Management Web Interface

Web-Interface zur Verwaltung von HAProxy über die offizielle **HAProxy Data Plane API**. Unterstützt HTTP-, TCP- und UDP-Stream-Proxy, Client-IP-Weitergabe (X-Forwarded-For / PROXY protocol), Statistiken (Live + Historie), Audit-Log und Zertifikatsverwaltung (Certbot-Hook).

## Architektur

- **HAProxy** (mit Data Plane API) – Reverse Proxy, Stats-Frontend auf Port 8404
- **App** (ein SvelteKit-Projekt, Node + adapter-node) – eine Anwendung: API unter `/api/*`, UI (Dashboard, Konfiguration, Zertifikate, Audit-Log) unter `/`, Port 3001

## Voraussetzungen

- **HAProxy:** immer per Docker (Docker und Docker Compose)
- **App:** optional mit Docker oder lokal (Node.js 22+)

## Zwei Betriebsarten

### 1. Alles mit Docker

```bash
cp .env.example .env
docker compose up -d
```

- **HAProxy:** http://localhost:80, https://localhost:443, Stats http://localhost:8404/stats
- **Data Plane API:** Port 5555 (Login **admin** / **adminpwd**)
- **App:** http://localhost:3001 – UI und API unter `/` bzw. `/api/*`

Die `.env` nutzt dabei die Docker-Namen (`dataplaneapi:5555`, `haproxy:8404`).

### 2. Nur HAProxy + DPA in Docker, App lokal (empfohlen für Entwicklung)

HAProxy und Data Plane API laufen in Docker, die App auf deinem Rechner:

```bash
# HAProxy + Data Plane API starten (Ports 80, 8404, 5555 auf localhost)
docker compose up -d

# .env für lokale App (muss auf localhost zeigen)
# DATAPLANE_API_URL=http://localhost:5555
# DATAPLANE_API_USER=admin
# DATAPLANE_API_PASSWORD=adminpwd
bun install
bun run dev
```

- **HAProxy:** Port 80, Stats :8404
- **Data Plane API:** Port **5555** (Login **admin** / **adminpwd**)
- **App:** http://localhost:5173 (Vite dev) bzw. 3001 (Production)

**Anmeldung:** Die Data Plane API läuft in einem eigenen Container mit festem Login **admin** / **adminpwd** (Userlist in `haproxy/haproxy.cfg`).

## Troubleshooting: „API: 502 – fetch failed“

Wenn die App **http://localhost:5555** nicht erreicht:

1. **HAProxy-Container läuft?**

   ```bash
   docker compose ps haproxy
   ```

   Sollte `Up` zeigen. Sonst: `docker compose up -d haproxy`.

2. **Data Plane API erreichbar?**

   ```bash
   curl -s -o /dev/null -w "%{http_code}" -u admin:adminpwd http://localhost:5555/v3/info
   ```

   - **200** = OK, dann liegt das Problem an der App (.env, Neustart).
   - **000** oder „Connection refused“ = Port 5555 nicht erreichbar: Container-Logs prüfen:
     ```bash
     docker compose logs haproxy --tail 80
     ```
     Wenn die Data Plane API im Container nicht startet (z. B. fehlender Socket), erscheinen Fehler dort.

3. **App lokal:** In `.env` oder `.env.local` muss stehen:

   - `DATAPLANE_API_URL=http://localhost:5555`
   - Nach Änderung an .env: App neu starten (`npm run dev`).

4. **Schnellprüfung:** `sh scripts/check-haproxy.sh` prüft Container und Erreichbarkeit von localhost:5555.

## API

| Endpoint                                     | Beschreibung                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/health`                            | Health-Check                                                                |
| `GET /api/info`                              | Data Plane API Info                                                         |
| `GET /api/frontends`                         | Frontends (DPA)                                                             |
| `GET /api/backends`                          | Backends (DPA)                                                              |
| `GET /api/certificates`                      | SSL-Zertifikate (DPA)                                                       |
| `GET /api/stats`                             | Live-Statistiken (HAProxy Stats)                                            |
| `GET /api/stats/snapshot`                    | Snapshot in DB schreiben                                                    |
| `GET /api/stats/history`                     | Historie aus SQLite (from, to, limit, offset)                               |
| `GET /api/audit`                             | Audit-Log (from, to, action, resource_type, limit, offset)                  |
| `POST /api/certificates/upload-from-certbot` | Certbot-Hook: JSON `{ pem, storage_name }` oder text/plain + x-storage-name |

## Dokumentation

- **Implementierungsstand:** [IMPLEMENTATION.md](IMPLEMENTATION.md) – listet alle implementierten Funktionen und nächste Schritte.

## Meilensteine (Git-Tags)

- `milestone/m1-infrastructure` – Docker Compose, HAProxy-Konfiguration

## Lizenz

Projekt-spezifisch.
