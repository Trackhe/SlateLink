# SlateLink – Todo-Liste: Fehlerquellen, Codequalität, Offene Punkte

Diese Liste sammelt Stellen, an denen noch Fehler entstehen könnten, und Verbesserungen. Sie ist zugleich ein **Abarbeitungs-Playbook**: Bei jedem Schritt müssen Tests, defensive Programmierung, Redundanzvermeidung und klare Struktur mitgedacht und umgesetzt werden.

---

## 0. Überblick: Aktuell implementierter Stand

### 0.1 Architektur und Module

- **SvelteKit-App** mit UI (`src/routes/**`) und serverseitiger API (`src/routes/api/**/+server.ts`).
- **Kernlogik in `$lib/server`**:
  - `dataplane.ts` (DPA-Client, Frontends/Backends/Binds/Rules/ACME/Certificates/Stats)
  - `db/index.ts`, `db/schema.ts` (SQLite inkl. `frontend_rules`, `frontend_options`, `audit_log`, `stats_snapshots`)
  - `sync-frontend-rules.ts` (ACL + Backend-Switching + Redirect + domain_mapping Sync)
  - `domain-mapping.ts`, `certificates-sync.ts`, `certificates-resolve.ts`, `parse-cert.ts`
  - `audit.ts`, `stats.ts`, `config.ts`
- **HAProxy + Data Plane API** über Docker, inkl. SSL-/Runtime-Pfaden.

### 0.2 Funktional abgedeckte Bereiche

- CRUD für Frontends, Backends, Binds, Rules, CrtStores/Loads, ACME-Provider.
- Domain-/Zertifikatszuordnung mit `frontend_rules` plus Sync nach HAProxy.
- Audit-Log und Stats-Snapshots mit Historie.
- Zertifikatszugriff aus Runtime, Storage und Dateisystem.

### 0.3 Aktueller Testbestand

- Bestehende Unit-Tests: `db`, `audit`, `stats`, `dataplane`.
- Noch gezielt ausbaufähig: `sync-frontend-rules`, `domain-mapping`, Rules/Binds-API-Validierung, gemeinsame Validator-/Normalizer-Utils.

---

## 0.4 Abarbeitungsmodus (verbindliche Qualitäts-Gates)

Jeder TODO-Punkt gilt erst als abgeschlossen, wenn **alle** Gates erfüllt sind:

1. **DRY-Gate (Redundanz):**
   - Keine neue Copy/Paste-Validierung oder Response-Normalisierung.
   - Wenn gleiche Logik an 2+ Stellen vorkommt: Utility extrahieren.
2. **Defensive-Boundary-Gate:**
   - Untrusted Input (HTTP, DPA, Env, FS) wird an der Grenze validiert/normalisiert.
   - Intern keine doppelten Checks auf bereits validierte Werte.
3. **Fehler-Gate:**
   - Fehlercodes und JSON-Fehlerformate konsistent (`400/404/409/502`).
   - Keine stillen Fehler bei kritischen Pfaden (Sync, DB, Zertifikate).
4. **Test-Gate:**
   - Neue/angepasste Logik hat passende Unit-Tests (inkl. Negativfälle).
   - Bestehende Tests laufen gruen (`bun run test`).
5. **Doku-Gate:**
   - `IMPLEMENTATION.md`/`docs/ARCHITEKTUR.md`/`docs/TODO.md` aktualisiert, wenn Verhalten/Struktur geaendert wurde.

---

## 1. Codequalität: Variablen ausschreiben

Laut IMPLEMENTATION.md §5: *„Keine Abkürzungen (außer id, url, ip).“*  
Folgende Stellen nutzen noch kurze oder unklare Namen und sollten schrittweise umbenannt werden.

### 1.1 Response-/JSON-Variablen

