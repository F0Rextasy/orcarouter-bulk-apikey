'use strict';
/*
 * Vision-model captcha solver — autonomous, with a key-free hand-answer fallback.
 *
 * This is the published captcha solver, shipped next to the lane that spawns it
 * so a clone needs nothing outside the
 * repository. Its requires resolve to the bundled siblings: `cdp.js` (Chrome
 * DevTools client), `proxy.js` (exit tunnels) and `chrome-flags.js`.
 *
 *   node src/solver.js --type turnstile --sitekey 0x… --url https://host/register --exits proxies.txt --runs 2 --brain spool
 *   node src/solver.js --feed <solve-dir>      # drop-in feeder for io.net solve.js
 *   node src/solver.js --type recaptcha2 --url <page> --runs 10 --brain spool
 *
 * Targets: reCAPTCHA v2 image rounds (primary), hCaptcha visual rounds, Turnstile
 * (two clicks, no vision). Every round: screenshot the challenge frame (OOPIF via
 * CDP with pierced shadow roots where needed) -> answer the round (vision model,
 * or `--brain spool`: the round lands in <out>/spool/round-N.png + state.json and
 * the run waits for <out>/spool/clicks.json) -> click only those tiles via
 * Input.dispatchMouseEvent -> press verify -> read the response token.
 *
 * Contract mirrored from io.net's `solve.js` (unchanged, read-only):
 *   solve.js writes  <dir>/round-<n>.png + <dir>/state.json {tiles:[{i,r,c,x,y,w,h}], cols, instruction, verify}
 *   feeder writes    <dir>/clicks.json  {"tiles":[...],"verify":true} | {"refresh":true}
 * `--feed <dir>` implements exactly that contract, so it replaces io.net's
 * `auto-feed.js` with an honest (vision) tile set.
 *
 * Network policy: page loads and (pooled) model calls go through a pool exit
 * (Chrome per-context proxyServer / the bundled proxy.js createAgent). Nothing
 * in this file dials the model providers directly unless `--brain-proxy direct`
 * is passed deliberately.
 *
 * Output contract (measured trap for callers, 2026-10-15):
 *   per-run records  out/captcha-<basename(--out)>-runN.json   (SIBLING of --out)
 *   summary          out/captcha-<basename(--out)>-summary.json
 *   log              out/captcha-<basename(--out)>.log
 *   only shots live inside --out: <--out>/shots-N/round-N.png
 * i.e. a caller that greps inside --out finds no token; read the siblings (their
 * `newestToken()` had this wrong twice before the fix).
 *
 * Usage (single line):
 *   node src/solver.js --type recaptcha2 --url "https://host/..." --runs 10 --exits proxies.txt
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const { CDP } = require('./cdp.js');
const { parseProxy, createAgent, browserUrl, loadPoolFile, usableInBrowser, isLocalHost, fetchText } = require('./proxy.js');
const { leanArgs } = require(path.join(__dirname, 'chrome-flags.js'));

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.join(__dirname);
const OUTDIR = path.join(ROOT, 'out');

// ------------------------------------------------------------------ cli

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i === -1 ? d : argv[i + 1];
};
const flag = (n) => argv.includes('--' + n);

const OPTS = {
  type: arg('type', 'recaptcha2'),
  url: arg('url', ''),
  out: arg('out', ''),
  runs: parseInt(arg('runs', '1'), 10),
  maxRounds: parseInt(arg('max-rounds', '3'), 10),
  port: arg('port', '') ? parseInt(arg('port'), 10) : 0,
  attach: arg('attach', '') ? parseInt(arg('attach'), 10) : 0,
  pool: arg('pool', path.join(OUTDIR, 'upstage-console-live.txt')),
  proxy: arg('proxy', ''),
  brain: arg('brain', 'auto'),
  brainProxy: arg('brain-proxy', ''), // proxy line used for model calls (default: the page's exit)
  feed: arg('feed', ''),
  headless: flag('headless'),
  keep: flag('keep'),
  quiet: flag('quiet'),
  proxyTries: parseInt(arg('proxy-tries', '6'), 10),
  screenshot: arg('screenshot', ''), // extra: always write the round PNG to this dir
  verifyWaitMs: parseInt(arg('verify-wait-ms', '3800'), 10),
  exits: arg('exits', ''), // pre-screened exit list (from --screen-exits or a previous run)
  screen: !flag('no-screen'), // probe each candidate exit before spending a run on it
  screenNeed: parseInt(arg('screen-need', '6'), 10),
  screenConcurrency: parseInt(arg('screen-concurrency', '8'), 10),
  screenOnly: flag('screen-exits-only'),
  runAttempts: parseInt(arg('run-attempts', '3'), 10), // fresh exit per attempt until the widget renders
  widgetWait: parseInt(arg('widget-wait', '25000'), 10),
  mount: arg('mount', ''), // 'turnstile' | 'hcaptcha' | 'auto': mount the sitekey widget in the page and read getResponse()
  attachTarget: arg('target', ''), // attach mode: targetId (or url substring) of the CALLER's page — never opened/closed by us
  reusePage: flag('reuse-page'), // same, picking the most recently active page target
  sitekey: arg('sitekey', ''), // otherwise detected from the page (data-sitekey, render() args, 0x4AAAAA… / uuid shapes)
};
if (!OPTS.out) OPTS.out = path.join(OUTDIR, `captcha-${new Date().toISOString().replace(/[:.]/g, '-')}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const say = (...a) => {
  if (!OPTS.quiet) console.log(...a);
};
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// --------------------------------------------------------------- http bits

function httpGetJson(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let t = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (t += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(t));
        } catch (e) {
          resolve(t);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('debug-port timeout')));
  });
}

/** One HTTP POST/GET through an exit; returns {status, text, ms} — no own-IP path. */
function httpJson(proxyLine, url, { method = 'POST', headers = {}, body = null, timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const proxy = proxyLine ? parseProxy(proxyLine) : null;
    if (proxy) {
      proxy.connectTimeoutMs = proxy.connectTimeoutMs || 10000;
      proxy.timeoutMs = proxy.timeoutMs || 60000;
    }
    const payload = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const hs = { ...headers };
    if (payload && !Object.keys(hs).some((h) => h.toLowerCase() === 'content-type')) hs['Content-Type'] = 'application/json';
    if (payload) hs['Content-Length'] = payload.length;
    const t0 = now();
    const req = lib.request(
      { method, host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, headers: hs, agent: proxy ? createAgent(proxy) : undefined },
      (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (t += c));
        res.on('end', () => resolve({ status: res.statusCode, text: t, ms: now() - t0 }));
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout ' + timeoutMs + 'ms')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ----------------------------------------------------------------- chrome

async function freePort(start = 9412) {
  for (let p = start; p < start + 200; p++) {
    const busy = await new Promise((resolve) => {
      const s = require('net').createServer();
      s.once('error', () => resolve(true));
      s.once('listening', () => s.close(() => resolve(false)));
      s.listen(p, '127.0.0.1');
    });
    if (!busy) return p;
  }
  throw new Error('no free port');
}

async function waitPort(port, timeoutMs = 25000) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    try {
      await httpGetJson(port, '/json/version');
      return true;
    } catch {
      await sleep(350);
    }
  }
  throw new Error(`chrome debug port ${port} never came up`);
}

function launchChrome(port, { headless, proxyServer }) {
  const profileDir = path.join(os.homedir(), `.captcha-solve-chrome-${Date.now().toString(36)}`);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=520,820',
    '--window-position=1180,40',
    // leanArgs() saves RAM with --renderer-process-limit=2, but that flag collapses
    // cross-site iframes into the page renderer: reCAPTCHA's anchor/bframe then have
    // no CDP target of their own (measured on recaptcha-demo.appspot.com, where the
    // whole OOPIF-native path — and the inline fallback, since the frame is
    // cross-origin — both become unusable). One browser, so the RAM is affordable.
    ...leanArgs({ headless }).filter((a) => !/^--renderer-process-limit/.test(a)),
  ];
  // One shared proxy at launch is only used for the "measurement without model
  // traffic" case; per-run browser contexts carry their own exit.
  if (proxyServer) args.push(`--proxy-server=${proxyServer}`);
  const child = spawn(CHROME, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  return { pid: child.pid, profileDir, port };
}

async function killChrome(meta) {
  if (!meta) return;
  try {
    await httpGetJson(meta.port, '/json/version');
    // graceful: Browser.close via CDP
    const cdp = await connect(meta.port);
    await cdp.send('Browser.close').catch(() => null);
    try {
      cdp.close();
    } catch {}
  } catch {}
  try {
    spawn('taskkill', ['/PID', String(meta.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } catch {}
  try {
    fs.rmSync(meta.profileDir, { recursive: true, force: true });
  } catch {}
}

async function connect(port) {
  const info = await httpGetJson(port, '/json/version');
  const cdp = new CDP(info.webSocketDebuggerUrl, { commandTimeoutMs: 45000 });
  // A dying Chrome emits 'error' on the CDP socket; without a listener Node turns
  // that into an unhandled exception and kills the run AFTER its results are on
  // disk (measured: exit-proxy teardown, ECONNRESET).
  cdp.on('error', () => {});
  cdp.on('disconnect', () => {});
  await cdp.connect();
  return cdp;
}

// ------------------------------------------------------------- cdp helpers

async function attach(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId).catch(() => null);
  await cdp.send('Page.enable', {}, sessionId).catch(() => null);
  return sessionId;
}

async function evalIn(cdp, sessionId, expression, { awaitPromise = false } = {}) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result && r.result.value;
}

/** Input chain with a real pointer move first — bare pressed/released is scored worse. */
async function clickIn(cdp, sessionId, x, y, { settle = 60 } = {}) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }, sessionId);
  await sleep(settle);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' }, sessionId);
  await sleep(40);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' }, sessionId);
}

async function screenshot(cdp, sessionId, file, clip) {
  const r = await cdp.send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' }, sessionId);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

// ------------------------------------------------------------------ brains

const PROVIDERS = {
  // OpenRouter free tier was the first working vision endpoint (2026-10-15 sweep)
  // but its *account* free quota is 1000 calls/day and it 429s across runs once
  // spent, so Cohere Aya Vision (5 trial keys) is the preferred brain:
  cohere: {
    base: 'https://api.cohere.com/v2',
    keyFile: ['providers', 'cohere', 'keys.txt'],
    model: process.env.CAPTCHA_VISION_MODEL || 'c4ai-aya-vision-32b',
    chain: ['c4ai-aya-vision-32b'],
    api: 'cohere',
    extra: {},
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    keyFile: ['providers', 'openrouter', 'keys.txt'],
    model: process.env.CAPTCHA_VISION_MODEL || 'dots-studio/dots-3-note-preview:free',
    chain: ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'],
    extra: { 'HTTP-Referer': 'https://io.net/', 'X-Title': 'captcha-solve' },
  },
  groq: {
    base: 'https://api.groq.com/openai/v1',
    keyFile: ['providers', 'groq', 'keys.txt'],
    model: process.env.CAPTCHA_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    chain: ['meta-llama/llama-4-scout-17b-16e-instruct'],
    extra: {},
  },
  zenmux: {
    base: 'https://zenmux.ai/api/v1',
    keyFile: ['providers', 'zenmux', 'keys.txt'],
    model: process.env.CAPTCHA_VISION_MODEL || 'z-ai/glm-4.6v-flash-free',
    chain: ['z-ai/glm-4.6v-flash-free', 'inclusionai/ling-3.0-flash-vl'],
    extra: {},
  },
};

function readKeys(rel) {
  const p = path.join(__dirname, rel[0], rel[1], rel[2]);
  try {
    return fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function readKey(rel) {
  return readKeys(rel)[0] || null;
}

/**
 * Pull the answer out of a chat completion. Reasoning models wrap the JSON in
 * prose (and sometimes echo a schema), so: last `{"tiles":…}` wins, then a bare
 * list, then a `"tiles": [...]` fragment. Never fall back to "every number in
 * the text" — measured: prose like "3x3 grid, tiles 0..8" produced garbage sets
 * such as [0,112] that cost a whole round.
 */
function extractTiles(text) {
  if (!text) return null;
  const s = String(text);
  const pick = (j) => {
    if (Array.isArray(j)) {
      const t = j.map(Number).filter((n) => Number.isFinite(n));
      return { tiles: t, confidence: null, reason: null };
    }
    if (!j || typeof j !== 'object') return null;
    const arr = j.tiles ?? j.indices ?? j.selection ?? j.answer;
    const conf = j.confidence ?? null;
    const reason = j.reason ?? j.why ?? j.note ?? null;
    if (Array.isArray(arr)) return { tiles: arr.map(Number).filter((n) => Number.isFinite(n)), confidence: conf, reason };
    if (j.refresh) return { tiles: [], refresh: true, confidence: conf, reason };
    return null;
  };
  const objs = [...s.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]);
  for (let i = objs.length - 1; i >= 0; i--) {
    try {
      const out = pick(JSON.parse(objs[i]));
      if (out) return out;
    } catch {}
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      const out = pick(JSON.parse(s.slice(first, last + 1)));
      if (out) return out;
    } catch {}
  }
  const m = s.match(/"tiles"\s*:\s*\[([^\]]*)\]/);
  if (m) return { tiles: [...new Set((m[1].match(/\d+/g) || []).map(Number))], confidence: 'low', reason: 'tiles-fragment' };
  const arr = s.match(/\[[\d,\s]*\]/);
  if (arr) {
    try {
      const out = pick(JSON.parse(arr[0]));
      if (out) return out;
    } catch {}
  }
  return null;
}

class Brain {
  constructor(spec, { brainProxy, logPath } = {}) {
    this.spec = spec === 'auto' ? 'auto' : spec;
    this.brainProxy = brainProxy || null;
    this.logPath = logPath;
    this.lastModel = null;
    this.calls = [];
    this.sticky = null; // model that answered most recently: try it first next round
    this.exitProvider = null; // async () => proxy line, used to survive free-exit deaths mid-call
    this.noRf = new Set(); // provider/model pairs that reject response_format
    this.badKeys = new Set(); // keys that hung on transport — tried last, not first
  }

