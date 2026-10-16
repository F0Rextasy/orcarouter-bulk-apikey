#!/usr/bin/env node
'use strict';

/**
 * orcarouter.ai lane — solve → spend → register → key, in one process.
 *
 * Everything it needs ships flat next to it: `lib.js` / `newapi.js`, `inbox.js` (Mailtrap sandbox inboxes), `proxy.js` (the
 * exit/tunnel client) and `solver.js` (the Turnstile solver). No path outside
 * this folder is required at run time.
 *
 * Why one process: a Turnstile token lives ~5 minutes and is single-use, and the
 * panel demands one *before* it judges the mail address (`/api/verification`
 * answers `{"message":"Turnstile token is empty","success":false}` with no
 * token). The mount therefore hands its token straight to the verification call.
 *
 * Flow (every hop measured on 2026-10-15, all through exits, never direct):
 *   1. mailbox                 — MAILTRAP_TOKEN (own sandbox inbox) or a local
 *                                broker box (`--email` reuses an existing one)
 *   2. mount token #1          — solver.js --mount turnstile on the FRONT host
 *                                (www.orcarouter.ai owns the widget's allowed domain)
 *   3. spend #1                — GET api.orcarouter.ai/api/verification?email&turnstile
 *                                first through the minting exit, then across the
 *                                pool (token races, first answer wins)
 *   4. code                    — poll the inbox (HTML-only body, ~7 s measured)
 *   5. register shape probe    — a dummy token reveals WHICH param the fork reads
 *                                (`body` → "Turnstile token is missing",
 *                                `query` → "Turnstile verification failed" ⇒ query)
 *   6. mount token #2 + register (password2 = password; the token must still be
 *                                inside its ~5 min TTL — the lane starts this
 *                                mount in parallel with the code wait for that)
 *   7. login → token → key     — Panel client (newapi.js). This fork gates
 *                                `POST /api/token/` behind "Security verification
 *                                is required" (measured), so the working
 *                                credential is the register response's
 *                                `initial_token`; either way the key is verified
 *                                on /v1/models before it touches keys.txt.
 *
 *   node src/turnstile-lane.js                                    # one account, one key
 *   node src/turnstile-lane.js --runs 1                           # fewer mount runs per token
 *   node src/turnstile-lane.js --probe-only                       # mail verdict only
 *   node src/turnstile-lane.js --resume --username u --password p # finish an existing account
 *   node src/turnstile-lane.js --verify-only --key <key>      # re-check one key
 *
 * Exit files (contract format, `# ` annotations stripped): by default the
 * repo-root `proxies.txt`; pass --api-exits / --mount-exits to split them.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const { req, ExitPool, Mail, sleep, writeJson, appendLine, nowIso, extractCode, flattenHtml } = require('./lib.js');
const { Panel, UA } = require('./newapi.js');
const { parseProxy } = require('./proxy.js');

const argv = process.argv.slice(2);
const one = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const API = one('api', 'https://api.orcarouter.ai');
const FRONT = one('front', 'https://www.orcarouter.ai');
const MOUNT_URL = one('mount-url', `${FRONT}/register`);
const SITEKEY = one('sitekey', '0x4AAAAAAC-1NguHh8Yx0bZZ');
const RUNS = parseInt(one('runs', '2'), 10);
const COUNT = parseInt(one('count', '1'), 10);
const GIVEN_EMAIL = one('email', '');
const GIVEN_CODE = one('code', '');
const TAG = one('tag', 'orc');
const PROBE_ONLY = has('probe-only');
const REGISTER_ONLY = has('register-only');
// The vision spec solver.js uses when Cloudflare asks for image rounds. `spool`
// is the key-free default (answer by hand, see the header comment); power users
// can pass e.g. `--brain http:https://api.openai.com/v1|gpt-4o-mini|./vision-key.txt`
// or `--brain cohere:command-a-vision-07-2025` with a provider key in the env.
const BRAIN_SPEC = one('brain', 'spool');
// Direct Mailtrap sandbox inboxes (MAILTRAP_TOKEN / ~/.river-mailtrap-token);
// absent, the lane falls back to the toolchain’s local broker box.
const Inbox = require('./inbox.js');
// `--resume --username <u> --password <p>`: an account already registered by a
// previous run (record in accounts.json) — skip sendCode/mail/register and run
// the login→token→verify chain only. Needed because this fork gates *login* on
// the same Turnstile shape as register (measured 2026-10-15: register 200 →
// login 200 "Turnstile token is missing"), and a code-TTL loss must not force a
// whole new account.
const RESUME = has('resume');
const RESUME_USER = one('username', '');
const RESUME_PASS = one('password', '');
// `--verify-only --key <k>`: verify a key that a previous register already
// issued (this fork returns `initial_token` at register but gates
// `POST /api/token/` behind "Security verification is required").
const VERIFY_ONLY = has('verify-only');
const VERIFY_KEY = one('key', '');
// Published layout: keys.txt / models.json / accounts.json / proxies.txt / out/
// all live next to these files, so DIR is the repo root (the dev tree can pass
// --dir to keep its data in the provider folder).
const DIR = path.resolve(one('dir', __dirname));
const MOUNT_OUT = path.join(DIR, 'out', one('mount-out', `captcha-orcarouter-mount`));
const OUT = path.join(DIR, 'out');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, `lane-${new Date().toISOString().slice(0, 10)}.log`);
const log = (...a) => {
  const line = `[${nowIso()}] ${a.join(' ')}`;
  console.log(line);
  appendLine(LOG, line);
};

// ------------------------------------------------------------------- timeline
// The race this lane lost early on was a *timing* race: the mail body became
// readable ~5 min after sendCode (Mailtrap ingests the body behind the
// envelope) while a Turnstile token lives ~5 min — so a token minted before the
// code was readable was already dead at register time. That is only visible
// with a timestamp on every hop, so every run writes one under
// `out/run-<utc>/timeline.json`.
const API_HOST = new URL(API).hostname;
const STAMP = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
})();
const RUN_DIR = path.join(OUT, `run-${STAMP}`);
fs.mkdirSync(RUN_DIR, { recursive: true });
const timeline = {
  tag: TAG,
  provider: path.basename(DIR),
  providerHost: API_HOST,
  api: API,
  front: FRONT,
  sitekey: SITEKEY,
  startedAt: nowIso(),
  runDir: path.relative(DIR, RUN_DIR),
  marks: [],
  windows: [],
};
const flushTimeline = (outcome) => {
  if (outcome) timeline.outcome = outcome;
  timeline.savedAt = nowIso();
  writeJson(path.join(RUN_DIR, 'timeline.json'), timeline);
};
/** Record one hop: `name`, wall-clock, epoch ms, plus any fields the caller has. */
const mark = (name, extra = {}) => {
  const t = { name, at: nowIso(), ms: Date.now(), ...extra };
  timeline.marks.push(t);
  appendLine(path.join(RUN_DIR, 'marks.log'), JSON.stringify(t));
  flushTimeline();
  return t;
};
mark('start');