| Datei | Aktuell | Vorschlag | Kontext |
|-------|---------|-----------|---------|
| Diverse `+page.svelte`, API-Clients | `res` | `response` | Fetch-Response |
| Diverse | `j` | `responseJson` oder `responseBody` | `await res.json()` |
| `dataplane.ts` (mehrfach) | `res` | `response` | fetch-Ergebnis |
| `dataplane.ts` (triggerAcmeRenew) | `o` | `parsedErrorBody` | JSON.parse(text) für Fehlermeldung |
| `dataplane.ts` | `ct` | `contentType` | res.headers.get('Content-Type') |
| `dataplane.ts` | `msg` | `errorMessage` | Fehlertext für throw |

### 1.2 Trimmed/validierte Werte

| Datei | Aktuell | Vorschlag | Kontext |
|-------|---------|-----------|---------|
| `+server.ts` (rules, binds) | `s` | `trimmedValue` oder `sanitizedName` | (val ?? '').trim() |
| `config/+page.svelte` | `v` | `inputValue` / `bindAddress` | isValidBindAddress(v) |
| `config/+page.svelte` | `s` | `trimmedAddress` | v.trim() \|\| '*' |
| `frontends/[name]/binds/+server.ts` | `s` | `trimmedAddress` / `bindName` | Adresse oder Name |

### 1.3 Objekt-/Array-Zugriffe

| Datei | Aktuell | Vorschlag | Kontext |
|-------|---------|-----------|---------|
| `config/+page.server.ts` | `obj` | `responseBody` | raw as { data?: unknown[] } |
| `config/+page.server.ts` | `o`, `n` | `item`, `storageOrFileName` | Schleife über SSL-Einträge |
| `crt-stores/+page.server.ts` | `arr` (mehrfach) | `itemsArray` / `certStoresList` etc. | Array.isArray(raw) ? raw : [] |
| `db/index.ts` | `row` (OK) | – | DB-Zeile; optional `optionsRow` |
| `db/index.ts` (getMaxSortOrder) | `m` | `maxSortOrder` | SELECT max(sort_order) |
| `certificates-sync.ts` | `o`, `n` | `item`, `certificateName` | Schleife über Runtime-Certs |
| `certificates-resolve.ts` | `d` | `domainNormalized` | domain.toLowerCase().trim() |
| `certificates-resolve.ts` | `m` | `dnsMatch` | part.match(/^DNS:\s*(.+)$/i) |
| `certificates-resolve.ts` | `s` | `safeSegment` | safeCertSegment(domain) |
| `parse-cert.ts` | `x` | `certificate` | new X509Certificate(singlePem) |
| `parse-cert.ts` | `pk`, `jwk` | `publicKey`, `jwkExport` | Key-Export |

### 1.4 Konfiguration/Frontend-spezifisch

| Datei | Aktuell | Vorschlag | Kontext |
|-------|---------|-----------|---------|
| `config/+page.svelte` | `bal` | `balanceConfig` / `balanceAlgorithm` | json.backend.balance |
| `config/+page.svelte` | `opts` | `frontendOptions` | json.options |
| `config/+page.svelte` | `sn` | `storageName` | c.storage_name ?? '' |
| `config/+page.svelte` | `cur` | `currentPort` | row?.port ?? 8080 |
| `config/+page.svelte` | `num` | `selectedPort` | value === '80' ? 80 : ... |
| `config/+page.svelte` | `row` (in Bind-Kontext) | `bindRow` | detailAddBindRows[rowIndex] |
| `frontends/[name]/+server.ts` | `ct` | `clientTimeout` | Number(first.client_timeout) |
| `frontends/[name]/+server.ts` | `ref` | `certRef` | certRef as { type, store, cert } |

### 1.5 Callback/Iterator-Kürzel

In Filter-/Map-Callbacks sind **einbuchstabige Parameter** (z. B. `x`, `r`, `d`, `n`) oft üblich. Wo der Kontext nicht sofort klar ist, länger benennen:

| Kontext | Aktuell | Optional besser |
|---------|---------|------------------|
| `sync-frontend-rules.ts` | `r` (rule) | `rule` |
| `sync-frontend-rules.ts` | `x` (frontend item) | `frontendItem` |
| `dataplane.ts` (toList, filter) | `x` | `item` |
| `domain-mapping.ts` | `ref` | `certRef` (bereits klar) |

