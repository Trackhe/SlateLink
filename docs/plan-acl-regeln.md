# Planung: ACL/Regeln – Binds vereinfachen, Domain→Backend/Zertifikat/Redirect

## Ziel

- **Binds** im Frontend nur noch **Adresse + Port** (keine Domains, kein Zertifikat in der Bind-UI).
- Neue **Regeln (ACL-Karten)**: pro Regel = ein Frontend + Domains + Backend + Zertifikat + optional „HTTP→HTTPS für diese Domain“.
- **domain_mapping.txt** und HAProxy-ACLs/Backend-Switching/Redirect werden aus diesen Regeln abgeleitet.

---

## 1. Bereits vorhandener Code (wiederverwenden)

### 1.1 Data Plane API (`src/lib/server/dataplane.ts`)

| Vorhanden | Verwendung |
|-----------|------------|
| `getFrontends()`, `getBackends()` | Frontend-/Backend-Dropdowns in Regeln-UI. |
| `getBinds(fe)`, `getBind(fe, name)`, `createBind`, `deleteBind` | Binds weiterhin nur über DPA; beim Anlegen 443-Bind nur noch `crt_list` setzen. |
| `getHttpRequestRules(fe)`, `createHttpRequestRule(fe, body)`, `deleteHttpRequestRule(fe, index)` | Redirect-Regeln pro Domain; bestehende Logik für „global“ Redirect (ssl_fc) anpassen/erweitern. |
| `dpaFetch`, `dpaMutate` | Alle neuen DPA-Calls analog zu bestehenden (gleiche Base-URL, Auth). |

**Noch nicht vorhanden (ergänzen):**

- **ACLs:**  
  - `GET /v3/services/haproxy/configuration/frontends/{parent_name}/acls`  
  - `PUT` ersetzt die komplette ACL-Liste (laut Spec).  
  → `getFrontendAcls(frontendName)`, `replaceFrontendAcls(frontendName, acls[])`.

- **Backend-Switching:**  
  - `GET/PUT /v3/services/haproxy/configuration/frontends/{parent_name}/backend_switching_rules`  
  → `getBackendSwitchingRules(frontendName)`, `replaceBackendSwitchingRules(frontendName, rules[])`.

DPA-Spec: `acl` = `{ acl_name, criterion, value }` (z. B. criterion `hdr(host)`, value `-i domain.de`).  
`backend_switching_rule` = `{ name: backend_name, cond: "if", cond_test: "acl_name" }`.

### 1.2 DB (`src/lib/server/db/`)

| Vorhanden | Verwendung |
|-----------|------------|
| `frontend_options` (frontend_name, options_json) | Weiter nutzen für Optionen (forwardClientIp, redirectHttpToHttps global etc.). |
| `getFrontendOptions`, `setFrontendOptions` | Optionen lesen/schreiben. |
| `bindDomains`, `bindCertRef` in `FrontendOptions` | **Schrittweise ablösen** durch Regeln; domain_mapping und Sync künftig aus Regeln speisen. |

**Neu (ohne Redundanz zu bindDomains/bindCertRef):**

- Eigene Tabelle **`frontend_rules`** für die Regeln (eine Zeile = eine „ACL-Karte“):
  - `id` (INTEGER PK),
  - `frontend_name` (TEXT),
  - `domains` (TEXT = JSON array, z. B. `["a.de","b.de"]`),
  - `backend_name` (TEXT),
  - `cert_ref` (TEXT = JSON: `BindCertRef`),
  - `redirect_http_to_https` (INTEGER 0/1),
  - optional `sort_order` (INTEGER) für Reihenfolge.
- Funktionen: `getFrontendRules(frontendName)`, `getAllFrontendRules()`, `setFrontendRule(rule)`, `deleteFrontendRule(id)` (oder CRUD-API darüber).

So bleibt die bestehende Logik für Options und Binds erhalten, Regeln sind klar getrennt und später kann bindDomains/bindCertRef entfernt werden, sobald alles auf Regeln umgestellt ist.

### 1.3 domain_mapping (`src/lib/server/domain-mapping.ts`)

| Vorhanden | Verwendung |
|-----------|------------|
| `buildDomainMappingContent(pending?)`, `writeDomainMappingFile(pending?)` | Inhalt aus **Regeln** statt aus bindDomains/bindCertRef erzeugen. |
| `certSpecFromRef(ref)`, `commentFor(...)` | Unverändert nutzen; Eingabe kommt aus `rule.cert_ref`. |
| `DOMAIN_MAPPING_CRT_LIST_PATH`, `getCertSpecsFromDomainMappingFile()` | Unverändert. |