function lineFile(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.split('#')[0].trim())
      .filter(Boolean)
      .map((l) => {
        const p = parseProxy(l);
        if (p) p.line = l;
        return p;
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

const API_EXITS = lineFile(one('api-exits', path.join(DIR, 'proxies.txt')));
// The mount screen needs exits that reach the FRONT host and the Turnstile CDN;
// the same pool is the right default (solver.js re-screens every line against
// both before spending a run on it) — pass --mount-exits to split the pools.
const MOUNT_EXITS = one('mount-exits', path.join(DIR, 'proxies.txt'));

/** Run the mount solver and return tokens (newest first) with the exit that minted them. */
function mountTokens({ runs = RUNS } = {}) {
  return new Promise((resolve) => {
    if (!fs.existsSync(MOUNT_EXITS)) {
      log(`mount exits file missing: ${MOUNT_EXITS}`);
      return resolve([]);
    }
    const args = [
      path.join(__dirname, 'solver.js'),
      '--type', 'turnstile',
      '--mount', 'turnstile',
      '--sitekey', SITEKEY,
      '--url', MOUNT_URL,
      '--exits', MOUNT_EXITS,
      '--runs', String(runs),
      '--run-attempts', '2',
      // The solver answers image rounds through the vision spec below. `spool`
      // is the key-free default: it writes `out/spool/round-N.png` + state.json
      // and waits for `out/spool/clicks.json` ({"tiles":[...],"verify":true}).
      // On this widget the challenge usually completes with the single click the
      // solver already does (measured: 1/3 runs needed only click 1), so the
      // spool only engages when Cloudflare actually asks for rounds.
      '--brain', BRAIN_SPEC,
      '--brain-proxy', 'pooled',
      '--out', MOUNT_OUT,
    ];
    log(`mount: ${MOUNT_EXITS} -> ${MOUNT_URL} (sitekey ${SITEKEY}, brain ${BRAIN_SPEC})`);
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.stderr.on('data', (c) => {
      out += c;
    });
    const killer = setTimeout(() => {
      try {
        child.kill();
      } catch (e) {}
    }, 20 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(killer);
      appendLine(LOG, `[mount ${nowIso()}] exit=${code}\n${out.split('\n').filter((l) => /run .*attempt|mount click|ok=|SUMMARY|tsErrors/.test(l)).join('\n')}`);
      const tokens = [];
      const parent = path.dirname(MOUNT_OUT);
      const stem = path.basename(MOUNT_OUT).replace(/^captcha-/, '');
      for (const f of fs.readdirSync(parent)) {
        if (!new RegExp(`^captcha-${stem}-run\\d+\\.json$`).test(f)) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(parent, f), 'utf8'));
          const token = String(j.token || '');
          const mintedAt = fs.statSync(path.join(parent, f)).mtimeMs;
          if (token.length > 50 && Date.now() - mintedAt < 290000) {
            const good = (j.attempts || []).find((a) => (a.token || '').length > 50) || j.attempts?.[j.attempts.length - 1] || {};
            tokens.push({ token, file: path.join(parent, f), exit: good.proxy, mintedAt, tsErrors: good.rounds?.[0]?.tsErrors || [] });
          }
        } catch (e) {}
      }
      tokens.sort((a, b) => b.mintedAt - a.mintedAt);
      resolve(tokens);
    });
  });
}

/** One verification attempt; returns {status, message, verdict, exit, param}. */
async function spendOnce(p, token, email, param) {
  const url = `${API}/api/verification?email=${encodeURIComponent(email)}&${param}=${encodeURIComponent(token)}`;
  const res = await req(p, url, { timeoutMs: 15000, connectTimeoutMs: 6000, headers: { accept: 'application/json', 'user-agent': UA } });
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch (e) {}
  const message = String((json && json.message) || res.text || '').slice(0, 220);
  const verdict =
    json && json.success === true
      ? 'ACCEPTED (code sent)'
      : /turnstile.*(empty|为空|missing)|token (is )?empty|为空/i.test(message)
      ? 'SHAPE-NOT-READ'
      : /turnstile|verify|verification failed|人机/i.test(message)
      ? 'TOKEN-REJECTED'
      : /whitelist|白名单|not allowed|不允许|not in the/i.test(message)
      ? 'DOMAIN-BLOCKED'
      : 'OTHER';
  return { status: res.status, message, verdict, exit: p.line || p.raw || `${p.host}:${p.port}`, param };
}

/**
 * Spend one token. The minting exit goes first (same egress as the solve — Cloudflare
 * may judge a token solved on one IP and verified from another more harshly), then
 * every screened API exit races. Param-name variants are tried only while the server
 * answers "token is empty": that answer means the value was never read, so the token
 * is still unspent.
 */