### 1.6 Sonstige

| Datei | Aktuell | Vorschlag |
|-------|---------|-----------|
| `+page.svelte` (Dashboard) | `t` | `refreshIntervalId` |
| `+page.svelte` (Dashboard) | `r`, `v` (getVal) | `row`, `value` (bereits verständlich in kleinem Scope) |
| `audit/+page.svelte` | `r` | `response` (fetch) |
| `acme/enable-scheduler/+server.ts` | `msg` | `successMessage` (ternary OK) |
| `dataplane.ts` (for..of) | `[k, v]` | `[queryKey, queryValue]` |

---

## 2. Mögliche Fehlerquellen / Bugs

### 2.1 API / Validierung

- **Rules API:** `parseRuleId(params.id)` – bei ungültigem `id` (NaN, negativ) Verhalten prüfen; ggf. 400 mit klarer Fehlermeldung.
- **Binds:** Doppelte Adresse:Port prüfen (laut README 409 wenn schon vergeben) – in DPA/Backend-Logik verifizieren.
- **Frontend-Options:** Beim PUT Frontend: Sicherstellen, dass `client_timeout` und andere Zahlen als Number übergeben werden, nicht als String (z. B. `ct = Number(first.client_timeout)`).

### 2.2 Sync / Regeln

- **sync-frontend-rules.ts:** Wenn `replaceFrontendAcls` oder `replaceBackendSwitchingRules` fehlschlägt, wird die Transaktion nicht explizit abgebrochen (DPA verwirft in_progress); Logging bei Catch verbessern.
- **Reihenfolge Redirect vs. use_backend:** Sicherstellen, dass Redirect-Regeln vor Backend-Switching eingefügt werden (index 0, 1, …); in DPA-Spec/Verhalten prüfen.
- **domain_mapping.txt:** Schreibrechte und Pfad (getSslCertsWriteDir) – bei fehlendem Verzeichnis klare Fehlermeldung.

### 2.3 Zertifikate

- **certificates-resolve / certificates-sync:** Mehrere Quellen (Runtime, Storage, Disk, Docker) – Reihenfolge und Fallbacks dokumentieren; Fehlerbehandlung bei fehlendem PEM vereinheitlichen.
- **ACME force-renew / enable-scheduler:** Logik geprüft – `msg` ist ternary (insecure ? … : …). Optional: `msg` in `successMessage` umbenennen.

### 2.4 Datenbank

- **Migrationen:** Schema-Änderungen (neue Spalten, Tabellen) nur über schema.ts + ggf. explizite Migration in db/index.ts; bei mehreren Instanzen auf Locking achten.
- **frontend_rules:** `domains_json` und `cert_ref_json` – bei leerem/invalidem JSON Lesepfade absichern (z. B. [] / null).

### 2.5 UI

- **config/+page.svelte:** Sehr große Datei (~2300 Zeilen) – Aufteilung in Komponenten (z. B. BackendModal, FrontendModal, RuleCard) würde Wartbarkeit und Testbarkeit erhöhen.
- **Fehlerbehandlung:** Überall wo `res.json().catch(() => ({}))` genutzt wird: Nutzer-Feedback bei 4xx/5xx verbessern (z. B. `backendError = responseBody?.error ?? response.statusText`).

### 2.6 Umgebung / Deployment

- **DATAPLANE_API_URL:** Ohne trailing slash (config.ts entfernt es); bei Proxy-Konfiguration prüfen, ob Base-URL korrekt ist.
- **HAPROXY_CONTAINER_NAME:** Wenn gesetzt, muss `docker` ausführbar sein und Container erreichbar; sonst Fehler bei dump ssl cert.

---

## 3. Redundanzen vermeiden (DRY, Single Source of Truth)

### 3.1 Bekannte Duplikate

