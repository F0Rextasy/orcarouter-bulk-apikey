#!/usr/bin/env node
'use strict';

/**
 * verify.js — re-check every key in keys.txt, with two verdicts per key.
 *
 *   1. authentic — `GET /v1/models` on the provider's own host answers 200.
 *   2. spendable — one 1-token completion (`max_tokens: 1`, prompt "hi") on the
 *      cheapest listed path, cheapest first. On this provider that is
 *      `orcarouter/free`, then `orcarouter/fusion-mini`.
 *
 * A `402`/`429` on rung 2 does NOT mean the key is broken — it means the account
 * behind it has no credits (or, for the free-tier models, no GitHub-linked
 * workspace owner). See README § Verified. Exit code is 0 when every key is at
 * least authentic.
 *
 *   node src/verify.js                 # proxy pool: proxies.txt
 *   node src/verify.js --key <key> # one key, without touching keys.txt
 */

const fs = require('fs');
const path = require('path');
const { ExitPool, nowIso } = require('./lib.js');
const { Panel } = require('./newapi.js');
const { parseProxy } = require('./proxy.js');

const API = 'https://api.orcarouter.ai';
const argv = process.argv.slice(2);
const one = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const DIR = __dirname;
const ONE_KEY = one('key', '');
const EXIT_FILE = one('exits', path.join(DIR, 'proxies.txt'));

function exits() {
  try {
    return fs
      .readFileSync(EXIT_FILE, 'utf8')
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

const keys = ONE_KEY
  ? [ONE_KEY]
  : (() => {
      try {
        return fs.readFileSync(path.join(DIR, 'keys.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      } catch (e) {
        return [];
      }
    })();

(async () => {
  const list = exits();
  if (!list.length) {
    console.error(`no exits in ${EXIT_FILE} — one line per exit, scheme://host:port`);
    process.exit(2);
  }
  console.log(`verify: ${keys.length} key(s), pool ${list.length} exit(s), ${nowIso()}\n`);
  let authenticated = 0;
  let spendable = 0;
  const out = [];
  for (const key of keys) {
    const pool = new ExitPool(list, { label: 'verify' });
    const panel = new Panel(API, pool, { label: 'verify' });
    const rec = { keyPrefix: key.slice(0, 12), at: nowIso() };
    try {
      const m = await panel.models(key, { tries: 12 });
      rec.models = { status: m.status, exit: m.exit };
      const ids = m.status === 200 ? ((m.json && m.json.data) || []).map((x) => x.id) : [];
      console.log(`${rec.keyPrefix}…  models ${m.status} via ${m.exit}${m.status === 200 ? ` (${ids.length} models)` : ''}`);
      if (m.status !== 200) {
        rec.verdict = 'not authentic';
        out.push(rec);
        continue;
      }
      authenticated++;
      const ladder = [
        ids.find((id) => /(^|\/)free$/i.test(id)),
        ids.find((id) => /(^|\/)fusion-mini$/i.test(id)),
        ids.find((id) => /(mini|flash-lite|haiku)/i.test(id)),
      ].filter((x, i, a) => x && a.indexOf(x) === i);
      rec.spend = [];
      if (!ladder.length) {
        rec.verdict = 'authentic + spend-gated (no model matched the probe ladder)';
        console.log('  spend probe: no model matched the ladder');
      }
      for (const model of ladder.slice(0, 3)) {
        const c = await panel.chat(key, model, { tries: 4, timeoutMs: 120000, prompt: 'hi', maxTokens: 1 });
        const bodySnippet = String(
          (c.json && ((c.json.error && (c.json.error.message || c.json.error)) || c.json.message || (c.json.choices && c.json.choices[0] && c.json.choices[0].message && c.json.choices[0].message.content))) || c.text || ''
        ).slice(0, 300);
        rec.spend.push({ model, status: c.status, exit: c.exit, bodySnippet });
        console.log(`  spend ${model} → ${c.status} via ${c.exit} :: ${bodySnippet.slice(0, 140)}`);
        if (c.status === 200) break;
      }
      const spent = rec.spend.find((p) => p.status === 200);
      if (spent) {
        spendable++;
        rec.verdict = `authentic + spendable (${spent.model} answered)`;
      } else {
        const first = rec.spend[0] || { model: '-', status: '-', bodySnippet: 'probe did not run' };
        rec.verdict = `authentic + spend-gated (${first.model} → ${first.status})`;
      }
    } catch (e) {
      rec.error = String(e.message).slice(0, 160);
      rec.verdict = 'transport — not measured';
      console.log(`${rec.keyPrefix}…  transport: ${rec.error}`);
    }
    out.push(rec);
    console.log(`  ⇒ ${rec.verdict}\n`);
  }
  console.log(`summary: ${keys.length} key(s) · authentic ${authenticated} · spendable ${spendable}`);
  try {
    fs.writeFileSync(path.join(DIR, 'out', 'verify-last.json'), JSON.stringify({ at: nowIso(), api: API, results: out }, null, 2));
  } catch (e) {
    fs.mkdirSync(path.join(DIR, 'out'), { recursive: true });
    fs.writeFileSync(path.join(DIR, 'out', 'verify-last.json'), JSON.stringify({ at: nowIso(), api: API, results: out }, null, 2));
  }
  process.exit(authenticated === keys.length ? 0 : 1);
})().catch((e) => {
  console.error('verify failed:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  process.exit(1);
});