async function spendToken(token, email, mintExit, { conc = 4 } = {}) {
  const params = ['turnstile', 'turnstile_token', 'cf-turnstile-response'];
  const attempts = [];
  for (const param of params) {
    // 1) minting exit first
    if (mintExit) {
      const mintLabel = mintExit.raw || `${mintExit.host}:${mintExit.port}`;
      try {
        const r = await spendOnce(mintExit, token, email, param);
        attempts.push(r);
        log(`  spend[${param}] via mint exit ${mintLabel}: ${r.verdict} ${r.status} ${r.message.slice(0, 140)}`);
        if (r.verdict !== 'SHAPE-NOT-READ') return { ...r, attempts };
      } catch (e) {
        attempts.push({ param, exit: mintLabel, transport: String(e.message).slice(0, 120) });
        log(`  spend[${param}] via mint exit ${mintLabel}: transport ${String(e.message).slice(0, 90)}`);
      }
    }
    // 2) race the screened API exits
    const queue = API_EXITS.filter((p) => !mintExit || p.line !== mintExit.line);
    let done = null;
    const workers = Array.from({ length: Math.min(conc, Math.max(queue.length, 1)) }, async () => {
      while (queue.length && !done) {
        const p = queue.shift();
        try {
          const r = await spendOnce(p, token, email, param);
          attempts.push(r);
          log(`  spend[${param}] via ${p.line}: ${r.verdict} ${r.status} ${r.message.slice(0, 140)}`);
          done = r;
          return;
        } catch (e) {
          attempts.push({ param, exit: p.line, transport: String(e.message).slice(0, 120) });
        }
      }
    });
    await Promise.all(workers);
    if (done && done.verdict !== 'SHAPE-NOT-READ') return { ...done, attempts };
    if (!done) return { verdict: 'TRANSPORT', message: 'all exits failed', attempts };
  }
  return { verdict: 'SHAPE-NOT-READ', message: 'no param shape was read', attempts };
}