| Duplikat | Vorkommen | Empfehlung |
|----------|----------|------------|
| **isValidBindAddress** | `config/+page.svelte` (Zeile ~810), `api/config/frontends/[name]/binds/+server.ts` (Zeile ~10) | In ein gemeinsames Modul auslagern (z. B. `$lib/server/bind-validation.ts` oder `$lib/shared/validation.ts`), von UI und API importieren. Eine Implementierung, eine Stelle für Regeln (z. B. IPv4/IPv6/`*`). |
| **„DPA-Liste normalisieren“** | `Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? []` in dataplane.ts (mehrfach), sync-frontend-rules (toList), config/+page.server.ts, frontends/[name]/+page.server.ts, backends/[name]/+page.server.ts, api/config/frontends/[name]/+server.ts, api/config/backends/[name]/+server.ts | Gemeinsame Hilfsfunktion z. B. in `dataplane.ts` oder `$lib/server/dpa-utils.ts`: `function toDpaList(raw: unknown): unknown[]`. Überall nutzen statt Inline-Code. |
| **„Rohes Array“ ohne data-Wrapper** | `Array.isArray(raw) ? raw : []` in crt-stores/+page.server.ts (mehrfach), certificates-sync.ts, api/config/crt-stores/+server.ts, api/config/acme/+server.ts, api/config/storage/ssl-certificates/+server.ts, api/config/crt-stores/[name]/loads/+server.ts | Wenn DPA hier immer Array zurückgibt: gleiche Util `toDpaList` oder schlank `toArray(raw)` (nur Array.isArray ? raw : []). Einheitliches Verhalten bei null/undefined. |
| **Bind-Name aus Adresse/Port** | `binds/+server.ts`: „bind_${port}“ wenn Adresse * oder ., sonst sanitizedName | Logik „sicherer Bind-Name“ einmal definieren; API und ggf. UI nutzen dieselbe Regel. |

### 3.2 Prinzipien

- **Eine Quelle für Domain→Backend/Zertifikat:** Regeln in `frontend_rules`; `domain_mapping.txt` und ACLs/Sync nur daraus ableiten (kein paralleles Pflegen in bindDomains/bindCertRef).
- **Eine Stelle für DPA-Calls:** Alle Requests zur Data Plane API über `dataplane.ts` (gleiche Auth, Fehlerbehandlung, Version/Transaktion).
- **Validierung zentral:** Grenzwerte (z. B. Port 1–65535, Bind-Name Länge) und Regex (Bind-Adresse, Namen) in wenigen Modulen definieren und wiederverwenden statt in jeder Route/Seite neu zu prüfen.

---

## 4. Defensiv programmieren vs. unnötige Checks

### 4.1 Wann defensiv prüfen

- **Eingaben von außen:** Request-Body, Query-Parameter, Pfad-Parameter (z. B. `params.id`) – immer als unsicher behandeln: Typ prüfen, parsen (z. B. `parseInt`), Bereich prüfen (id > 0, Port 1–65535).
- **DPA-/API-Responses:** `raw` kann `null`, `undefined`, `{ data: [] }` oder direkt Array sein – daher z. B. `toDpaList(raw)` statt blindem `raw as X[]`.
- **Dateisystem/Umgebung:** Vor Schreiben (domain_mapping.txt, DB) Verzeichnis/Datei prüfen; bei optionalen Features (HAPROXY_CONTAINER_NAME, HAPROXY_STATS_SOCKET) nur nutzen, wenn gesetzt und erreichbar.
- **JSON aus DB oder Config:** `domains_json`, `cert_ref_json`, `options_json` – beim Lesen try/catch oder Validierung; bei ungültigem JSON leere Array/Null-Fallback statt Crash.

### 4.2 Wann Checks vermeiden (keine unnötige Redundanz)