  /** `spec` = `provider[:model]` | `http:<base>|<model>|<keyfile>` | `spool` | `auto`. */
  resolve() {
    const specStr = String(this.spec);
    const ci = specStr.indexOf(':');
    const kind = ci === -1 ? specStr : specStr.slice(0, ci);
    const modelArg = ci === -1 ? '' : specStr.slice(ci + 1);
    if (kind === 'spool') return { kind: 'spool' };
    if (kind === 'http') {
      const [base, model, keyFile] = modelArg.split('|');
      return { kind: 'http', base, model, key: keyFile ? fs.readFileSync(keyFile, 'utf8').trim().split(/\r?\n/)[0] : process.env.CAPTCHA_VISION_KEY || '' };
    }
    const names = this.spec === 'auto' ? ['zenmux', 'cohere', 'openrouter'] : [kind];
    const list = [];
    for (const n of names) {
      const provider = PROVIDERS[n];
      if (!provider) continue;
      const models = modelArg ? [modelArg] : provider.chain || [provider.model];
      for (const m of models) list.push({ name: n, model: m });
    }
    if (this.sticky) {
      const i = list.findIndex((a) => `${a.name}/${a.model}` === this.sticky);
      if (i > 0) list.unshift(list.splice(i, 1)[0]);
    }
    return { kind: 'chain', list };
  }

  /** One provider call. `api` selects the wire shape: OpenAI-compatible or Cohere v2. */
  async _call(provider, model, key, prompt, b64, rf, proxyLine) {
    const headers = { ...(provider.extra || {}) };
    if (key) headers.Authorization = `Bearer ${key}`;
    // The pool tunnel is TLS-only (createAgent) and a local/mock endpoint must never
    // be routed through an exit — so a plain-http base always goes direct.
    const useProxy = /^https:/i.test(provider.base || '') ? proxyLine : null;
    if ((provider.api || 'openai') === 'cohere') {
      const body = {
        model,
        max_tokens: 400,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
            ],
          },
        ],
      };
      return httpJson(useProxy, `${provider.base}/chat`, { headers, body, timeoutMs: provider.timeoutMs || Number(process.env.CAPTCHA_BRAIN_TIMEOUT || 45000) });
    }
    const body = {
      model,
      // reasoning models burn the budget before they emit the JSON.
      max_tokens: 2500,
      temperature: 0,
      messages: [
        { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } }] },
      ],
    };
    if (rf) body.response_format = { type: 'json_object' };
    return httpJson(useProxy, `${provider.base}/chat/completions`, { headers, body, timeoutMs: provider.timeoutMs || Number(process.env.CAPTCHA_BRAIN_TIMEOUT || 45000) });
  }

  /** Reads the assistant text out of either wire shape. */
  _contentOf(text, api) {
    const j = JSON.parse(text);
    if (api === 'cohere') {
      return (j.message?.content || []).map((p) => p.text || '').join(' ').trim();
    }
    const msg = j.choices?.[0]?.message || {};
    // Some free models return the answer only in `reasoning` with content:null.
    return msg.content || msg.reasoning || '';
  }

  async ask({ pngPath, instruction, rows, cols, numbered, kindHint }) {
    const spec = this.resolve();
    const b64 = fs.readFileSync(pngPath).toString('base64');
    const prompt = buildPrompt({ instruction, rows, cols, numbered, kindHint });
    if (spec.kind === 'spool') return this._spool({ pngPath, instruction, rows, cols, prompt });

    if (!this.brainProxy && this.exitProvider) {
      this.brainProxy = await this.exitProvider().catch(() => null);
      say(`  [brain] first use: model calls exit via ${this.brainProxy || '(pool empty — direct)'}`);
    }
    const attempts =
      spec.kind === 'chain'
        ? spec.list.map((a) => ({ name: a.name, model: a.model, provider: PROVIDERS[a.name] }))
        : [{ name: spec.kind === 'http' ? 'http' : spec.kind, model: spec.model, provider: { base: spec.base, key: spec.key } }];
    let lastErr = null;
    for (const a of attempts) {
      const provider = a.provider;
      if (!provider) {
        lastErr = new Error('unknown brain provider ' + a.name);
        continue;
      }
      const api = provider.api || 'openai';
      let keys = provider.key ? [provider.key] : provider.keyFile ? readKeys(provider.keyFile) : [null];
      // A key that hung once hangs again (measured: cohere #z5rP killed 3 of 9
      // spawns with a 150 s hang), so parked keys go last instead of first.
      if (keys.length > 1) {
        const good = keys.filter((k) => !this.badKeys.has(String(k)));
        if (good.length) keys = good.concat(keys.filter((k) => this.badKeys.has(String(k))));
      }
      if (!keys.length) {
        lastErr = new Error('no key for ' + a.name);
        say(`  [brain] ${a.name}: no key, skipping`);
        continue;
      }
      const model = a.model || provider.model;
      for (const key of keys) {
        // One key, up to three shots: (1) as-is, (2) with response_format when the
        // first reply was unparseable, (3) through a different exit when the first
        // died mid-call. Measured: json_object *hurts* OpenRouter's reasoning model
        // (7/12 exact sets plain vs 4/12 with it), so it is retry-only.
        let nextKey = false;
        for (let shot = 0; shot < 3; shot++) {
          const tag = `${a.name}/${model}${key ? '#' + String(key).slice(0, 4) : ''}`;
          const useRf = shot > 0 && api === 'openai' && !this.noRf.has(`${a.name}/${model}`);
          const t0 = now();
          let res;
          try {
            res = await this._call(provider, model, key, prompt, b64, useRf, this.brainProxy);
          } catch (e) {
            lastErr = e;
            const msg = String(e.message || e);
            const transport = /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|aborted/i.test(msg);
            say(`  [brain] ${tag} err ${msg} (${now() - t0}ms)${transport ? ' [transport]' : ''}`);
            if (shot < 2 && this.exitProvider) {
              this.brainProxy = await this.exitProvider().catch(() => this.brainProxy);
              say('  [brain] retrying via a fresh exit');
              continue;
            }
            if (transport && key) {
              // Transport failures are key- or exit-scoped, never answer-scoped:
              // park the key so the next one gets the call instead of the whole
              // spawn dying on a hung credential.
              this.badKeys.add(String(key));
              say(`  [brain] key ${String(key).slice(0, 4)} parked after a transport failure -> next key`);
              nextKey = true;
            }
            break;
          }
          const ms = now() - t0;
          if (useRf && (res.status === 400 || res.status === 422)) {
            this.noRf.add(`${a.name}/${model}`);
            continue; // same model, without response_format
          }
          if (res.status === 401 || res.status === 429) {
            // Key-scoped limit (Cohere trial keys, OpenRouter free quota): next key.
            lastErr = new Error(`${a.name} ${res.status}: ${res.text.slice(0, 140)}`);
            say(`  [brain] ${tag} -> ${res.status} ${res.text.slice(0, 100).replace(/\s+/g, ' ')} (${ms}ms)`);
            nextKey = true;
            break;
          }
          if (res.status !== 200) {
            lastErr = new Error(`${a.name} ${res.status}: ${res.text.slice(0, 160)}`);
            say(`  [brain] ${tag} -> ${res.status} ${res.text.slice(0, 120).replace(/\s+/g, ' ')} (${ms}ms)`);
            if (shot < 2 && this.exitProvider && res.status >= 500) {
              this.brainProxy = await this.exitProvider().catch(() => this.brainProxy);
              continue;
            }
            break;
          }
          let content = '';
          try {
            content = this._contentOf(res.text, api);
          } catch (e) {
            lastErr = new Error('bad json envelope: ' + res.text.slice(0, 120));
            break;
          }
          const out = extractTiles(content);
          if (!out) {
            lastErr = new Error('unparseable answer: ' + String(content).slice(0, 120));
            say(`  [brain] ${tag} unparseable: ${String(content).slice(0, 100)}`);
            if (shot < 2) continue; // retry: json_object may now kick in
            break;
          }
          this.lastModel = `${a.name}/${model}`;
          this.sticky = this.lastModel;
          if (key) this.badKeys.delete(String(key)); // it answered: not a hung key after all
          this.calls.push({ model: this.lastModel, key: key ? String(key).slice(0, 4) : null, ms, tiles: out.tiles, confidence: out.confidence, proxy: this.brainProxy });
          say(`  [brain] ${this.lastModel} ${ms}ms -> tiles=[${out.tiles}] conf=${out.confidence} ${out.reason ? '(' + String(out.reason).slice(0, 60) + ')' : ''}`);
          return { ...out, model: this.lastModel, ms, attempts: attempts.length, raw: String(content).slice(0, 400) };
        }
        if (!nextKey) break; // a non-key failure: do not burn the remaining keys on it
      }
    }
    throw new Error('no brain answered: ' + (lastErr ? lastErr.message : 'unknown'));
  }

  /** Human/agent-in-the-loop fallback: spool round PNG + state, wait for clicks.json. */
  async _spool({ pngPath, instruction, rows, cols }) {
    const dir = ensureDir(path.join(OPTS.out, 'spool'));
    const round = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length + 1;
    const shot = path.join(dir, `round-${round}.png`);
    fs.copyFileSync(pngPath, shot);
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ round, instruction, rows, cols, shot: path.basename(shot), at: new Date().toISOString() }, null, 1));
    const clicks = path.join(dir, 'clicks.json');
    try {
      fs.unlinkSync(clicks);
    } catch {}
    say(`  [brain:spool] wrote ${shot}; waiting for ${clicks} (<=180s)`);
    const deadline = now() + 180000;
    while (now() < deadline) {
      if (fs.existsSync(clicks)) {
        try {
          const j = JSON.parse(fs.readFileSync(clicks, 'utf8'));
          this.lastModel = 'spool';
          return { tiles: j.tiles || [], refresh: !!j.refresh, confidence: null, model: 'spool', ms: 0, raw: JSON.stringify(j) };
        } catch {}
      }
      await sleep(800);
    }
    throw new Error('spool: no clicks.json within 180s');
  }
}

function buildPrompt({ instruction, rows, cols, numbered, kindHint }) {
  const lines = [
    `You are the vision component of an automated captcha solver (site owner's own test rig; no human is present).`,
    kindHint === 'hcaptcha' ? `Challenge type: hCaptcha image grid.` : `Challenge type: reCAPTCHA v2 image grid.`,
    `Instruction shown to the user: "${instruction || '(none)'}".`,
    `The grid is ${rows} rows x ${cols} columns, ${rows * cols} tiles, indexed row-major starting at 0.`,
    numbered
      ? `Tile indices are drawn as green numbers on the image — trust those numbers, not a mental count.`
      : `Count tiles row-major (left to right, top to bottom) starting at 0.`,
    `Select ONLY the tiles that unambiguously satisfy the instruction. Never add tiles "to be safe":`,
    `a superset is graded as wrong, an exact subset is graded as right.`,
    `If no tile matches, or you cannot decide, return an empty list.`,
    `Reply with one strict JSON object, nothing else:`,
    `{"tiles":[<int>...],"confidence":"high|medium|low","reason":"<=8 words"}`,
  ];
  return lines.join('\n');
}

// ------------------------------------------------- chapter: reCAPTCHA v2

function isV2Frame(t, sitekey) {
  if (t.type !== 'iframe') return false;
  const u = t.url || '';
  if (!/recaptcha/.test(u)) return false;
  return !sitekey || u.includes(sitekey);
}

class Solver {
  constructor(cdp, log) {
    this.cdp = cdp;
    this.log = log || (() => {});
    this.brain = null;
    this.answerKeys = new Map(); // answer set -> the image it was first seen on
  }

  targets() {
    return this.cdp.send('Target.getTargets').then((r) => r.targetInfos);
  }

  /**
   * The site's own widget is the fast path; free exits often leave the page shell
   * un-hydrated, so fall back to the loader the lanes inject, then to rendering
   * the site's own sitekey explicitly (same key, same page: still a captcha
   * solve, never an account action).
   */
  async prepareWidget(hostSid, type) {
    let w = await this.waitWidget(hostSid, type, Math.min(OPTS.widgetWait, 12000));
    if (w.widget) return { ...w, mode: 'native' };
    if (type !== 'recaptcha2') return { ...w, mode: 'none' };
    const injected = await this.ensureRecaptchaLoader(hostSid);
    w = await this.waitWidget(hostSid, type, 12000);
    if (w.widget) return { ...w, mode: 'injected', grecaptcha: injected };
    const sitekey = await this.detectSitekey(hostSid);
    if (sitekey) {
      const forced = await this.forceRender(hostSid, sitekey);
      if (forced.ok) {
        w = await this.waitWidget(hostSid, type, 12000);
        return { ...w, mode: w.widget ? 'forced' : 'none', sitekey };
      }
      return { ...w, mode: 'none', sitekey, forceError: forced.why };
    }
    return { ...w, mode: 'none' };
  }

