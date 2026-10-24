<div align="center">

```
 ██████╗ ██████╗  ██████╗ █████╗ ██████╗  ██████╗ ██╗   ██╗████████╗███████╗
██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝
██║   ██║██████╔╝██║     ███████║██████╔╝██║   ██║██║   ██║   ██║   █████╗
██║   ██║██╔══██╗██║     ██╔══██║██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝
╚██████╔╝██║  ██║╚██████╗██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝

██████╗
██╔══██╗
██████╔╝
██╔══██╗
██║  ██║
╚═╝  ╚═╝
```

# orcarouter-bulk-apikey

**Massenhaftes Erstellen von OrcaRouter-Konten (orcarouter.ai) mit automatisch generierten API-Schlüsseln — OpenAI-kompatible Inferenz (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + 9Router-Konnektor.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Schnellstart](#-quick-start) · [🎁 Kostenlose Stufe](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-208-of-them) · [🧪 Die API verwenden](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 Funktionsweise](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Optionen](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Probleme](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Warum es das gibt

OrcaRouter (`api.orcarouter.ai`) listet **208 Modelle** auf und verpackt die Registrierung in **Cloudflare Turnstile** — ein mitgelieferter Browser-Solver öffnet die Seite über deinen Exit, besteht die Challenge, und das Tool steuert den Rest über einfaches HTTP. Die Schlüssel eines frischen Kontos sind *authentisch* (`GET /v1/models` **200** auf dem Host des Anbieters von einem Exit, der sich vom Mint unterscheidet) und *ausgabenbegrenzt*: `orcarouter/free` antwortet mit `402 allowance used up`, `orcarouter/fusion-mini` antwortet mit `402 out of credits`, und `deepseek/deepseek-v4-flash-free` antwortet mit `429 free_rate_limited … link a GitHub account`. Ein Konto pro Schlüssel, beliebig viele N.

## 🎁 Kostenlose Stufe — wie viel du bekommst

**Der Schlüssel eines frischen OrcaRouter-Kontos authentifiziert; Inferenz erfordert ein aufgeladenes Konto oder, für die `-free`-Stufe, einen Workspace-Eigentümer, der mit einem etablierten GitHub-Konto verknüpft ist.**

| Element | Gemessen (5 Konten, 2026-10-15) |
| --- | --- |
| Schlüssel authentisch zum Mint-Zeitpunkt | `GET https://api.orcarouter.ai/v1/models` **200** — 208 Modelle, jeder Schlüssel geschrieben |
| Abrechnung auf einem frischen Konto | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — Nutzungsabfragen funktionieren |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| Was die Inferenz freischaltet | Guthaben hinzufügen oder den Workspace-Eigentümer mit einem etablierten GitHub-Konto verknüpfen (`retryable:false` — kein Rate-Limit) |
| Die Einheit, die skaliert | **ein Konto = ein Schlüssel** → `--count N` bedeutet wirklich „N Workspaces, jeder mit seinem eigenen Kontingent" |

> 💡 Die kostenlose Stufe wird von OrcaRouter festgelegt und kann sich ändern. Prüfe die aktuellen Zahlen auf [www.orcarouter.ai](https://www.orcarouter.ai) — und lass das Gate des Tools selbst entscheiden:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Modelle — alle 208 davon

`GET https://api.orcarouter.ai/v1/models` gibt **208 Modell-IDs** für einen geminteten Schlüssel zurück, zum Beispiel:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Modellmuster | Gemessenes Ergebnis bei einem frischen Schlüssel |
| --- | --- |
| `orcarouter/free` | **402** allowance used up |
| `orcarouter/fusion-mini` | **402** out of credits (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — benötigt einen GitHub-verknüpften Eigentümer |
| `google/gemini-2.5-flash` | **402** out of credits |

Authentifizierungs-Lesevorgänge (`/v1/dashboard/billing/usage`) antworten mit **200** für jeden frischen Schlüssel — das Gate liegt auf dem *Ausgeben*, nicht auf dem Schlüssel.

## 🧪 So verwendest du die API

Die Basis-URL ist **`https://api.orcarouter.ai/v1`** — OpenAI-kompatibel, also funktioniert alles, was OpenAI spricht (SDKs, Cursor, OpenCode, Kilo Code, …).

```bash
curl https://api.orcarouter.ai/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"orcarouter/free","messages":[{"role":"user","content":"hi"}],"max_tokens":8}'
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://api.orcarouter.ai/v1", api_key="<your key>")
print(client.chat.completions.create(model="orcarouter/free",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

Bei einem frischen (nicht aufgeladenen) Konto antwortet der erste Aufruf mit `402` und das `-free`-Modell antwortet mit `429 free_rate_limited` — der Schlüssel ist gut, die Guthaben-/GitHub-Verknüpfung des Kontos ist das Gate.

## 🛠 Schnellstart

```bash
# clone this repository (or download the ZIP), then:
cd orcarouter-bulk-apikey

# 1) (optional) your proxy list, one exit per line (http://, socks5://, socks4:// or bare host:port)
#    skip this and the tools connect directly
printf 'socks5://127.0.0.1:1080\n' > src/proxies.txt

# 2) a mailbox that can receive the sign-up code
#    Mailtrap → Settings → API tokens (sandbox inboxes)
export MAILTRAP_TOKEN=…

# 3) go
node src/launcher.js               # interactive: mint / verify / settings
# or drive it directly:
node src/cli.js mint --count 5             # any N; 5 is the sample default
node src/cli.js mint --count 30 --conc 2   # two lanes in parallel
node src/cli.js verify                     # re-check every key in keys.txt
node src/cli.js help                       # task list
node src/mint.js --count 5 --help          # mint's own flag reference
```

Alles, was die Tools schreiben, landet **neben dem Code**: `src/keys.txt`, `src/accounts.json`, `src/out/` — und der Katalog, den sie lesen, ist `src/models.json`. Der Pool wird aus `src/proxies.txt` gelesen, wenn sie existiert — ohne eine verbinden sich die Tools direkt. Schlüssel werden in dem Moment angehängt, in dem sie verifiziert werden; der Datensatz jedes Versuchs landet in `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ Der Launcher

```bash
node src/launcher.js
```

Ein Menü über **mint · verify · 9Router**: Es fragt nach `count` (Schlüssel pro Lauf, Standard 5) und `concurrency` (parallele Lanes), behält sie in `launcher.config.json` und startet `node src/cli.js <task>` mit den richtigen Flags. Menüpunkt **4** registriert einen Schlüssel bei 9Router.

> **Wenn Cloudflare eine Bild-Challenge zeigt**, wirft der Solver die Runde nach `out/spool/round-N.png` mit einer `state.json` und wartet. Schreibe `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` zum Antworten, oder `{"refresh":true}` für ein neues Bild. Die meisten Läufe brauchen das nie; Turnstile schließt meist schon mit dem Klick allein ab.

## ✅ Verifiziert funktionierend — jeder Schlüssel wird getestet

Gemessen am **2026-10-15**: **Schlüssel verifiziert** (der fünfte wurde Ende-zu-Ende vom veröffentlichten Build gemintet). Jeder Schlüssel wurde geprüft, nachdem er existierte.

| Modell | Live (Modelle) | Echter Chat-Aufruf | Gemessen |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 Modelle | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 Modelle | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 Modelle | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 Modelle | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 Modelle | **402** allowance used up | 2026-10-15 |

**`GET /v1/models` 200 beweist, dass ein Schlüssel *authentisch* ist; es beweist nicht, dass er *ausgeben* kann.** `src/verify.js` führt eine 1-Token-Completion auf dem günstigsten gelisteten Pfad aus und zeichnet den exakten Status und Body pro Stufe auf (`accounts.json.verify.spend = {model, status, bodySnippet}`), sodass der Zustand jedes Schlüssels gemessen wird — nie impliziert.

## 🧭 Funktionsweise

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Schritt | Aufruf | Hinweise |
| --- | --- | --- |
| Mount | mitgelieferter Browser-Solver | öffnet `www.orcarouter.ai/register` über deinen Exit, besteht **Turnstile**; wirft nach `out/spool/`, wenn eine Bild-Challenge erscheint (mit `clicks.json` antworten) |
| Turnstile-Wiederverwendung | ein Token pro Ablauf | Token wird als `?turnstile=…` an die Konto-Routen übergeben; ein wiederverwendetes Token ohne frischen Mount antwortet mit `Turnstile verification failed` |
| Code senden | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; Mail kommt in **`t0+6.8 s`** an (`OrcaRouter email verification`) — Mailtrap-Inbox `asr7w8bm-…@inbound-mailtrap.io` |
| Registrieren | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Anmelden | `POST /api/user/login?turnstile=<token>` | **200** — Kontositzung geöffnet (ebenfalls Turnstile-geschützt) |
| Schlüssel | der **`initial_token`** der Registrierung ist der Schlüssel | `POST /api/token/` antwortet mit **`403 Security verification is required`** bei diesem Fork — der eigene Schlüssel der Registrierung ist der, den man behält |
| Beweisen | `GET /v1/models` (eigener Host, Exit ≠ Mint) + 1-Token-Completion | beide mit dem beobachtenden Exit aufgezeichnet; Ausgabe-Urteil ist das Kontingent des Kontos, nicht die Gültigkeit des Schlüssels |

## ⚙️ CLI-Optionen

Der gesamte Code liegt in `src/` — führe ihn vom Repository-Stamm als `node src/<file>.js` aus; Datendateien (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) liegen neben dem Code.

| Tool | Flags |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (Lane-Anzahl + Pacing-Abstand) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (optional; Standard `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | prüft jeden Schlüssel in `keys.txt` erneut — keine erforderlichen Flags; optionaler `proxies.txt`-Pool |
| `src/inbox.js` | Selbsttest: erstellt eine Mailtrap-Sandbox-Inbox und gibt sie aus |

Turbo wird empfohlen (5); mehr bedeutet Last-/Ban-Risiko auf schwachen Rechnern.

## 🛰️ Hinter einem Proxy

**Optional — bei Skalierung empfohlen (Limits pro IP, Bans).** Das Tool funktioniert auch ohne Proxy.

* Exits kommen aus `src/proxies.txt` (eine Zeile pro Exit, `scheme://host:port`, `user:pass@` unterstützt) oder `--pool FILE` bei `mint`. Derselbe Pool speist die Seitenaufrufe, die API-Aufrufe und die eigenen Vorabprüfungen des Solvers.
* **Mit einem Pool:** Jede Anfrage geht über einen Exit aus dieser Liste — ein toter Exit lässt diesen Versuch fehlschlagen und das Tool geht zum nächsten über (fail-closed, solange ein Pool bereitgestellt wird).
* **Ohne einen Pool:** Die CLI gibt `running WITHOUT a proxy (direct)` aus und verbindet sich direkt — Seitenaufrufe, API-Aufrufe und der Solver gehen alle direkt. An Registrierung, Schlüssel-Minting oder Verifizierung ändert sich nichts — nur daran, wo die Pakete hinausgehen.
* Mail wird von **Mailtrap** (`api.mailtrap.io`) mit deinem `MAILTRAP_TOKEN` gelesen — das ist der Mail-Anbieter, nicht das Ziel. Ein Klon ohne `MAILTRAP_TOKEN` fällt auf einen lokalen Inbox-Broker auf `127.0.0.1:9700` zurück, wenn einer läuft.
* Chrome wird pro Konto mit dem Exit als Proxy gestartet, wenn ein Pool angegeben ist, und ganz ohne Proxy im Direktmodus; es wird geschlossen, sobald das Konto fertig ist.
* **Versuche nicht, im Panel einen zusätzlichen Schlüssel zu erstellen.** `POST /api/token/` antwortet mit `403 Security verification is required`; behalte `initial_token` aus der Registrierung.

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `src/keys.txt` | ein live-verifizierter Schlüssel pro Zeile — von Git ignoriert |
| `src/accounts.json` | Benutzername, Mailbox, Exits, beide Urteile — von Git ignoriert |
| `src/models.json` | `GET /v1/models`, wie von einem geminteten Schlüssel beantwortet — von Git ignoriert |
| `src/proxies.txt` | deine Exits, eine pro Zeile — von Git ignoriert |
| `src/out/mint-<ts>/` | Ausbeute pro Versuch: `summary.json`, `yield.tsv`, Logs pro Versuch — von Git ignoriert |
| `src/out/spool/` | Bild-Challenge-Dumps (`round-N.png` + `state.json`); mit `clicks.json` antworten |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | die Engines, an die die CLI weiterleitet |
| `src/connect-9router.js` | registriert die Schlüssel als 9Router-Verbindungen |

## 🔌 Mit 9Router verbinden

[9Router](https://9router.com) ist ein selbst gehosteter, OpenAI-kompatibler Router. OrcaRouter ist OpenAI-kompatibel, also registriere es einmal und nutze jeden Schlüssel:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Jeder Lauf registriert einen Schlüssel als Verbindung des `orcarouter`-Provider-Knotens; rufe es erneut mit dem nächsten Schlüssel auf, um einen weiteren hinzuzufügen (`--model <id>` überschreibt den Standard). Wähle dann ein Modell innerhalb von 9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, Standardmodell `orcarouter/free`.

## 🔑 Was ein Schlüssel dir bringt

| | |
| --- | --- |
| 🏢 Anbieter | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 Was der Anbieter gibt | 208 Modelle gelistet (orcarouter/free, fusion, deepseek-v4-flash) — Schlüssel authentisch, Inferenz ausgabenbegrenzt |
| 🔑 Was ein Schlüssel dir bringt | ein API-Schlüssel, der auf sein eigenes Konto beschränkt ist: die 208 Modell-IDs auf dem unten stehenden Endpunkt, zu den Limits deines Plans. Das Kontingent liegt auf dem **Konto**, weshalb dieses Tool genau ein Konto pro Schlüssel erstellt |
| 🌐 API-Form | OpenAI-kompatibel: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Deine Daten | nur www.orcarouter.ai und das von dir konfigurierte Inbox-Backend werden kontaktiert; Schlüssel bleiben auf deinem Rechner |

## 🐞 Probleme

Öffne ein Issue mit dem fehlgeschlagenen Schritt und dem Ende des Versuchs-Logs (`src/out/mint-<ts>/attempt-N.log`) — es enthält den Exit, das Timing und die exakte Serverantwort, was alles ist, was zur Reproduktion eines Fehlschlags benötigt wird. Hänge niemals einen Schlüssel an. **[Öffne ein Issue](../../issues)** und PRs sind willkommen.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>