- **Nach bereits validierter Verarbeitung:** Wenn ein Wert gerade aus `parseInt(..., 10)` mit Bereichsprüfung kommt, muss er danach nicht nochmal geprüft werden (außer in separaten Units mit anderem Kontext).
- **Interne Hilfsfunktionen:** Wenn nur von getestetem Server-Code mit kontrollierten Typen aufgerufen wird, reicht typische TypeScript-Typsicherheit; doppelte Laufzeit-Checks nur, wenn die Quelle unsicher ist (z. B. DPA-Response).
- **Trusted vs. untrusted:** Klar trennen: „Trusted“ = von unserer DB, von unserem Schema, von getesteten Modulen. „Untrusted“ = HTTP-Input, DPA-Response, Env. Nur bei Untrusted defensiv prüfen.
- **Keine übermäßigen Null-Checks:** Wenn der Typ bereits `string` oder `number` ist und die Quelle vertrauenswürdig, nicht überall `x ?? ''` oder `Number(x)` wiederholen; Defaults an der Grenze (z. B. in der API-Route) setzen.

### 4.3 Konkrete Balance

| Situation | Defensiv | Unnötig |
|-----------|----------|---------|
| `params.id` in Rules API | `parseInt(id, 10)`, NaN/<=0 → 400 | Nach erfolgreicher Parse + Bereichsprüfung nicht in jeder Unterfunktion erneut prüfen |
| DPA-Response für Listen | `toDpaList(raw)` (Array oder data-Array) | In jedem Aufrufer erneut `Array.isArray(raw) ? raw : ...` zu schreiben (→ Util nutzen) |
| Frontend-Options aus DB | JSON.parse in try/catch, Fallback `{}` oder null | In jedem Consumer erneut „ist es ein Objekt?“ zu prüfen, wenn bereits an der Lesestelle abgesichert |
| Bind-Adresse aus Formular | isValidBindAddress + trim | Mehrfache gleiche Regex an verschiedenen Stellen (→ eine Validator-Funktion) |

---

## 5. Fehlervermeidung (Strategie)

- **Eingaben an der Grenze normalisieren und validieren:** In API-Routen (z. B. Rules, Binds, Frontends) alle relevanten Felder trimmen, parsen, auf erlaubte Werte prüfen; bei Fehler 400 mit klarer Meldung (z. B. „id muss eine positive Zahl sein“). So gelangen keine ungültigen Werte in DB oder DPA.
- **Fehler nach außen einheitlich:** DPA-Fehler (502/504), Validierungsfehler (400), „nicht gefunden“ (404) konsistent als JSON mit `error` oder `message`; im UI immer `response.ok` prüfen und Fehlertext anzeigen statt still zu schlucken.
- **Transaktionen und Sync:** Bei Sync (ACLs, Backend-Switching, Redirect) in einer Transaktion arbeiten; bei Fehler explizit loggen und Fehler nach oben durchreichen (kein stilles Verschlingen). DPA verwirft in_progress-Transaktionen; trotzdem im Catch klare Log-Meldung.
- **Keine stillen Fallbacks für kritische Daten:** Bei fehlendem PEM oder fehlgeschlagenem DPA-Call nicht „einfach leeres Objekt zurückgeben“, wenn die Aufrufer darauf bauen – entweder Fehler zurückgeben oder klar dokumentierten Fallback (z. B. leere Liste) und Log.
- **Idempotenz wo sinnvoll:** z. B. „domain_mapping regenerieren“ oder „Sync Regeln“ mehrfach ausführbar ohne Seiteneffekt-Probleme; vereinfacht Retries und manuelle Wiederholung.

---

## 6. Sinnvolle Tests

### 6.1 Ziele

- **Vertrauen bei Änderungen:** Refactor (z. B. Redundanz abbauen, Variablen umbenennen) ohne Regression.
- **Dokumentation:** Tests zeigen erwartetes Verhalten (z. B. „getAuditLog filtert nach action“, „toDpaList akzeptiert { data: [] }“).
- **Grenzfälle abdecken:** Leere Eingaben, ungültige IDs, fehlende Header, kaputtes JSON – defensives Verhalten explizit testen.

