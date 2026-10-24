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

**Массовое создание аккаунтов OrcaRouter (orcarouter.ai) с автоматически сгенерированными API-ключами — инференс, совместимый с OpenAI (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + коннектор 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Быстрый старт](#-quick-start) · [🎁 Бесплатный тариф](#-free-tier--how-much-you-get) · [🤖 Модели](#-models--all-208-of-them) · [🧪 Использование API](#-how-to-use-the-api) · [✅ Проверено](#-verified-working--every-key-is-tested) · [🧭 Как это работает](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Опции](#️-cli-options) · [🛰️ Прокси](#️-behind-a-proxy) · [🐞 Проблемы](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Зачем это нужно

OrcaRouter (`api.orcarouter.ai`) предлагает **208 моделей** и оборачивает регистрацию в **Cloudflare Turnstile** — встроенный браузерный решатель открывает страницу через ваш выходной узел, проходит проверку, а остальное инструмент выполняет по обычному HTTP. Ключи свежего аккаунта *подлинны* (`GET /v1/models` **200** на собственном хосте провайдера с выходного узла, отличного от узла создания) и *ограничены по расходам*: `orcarouter/free` отвечает `402 allowance used up`, `orcarouter/fusion-mini` отвечает `402 out of credits`, а `deepseek/deepseek-v4-flash-free` отвечает `429 free_rate_limited … link a GitHub account`. Один аккаунт на ключ, любое N.

## 🎁 Бесплатный тариф — сколько вы получаете

**Ключ свежего аккаунта OrcaRouter аутентифицируется; для инференса требуется пополненный аккаунт или, для тарифа `-free`, владелец рабочего пространства, привязанный к давно существующему аккаунту GitHub.**

| Пункт | Измерено (5 аккаунтов, 2026-10-15) |
| --- | --- |
| Ключ аутентичен в момент создания | `GET https://api.orcarouter.ai/v1/models` **200** — 208 моделей, каждый ключ записан |
| Биллинг на свежем аккаунте | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — чтение использования работает |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| Что открывает инференс | добавьте кредиты или привяжите владельца рабочего пространства к давно существующему аккаунту GitHub (`retryable:false` — это не ограничение скорости) |
| Единица масштабирования | **один аккаунт = один ключ** → `--count N` на самом деле означает «N рабочих пространств, каждое со своей квотой» |

> 💡 Бесплатный тариф устанавливается OrcaRouter и может меняться. Проверяйте актуальные цифры на [www.orcarouter.ai](https://www.orcarouter.ai) — и пусть собственный гейт инструмента решает:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Модели — все 208 из них

`GET https://api.orcarouter.ai/v1/models` возвращает **208 идентификаторов моделей** для созданного ключа, например:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Шаблон модели | Измеренный результат на свежем ключе |
| --- | --- |
| `orcarouter/free` | **402** квота исчерпана |
| `orcarouter/fusion-mini` | **402** кредиты закончились (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — требуется владелец, привязанный к GitHub |
| `google/gemini-2.5-flash` | **402** кредиты закончились |

Запросы аутентификации (`/v1/dashboard/billing/usage`) отвечают **200** для каждого свежего ключа — гейт стоит на *расходах*, а не на валидности ключа.

## 🧪 Как использовать API

Базовый URL — **`https://api.orcarouter.ai/v1`** — совместим с OpenAI, поэтому работает всё, что говорит на языке OpenAI (SDK, Cursor, OpenCode, Kilo Code, …).

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

На свежем (непополненном) аккаунте первый вызов отвечает `402`, а модель `-free` отвечает `429 free_rate_limited` — ключ хорош, гейтом является кредит аккаунта / привязка к GitHub.

## 🛠 Быстрый старт

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

Всё, что записывают инструменты, оказывается **рядом с кодом**: `src/keys.txt`, `src/accounts.json`, `src/out/` — а каталог, который они читают, — это `src/models.json`. Пул читается из `src/proxies.txt`, когда он существует — без него инструменты подключаются напрямую. Ключи добавляются в момент их проверки; запись каждой попытки попадает в `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ Лаунчер

```bash
node src/launcher.js
```

Меню поверх **mint · verify · 9Router**: оно запрашивает `count` (ключей за запуск, по умолчанию 5) и `concurrency` (параллельные линии), хранит их в `launcher.config.json` и запускает `node src/cli.js <task>` с нужными флагами. Пункт меню **4** регистрирует ключ в 9Router.

> **Если Cloudflare показывает графическую проверку**, решатель сохраняет раунд в `out/spool/round-N.png` вместе с `state.json` и ждёт. Запишите `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` для ответа или `{"refresh":true}` для нового изображения. В большинстве запусков это не требуется; Turnstile обычно проходит от одного клика.

## ✅ Проверено в работе — каждый ключ протестирован

Измерено **2026-10-15**: **ключей проверено** (пятый был создан от начала до конца опубликованной сборкой). Каждый ключ был проверен после его появления.

| Модель | Вживую (models) | Реальный чат-вызов | Измерено |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 моделей | **402** квота исчерпана | 2026-10-15 |
| `orcarouter/free` | **200** · 208 моделей | **402** квота исчерпана | 2026-10-15 |
| `orcarouter/free` | **200** · 208 моделей | **402** квота исчерпана | 2026-10-15 |
| `orcarouter/free` | **200** · 208 моделей | **402** квота исчерпана | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 моделей | **402** квота исчерпана | 2026-10-15 |

**`GET /v1/models` 200 доказывает, что ключ *подлинный*; это не доказывает, что он может *тратить*.** `src/verify.js` выполняет завершение на 1 токен по самому дешёвому из перечисленных путей и записывает точный статус и тело для каждой ступени (`accounts.json.verify.spend = {model, status, bodySnippet}`), так что состояние каждого ключа измеряется — а не подразумевается.

## 🧭 Как это работает

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Шаг | Вызов | Примечания |
| --- | --- | --- |
| Монтирование | встроенный браузерный решатель | открывает `www.orcarouter.ai/register` через ваш выходной узел, проходит **Turnstile**; сохраняет в `out/spool/`, если появляется графическая проверка (отвечайте через `clicks.json`) |
| Повторное использование Turnstile | один токен на поток | токен передаётся как `?turnstile=…` в маршрутах аккаунта; повторно использованный токен без свежего монтирования отвечает `Turnstile verification failed` |
| Отправка кода | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; письмо приходит через **`t0+6.8 s`** (`OrcaRouter email verification`) — почтовый ящик Mailtrap `asr7w8bm-…@inbound-mailtrap.io` |
| Регистрация | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Вход | `POST /api/user/login?turnstile=<token>` | **200** — сессия аккаунта открыта (также защищено Turnstile) |
| Ключ | **`initial_token`** из регистрации — это и есть ключ | `POST /api/token/` отвечает **`403 Security verification is required`** на этом форке — ключ, созданный при регистрации, и есть тот, который нужно сохранить |
| Доказательство | `GET /v1/models` (собственный хост, выходной узел ≠ узел создания) + завершение на 1 токен | оба записываются с наблюдающим выходным узлом; вердикт о расходах — это квота аккаунта, а не валидность ключа |

## ⚙️ Опции CLI

Весь код находится в `src/` — запускайте его из корня репозитория как `node src/<file>.js`; файлы данных (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) лежат рядом с кодом.

| Инструмент | Флаги |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (число линий + интервал темпа) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (необязательно; по умолчанию `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | повторно проверяет каждый ключ в `keys.txt` — обязательных флагов нет; необязательный пул `proxies.txt` |
| `src/inbox.js` | самопроверка: создаёт один почтовый ящик Mailtrap sandbox и выводит его |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ За прокси

**Необязательно — рекомендуется при масштабировании (лимиты на IP, баны).** Инструмент работает и без прокси.

* Выходные узлы берутся из `src/proxies.txt` (одна строка на узел, `scheme://host:port`, поддерживается `user:pass@`) или из `--pool FILE` в `mint`. Один и тот же пул питает загрузку страниц, вызовы API и собственные предварительные проверки решателя.
* **С пулом:** каждый запрос идёт через выходной узел из этого списка — мёртвый узел проваливает эту попытку, и инструмент переходит к следующему (fail-closed, пока пул предоставлен).
* **Без пула:** CLI выводит `running WITHOUT a proxy (direct)` и подключается напрямую — загрузка страниц, вызовы API и решатель идут напрямую. В регистрации, создании ключей или проверке ничего не меняется — только то, откуда уходят пакеты.
* Почта читается из **Mailtrap** (`api.mailtrap.io`) с вашим `MAILTRAP_TOKEN` — это почтовый провайдер, а не цель. Клон без `MAILTRAP_TOKEN` переключается на локальный почтовый брокер на `127.0.0.1:9700`, если он запущен.
* Chrome запускается для каждого аккаунта с выходным узлом в качестве прокси, когда задан пул, и вообще без прокси в прямом режиме; он закрывается, как только аккаунт готов.
* **Не пытайтесь создать дополнительный ключ в панели.** `POST /api/token/` отвечает `403 Security verification is required`; сохраняйте `initial_token` из регистрации.

## 📄 Файлы

| Путь | Содержимое |
| --- | --- |
| `src/keys.txt` | один проверенный вживую ключ на строку — игнорируется git |
| `src/accounts.json` | имя пользователя, почтовый ящик, выходные узлы, оба вердикта — игнорируется git |
| `src/models.json` | `GET /v1/models` в том виде, в каком ответил созданный ключ — игнорируется git |
| `src/proxies.txt` | ваши выходные узлы, по одному на строку — игнорируется git |
| `src/out/mint-<ts>/` | результат каждой попытки: `summary.json`, `yield.tsv`, логи попыток — игнорируется git |
| `src/out/spool/` | дампы графических проверок (`round-N.png` + `state.json`); отвечайте через `clicks.json` |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | движки, к которым обращается CLI |
| `src/connect-9router.js` | регистрирует ключи как подключения 9Router |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) — это самостоятельно размещаемый роутер, совместимый с OpenAI. OrcaRouter совместим с OpenAI, поэтому зарегистрируйте его один раз и используйте каждый ключ:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Каждый запуск регистрирует один ключ как подключение узла провайдера `orcarouter`; вызовите его снова со следующим ключом, чтобы добавить ещё один (`--model <id>` переопределяет значение по умолчанию). Затем выберите модель внутри 9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Значения по умолчанию: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, модель по умолчанию `orcarouter/free`.

## 🔑 Что даёт один ключ

| | |
| --- | --- |
| 🏢 Провайдер | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 Что даёт провайдер | 208 перечисленных моделей (orcarouter/free, fusion, deepseek-v4-flash) — ключи подлинны, инференс ограничен расходами |
| 🔑 Что даёт один ключ | один API-ключ, привязанный к своему аккаунту: 208 идентификаторов моделей на указанном ниже эндпоинте, в пределах лимитов вашего тарифа. Квота живёт на **аккаунте**, и именно поэтому этот инструмент создаёт один аккаунт на ключ |
| 🌐 Форма API | Совместим с OpenAI: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Ваши данные | связь только с www.orcarouter.ai и настроенным вами почтовым бэкендом; ключи остаются на вашей машине |

## 🐞 Проблемы

Откройте issue с указанием неудавшегося шага и хвоста лога попытки (`src/out/mint-<ts>/attempt-N.log`) — в нём есть выходной узел, тайминги и точный ответ сервера, то есть всё необходимое для воспроизведения сбоя. Никогда не прикрепляйте ключ. **[Открыть issue](../../issues)** — и PR приветствуются.

## 📄 Лицензия

MIT © 2026 — см. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>