  async ensureRecaptchaLoader(hostSid) {
    const st = await evalIn(
      this.cdp,
      hostSid,
      `(() => ({ render: typeof (window.grecaptcha && window.grecaptcha.render), clients: window.___grecaptcha_cfg ? Object.keys(window.___grecaptcha_cfg.clients||{}).length : null }))()`
    ).catch(() => null);
    if (st && st.render === 'function' && st.clients) return st;
    await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        if (document.getElementById('omp-recaptcha-inject')) return 'already';
        const s=document.createElement('script');
        s.id='omp-recaptcha-inject';
        s.src='https://www.google.com/recaptcha/api.js?onload=ompRcOnload&render=explicit';
        s.async=true; s.defer=true;
        window.ompRcOnload=()=>{ window.__ompRcLoaded=true; };
        document.head.appendChild(s);
        return 'injected';
      })()`
    ).catch(() => null);
    return st;
  }

  async detectSitekey(hostSid) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const hay=[document.documentElement.innerHTML];
        for (const f of document.querySelectorAll('iframe[src*="recaptcha"]')) hay.push(String(f.src));
        for (const s of document.querySelectorAll('script[src]')) hay.push(String(s.src));
        try { for (const k of Object.keys(localStorage)) hay.push(localStorage.getItem(k) || ''); } catch (e) {}
        const m = hay.join(' ').match(/6L[A-Za-z0-9_-]{30,45}/);
        return m ? m[0] : null;
      })()`
    ).catch(() => null);
  }

  async forceRender(hostSid, sitekey) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.render) return { ok:false, why:'no-api' };
        const old=document.getElementById('omp-rc-host');
        if (old) old.remove();
        const host=document.createElement('div');
        host.id='omp-rc-host';
        host.style.cssText='position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#fff;padding:4px';
        document.body.appendChild(host);
        try { const id=grecaptcha.render(host, { sitekey: ${JSON.stringify(sitekey)} , size:'normal' }); return { ok:true, id: String(id) }; }
        catch(e) { return { ok:false, why:String(e && e.message || e) }; }
      })()`
    ).catch((e) => ({ ok: false, why: e.message }));
  }
  async waitWidget(hostSid, type, timeoutMs) {
    const deadline = now() + timeoutMs;
    const probe = {
      // A handover gate must require a *rendered* widget: `!!window.grecaptcha` and a
      // bare `.g-recaptcha` container both look ready and are not (measured by the
      // ScrapingBee consumer: {"grecaptcha":true,"anchor":false}). Only an anchor
      // frame counts as ready.
      recaptcha2: `(() => {
        const f=[...document.querySelectorAll('iframe[src*="recaptcha"]')];
        const anchor=f.some(x=>/anchor/.test(String(x.src)));
        return { widget: anchor, anchor, container: !!document.querySelector('.g-recaptcha'),
                 grecaptcha: typeof grecaptcha, frames: f.map(x=>String(x.src).slice(0,80)) };
      })()`,
      hcaptcha: `(() => {
        const f=[...document.querySelectorAll('iframe[src*="hcaptcha"]')];
        return { widget: !!(f.length || document.querySelector('.h-captcha, [data-hcaptcha-sitekey]')), frames: f.map(x=>String(x.src).slice(0,80)) };
      })()`,
      turnstile: `(() => {
        const f=[...document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]')];
        return { widget: !!(f.length || document.querySelector('.cf-turnstile, [data-sitekey]')), frames: f.map(x=>String(x.src).slice(0,80)) };
      })()`,
    }[type];
    let last = null;
    while (now() < deadline) {
      try {
        last = await evalIn(this.cdp, hostSid, probe);
        if (last && last.widget) return last;
      } catch {}
      await sleep(1000);
      const hasFrame = (await this.targets()).some((t) => {
        if (type === 'recaptcha2') return isV2Frame(t);
        if (type === 'hcaptcha') return /hcaptcha\.com/.test(t.url || '');
        return /challenges\.cloudflare\.com/.test(t.url || '');
      });
      if (hasFrame) return { widget: true, frames: ['target'] };
    }
    return last || { widget: false, frames: [] };
  }

  // ---- reCAPTCHA v2 -------------------------------------------------------

  /**
   * Widget frames come in two shapes, and both must work:
   *   - OOPIF targets (id.io.net + www.google.com → separate targets),
   *   - same-process child frames (a www.google.com page hosting a www.google.com
   *     widget → no target at all, but `contentDocument` is reachable).
   * Inline frames get a stable id so later evals can address them.
   */
  async rc2Frames(hostSid) {
    const tagged = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const fs=[...document.querySelectorAll('iframe[src*="recaptcha"]')];
        const pick=(re)=>{ const f=fs.find(x=>re.test(String(x.src)) && (()=>{try{return !!x.contentDocument}catch(e){return false}})()); if(!f) return null; if(!f.id) f.id='omp-'+Math.random().toString(36).slice(2,8); const r=f.getBoundingClientRect(); return {id:f.id, x:r.x, y:r.y, w:r.width, h:r.height, src:String(f.src).slice(0,90)}; };
        return { anchor: pick(/anchor/), bframe: pick(/bframe/) };
      })()`
    ).catch(() => ({ anchor: null, bframe: null }));
    return tagged || { anchor: null, bframe: null };
  }

  /** Checkbox (or invisible badge) inside a same-process anchor frame. */
  async rc2InlineAnchor(hostSid, frameId) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const f=document.getElementById(${JSON.stringify(frameId)});
        const d=f && f.contentDocument;
        if(!d) return null;
        const fr=f.getBoundingClientRect();
        const pierce=(sel)=>{ const found=[]; const visit=(root)=>{ try{ found.push(...root.querySelectorAll(sel)); }catch(e){}
          let kids=[]; try{ kids=[...root.querySelectorAll('*')]; }catch(e){} for (const el of kids) if (el.shadowRoot) visit(el.shadowRoot); }; visit(d); return found; };
        const cb = d.querySelector('.recaptcha-checkbox') || pierce('.recaptcha-checkbox')[0] || pierce('input[type=checkbox]')[0] || pierce('[role=checkbox]')[0];
        const invisible = !!(d.querySelector('.rc-anchor-invisible, .rc-anchor-invisible-text'));
        if (cb) { const r=cb.getBoundingClientRect(); return { kind:'checkbox', box:{ x: Math.round(fr.x+r.x+r.width/2), y: Math.round(fr.y+r.y+r.height/2) } }; }
        if (invisible) return { kind:'invisible', box:null };
        const cont=d.querySelector('#rc-anchor-container, .rc-anchor');
        if (cont) { const r=cont.getBoundingClientRect(); return { kind:'container', box:{ x: Math.round(fr.x+r.x+28), y: Math.round(fr.y+r.y+r.height/2) } }; }
        return { kind:'unknown', box:null };
      })()`
    ).catch(() => null);
  }

  /** Challenge dump for a same-process bframe, in *page* coordinates. */
  async rc2InlineDump(hostSid, frameId) {
    const d = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const f=document.getElementById(${JSON.stringify(frameId)});
        const doc=f && f.contentDocument;
        if(!doc) return { error:'no contentDocument' };
        const fr=f.getBoundingClientRect();
        const one=(sel)=>{ try { return doc.querySelector(sel); } catch(e){ return null; } };
        const ts=[...doc.querySelectorAll('.rc-imageselect-tile')];
        const tiles=ts.map(t=>{const r=t.getBoundingClientRect();return {x:Math.round(fr.x+r.x),y:Math.round(fr.y+r.y),w:Math.round(r.width),h:Math.round(r.height),sel:/selected/.test(t.className||'')};});
        const vb=one('#recaptcha-verify-button'); const vbr=vb? vb.getBoundingClientRect():null;
        const rel=one('#recaptcha-reload-button'); const relr=rel? rel.getBoundingClientRect():null;
        const instr=one('.rc-imageselect-desc-wrapper, .rc-imageselect-desc-no-canonical, .rc-imageselect-desc');
        const err=one('.rc-imageselect-error-select-more, .rc-imageselect-error, .rc-imageselect-incorrect-response');
        const big=[...doc.querySelectorAll('img')].filter(i=>i.naturalWidth>40).sort((a,b)=>b.naturalWidth-a.naturalWidth)[0];
        return {
          instr: instr? instr.innerText.replace(/\\n/g,' ').trim():null,
          err: err? err.innerText.replace(/\\n/g,' ').trim():null,
          tiles, imgW: big?big.naturalWidth:0, imgH: big?big.naturalHeight:0,
          verify: vbr? {x:Math.round(fr.x+vbr.x+vbr.width/2), y:Math.round(fr.y+vbr.y+vbr.height/2)}:null,
          reload: relr? {x:Math.round(fr.x+relr.x+relr.width/2), y:Math.round(fr.y+relr.y+relr.height/2)}:null,
          imgKey: big? String(big.src).slice(40,140):null,
        };
      })()`
    ).catch((e) => ({ error: e.message }));
    d.hostSid = hostSid;
    return d;
  }

  async rc2State(hostSid) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const q=(s)=>document.querySelector(s);
        const ta=q('textarea[name="g-recaptcha-response"], #g-recaptcha-response');
        const anchors=[...document.querySelectorAll('iframe[src*="recaptcha"][src*="anchor"]')].map(f=>{const r=f.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
        return { url: location.href, title: document.title, token: ta? (ta.value||'') : '', anchors };
      })()`
    );
  }

  /**
   * The anchor frame is either a checkbox widget or the *invisible* badge
   * (measured on id.io.net/login: `DIV.rc-anchor-invisible-text`, no checkbox in
   * the DOM at all). Only the checkbox variant is clickable; the invisible one is
   * triggered through the site's own `grecaptcha.execute()`.
   */
  /**
   * Enterprise anchors put the checkbox inside a *closed* shadow root, which
   * `el.shadowRoot` cannot reach. CDP can: `DOM.getDocument {pierce:true}` walks
   * into shadow trees and `DOM.getBoxModel` returns the box in frame coordinates.
   */
  async rc2AnchorBoxViaDom(sid) {
    try {
      const { root } = await this.cdp.send('DOM.getDocument', { depth: -1, pierce: true }, sid);
      const wanted = [];
      const walk = (n) => {
        if (!n) return;
        const attrs = n.attributes || [];
        const attr = (k) => {
          const i = attrs.indexOf(k);
          return i === -1 ? '' : attrs[i + 1];
        };
        const cls = attr('class');
        const role = attr('role');
        const id = attr('id');
        if (/checkbox/i.test(cls) || role === 'checkbox' || /checkbox/i.test(id)) {
          if (n.nodeName === 'SPAN' || n.nodeName === 'DIV' || n.nodeName === 'INPUT' || n.nodeName === 'LABEL') wanted.push(n.nodeId);
        }
        (n.children || []).forEach(walk);
        (n.shadowRoots || []).forEach(walk);
        if (n.contentDocument) walk(n.contentDocument);
      };
      walk(root);
      for (const nodeId of wanted) {
        try {
          const { model } = await this.cdp.send('DOM.getBoxModel', { nodeId }, sid);
          const q = model.content;
          const w = Math.max(model.width, 1);
          const h = Math.max(model.height, 1);
          if (w > 400 || h > 400) continue; // the whole widget, not the box
          return { x: Math.round((q[0] + q[2]) / 2), y: Math.round((q[1] + q[5]) / 2), w: Math.round(w), h: Math.round(h), how: 'dom-pierce' };
        } catch {}
      }
    } catch {}
    return null;
  }

  async rc2AnchorKind() {
    const an = (await this.targets()).filter((t) => isV2Frame(t) && /anchor/.test(t.url)).pop();
    if (!an) return { kind: 'none', target: null };
    const sid = await attach(this.cdp, an.targetId);
    const info = await evalIn(
      this.cdp,
      sid,
      `(() => {
        const pierce=(sel)=>{ const found=[]; const visit=(root)=>{ try{ found.push(...root.querySelectorAll(sel)); }catch(e){}
          let kids=[]; try{ kids=[...root.querySelectorAll('*')]; }catch(e){} for (const el of kids) if (el.shadowRoot) visit(el.shadowRoot); }; visit(document); return found; };
        const center=(e)=>{ const r=e.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), w:Math.round(r.width), h:Math.round(r.height)}; };
        const cb = document.querySelector('.recaptcha-checkbox') || pierce('.recaptcha-checkbox')[0] || pierce('input[type=checkbox]')[0] || pierce('[role=checkbox]')[0];
        const invisible = !!(document.querySelector('.rc-anchor-invisible, .rc-anchor-invisible-text') || pierce('.rc-anchor-invisible')[0]);
        const cont = document.querySelector('#rc-anchor-container, .rc-anchor') || pierce('#rc-anchor-container')[0];
        if (cb) return { kind:'checkbox', box:{ ...center(cb) } };
        if (invisible) return { kind:'invisible', box: cont? { ...center(cont) } : null };
        if (cont) return { kind:'container', box:{ x: Math.round(cont.getBoundingClientRect().x+28), y: Math.round(cont.getBoundingClientRect().y+cont.getBoundingClientRect().height/2), w: Math.round(cont.getBoundingClientRect().width), h: Math.round(cont.getBoundingClientRect().height) } };
        return { kind:'unknown', box: { x: 28, y: Math.round(innerHeight/2), w: innerWidth, h: innerHeight } };
      })()`
    ).catch(() => ({ kind: 'error', box: null }));
    if (info && (info.kind === 'unknown' || info.kind === 'error')) {
      const box = await this.rc2AnchorBoxViaDom(sid);
      if (box) return { kind: 'checkbox', box, sid, target: an, via: 'dom-pierce' };
    }
    return { ...info, sid, target: an };
  }

  /**
   * Last-resort anchor click in *page* coordinates: the iframe is visible on the
   * caller's page, so a page-session Input event reaches whatever is at that point
   * even when the frame is cross-origin with no CDP target of its own. This is the
   * path that raises the challenge on a plain v2 checkbox page in reuse/native mode,
   * where `grecaptcha.execute` does not exist.
   */
  async rc2ClickAnchorByPageRect(hostSid) {
    const box = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const f=[...document.querySelectorAll('iframe[src*="recaptcha"]')].find(x=>/anchor/.test(String(x.src)));
        if (!f) return null;
        const r=f.getBoundingClientRect();
        if (r.width < 20 || r.height < 10) return null;
        return { x: Math.round(r.x + Math.min(28, r.width/2)), y: Math.round(r.y + r.height/2), w: Math.round(r.width), h: Math.round(r.height) };
      })()`
    ).catch(() => null);
    if (!box) return false;
    this.log(`  anchor-rect click ${box.x},${box.y} (${box.w}x${box.h}, page coordinates)`);
    await clickIn(this.cdp, hostSid, box.x, box.y);
    return true;
  }

  /**
   * Reload the challenge grid by dispatching at **page coordinates**.
   *
   * Measured on the ScrapingBee login widget: the challenge was only raised by
   * the `anchor:checkbox` page-rect fallback after frame-session clicks did
   * nothing — so a reload that only clicks inside the frame session can fire
   * zero events, and the caller then reads "pixels never changed" as a frozen
   * challenge. The button's rect is read through the frame session (the only
   * place its DOM exists) and the frame element's page offset is read through
   * the host session; the click goes to the host session, where the browser
   * routes it to whatever frame is under the point.
   */
  async rc2ReloadByPageRect(hostSid, bfTarget) {
    let btn = null;
    try {
      const sid = bfTarget ? await attach(this.cdp, bfTarget.targetId) : null;
      if (sid) {
        btn = await evalIn(
          this.cdp,
          sid,
          `(() => { const b=document.querySelector('#recaptcha-reload-button'); if(!b) return null; const r=b.getBoundingClientRect(); if (r.width<4||r.height<4) return null; return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}; })()`
        );
      }
    } catch {}
    if (!btn) return false;
    const off = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const f=[...document.querySelectorAll('iframe[src*="recaptcha"]')].find(x=>/bframe/.test(String(x.src)));
        if (!f) return null;
        const r=f.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return null;
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })()`
    ).catch(() => null);
    if (!off) return false;
    this.log(`  reload page-rect click ${off.x + btn.x},${off.y + btn.y} (frame ${off.w}x${off.h} at ${off.x},${off.y})`);
    await clickIn(this.cdp, hostSid, off.x + btn.x, off.y + btn.y);
    return true;
  }

  /** Fire the site's own invisible widget — same call the page's button makes. */
  async rc2Execute(hostSid) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) return { ok:false, why:'no-grecaptcha-execute' };
        let id = 0;
        try { const c = window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients; if (c) { const ks=Object.keys(c); if (ks.length) id = Number(ks[0]); } } catch(e) {}
        try { grecaptcha.execute(id); return { ok:true, id }; } catch(e) { return { ok:false, why:String(e && e.message || e) }; }
      })()`
    ).catch((e) => ({ ok: false, why: e.message }));
  }

  /** Dump the bframe challenge through the frame's own session (OOPIF-native). */
  async rc2Dump(bfTarget) {
    const sid = await attach(this.cdp, bfTarget.targetId);
    const d = await evalIn(
      this.cdp,
      sid,
      `(() => {
        const pierce=(sel)=>{
          const found=[];
          const visit=(root)=>{ try{ found.push(...root.querySelectorAll(sel)); }catch(e){}
            let kids=[]; try{ kids=[...root.querySelectorAll('*')]; }catch(e){}
            for (const el of kids) if (el.shadowRoot) visit(el.shadowRoot); };
          visit(document);
          return found;
        };
        const one=(sel)=>{ const a=[...document.querySelectorAll(sel)]; return a.length? a[0] : pierce(sel)[0] || null; };
        const many=(sel)=>{ const a=[...document.querySelectorAll(sel)]; return a.length? a : pierce(sel); };
        const instrEl=one('.rc-imageselect-desc-wrapper, .rc-imageselect-desc-no-canonical, .rc-imageselect-desc');
        const errEl=one('.rc-imageselect-error-select-more, .rc-imageselect-error, .rc-imageselect-incorrect-response');
        const tiles=many('.rc-imageselect-tile').map(t=>{const r=t.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),sel:/selected/.test(t.className||'')};});
        const vb=one('#recaptcha-verify-button');
        const vbr=vb? vb.getBoundingClientRect():null;
        const rel=one('#recaptcha-reload-button');
        const relr=rel? rel.getBoundingClientRect():null;
        const big=[...document.querySelectorAll('img')].filter(i=>i.naturalWidth>40).sort((a,b)=>b.naturalWidth-a.naturalWidth)[0];
        let data=null, w=0, h=0;
        try{ if(big){w=big.naturalWidth;h=big.naturalHeight;const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(big,0,0);data=c.toDataURL('image/png');} }catch(e){}
        return {
          instr: instrEl? instrEl.innerText.replace(/\\n/g,' ').trim() : null,
          err: errEl? errEl.innerText.replace(/\\n/g,' ').trim() : null,
          tiles, imgW:w, imgH:h, img:data,
          verify: vbr? {x:Math.round(vbr.x+vbr.width/2), y:Math.round(vbr.y+vbr.height/2)} : null,
          reload: relr? {x:Math.round(relr.x+relr.width/2), y:Math.round(relr.y+relr.height/2)} : null,
          imgKey: big? String(big.src).slice(40,140) : null,
          vp:{w:innerWidth,h:innerHeight},
        };
      })()`
    );
    d.sid = sid;
    return d;
  }

  /**
   * Round PNG. `Page.captureScreenshot` is top-level-only ("Command can only be
   * executed on top-level targets" — measured on both the anchor and bframe
   * targets), so the image is composed *inside* the challenge frame on a canvas:
   * the payload sprite (or each tile's own image) plus green index labels.
   */
  async composeChallenge(sid, tileSel, file, rootId) {
    const res = await evalIn(
      this.cdp,
      sid,
      `(async () => {
        const frameEl = ${rootId ? `document.getElementById(${JSON.stringify(rootId)})` : 'null'};
        const doc = frameEl ? frameEl.contentDocument : document;
        if (!doc) return null;
        const tiles=[...doc.querySelectorAll(${JSON.stringify(tileSel)})];
        if(!tiles.length) return null;
        const rects=tiles.map(t=>({x:t.getBoundingClientRect().x, y:t.getBoundingClientRect().y, w:t.getBoundingClientRect().width, h:t.getBoundingClientRect().height}));
        const cols=new Set(rects.map(r=>Math.round(r.x))).size || 3;
        const rows=Math.ceil(rects.length/cols);
        const cw=Math.round(Math.max(...rects.map(r=>r.w))) || 100;
        const ch=Math.round(Math.max(...rects.map(r=>r.h))) || 100;
        const canvas=document.createElement('canvas');
        canvas.width=cols*cw; canvas.height=rows*ch;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        const load=(u)=>new Promise((res)=>{ if(!u) return res(null); const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=u; });
        const px=(v)=>{ const n=parseFloat(v); return Number.isFinite(n)? n:0; };
        // 1) the whole payload sprite, if the frame has one big image (reCAPTCHA)
        const big=[...doc.querySelectorAll('img')].filter(i=>i.naturalWidth>40).sort((a,b)=>b.naturalWidth-a.naturalWidth)[0];
        let used=false;
        if (big && big.naturalWidth >= cw*1.5) {
          const im=await load(big.src);
          if (im) {
            const r0=big.getBoundingClientRect();
            const sx=im.naturalWidth/Math.max(1,r0.width), sy=im.naturalHeight/Math.max(1,r0.height);
            ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, cols*cw, rows*ch);
            used=true;
            for (let i=0;i<rects.length;i++){
              const r=rects[i];
              const dx=Math.round((r.x-r0.x)*sx/ (im.naturalWidth/(cols*cw)));
              const dy=Math.round((r.y-r0.y)*sy/ (im.naturalHeight/(rows*ch)));
              drawLabel(ctx, i, dx, dy, cw, ch);
            }
          }
        }
        if (!used) {
          // 2) per-tile images / background sprites (hCaptcha, reCAPTCHA fallback)
          for (let i=0;i<tiles.length;i++){
            const t=tiles[i]; const r=rects[i];
            const dx=(i%cols)*cw, dy=Math.floor(i/cols)*ch;
            const child=t.querySelector('img');
            let im=null, sx=0, sy=0, sw=0, sh=0;
            if (child && child.src) { im=await load(child.src); sw=child.naturalWidth||cw; sh=child.naturalHeight||ch; }
            else {
              const cs=getComputedStyle(t);
              let url=(cs.backgroundImage.match(/url\\("?([^")]+)"?\\)/)||[])[1];
              if(!url){ const c2=[...t.querySelectorAll('*')].find(e=>/url\\(/.test(getComputedStyle(e).backgroundImage)); if(c2){ const cs2=getComputedStyle(c2); url=(cs2.backgroundImage.match(/url\\("?([^")]+)"?\\)/)||[])[1]; } }
              if (url) { im=await load(url); sx=Math.abs(px(cs.backgroundPosition.split(' ')[0])); sy=Math.abs(px(cs.backgroundPosition.split(' ')[1]||'0')); sw=cw; sh=ch; }
            }
            if (im) { try { ctx.drawImage(im, sx, sy, sw, sh, dx, dy, cw, ch); } catch(e) {} }
            drawLabel(ctx, i, dx, dy, cw, ch);
          }
        }
        function drawLabel(ctx, i, dx, dy, cw, ch){
          const s=Math.max(16, Math.round(cw*0.22));
          ctx.font='bold '+s+'px monospace';
          const txt=String(i);
          const w=ctx.measureText(txt).width+10, h=s+10;
          ctx.fillStyle='rgba(0,0,0,0.8)';
          ctx.fillRect(dx+3, dy+3, w, h);
          ctx.strokeStyle='#0f0'; ctx.lineWidth=2; ctx.strokeRect(dx+3, dy+3, w, h);
          ctx.fillStyle='#0f0';
          ctx.fillText(txt, dx+8, dy+3+s);
        }
        // The same tick that produced the PNG also reports the live tile
        // geometry and selection state: the clicked rects can then never come
        // from a *different* (pre-re-randomisation) grid than the image the
        // model looked at. Offsets are page-space for inline frames.
        const off = frameEl ? frameEl.getBoundingClientRect() : { x: 0, y: 0 };
        const live = tiles.map((t, i) => ({
          x: Math.round(rects[i].x + off.x), y: Math.round(rects[i].y + off.y),
          w: Math.round(rects[i].w), h: Math.round(rects[i].h),
          sel: /selected/.test(t.className || ''),
        }));
        // Identity of the *visible* challenge, not of its DOM: a reload that
        // leaves the pixels untouched must be detectable (measured: five
        // byte-identical composites made the model answer [7] five times).
        let imgKey = null;
        try {
          const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let h = 2166136261 >>> 0;
          for (let i = 0; i < px.length; i += 97) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; }
          imgKey = 'px:' + h.toString(16);
        } catch (e) {
          // Tainted canvas (cross-origin sprite without CORS): fall back to the
          // sprite URLs, which do change when the challenge is re-issued.
          imgKey = 'dom:' + rects.length + ':' + [...doc.querySelectorAll('img[src]')]
            .map((i) => String(i.src).slice(0, 160)).join('|');
        }
        return { data: canvas.toDataURL('image/png'), imgKey, w: canvas.width, h: canvas.height, cols, rows, tiles: rects.length, live };
      })()`,
      { awaitPromise: true }
    );
    if (!res || !res.data) throw new Error('no round image (composite failed)');
    fs.writeFileSync(file, Buffer.from(res.data.split(',')[1], 'base64'));
    return { file, imgKey: res.imgKey, live: res.live, source: 'canvas-composite', numbered: true, cols: res.cols, rows: res.rows };
  }

  /**
   * One challenge round, driven through an adapter that hides the OOPIF /
   * same-process difference:
   *   adapter = { dump(), click(x,y), compose(file), reload() }
   */
  async solveRound(adapter, { roundNo, shotDir, kindHint = 'recaptcha2' }) {
    const started = now();
    // The bframe object appears before its grid renders (measured: an inline
    // challenge frame was up with zero tiles for ~1 s), so poll before failing.
    let d = null;
    for (let i = 0; i < 14; i++) {
      d = await adapter.dump().catch((e) => ({ error: e.message }));
      if (d && d.tiles && d.tiles.length) break;
      await sleep(700);
    }
    if (!d || !d.tiles || !d.tiles.length) throw new Error('challenge frame without tiles' + (d && d.error ? ': ' + d.error : ''));
    const cols = new Set(d.tiles.map((t) => t.x)).size || (d.tiles.length === 16 ? 4 : 3);
    const rows = Math.ceil(d.tiles.length / cols);
    const shot = path.join(shotDir, `round-${roundNo}.png`);
    const img = await adapter.compose(shot);
    const live = img.live && img.live.length === d.tiles.length ? img.live : d.tiles;
    const answer = await this.brain.ask({ pngPath: shot, instruction: d.instr, rows, cols, numbered: img.numbered !== false, kindHint });
    const tiles = (answer.tiles || []).filter((i) => i >= 0 && i < d.tiles.length);
    const illegal = (answer.tiles || []).filter((i) => !(i >= 0 && i < d.tiles.length));
    if (illegal.length) this.log(`  dropped out-of-range indices [${illegal}]`);
    if (answer.refresh || (!tiles.length && !(answer.tiles || []).length)) {
      this.log('  model says "none match" -> refresh');
      return { result: 'refresh', tiles: [], instruction: d.instr, shot, imgKey: img.imgKey, model: answer.model, brainMs: answer.ms, ms: now() - started, rows, cols };
    }
    // "Everything matches" is never a real answer for a select-all-X challenge and
    // the grader rejects it (measured: Cohere Aya Vision spam), so refresh instead
    // of burning the round on a guaranteed rejection.
    if (tiles.length === d.tiles.length && d.tiles.length > 1) {
      this.log(`  model selected all ${d.tiles.length} tiles -> refresh`);
      return { result: 'refresh', tiles, instruction: d.instr, shot, imgKey: img.imgKey, model: answer.model, brainMs: answer.ms, ms: now() - started, rows, cols, allTiles: true };
    }
    // A model that answers with the same set on a *different* image is guessing
    // (or defaulting): refuse it instead of spending the round on it.
    const answerKey = tiles.join(',');
    const keyForImage = img.imgKey || d.imgKey || d.instr || shot;
    const seenOn = this.answerKeys.get(answerKey);
    if (seenOn && seenOn !== keyForImage) {
      this.log(`  answer [${answerKey}] was already returned for another image -> refresh`);
      return { result: 'refresh', tiles, instruction: d.instr, shot, imgKey: img.imgKey, model: answer.model, brainMs: answer.ms, ms: now() - started, rows, cols, repeatedAnswer: true };
    }
    this.answerKeys.set(answerKey, keyForImage);
    // Deselect anything already selected that the model did not name (re-offer rounds).
    const clickSet = async (idx) => {
      for (const i of idx) {
        const t = live[i];
        if (!t) continue;
        await adapter.click(t.x + t.w / 2, t.y + t.h / 2);
        await sleep(220);
      }
    };
    for (let i = 0; i < live.length; i++) if (live[i].sel && !tiles.includes(i)) await clickSet([i]);
    await clickSet(tiles.filter((i) => !live[i] || !live[i].sel));
    // The grid can reorder between the dump and the clicks; read the selection
    // back from the live DOM so we press verify on the set we actually chose.
    const after = await adapter.dump().catch(() => null);
    if (after && after.tiles && after.tiles.length === live.length) {
      const got = after.tiles.map((t, i) => (t.sel ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b).join(',');
      const want = [...tiles].sort((a, b) => a - b).join(',');
      if (got !== want) {
        this.log(`  selection mismatch (want [${want}], live [${got}]) -> re-clicking once`);
        await clickSet(tiles);
      }
    }
    if (d.verify) {
      await sleep(150);
      await adapter.click(d.verify.x, d.verify.y);
    }
    return {
      result: 'submitted',
      tiles,
      instruction: d.instr,
      err: d.err || null,
      shot,
      model: answer.model,
      brainMs: answer.ms,
      confidence: answer.confidence,
      reason: answer.reason,
      imgKey: img.imgKey || d.imgKey,
      ms: now() - started,
      rows,
      cols,
    };
  }

  async rc2Reload(bfTarget) {
    try {
      const sid = await attach(this.cdp, bfTarget.targetId);
      const box = await evalIn(
        this.cdp,
        sid,
        `(() => { const b=document.querySelector('#recaptcha-reload-button'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`
      );
      if (box) {
        await clickIn(this.cdp, sid, box.x, box.y);
        return true;
      }
    } catch {}
    return false;
  }

  rc2WaitBframe(timeoutMs = 9000, since = 0) {
    const deadline = now() + timeoutMs;
    return (async () => {
      while (now() < deadline) {
        const all = (await this.targets()).filter((t) => isV2Frame(t) && /bframe/.test(t.url || ''));
        const fresh = all.filter((t) => !since || (t.lastActiveTime || 0) >= since);
        if (fresh.length) return fresh[fresh.length - 1];
        if (all.length) return all[all.length - 1];
        await sleep(500);
      }
      return null;
    })();
  }

  // ---- hCaptcha ----------------------------------------------------------

  async hcChallengeTarget() {
    const all = await this.targets();
    const cands = all.filter((t) => /hcaptcha\.com/.test(t.url || '') && /(frame=challenge|frame=draw|challenge)/.test(t.url || ''));
    return cands.pop() || all.filter((t) => /hcaptcha\.com/.test(t.url || '')).pop() || null;
  }

  /**
   * hCaptcha checkbox. Three shapes, same order of preference as reCAPTCHA:
   * the checkbox iframe as its own OOPIF target, a same-process frame reachable
   * through `contentDocument`, or a geometric fallback inside the frame box (the
   * checkbox sits at ~(25, h/2) of the standard 300×74 widget).
   */
  async hcClickCheckbox(hostSid) {
    const cbTarget = (await this.targets()).find((x) => /hcaptcha\.com/.test(x.url || '') && /(checkbox|frame=checkbox)/.test(x.url || ''));
    if (cbTarget) {
      const sid = await attach(this.cdp, cbTarget.targetId);
      const box = await evalIn(
        this.cdp,
        sid,
        `(() => {
          const el = document.querySelector('#checkbox, div[role=checkbox], .check, label');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), w: Math.round(r.width), h: Math.round(r.height), how: 'oopif' };
        })()`
      ).catch(() => null);
      if (box) {
        this.log(`  hcaptcha checkbox ${box.x},${box.y} (${box.how} ${box.w}x${box.h})`);
        await clickIn(this.cdp, sid, box.x, box.y);
        return true;
      }
    }
    const box = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const f = [...document.querySelectorAll('iframe[src*="hcaptcha.com"]')].filter(x => /checkbox/.test(x.src || ''))[0]
               || [...document.querySelectorAll('iframe[src*="hcaptcha.com"]')][0];
        if (!f) return null;
        const r = f.getBoundingClientRect();
        let inner = null;
        try { const d = f.contentDocument; const el = d && d.querySelector('#checkbox, div[role=checkbox]'); if (el) { const ir = el.getBoundingClientRect(); inner = { x: r.x + ir.x + ir.width/2, y: r.y + ir.y + ir.height/2 }; } } catch (e) {}
        return inner ? { ...inner, how: 'inline', w: Math.round(r.width), h: Math.round(r.height) }
                     : { x: Math.round(r.x + 25), y: Math.round(r.y + r.height/2), how: 'geometry', w: Math.round(r.width), h: Math.round(r.height) };
      })()`
    ).catch(() => null);
    if (!box) return false;
    this.log(`  hcaptcha checkbox ${box.x},${box.y} (${box.how} ${box.w}x${box.h})`);
    await clickIn(this.cdp, hostSid, box.x, box.y);
    return true;
  }

  /** hCaptcha invisible widgets only produce a challenge when the page asks for one. */
  async hcTrigger(hostSid) {
    return evalIn(
      this.cdp,
      hostSid,
      `(() => {
        if (typeof hcaptcha === 'undefined') return { ok:false, why:'no-hcaptcha-global' };
        const el = document.querySelector('[data-hcaptcha-widget-id]');
        const id = el ? el.getAttribute('data-hcaptcha-widget-id') : null;
        try {
          if (id && hcaptcha.execute) { hcaptcha.execute(id); return { ok:true, id }; }
          if (hcaptcha.execute) { hcaptcha.execute(); return { ok:true, id:'auto' }; }
        } catch (e) { return { ok:false, why:String((e && e.message) || e) }; }
        return { ok:false, why:'no-execute' };
      })()`
    ).catch((e) => ({ ok: false, why: e.message }));
  }

  async hcDump(target) {
    const sid = await attach(this.cdp, target.targetId);
    const d = await evalIn(
      this.cdp,
      sid,
      `(() => {
        const instr=document.querySelector('.prompt-text, .challenge-prompt, .prompt') || null;
        const tiles=[...document.querySelectorAll('.task-image, .image-grid .task, .image-grid div[class*="task"], .task-grid div, .challenge-container .image-grid > div')].map(t=>{const r=t.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};});
        // hCaptcha's centre button is a link to hcaptcha.com; the real submit sits
        // on the right ("Sonraki"/"Kontrol et"/"Next"/"Verify"). Never click the centre.
        const btns=[...document.querySelectorAll('button, [role="button"], input[type="submit"], .button-submit, a')]
          .map(b=>{const r=b.getBoundingClientRect();return {tag:b.tagName, text:String(b.innerText||b.value||'').replace(/\\s+/g,' ').trim().slice(0,30), x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), cx:Math.round(r.x+r.width/2), cy:Math.round(r.y+r.height/2)};})
          .filter(b=>b.w>10 && b.h>8);
        const labelled=btns.filter(b=>/sonraki|kontrol|next|verify|submit|doğrula|ileri|skip/i.test(b.text));
        const pick=(labelled.filter(b=>b.tag!=='A').sort((a,b)=>b.cx-a.cx)[0]) || (labelled[0]) || null;
        const big=btns.filter(b=>b.tag!=='A' && b.w>=120).sort((a,b)=>b.cx-a.cx)[0] || null;
        const verify = pick || big;
        return {instr: instr? instr.innerText.replace(/\\n/g,' ').trim():null, tiles,
                verify: verify? {x:verify.cx, y:verify.cy, text:verify.text, tag:verify.tag}:null,
                buttons: btns.slice(0,12)};
      })()`
    );
    d.sid = sid;
    return d;
  }

  // ---- Turnstile ---------------------------------------------------------

  async tsClick(hostSid, { preferMountHost = false } = {}) {
    // 2-click solve: focus the widget, click the checkbox, then click again if the
    // challenge stays up (Cloudflare managed mode wants a second, deliberate click).
    // `preferMountHost` targets the widget *we* mounted (`#omp-mount-host`): with a
    // native widget on the page as well, the first `challenges.cloudflare.com` frame
    // belongs to the site's own widget — measured 2026-10-15 on a sibling panel, where the
    // page widget logged `interactiveTimeout` while the mount widget logged only
    // keep-alive `food` events, i.e. every click had gone to the wrong iframe.
    const box = await evalIn(
      this.cdp,
      hostSid,
      `(() => {
        const inHost = document.querySelector('#omp-mount-host iframe[src*="challenges.cloudflare.com"]');
        const first = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        const f = ${preferMountHost} ? (inHost || first) : (first || inHost);
        if(!f) return null;
        const r=f.getBoundingClientRect();
        return {x:Math.round(r.x+r.width*0.14), y:Math.round(r.y+r.height/2), full:{x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}, mine: f === inHost};
      })()`
    );
    if (!box) return false;
    await clickIn(this.cdp, hostSid, box.x, box.y);
    return true;
  }
}