**Anpassung:**  
- `buildDomainMappingContent` liest Einträge aus **frontend_rules** (alle Frontends, alle Regeln mit `cert_ref`), statt aus `getFrontendOptions().bindDomains/bindCertRef` und Binds.  
- `PendingMappingEntry`-Struktur beibehalten; Pending-Einträge können aus einer „neuen Regel“ kommen, bis sie in der DB sind.

### 1.4 Config-UI (`src/routes/config/+page.svelte`)

| Vorhanden | Verwendung |
|-----------|------------|
| Sektionen „Frontends“ / „Backends“ mit Card-Grid, Buttons „+ Frontend/Backend anlegen“ | Gleiches Muster für **„Regeln“**: Sektion mit Cards, Button „+ Regel anlegen“. |
| Modals für Anlegen (Backend/Frontend) mit Formular | Modal für „Regel anlegen“: Frontend-Dropdown, Domains (Tags wie bisher), Backend-Dropdown, Zertifikat-Dropdown, Checkbox „HTTP→HTTPS für diese Domain“. |
| Detail-Ansicht Frontend (Binds, Optionen, …) | Binds-Bereich vereinfachen: nur noch Adresse + Port; Domains/Zertifikat-Zeilen und „Alle Binds hinzufügen“-Formular entfernen. |
| `data.frontends`, `data.backends`, `data.crtStores`, `data.sslCertificates`, `mergedCertOptions` | In Regeln-Formular wiederverwenden (Frontend-, Backend-, Zertifikats-Dropdowns). |
| Domain-Tags (Enter zum Hinzufügen, × zum Entfernen) | Gleiche Komponente/Logik für „Domains“ in der Regel-Karte. |

Kein zweites UI-Pattern erfinden; bestehende Cards, Modals und Formulare wiederverwenden.

### 1.5 API-Routen

| Vorhanden | Verwendung |
|-----------|------------|
| `GET/PUT /api/config/frontends/[name]` (load/save Frontend inkl. Options) | Options weiter hier; Regeln werden über eigene Rule-API geladen/gespeichert. |
| `POST/DELETE …/frontends/[name]/binds` | Vereinfachen: POST nur noch address + port (+ bei 443: crt_list setzen); keine Domains/Zertifikat mehr im Body. |
| `POST /api/config/domain-mapping/regenerate` | Später: Aufruf nach Änderung von Regeln (oder in Rule-Save integriert), nutzt weiter `writeDomainMappingFile()`. |

**Neu:**

- `GET /api/config/rules` → alle Regeln (oder pro Frontend gefiltert).  
- `POST /api/config/rules` → Regel anlegen (frontend_name, domains, backend_name, cert_ref, redirect_http_to_https).  
- `PUT /api/config/rules/[id]` → Regel aktualisieren.  
- `DELETE /api/config/rules/[id]` → Regel löschen.  
- Optional: `POST /api/config/rules/sync?frontend=...` der für ein Frontend ACLs + Backend-Switching + Redirect-Regeln in die DPA schreibt und domain_mapping.txt neu baut (siehe unten).

---

## 2. Ablauf „Sync“ (Regeln → HAProxy + domain_mapping.txt)

Ein zentraler Sync-Schritt (pro Frontend oder global) soll:

1. **domain_mapping.txt**  
   Aus allen `frontend_rules` mit `cert_ref` die Zeilen bauen (wie heute, nur Datenquelle = Regeln), dann `writeDomainMappingFile()` aufrufen.

2. **ACLs im Frontend**  
   Pro Regel eine ACL-Zeile, z. B.  
   `acl is_domain_xyz hdr(host) -i domain1.de -i domain2.de`  
   (oder eine ACL pro Domain, je nach DPA/HAProxy-Limit).  
   ACL-Namen eindeutig (z. B. `rule_<id>_<hash>`).  
   `replaceFrontendAcls(frontendName, acls[])` mit der gebauten Liste.

3. **Backend-Switching**  
   Pro Regel eine Zeile: `use_backend <backend> if <acl_name>`.  
   Liste aus Regeln bauen, `replaceBackendSwitchingRules(frontendName, rules[])`.

4. **HTTP→HTTPS-Redirect (selektiv)**  
   Bestehende globale Redirect-Logik (`syncRedirectHttpToHttps`) so anpassen, dass entweder:
   - nur noch **selektive** Redirects genutzt werden (eine `http-request redirect`-Regel pro ACL mit `redirect_http_to_https`), **oder**
   - globaler Redirect nur, wenn keine Regeln mit `redirect_http_to_https` existieren (Rückwärtskompatibilität).  
   Technisch: für jede Regel mit `redirect_http_to_https` eine `http_request_rule` mit  
   `type: "redirect"`, `redir_type: "scheme"`, `redir_value: "https"`, `cond: "if"`, `cond_test: "!ssl_fc <acl_name>"`,  
   und Reihenfolge so, dass diese **vor** den use_backend-Regeln stehen (index 0, 1, …).

