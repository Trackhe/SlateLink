# SlateLink – HAProxy Management Web Interface

Web-Interface zur Verwaltung von HAProxy über die offizielle **HAProxy Data Plane API**. Unterstützt HTTP-, TCP- und UDP-Stream-Proxy, Client-IP-Weitergabe (X-Forwarded-For / PROXY protocol), Statistiken (Live + Historie) und Audit-Log.

## Architektur

```mermaid
flowchart LR
  subgraph extern [Extern]
    User[Browser]
  end
  subgraph app [SvelteKit-App :3001]
    UI[Seiten / UI]
    API["API-Routen\n+server.ts"]
    Server["$lib/server\n(dataplane, audit,\nstats, db)"]
    UI --> API
    API --> Server
  end
  subgraph haproxy [HAProxy-Stack]
    DPA[Data Plane API :5555]
    HAProxy[HAProxy]
  end
  User -->|"/" + "/api/*"| app
  Server -->|REST + Basic Auth| DPA
  DPA -->|stats socket| HAProxy
```

- **HAProxy** (mit Data Plane API) – Reverse Proxy, Stats-Frontend auf Port 8404
- **App** (ein SvelteKit-Projekt, Node + adapter-node) – eine Anwendung: API unter `/api/*`, UI (Dashboard, Konfiguration, Audit-Log) unter `/`, Port 3001

## Voraussetzungen

- **HAProxy:** immer per Docker (Docker und Docker Compose)
- **App:** optional mit Docker oder lokal (Node.js 22+, **Bun** als Package Manager)

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

### 3. App über HAProxy aufrufen (Statistiken im Dashboard)

Du kannst die App hinter HAProxy hängen und dann im **Dashboard** die Live-Statistiken sehen: Requests, Sessions, Bytes pro Frontend/Backend.

1. In `haproxy.cfg` ein Frontend (z. B. Port 80 oder 8080) so konfigurieren, dass es auf ein Backend mit der App (z. B. `server app 127.0.0.1:3001` oder im Docker-Netz `app:3001`) zeigt.
2. Aufruf der App über HAProxy (z. B. http://localhost/ oder http://localhost:8080/).
3. Im **Dashboard** erscheint die Sektion **HAProxy-Statistiken (Live)** mit einer Tabelle: Typ (frontend/backend/server), Name, Requests, Sessions, Bytes in/out usw. So siehst du direkt, welches Frontend/Backend wie oft genutzt wird.

Die Daten kommen von der Data Plane API (`/v3/services/haproxy/stats/native`); die App fragt sie beim Laden der Startseite ab.

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
   - Nach Änderung an .env: App neu starten (`bun run dev`).

4. **Schnellprüfung:** `sh scripts/check-haproxy.sh` prüft Container und Erreichbarkeit von localhost:5555.

## API

| Endpoint                                                   | Beschreibung                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/health`                                          | Health-Check                                                |
| `GET /api/info`                                            | Data Plane API Info                                         |
| `GET /api/frontends`                                       | Frontends (DPA)                                             |
| `GET /api/backends`                                        | Backends (DPA)                                              |
| `GET /api/stats`                                           | Live-Statistiken (HAProxy Stats)                            |
| `GET /api/stats/snapshot`                                  | Snapshot in DB schreiben                                    |
| `GET /api/stats/history`                                   | Historie aus SQLite (from, to, limit, offset)               |
| `GET /api/audit`                                           | Audit-Log (from, to, action, resource_type, limit, offset)  |
| `POST /api/config/backends`                                | Backend anlegen (name, servers[])                           |
| `PUT /api/config/backends/[name]`                          | Backend bearbeiten (z. B. mode)                             |
| `POST /api/config/backends/[name]/servers`                 | Server hinzufügen                                           |
| `DELETE /api/config/backends/[name]/servers/[server_name]` | Server entfernen                                            |
| `DELETE /api/config/backends/[name]`                       | Backend löschen (409 wenn ein Frontend darauf verweist)     |
| `POST /api/config/frontends`                               | Frontend anlegen (name, default_backend, bindPort, options) |
| `PUT /api/config/frontends/[name]`                         | Frontend bearbeiten (z. B. default_backend)                 |
| `POST /api/config/frontends/[name]/binds`                  | Bind hinzufügen (409 wenn Adresse:Port schon vergeben)      |
| `DELETE /api/config/frontends/[name]/binds/[bind_name]`    | Bind entfernen                                              |
| `DELETE /api/config/frontends/[name]`                      | Frontend löschen                                            |

## Dokumentation

- **Dokumentations-Index:** [docs/README.md](docs/README.md) – Übersicht aller Docs.
- **Implementierungsstand:** [IMPLEMENTATION.md](IMPLEMENTATION.md) – implementierte Funktionen und nächste Schritte.
- **Architektur & Komponentendiagramme:** [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) – Server-Module, API, Datenfluss (Mermaid).
- **Todo & Codequalität:** [docs/TODO.md](docs/TODO.md) – Fehlerquellen, Variablen ausschreiben, offene Punkte.

## Meilensteine (Git-Tags)

- `milestone/m1-infrastructure` – Docker Compose, HAProxy-Konfiguration

## Lizenz

Projekt-spezifisch.