// ------------------------------------------------------------ page plumbing

class PageRun {
  constructor(cdp, { proxyLine, brain, log, reuseTargetId }) {
    this.cdp = cdp;
    this.proxyLine = proxyLine;
    this.brain = brain;
    this.log = log;
    this.reuseTargetId = reuseTargetId || null;
  }

  /**
   * Reuse mode drives a page a caller already owns (its form, its context, its
   * exit). We attach, we never navigate — the token has to land in *that* DOM,
   * and the caller's state must survive — and `close()` only detaches.
   */
  async open(url) {
    if (this.reuseTargetId) {
      this.targetId = this.reuseTargetId;
      this.sid = await attach(this.cdp, this.targetId);
      await this.cdp.send('Network.enable', {}, this.sid).catch(() => null);
      this.reused = true;
      return this;
    }
    const proxy = this.proxyLine ? parseProxy(this.proxyLine) : null;
    const proxyServer = proxy ? browserUrl(proxy) : undefined;
    const ctx = await this.cdp.send('Target.createBrowserContext', { proxyServer, disposeOnDetach: false });
    this.browserContextId = ctx.browserContextId;
    const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank', browserContextId: this.browserContextId });
    this.targetId = targetId;
    this.sid = await attach(this.cdp, targetId);
    await this.cdp.send('Network.enable', {}, this.sid).catch(() => null);
    const loaded = this.cdp.waitFor('Page.loadEventFired', { timeoutMs: 60000, sessionId: this.sid }).catch(() => null);
    await this.cdp.send('Page.navigate', { url }, this.sid);
    await loaded;
    return this;
  }

