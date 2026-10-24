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

**Crea cuentas de OrcaRouter (orcarouter.ai) en masa con claves API autogeneradas — inferencia compatible con OpenAI (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Nivel gratuito](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-208-of-them) · [🧪 Usar la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por qué existe esto

OrcaRouter (`api.orcarouter.ai`) lista **208 modelos** y envuelve el registro en **Cloudflare Turnstile** — un solucionador de navegador integrado abre la página a través de tu salida, supera el desafío, y la herramienta controla el resto mediante HTTP simple. Las claves de una cuenta nueva son *auténticas* (`GET /v1/models` **200** en el propio host del proveedor desde una salida distinta a la de creación) y *limitadas por gasto*: `orcarouter/free` responde `402 allowance used up`, `orcarouter/fusion-mini` responde `402 out of credits`, y `deepseek/deepseek-v4-flash-free` responde `429 free_rate_limited … link a GitHub account`. Una cuenta por clave, cualquier N.

## 🎁 Nivel gratuito — cuánto obtienes

**La clave de una cuenta nueva de OrcaRouter se autentica; la inferencia requiere que la cuenta esté financiada o, para el nivel `-free`, que el propietario del espacio de trabajo esté vinculado a una cuenta de GitHub establecida.**

| Elemento | Medido (5 cuentas, 2026-10-15) |
| --- | --- |
| Clave auténtica en el momento de creación | `GET https://api.orcarouter.ai/v1/models` **200** — 208 modelos, cada clave escrita |
| Facturación en una cuenta nueva | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — las lecturas de uso funcionan |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| Qué desbloquea la inferencia | añadir créditos, o vincular el propietario del espacio de trabajo a una cuenta de GitHub establecida (`retryable:false` — no es un límite de velocidad) |
| La unidad que escala | **una cuenta = una clave** → `--count N` es realmente "N espacios de trabajo, cada uno con su propia asignación" |

> 💡 El nivel gratuito lo define OrcaRouter y puede cambiar. Consulta los números en vivo en [www.orcarouter.ai](https://www.orcarouter.ai) — y deja que la propia puerta de la herramienta decida:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Modelos — los 208

`GET https://api.orcarouter.ai/v1/models` devuelve **208 ids de modelo** para una clave creada, por ejemplo:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Patrón de modelo | Resultado medido en una clave nueva |
| --- | --- |
| `orcarouter/free` | **402** asignación agotada |
| `orcarouter/fusion-mini` | **402** sin créditos (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — requiere un propietario vinculado a GitHub |
| `google/gemini-2.5-flash` | **402** sin créditos |

Las lecturas de autenticación (`/v1/dashboard/billing/usage`) responden **200** para cada clave nueva — la puerta está en el *gasto*, no en la clave.

## 🧪 Cómo usar la API

La URL base es **`https://api.orcarouter.ai/v1`** — compatible con OpenAI, así que cualquier cosa que hable OpenAI funciona (SDKs, Cursor, OpenCode, Kilo Code, …).

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

En una cuenta nueva (sin fondos) la primera llamada responde `402` y el modelo `-free` responde `429 free_rate_limited` — la clave es buena, la vinculación de crédito/GitHub de la cuenta es la puerta.

## 🛠 Inicio rápido

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

Todo lo que escriben las herramientas queda **junto al código**: `src/keys.txt`, `src/accounts.json`, `src/out/` — y el catálogo que leen es `src/models.json`. El grupo se lee desde `src/proxies.txt` cuando existe — sin uno, las herramientas se conectan directamente. Las claves se añaden en el momento en que se verifican; el registro de cada intento queda en `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ El lanzador

```bash
node src/launcher.js
```

Un menú sobre **mint · verify · 9Router**: pregunta por `count` (claves por ejecución, por defecto 5) y `concurrency` (carriles paralelos), los guarda en `launcher.config.json`, y lanza `node src/cli.js <task>` con las banderas correctas. El elemento de menú **4** registra una clave con 9Router.

> **Si Cloudflare muestra un desafío de imagen**, el solucionador vuelca la ronda a `out/spool/round-N.png` con un `state.json` y espera. Escribe `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` para responder, o `{"refresh":true}` para una nueva imagen. La mayoría de las ejecuciones nunca necesitan esto; Turnstile normalmente se completa con el solo clic.

## ✅ Verificado funcionando — cada clave se prueba

Medido el **2026-10-15**: **claves verificadas** (la quinta fue creada de principio a fin por la compilación publicada). Cada clave se comprobó después de existir.

| Modelo | En vivo (modelos) | Llamada de chat real | Medido |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 modelos | **402** asignación agotada | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modelos | **402** asignación agotada | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modelos | **402** asignación agotada | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modelos | **402** asignación agotada | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 modelos | **402** asignación agotada | 2026-10-15 |

**`GET /v1/models` 200 prueba que una clave es *auténtica*; no prueba que pueda *gastar*.** `src/verify.js` ejecuta una finalización de 1 token en la ruta listada más barata y registra el estado exacto y el cuerpo por nivel (`accounts.json.verify.spend = {model, status, bodySnippet}`), así el estado de cada clave se mide — nunca se implica.

## 🧭 Cómo funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Paso | Llamada | Notas |
| --- | --- | --- |
| Montaje | solucionador de navegador integrado | abre `www.orcarouter.ai/register` a través de tu salida, supera **Turnstile**; vuelca a `out/spool/` si aparece un desafío de imagen (responde con `clicks.json`) |
| Reutilización de Turnstile | un token por flujo | el token se pasa como `?turnstile=…` en las rutas de la cuenta; un token reutilizado sin un montaje nuevo responde `Turnstile verification failed` |
| Enviar código | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; el correo llega en **`t0+6.8 s`** (`OrcaRouter email verification`) — bandeja de Mailtrap `asr7w8bm-…@inbound-mailtrap.io` |
| Registro | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Inicio de sesión | `POST /api/user/login?turnstile=<token>` | **200** — sesión de cuenta abierta (también protegida por Turnstile) |
| Clave | el **`initial_token`** del registro es la clave | `POST /api/token/` responde **`403 Security verification is required`** en este fork — la clave propia del registro es la que hay que conservar |
| Probar | `GET /v1/models` (host propio, salida ≠ creación) + finalización de 1 token | ambos registrados con la salida observadora; el veredicto de gasto es la asignación de la cuenta, no la validez de la clave |

## ⚙️ Opciones de CLI

Todo el código vive en `src/` — ejecútalo desde la raíz del repositorio como `node src/<file>.js`; los archivos de datos (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) están junto al código.

| Herramienta | Banderas |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (número de carriles + intervalo de ritmo) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (opcional; por defecto `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | vuelve a comprobar cada clave en `keys.txt` — sin banderas obligatorias; grupo opcional `proxies.txt` |
| `src/inbox.js` | autocomprobación: crea una bandeja de pruebas de Mailtrap y la imprime |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ Detrás de un proxy

**Opcional — recomendado a escala (límites por IP, baneos).** La herramienta también funciona sin proxy.

* Las salidas provienen de `src/proxies.txt` (una línea por salida, `scheme://host:port`, `user:pass@` compatible) o `--pool FILE` en `mint`. El mismo grupo alimenta las cargas de página, las llamadas a la API y las propias comprobaciones previas del solucionador.
* **Con un grupo:** cada solicitud pasa por una salida de esa lista — una salida muerta falla ese intento y la herramienta pasa a la siguiente (fail-closed mientras se proporciona un grupo).
* **Sin un grupo:** la CLI imprime `running WITHOUT a proxy (direct)` y se conecta directamente — las cargas de página, las llamadas a la API y el solucionador van todos directos. Nada sobre el registro, la creación de claves o la verificación cambia — solo desde dónde salen los paquetes.
* El correo se lee desde **Mailtrap** (`api.mailtrap.io`) con tu `MAILTRAP_TOKEN` — ese es el proveedor de correo, no el objetivo. Un clon sin `MAILTRAP_TOKEN` recurre a un broker de bandeja local en `127.0.0.1:9700` cuando hay uno en ejecución.
* Chrome se lanza por cuenta con la salida como su proxy cuando se proporciona un grupo, y sin proxy alguno en modo directo; se cierra en cuanto la cuenta termina.
* **No intentes crear una clave adicional en el panel.** `POST /api/token/` responde `403 Security verification is required`; conserva el `initial_token` del registro.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `src/keys.txt` | una clave verificada en vivo por línea — ignorada por git |
| `src/accounts.json` | nombre de usuario, buzón, salidas, ambos veredictos — ignorado por git |
| `src/models.json` | `GET /v1/models` tal como lo responde una clave creada — ignorado por git |
| `src/proxies.txt` | tus salidas, una por línea — ignorado por git |
| `src/out/mint-<ts>/` | rendimiento por intento: `summary.json`, `yield.tsv`, registros por intento — ignorado por git |
| `src/out/spool/` | volcados de desafío de imagen (`round-N.png` + `state.json`); responde con `clicks.json` |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | los motores a los que despacha la CLI |
| `src/connect-9router.js` | registra las claves como conexiones de 9Router |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) es un enrutador autoalojado y compatible con OpenAI. OrcaRouter es compatible con OpenAI, así que regístralo una vez y usa cada clave:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Cada ejecución registra una clave como conexión del nodo proveedor `orcarouter`; llámalo de nuevo con la siguiente clave para añadir otra (`--model <id>` sobrescribe el predeterminado). Luego elige un modelo dentro de 9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Valores predeterminados: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, modelo predeterminado `orcarouter/free`.

## 🔑 Qué te da una clave

| | |
| --- | --- |
| 🏢 Proveedor | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 Qué da el proveedor | 208 modelos listados (orcarouter/free, fusion, deepseek-v4-flash) — claves auténticas, inferencia limitada por gasto |
| 🔑 Qué te da una clave | una clave API limitada a su propia cuenta: los 208 ids de modelo en el endpoint de abajo, a los límites de tu plan. La cuota vive en la **cuenta**, que es exactamente por lo que esta herramienta crea una cuenta por clave |
| 🌐 Forma de la API | Compatible con OpenAI: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Tus datos | solo se contacta con www.orcarouter.ai y el backend de bandeja que configures; las claves permanecen en tu máquina |

## 🐞 Problemas

Abre un issue con el paso que falla y la cola del registro del intento (`src/out/mint-<ts>/attempt-N.log`) — lleva la salida, el tiempo y la respuesta exacta del servidor, que es todo lo necesario para reproducir un fallo. Nunca adjuntes una clave. **[Abre un issue](../../issues)** y los PRs son bienvenidos.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>