# SlateLink – Architektur und Komponentendiagramme

## 1. System-Übersicht

```mermaid
flowchart TB
  subgraph extern [Extern]
    User[Browser]
  end
  subgraph app [SvelteKit-App]
    UI[Seiten / UI<br/>+page.svelte, +layout.svelte]
    API["API-Routen<br/>/api/**/+server.ts"]
    Server["$lib/server"]
    UI -->|fetch| API
    API --> Server
  end
  subgraph haproxy [HAProxy-Stack]
    DPA[Data Plane API :5555]
    HAProxy[HAProxy :80/443/8404]
  end
  subgraph persist [Persistenz]
    DB[(SQLite<br/>app.db)]
    FS[Dateisystem<br/>haproxy/ssl, domain_mapping.txt]
  end
  User -->|"/" + "/api/*"| app
  Server -->|REST + Basic Auth| DPA
  Server --> DB
  Server --> FS
  DPA -->|stats socket / config| HAProxy
```

## 2. Server-Module ($lib/server)

```mermaid
flowchart LR
  subgraph config [Konfiguration]
    config[config.ts]
  end
  subgraph dpa [Data Plane API]
    dataplane[dataplane.ts]
  end
  subgraph db [Datenbank]
    schema[schema.ts]
    db_index[index.ts]
  end
  subgraph domain [Domain/Zertifikate]
    domain_mapping[domain-mapping.ts]
    cert_sync[certificates-sync.ts]
    cert_resolve[certificates-resolve.ts]
    haproxy_certs[haproxy-certs-dir.ts]
    haproxy_exec[haproxy-docker-exec.ts]
    haproxy_socket[haproxy-socket.ts]
    parse_cert[parse-cert.ts]
    default_crt[default-crt-store.ts]
  end
  subgraph sync [Regel-Sync]
    sync_rules[sync-frontend-rules.ts]
  end
  subgraph app_logic [App-Logik]
    audit[audit.ts]
    stats[stats.ts]
  end
  config --> dataplane
  config --> db_index
  config --> haproxy_certs
  config --> haproxy_exec
  config --> haproxy_socket
  schema --> db_index
  dataplane --> sync_rules
  db_index --> sync_rules
  db_index --> audit
  db_index --> stats
  domain_mapping --> sync_rules
  sync_rules --> domain_mapping
  cert_sync --> haproxy_certs
  cert_sync --> haproxy_exec
  cert_sync --> haproxy_socket
  cert_resolve --> parse_cert
  cert_resolve --> haproxy_certs
```

## 3. API-Routen (Übersicht)

```mermaid
flowchart TB
  subgraph health [Health & Info]
    GET_health[GET /api/health]
    GET_info[GET /api/info]
  end
  subgraph stats [Statistiken]
    GET_stats[GET /api/stats]
    GET_stats_snapshot[GET /api/stats/snapshot]
    GET_stats_history[GET /api/stats/history]
  end
  subgraph audit [Audit]
    GET_audit[GET /api/audit]
    GET_audit_log[GET /api/audit/haproxy-log]
  end
  subgraph config_api [Config API]
    frontends[Frontends CRUD + Binds]
    backends[Backends CRUD + Servers]
    rules[Rules CRUD]
    crt_stores[CrtStores CRUD + Loads]
    certs[Certificates, Storage, ACME]
    domain_mapping[domain-mapping/regenerate]
    default_ssl[default-ssl-cert]
  end
  GET_health --> config
  GET_info --> dataplane
  GET_stats --> dataplane
  GET_stats_snapshot --> stats
  GET_stats_history --> db
  GET_audit --> db
  GET_audit_log --> haproxy_exec
  frontends --> dataplane
  frontends --> db
  backends --> dataplane
  rules --> db
  rules --> sync_rules
  crt_stores --> dataplane
  certs --> cert_sync
  certs --> cert_resolve
  domain_mapping --> domain_mapping_module
  default_ssl --> dataplane
```

## 4. Datenfluss: Config-Seite → Regeln → HAProxy

```mermaid
sequenceDiagram
  participant Browser
  participant ConfigPage as config/+page.svelte
  participant API as /api/config/rules
  participant DB as db/index.ts
  participant Sync as sync-frontend-rules.ts
  participant DPA as dataplane.ts
  participant DomainMapping as domain-mapping.ts
  participant HAProxy

  Browser->>ConfigPage: Regeln anzeigen/bearbeiten
  ConfigPage->>API: GET /api/config/rules
  API->>DB: getAllFrontendRules()
  DB-->>API: rules[]
  API-->>ConfigPage: rules

  Note over ConfigPage: User speichert Regel
  ConfigPage->>API: POST/PUT /api/config/rules
  API->>DB: setFrontendRule() / createFrontendRule()
  API->>Sync: syncAllFrontendRules() oder syncOneFrontendRules()
  Sync->>DPA: getFrontends(), replaceFrontendAcls(), replaceBackendSwitchingRules()
  Sync->>DPA: createHttpRequestRule() (Redirect)
  DPA->>HAProxy: Config-Update
  Sync->>DomainMapping: writeDomainMappingFile()
  DomainMapping->>HAProxy: domain_mapping.txt (crt_list)
```

## 5. UI-Seiten und Datenquellen

```mermaid
flowchart TB
  subgraph routes [Routes]
    layout["+layout.svelte"]
    dashboard["/ +page.svelte"]
    config["/config +page.svelte"]
    config_fe["/config/frontends/[name]"]
    config_be["/config/backends/[name]"]
    crt_stores_ui["/config/crt-stores"]
    certificates_ui["/config/certificates"]
    acme_ui["/config/acme"]
    audit_ui["/audit"]
  end
  subgraph load [+page.server.ts load]
    config_load["config/+page.server.ts"]
    dashboard_load["+page.server.ts"]
    audit_load["audit/+page.server.ts"]
  end
  subgraph api [API]
    api_config["/api/config/*"]
    api_stats["/api/stats"]
    api_audit["/api/audit"]
  end
  layout --> dashboard
  layout --> config
  layout --> audit_ui
  config --> config_load
  config_load --> api_config
  config --> config_fe
  config --> config_be
  config --> crt_stores_ui
  config --> certificates_ui
  config --> acme_ui
  dashboard --> dashboard_load
  dashboard_load --> api_stats
  audit_ui --> audit_load
  audit_load --> api_audit
```

## 6. Zertifikats-Pfade (vereinfacht)

```mermaid
flowchart LR
  subgraph Quellen
    Runtime[HAProxy Runtime<br/>dump ssl cert]
    Storage[DPA Storage<br/>/storage/ssl_certificates]
    Disk[Host-Dateisystem<br/>HAPROXY_SSL_CERTS_DIR]
    Docker[docker exec<br/>HAPROXY_CONTAINER_NAME]
  end
  subgraph SlateLink
    cert_sync[certificates-sync.ts]
    cert_resolve[certificates-resolve.ts]
    domain_mapping[domain-mapping.ts]
  end
  Runtime --> haproxy_socket
  Docker --> haproxy_docker_exec
  cert_sync --> Runtime
  cert_sync --> Storage
  cert_sync --> Disk
  cert_resolve --> Disk
  domain_mapping --> getSslCertsWriteDir
```

---

*Bei Änderungen an Modulen oder API-Routen diese Diagramme anpassen (siehe IMPLEMENTATION.md §5, PROGRESS.md).*