  async close() {
    if (this.reused) return; // the caller's tab is not ours to close
    try {
      await this.cdp.send('Target.closeTarget', { targetId: this.targetId });
    } catch {}
    try {
      await this.cdp.send('Target.disposeBrowserContext', { browserContextId: this.browserContextId });
    } catch {}
  }

  token(selectorExpr) {
    return evalIn(this.cdp, this.sid, `(() => { ${selectorExpr} })()`);
  }

  async waitToken(selectorExpr, timeoutMs) {
    const deadline = now() + timeoutMs;
    while (now() < deadline) {
      const t = await this.token(selectorExpr).catch(() => '');
      if (t && t.length > 20) return t;
      await sleep(400);
    }
    return '';
  }
}

const HC_TILE_SEL = '.task-image, .image-grid .task, .image-grid div[class*="task"], .image-grid div[class*="image"], .task-grid div, .challenge-container .image-grid > div';

const TOKEN_SEL = {
  recaptcha2: `const t=document.querySelector('textarea[name="g-recaptcha-response"], #g-recaptcha-response'); return t? (t.value||'') : '';`,
  hcaptcha: `const t=document.querySelector('textarea[name="h-captcha-response"], [name="h-captcha-response"]'); return t? (t.value||'') : '';`,
  turnstile: `const t=document.querySelector('[name="cf-turnstile-response"]'); return t? (t.value||'') : '';`,
};

// ------------------------------------------------------------------- drivers

/** Hides the OOPIF / same-process-iframe difference behind one interface. */
function makeFrameAdapter({ solver, cdp, hostSid, kind, ref }) {
  let session = hostSid;
  const a = {
    kind,
    async dump() {
      if (kind === 'oopif') {
        const d = await solver.rc2Dump(ref);
        session = d.sid;
        return d;
      }
      session = hostSid;
      return solver.rc2InlineDump(hostSid, ref);
    },
    click(x, y) {
      return clickIn(cdp, session, x, y);
    },
    compose(file) {
      return kind === 'oopif'
        ? solver.composeChallenge(session, '.rc-imageselect-tile', file)
        : solver.composeChallenge(hostSid, '.rc-imageselect-tile', file, ref);
    },
    async reload() {
      if (kind === 'oopif') return solver.rc2Reload(ref);
      const d = await a.dump().catch(() => null);
      if (d && d.reload) {
        await a.click(d.reload.x, d.reload.y);
        return true;
      }
      return false;
    },
    /** Same intent, page-coordinate dispatch — the widget's measured preference. */
    async reloadAlt() {
      if (kind !== 'oopif') return false;
      return solver.rc2ReloadByPageRect(hostSid, ref).catch(() => false);
    },
  };
  return a;
}

/**
 * Reload the challenge and *prove the visible image changed* before the next
 * round is read. Measured failure this fixes: five reload clicks left the
 * composite byte-identical (`515de3957b`, 374540 B ×5), so the model kept
 * answering tile 7 — correctly — on the same pixels, and the repeated-answer
 * guard burned every round on a frozen challenge. A reload that cannot be
 * shown to have changed anything is not a refresh; it is a stall, and it gets
 * named as one instead of being retried until tries run out.
 */