### 6.2 Was testen (Priorität)

| Priorität | Bereich | Beispiele |
|-----------|---------|-----------|
| **Hoch** | Validierung (shared/API) | `isValidBindAddress('*')`, `isValidBindAddress('256.0.0.1')`, Bind-Name-Sanitize; `parseRuleId('x')` → NaN/400 |
| **Hoch** | DPA-Listen-Normalisierung | `toDpaList(null)`, `toDpaList({ data: [a,b] })`, `toDpaList([a,b])` → einheitliches Array; nach Auslagerung in Util unbedingt testen |
| **Hoch** | DB: frontend_rules | getFrontendRuleById, create/update/delete, getMaxSortOrder; ungültiges domains_json/cert_ref_json → Fallback []/null |
| **Mittel** | domain-mapping | buildDomainMappingContent mit leeren Regeln, mit einer Regel (store/path), Pending; writeDomainMappingFile (mkDir + Inhalt) – ggf. mit Temp-Dir |
| **Mittel** | sync-frontend-rules | ACL-Namen, Reihenfolge Backend-Switching, Redirect-Regeln (Anzahl, cond_test); bei gemockter DPA keine echten Transaktionen |
| **Mittel** | API-Routen (Rules, Binds) | POST Rules mit fehlenden Pflichtfeldern → 400; PUT mit ungültigem id → 400; DELETE nicht existierende Regel → 404 |
| **Niedrig** | UI (optional) | Komponenten-Tests oder E2E für kritische Flows (z. B. „Regel anlegen und Sync“), wenn Ressourcen da sind |

### 6.3 Konkrete Test-Ideen (noch nicht bzw. teilweise abgedeckt)

- **$lib/server/dpa-utils oder dataplane (toDpaList):**  
  - Input `null`, `undefined`, `[]`, `[1,2]`, `{ data: [1,2] }`, `{ data: null }` → erwartete Array-Ergebnisse.
- **Bind-Validierung (nach Auslagerung):**  
  - `isValidBindAddress('*')`, `'0.0.0.0'`, `'::'`, `'192.168.1.1'`, `'[::1]'`, `'invalid'`, `''` → true/false.
- **parseRuleId / Rules API:**  
  - Gültige Zahl, 0, -1, NaN, 'abc' → erwartetes Verhalten (z. B. 400 für ungültig).
- **getFrontendRules / getAllFrontendRules:**  
  - Leere DB; eine Regel; domains_json leer oder ungültig → kein Crash, leeres Array oder geparste Domains.
- **domain-mapping buildDomainMappingContent:**  
  - Keine Regeln; eine Regel mit store; eine mit path; redirect_http_to_https ohne Einfluss auf Zeilen (nur für Sync relevant).
- **sync-frontend-rules (mit Mock):**  
  - getFrontends mocken; syncOneFrontendRules mit 0 Regeln (leere ACLs/Switching); mit 1 Regel (eine ACL, eine use_backend, ggf. eine Redirect-Regel). Kein echter DPA-Call.

### 6.4 Test-Stil

- **Ein Assertion-Fokus pro Test wo möglich:** z. B. „getAuditLog filters by action“ – eine Sache getestet, Name erklärt das Verhalten.
- **Arrange–Act–Assert:** Daten vorbereiten, Funktion/Route aufrufen, Ergebnis prüfen.
- **Mocks sparsam:** Nur dort mocken, wo extern (DPA, DB-Pfad). DB mit `:memory:`; fetch mit vi.stubGlobal oder Modul-Mock.
- **Keine Tests für triviale Getter ohne Logik:** Wenn eine Funktion nur `return config.foo` macht, reicht Typprüfung; sinnvoll sind Tests für alles, was Verzweigungen, Parsing oder Validierung hat.

---

## 7. Offene Punkte (aus IMPLEMENTATION.md / PROGRESS)

