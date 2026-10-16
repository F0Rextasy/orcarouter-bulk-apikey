<div align="center">

```
 ██████╗ ██████╗  ██████╗ █████╗ ██████╗  ██████╗ ██╗   ██╗████████╗███████╗██████╗
██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝██╔══██╗
██║   ██║██████╔╝██║     ███████║██████╔╝██║   ██║██║   ██║   ██║   █████╗  ██████╔╝
██║   ██║██╔══██╗██║     ██╔══██║██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝  ██╔══██╗
╚██████╔╝██║  ██║╚██████╗██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗██║  ██║
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
```

# orcarouter-bulk-apikey

**Bulk-create OrcaRouter (orcarouter.ai) accounts with auto-generated API keys — OpenAI-compatible inference + 9Router connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20listed-d97706?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6.svg?style=for-the-badge)](#-connect-to-9router)

[🛠 Quick start](#-quick-start) · [✅ Verified](#-verified-authentic--spend-gated) · [🤖 Models & free tier](#-models--free-tier) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

> **One account, one key.** N accounts → N keys, every key verified live — `GET /v1/models`
> must answer 200 for it on the provider's own host from an exit different from the
> one that minted it — before it is appended to `keys.txt`.

> **The free-tier note, up front.** Keys are *authentic*: all of them list 208 models.
> *Inference* needs the account's wallet funded, or — for the `-free` model tier — a
> workspace owner linked to an established GitHub account. A fresh account answers
> `402 You're out of credits — this request needs $0.000014…` and, for
> `deepseek/deepseek-v4-flash-free`, `429 free_rate_limited … link a GitHub account
> that has been registered for some time`. Details and exact bodies: [Models & free tier](#-models--free-tier).

## ✨ What this does

* **One account per key, any number you want.** `--count N` (default 5) mints N fresh
  accounts and prints one key per line into `keys.txt`.
* **Turnstile is solved for you.** A bundled browser solver opens the sign-up page
  through your exit, passes the challenge, and the tool drives the rest of the
  sign-up over plain HTTP — no browser automation to babysit.
* **Keys are verified, not assumed.** Each key is checked on `GET /v1/models` (own
  host, an exit different from the mint) *and* probed with a one-token completion, so
  you know whether it is only authentic or also spendable.
* **Everything lands on disk.** `keys.txt` (one key per line), `accounts.json`
  (username, mailbox, exits, both verdicts), `models.json`, and a per-attempt yield
  log under `out/`.

## 🛠 Quick start

```bash
git clone https://github.com/F0Rextasy/orcarouter-bulk-apikey.git
cd orcarouter-bulk-apikey

# 1) your proxy list, one exit per line (http://, socks5://, socks4:// or bare host:port)
printf 'socks5://127.0.0.1:1080\n' > proxies.txt

# 2) a mailbox that can receive the sign-up code
export MAILTRAP_TOKEN=…        # Mailtrap → Settings → API tokens (sandbox inboxes)

# 3) go
node src/launcher.js               # interactive: mint / verify / settings
# or drive it directly:
node src/cli.js mint --count 30            # any N; 5 is the sample default
node src/cli.js mint --count 3 --conc 2    # two lanes in parallel
node src/cli.js verify                     # re-check every key in keys.txt
node src/cli.js help                       # task list
node src/cli.js mint --help                # the flags mint actually reads
```

Everything the tools write lands **next to the code**: `src/keys.txt`, `src/accounts.json`,
`src/out/` — and the model catalogue they read is `src/models.json`. The pool is read from
`src/proxies.txt`.

Keys are appended to `keys.txt`
, one per line, the moment a key verifies. Each
attempt's record — wall time, sign-up steps, verification — lands in
`out/mint-<ts>/{summary.json,yield.tsv}`.

> **If Cloudflare shows an image challenge**, the solver dumps the round to
> `out/spool/round-N.png` with a `state.json` and waits. Write
> `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` to answer, or
> `{"refresh":true}` for a new image. Most runs never need this; Turnstile usually
> completes on the click alone.

> **Do not try to create an extra key in the panel.** The fork answers
> `POST /api/token/` with **`403 Security verification is required`**. The key this
> tool records is the one the sign-up itself returns (`initial_token`), and it is
> good for all API calls.

## ✅ Verified: authentic + spend-gated

The batch this repository shipped from: **5 distinct accounts → 5 keys, one key per
account** (the fifth was minted end-to-end by the code in this repo). Every key was
checked after it existed:

| model | live (test) | real chat call | measured |
|---|---|---|---|
| `orcarouter/free` | **200** · 208 models | **402** · allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** · allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** · allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** · allowance used up | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 models | **402** · allowance used up | 2026-10-15 |

**The second column pair is the point.** `GET /v1/models` 200 proves a key is
*authentic*; it does not prove it can *spend*. `cli.js verify` (and every mint) runs
a one-token completion on the cheapest listed path and records the exact status and
body per rung (`accounts.json.verify.spend = {model, status, bodySnippet}`), so the
state of every key is on disk, measured — never implied.

## 🤖 Models & free tier

`GET /v1/models` returns **208 model ids** for a minted key, for example:

```
orcarouter/free · orcarouter/fusion-mini · deepseek/deepseek-v4-flash
google/gemini-2.5-flash · anthropic/claude-haiku-4.5 · qwen/qwen3-max
kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

Authentication reads work immediately: `/v1/dashboard/billing/usage` answers
`200 {"object":"list","total_usage":0}` for a fresh key.

**What a fresh account sees when it tries to *use* a model** — measured on every key
in the table above, quoted so you know exactly what you will get:

| call | status | body |
|---|---|---|
| `orcarouter/free` | **402** | `your orcarouter/free allowance is used up — top up your balance and call a specific model with wallet billing to keep going` |
| `orcarouter/fusion-mini` | **402** | `You're out of credits — this request needs $0.000014. Add credits to keep going: …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** | `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** | `{"code":"free_rate_limited","message":"Free models are not available to this account yet. They require the workspace owner to link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |

**What unlocks inference:** add credits to the account's wallet, or link the
workspace owner to an established GitHub account (the `free_rate_limited` gate is a
policy check — `retryable:false` — not a rate limit). The keys stay valid either
way: the same key serves traffic with no re-mint the moment the account is funded.

## 🔌 Connect to 9Router

The keys this tool mints are ordinary OpenAI-compatible credentials, so a local
9Router instance can serve them like any other provider: one `openai-compatible`
node for OrcaRouter (orcarouter.ai), one connection per key.

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --api-key <key>            # or env NINEROUTER_API_KEY
```

The launcher menu and the CLI dispatcher drive the same connector:

```bash
node src/launcher.js --connect-9router    # asks for base URL, password and key (the key is not echoed)
node src/cli.js connect --api-key <key>   # the same task, non-interactive
node src/connect-9router.js --help        # every flag and default
```

Defaults: base `http://localhost:20128`, password `123456`, model prefix
`orcarouter`, node `orcarouter`, upstream `https://api.orcarouter.ai/v1`, default model
`orcarouter/free`. Register another minted key with `--name "<label 2>"` — the node stays and
every key becomes another connection 9Router can load-balance across. Then pick a model inside
9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
```

## ⚙️ Options

| tool | flags |
|---|---|
| `mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1, max 3) · `--runs N` (2 solver runs per challenge) · `--tag` · `--pool FILE` (default `proxies.txt`) |
| `turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` (default `proxies.txt`) · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume --username --password` · `--verify-only --key` · `--brain spool\|provider[:model]\|http:<base>\|<model>\|<keyfile>` · `--probe-only` |
| `solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--run-attempts` · `--brain` · `--out` · `--headless` |
| `verify.js` | `--key <k>` (one key) · `--exits FILE` (default `proxies.txt`) |
| `inbox.js` | `node src/inbox.js` — self-check: creates one sandbox inbox and prints it |

## 🛰️ Behind a proxy

* Exits come from `proxies.txt` (one line per exit, `scheme://host:port`,
  `user:pass@` supported). The same pool feeds the page loads, the API calls and the
  solver's own pre-checks; the tools never dial the provider directly.
* Mail is read from Mailtrap (`api.mailtrap.io`) with your token — that is the mail
  provider, not the target. A clone without `MAILTRAP_TOKEN` falls back to a local
  inbox broker on `127.0.0.1:9700` when one is running.
* Chrome is launched per account with the exit as its proxy and is closed as soon as
  the account is done.

## 🐞 Issues

Open an issue with the failing step and the attempt log tail
(`out/mint-<ts>/attempt-N.log`) — it carries the exit, the timing and the exact
server answer, which is everything needed to reproduce a miss. Never attach a key.

## 📄 License

MIT — see [LICENSE](LICENSE). Use it on accounts you are allowed to create.

---

