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

**批量创建 OrcaRouter (orcarouter.ai) 账户并自动生成 API 密钥 — 兼容 OpenAI 的推理（orcarouter/free、Claude、Gemini、DeepSeek、Qwen）+ 9Router 连接器。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 快速开始](#-quick-start) · [🎁 免费额度](#-free-tier--how-much-you-get) · [🤖 模型](#-models--all-208-of-them) · [🧪 使用 API](#-how-to-use-the-api) · [✅ 已验证](#-verified-working--every-key-is-tested) · [🧭 工作原理](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 选项](#️-cli-options) · [🛰️ 代理](#️-behind-a-proxy) · [🐞 问题反馈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 为什么会有这个项目

OrcaRouter（`api.orcarouter.ai`）列出了 **208 个模型**，并将注册流程包裹在 **Cloudflare Turnstile** 之中 — 一个内置的浏览器求解器会通过你的出口打开页面，通过验证挑战，然后工具通过纯 HTTP 驱动其余流程。新账户的密钥是*真实的*（在提供商自己的主机上、从与铸造时不同的出口执行 `GET /v1/models` 返回 **200**），并且*受消费限制*：`orcarouter/free` 返回 `402 allowance used up`，`orcarouter/fusion-mini` 返回 `402 out of credits`，而 `deepseek/deepseek-v4-flash-free` 返回 `429 free_rate_limited … link a GitHub account`。一个账户对应一个密钥，任意 N 个。

## 🎁 免费额度 — 你能获得多少

**新 OrcaRouter 账户的密钥可以完成身份验证；推理需要账户已充值，或者对于 `-free` 层级，需要工作区所有者关联到一个已注册一段时间的 GitHub 账户。**

| 项目 | 实测（5 个账户，2026-10-15） |
| --- | --- |
| 铸造时密钥可验证 | `GET https://api.orcarouter.ai/v1/models` **200** — 208 个模型，每个密钥均已写入 |
| 新账户的计费 | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — 用量读取正常 |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| 解锁推理的条件 | 添加额度，或将工作区所有者关联到一个已注册一段时间的 GitHub 账户（`retryable:false` — 不是速率限制） |
| 可扩展的单位 | **一个账户 = 一个密钥** → `--count N` 实际上是“N 个工作区，每个都有自己的额度” |

> 💡 免费层级由 OrcaRouter 设定，可能会变化。请在 [www.orcarouter.ai](https://www.orcarouter.ai) 查看实时数据 — 并让工具自身的门控来决定：

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 模型 — 全部 208 个

`GET https://api.orcarouter.ai/v1/models` 会为铸造出的密钥返回 **208 个模型 id**，例如：

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| 模型模式 | 新密钥上的实测结果 |
| --- | --- |
| `orcarouter/free` | **402** 额度已用尽 |
| `orcarouter/fusion-mini` | **402** 额度不足（`$0.000014`） |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — 需要关联 GitHub 的所有者 |
| `google/gemini-2.5-flash` | **402** 额度不足 |

身份验证读取（`/v1/dashboard/billing/usage`）对每个新密钥都返回 **200** — 门控在于*消费*，而非密钥本身。

## 🧪 如何使用 API

基础 URL 是 **`https://api.orcarouter.ai/v1`** — 兼容 OpenAI，因此任何支持 OpenAI 的工具都能使用（SDK、Cursor、OpenCode、Kilo Code 等）。

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

在新（未充值）账户上，第一次调用会返回 `402`，而 `-free` 模型会返回 `429 free_rate_limited` — 密钥是好的，账户的额度/GitHub 关联才是门控。

## 🛠 快速开始

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

工具写入的所有内容都落在**代码旁边**：`src/keys.txt`、`src/accounts.json`、`src/out/` — 它们读取的目录是 `src/models.json`。当 `src/proxies.txt` 存在时，代理池会从中读取 — 没有代理池时工具直接连接。密钥在验证通过的那一刻就会被追加；每次尝试的记录落在 `out/mint-<ts>/{summary.json,yield.tsv}`。

### 🖱️ 启动器

```bash
node src/launcher.js
```

一个覆盖 **mint · verify · 9Router** 的菜单：它会询问 `count`（每次运行的密钥数，默认 5）和 `concurrency`（并行通道数），将它们保存在 `launcher.config.json` 中，并以正确的标志启动 `node src/cli.js <task>`。菜单项 **4** 会将一个密钥注册到 9Router。

> **如果 Cloudflare 显示图像挑战**，求解器会将本轮转储到 `out/spool/round-N.png` 并附带 `state.json`，然后等待。写入 `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` 来作答，或写入 `{"refresh":true}` 来获取新图像。大多数运行从不需要这样做；Turnstile 通常仅靠点击就能完成。

## ✅ 已验证可用 — 每个密钥都经过测试

实测于 **2026-10-15**：**密钥已验证**（第五个是由已发布的构建端到端铸造的）。每个密钥都在其存在之后进行了检查。

| 模型 | 实时（模型） | 真实聊天调用 | 实测 |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 个模型 | **402** 额度已用尽 | 2026-10-15 |
| `orcarouter/free` | **200** · 208 个模型 | **402** 额度已用尽 | 2026-10-15 |
| `orcarouter/free` | **200** · 208 个模型 | **402** 额度已用尽 | 2026-10-15 |
| `orcarouter/free` | **200** · 208 个模型 | **402** 额度已用尽 | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 个模型 | **402** 额度已用尽 | 2026-10-15 |

**`GET /v1/models` 返回 200 证明密钥是*真实的*；它并不证明密钥能够*消费*。** `src/verify.js` 会在列出的最便宜路径上运行一次 1-token 补全，并记录每一级的精确状态和响应体（`accounts.json.verify.spend = {model, status, bodySnippet}`），因此每个密钥的状态都是实测的 — 从不靠推测。

## 🧭 工作原理

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| 步骤 | 调用 | 说明 |
| --- | --- | --- |
| 挂载 | 内置浏览器求解器 | 通过你的出口打开 `www.orcarouter.ai/register`，通过 **Turnstile**；如果出现图像挑战则转储到 `out/spool/`（用 `clicks.json` 作答） |
| Turnstile 复用 | 每个流程一个 token | token 会作为 `?turnstile=…` 传递到账户路由上；在没有新挂载的情况下复用 token 会返回 `Turnstile verification failed` |
| 发送验证码 | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`；邮件在 **`t0+6.8 s`** 到达（`OrcaRouter email verification`）— Mailtrap 收件箱 `asr7w8bm-…@inbound-mailtrap.io` |
| 注册 | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| 登录 | `POST /api/user/login?turnstile=<token>` | **200** — 账户会话已打开（同样受 Turnstile 门控） |
| 密钥 | 注册返回的 **`initial_token`** 就是密钥 | 在此分支上 `POST /api/token/` 返回 **`403 Security verification is required`** — 注册自带的密钥才是要保留的那个 |
| 证明 | `GET /v1/models`（自己的主机，出口 ≠ 铸造出口）+ 1-token 补全 | 两者都记录了观察出口；消费判定取决于账户的额度，而非密钥的有效性 |

## ⚙️ CLI 选项

所有代码都在 `src/` 中 — 从仓库根目录以 `node src/<file>.js` 运行；数据文件（`src/keys.txt`、`src/proxies.txt`、`src/accounts.json`、`src/out/`）位于代码旁边。

| 工具 | 标志 |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe`（通道数 + 节奏间隔） · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE`（可选；默认 `proxies.txt`） |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | 重新检查 `keys.txt` 中的每个密钥 — 无必需标志；可选 `proxies.txt` 代理池 |
| `src/inbox.js` | 自检：创建一个 Mailtrap 沙盒收件箱并打印它 |

推荐 Turbo（5）；更多会在性能较弱的机器上带来负载/封禁风险。

## 🛰️ 在代理之后

**可选 — 大规模使用时推荐（每 IP 限制、封禁）。** 该工具在没有代理的情况下也能工作。

* 出口来自 `src/proxies.txt`（每行一个出口，`scheme://host:port`，支持 `user:pass@`）或 `mint` 上的 `--pool FILE`。同一个代理池供给页面加载、API 调用和求解器自身的预检查。
* **有代理池时：** 每个请求都通过该列表中的一个出口 — 一个失效的出口会使该次尝试失败，工具会转向下一个（提供代理池时采用故障关闭）。
* **无代理池时：** CLI 会打印 `running WITHOUT a proxy (direct)` 并直接连接 — 页面加载、API 调用和求解器都直接进行。注册、密钥铸造或验证没有任何变化 — 只是数据包离开的位置不同。
* 邮件通过 **Mailtrap**（`api.mailtrap.io`）使用你的 `MAILTRAP_TOKEN` 读取 — 那是邮件提供商，不是目标。没有 `MAILTRAP_TOKEN` 的克隆会在本地收件箱代理运行于 `127.0.0.1:9700` 时回退到它。
* 当提供代理池时，Chrome 会按账户启动并以出口作为其代理；在直接模式下则完全不使用代理；账户完成后立即关闭。
* **不要尝试在面板中创建额外的密钥。** `POST /api/token/` 返回 `403 Security verification is required`；请保留注册时的 `initial_token`。

## 📄 文件

| 路径 | 内容 |
| --- | --- |
| `src/keys.txt` | 每行一个实时验证的密钥 — 已被 git 忽略 |
| `src/accounts.json` | 用户名、邮箱、出口、两项判定 — 已被 git 忽略 |
| `src/models.json` | 由铸造出的密钥返回的 `GET /v1/models` — 已被 git 忽略 |
| `src/proxies.txt` | 你的出口，每行一个 — 已被 git 忽略 |
| `src/out/mint-<ts>/` | 每次尝试的产出：`summary.json`、`yield.tsv`、每次尝试的日志 — 已被 git 忽略 |
| `src/out/spool/` | 图像挑战转储（`round-N.png` + `state.json`）；用 `clicks.json` 作答 |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | CLI 分派到的引擎 |
| `src/connect-9router.js` | 将密钥注册为 9Router 连接 |

## 🔌 连接到 9Router

[9Router](https://9router.com) 是一个自托管、兼容 OpenAI 的路由器。OrcaRouter 兼容 OpenAI，因此注册一次即可使用每个密钥：

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

每次运行会将一个密钥注册为 `orcarouter` 提供商节点的一个连接；用下一个密钥再次调用即可添加另一个（`--model <id>` 覆盖默认值）。然后在 9Router 内选择一个模型：

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

默认值：`--base http://localhost:20128`、`--password 123456`、`--prefix orcarouter`、`--base-url https://api.orcarouter.ai/v1`，默认模型 `orcarouter/free`。

## 🔑 一个密钥能给你带来什么

| | |
| --- | --- |
| 🏢 提供商 | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 提供商提供的内容 | 列出 208 个模型（orcarouter/free、fusion、deepseek-v4-flash）— 密钥真实，推理受消费门控 |
| 🔑 一个密钥能给你带来什么 | 一个 API 密钥，作用域为其自己的账户：下方端点上的 208 个模型 id，受你套餐的限制。配额存在于**账户**上，这正是该工具为每个密钥创建一个账户的原因 |
| 🌐 API 形态 | 兼容 OpenAI：`POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 你的数据 | 仅联系 www.orcarouter.ai 和你配置的收件箱后端；密钥保留在你的机器上 |

## 🐞 问题反馈

提交 issue 时请附上失败的步骤和尝试日志尾部（`src/out/mint-<ts>/attempt-N.log`）— 它包含出口、时序和确切的服务器响应，这是复现一次失败所需的全部信息。切勿附上密钥。**[提交 issue](../../issues)**，欢迎 PR。

## 📄 许可证

MIT © 2026 — 见 [LICENSE](LICENSE)。

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>