async function refreshUntilChanged({ adapter, solver, page, log, shotDir, roundNo, prevKey, reresolve }) {
  const probes = [];
  let ad = adapter;
  let reresolves = 0;
  let composeAttempts = 0;
  let composeFailures = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Alternate dispatch styles instead of repeating a failing one: the widget
    // measured on this toolchain takes the page-rect click, while others take the
    // frame-session click — a stall must mean "both failed", not "the one we
    // happened to pick failed three times".
    const useAlt = attempt >= 2 && typeof ad.reloadAlt === 'function';
    const reloaded = await (useAlt ? ad.reloadAlt() : ad.reload()).catch(() => false);
    log(`  refresh ${attempt}: ${reloaded ? (useAlt ? 'reload button (page-rect)' : 'reload button') : 'execute()'}`);
    if (!reloaded) await solver.rc2Execute(page.sid).catch(() => {});
    // If the alt style was unavailable or missed, retry the primary once here so
    // an attempt is never a no-op.
    if (useAlt && !reloaded) {
      const again = await ad.reload().catch(() => false);
      if (again) log(`  refresh ${attempt}: fell back to frame-session reload`);
    }
    let miss = 0;
    for (let i = 0; i < 12; i++) {
      await sleep(400);
      composeAttempts++;
      const img = await ad.compose(path.join(shotDir, `refresh-${roundNo}-${attempt}-${i + 1}.png`)).catch(() => null);
      if (!img || !img.imgKey) {
        composeFailures++;
        if (++miss >= 2 && reresolves < 4) {
          reresolves++;
          const next = await reresolve().catch(() => null);
          if (next) { ad = next; miss = 0; }
        }
        continue;
      }
      miss = 0;
      probes.push({ attempt, probe: i + 1, key: img.imgKey, changed: img.imgKey !== prevKey });
      if (img.imgKey !== prevKey) {
        log(`  refresh ${attempt}: image changed after ${(((i + 1) * 400) / 1000).toFixed(1)}s (${prevKey} -> ${img.imgKey})`);
        return { changed: true, key: img.imgKey, adapter: ad, probes, composeAttempts, composeFailures };
      }
    }
    log(`  refresh ${attempt}: image unchanged after 4.8s`);
  }
  // Two very different failures were being reported with one message: "pixels
  // never changed" (a readable grid that stayed identical) and "no readable grid
  // at all after the reload click" (measured: 0/12 probes, the frame left without
  // `.rc-imageselect-tile`). The second is not a frozen-image verdict, and saying
  // so overstated what the code had actually observed.
  if (!probes.length) {
    log(`  refresh UNREADABLE — 3 attempts, 0/${composeAttempts} probes readable (no challenge grid after the reload click; pixels were never compared)`);
    return { changed: false, key: prevKey, adapter: ad, probes, unreadable: true, composeAttempts, composeFailures };
  }
  log(`  refresh STALLED — 3 attempts, pixels never changed across ${probes.length}/${composeAttempts} readable probes (${prevKey}); stopping instead of looping on a frozen challenge`);
  return { changed: false, key: prevKey, adapter: ad, probes, composeAttempts, composeFailures };
}

/**
 * reCAPTCHA v2 driver. Two trigger shapes are supported:
 *   - OOPIF anchor target: click the checkbox (shadow-pierced, three fallbacks),
 *   - invisible badge (measured on id.io.net/login): fire the page's own
 *     grecaptcha.execute() and wait for the bframe challenge.
 * Frames are then solved through whichever adapter matches (OOPIF target or
 * same-process child frame, e.g. a www.google.com page hosting its own widget).
 */
async function solveRecaptcha2(cdp, page, { solver, shotDir, log }) {
  const t0 = now();
  const rounds = [];
  let tries = 0;
  const token = async () => page.token(TOKEN_SEL.recaptcha2).catch(() => '');
  const pre = await solver.rc2State(page.sid);
  if (pre.token && pre.token.length > 20) return { ok: true, token: pre.token, tries: 0, rounds, ms: now() - t0, mode: 'pre' };

  const oopifAnchor = (await solver.targets()).filter((t) => isV2Frame(t) && /anchor/.test(t.url || '')).pop();
  const inline = await solver.rc2Frames(page.sid);
  const mode = oopifAnchor ? 'oopif' : inline.anchor ? 'inline' : 'none';
  let trigger = `mode:${mode}`;
  if (mode === 'oopif') {
    const kind = await solver.rc2AnchorKind();
    trigger += `+anchor:${kind.kind}`;
    if (kind.kind === 'checkbox' && kind.box) log(`  anchor click ${kind.box.x},${kind.box.y}`);
    if (kind.kind === 'checkbox' && kind.box) await clickIn(cdp, kind.sid, kind.box.x, kind.box.y);
  } else if (mode === 'inline') {
    const info = await solver.rc2InlineAnchor(page.sid, inline.anchor.id);
    if (info) {
      trigger += `+anchor:${info.kind}`;
      if (info.kind === 'checkbox' && info.box) await clickIn(cdp, page.sid, info.box.x, info.box.y);
    }
  }

  let retriedKey = null; // one blind re-read per image, then force a new image
  const bframeOopif = async (ms) => (await solver.rc2WaitBframe(ms)) || null;
  const bframeInline = async (ms) => {
    const deadline = now() + ms;
    while (now() < deadline) {
      const f = await solver.rc2Frames(page.sid).catch(() => null);
      if (f && f.bframe) return f.bframe;
      await sleep(600);
    }
    return null;
  };
  const bframeNow = async () => (mode === 'inline' ? (await solver.rc2Frames(page.sid).catch(() => ({}))).bframe : null);

  let bfTarget = mode === 'oopif' ? await bframeOopif(mode === 'oopif' && trigger.includes('anchor:checkbox') ? 9000 : 3000) : null;
  let bfFrame = mode === 'inline' ? await bframeInline(3000) : null;
  if (!bfTarget && !bfFrame && (mode === 'none' || trigger.includes('anchor:none'))) {
    // v2 checkbox pages have no `grecaptcha.execute`; the raise is the click.
    const clickedRect = await solver.rc2ClickAnchorByPageRect(page.sid);
    trigger += `+anchor-rect(${clickedRect ? 'clicked' : 'no-frame'})`;
    log(`  challenge trigger: ${trigger}`);
    bfTarget = mode === 'oopif' || mode === 'none' ? await bframeOopif(15000) : null;
    bfFrame = mode === 'inline' ? await bframeInline(15000) : null;
    if (!bfTarget && !bfFrame && !clickedRect) {
      const again = await solver.prepareWidget(page.sid, 'recaptcha2');
      log(`  re-prepare after trigger: widget=${again.widget} mode=${again.mode} anchor=${again.anchor}`);
    }
  }
  if (!bfTarget && !bfFrame) {
    const ex = await solver.rc2Execute(page.sid);
    trigger += `+execute(${ex.ok ? 'ok' : 'fail:' + ex.why})`;
    log(`  challenge trigger: ${trigger}`);
    bfTarget = mode === 'oopif' ? await bframeOopif(18000) : null;
    bfFrame = mode !== 'oopif' ? await bframeInline(18000) : null;
  }
  if (!bfTarget && !bfFrame) {
    const tok = await token();
    if (tok && tok.length > 20) return { ok: true, token: tok, tries: 0, rounds, ms: now() - t0, note: 'no-challenge-pass', trigger };
    log(`  no challenge after trigger (${trigger})`);
    return { ok: false, token: '', tries: 0, rounds, ms: now() - t0, trigger };
  }
  log(`  challenge up (${bfTarget ? 'oopif' : 'inline'}) trigger=${trigger}`);

  const rebuild = async () => {
    bfTarget = mode === 'oopif' ? await bframeOopif(9000) : null;
    bfFrame = mode !== 'oopif' ? await bframeInline(9000) : null;
    if (!bfTarget && !bfFrame) return null;
    return bfTarget
      ? makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'oopif', ref: bfTarget })
      : makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'inline', ref: bfFrame.id });
  };
  let stalled = 0;
  let unreadableRuns = 0;
  const doRefresh = async (r, out, why) => {
    const rf = await refreshUntilChanged({
      adapter: bfTarget ? makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'oopif', ref: bfTarget }) : makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'inline', ref: bfFrame.id }),
      solver, page, log, shotDir, roundNo: r + 1,
      prevKey: out.imgKey || `${out.instruction}|${out.shot}`,
      reresolve: rebuild,
    });
    const state = rf.changed ? 'changed' : rf.unreadable ? 'unreadable' : 'stalled';
    rounds[rounds.length - 1] = { ...out, refresh: state, refreshProbes: rf.probes.length, refreshComposeAttempts: rf.composeAttempts, why };
    // Only a *readable but identical* grid is a frozen challenge. "No grid at all"
    // is the reload click failing to make the widget re-render — measured on the
    // ScrapingBee login, where the natural next-round re-read did advance the
    // image (px:b7e30764 -> px:9a5b1c59). So an unreadable refresh does not count
    // as a stall; the loop continues and the next round's dump/compose decides.
    if (rf.changed) { stalled = 0; unreadableRuns = 0; }
    else if (rf.unreadable) unreadableRuns++;
    else stalled++;
    return rf;
  };

  for (let r = 0; r < OPTS.maxRounds + 2; r++) {
    const adapter = bfTarget
      ? makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'oopif', ref: bfTarget })
      : makeFrameAdapter({ solver, cdp, hostSid: page.sid, kind: 'inline', ref: bfFrame.id });
    tries++;
    let out;
    try {
      out = await solver.solveRound(adapter, { roundNo: r + 1, shotDir, kindHint: 'recaptcha2' });
    } catch (e) {
      log(`  round ${r + 1} error: ${e.message}`);
      rounds.push({ round: r + 1, error: e.message });
      break;
    }
    out.frame = bfTarget ? 'oopif' : 'inline';
    rounds.push(out);
    if (out.result === 'refresh') {
      await doRefresh(r, out, 'model-refresh');
      if (stalled >= 2 || unreadableRuns >= 3) break;
      if (!bfTarget && !bfFrame) break;
      continue;
    }
    await sleep(OPTS.verifyWaitMs);
    const tok = await token();
    if (tok && tok.length > 20) {
      rounds[rounds.length - 1] = { ...out, accepted: true };
      return { ok: true, token: tok, tries, rounds, ms: now() - t0, trigger };
    }
    // Not accepted: re-read the same image once (reading error), then refresh.
    const stillThere = bfTarget ? (await solver.targets()).some((t) => t.targetId === bfTarget.targetId) : !!(await bframeNow());
    const shotExists = fs.existsSync(path.join(shotDir, `round-${r + 1}.png`));
    const key = out.imgKey || `${out.instruction}|${out.shot}`;
    if (stillThere && shotExists && retriedKey !== key) {
      retriedKey = key;
      rounds[rounds.length - 1] = { ...out, retried: true };
      log(`  round ${r + 1}: not accepted -> re-reading the same image`);
      continue;
    }
    await doRefresh(r, out, 'not-accepted');
    if (stalled >= 2 || unreadableRuns >= 3) break;
  }
  const tok = await token();
  return { ok: !!(tok && tok.length > 20), token: tok, tries, rounds, ms: now() - t0, trigger, stalled, unreadableRuns };
}

async function solveHcaptcha(cdp, page, { solver, shotDir, log }) {
  const t0 = now();
  const rounds = [];
  let tries = 0;
  const token = async () => page.token(TOKEN_SEL.hcaptcha).catch(() => '');
  const pre = await token();
  if (pre && pre.length > 20) return { ok: true, token: pre, tries: 0, rounds, ms: now() - t0 };
  await solver.hcClickCheckbox(page.sid);
  await sleep(2500);
  let trigger = 'checkbox';
  if (!(await solver.hcChallengeTarget())) {
    const ex = await solver.hcTrigger(page.sid);
    trigger = `execute(${ex.ok ? 'ok' : 'fail:' + ex.why})`;
    log(`  hcaptcha trigger: ${trigger}`);
    await sleep(2500);
  }
  for (let r = 0; r < OPTS.maxRounds && now() - t0 < 120000; r++) {
    const target = await solver.hcChallengeTarget();
    if (!target) {
      log('  no hcaptcha challenge frame up');
      const tok = await token();
      if (tok && tok.length > 20) return { ok: true, token: tok, tries, rounds, ms: now() - t0 };
      break;
    }
    tries++;
    let d;
    try {
      d = await solver.hcDump(target);
    } catch (e) {
      rounds.push({ round: r + 1, error: e.message });
      break;
    }
    if (!d.tiles || !d.tiles.length) {
      rounds.push({ round: r + 1, error: 'no tiles in challenge frame' });
      break;
    }
    const cols = new Set(d.tiles.map((t) => t.x)).size || 3;
    const rows = Math.ceil(d.tiles.length / cols);
    const shot = path.join(shotDir, `round-${r + 1}.png`);
    const img = await solver.composeChallenge(d.sid, HC_TILE_SEL, shot);
    const answer = await solver.brain.ask({ pngPath: shot, instruction: d.instr, rows: img.rows || rows, cols: img.cols || cols, numbered: true, kindHint: 'hcaptcha' });
    const tiles = (answer.tiles || []).filter((i) => i >= 0 && i < d.tiles.length);
    for (const i of tiles) {
      const t = d.tiles[i];
      await clickIn(cdp, d.sid, t.x + t.w / 2, t.y + t.h / 2);
      await sleep(220);
    }
    if (d.verify) await clickIn(cdp, d.sid, d.verify.x, d.verify.y);
    rounds.push({ round: r + 1, tiles, instruction: d.instr, model: answer.model, brainMs: answer.ms, confidence: answer.confidence, verifyText: d.verify?.text || null, trigger, ms: now() - t0 });
    await sleep(OPTS.verifyWaitMs);
    const tok = await token();
    if (tok && tok.length > 20) {
      rounds[rounds.length - 1].accepted = true;
      return { ok: true, token: tok, tries, rounds, ms: now() - t0 };
    }
  }
  const tok = await token();
  return { ok: !!(tok && tok.length > 20), token: tok, tries, rounds, ms: now() - t0 };
}

async function solveTurnstile(cdp, page, { solver, log }) {
  const t0 = now();
  const rounds = [];
  let tries = 0;
  const token = async () => page.token(TOKEN_SEL.turnstile).catch(() => '');
  if ((await token())?.length > 20) return { ok: true, token: await token(), tries, rounds, ms: now() - t0 };
  for (let k = 0; k < 3; k++) {
    tries++;
    const clicked = await solver.tsClick(page.sid);
    if (!clicked) break;
    const tok = await page.waitToken(TOKEN_SEL.turnstile, 8000);
    rounds.push({ round: k + 1, clicked, tokenLen: tok.length });
    if (tok && tok.length > 20) return { ok: true, token: tok, tries, rounds, ms: now() - t0 };
    await sleep(1200);
  }
  const tok = await page.token(TOKEN_SEL.turnstile).catch(() => '');
  return { ok: !!(tok && tok.length > 20), token: tok, tries, rounds, ms: now() - t0 };
}

// ---------------------------------------------------------------- mount mode