- Optional: Multipart-Upload für Certbot-Hook; API-Key für Hook-Endpoint.
- Optional: UI-Filter für Audit (from, to, action, resource_type) ergänzen.
- plan-acl-regeln.md: Schrittweise Binds vereinfachen und `bindDomains`/`bindCertRef` ablösen (bereits teilweise umgesetzt über frontend_rules).

---

## 8. Empfohlene Reihenfolge

1. **Phase A - Redundanz zuerst aufraeumen**
   - `toDpaList`/`toArray` zentralisieren.
   - `isValidBindAddress` (und ggf. Bind-Name-Sanitize) in Shared-Validator auslagern.
   - Akzeptanz: keine weiteren Inline-Duplikate fuer diese Logik.
2. **Phase B - Defensiv an den Grenzen**
   - Rules/Binds/API-Input zentral validieren (ID, Port, Strings, Pflichtfelder).
   - DPA-Responses einheitlich normalisieren.
   - Akzeptanz: klare 400/404/409/502 Antworten, intern reduzierte Mehrfachchecks.
3. **Phase C - Tests parallel mitziehen (nicht am Ende)**
   - Fuer jede Auslagerung/Validierung sofort Unit-Tests inkl. Negativfaelle schreiben.
   - Prioritaet: Validatoren -> DPA-Normalizer -> frontend_rules -> domain-mapping -> sync.
   - Akzeptanz: `bun run test` gruen nach jeder Teilphase.
4. **Phase D - Lesbarkeit und Struktur**
   - Variablennamen ausschreiben (insb. `res`, `j`, `s`, `v`, `o`, `n` in zentralen Dateien).
   - `config/+page.svelte` schrittweise in Komponenten splitten (modale Dialoge, Regelkarte, Bind-Editor).
   - Akzeptanz: kleinere, klar getrennte Verantwortlichkeiten.
5. **Phase E - Stabilisierung und Abschluss**
   - Sync-Fehlerpfade und Logging nachziehen.
   - Doku final angleichen (`IMPLEMENTATION.md`, `docs/ARCHITEKTUR.md`, `docs/TODO.md`).
   - Optional danach: Audit-Filter, Certbot-Hook API-Key.

### 8.1 Definition of Done pro Task

- [x] Kein neuer Redundanz-Hotspot entstanden.
- [x] Defensive Checks nur an Untrusted-Boundaries.
- [x] Fehlerpfade sind explizit und nachvollziehbar.
- [x] Tests fuer neue/angepasste Logik vorhanden und gruen.
- [x] Benennungen sind klar und ausgeschrieben.
- [x] Doku ist auf aktuellem Stand.

### 8.2 Bereits umgesetzt

- [x] Shared Utility `toDpaList`/`toArray` erstellt (`src/lib/server/dpa-utils.ts`).
- [x] DPA-Listen-Normalisierung in mehreren API-/Load-Dateien auf Utility umgestellt.
- [x] Shared Bind-Validierung erstellt (`src/lib/shared/bind-validation.ts`).
- [x] Bind-Validierung in UI und API auf gemeinsame Utility umgestellt.
- [x] Unit-Tests ergänzt: `src/lib/server/dpa-utils.test.ts`, `src/lib/shared/bind-validation.test.ts`.
- [x] Unit-Tests ergänzt: `src/lib/server/rules-validation.test.ts`, `src/lib/server/sync-frontend-rules.test.ts`, `src/lib/server/domain-mapping.test.ts`.
- [x] DB-Tests erweitert: `src/lib/server/db/index.test.ts` um `frontend_rules` CRUD + JSON-Fallback.
- [x] Rules-Validierung zentralisiert (`src/lib/server/rules-validation.ts`) und in Rules-APIs genutzt.
- [x] Testlauf erfolgreich: `bun run test` (51/51 Tests gruen).
- [x] `config/+page.svelte` strukturell reduziert: Regel-Modal in eigene Komponente ausgelagert (`src/lib/components/config/RuleModal.svelte`).

---

*Diese Liste bei Behebung von Punkten abhaken bzw. Einträge entfernen/ergänzen.*
