# Anbindung HAProxy Data Plane API ↔ SvelteKit (serverbasiert)

SvelteKit übernimmt die Rolle des „Backends“: Alle Aufrufe zur Data Plane API laufen **nur auf dem Server**. Credentials und DPA-URL kommen aus privaten Env-Variablen und werden nie an den Browser geschickt.

---

## 1. SvelteKit-Server: Wo läuft was?

| Ort                                                      | Läuft auf        | Private Env nutzbar? |
| -------------------------------------------------------- | ---------------- | -------------------- |
| **`src/routes/api/**/+server.ts`\*\*                     | Nur Server       | ✅ Ja                |
| **`src/routes/**/+page.server.ts`\*\* (load, actions)    | Nur Server       | ✅ Ja                |
| **`src/lib/server/**`\*\* (beliebige Module)             | Nur Server       | ✅ Ja                |
| **`hooks.server.js`**                                    | Nur Server       | ✅ Ja                |
| Dateien mit **`.server.ts`** (z. B. `secrets.server.ts`) | Nur Server       | ✅ Ja                |
| **`+page.svelte`**, **`+page.ts`** (load ohne .server)   | Server + Browser | ❌ Nein              |

**Wichtig:** `+server.js`/`+server.ts` (API-Routen) laufen **ausschließlich auf dem Server**. Dort kannst du gefahrlos die Data Plane API mit Basic Auth aufrufen.

---

## 2. Private Umgebungsvariablen in SvelteKit

- **`$env/static/private`** – aus `.env` beim **Build** geladen (z. B. für feste Defaults).
- **`$env/dynamic/private`** – zur **Laufzeit** (z. B. `process.env` mit adapter-node); für DPA-URL und Credentials ideal.

Beide dürfen **nur** in Server-Code importiert werden (u. a. `+server.ts`, `+page.server.ts`, `$lib/server/*`). SvelteKit verhindert Import in Client-Code.

Beispiel in einer API-Route oder in `$lib/server/dataplane.ts`:

```ts
import { env } from "$env/dynamic/private";

const baseUrl = env.DATAPLANE_API_URL ?? "http://localhost:5555";
const user = env.DATAPLANE_API_USER ?? "admin";
const password = env.DATAPLANE_API_PASSWORD ?? "";
const auth = Buffer.from(`${user}:${password}`).toString("base64");

const res = await fetch(`${baseUrl}/v3/info`, {
  headers: { Authorization: `Basic ${auth}` },
});
```

---

## 3. Ablauf: Browser → SvelteKit → Data Plane API

```
Browser                    SvelteKit (Server)              Data Plane API
   |                              |                              |
   |  GET /api/info               |                              |
   | --------------------------> |  GET {DPA_URL}/v3/info        |
   |                              |  Header: Basic <credentials>  |
   |                              | ---------------------------->|
   |                              |         JSON                  |
   |                              | <----------------------------|
   |         JSON                 |                              |
   | <-------------------------- |                              |
```

- Der Browser ruft nur **eigene** SvelteKit-Routen auf (z. B. `fetch('/api/info')`).
- Die Route **`/api/info/+server.ts`** läuft auf dem Server, liest `$env/dynamic/private`, macht `fetch` zur DPA mit Basic Auth und gibt das Ergebnis als JSON zurück.
- DPA-URL und Login erscheinen nie im Frontend-Bundle.

---

## 4. Data Plane API (Kurzüberblick)

- **Basis:** v3, Präfix `/v3`.
- **Auth:** Basic Auth, User/Pass aus HAProxy-`userlist` (in `dataplaneapi.yml` als `userlist: controller` o. ä. referenziert).
- **Version (Optimistic Locking):** Vor POST/PUT/DELETE zuerst `GET /v3/services/haproxy/configuration/version` (oder Version aus Header `Configuration-Version`), dann `?version=<n>` bei mutierenden Requests.
- **Beispiele:**
  - Info: `GET /v3/info`
  - Konfig-Version: `GET /v3/services/haproxy/configuration/version`
  - Frontends: `GET /v3/services/haproxy/configuration/frontends`
  - Backends: `GET /v3/services/haproxy/configuration/backends`
  - SSL-Liste: `GET /v3/services/haproxy/storage/ssl_certificates`
  - SSL ersetzen: `PUT /v3/services/haproxy/storage/ssl_certificates/<name>?version=...` (Body: PEM)

---

## 5. Empfohlene Struktur im SvelteKit-Projekt

- **`src/lib/server/config.ts`** (oder `.server.ts`)  
  Liest `$env/dynamic/private`, exportiert z. B. `dpaBaseUrl`, `dpaAuthHeader` (oder user/password). Nur von Server-Code importieren.

- **`src/lib/server/dataplane.ts`**  
  Hilfsfunktionen wie `getInfo()`, `getConfigurationVersion()`, `getFrontends()` etc. Nutzen die Config, machen `fetch` zur DPA, geben JSON/Fehler zurück. Keine Credentials nach außen.

- **`src/routes/api/info/+server.ts`**  
  `export async function GET()`: ruft `getInfo()` auf, gibt `json(await getInfo())` oder Fehler zurück.

- Weitere API-Routen analog: z. B. `/api/frontends`, `/api/backends`, `/api/certificates` – alle rufen nur Server-Logik auf, die ihrerseits die DPA anspricht.

So bleibt die Anbindung zwischen HAProxy (DPA) und SvelteKit **komplett serverbasiert**; der Browser spricht nur mit SvelteKit.