/** Sitekey shapes: Turnstile (`0x4AAAAA…`) and hCaptcha (uuid). */
async function detectSitekey(cdp, sid, kind) {
  return evalIn(
    cdp,
    sid,
    `(() => {
      const hay = [document.documentElement.innerHTML];
      for (const e of document.querySelectorAll('[data-sitekey]')) hay.push(e.getAttribute('data-sitekey'));
      for (const f of document.querySelectorAll('iframe')) hay.push(String(f.src || ''));
      for (const s of document.querySelectorAll('script')) hay.push(String(s.src || '') + ' ' + String(s.innerHTML || '').slice(0, 4000));
      const all = hay.join(' ');
      const ts = all.match(/0x4AAAAA[A-Za-z0-9_-]{10,}/);
      const hc = all.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const kind = ${JSON.stringify(kind)};
      if (kind === 'hcaptcha') return hc ? hc[0] : (ts ? ts[0] : null);
      return ts ? ts[0] : (hc ? hc[0] : null);
    })()`
  ).catch(() => null);
}

/**
 * Mount the site's own widget on the panel page and hand back
 * `turnstile.getResponse()` / `hcaptcha.getResponse()`. That is the shape the
 * pool panels need: their API wants the *token value* and the widget lives on
 * `/register`, where mounting it ourselves also works when the page's own widget
 * is managed/invisible. Solves a captcha, drops the token, closes the page.
 */
async function solveByMount(cdp, page, { solver, kind, sitekey: given, log }) {
  const t0 = now();
  const type = kind === 'auto' || !kind ? OPTS.type : kind;
  const sitekey = given || (await detectSitekey(cdp, page.sid, type));
  if (!sitekey) return { ok: false, token: '', tries: 0, rounds: [], ms: now() - t0, error: 'no sitekey on the page (pass --sitekey)' };
  const api = type === 'hcaptcha' ? "'https://js.hcaptcha.com/1/api.js?render=explicit&onload=ompHcOnload'" : "'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=ompTsOnload'";
  const glob = type === 'hcaptcha' ? 'hcaptcha' : 'turnstile';
  // Turnstile reports failures (300xxx/600xxx "generic challenge failure — retry")
  // to the parent window via postMessage; the iframe itself is cross-origin, so
  // this listener is the only way to *measure* why a mount produced no token.
  if (type === 'turnstile') {
    await evalIn(
      cdp,
      page.sid,
      `(() => {
        window.__ompTsErrors = window.__ompTsErrors || [];
        if (!window.__ompTsListener) {
          window.__ompTsListener = true;
          window.addEventListener('message', (e) => {
            try {
              const d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
              if (d && /3\\d{5}|6\\d{5}|error|challenge/i.test(d)) window.__ompTsErrors.push(String(d).slice(0, 200));
            } catch (err) {}
          });
        }
        return true;
      })()`
    ).catch(() => null);
  }
  await evalIn(
    cdp,
    page.sid,
    `(() => {
      window.__ompMount = null;
      if (typeof ${glob} === 'undefined' && !document.getElementById('omp-captcha-api')) {
        const s = document.createElement('script');
        s.id = 'omp-captcha-api';
        s.src = ${api};
        s.async = true; s.defer = true;
        document.head.appendChild(s);
      }
      return true;
    })()`
  );
  for (let i = 0; i < 25; i++) {
    const st = await evalIn(cdp, page.sid, `typeof ${glob}`).catch(() => 'undefined');
    if (st === 'object' || st === 'function') break;
    await sleep(600);
  }
  const rendered = await evalIn(
    cdp,
    page.sid,
    `(() => {
      try {
        if (typeof ${glob} === 'undefined' || !${glob}.render) return { ok:false, why:'api-missing' };
        const old = document.getElementById('omp-mount-host');
        if (old) old.remove();
        const host = document.createElement('div');
        host.id = 'omp-mount-host';
        host.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#fff;padding:4px';
        document.body.appendChild(host);
        if (window.__ompMountId != null) { try { ${glob}.remove(window.__ompMountId); } catch (e) {} }
        window.__ompMountId = ${glob}.render(host, { sitekey: ${JSON.stringify(sitekey)},
          size: 'normal', callback: (tk) => { window.__ompMount = tk; } });
        return { ok: true, widgetId: String(window.__ompMountId) };
      } catch (e) { return { ok:false, why: String((e && e.message) || e) }; }
    })()`
  ).catch((e) => ({ ok: false, why: e.message }));
  log(`  mount ${type} sitekey=${sitekey} -> ${JSON.stringify(rendered)}`);
  const readToken = () =>
    evalIn(
      cdp,
      page.sid,
      `(() => {
        try {
          const own = window.__ompMount || (window.__ompMountId != null && ${glob}.getResponse ? ${glob}.getResponse(window.__ompMountId) : '');
          if (own && String(own).length > 20) return own;
          const input = document.querySelector('[name="cf-turnstile-response"], [name="h-captcha-response"]');
          return input ? (input.value || '') : '';
        } catch (e) { return ''; }
      })()`
    ).catch(() => '');
  let token = '';
  for (let i = 0; i < 10; i++) {
    token = await readToken();
    if (token && token.length > 20) break;
    await sleep(800);
  }
  let tries = 0;
  let seenErr = [];
  const readTsErrors = () =>
    type === 'hcaptcha'
      ? Promise.resolve([])
      : evalIn(cdp, page.sid, `(() => (window.__ompTsErrors || []).slice(-3))()`).catch(() => []);
  while (!token && tries < 6 && now() - t0 < 150000) {
    tries++;
    if (tries > 1 && type === 'turnstile' && seenErr.length) {
      // A widget that landed in an error state ignores further clicks; `reset()`
      // restarts the challenge (measured need: a mount endpoint answered 300030 =
      // generic challenge failure, retryable per Cloudflare's error table).
      const ok = await evalIn(
        cdp,
        page.sid,
        `(() => { try { window.__ompMount = null; if (window.__ompMountId != null) turnstile.reset(window.__ompMountId); return true; } catch (e) { return false; } })()`
      ).catch(() => false);
      log(`  mount reset before try ${tries}: ${ok}`);
      await sleep(1500);
    }
    if (type === 'hcaptcha') await solver.hcClickCheckbox(page.sid);
    else {
      const mine = await solver.tsClick(page.sid, { preferMountHost: true });
      log(`  mount click ${tries} -> mount-host iframe ${mine ? 'clicked' : 'absent'}`);
      for (let i = 0; i < 12; i++) {
        token = await readToken();
        if (token && token.length > 20) break;
        await sleep(700);
      }
      // The site's own widget is often the flow Cloudflare was built for: give it a
      // click too when our mount has not produced a token yet (harmless when absent).
      if (!token) {
        const native = await solver.tsClick(page.sid);
        if (native) log(`  mount click ${tries} -> page-native iframe clicked as well`);
      }
    }
    for (let i = 0; i < 20; i++) {
      token = await readToken();
      if (token && token.length > 20) break;
      await sleep(900);
    }
    seenErr = await readTsErrors();
    log(`  mount click ${tries}: tokenLen=${(token || '').length}${seenErr.length ? ` tsErrors=${JSON.stringify(seenErr.slice(-2)).slice(0, 220)}` : ''}`);
  }
  const rounds = [{ mount: type, sitekey, widgetId: rendered.widgetId || null, tsErrors: seenErr.slice(-3) }];
  if (!token && type === 'hcaptcha' && solver.brain) {
    // Some hCaptcha sites only accept a token from a *solved challenge*, not from a
    // bare widget mount (measured on ai.furry.vg: widget mounts, checkbox clicks,
    // tokenLen stays 0). Fall through to the visual round loop and read the token
    // back from getResponse().
    const shotDir = ensureDir(path.join(OPTS.out, 'shots-mount'));
    for (let r = 0; r < OPTS.maxRounds && now() - t0 < 150000; r++) {
      const target = await solver.hcChallengeTarget();
      if (!target) {
        log('  mount: no hcaptcha challenge frame after the click');
        break;
      }
      let d = null;
      for (let i = 0; i < 10; i++) {
        d = await solver.hcDump(target).catch(() => null);
        if (d && d.tiles && d.tiles.length) break;
        await sleep(700);
      }
      if (!d || !d.tiles || !d.tiles.length) {
        rounds.push({ round: r + 1, error: 'challenge frame without grid tiles (drag/other type?)' });
        break;
      }
      const cols = new Set(d.tiles.map((x) => x.x)).size || 3;
      const rows = Math.ceil(d.tiles.length / cols);
      const shot = path.join(shotDir, `round-${r + 1}.png`);
      const img = await solver.composeChallenge(d.sid, HC_TILE_SEL, shot);
      const a = await solver.brain.ask({ pngPath: shot, instruction: d.instr, rows: img.rows || rows, cols: img.cols || cols, numbered: true, kindHint: 'hcaptcha' });
      const tiles = (a.tiles || []).filter((i) => i >= 0 && i < d.tiles.length);
      const rd = { round: r + 1, tiles, instruction: d.instr, model: a.model, brainMs: a.ms, confidence: a.confidence, verifyText: d.verify?.text || null };
      if (!tiles.length || tiles.length === d.tiles.length) {
        rd.result = 'refresh';
        rounds.push(rd);
        if (d.verify) await clickIn(cdp, d.sid, d.verify.x, d.verify.y); // hCaptcha refreshes on an empty submit
        await sleep(2500);
        continue;
      }
      for (const i of tiles) {
        const x = d.tiles[i];
        await clickIn(cdp, d.sid, x.x + x.w / 2, x.y + x.h / 2);
        await sleep(220);
      }
      if (d.verify) await clickIn(cdp, d.sid, d.verify.x, d.verify.y);
      rounds.push(rd);
      for (let i = 0; i < 15; i++) {
        token = await readToken();
        if (token && token.length > 20) break;
        await sleep(800);
      }
      if (token) {
        rd.accepted = true;
        break;
      }
    }
  }
  return { ok: !!(token && token.length > 20), token: token || '', tries, rounds, ms: now() - t0 };
}

// -------------------------------------------------------------- feed mode

/** Drop-in vision replacement for io.net's auto-feed.js (same contract). */
async function feedMode(dir, brain, log) {
  const clicksPath = path.join(dir, 'clicks.json');
  const statePath = path.join(dir, 'state.json');
  let lastKey = null;
  log(`[feed] watching ${dir} (state.json + round-N.png -> clicks.json)`);
  for (;;) {
    let st = null;
    try {
      st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {}
    if (st && st.round && st.shot) {
      const key = `${st.round}|${st.at}|${st.shot}`;
      if (key !== lastKey) {
        lastKey = key;
        const shot = path.join(dir, st.shot);
        const cols = st.cols || 3;
        const rows = Math.ceil((st.tiles || []).length / cols) || 3;
        if (!fs.existsSync(shot)) {
          log(`[feed] round ${st.round}: ${shot} missing, skipping`);
        } else {
          try {
            const a = await brain.ask({ pngPath: shot, instruction: st.instruction, rows, cols, numbered: false, kindHint: 'recaptcha2' });
            const n = (st.tiles || []).length;
            const tiles = (a.tiles || []).filter((i) => i >= 0 && i < n);
            fs.writeFileSync(clicksPath, JSON.stringify({ tiles, verify: true }));
            log(`[feed] round ${st.round} "${String(st.instruction || '').slice(0, 40)}" -> tiles=[${tiles}] (${a.model} ${a.ms}ms)`);
          } catch (e) {
            log(`[feed] round ${st.round} brain failed: ${e.message} -> refresh`);
            fs.writeFileSync(clicksPath, JSON.stringify({ refresh: true }));
          }
        }
      }
    }
    await sleep(1000);
  }
}

// -------------------------------------------------------------------- main

/**
 * One GET through an exit, browser-shaped, with the status kept (fetchText
 * throws the status away and follows neither redirects nor UAs). Used by the
 * exit screener, where "reachable" and "this is the site, not an interstitial"
 * are different questions.
 */
function httpProbe(proxy, url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const r = lib.request(
      {
        method: 'GET',
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        agent: createAgent(proxy),
        headers: {
          accept: 'text/html,application/javascript,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
      }
    );
    r.setTimeout(timeoutMs, () => r.destroy(new Error('timeout ' + url)));
    r.on('error', reject);
    r.end();
  });
}

/** Does this exit carry the assets a captcha round needs? (Same recipe as io.net pickexits.js.) */
async function screenExits(lines, { targetUrl, type, need, concurrency }) {
  const checks = [];
  if (type === 'recaptcha2') checks.push(['https://www.google.com/recaptcha/api.js', /grecaptcha/]);
  if (type === 'hcaptcha') checks.push(['https://js.hcaptcha.com/1/api.js', /hcaptcha/i]);
  if (type === 'turnstile') checks.push(['https://challenges.cloudflare.com/turnstile/v0/api.js', /turnstile|cloudflare/i]);
  const found = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, lines.length) }, async () => {
    while (i < lines.length && found.length < need) {
      const line = lines[i++];
      const proxy = parseProxy(line);
      proxy.connectTimeoutMs = 8000;
      try {
        const ip = (await httpProbe(proxy, 'https://api.ipify.org', 9000)).text.trim();
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue;
        let ok = true;
        for (const [u, re] of checks) {
          const asset = await httpProbe(proxy, u, 10000);
          // A captcha CDN may answer 30x to a variant path with an *empty* body
          // (measured 2026-10-15: `challenges.cloudflare.com/turnstile/v0/api.js`
          // → 302 `/turnstile/v0/g/<hash>/api.js`, 0 bytes). Reaching the host is
          // the exit's property — Chrome follows the redirect — so 30x passes.
          if (asset.status >= 300 && asset.status < 400) continue;
          if (!re.test(asset.text)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        // The page probe must look like a browser request: without a UA these
        // fronts answer the Cloudflare block page (measured: 5847 B "Just a
        // moment…" instead of the 233 KB Next.js page), which the interstitial
        // filter below then (correctly) rejects — a false negative for the exit.
        const page = await httpProbe(proxy, targetUrl, 13000);
        if (page.text.length < 300) continue;
        // A Cloudflare/Vercel interstitial is not the site: a widget can never
        // render on it (measured on accounts.hcaptcha.com/demo through free exits).
        if (/Attention Required|Just a moment|Security Checkpoint|Verifying you are human/i.test(page.text)) continue;
        found.push({ line, ip });
      } catch {}
    }
  });
  await Promise.all(workers);
  return found;
}

