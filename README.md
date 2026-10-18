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

**Bulk-create OrcaRouter (orcarouter.ai) accounts with auto-generated API keys — OpenAI-compatible inference (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + 9Router connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [🎁 Free tier](#-free-tier--how-much-you-get) · [🤖 Models](#-models--all-208-of-them) · [🧪 Use the API](#-how-to-use-the-api) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

## ✨ Why this exists

OrcaRouter (`api.orcarouter.ai`) lists **208 models** and wraps sign-up in **Cloudflare Turnstile** — a bundled browser solver opens the page through your exit, passes the challenge, and the tool drives the rest over plain HTTP. A fresh account's keys are *authentic* (`GET /v1/models` **200** on the provider's own host from an exit different from the mint) and *spend-gated*: `orcarouter/free` answers `402 allowance used up`, `orcarouter/fusion-mini` answers `402 out of credits`, and `deepseek/deepseek-v4-flash-free` answers `429 free_rate_limited … link a GitHub account`. One account per key, any N.

## 🎁 Free tier — how much you get

**A fresh OrcaRouter account's key authenticates; inference needs the account funded or, for the `-free` tier, a workspace owner linked to an established GitHub account.**

| Item | Measured (5 accounts, 2026-10-15) |
| --- | --- |
| Key authentic at mint time | `GET https://api.orcarouter.ai/v1/models` **200** — 208 models, every key written |
| Billing on a fresh account | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — usage reads work |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| What unlocks inference | add credits, or link the workspace owner to an established GitHub account (`retryable:false` — not a rate limit) |
| The unit that scales | **one account = one key** → `--count N` is really "N workspaces, each with its own allowance" |

> 💡 The free tier is set by OrcaRouter and can change. Check the live numbers at [www.orcarouter.ai](https://www.orcarouter.ai) — and let the tool's own gate decide:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Models — all 208 of them

`GET https://api.orcarouter.ai/v1/models` returns **208 model ids** for a minted key, for example:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Model pattern | Measured result on a fresh key |
| --- | --- |
| `orcarouter/free` | **402** allowance used up |
| `orcarouter/fusion-mini` | **402** out of credits (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — needs a GitHub-linked owner |
| `google/gemini-2.5-flash` | **402** out of credits |

Authentication reads (`/v1/dashboard/billing/usage`) answer **200** for every fresh key — the gate is on *spending*, not on the key.

## 🧪 How to use the API

The base URL is **`https://api.orcarouter.ai/v1`** — OpenAI-compatible, so anything that speaks OpenAI works (SDKs, Cursor, OpenCode, Kilo Code, …).

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

On a fresh (unfunded) account the first call answers `402` and the `-free` model answers `429 free_rate_limited` — the key is good, the account's credit/GitHub linkage is the gate.

## 🛠 Quick start

```bash
# clone this repository (or download the ZIP), then:
cd orcarouter-bulk-apikey

# 1) your proxy list, one exit per line (http://, socks5://, socks4:// or bare host:port)
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

Everything the tools write lands **next to the code**: `src/keys.txt`, `src/accounts.json`, `src/out/` — and the catalogue they read is `src/models.json`. The pool is read from `src/proxies.txt`. Keys are appended the moment they verify; each attempt's record lands in `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ The launcher

```bash
node src/launcher.js
```

A menu over **mint · verify · 9Router**: it asks for `count` (keys per run, default 5) and `concurrency` (parallel lanes), keeps them in `launcher.config.json`, and spawns `node src/cli.js <task>` with the right flags. Menu item **4** registers a key with 9Router.

> **If Cloudflare shows an image challenge**, the solver dumps the round to `out/spool/round-N.png` with a `state.json` and waits. Write `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` to answer, or `{"refresh":true}` for a new image. Most runs never need this; Turnstile usually completes on the click alone.

## ✅ Verified working — every key is tested

Measured **2026-10-15**: **5 distinct accounts → 5 keys, one key per account** (the fifth was minted end-to-end by the published build). Every key was checked after it existed.

| Model | Live (models) | Real chat call | Measured |
| --- | --- | --- |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 models | **402** allowance used up | 2026-10-15 |

**`GET /v1/models` 200 proves a key is *authentic*; it does not prove it can *spend*.** `src/verify.js` runs a 1-token completion on the cheapest listed path and records the exact status and body per rung (`accounts.json.verify.spend = {model, status, bodySnippet}`), so the state of every key is measured — never implied.

## 🧭 How it works

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Step | Call | Notes |
| --- | --- | --- |
| Mount | bundled browser solver | opens `www.orcarouter.ai/register` through your exit, passes **Turnstile**; dumps to `out/spool/` if an image challenge appears (answer with `clicks.json`) |
| Turnstile reuse | one token per flow | token is passed as `?turnstile=…` on the account routes; a reused token without a fresh mount answers `Turnstile verification failed` |
| Send code | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; mail arrives in **`t0+6.8 s`** (`OrcaRouter email verification`) — Mailtrap inbox `asr7w8bm-…@inbound-mailtrap.io` |
| Register | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Login | `POST /api/user/login?turnstile=<token>` | **200** — account session opened (also Turnstile-gated) |
| Key | register's **`initial_token`** is the key | `POST /api/token/` answers **`403 Security verification is required`** on this fork — the sign-up's own key is the one to keep |
| Prove | `GET /v1/models` (own host, exit ≠ mint) + 1-token completion | both recorded with the observing exit; spend verdict is the account's allowance, not the key's validity |

## ⚙️ CLI options

All code lives in `src/` — run it from the repository root as `node src/<file>.js`; data files (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) sit next to the code.

| Tool | Flags |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (lane count + pacing gap) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (default `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | re-checks every key in `keys.txt` — no required flags; reads `proxies.txt` |
| `src/inbox.js` | self-check: creates one Mailtrap sandbox inbox and prints it |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ Behind a proxy

* Exits come from `src/proxies.txt` (one line per exit, `scheme://host:port`, `user:pass@` supported). The same pool feeds the page loads, the API calls and the solver's own pre-checks; the tools never dial the provider directly.
* Mail is read from **Mailtrap** (`api.mailtrap.io`) with your `MAILTRAP_TOKEN` — that is the mail provider, not the target. A clone without `MAILTRAP_TOKEN` falls back to a local inbox broker on `127.0.0.1:9700` when one is running.
* Chrome is launched per account with the exit as its proxy and closed as soon as the account is done.
* **Do not try to create an extra key in the panel.** `POST /api/token/` answers `403 Security verification is required`; keep `initial_token` from the sign-up.

## 📄 Files

| Path | Contents |
| --- | --- |
| `src/keys.txt` | one live-verified key per line — git-ignored |
| `src/accounts.json` | username, mailbox, exits, both verdicts — git-ignored |
| `src/models.json` | `GET /v1/models` as answered by a minted key — git-ignored |
| `src/proxies.txt` | your exits, one per line — git-ignored |
| `src/out/mint-<ts>/` | per-attempt yield: `summary.json`, `yield.tsv`, per-attempt logs — git-ignored |
| `src/out/spool/` | image-challenge dumps (`round-N.png` + `state.json`); answer with `clicks.json` |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | the engines the CLI dispatches to |
| `src/connect-9router.js` | registers the keys as 9Router connections |

## 🔌 Connect to 9Router

[9Router](https://9router.com) is a self-hosted, OpenAI-compatible router. OrcaRouter is OpenAI-compatible, so register it once and use every key:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Each run registers one key as a connection of the `orcarouter` provider node; call it again with the next key to add another (`--model <id>` overrides the default). Then pick a model inside 9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Defaults: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, default model `orcarouter/free`.

## 🔑 What one key gets you

| | |
| --- | --- |
| 🏢 Provider | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 What the provider gives | 208 models listed (orcarouter/free, fusion, deepseek-v4-flash) — keys authentic, inference spend-gated |
| 🔑 What one key gets you | one API key scoped to its own account: the 208 model ids on the endpoint below, at your plan's limits. The quota lives on the **account**, which is exactly why this tool creates one account per key |
| 🌐 API shape | OpenAI-compatible: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Your data | only www.orcarouter.ai and the inbox backend you configure are contacted; keys stay on your machine |

## 🐞 Issues

Open an issue with the failing step and the attempt log tail (`src/out/mint-<ts>/attempt-N.log`) — it carries the exit, the timing and the exact server answer, which is everything needed to reproduce a miss. Never attach a key. **[Open an issue](../../issues)** and PRs are welcome.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>
