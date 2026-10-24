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

**Création en masse de comptes OrcaRouter (orcarouter.ai) avec clés API générées automatiquement — inférence compatible OpenAI (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + connecteur 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Démarrage rapide](#-quick-start) · [🎁 Niveau gratuit](#-free-tier--how-much-you-get) · [🤖 Modèles](#-models--all-208-of-them) · [🧪 Utiliser l'API](#-how-to-use-the-api) · [✅ Vérifié](#-verified-working--every-key-is-tested) · [🧭 Comment ça marche](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Problèmes](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Pourquoi ce projet existe

OrcaRouter (`api.orcarouter.ai`) liste **208 modèles** et protège l'inscription derrière **Cloudflare Turnstile** — un solveur de navigateur intégré ouvre la page via votre sortie, franchit le défi, et l'outil pilote le reste en HTTP simple. Les clés d'un compte fraîchement créé sont *authentiques* (`GET /v1/models` **200** sur l'hôte du fournisseur depuis une sortie différente de celle de la création) et *soumises à un contrôle de dépenses* : `orcarouter/free` répond `402 allowance used up`, `orcarouter/fusion-mini` répond `402 out of credits`, et `deepseek/deepseek-v4-flash-free` répond `429 free_rate_limited … link a GitHub account`. Un compte par clé, autant que vous voulez.

## 🎁 Niveau gratuit — ce que vous obtenez

**La clé d'un compte OrcaRouter fraîchement créé s'authentifie ; l'inférence nécessite que le compte soit approvisionné ou, pour le niveau `-free`, qu'un propriétaire d'espace de travail soit lié à un compte GitHub établi.**

| Élément | Mesuré (5 comptes, 2026-10-15) |
| --- | --- |
| Clé authentique au moment de la création | `GET https://api.orcarouter.ai/v1/models` **200** — 208 modèles, chaque clé écrite |
| Facturation sur un compte fraîchement créé | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — les lectures d'utilisation fonctionnent |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| Ce qui débloque l'inférence | ajouter des crédits, ou lier le propriétaire de l'espace de travail à un compte GitHub établi (`retryable:false` — ce n'est pas une limite de débit) |
| L'unité qui s'adapte | **un compte = une clé** → `--count N` signifie en réalité « N espaces de travail, chacun avec sa propre allocation » |