Wiederverwendung: `createHttpRequestRule` (mit passendem `index`), `getHttpRequestRules` (bestehende Redirect-Regeln erkennen/entfernen). Keine doppelte Redirect-Logik; eine gemeinsame Stelle, die aus Regeln die Liste der Redirect-Rules erzeugt.

---

## 3. Reihenfolge der Umsetzung (reduzierte Redundanz)

1. **DPA erweitern**  
   - `getFrontendAcls`, `replaceFrontendAcls`  
   - `getBackendSwitchingRules`, `replaceBackendSwitchingRules`  
   Keine neuen Patterns; nur neue Pfade und gleiche dpaFetch/dpaMutate-Nutzung.

2. **DB: Tabelle + Zugriff**  
   - `frontend_rules` anlegen (Schema + Migration falls nötig),  
   - `getFrontendRules`, `getAllFrontendRules`, `setFrontendRule`, `deleteFrontendRule` (oder äquivalent).

3. **domain_mapping umstellen**  
   - `buildDomainMappingContent` auf Eingabe aus `getAllFrontendRules()` (bzw. aus API) umstellen;  
   - `certSpecFromRef`/`commentFor` und Dateipfad-Logik unverändert lassen.

4. **Binds vereinfachen**  
   - Im Frontend: Bind-UI nur noch Adresse + Port; Domains/Zertifikat-Zeilen und zugehöriges State (z. B. `detailAddBindRows` mit domains/sslCertificate) entfernen.  
   - Bind-POST: Body nur address, port; bei 443 nur noch `crt_list` setzen, keine `setBindDomains`/`setBindCertRef` mehr.  
   - Alte Anzeige (cert/domains in Bind-Liste) entfernen oder aus Regeln lesen (optional, kann später kommen).

5. **Regeln-API**  
   - CRUD für `frontend_rules` (GET/POST/PUT/DELETE wie oben).  
   - Beim Speichern/Löschen einer Regel: Sync aufrufen (domain_mapping + ACLs + Backend-Switching + Redirect).

6. **Sync-Funktion**  
   - Eine Funktion (z. B. in `src/lib/server/sync-frontend-rules.ts` oder in dataplane):  
     Regeln für ein Frontend laden → ACLs bauen → replaceFrontendAcls → Backend-Switching bauen → replaceBackendSwitchingRules → Redirect-Regeln bauen (aus Regeln mit `redirect_http_to_https`) → bestehende Redirect-Regeln per getHttpRequestRules/deleteHttpRequestRule bereinigen → neue Redirect-Regeln mit createHttpRequestRule (mit index) anlegen.  
   - Am Ende: `writeDomainMappingFile()` (einmal pro Sync, da domain_mapping global ist).

7. **Config-UI: Regeln**  
   - Neue Sektion „Regeln“ mit Card-Grid; jede Card = eine Regel (Frontend, Domains, Backend, Zertifikat, Redirect-Checkbox).  
   - Modal „Regel anlegen/bearbeiten“ mit bestehenden Dropdowns (frontends, backends, mergedCertOptions) und Domain-Tags wie in der bisherigen Bind-UI.  
   - Kein neues Design-System; gleiche Variablen/Farben/Klassen wie Frontend/Backend-Cards.

8. **Optional: Bereinigung**  
   - Nach vollständiger Umstellung: `bindDomains`/`bindCertRef` aus `FrontendOptions` und aus allen Lesepfaden (domain_mapping, Frontend-Detail-API) entfernen; Bind-POST und -DELETE nicht mehr in frontend_options schreiben.

---

## 4. Kurz: Wiederverwendung & Qualität

- **Keine doppelte DPA-Logik:** Alle DPA-Calls in `dataplane.ts`, gleiche Fehlerbehandlung und Auth.
- **Eine Quelle für domain_mapping:** Nur aus `frontend_rules` (bzw. API darüber); keine parallele Pflege in bindDomains/bindCertRef.
- **Eine Sync-Stelle:** Regeln → ACLs + Backend-Switching + Redirect + domain_mapping; keine verstreuten „teilweisen“ Syncs.
- **UI:** Gleiche Patterns wie bei Frontends/Backends (Cards, Modals, Tags); gleiche Datenquellen (`data.frontends`, `data.backends`, `mergedCertOptions`).
- **DB:** Klare Trennung frontend_options (Optionen) vs. frontend_rules (Regeln); später bindDomains/bindCertRef sauber entfernbar.

Damit bleibt Redundanz gering und die Codequalität hoch, während Binds auf „nur Adresse + Port“ reduziert und alle Domain-Zuordnungen (Backend, Zertifikat, Redirect) über die neuen Regeln laufen.
