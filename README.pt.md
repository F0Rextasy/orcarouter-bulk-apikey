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

**Crie contas OrcaRouter (orcarouter.ai) em massa com chaves de API geradas automaticamente — inferência compatível com OpenAI (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Início rápido](#-quick-start) · [🎁 Camada gratuita](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-208-of-them) · [🧪 Use a API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Como funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opções](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por que isto existe

O OrcaRouter (`api.orcarouter.ai`) lista **208 modelos** e envolve o cadastro em **Cloudflare Turnstile** — um solucionador de navegador embutido abre a página através da sua saída, passa o desafio, e a ferramenta conduz o resto via HTTP simples. As chaves de uma conta nova são *autênticas* (`GET /v1/models` **200** no host do próprio provedor a partir de uma saída diferente da que fez a criação) e *limitadas por gasto*: `orcarouter/free` responde `402 allowance used up`, `orcarouter/fusion-mini` responde `402 out of credits`, e `deepseek/deepseek-v4-flash-free` responde `429 free_rate_limited … link a GitHub account`. Uma conta por chave, qualquer N.

## 🎁 Camada gratuita — quanto você recebe

**A chave de uma conta OrcaRouter nova autentica; a inferência precisa que a conta esteja financiada ou, para a camada `-free`, que o proprietário do workspace esteja vinculado a uma conta GitHub estabelecida.**

| Item | Medido (5 contas, 2026-10-15) |
| --- | --- |
| Chave autêntica no momento da criação | `GET https://api.orcarouter.ai/v1/models` **200** — 208 modelos, toda chave gravada |
| Faturamento em uma conta nova | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — leituras de uso funcionam |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| O que desbloqueia a inferência | adicionar créditos, ou vincular o proprietário do workspace a uma conta GitHub estabelecida (`retryable:false` — não é um limite de taxa) |
| A unidade que escala | **uma conta = uma chave** → `--count N` é na verdade "N workspaces, cada um com sua própria cota" |

> 💡 A camada gratuita é definida pelo OrcaRouter e pode mudar. Confira os números ao vivo em [www.orcarouter.ai](https://www.orcarouter.ai) — e deixe o próprio gate da ferramenta decidir:

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Modelos — todos os 208

`GET https://api.orcarouter.ai/v1/models` retorna **208 ids de modelos** para uma chave criada, por exemplo:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Padrão de modelo | Resultado medido em uma chave nova |
| --- | --- |
| `orcarouter/free` | **402** allowance used up |
| `orcarouter/fusion-mini` | **402** out of credits (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — precisa de um proprietário vinculado ao GitHub |
| `google/gemini-2.5-flash` | **402** out of credits |

Leituras de autenticação (`/v1/dashboard/billing/usage`) respondem **200** para toda chave nova — o gate está no *gasto*, não na chave.

## 🧪 Como usar a API

A URL base é **`https://api.orcarouter.ai/v1`** — compatível com OpenAI, então qualquer coisa que fale OpenAI funciona (SDKs, Cursor, OpenCode, Kilo Code, …).

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

Em uma conta nova (não financiada) a primeira chamada responde `402` e o modelo `-free` responde `429 free_rate_limited` — a chave é boa, a vinculação de crédito/GitHub da conta é o gate.

## 🛠 Início rápido

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

Tudo o que as ferramentas gravam fica **ao lado do código**: `src/keys.txt`, `src/accounts.json`, `src/out/` — e o catálogo que elas leem é `src/models.json`. O pool é lido de `src/proxies.txt` quando existe — sem um, as ferramentas conectam diretamente. As chaves são anexadas no momento em que verificam; o registro de cada tentativa fica em `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ O launcher

```bash
node src/launcher.js
```

Um menu sobre **mint · verify · 9Router**: ele pergunta `count` (chaves por execução, padrão 5) e `concurrency` (faixas paralelas), mantém-nos em `launcher.config.json`, e dispara `node src/cli.js <task>` com as flags certas. O item de menu **4** registra uma chave no 9Router.

> **Se o Cloudflare mostrar um desafio de imagem**, o solucionador despeja a rodada em `out/spool/round-N.png` com um `state.json` e espera. Escreva `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` para responder, ou `{"refresh":true}` para uma nova imagem. A maioria das execuções nunca precisa disso; o Turnstile geralmente completa só com o clique.

## ✅ Verificado funcionando — toda chave é testada

Medido em **2026-10-15**: **chaves verificadas** (a quinta foi criada de ponta a ponta pela build publicada). Toda chave foi verificada depois de existir.

| Modelo | Ao vivo (models) | Chamada de chat real | Medido |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 models | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 models | **402** allowance used up | 2026-10-15 |

**`GET /v1/models` 200 prova que uma chave é *autêntica*; não prova que ela pode *gastar*.** `src/verify.js` executa uma conclusão de 1 token no caminho listado mais barato e registra o status e o corpo exatos por degrau (`accounts.json.verify.spend = {model, status, bodySnippet}`), então o estado de cada chave é medido — nunca implícito.

## 🧭 Como funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Etapa | Chamada | Notas |
| --- | --- | --- |
| Montagem | solucionador de navegador embutido | abre `www.orcarouter.ai/register` através da sua saída, passa o **Turnstile**; despeja em `out/spool/` se aparecer um desafio de imagem (responda com `clicks.json`) |
| Reuso do Turnstile | um token por fluxo | o token é passado como `?turnstile=…` nas rotas da conta; um token reutilizado sem uma montagem nova responde `Turnstile verification failed` |
| Enviar código | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; o e-mail chega em **`t0+6.8 s`** (`OrcaRouter email verification`) — caixa de entrada Mailtrap `asr7w8bm-…@inbound-mailtrap.io` |
| Registrar | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Login | `POST /api/user/login?turnstile=<token>` | **200** — sessão da conta aberta (também protegido por Turnstile) |
| Chave | o **`initial_token`** do registro é a chave | `POST /api/token/` responde **`403 Security verification is required`** neste fork — a chave do próprio cadastro é a que deve ser mantida |
| Provar | `GET /v1/models` (host próprio, saída ≠ criação) + conclusão de 1 token | ambos registrados com a saída observadora; o veredito de gasto é a cota da conta, não a validade da chave |

## ⚙️ Opções da CLI

Todo o código fica em `src/` — execute a partir da raiz do repositório como `node src/<file>.js`; os arquivos de dados (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) ficam ao lado do código.

| Ferramenta | Flags |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (número de faixas + intervalo de ritmo) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (opcional; padrão `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | reverifica toda chave em `keys.txt` — sem flags obrigatórias; pool opcional em `proxies.txt` |
| `src/inbox.js` | autoverificação: cria uma caixa de entrada sandbox Mailtrap e a imprime |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ Atrás de um proxy

**Opcional — recomendado em escala (limites por IP, banimentos).** A ferramenta funciona sem proxy também.

* As saídas vêm de `src/proxies.txt` (uma linha por saída, `scheme://host:port`, `user:pass@` suportado) ou `--pool FILE` no `mint`. O mesmo pool alimenta os carregamentos de página, as chamadas de API e as próprias pré-verificações do solucionador.
* **Com um pool:** toda requisição passa por uma saída dessa lista — uma saída morta falha aquela tentativa e a ferramenta passa para a próxima (fail-closed enquanto um pool for fornecido).
* **Sem um pool:** a CLI imprime `running WITHOUT a proxy (direct)` e conecta diretamente — carregamentos de página, chamadas de API e o solucionador vão todos direto. Nada sobre cadastro, criação de chave ou verificação muda — apenas de onde os pacotes saem.
* O e-mail é lido do **Mailtrap** (`api.mailtrap.io`) com seu `MAILTRAP_TOKEN` — esse é o provedor de e-mail, não o alvo. Um clone sem `MAILTRAP_TOKEN` recorre a um broker de caixa de entrada local em `127.0.0.1:9700` quando um estiver em execução.
* O Chrome é iniciado por conta com a saída como seu proxy quando um pool é fornecido, e sem proxy algum no modo direto; ele é fechado assim que a conta termina.
* **Não tente criar uma chave extra no painel.** `POST /api/token/` responde `403 Security verification is required`; mantenha o `initial_token` do cadastro.

## 📄 Arquivos

| Caminho | Conteúdo |
| --- | --- |
| `src/keys.txt` | uma chave verificada ao vivo por linha — ignorado pelo git |
| `src/accounts.json` | nome de usuário, caixa de correio, saídas, ambos os vereditos — ignorado pelo git |
| `src/models.json` | `GET /v1/models` conforme respondido por uma chave criada — ignorado pelo git |
| `src/proxies.txt` | suas saídas, uma por linha — ignorado pelo git |
| `src/out/mint-<ts>/` | rendimento por tentativa: `summary.json`, `yield.tsv`, logs por tentativa — ignorado pelo git |
| `src/out/spool/` | despejos de desafio de imagem (`round-N.png` + `state.json`); responda com `clicks.json` |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | os motores para os quais a CLI despacha |
| `src/connect-9router.js` | registra as chaves como conexões do 9Router |

## 🔌 Conectar ao 9Router

O [9Router](https://9router.com) é um roteador auto-hospedado e compatível com OpenAI. O OrcaRouter é compatível com OpenAI, então registre-o uma vez e use todas as chaves:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Cada execução registra uma chave como uma conexão do nó provedor `orcarouter`; chame novamente com a próxima chave para adicionar outra (`--model <id>` substitui o padrão). Depois escolha um modelo dentro do 9Router:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Padrões: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, modelo padrão `orcarouter/free`.

## 🔑 O que uma chave te dá

| | |
| --- | --- |
| 🏢 Provedor | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 O que o provedor dá | 208 modelos listados (orcarouter/free, fusion, deepseek-v4-flash) — chaves autênticas, inferência limitada por gasto |
| 🔑 O que uma chave te dá | uma chave de API limitada à sua própria conta: os 208 ids de modelos no endpoint abaixo, nos limites do seu plano. A cota fica na **conta**, que é exatamente por isso que esta ferramenta cria uma conta por chave |
| 🌐 Formato da API | Compatível com OpenAI: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Seus dados | apenas www.orcarouter.ai e o backend de caixa de entrada que você configurar são contatados; as chaves ficam na sua máquina |

## 🐞 Problemas

Abra uma issue com a etapa que falhou e o final do log da tentativa (`src/out/mint-<ts>/attempt-N.log`) — ele carrega a saída, o timing e a resposta exata do servidor, que é tudo o que é necessário para reproduzir uma falha. Nunca anexe uma chave. **[Abra uma issue](../../issues)** e PRs são bem-vindos.

## 📄 Licença

MIT © 2026 — veja [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>