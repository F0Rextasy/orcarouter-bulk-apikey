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

**자동 생성된 API 키로 OrcaRouter(orcarouter.ai) 계정을 대량 생성 — OpenAI 호환 추론(orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + 9Router 커넥터.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 빠른 시작](#-quick-start) · [🎁 무료 티어](#-free-tier--how-much-you-get) · [🤖 모델](#-models--all-208-of-them) · [🧪 API 사용하기](#-how-to-use-the-api) · [✅ 검증됨](#-verified-working--every-key-is-tested) · [🧭 작동 방식](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 옵션](#️-cli-options) · [🛰️ 프록시](#️-behind-a-proxy) · [🐞 이슈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 이 도구가 존재하는 이유

OrcaRouter(`api.orcarouter.ai`)는 **208개의 모델**을 나열하며, 가입 절차를 **Cloudflare Turnstile**로 감쌉니다 — 번들된 브라우저 솔버가 여러분의 출구(exit)를 통해 페이지를 열고, 챌린지를 통과하면, 나머지는 도구가 일반 HTTP로 처리합니다. 새 계정의 키는 *진짜이며*(민팅한 출구와 다른 출구에서 제공자의 자체 호스트에 `GET /v1/models` **200**), *지출이 제한됩니다*: `orcarouter/free`는 `402 allowance used up`, `orcarouter/fusion-mini`는 `402 out of credits`, `deepseek/deepseek-v4-flash-free`는 `429 free_rate_limited … link a GitHub account`를 반환합니다. 키 하나당 계정 하나, 원하는 만큼 N개.

## 🎁 무료 티어 — 얼마나 받을 수 있나

**새 OrcaRouter 계정의 키는 인증됩니다; 추론을 위해서는 계정에 자금이 있거나, `-free` 티어의 경우 워크스페이스 소유자가 오래된 GitHub 계정과 연결되어 있어야 합니다.**

| 항목 | 측정값 (계정 5개, 2026-10-15) |
| --- | --- |
| 민팅 시점의 키 인증 | `GET https://api.orcarouter.ai/v1/models` **200** — 208개 모델, 모든 키 기록됨 |
| 새 계정의 청구 | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — 사용량 조회 작동 |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| 추론을 활성화하는 방법 | 크레딧 추가, 또는 워크스페이스 소유자를 오래된 GitHub 계정과 연결 (`retryable:false` — 속도 제한이 아님) |
| 확장되는 단위 | **계정 하나 = 키 하나** → `--count N`은 사실상 "N개의 워크스페이스, 각각 자체 허용량" |

> 💡 무료 티어는 OrcaRouter가 정하며 변경될 수 있습니다. 실시간 수치는 [www.orcarouter.ai](https://www.orcarouter.ai)에서 확인하세요 — 그리고 도구 자체의 게이트가 판단하도록 하세요:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 모델 — 208개 전부

`GET https://api.orcarouter.ai/v1/models`는 민팅된 키에 대해 **208개의 모델 id**를 반환합니다. 예를 들어:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| 모델 패턴 | 새 키에서의 측정 결과 |
| --- | --- |
| `orcarouter/free` | **402** 허용량 소진 |
| `orcarouter/fusion-mini` | **402** 크레딧 부족 (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — GitHub 연결 소유자 필요 |
| `google/gemini-2.5-flash` | **402** 크레딧 부족 |

인증 조회(`/v1/dashboard/billing/usage`)는 모든 새 키에 대해 **200**을 반환합니다 — 게이트는 *지출*에 걸려 있지, 키에 걸려 있지 않습니다.

## 🧪 API 사용 방법

베이스 URL은 **`https://api.orcarouter.ai/v1`** 입니다 — OpenAI 호환이므로 OpenAI를 지원하는 모든 것(SDK, Cursor, OpenCode, Kilo Code, …)이 작동합니다.

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

새 (자금이 없는) 계정에서는 첫 호출이 `402`를 반환하고 `-free` 모델은 `429 free_rate_limited`를 반환합니다 — 키는 정상이며, 계정의 크레딧/GitHub 연결이 게이트입니다.

## 🛠 빠른 시작

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

도구가 기록하는 모든 것은 **코드 옆에** 저장됩니다: `src/keys.txt`, `src/accounts.json`, `src/out/` — 그리고 도구가 읽는 카탈로그는 `src/models.json`입니다. 풀은 `src/proxies.txt`가 존재할 때 그곳에서 읽습니다 — 없으면 도구는 직접 연결합니다. 키는 검증되는 즉시 추가되며, 각 시도의 기록은 `out/mint-<ts>/{summary.json,yield.tsv}`에 저장됩니다.

### 🖱️ 런처

```bash
node src/launcher.js
```

**mint · verify · 9Router** 위에 놓인 메뉴입니다: `count`(실행당 키 수, 기본 5)와 `concurrency`(병렬 레인)를 묻고, 이를 `launcher.config.json`에 저장하며, 올바른 플래그로 `node src/cli.js <task>`를 실행합니다. 메뉴 항목 **4**는 키를 9Router에 등록합니다.

> **Cloudflare가 이미지 챌린지를 표시하면**, 솔버는 해당 라운드를 `out/spool/round-N.png`에 `state.json`과 함께 덤프하고 대기합니다. `out/spool/clicks.json`을 작성하세요 — `{"tiles":[2,5],"verify":true}`로 응답하거나, 새 이미지를 위해 `{"refresh":true}`를 작성하세요. 대부분의 실행에서는 이것이 필요하지 않습니다; Turnstile은 보통 클릭만으로 완료됩니다.

## ✅ 검증됨 — 모든 키가 테스트됩니다

측정일 **2026-10-15**: **키 검증됨**(다섯 번째는 공개된 빌드로 처음부터 끝까지 민팅됨). 모든 키는 존재한 후에 검사되었습니다.

| 모델 | 실시간 (모델) | 실제 채팅 호출 | 측정일 |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208개 모델 | **402** 허용량 소진 | 2026-10-15 |
| `orcarouter/free` | **200** · 208개 모델 | **402** 허용량 소진 | 2026-10-15 |
| `orcarouter/free` | **200** · 208개 모델 | **402** 허용량 소진 | 2026-10-15 |
| `orcarouter/free` | **200** · 208개 모델 | **402** 허용량 소진 | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208개 모델 | **402** 허용량 소진 | 2026-10-15 |

**`GET /v1/models` 200은 키가 *진짜임*을 증명하지만, *지출*할 수 있음을 증명하지는 않습니다.** `src/verify.js`는 나열된 가장 저렴한 경로에서 1토큰 완성을 실행하고 각 단계별로 정확한 상태와 본문을 기록합니다(`accounts.json.verify.spend = {model, status, bodySnippet}`), 따라서 모든 키의 상태는 측정되며 — 결코 추정되지 않습니다.

## 🧭 작동 방식

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| 단계 | 호출 | 비고 |
| --- | --- | --- |
| 마운트 | 번들된 브라우저 솔버 | 여러분의 출구를 통해 `www.orcarouter.ai/register`를 열고 **Turnstile**을 통과합니다; 이미지 챌린지가 나타나면 `out/spool/`에 덤프합니다 (`clicks.json`으로 응답) |
| Turnstile 재사용 | 흐름당 토큰 하나 | 토큰은 계정 라우트에서 `?turnstile=…`로 전달됩니다; 새 마운트 없이 재사용된 토큰은 `Turnstile verification failed`를 반환합니다 |
| 코드 전송 | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; 메일은 **`t0+6.8 s`**에 도착 (`OrcaRouter email verification`) — Mailtrap 받은편지함 `asr7w8bm-…@inbound-mailtrap.io` |
| 등록 | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| 로그인 | `POST /api/user/login?turnstile=<token>` | **200** — 계정 세션 열림 (역시 Turnstile 게이트 적용) |
| 키 | 등록의 **`initial_token`**이 키입니다 | `POST /api/token/`은 이 포크에서 **`403 Security verification is required`**를 반환합니다 — 가입 자체의 키를 보관하세요 |
| 증명 | `GET /v1/models` (자체 호스트, 출구 ≠ 민팅) + 1토큰 완성 | 둘 다 관찰한 출구와 함께 기록됩니다; 지출 판정은 계정의 허용량이며, 키의 유효성이 아닙니다 |

## ⚙️ CLI 옵션

모든 코드는 `src/`에 있습니다 — 저장소 루트에서 `node src/<file>.js`로 실행하세요; 데이터 파일(`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`)은 코드 옆에 있습니다.

| 도구 | 플래그 |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (레인 수 + 페이싱 간격) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (선택; 기본 `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | `keys.txt`의 모든 키를 재검사 — 필수 플래그 없음; 선택적 `proxies.txt` 풀 |
| `src/inbox.js` | 자체 점검: Mailtrap 샌드박스 받은편지함 하나를 생성하고 출력 |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ 프록시 뒤에서

**선택 사항 — 대규모에서는 권장 (IP별 제한, 차단).** 도구는 프록시 없이도 작동합니다.

* 출구는 `src/proxies.txt`(출구당 한 줄, `scheme://host:port`, `user:pass@` 지원) 또는 `mint`의 `--pool FILE`에서 가져옵니다. 동일한 풀이 페이지 로드, API 호출, 솔버 자체의 사전 검사에 공급됩니다.
* **풀이 있을 때:** 모든 요청은 해당 목록의 출구를 통해 나갑니다 — 죽은 출구는 해당 시도를 실패시키고 도구는 다음 출구로 넘어갑니다 (풀이 제공되는 동안 fail-closed).
* **풀이 없을 때:** CLI는 `running WITHOUT a proxy (direct)`를 출력하고 직접 연결합니다 — 페이지 로드, API 호출, 솔버 모두 직접 나갑니다. 가입, 키 민팅, 검증에 관해서는 아무것도 바뀌지 않습니다 — 패킷이 나가는 지점만 바뀝니다.
* 메일은 **Mailtrap**(`api.mailtrap.io`)에서 `MAILTRAP_TOKEN`으로 읽습니다 — 그것은 메일 제공자이며, 대상이 아닙니다. `MAILTRAP_TOKEN`이 없는 클론은 로컬 받은편지함 브로커가 `127.0.0.1:9700`에서 실행 중일 때 그것으로 폴백합니다.
* Chrome은 풀이 주어지면 출구를 프록시로 하여 계정마다 실행되며, 직접 모드에서는 프록시 없이 실행됩니다; 계정 작업이 끝나는 즉시 닫힙니다.
* **패널에서 추가 키를 만들려고 하지 마세요.** `POST /api/token/`은 `403 Security verification is required`를 반환합니다; 가입에서 받은 `initial_token`을 보관하세요.

## 📄 파일

| 경로 | 내용 |
| --- | --- |
| `src/keys.txt` | 실시간 검증된 키 한 줄에 하나 — git-ignored |
| `src/accounts.json` | 사용자 이름, 메일박스, 출구, 두 가지 판정 — git-ignored |
| `src/models.json` | 민팅된 키가 응답한 `GET /v1/models` — git-ignored |
| `src/proxies.txt` | 여러분의 출구, 한 줄에 하나 — git-ignored |
| `src/out/mint-<ts>/` | 시도별 산출물: `summary.json`, `yield.tsv`, 시도별 로그 — git-ignored |
| `src/out/spool/` | 이미지 챌린지 덤프 (`round-N.png` + `state.json`); `clicks.json`으로 응답 |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | CLI가 디스패치하는 엔진들 |
| `src/connect-9router.js` | 키를 9Router 연결로 등록 |

## 🔌 9Router에 연결

[9Router](https://9router.com)는 자체 호스팅, OpenAI 호환 라우터입니다. OrcaRouter는 OpenAI 호환이므로, 한 번 등록하고 모든 키를 사용하세요:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

각 실행은 하나의 키를 `orcarouter` 제공자 노드의 연결로 등록합니다; 다음 키로 다시 호출하면 다른 연결이 추가됩니다 (`--model <id>`가 기본값을 재정의). 그런 다음 9Router 내에서 모델을 선택하세요:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

기본값: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, 기본 모델 `orcarouter/free`.

## 🔑 키 하나로 얻는 것

| | |
| --- | --- |
| 🏢 제공자 | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 제공자가 주는 것 | 208개 모델 나열 (orcarouter/free, fusion, deepseek-v4-flash) — 키는 인증됨, 추론은 지출 게이트 적용 |
| 🔑 키 하나로 얻는 것 | 자체 계정에 범위가 지정된 API 키 하나: 아래 엔드포인트의 208개 모델 id, 여러분의 플랜 한도 내에서. 할당량은 **계정**에 있으므로, 이 도구가 키당 계정 하나를 만드는 것입니다 |
| 🌐 API 형태 | OpenAI 호환: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 여러분의 데이터 | www.orcarouter.ai와 여러분이 구성한 받은편지함 백엔드만 접촉됩니다; 키는 여러분의 컴퓨터에 남습니다 |

## 🐞 이슈

실패한 단계와 시도 로그 꼬리(`src/out/mint-<ts>/attempt-N.log`)를 포함하여 이슈를 열어주세요 — 여기에는 출구, 타이밍, 정확한 서버 응답이 담겨 있어 실패를 재현하는 데 필요한 모든 것이 있습니다. 절대 키를 첨부하지 마세요. **[이슈 열기](../../issues)** 그리고 PR을 환영합니다.

## 📄 라이선스

MIT © 2026 — [LICENSE](LICENSE) 참조.

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>