async function main() {
  // ---------------- mailbox
  // Which readable class to use is itself a measured gate: panels with a domain
  // whitelist refuse Mailtrap/inboxes (measured on a sibling panel 2026-10-15:
  // `The administrator has enabled the email domain name whitelist, and your
  // email address is not allowed…` for a Mailtrap address) while others accept
  // it (orcarouter: `Verification code sent` + mail delivered). `--mail gmail`
  // uses an Emailnator box, whose body is now readable (`content` field).
  const MAIL_KIND = one('mail', 'mailtrap');
  // A shared gmail box carries foreign services' codes (measured: ShopOS 102035 on a
  // recycled box) — only accept a code from a message that names THIS panel.
  const MAIL_MATCH = new RegExp(
    one('mail-match', new URL(FRONT).hostname.replace(/^www\./, '').split('.')[0]),
    'i'
  );
  const extractPanelCode = (text) => (MAIL_MATCH.test(String(text)) ? extractCode(text) : null);
  let box = null;
  if (RESUME || VERIFY_ONLY) {
    box = { address: RESUME_USER || 'verify-only', provider: RESUME ? 'resumed' : 'verify-only', token: one('box-token', '') };
  } else if (GIVEN_EMAIL) {
    box = { address: GIVEN_EMAIL, provider: 'given', token: one('box-token', '') };
  } else if (MAIL_KIND === 'gmail') {
    // The Emailnator class is a development convenience whose client module is not
    // shipped here; the published build mails through Mailtrap.
    console.error('--mail gmail is not available in this build — set MAILTRAP_TOKEN (sandbox inbox) or pass --email <existing box>');
    process.exit(2);
  } else if (Inbox.available()) {
    // Direct Mailtrap: the measured-good mail class for this panel (a
    // Mailtrap address is accepted and the HTML-only code lands in
    // seconds). Needs MAILTRAP_TOKEN or ~/.river-mailtrap-token — the toolchain’s
    // local broker (127.0.0.1:9700) is the fallback below.
    box = await Inbox.create({ folder: `orcarouter-${TAG}`, tag: TAG });
  } else {
    box = await Mail.create({ provider: MAIL_KIND, folder: `orcarouter-${TAG}`, tag: TAG });
  }
  log(`# mailbox ${box.address} (${box.provider}${box.dotted ? `, dotted ${box.dotted}` : ''}${RESUME ? ' — resume mode, no mail needed' : ''}${VERIFY_ONLY ? ' — verify-only, no mail needed' : ''})`);
  // Keep the box on disk: the inbox id is the only handle for a late harvest —
  // a lane that stops (or a code that lands after the poll window) must not lose
  // it, and `--email <addr> --box-token <id> --register-only --code <code>`
  // resumes exactly this account.
  if (!RESUME && !VERIFY_ONLY) {
    writeJson(path.join(OUT, `box-${Date.now()}.json`), { at: nowIso(), address: box.address, provider: box.provider, token: box.token, dotted: box.dotted || null });
  }
  const accountsPath = path.join(DIR, 'accounts.json');
  const accounts = fs.existsSync(accountsPath) ? JSON.parse(fs.readFileSync(accountsPath, 'utf8')) : [];

  const apiPool = new ExitPool(API_EXITS, { label: 'ur-api' });
  const panel = new Panel(API, apiPool, { log: (m) => log('  ' + m), label: 'ur' });

  /**
   * Verify a key on this provider's own API from an exit that is neither the
   * register nor the sendCode egress (a key is only "verified" when the
   * provider's own API answers it from a different exit). On 200 it appends
   * keys.txt + models.json and records the chat evidence.
   */
  const verifyKey = async (rec, key, { keySource = 'panel-token', regExit = null, spendExit = null } = {}) => {
    const verifyExits = API_EXITS.filter((p) => p.line !== regExit && p.line !== spendExit);
    const verifyPool = verifyExits.length ? new ExitPool(verifyExits, { label: 'ur-verify' }) : apiPool;
    const verifyPanel = new Panel(API, verifyPool, { log: (m) => log('  ' + m), label: 'ur-verify' });
    const v = await verifyPanel.models(key, { tries: 12 });
    rec.verify = {
      host: API_HOST,
      endpoint: '/v1/models',
      status: v.status,
      exit: v.exit,
      registerExit: regExit,
      sendCodeExit: spendExit,
      sameEgress: v.exit === regExit || (!!spendExit && v.exit === spendExit),
      exhausted: !verifyExits.length,
      keySource,
    };
    mark('verifyModels', { status: v.status, exit: v.exit || null, registerExit: regExit || null, sendCodeExit: spendExit, sameEgress: rec.verify.sameEgress, keySource });
    log(`verify GET /v1/models → ${v.status} via ${v.exit} (register exit ${regExit}, sendCode exit ${spendExit}, key source ${keySource})`);
    if (v.status === 200) {
      // Two verdicts, not one: /v1/models 200 says the key is *authentic*, not
      // that it can *spend*. Probe the cheapest measured path first
      // (`<vendor>/free`, then a mini model) with a 1-token completion and record
      // the exact status + body of every rung — a repo that ships keys whose only
      // demonstrated property is "the models list returns 200" gets its first
      // user to discover the 402s.
      let chat = null;
      const probes = [];
      try {
        const models = (v.json && v.json.data) || [];
        const ids = models.map((m) => m.id);
        const ladder = [
          ids.find((id) => /(^|\/)free$/i.test(id)),
          ids.find((id) => /(^|\/)fusion-mini$/i.test(id)),
          ids.find((id) => /(mini|flash-lite|haiku)/i.test(id)),
        ].filter((x, i, a) => x && a.indexOf(x) === i);
        // The exit that just answered /v1/models is the only exit proven alive
        // this second — spend the probes on it first. It is also the exit class
        // that MITMs POSTs (measured: the same HTTP proxy answers GET /v1/models
        // 200 and then fails TLS on POST /v1/chat/completions), so a transport
        // failure there falls straight back to the screened pool.
        const pinned = API_EXITS.find((p) => p.line === v.exit) || null;
        const pinnedPanel = pinned ? new Panel(API, new ExitPool([pinned], { label: 'ur-chat-pinned' }), { log: (m) => log('  ' + m), label: 'ur-chat-pinned' }) : null;
        if (pinned) log(`spend probe pinned to the models exit ${v.exit} (pool fallback armed)`);
        for (const model of ladder.slice(0, 3)) {
          let c = null;
          if (pinnedPanel) {
            try {
              c = await pinnedPanel.chat(key, model, { tries: 1, timeoutMs: 120000, prompt: 'hi', maxTokens: 1 });
              if (c.status === 0) c = null; // transport-shaped answer — use the pool
            } catch (e) {
              log(`  spend probe pinned attempt failed (${String(e.message).slice(0, 80)}) — falling back to the pool`);
              c = null;
            }
          }
          if (!c) c = await verifyPanel.chat(key, model, { tries: 4, timeoutMs: 120000, prompt: 'hi', maxTokens: 1 });
          const p = {
            model,
            status: c.status,
            exit: c.exit,
            sameEgressAsRegister: c.exit === regExit,
            bodySnippet: String((c.json && ((c.json.error && (c.json.error.message || c.json.error)) || c.json.message || (c.json.choices && c.json.choices[0] && c.json.choices[0].message && c.json.choices[0].message.content))) || c.text || '').slice(0, 300),
          };
          probes.push(p);
          mark('spendProbe', p);
          log(`spend probe ${model} → ${p.status} via ${p.exit} :: ${p.bodySnippet.slice(0, 140)}`);
          if (c.status === 200) break; // spendable — no need to burn the next rung
        }
        chat = probes[0] || null;
      } catch (e) {
        chat = { error: String(e.message).slice(0, 120) };
        log(`spend probe did not complete: ${chat.error}`);
      }
      rec.verify.chat = chat;
      rec.verify.spendProbes = probes;
      // Main's protocol shape: {model, status, bodySnippet} of the cheapest rung.
      rec.verify.spend = probes.length ? { model: probes[0].model, status: probes[0].status, bodySnippet: probes[0].bodySnippet } : { error: (chat && chat.error) || 'no model in the list matched the probe ladder' };
      rec.verify.spendable = probes.some((p) => p.status === 200);
      // Re-verifying must not duplicate the line: the key is the row.
      const keysPath = path.join(DIR, 'keys.txt');
      let existing = '';
      try {
        existing = fs.readFileSync(keysPath, 'utf8');
      } catch (e) {}
      if (existing.split(/\r?\n/).includes(key)) log('(key already present in keys.txt — line not duplicated)');
      else appendLine(keysPath, key);
      writeJson(path.join(DIR, 'models.json'), { at: nowIso(), keyPrefix: key.slice(0, 8), keySource, status: v.status, exit: v.exit, registerExit: regExit, models: (v.json && v.json.data) || [] });
      log(`✔ KEY WRITTEN (own-host 200) — ${String(key).slice(0, 10)}…`);
      rec.verify.keyWritten = true;
    } else {
      log(`✖ own-host verify answered ${v.status} — key NOT written`);
      rec.verify.keyWritten = false;
    }
    if (!accounts.includes(rec)) accounts.push(rec);
    writeJson(accountsPath, accounts);
    flushTimeline(rec.verify.keyWritten ? 'key-written' : 'verify-failed');
    return v;
  };

  // `--verify-only --key <k> [--username <u>]`: no mount, no mail, no register —
  // check a key a previous register already issued. Needed because this fork
  // gates `POST /api/token/` behind a security-verification step (measured
  // 2026-10-15: `403 Security verification is required`) while the register
  // response itself carries `initial_token` — that token is the account's key.
  if (VERIFY_ONLY) {
    if (!VERIFY_KEY) {
      log('--verify-only needs --key <key>');
      flushTimeline('verify-only-no-key');
      return;
    }
    const prev = RESUME_USER ? accounts.find((a) => a.username === RESUME_USER) : null;
    const rec = prev || { provider: 'orcarouter', base: API, index: accounts.length + 1, username: RESUME_USER || null, email: null, createdAt: nowIso(), steps: {}, shapes: [] };
    rec.steps = rec.steps || {};
    mark('verifyOnly', { username: rec.username || null, prefix: String(VERIFY_KEY).slice(0, 12), registerExit: (rec.steps.register && rec.steps.register.exit) || null });
    await verifyKey(rec, VERIFY_KEY, {
      keySource: 'register-initial_token',
      regExit: (rec.steps.register && rec.steps.register.exit) || null,
      spendExit: rec.sendCodeExit || null,
    });
    return;
  }

  // ---------------- token #1 + mail verdict
  let verdict = null;
  let spentToken = null;
  let firstTokens = [];
  let sendCodeAt = null;
  let pendingRemount = null;
  if (!REGISTER_ONLY && !RESUME) {
    mark('mountStart', { runs: PROBE_ONLY ? 2 : RUNS, exits: MOUNT_EXITS });
    firstTokens = await mountTokens({ runs: PROBE_ONLY ? 2 : RUNS });
    mark('mountDone', { tokens: firstTokens.map((t) => ({ file: path.basename(t.file), exit: t.exit, len: t.token.length, ageMs: Date.now() - t.mintedAt })) });
    log(`mount produced ${firstTokens.length} token(s)${firstTokens[0] ? ` (newest len=${firstTokens[0].token.length}, exit=${firstTokens[0].exit})` : ''}`);
    if (!firstTokens.length) {
      log('mount produced no token — nothing to spend (see mount log above for tsErrors)');
    } else {
      for (const t of firstTokens.slice(0, 2)) {
        verdict = await spendToken(t.token, box.address, parseProxy(t.exit));
        log(`token#1 ${t.file.split(path.sep).pop()} → ${verdict.verdict} :: ${verdict.message.slice(0, 160)}`);
        if (verdict.verdict === 'ACCEPTED (code sent)') {
          spentToken = t;
          sendCodeAt = Date.now();
          mark('sendCode', { verdict: verdict.verdict, status: verdict.status, spendExit: verdict.exit || null, tokenFile: path.basename(t.file), tokenLen: t.token.length });
          // The lost race, fixed here: this token lives ~5 min and the body of
          // the mail it just triggered becomes readable ~5 min from now (same
          // magnitude) — so the token that will carry *register* must be minted
          // **during** this wait, not before it. Mount it in parallel with the
          // code poll and prefer it at register time.
          log('starting the register-mount in parallel with the code wait (token TTL vs mail-lag race)');
          pendingRemount = mountTokens({ runs: 2 }).catch((e) => {
            log(`parallel mount failed: ${String(e.message).slice(0, 140)}`);
            return [];
          });
          break;
        }
        if (verdict.verdict === 'DOMAIN-BLOCKED') {
          spentToken = t;
          mark('sendCode', { verdict: verdict.verdict, status: verdict.status, spendExit: verdict.exit || null, tokenFile: path.basename(t.file) });
          break;
        }
        mark('sendCode', { verdict: verdict.verdict, status: verdict.status, spendExit: verdict.exit || null, tokenFile: path.basename(t.file), note: 'not accepted' });
        // TOKEN-REJECTED / TRANSPORT: try the next token instead of burning time re-spending one
      }
    }
  }
  if (verdict) {
    writeJson(path.join(OUT, `verdict-${Date.now()}.json`), { at: nowIso(), email: box.address, verdict });
  }
  if (!RESUME && (PROBE_ONLY || (!REGISTER_ONLY && (!verdict || verdict.verdict !== 'ACCEPTED (code sent)')))) {
    log(`stop: ${verdict ? verdict.verdict : 'no-token'}`);
    flushTimeline(`stop-${verdict ? verdict.verdict : 'no-token'}`);
    return;
  }

  // ---------------- code
  // The instrumented poller: same reader logic as `Mail.waitCode` (list → read →
  // flatten html), but it also records *when* the message and its body first
  // became readable — the quantity that early race was about. 10 minutes, not
  // 4: the envelope can arrive in ~1 s while the body lags minutes behind
  // (measured 2026-10-15: `received_at` 07:12:51, body readable ~07:18, lane
  // stopped at 07:17 with "no code"). The panel's code TTL is 10 min.
  const pollCodeWindow = async (win, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      win.polls++;
      let msgs = [];
      try {
        msgs = await (box.direct ? Inbox.list(box) : Mail.list(box));
        win.lastListError = null;
      } catch (e) {
        win.lastListError = String(e.message).slice(0, 140);
        win.errors.push({ at: nowIso(), list: win.lastListError });
      }
      let found = null;
      for (const m of msgs) {
        let rec = win.messages.find((x) => x.id === String(m.id));
        if (!rec) {
          rec = {
            id: String(m.id),
            subject: String(m.subject || '').slice(0, 90),
            from: String(m.from || '').slice(0, 90),
            receivedAt: m.receivedAt || m.received_at || null,
            firstSeenAt: nowIso(),
            firstSeenMs: Date.now(),
            pollIndex: win.polls,
            listTextLen: String(m.text || '').length,
            listHtmlLen: String(m.html || '').length,
            bodySource: null,
            codeAt: null,
          };
          win.messages.push(rec);
          log(`  mail[${rec.id}] visible in list +${((rec.firstSeenMs - win.ms) / 1000).toFixed(1)}s (subject "${rec.subject}", from ${rec.from}, receivedAt ${rec.receivedAt}, list text=${rec.listTextLen}B html=${rec.listHtmlLen}B)`);
        }
        let text = `${m.subject || ''}\n${m.text || ''}`;
        let source = 'list.text';
        let hit = extractPanelCode(text);
        if (!hit) {
          try {
            const full = await (box.direct ? Inbox.read(box, m.id) : Mail.read(box, m.id));
            const readable = full.text && /[\dA-Za-z]{4,}/.test(full.text);
            source = readable ? 'read.text' : 'read.html';
            rec.readAt = nowIso();
            rec.readTextLen = String(full.text || '').length;
            rec.readHtmlLen = String(full.html || '').length;
            text = `${full.subject || ''}\n${readable ? full.text : flattenHtml(full.html || '')}`;
            hit = extractPanelCode(text);
          } catch (e) {
            win.errors.push({ at: nowIso(), read: String(e.message).slice(0, 140) });
          }
        }
        if (hit) {
          rec.bodySource = source;
          rec.codeAt = nowIso();
          rec.codeMs = Date.now();
          found = { code: hit, message: m, text, source };
          break;
        }
      }
      if (found) return found;
      await sleep(5000);
    }
    return null;
  };

  let code = GIVEN_CODE;
  if (!RESUME && !code) {
    log('waiting for the verification code (up to 600s)…');
    const win = { label: 'code-1', startedAt: nowIso(), ms: Date.now(), polls: 0, messages: [], errors: [] };
    timeline.windows.push(win);
    const got = await pollCodeWindow(win, 600000);
    if (!got) {
      mark('codeTimeout', { windowMs: 600000, sinceSendCodeMs: sendCodeAt ? Date.now() - sendCodeAt : null, messages: win.messages });
      log('no code arrived in 600s — stopping (the mail was accepted; the box is readable, so this is a delivery-time question)');
      flushTimeline('no-code-in-600s');
      return;
    }
    code = got.code;
    const msgReceivedAt = (got.message && (got.message.receivedAt || got.message.received_at)) || null;
    mark('codeRead', {
      code,
      source: got.source,
      messageId: String((got.message && got.message.id) || ''),
      subject: String((got.message && got.message.subject) || '').slice(0, 90),
      receivedAt: msgReceivedAt,
      sinceSendCodeMs: sendCodeAt ? Date.now() - sendCodeAt : null,
      sinceSendCodeMsOfWindow: sendCodeAt ? Date.now() - sendCodeAt : null,
      envelopeLagMs: sendCodeAt && msgReceivedAt ? new Date(msgReceivedAt).getTime() - sendCodeAt : null,
    });
    log(`code ${code} read${sendCodeAt ? ` ${((Date.now() - sendCodeAt) / 1000).toFixed(1)}s after sendCode` : ''} (via ${got.source}, subject: ${String(got.message.subject || '').slice(0, 80)})`);
  }

  // ---------------- register shape probe (dummy token does NOT consume anything)
  const username = RESUME ? RESUME_USER : `cw${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
  const password = RESUME ? RESUME_PASS : `Cw${Math.random().toString(36).slice(2, 10)}!7a`;
  let rec = null;
  /**
   * The non-resume path: probe the register shape → pick a token that is still
   * inside its TTL → register → `rec`. Returns false when the lane must stop.
   */
  const doRegister = async () => {
  /** One register request under a given turnstile-passing shape. */
  const registerCall = (shapeName, token, codeValue) => {
    const body = { username, password, password2: password, email: box.address, verification_code: codeValue, aff_code: '' };
    let pathname = '/api/user/register';
    let headers = {};
    if (shapeName === 'body') body.turnstile = token;
    if (shapeName === 'query') pathname += `?turnstile=${encodeURIComponent(token)}`;
    if (shapeName === 'header') headers = { Turnstile: token };
    return panel.call(pathname, { method: 'POST', body, headers, tries: 4, timeoutMs: 30000 });
  };
  const dummy = 'omp-dummy-0000000000000000000000000000';
  let shape = null;
  const shapeEvidence = [];
  for (const s of ['body', 'query', 'header']) {
    const r = await registerCall(s, dummy, '000000');
    const msg = String((r.json && r.json.message) || r.text || '').slice(0, 200);
    log(`register shape[${s}] → ${r.status} ${msg}`);
    shapeEvidence.push({ shape: s, status: r.status, message: msg });
    mark('shapeProbe', { shape: s, status: r.status, message: msg.slice(0, 160), exit: r.exit || null });
    if (/turnstile/i.test(msg) && !/(empty|为空|missing)/i.test(msg)) {
      shape = s; // a shape the fork actually reads answers with a FAILURE (token consumed)
      break;
    }
    // The code check answering before any turnstile complaint means this fork does
    // not gate register on the token at all (the token-free path saves a whole
    // mount, ~9 minutes per account).
    if (/(verification code|验证码).*(incorrect|expired|错误|过期)/i.test(msg)) {
      shape = 'none';
      break;
    }
  }
  if (!shape) {
    log('no register shape reached the turnstile check — stopping with evidence');
    writeJson(path.join(OUT, `shape-${Date.now()}.json`), { at: nowIso(), email: box.address, username, shapes: shapeEvidence });
    mark('shapeUndecided', { shapes: shapeEvidence });
    flushTimeline('no-register-shape');
    return false;
  }
  mark('shapeDecided', { shape });
  log(shape === 'none' ? 'register does not gate on turnstile — trying without a token' : `register reads turnstile via ${shape} — mounting token #2`);

  // ---------------- token #2 + register + login + key
  rec = {
    provider: 'orcarouter',
    base: API,
    index: accounts.length + 1,
    username,
    password,
    email: box.address,
    box,
    createdAt: nowIso(),
    shapes: shapeEvidence,
    sendCodeExit: (verdict && verdict.exit) || null,
    sendCodeAt: sendCodeAt ? new Date(sendCodeAt).toISOString() : null,
    timeline: path.relative(DIR, path.join(RUN_DIR, 'timeline.json')),
    steps: {},
  };
  // Which token can carry the register? One still inside its own TTL — nothing
  // else. `preSend` stays as evidence, not as a veto: a token minted 60 s before
  // sendCode is ~67 s old when a fast mail (tonight: 6-7 s) lets the register go
  // immediately, and that is perfectly valid; on a slow mail the same token is
  // caught by the age cutoff anyway. The parallel mount therefore is awaited
  // only when nothing on hand is fresh — insurance when the mail lags, zero
  // wall-clock cost when it does not.
  const tokenSource = firstTokens.map((t) => ({ ...t, from: 'first-mount' }));
  const onHandFresh = tokenSource.filter((t) => t !== spentToken && Date.now() - t.mintedAt <= 260000);
  let remountTokens = [];
  if (shape !== 'none' && !onHandFresh.length) {
    if (!pendingRemount) {
      log('no tokens on hand (register-only path) — mounting fresh tokens');
      pendingRemount = mountTokens({ runs: 2 });
    }
    remountTokens = await pendingRemount.catch(() => []);
    tokenSource.push(...remountTokens.map((t) => ({ ...t, from: 'parallel-mount' })));
  } else if (pendingRemount) {
    mark('remountNotNeeded', { onHandFresh: onHandFresh.map((t) => ({ file: path.basename(t.file), ageMs: Date.now() - t.mintedAt })) });
    log(`register can use an on-hand token (age ${Math.round((Date.now() - onHandFresh[0].mintedAt) / 1000)}s) — the parallel mount keeps running as insurance`);
  }
  const seenTokens = new Set();
  const candidates = [];
  for (const t of tokenSource) {
    if (t === spentToken) continue;
    if (seenTokens.has(t.token)) {
      // The parallel mount overwrites the first mount's files; the same token
      // string can therefore appear twice — keep the occurrence that knows it
      // was re-minted.
      if (t.from === 'parallel-mount') {
        const prev = candidates.find((c) => c.token === t.token);
        if (prev) prev.from = 'parallel-mount';
      }
      continue;
    }
    seenTokens.add(t.token);
    const ageMs = Date.now() - t.mintedAt;
    candidates.push({
      ...t,
      ageMs,
      stale: ageMs > 280000, // Turnstile token TTL ~5 min — a dead token buys only a measured rejection
      preSend: sendCodeAt ? t.mintedAt < sendCodeAt - 20000 : false,
    });
  }
  candidates.sort((a, b) => a.ageMs - b.ageMs);
  const fresh = candidates.filter((c) => !c.stale);
  mark('registerCandidate', {
    remount: remountTokens.map((t) => ({ file: path.basename(t.file), exit: t.exit, ageMs: Date.now() - t.mintedAt })),
    candidates: candidates.map((c) => ({ file: path.basename(c.file), from: c.from, exit: c.exit, ageMs: c.ageMs, stale: c.stale, preSend: c.preSend })),
    fresh: fresh.length,
    staleRejected: candidates.filter((c) => c.stale).length,
    onHandFresh: onHandFresh.length,
  });
  // Hedge: if the code was read so late that its 10-minute TTL barely covers the
  // register, restart the TTL with one fresh token and read the new mail — the
  // register then runs with the remaining fresh tokens (≥2 required to try it).
  if (shape !== 'none' && code !== GIVEN_CODE && sendCodeAt && Date.now() - sendCodeAt > 420000 && fresh.length >= 2) {
    const refresher = fresh[fresh.length - 1];
    const rr = await spendToken(refresher.token, box.address, parseProxy(refresher.exit));
    mark('codeRefresh', { verdict: rr.verdict, status: rr.status, spendExit: rr.exit || null, file: path.basename(refresher.file), sinceSendCodeMs: Date.now() - sendCodeAt });
    log(`code refresh via ${path.basename(refresher.file)} → ${rr.verdict} ${String(rr.message).slice(0, 120)}`);
    if (rr.verdict === 'ACCEPTED (code sent)') {
      const win2 = { label: 'code-2', startedAt: nowIso(), ms: Date.now(), polls: 0, messages: [], errors: [] };
      timeline.windows.push(win2);
      const got2 = await pollCodeWindow(win2, 240000);
      if (got2 && got2.code) {
        code = got2.code;
        mark('codeRefreshRead', { code: got2.code, sinceRefreshMs: Date.now() - win2.ms, source: got2.source });
        log(`fresh code ${code} (via ${got2.source})`);
      } else {
        mark('codeRefreshTimeout', { windowMs: 240000, messages: win2.messages });
        log('fresh code did not become readable in 240s — keeping the first code');
      }
    }
    const ri = fresh.indexOf(refresher);
    if (ri >= 0) fresh.splice(ri, 1);
  }
  const staleFallback = candidates.filter((c) => !fresh.includes(c)).slice(0, 1);
  const registerRounds = shape === 'none' ? [{ token: '', noToken: true }] : [...fresh, ...staleFallback].slice(0, 4);
  log(`register rounds: ${registerRounds.length} (fresh ${fresh.length}/${candidates.length}${shape === 'none' ? ', token-free' : ''})`);
  let registered = null;
  for (const t of registerRounds) {
    const r = await registerCall(shape === 'none' ? 'none' : shape, t.token, code);
    const msg = String((r.json && r.json.message) || r.text || '').slice(0, 220);
    rec.steps.register = { status: r.status, message: msg, exit: r.exit, tokenLen: t.token.length, noToken: !!t.noToken, tokenFrom: t.from || null, tokenAgeMs: t.mintedAt ? Date.now() - t.mintedAt : null };
    mark('register', { status: r.status, message: msg.slice(0, 180), exit: r.exit || null, tokenFile: t.file ? path.basename(t.file) : null, tokenFrom: t.from || null, tokenLen: t.token.length, tokenAgeMs: t.mintedAt ? Date.now() - t.mintedAt : null, success: !!(r.json && r.json.success === true) });
    log(`register → ${r.status} ${msg} (token len ${t.token.length}${t.from ? `, ${t.from}, age ${Math.round((Date.now() - t.mintedAt) / 1000)}s` : ''})`);
    if (r.json && r.json.success === true) {
      registered = r;
      // The register response carries the user id and the fork's initial token
      // (measured: `{"data":{…,"id":250881,"initial_token":"<key>"}}`) —
      // needed for the auth header, and as the last-resort key.
      if (r.json.data && r.json.data.id && !panel.userId) panel.userId = r.json.data.id;
      rec.data = r.json.data
        ? { id: r.json.data.id || null, workspaceId: r.json.data.active_workspace_id || null, initialToken: r.json.data.initial_token || null, isNewSignup: !!r.json.data.is_new_signup }
        : null;
      break;
    }
    if (/(verification code|验证码).*(incorrect|expired|错误|过期)/i.test(msg)) {
      log('code was rejected — stopping (code TTL/parse question, not a captcha one)');
      break;
    }
  }
  if (!registered) {
    accounts.push(rec);
    writeJson(accountsPath, accounts);
    log('register did not succeed — record written');
    flushTimeline('register-failed');
    return false;
  }
  return true;
  };

  if (RESUME) {
    rec =
      accounts.find((a) => a.username === RESUME_USER) ||
      { provider: 'orcarouter', base: API, index: accounts.length + 1, username, password, email: null, createdAt: nowIso(), steps: {}, shapes: [] };
    rec.steps = rec.steps || {};
    // Records written before this field existed keep the register payload only
    // inside the (sliced) register message — recover the structured bits from
    // the recorded evidence instead of re-registering.
    if (!rec.data && rec.steps.register && rec.steps.register.message) {
      const m = /"id":(\d+)/.exec(rec.steps.register.message);
      const it = /"initial_token":"([^"]+)"/.exec(rec.steps.register.message);
      const ws = /"active_workspace_id":(\d+)/.exec(rec.steps.register.message);
      if (m || it) {
        rec.data = { id: m ? Number(m[1]) : null, workspaceId: ws ? Number(ws[1]) : null, initialToken: it ? it[1] : null, recovered: 'parsed from the recorded register message' };
        log(`resume: recovered userId=${rec.data.id} initialToken=${it ? 'yes' : 'no'} from the recorded register payload`);
      }
    }
    if (rec.data && rec.data.id && !panel.userId) panel.userId = rec.data.id;
    mark('resume', {
      username,
      registerExit: (rec.steps.register && rec.steps.register.exit) || null,
      userId: (rec.data && rec.data.id) || null,
      registerSession: !!panel.cookie,
      initialToken: !!(rec.data && rec.data.initialToken),
    });
    log(`resume: ${username} — register exit ${(rec.steps.register && rec.steps.register.exit) || 'n/a'}, register session ${panel.cookie ? 'held' : 'missing'}`);
  } else {
    const registeredOk = await doRegister();
    if (!registeredOk) return;
  }

  // ---------------- login (register session first, turnstile-gated login second)
  const messageOf = (r) => String((r && r.json && (r.json.message || r.json.error)) || (r && r.text) || '').slice(0, 180);
  const adoptSession = (r) => {
    if (r && r.json && r.json.data) {
      panel.userId = r.json.data.id || r.json.data.user_id || panel.userId;
      if (r.json.data.access_token) panel.accessToken = r.json.data.access_token;
    }
  };
  let lg = null;
  // The register response already carries the user id, and the cookie jar of the
  // register call still rides on every panel request — so `self` is tried before
  // spending a mount on the login gate.
  const sess = await panel.self(4).catch((e) => ({ status: 0, json: null, text: String(e.message) }));
  mark('selfAfterRegister', { status: sess.status, message: messageOf(sess).slice(0, 160), exit: sess.exit || null });
  log(`self (register session) → ${sess.status} ${messageOf(sess).slice(0, 120)}`);
  if (sess.json && sess.json.success === true) {
    lg = { status: sess.status, json: { success: true, message: 'authenticated via the register session' }, exit: sess.exit };
  } else {
    lg = await panel.login({ username, password, tries: 8 });
    adoptSession(lg);
    let lmsg = messageOf(lg);
    // This fork gates *login* on the same Turnstile shape as register (measured
    // 2026-10-15: login 200 "Turnstile token is missing") — mount fresh tokens
    // for it; a token is burnt only while the answer says the gate was read.
    if (!(lg.json && lg.json.success) && /turnstile/i.test(lmsg)) {
      log('login gates on a turnstile token — mounting a token for login');
      const lt = await mountTokens({ runs: 2 });
      mark('loginMount', { tokens: lt.map((t) => ({ file: path.basename(t.file), exit: t.exit, ageMs: Date.now() - t.mintedAt })) });
      for (const t of lt.slice(0, 2)) {
        const r = await panel.call(`/api/user/login?turnstile=${encodeURIComponent(t.token)}`, { method: 'POST', body: { username, password }, tries: 6, timeoutMs: 30000 });
        adoptSession(r);
        lmsg = messageOf(r);
        mark('loginTurnstile', { file: path.basename(t.file), status: r.status, message: lmsg.slice(0, 160), success: !!(r.json && r.json.success), exit: r.exit || null });
        log(`login[?turnstile] via ${path.basename(t.file)} → ${r.status} ${lmsg.slice(0, 140)}`);
        lg = r;
        if (r.json && r.json.success) break;
        if (!/turnstile/i.test(lmsg)) break; // a non-captcha failure must not burn tokens
      }
    }
  }
  rec.steps.login = { status: lg.status, message: messageOf(lg).slice(0, 160) };
  mark('login', { status: lg.status, success: !!(lg.json && lg.json.success), message: rec.steps.login.message.slice(0, 160), exit: lg.exit || null });
  log(`login → ${lg.status} ${rec.steps.login.message}`);

  let key = null;
  let keySource = 'panel-token';
  if (lg.json && lg.json.success) {
    const tok = await panel.createToken(`w3-${TAG}`, 8);
    rec.steps.token = { status: tok.status, message: String((tok.json && tok.json.message) || '').slice(0, 160), key: tok.key ? `${String(tok.key).slice(0, 8)}…` : null };
    mark('createToken', { status: tok.status, message: rec.steps.token.message.slice(0, 160), hasKey: !!tok.key, exit: tok.exit || null });
    log(`createToken → ${tok.status} ${rec.steps.token.message}${tok.key ? ' key=' + rec.steps.token.key : ''}`);
    key = tok.key;
    if (!key) {
      const list = await panel.listTokens(6);
      const first = list.items && list.items[0];
      if (first && first.id) {
        const k = await panel.tokenKey(first.id, 4);
        key = k.key;
        log(`tokenKey(${first.id}) → ${k.status} ${String(k.key || k.text || '').slice(0, 24)}`);
      }
    }
  }
  if (!key && rec.data && rec.data.initialToken) {
    // A login wall (or a security-verification gate on `POST /api/token/`) is
    // not a key wall: the register itself issued `initial_token`, so the
    // account still yields a key if that token authenticates on the provider's
    // own API.
    key = rec.data.initialToken;
    keySource = 'register-initial_token';
    mark('keyFallback', { source: keySource, reason: lg.json && lg.json.success ? 'token-create-no-key' : 'login-failed', prefix: String(key).slice(0, 12) });
    log('no panel token materialized — falling back to the register-issued initial_token');
  }
  if (!key) {
    if (!accounts.includes(rec)) accounts.push(rec);
    writeJson(accountsPath, accounts);
    log('no key materialized — record written');
    flushTimeline('no-key');
    return;
  }

  // ---- own-host verification, on an exit that is neither the sendCode nor the
  // register egress (a key is only "verified" when the *provider's own API*
  // answers it from a different exit).
  await verifyKey(rec, key, {
    keySource,
    regExit: (rec.steps.register && rec.steps.register.exit) || null,
    spendExit: (verdict && verdict.exit) || rec.sendCodeExit || null,
  });
}

main().catch((e) => {
  log(`FATAL ${e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e}`);
  process.exit(1);
});
