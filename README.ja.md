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

**OrcaRouter（orcarouter.ai）アカウントをAPIキー自動生成付きで一括作成 — OpenAI互換の推論（orcarouter/free、Claude、Gemini、DeepSeek、Qwen）+ 9Routerコネクタ。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-208-of-them) · [🧪 APIの使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 問題報告](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ これが存在する理由

OrcaRouter（`api.orcarouter.ai`）は**208モデル**を提供し、新規登録は**Cloudflare Turnstile**で保護されています — 同梱のブラウザソルバーがあなたの出口経由でページを開き、チャレンジを通過し、残りはツールがプレーンHTTPで処理します。新規アカウントのキーは*本物*であり（プロバイダー自身のホスト上で、発行元とは異なる出口から `GET /v1/models` が**200**）、かつ*支出制限付き*です：`orcarouter/free` は `402 allowance used up`、`orcarouter/fusion-mini` は `402 out of credits`、`deepseek/deepseek-v4-flash-free` は `429 free_rate_limited … link a GitHub account` を返します。1アカウントにつき1キー、任意のN個。

## 🎁 無料枠 — どれだけ得られるか

**新規OrcaRouterアカウントのキーは認証できますが、推論にはアカウントへの入金、または `-free` 枠の場合は確立されたGitHubアカウントにリンクされたワークスペースオーナーが必要です。**

| 項目 | 実測値（5アカウント、2026-10-15） |
| --- | --- |
| 発行時のキー認証 | `GET https://api.orcarouter.ai/v1/models` **200** — 208モデル、すべてのキーが書き込まれた |
| 新規アカウントの課金 | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — 使用量の読み取りは機能する |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| 推論を解放するもの | クレジットを追加する、またはワークスペースオーナーを確立されたGitHubアカウントにリンクする（`retryable:false` — レート制限ではない） |
| スケールする単位 | **1アカウント = 1キー** → `--count N` は実質「N個のワークスペース、それぞれが独自の割り当てを持つ」 |

> 💡 無料枠はOrcaRouterが設定するもので、変更される可能性があります。最新の数値は [www.orcarouter.ai](https://www.orcarouter.ai) で確認してください — そしてツール自身のゲートに判断させましょう：

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 モデル — 208個すべて

`GET https://api.orcarouter.ai/v1/models` は発行されたキーに対して**208個のモデルID**を返します。例えば：

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| モデルパターン | 新規キーでの実測結果 |
| --- | --- |
| `orcarouter/free` | **402** 割り当てを使い切り |
| `orcarouter/fusion-mini` | **402** クレジット不足（`$0.000014`） |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — GitHubリンク済みのオーナーが必要 |
| `google/gemini-2.5-flash` | **402** クレジット不足 |

認証の読み取り（`/v1/dashboard/billing/usage`）はすべての新規キーに対して**200**を返します — ゲートは*支出*にあり、キーにはありません。

## 🧪 APIの使い方

ベースURLは **`https://api.orcarouter.ai/v1`** です — OpenAI互換なので、OpenAIを話せるものなら何でも動作します（SDK、Cursor、OpenCode、Kilo Code など）。

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

新規（未入金）アカウントでは最初の呼び出しが `402` を返し、`-free` モデルは `429 free_rate_limited` を返します — キーは正常で、アカウントのクレジット／GitHubリンクがゲートです。

## 🛠 クイックスタート

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

ツールが書き込むものはすべて**コードの隣**に置かれます：`src/keys.txt`、`src/accounts.json`、`src/out/` — そして読み込むカタログは `src/models.json` です。プールは `src/proxies.txt` が存在する場合にそこから読み込まれます — なければツールは直接接続します。キーは検証された瞬間に追記されます。各試行の記録は `out/mint-<ts>/{summary.json,yield.tsv}` に置かれます。

### 🖱️ ランチャー

```bash
node src/launcher.js
```

**mint · verify · 9Router** のメニューです：`count`（1回の実行あたりのキー数、デフォルト5）と `concurrency`（並列レーン数）を尋ね、それらを `launcher.config.json` に保持し、適切なフラグで `node src/cli.js <task>` を起動します。メニュー項目**4**はキーを9Routerに登録します。

> **Cloudflareが画像チャレンジを表示した場合**、ソルバーはそのラウンドを `out/spool/round-N.png` に `state.json` とともにダンプして待機します。`out/spool/clicks.json` に `{"tiles":[2,5],"verify":true}` を書いて回答するか、`{"refresh":true}` で新しい画像を要求してください。ほとんどの実行ではこれは不要です。Turnstileは通常クリックだけで完了します。

## ✅ 動作検証済み — すべてのキーがテストされています

実測 **2026-10-15**：**検証済みのキー**（5つ目は公開ビルドによってエンドツーエンドで発行されました）。すべてのキーは存在した後にチェックされました。

| モデル | ライブ（モデル） | 実際のチャット呼び出し | 実測日 |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208モデル | **402** 割り当てを使い切り | 2026-10-15 |
| `orcarouter/free` | **200** · 208モデル | **402** 割り当てを使い切り | 2026-10-15 |
| `orcarouter/free` | **200** · 208モデル | **402** 割り当てを使い切り | 2026-10-15 |
| `orcarouter/free` | **200** · 208モデル | **402** 割り当てを使い切り | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208モデル | **402** 割り当てを使い切り | 2026-10-15 |

**`GET /v1/models` の200はキーが*本物*であることを証明しますが、*支出*できることは証明しません。** `src/verify.js` はリストされている最も安価なパスで1トークンの補完を実行し、各段階の正確なステータスとボディを記録します（`accounts.json.verify.spend = {model, status, bodySnippet}`）。これにより、すべてのキーの状態が測定され — 決して推測されません。

## 🧭 仕組み

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| ステップ | 呼び出し | 備考 |
| --- | --- | --- |
| マウント | 同梱のブラウザソルバー | あなたの出口経由で `www.orcarouter.ai/register` を開き、**Turnstile**を通過します。画像チャレンジが表示された場合は `out/spool/` にダンプします（`clicks.json` で回答） |
| Turnstile再利用 | フローごとに1トークン | トークンはアカウントルートに `?turnstile=…` として渡されます。新たにマウントせずにトークンを再利用すると `Turnstile verification failed` を返します |
| コード送信 | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`；メールは **`t0+6.8 s`** で到着（`OrcaRouter email verification`）— Mailtrap受信箱 `asr7w8bm-…@inbound-mailtrap.io` |
| 登録 | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| ログイン | `POST /api/user/login?turnstile=<token>` | **200** — アカウントセッションが開かれた（これもTurnstileで保護） |
| キー | 登録時の **`initial_token`** がキー | `POST /api/token/` はこのフォークでは **`403 Security verification is required`** を返します — サインアップ自身のキーが保持すべきものです |
| 証明 | `GET /v1/models`（自身のホスト、出口 ≠ 発行元）+ 1トークン補完 | どちらも観測した出口とともに記録されます。支出の判定はアカウントの割り当てであり、キーの有効性ではありません |

## ⚙️ CLIオプション

すべてのコードは `src/` にあります — リポジトリのルートから `node src/<file>.js` として実行してください。データファイル（`src/keys.txt`、`src/proxies.txt`、`src/accounts.json`、`src/out/`）はコードの隣にあります。

| ツール | フラグ |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (レーン数 + ペーシング間隔) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (任意；デフォルト `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | `keys.txt` のすべてのキーを再チェック — 必須フラグなし；任意で `proxies.txt` プール |
| `src/inbox.js` | セルフチェック：Mailtrapサンドボックス受信箱を1つ作成して表示 |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ プロキシの背後で

**任意 — 規模を拡大する場合は推奨（IPごとの制限、BAN）。** ツールはプロキシなしでも動作します。

* 出口は `src/proxies.txt`（1行につき1出口、`scheme://host:port`、`user:pass@` 対応）または `mint` の `--pool FILE` から取得されます。同じプールがページ読み込み、API呼び出し、ソルバー自身の事前チェックに供給されます。
* **プールありの場合：** すべてのリクエストはそのリストの出口を経由します — 死んだ出口はその試行を失敗させ、ツールは次の出口に移ります（プールが提供されている間はフェイルクローズ）。
* **プールなしの場合：** CLIは `running WITHOUT a proxy (direct)` と表示して直接接続します — ページ読み込み、API呼び出し、ソルバーはすべて直接接続します。サインアップ、キー発行、検証については何も変わりません — 変わるのはパケットが出ていく場所だけです。
* メールは **Mailtrap**（`api.mailtrap.io`）から `MAILTRAP_TOKEN` を使って読み取られます — それはメールプロバイダーであり、ターゲットではありません。`MAILTRAP_TOKEN` のないクローンは、`127.0.0.1:9700` でローカル受信箱ブローカーが動作していればそれにフォールバックします。
* Chromeはアカウントごとに起動され、プールが指定されている場合は出口をプロキシとして使用し、ダイレクトモードではプロキシを一切使用しません。アカウントの処理が完了するとすぐに閉じられます。
* **パネルで追加のキーを作成しようとしないでください。** `POST /api/token/` は `403 Security verification is required` を返します。サインアップ時の `initial_token` を保持してください。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `src/keys.txt` | ライブ検証済みのキーを1行に1つ — git-ignored |
| `src/accounts.json` | ユーザー名、メールボックス、出口、両方の判定 — git-ignored |
| `src/models.json` | 発行されたキーが返す `GET /v1/models` — git-ignored |
| `src/proxies.txt` | あなたの出口、1行に1つ — git-ignored |
| `src/out/mint-<ts>/` | 試行ごとの収穫：`summary.json`、`yield.tsv`、試行ごとのログ — git-ignored |
| `src/out/spool/` | 画像チャレンジのダンプ（`round-N.png` + `state.json`）；`clicks.json` で回答 |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | CLIがディスパッチするエンジン |
| `src/connect-9router.js` | キーを9Router接続として登録 |

## 🔌 9Routerに接続

[9Router](https://9router.com) はセルフホスト型のOpenAI互換ルーターです。OrcaRouterはOpenAI互換なので、一度登録すればすべてのキーを使えます：

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

各実行は1つのキーを `orcarouter` プロバイダーノードの接続として登録します。次のキーで再度呼び出すと別の接続が追加されます（`--model <id>` でデフォルトを上書き）。その後、9Router内でモデルを選択してください：

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

デフォルト：`--base http://localhost:20128`、`--password 123456`、`--prefix orcarouter`、`--base-url https://api.orcarouter.ai/v1`、デフォルトモデル `orcarouter/free`。

## 🔑 1つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダー | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 プロバイダーが提供するもの | 208モデルがリスト（orcarouter/free、fusion、deepseek-v4-flash）— キーは本物、推論は支出制限付き |
| 🔑 1つのキーで得られるもの | 自身のアカウントにスコープされた1つのAPIキー：下記エンドポイントの208モデルID、あなたのプランの制限内で。クォータは**アカウント**に存在し、まさにそれがこのツールが1アカウントにつき1キーを作成する理由です |
| 🌐 APIの形 | OpenAI互換：`POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 あなたのデータ | 接触するのは www.orcarouter.ai と、あなたが設定した受信箱バックエンドのみです；キーはあなたのマシンに留まります |

## 🐞 問題報告

失敗したステップと試行ログの末尾（`src/out/mint-<ts>/attempt-N.log`）を添えてissueを開いてください — そこには出口、タイミング、正確なサーバーの応答が含まれており、失敗を再現するために必要なすべてが揃っています。キーは絶対に添付しないでください。**[issueを開く](../../issues)** — PRも歓迎します。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE) を参照。

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>