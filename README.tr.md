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

**Otomatik oluşturulan API anahtarlarıyla toplu OrcaRouter (orcarouter.ai) hesabı oluşturma — OpenAI uyumlu çıkarım (orcarouter/free, Claude, Gemini, DeepSeek, Qwen) + 9Router bağlayıcısı.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-208%20served-412991?style=for-the-badge)](https://www.orcarouter.ai)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Hızlı başlangıç](#-quick-start) · [🎁 Ücretsiz katman](#-free-tier--how-much-you-get) · [🤖 Modeller](#-models--all-208-of-them) · [🧪 API'yi kullanma](#-how-to-use-the-api) · [✅ Doğrulandı](#-verified-working--every-key-is-tested) · [🧭 Nasıl çalışır](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Seçenekler](#️-cli-options) · [🛰️ Proxy'ler](#️-behind-a-proxy) · [🐞 Sorunlar](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Bu neden var

OrcaRouter (`api.orcarouter.ai`) **208 model** listeler ve kayıt işlemini **Cloudflare Turnstile** ile korur — paketlenmiş bir tarayıcı çözücüsü sayfayı sizin çıkışınız üzerinden açar, doğrulamayı geçer ve araç geri kalanını düz HTTP üzerinden yürütür. Yeni bir hesabın anahtarları *gerçektir* (sağlayıcının kendi ana bilgisayarında, anahtarın üretildiği yerden farklı bir çıkıştan `GET /v1/models` **200**) ve *harcama kapılıdır*: `orcarouter/free` `402 allowance used up` yanıtı verir, `orcarouter/fusion-mini` `402 out of credits` yanıtı verir ve `deepseek/deepseek-v4-flash-free` `429 free_rate_limited … link a GitHub account` yanıtı verir. Anahtar başına bir hesap, herhangi bir N.

## 🎁 Ücretsiz katman — ne kadar alıyorsunuz

**Yeni bir OrcaRouter hesabının anahtarı kimlik doğrular; çıkarım için hesabın fonlanmış olması ya da `-free` katmanı için çalışma alanı sahibinin yerleşik bir GitHub hesabına bağlı olması gerekir.**

| Öğe | Ölçülen (5 hesap, 2026-10-15) |
| --- | --- |
| Anahtarın üretim anında kimlik doğrulaması | `GET https://api.orcarouter.ai/v1/models` **200** — 208 model, her anahtar yazıldı |
| Yeni bir hesapta faturalandırma | `GET /v1/dashboard/billing/usage` **200** `{"object":"list","total_usage":0}` — kullanım okumaları çalışıyor |
| `orcarouter/free` | **402** `your orcarouter/free allowance is used up — top up your balance …` |
| `orcarouter/fusion-mini` | **402** `You're out of credits — this request needs $0.000014. Add credits …/console/billing?ref=err_credit_gate` |
| `google/gemini-2.5-flash` | **402** `You're out of credits — this request needs $0.0002. …` |
| `deepseek/deepseek-v4-flash-free` | **429** `{"code":"free_rate_limited","message":"Free models are not available … link a GitHub account that has been registered for some time…","metadata":{"reason":"err_free_access_denied","retryable":false}}` |
| Çıkarımın kilidini açan şey | kredi ekleyin ya da çalışma alanı sahibini yerleşik bir GitHub hesabına bağlayın (`retryable:false` — bu bir hız sınırı değil) |
| Ölçeklenen birim | **bir hesap = bir anahtar** → `--count N` aslında "her biri kendi kotasına sahip N çalışma alanı" demektir |

> 💡 Ücretsiz katman OrcaRouter tarafından belirlenir ve değişebilir. Güncel sayıları [www.orcarouter.ai](https://www.orcarouter.ai) adresinden kontrol edin — ve kararı aracın kendi kapısına bırakın:

```bash
node src/cli.js verify                 # keys.txt içindeki her anahtar canlı API'ye karşı yeniden test edilir
```

## 🤖 Modeller — 208'inin tamamı

`GET https://api.orcarouter.ai/v1/models`, üretilmiş bir anahtar için **208 model kimliği** döndürür, örneğin:

```
orcarouter/free · orcarouter/fusion-mini · orcarouter/fusion · orcarouter/fusion-flash
deepseek/deepseek-v4-flash · anthropic/claude-haiku-4.5 · google/gemini-2.5-flash
qwen/qwen3-max · kimi/kimi-k2.5 · openai/gpt-3.5-turbo
```

| Model deseni | Yeni bir anahtarda ölçülen sonuç |
| --- | --- |
| `orcarouter/free` | **402** allowance used up |
| `orcarouter/fusion-mini` | **402** out of credits (`$0.000014`) |
| `deepseek/deepseek-v4-flash-free` | **429** `free_rate_limited` — GitHub'a bağlı bir sahip gerektirir |
| `google/gemini-2.5-flash` | **402** out of credits |

Kimlik doğrulama okumaları (`/v1/dashboard/billing/usage`) her yeni anahtar için **200** yanıtı verir — kapı *harcamada*, anahtarın geçerliliğinde değil.

## 🧪 API nasıl kullanılır

Temel URL **`https://api.orcarouter.ai/v1`** — OpenAI uyumlu, yani OpenAI konuşan her şey çalışır (SDK'lar, Cursor, OpenCode, Kilo Code, …).

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

Yeni (fonlanmamış) bir hesapta ilk çağrı `402` yanıtı verir ve `-free` modeli `429 free_rate_limited` yanıtı verir — anahtar iyidir, kapı hesabın kredi/GitHub bağlantısıdır.

## 🛠 Hızlı başlangıç

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

Araçların yazdığı her şey **kodun yanına** düşer: `src/keys.txt`, `src/accounts.json`, `src/out/` — ve okudukları katalog `src/models.json`'dur. Havuz, var olduğunda `src/proxies.txt` dosyasından okunur — havuz yoksa araçlar doğrudan bağlanır. Anahtarlar doğrulandıkları anda eklenir; her denemenin kaydı `out/mint-<ts>/{summary.json,yield.tsv}` içine düşer.

### 🖱️ Başlatıcı

```bash
node src/launcher.js
```

**mint · verify · 9Router** üzerine bir menü: `count` (çalıştırma başına anahtar, varsayılan 5) ve `concurrency` (paralel hatlar) sorar, bunları `launcher.config.json` içinde tutar ve `node src/cli.js <task>` komutunu doğru bayraklarla başlatır. Menü öğesi **4**, bir anahtarı 9Router'a kaydeder.

> **Cloudflare bir görsel doğrulama gösterirse**, çözücü turu `out/spool/round-N.png` dosyasına bir `state.json` ile birlikte döker ve bekler. Yanıtlamak için `out/spool/clicks.json` yazın — `{"tiles":[2,5],"verify":true}` — ya da yeni bir görsel için `{"refresh":true}`. Çoğu çalıştırmada buna hiç gerek kalmaz; Turnstile genellikle tek tıklamayla tamamlanır.

## ✅ Çalıştığı doğrulandı — her anahtar test edilir

Ölçüm **2026-10-15**: **doğrulanan anahtarlar** (beşincisi yayımlanan sürüm tarafından uçtan uca üretildi). Her anahtar var olduktan sonra kontrol edildi.

| Model | Canlı (modeller) | Gerçek sohbet çağrısı | Ölçülen |
| --- | --- | --- | --- |
| `orcarouter/free` | **200** · 208 model | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 model | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 model | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` | **200** · 208 model | **402** allowance used up | 2026-10-15 |
| `orcarouter/free` · `fusion-mini` | **200** · 208 model | **402** allowance used up | 2026-10-15 |

**`GET /v1/models` 200, bir anahtarın *gerçek* olduğunu kanıtlar; *harcayabildiğini* kanıtlamaz.** `src/verify.js`, listelenen en ucuz yol üzerinde 1 token'lık bir tamamlama çalıştırır ve her kademe için tam durumu ve gövdeyi kaydeder (`accounts.json.verify.spend = {model, status, bodySnippet}`), böylece her anahtarın durumu ölçülür — asla ima edilmez.

## 🧭 Nasıl çalışır

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: OrcaRouter page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.orcarouter.ai/v1/chat/completions → real content = the key is live
```

| Adım | Çağrı | Notlar |
| --- | --- | --- |
| Bağlama | paketlenmiş tarayıcı çözücüsü | `www.orcarouter.ai/register` sayfasını sizin çıkışınız üzerinden açar, **Turnstile**'ı geçer; bir görsel doğrulama çıkarsa `out/spool/` içine döker (`clicks.json` ile yanıtlayın) |
| Turnstile yeniden kullanımı | akış başına bir token | token, hesap rotalarında `?turnstile=…` olarak iletilir; yeni bir bağlama olmadan yeniden kullanılan bir token `Turnstile verification failed` yanıtı verir |
| Kod gönder | `GET /api/verification?email=…&turnstile=<token>` | **200** `Verification code sent`; posta **`t0+6.8 s`** içinde gelir (`OrcaRouter email verification`) — Mailtrap gelen kutusu `asr7w8bm-…@inbound-mailtrap.io` |
| Kayıt | `POST /api/user/register?turnstile=<token>` | **200** `id:250881` `active_workspace_id:251943` + **`initial_token: sk-orca-…`** |
| Giriş | `POST /api/user/login?turnstile=<token>` | **200** — hesap oturumu açıldı (o da Turnstile kapılı) |
| Anahtar | kaydın **`initial_token`**'ı anahtardır | `POST /api/token/` bu çatallamada **`403 Security verification is required`** yanıtı verir — saklanacak olan, kaydın kendi anahtarıdır |
| Kanıtla | `GET /v1/models` (kendi ana bilgisayarı, çıkış ≠ üretim) + 1 token'lık tamamlama | her ikisi de gözlemleyen çıkışla kaydedilir; harcama kararı anahtarın geçerliliği değil, hesabın kotasıdır |

## ⚙️ CLI seçenekleri

Tüm kod `src/` içinde yaşar — depo kökünden `node src/<file>.js` olarak çalıştırın; veri dosyaları (`src/keys.txt`, `src/proxies.txt`, `src/accounts.json`, `src/out/`) kodun yanında durur.

| Araç | Bayraklar |
| --- | --- |
| `src/mint.js` | `--count N` (5) · `--attempts N` (count+3) · `--conc N` (1–3) · `--preset turbo\|balanced\|safe` (hat sayısı + tempo aralığı) · `--gap S` · `--runs N` (2) · `--tag` · `--pool FILE` (isteğe bağlı; varsayılan `proxies.txt`) |
| `src/turnstile-lane.js` | `--runs` · `--tag` · `--api-exits` / `--mount-exits` · `--mail` · `--email` + `--box-token` · `--register-only --code` · `--resume` · `--verify-only --key` · `--brain` · `--probe-only` |
| `src/solver.js` | `--type turnstile\|recaptcha2\|hcaptcha` · `--sitekey` · `--url` · `--exits` · `--runs` · `--brain` · `--out` · `--headless` |
| `src/verify.js` | `keys.txt` içindeki her anahtarı yeniden kontrol eder — zorunlu bayrak yok; isteğe bağlı `proxies.txt` havuzu |
| `src/inbox.js` | kendi kendini kontrol: bir Mailtrap sandbox gelen kutusu oluşturur ve yazdırır |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

## 🛰️ Proxy arkasında

**İsteğe bağlı — ölçekte önerilir (IP başına sınırlar, banlar).** Araç proxy olmadan da çalışır.

* Çıkışlar `src/proxies.txt` dosyasından (satır başına bir çıkış, `scheme://host:port`, `user:pass@` desteklenir) ya da `mint` üzerinde `--pool FILE` ile gelir. Aynı havuz, sayfa yüklemelerini, API çağrılarını ve çözücünün kendi ön kontrollerini besler.
* **Havuz varken:** her istek o listeden bir çıkış üzerinden gider — ölü bir çıkış o denemeyi başarısız kılar ve araç bir sonrakine geçer (havuz sağlandığı sürece fail-closed).
* **Havuz yokken:** CLI `running WITHOUT a proxy (direct)` yazdırır ve doğrudan bağlanır — sayfa yüklemeleri, API çağrıları ve çözücü hepsi doğrudan gider. Kayıt, anahtar üretimi veya doğrulama konusunda hiçbir şey değişmez — yalnızca paketlerin nereden çıktığı değişir.
* Posta, `MAILTRAP_TOKEN`'ınızla **Mailtrap**'ten (`api.mailtrap.io`) okunur — bu posta sağlayıcısıdır, hedef değil. `MAILTRAP_TOKEN` olmayan bir kopya, çalışıyorsa `127.0.0.1:9700` üzerindeki yerel bir gelen kutusu aracısına geri döner.
* Chrome, havuz verildiğinde çıkışı proxy'si olarak kullanarak hesap başına başlatılır ve doğrudan modda hiç proxy olmadan başlatılır; hesap biter bitmez kapatılır.
* **Panelde ekstra bir anahtar oluşturmaya çalışmayın.** `POST /api/token/` `403 Security verification is required` yanıtı verir; kayıttan gelen `initial_token`'ı saklayın.

## 📄 Dosyalar

| Yol | İçerik |
| --- | --- |
| `src/keys.txt` | satır başına bir canlı doğrulanmış anahtar — git tarafından yok sayılır |
| `src/accounts.json` | kullanıcı adı, posta kutusu, çıkışlar, her iki karar — git tarafından yok sayılır |
| `src/models.json` | üretilmiş bir anahtarın yanıtladığı haliyle `GET /v1/models` — git tarafından yok sayılır |
| `src/proxies.txt` | çıkışlarınız, satır başına bir tane — git tarafından yok sayılır |
| `src/out/mint-<ts>/` | deneme başına verim: `summary.json`, `yield.tsv`, deneme başına günlükler — git tarafından yok sayılır |
| `src/out/spool/` | görsel doğrulama dökümleri (`round-N.png` + `state.json`); `clicks.json` ile yanıtlayın |
| `src/mint.js` · `src/verify.js` · `src/turnstile-lane.js` · `src/solver.js` | CLI'nin yönlendirdiği motorlar |
| `src/connect-9router.js` | anahtarları 9Router bağlantıları olarak kaydeder |

## 🔌 9Router'a bağlan

[9Router](https://9router.com) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir. OrcaRouter OpenAI uyumludur, yani bir kez kaydedin ve her anahtarı kullanın:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456 --api-key <your key>
# or: node src/cli.js connect --api-key <your key>
```

Her çalıştırma, bir anahtarı `orcarouter` sağlayıcı düğümünün bir bağlantısı olarak kaydeder; başka bir tane eklemek için bir sonraki anahtarla tekrar çağırın (`--model <id>` varsayılanı geçersiz kılar). Ardından 9Router içinde bir model seçin:

```
orcarouter/orcarouter/free
orcarouter/orcarouter/fusion-mini
orcarouter/deepseek/deepseek-v4-flash
```

Varsayılanlar: `--base http://localhost:20128`, `--password 123456`, `--prefix orcarouter`, `--base-url https://api.orcarouter.ai/v1`, varsayılan model `orcarouter/free`.

## 🔑 Bir anahtar size ne kazandırır

| | |
| --- | --- |
| 🏢 Sağlayıcı | **OrcaRouter** — [www.orcarouter.ai](https://www.orcarouter.ai) |
| 🎁 Sağlayıcının verdikleri | 208 model listelenir (orcarouter/free, fusion, deepseek-v4-flash) — anahtarlar gerçek, çıkarım harcama kapılı |
| 🔑 Bir anahtar size ne kazandırır | kendi hesabına kapsanmış bir API anahtarı: aşağıdaki uç noktada 208 model kimliği, planınızın sınırlarında. Kota **hesapta** yaşar, bu aracın anahtar başına bir hesap oluşturmasının nedeni tam da budur |
| 🌐 API şekli | OpenAI uyumlu: `POST https://api.orcarouter.ai/v1/chat/completions` |
| 🔒 Verileriniz | yalnızca www.orcarouter.ai ve yapılandırdığınız gelen kutusu arka ucuyla iletişim kurulur; anahtarlar makinenizde kalır |

## 🐞 Sorunlar

Başarısız adım ve deneme günlüğünün son kısmıyla (`src/out/mint-<ts>/attempt-N.log`) bir sorun açın — bu günlük çıkışı, zamanlamayı ve sunucunun tam yanıtını taşır, ki bir hatayı yeniden üretmek için gereken her şey budur. Asla bir anahtar eklemeyin. **[Bir sorun açın](../../issues)** ve PR'lar memnuniyetle karşılanır.

## 📄 Lisans

MIT © 2026 — bkz. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 orcarouter-bulk-apikey katkıda bulunanlar

</div>