> 💡 Le niveau gratuit est défini par OrcaRouter et peut changer. Consultez les chiffres en direct sur [www.orcarouter.ai](https://www.orcarouter.ai) — et laissez le contrôle de l'outil décider :

```bash
node src/cli.js verify                 # every key in keys.txt is re-tested against the live API
```

## 🤖 Modèles — les 208

`GET https://api.orcarouter.ai/v1/models` renvoie **208 identifiants de modèles** pour une clé créée, par exemple :

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Motif de modèle | Résultat mesuré sur une clé fraîchement créée |
| --- | --- |
| `orcarouter/free` | **402** allocation épuisée |
| `orcarouter/fusion-mini` | **402** plus de crédits (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — nécessite un propriétaire lié à GitHub |
| `google/gemini-2.5-flash` | **402** plus de crédits |

Les lectures d'authentification (`/v1/dashboard/billing/usage`) répondent **200** pour chaque clé fraîche — le contrôle porte sur la *dépense*, pas sur la clé.

## 🧪 Comment utiliser l'API

L'URL de base est **`https://api.orcarouter.ai/v1`** — compatible OpenAI, donc tout ce qui parle OpenAI fonctionne (SDK, Cursor, OpenCode, Kilo Code, …).

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

Sur un compte fraîchement créé (non approvisionné), le premier appel répond `402` et le modèle `-free` répond `429 free_rate_limited` — la clé est bonne, c'est le crédit du compte ou sa liaison GitHub qui fait office de contrôle.

## 🛠 Démarrage rapide

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

Tout ce que les outils écrivent se retrouve **à côté du code** : `src/keys.txt`, `src/accounts.json`, `src/out/` — et le catalogue qu'ils lisent est `src/models.json`. Le pool est lu depuis `src/proxies.txt` lorsqu'il existe — sans lui, les outils se connectent directement. Les clés sont ajoutées dès qu'elles sont vérifiées ; l'enregistrement de chaque tentative se trouve dans `out/mint-<ts>/{summary.json,yield.tsv}`.

### 🖱️ Le lanceur

```bash
node src/launcher.js
```

Un menu au-dessus de **mint · verify · 9Router** : il demande `count` (clés par exécution, par défaut 5) et `concurrency` (voies parallèles), les conserve dans `launcher.config.json`, et lance `node src/cli.js <task>` avec les bons drapeaux. L'élément de menu **4** enregistre une clé auprès de 9Router.

> **Si Cloudflare affiche un défi d'image**, le solveur déverse le tour dans `out/spool/round-N.png` avec un `state.json` et attend. Écrivez `out/spool/clicks.json` — `{"tiles":[2,5],"verify":true}` pour répondre, ou `{"refresh":true}` pour une nouvelle image. La plupart des exécutions n'en ont jamais besoin ; Turnstile se termine généralement au simple clic.

## ✅ Vérifié fonctionnel — chaque clé est testée

Mesuré le **2026-10-15** : **clés vérifiées** (la cinquième a été créée de bout en bout par la version publiée). Chaque clé a été contrôlée après son existence.

| Modèle | En direct (modèles) | Appel de chat réel | Mesuré |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 modèles | **402** allocation épuisée | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modèles | **402** allocation épuisée | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modèles | **402** allocation épuisée | 2026-10-15 |
| `orcarouter/free` | **200** · 208 modèles | **402** allocation épuisée | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 modèles | **402** allocation épuisée | 2026-10-15 |

**`GET /v1/models` 200 prouve qu'une clé est *authentique* ; cela ne prouve pas qu'elle peut *dépenser*.** `src/verify.js` exécute une complétion de 1 token sur le chemin le moins cher listé et enregistre le statut et le corps exacts par échelon (`accounts.json.verify.spend = {model, status, bodySnippet}`), de sorte que l'état de chaque clé est mesuré — jamais sous-entendu.

## 🧭 Comment ça marche

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Étape | Appel | Notes |
| --- | --- | --- |
| Montage | solveur de navigateur intégré | ouvre `www.orcarouter.ai/register` via votre sortie, franchit **Turnstile** ; déverse dans `out/spool/` si un défi d'image apparaît (répondez avec `clicks.json`) |
| Réutilisation de Turnstile | un token par flux | le token est passé en `?turnstile=…` sur les routes du compte ; un token réutilisé sans un nouveau montage répond `Turnstile verification failed` |
| Envoi du code | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent` ; le courrier arrive à **`t0+6.8 s`** (`OrcaRouter email verification`) — boîte Mailtrap `asr7w8bm-…@inbound-mailtrap.io` |
| Inscription | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Connexion | `POST /api/user/login?turnstile=<token>` | **200** — session du compte ouverte (également protégée par Turnstile) |
| Clé | l'**`initial_token`** de l'inscription est la clé | `POST /api/token/` répond **`403 Security verification is required`** sur ce fork — la clé de l'inscription est celle à conserver |
| Preuve | `GET /v1/models` (hôte propre, sortie ≠ création) + complétion de 1 token | les deux enregistrés avec la sortie d'observation ; le verdict de dépense est l'allocation du compte, pas la validité de la clé |

## ⚙️ Options CLI

Tout le code se trouve dans `src/` — exécutez-le depuis la racine du dépôt avec `node src/<file>.js` ; les fichiers de données (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) se trouvent à côté du code.

| Outil | Drapeaux |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (nombre de voies + intervalle de rythme) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (facultatif ; par défaut `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | revérifie chaque clé dans `keys.txt` — aucun drapeau requis ; pool `proxies.txt` facultatif |
| `src/inbox.js` | auto-vérification : crée une boîte sandbox Mailtrap et l'affiche |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ Derrière un proxy

**Facultatif — recommandé à grande échelle (limites par IP, bannissements).** L'outil fonctionne aussi sans proxy.

* Les sorties proviennent de `src/proxies.txt` (une ligne par sortie, `scheme://host:port`, `user:pass@` pris en charge) ou de `--pool FILE` sur `mint`. Le même pool alimente les chargements de page, les appels API et les pré-vérifications du solveur lui-même.
* **Avec un pool :** chaque requête passe par une sortie de cette liste — une sortie morte fait échouer cette tentative et l'outil passe à la suivante (échec fermé tant qu'un pool est fourni).
* **Sans pool :** le CLI affiche `running WITHOUT a proxy (direct)` et se connecte directement — les chargements de page, les appels API et le solveur passent tous en direct. Rien ne change concernant l'inscription, la création de clé ou la vérification — seul le point de sortie des paquets change.
* Le courrier est lu depuis **Mailtrap** (`api.mailtrap.io`) avec votre `MAILTRAP_TOKEN` — c'est le fournisseur de messagerie, pas la cible. Un clone sans `MAILTRAP_TOKEN` se rabat sur un courtier de boîte locale sur `127.0.0.1:9700` lorsqu'il est en cours d'exécution.
* Chrome est lancé par compte avec la sortie comme proxy lorsqu'un pool est fourni, et sans proxy du tout en mode direct ; il est fermé dès que le compte est terminé.
* **N'essayez pas de créer une clé supplémentaire dans le panneau.** `POST /api/token/` répond `403 Security verification is required` ; conservez l'`initial_token` de l'inscription.

## 📄 Fichiers

| Chemin | Contenu |
| --- | --- |
| `src/keys.txt` | une clé vérifiée en direct par ligne — ignoré par git |
| `src/accounts.json` | nom d'utilisateur, boîte mail, sorties, les deux verdicts — ignoré par git |
| `src/models.json` | `GET /v1/models` tel que répondu par une clé créée — ignoré par git |
| `src/proxies.txt` | vos sorties, une par ligne — ignoré par git |
| `src/out/mint-<ts>/` | rendement par tentative : `summary.json`, `yield.tsv`, journaux par tentative — ignoré par git |
| `src/out/spool/` | vidages de défi d'image (`round-N.png` + `state.json`) ; répondez avec `clicks.json` |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | les moteurs vers lesquels le CLI se dispatche |
| `src/connect-9router.js` | enregistre les clés comme connexions 9Router |

## 🔌 Connexion à 9Router

[9Router](https://9router.com) est un routeur auto-hébergé compatible OpenAI. OrcaRouter est compatible OpenAI, donc enregistrez-le une fois et utilisez chaque clé :

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Chaque exécution enregistre une clé comme connexion du nœud fournisseur `orcarouter` ; rappelez-le avec la clé suivante pour en ajouter une autre (`--model <id>` remplace la valeur par défaut). Choisissez ensuite un modèle dans 9Router :

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Valeurs par défaut : `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, modèle par défaut `orcarouter/free`.

## 🔑 Ce qu'une clé vous apporte

| | |
| --- | --- |
| 🏢 Fournisseur | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 Ce que le fournisseur offre | 208 modèles listés (orcarouter/free, fusion, deepseek-v4-flash) — clés authentiques, inférence soumise au contrôle de dépenses |
| 🔑 Ce qu'une clé vous apporte | une clé API limitée à son propre compte : les 208 identifiants de modèles sur le point de terminaison ci-dessous, aux limites de votre forfait. Le quota vit sur le **compte**, ce qui explique précisément pourquoi cet outil crée un compte par clé |
| 🌐 Forme de l'API | Compatible OpenAI : `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Vos données | seuls www.orcarouter.ai et le backend de boîte mail que vous configurez sont contactés ; les clés restent sur votre machine |

## 🐞 Problèmes

Ouvrez un ticket avec l'étape en échec et la fin du journal de tentative (`src/out/mint-<ts>/attempt-N.log`) — il contient la sortie, le timing et la réponse exacte du serveur, soit tout ce qu'il faut pour reproduire un échec. Ne joignez jamais de clé. **[Ouvrir un ticket](../../issues)** et les PR sont les bienvenues.

## 📄 Licence

MIT © 2026 — voir [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey contributors

</div>