class ExitPicker {
  constructor(log) {
    this.log = log;
    this.queue = [];
    this.used = new Set();
  }

  async next() {
    if (OPTS.proxy) return OPTS.proxy;
    if (!this.queue.length) await this.refill();
    const p = this.queue.shift();
    if (!p) throw new Error('no usable exit (pool + screen filter came up empty)');
    this.used.add(p.line);
    return p.line;
  }

  async refill() {
    const source = OPTS.exits && fs.existsSync(OPTS.exits) ? OPTS.exits : OPTS.pool;
    const raw = fs
      .readFileSync(source, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.split('#')[0].trim())
      .filter(Boolean);
    const cands = [];
    for (const l of raw) {
      const s = l.trim();
      if (!s || s.startsWith('#') || s.startsWith('//')) continue;
      let proxy;
      try {
        proxy = parseProxy(s);
      } catch {
        continue;
      }
      if (!usableInBrowser(proxy) || isLocalHost(proxy.host)) continue;
      if (this.used.has(s)) continue;
      cands.push(s);
    }
    const canScreen = OPTS.screen && !!OPTS.url;
    if (!canScreen) {
      this.queue.push(...cands.slice(0, Math.max(OPTS.screenNeed, 8)).map((line) => ({ line })));
      this.log(`[exit] queued ${this.queue.length} unscreened exits from ${path.basename(source)}`);
      return;
    }
    const found = await screenExits(cands, {
      targetUrl: OPTS.url,
      type: OPTS.type,
      need: OPTS.screenNeed,
      concurrency: OPTS.screenConcurrency,
    });
    this.queue.push(...found);
    if (found.length) {
      try {
        fs.appendFileSync(path.join(OUTDIR, 'captcha-exits-live.txt'), found.map((f) => `${f.line}  # exit=${f.ip}`).join('\n') + '\n');
      } catch {}
    }
    this.log(`[exit] screened ${this.queue.length} live exits (${found.map((f) => f.ip).join(', ') || 'none'}) from ${path.basename(source)}`);
  }
}

async function main() {
  ensureDir(OUTDIR);
  ensureDir(OPTS.out);
  const logFile = path.join(OUTDIR, `captcha-${path.basename(OPTS.out)}.log`);
  const log = (m) => {
    const line = `${new Date().toISOString()} ${m}`;
    if (!OPTS.quiet) console.log(line);
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch {}
  };

  const picker = new ExitPicker(log);
  if (OPTS.screenOnly) {
    if (!OPTS.url) throw new Error('--url required with --screen-exits-only');
    await picker.refill();
    const ips = picker.queue.map((q) => q.ip);
    log(`[exit] screen-only: ${picker.queue.length} exits usable for ${OPTS.type} ${OPTS.url} -> ${ips.join(', ')}`);
    fs.writeFileSync(path.join(OUTDIR, 'captcha-exits-live.txt'), picker.queue.map((f) => `${f.line}  # exit=${f.ip}`).join('\n') + '\n');
    return;
  }

  let chromeMeta = null;
  let cdp;
  if (OPTS.attach) {
    cdp = await connect(OPTS.attach);
    log(`attached to chrome on ${OPTS.attach}`);
  } else {
    const port = OPTS.port || (await freePort());
    chromeMeta = launchChrome(port, { headless: OPTS.headless });
    await waitPort(port);
    cdp = await connect(port);
    log(`chrome up on ${port} (pid ${chromeMeta.pid}, profile ${chromeMeta.profileDir})`);
  }

  let reuseTargetId = null;
  let reusedUrl = '';
  if (OPTS.attach && (OPTS.attachTarget || OPTS.reusePage)) {
    const targets = (await cdp.send('Target.getTargets')).targetInfos.filter((x) => x.type === 'page');
    const hit = OPTS.attachTarget
      ? targets.find((x) => x.targetId === OPTS.attachTarget || x.targetId.startsWith(OPTS.attachTarget) || (x.url || '').includes(OPTS.attachTarget))
      : [...targets].sort((a, b) => (b.lastActiveTime || 0) - (a.lastActiveTime || 0))[0];
    if (!hit) throw new Error(`--target "${OPTS.attachTarget}" matched no page target (have: ${targets.map((x) => x.url.slice(0, 50)).join(' | ')})`);
    reuseTargetId = hit.targetId;
    reusedUrl = hit.url;
    console.log(`${new Date().toISOString()} reuse mode: driving the caller's page ${hit.targetId.slice(0, 8)} ${hit.url.slice(0, 80)} (no context, no navigate, no close)`);
  }

  // --brain-proxy direct is approved ONLY for the vision call (operator decision
  // 2026-10-15): the page, the widget, the token read and every target-host request
  // stay on a pool exit. Constraints: model providers we already use only (the
  // PROVIDERS table is the allowlist), nothing target-identifying in the request
  // beyond the image, and the mode is logged per run so the exit saving is measured.
  const BRAIN_PROXY_MODE = OPTS.brainProxy === 'direct' ? 'direct' : 'pooled';
  if (BRAIN_PROXY_MODE === 'direct' && /^http:/.test(OPTS.brain)) {
    log('[brain] WARNING: --brain-proxy direct with a custom endpoint — confirm it is a model provider you already trust');
  }
  const brain = new Brain(OPTS.brain, { brainProxy: OPTS.brainProxy === 'direct' ? null : OPTS.brainProxy || null, logPath: logFile });
  // Model calls get their own exits: a free exit that died between the page load
  // and the vision call must not cost the round, and the model call does not need
  // the browser's exit at all.
  if (OPTS.brainProxy !== 'direct' && !OPTS.brainProxy) {
    // Lazy: screening costs minutes and must never precede the caller's page in
    // reuse mode (no challenge yet => no model call => no exit needed).
    brain.exitProvider = () => picker.next().catch(() => null);
    log('[brain] model calls will take their own exit on first use (lazy)');
  }

  try {
    if (OPTS.feed) {
      await feedMode(OPTS.feed, brain, log);
      return;
    }
    // Reuse mode owns no URL: it drives whatever the caller's tab already shows.
    if (!OPTS.url && !reuseTargetId) throw new Error('--url required (or --feed <dir>, or --attach --target)');
    if (!OPTS.url && reuseTargetId) OPTS.url = reusedUrl;
    const runs = [];
    const started = now();
    for (let i = 0; i < OPTS.runs; i++) {
      const shotDir = ensureDir(path.join(OPTS.out, `shots-${i + 1}`));
      const rec = { run: i + 1, type: OPTS.type, url: OPTS.url, at: new Date().toISOString(), brainProxy: BRAIN_PROXY_MODE, attempts: [] };
      // A free exit often serves the shell but never finishes hydration, so the
      // widget never renders: that is an exit defect, not a solver failure — burn
      // another exit for the same run index instead of recording a loss.
      for (let a = 1; a <= OPTS.runAttempts; a++) {
        const proxyLine = reuseTargetId ? '(caller page exit)' : await picker.next();
        log(`run ${i + 1}/${OPTS.runs} attempt ${a}/${OPTS.runAttempts} via ${proxyLine}`);
        const page = new PageRun(cdp, { proxyLine, brain, log, reuseTargetId });
        const att = { attempt: a, proxy: proxyLine, at: new Date().toISOString() };
        try {
          const t0 = now();
          await page.open(OPTS.url);
          const solver = new Solver(cdp, log);
          solver.brain = brain;
          att.title = await evalIn(cdp, page.sid, 'document.title').catch(() => '');
          const w = await solver.prepareWidget(page.sid, OPTS.type);
          att.widget = w.widget;
          att.widgetMode = w.mode;
          att.sitekey = w.sitekey || null;
          att.widgetFrames = (w.frames || []).length;
          if (!w.widget && OPTS.mount) {
            log(`  attempt ${a}: no native widget, mounting the sitekey ourselves (mode=${w.mode})`);
          } else if (!w.widget) {
            att.error = 'no-widget';
            att.ms = now() - t0;
            rec.attempts.push(att);
            log(`  attempt ${a}: page shell loaded ("${att.title}") but no captcha widget in ${OPTS.widgetWait}ms (mode=${w.mode}) -> next exit`);
            continue;
          }
          if (w.widget) log(`  attempt ${a}: widget up (mode=${w.mode}${w.sitekey ? ' sitekey=' + w.sitekey : ''})`);
          let out;
          if (OPTS.mount) out = await solveByMount(cdp, page, { solver, kind: OPTS.mount === 'auto' ? OPTS.type : OPTS.mount, sitekey: OPTS.sitekey, log });
          else if (OPTS.type === 'hcaptcha') out = await solveHcaptcha(cdp, page, { solver, shotDir, log });
          else if (OPTS.type === 'turnstile') out = await solveTurnstile(cdp, page, { solver, log });
          else out = await solveRecaptcha2(cdp, page, { solver, runTag: i + 1, shotDir, log });
          Object.assign(att, {
            ok: out.ok,
            tries: out.tries,
            tokenLen: (out.token || '').length,
            token: out.token || '',
            model: out.rounds?.find?.((r) => r.model)?.model || brain.lastModel || null,
            rounds: out.rounds,
            ms: out.ms ?? now() - t0,
          });
          Object.assign(rec, {
            proxy: proxyLine,
            title: att.title,
            ok: att.ok,
            tries: att.tries,
            tokenLen: att.tokenLen,
            token: att.token,
            model: att.model,
            rounds: att.rounds,
            ms: att.ms,
          });
          rec.attempts.push(att);
          log(`run ${i + 1}: ok=${rec.ok} tries=${rec.tries ?? '-'} tokenLen=${rec.tokenLen ?? 0} model=${rec.model || '-'}`);
          break;
        } catch (e) {
          att.error = e.message;
          att.ms = att.ms ?? null;
          rec.attempts.push(att);
          log(`  attempt ${a} error: ${e.message}`);
        } finally {
          await page.close().catch(() => null);
        }
      }
      if (!rec.attempts.length) {
        rec.ok = false;
        rec.error = 'no exit produced a captcha widget';
      } else if (rec.ok === undefined) {
        rec.ok = false;
        rec.error = rec.attempts[rec.attempts.length - 1].error || 'all exit attempts failed pre-flight';
      }
      runs.push(rec);
      const stem = path.basename(OPTS.out).replace(/^captcha-/, '');
      const perRunFile = path.join(OUTDIR, `captcha-${stem}-run${i + 1}.json`);
      fs.writeFileSync(perRunFile, JSON.stringify(rec, null, 1));
      log(`  evidence: ${perRunFile}`);
      if (i + 1 < OPTS.runs) await sleep(1200);
    }
    const done = runs.filter((r) => r.ok);
    const usable = runs.filter((r) => (r.attempts || []).some((a) => a.widget));
    const exitAttempts = runs.flatMap((r) => r.attempts || []);
    const noWidget = exitAttempts.filter((a) => a.error === 'no-widget').length;
    const roundMs = [];
    for (const r of runs) for (const rd of r.rounds || []) if (rd.ms) roundMs.push(rd.ms);
    const brainMs = brain.calls.map((c) => c.ms).filter(Boolean);
    const summary = {
      tool: 'solver.js',
      type: OPTS.type,
      url: OPTS.url,
      runs: runs.length,
      ok: done.length,
      successRate: runs.length ? +(done.length / runs.length).toFixed(3) : null,
      usableRuns: usable.length,
      successRateUsable: usable.length ? +(usable.filter((r) => r.ok).length / usable.length).toFixed(3) : null,
      exitAttempts: exitAttempts.length,
      noWidgetAttempts: noWidget,
      avgMs: done.length ? Math.round(done.reduce((a, r) => a + (r.ms || 0), 0) / done.length) : null,
      avgRoundMs: roundMs.length ? Math.round(roundMs.reduce((a, b) => a + b, 0) / roundMs.length) : null,
      avgBrainMs: brainMs.length ? Math.round(brainMs.reduce((a, b) => a + b, 0) / brainMs.length) : null,
      models: [...new Set(brain.calls.map((c) => c.model))],
      brainCalls: brain.calls,
      brainProxyMode: BRAIN_PROXY_MODE,
      totalMs: now() - started,
      at: new Date().toISOString(),
      results: runs.map((r) => ({ run: r.run, ok: r.ok, ms: r.ms, tries: r.tries, error: r.error || null, proxy: r.proxy, attempts: (r.attempts || []).length })),
    };
    fs.writeFileSync(path.join(OUTDIR, `captcha-${path.basename(OPTS.out).replace(/^captcha-/, '')}-summary.json`), JSON.stringify(summary, null, 1));
    log(
      `SUMMARY ok=${summary.ok}/${summary.runs} rate=${summary.successRate} usable=${summary.usableRuns} rateUsable=${summary.successRateUsable} ` +
        `brainProxy=${summary.brainProxyMode} exitAttempts=${summary.exitAttempts} noWidget=${summary.noWidgetAttempts} ` +
        `avgMs=${summary.avgMs} avgRoundMs=${summary.avgRoundMs} avgBrainMs=${summary.avgBrainMs}`
    );
  } finally {
    if (!OPTS.keep && chromeMeta) await killChrome(chromeMeta);
    // In attach mode the caller's Chrome (and its socket) is not ours to keep open:
    // an unclosed CDP websocket keeps this process alive after the last run.
    if (OPTS.attach) {
      try {
        cdp.close();
      } catch {}
    }
  }
}

module.exports = {
  Solver,
  Brain,
  PageRun,
  buildPrompt,
  extractTiles,
  feedMode,
  solveRecaptcha2,
  solveHcaptcha,
  solveTurnstile,
  refreshUntilChanged,
  launchChrome,
  killChrome,
  waitPort,
  connect,
  attach,
  evalIn,
  clickIn,
  screenshot,
  httpJson,
  TOKEN_SEL,
  PageRun,
  solveByMount,
  detectSitekey,
};

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
