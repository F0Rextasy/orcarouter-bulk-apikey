#!/usr/bin/env node
'use strict';

/**
 * mint.js — mint N accounts, one key each, with the orcarouter lane.
 *
 * The lane (`turnstile-lane.js`) does exactly one account per process, so this
 * driver runs it repeatedly and keeps the yield record: every attempt's wall
 * time, the mail latency, the Turnstile token's age at submit, the register
 * status and the key verification — into `out/mint-<ts>/{summary.json,yield.tsv}`.
 *
 *   node src/mint.js                            # 5 keys (the sample default)
 *   node src/mint.js --count 30                 # any N
 *   node src/mint.js --count 3 --conc 2         # two lanes in parallel (more browsers)
 *   node src/mint.js --attempts 12              # attempts cap (default: count + 3)
 *
 * The exit pool is optional: `--pool FILE` (or a `proxies.txt` next to this
 * file) routes every request through an exit from that list; without a pool
 * the lane and the solver connect directly.
 *
 * Nobody gets a key it did not earn: a key is only appended to keys.txt after
 * `GET /v1/models` answers 200 for it on the provider's own host (from an exit
 * different from the mint exit whenever the pool offers one), and the record
 * carries the spend probe verdict
 * (this provider is credit-gated — see README § Verified).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const one = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

// Run-shape presets (operator standard v3): `--preset=turbo|balanced|safe` picks the
// lane count (turbo = 5, clamped by this repo's 1-3 lane cap) and the pacing gap;
// explicit `--conc` / `--gap` always win and no `--preset` keeps today's defaults.
const { presetArgv, resolvePreset } = require('./preset');
const gapArg = one('gap', null);
const PRESET = resolvePreset({
  preset: presetArgv(argv) || one('preset', null),
  conc: null,
  gap: gapArg == null ? null : parseFloat(gapArg),
  defaultConc: 1,
});
const GAP_MS = PRESET.gap == null ? null : Math.max(0, PRESET.gap) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keep the loop alive when a lane's socket dies mid-run.
process.on('uncaughtException', (e) => console.log(`WARN uncaught: ${String(e && e.message).slice(0, 180)}`));

const COUNT = parseInt(one('count', '5'), 10);
const ATTEMPTS = parseInt(one('attempts', String(Math.max(COUNT + 3, 6))), 10);
const CONC = Math.max(1, Math.min(3, parseInt(one('conc', String(PRESET.conc)), 10)));
const RUNS = one('runs', '2');
const TAG = one('tag', 'orc');
// --pool overrides proxies.txt (lists live under out/); no pool at all = direct.
const POOL = one('pool', '');

const DIR = __dirname;
const OUT = path.join(DIR, 'out');
const KEYS = path.join(DIR, 'keys.txt');
const LANE = path.join(DIR, 'turnstile-lane.js');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
const LOOP_DIR = path.join(OUT, `mint-${STAMP}`);

if (has('help') || has('h')) {
  console.log('usage: node src/mint.js [--count N] [--attempts N] [--conc N] [--runs N] [--tag orc] [--pool FILE]');
  console.log('  --count     how many keys to mint            (default 5)');
  console.log('  --attempts  attempt cap across all lanes     (default count + 3)');
  console.log('  --conc      parallel lanes, 1-3              (default 1)');
  console.log('  --runs      solver runs per Turnstile token  (default 2)');
  console.log('  --pool      exit list, default proxies.txt   [optional]');
  console.log('  --preset    turbo|balanced|safe              (default: none — 1 lane)');
  console.log('  --gap       seconds between attempts         (default: none)');
  console.log('exits: one per line in proxies.txt — scheme://host:port[#comment], user:pass@ supported');
  console.log('without a pool the tool connects directly.');
  process.exit(0);
}
if (!POOL && !fs.existsSync(path.join(DIR, 'proxies.txt'))) {
  // No pool = DIRECT mode: a proxy is recommended at scale (per-IP limits,
  // bans) but the run works without one. The lane prints the same notice.
  console.log('no proxies.txt next to mint.js — running WITHOUT a proxy (direct). Put one exit per line in it (or pass --pool) to route through them.');
}
const POOL_LABEL = POOL ? path.basename(POOL) : fs.existsSync(path.join(DIR, 'proxies.txt')) ? 'proxies.txt' : 'direct';

fs.mkdirSync(LOOP_DIR, { recursive: true });
const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  fs.appendFileSync(path.join(LOOP_DIR, 'loop.log'), line + '\n');
};

const keyLines = () => {
  try {
    return fs.readFileSync(KEYS, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
};

/** The lane writes every hop into `out/run-<ts>/timeline.json` — read the newest one. */
function readYield(sinceMs) {
  let best = null;
  for (const d of fs.readdirSync(OUT)) {
    if (!/^run-/.test(d)) continue;
    const dir = path.join(OUT, d);
    let st;
    try {
      st = fs.statSync(dir);
    } catch (e) {
      continue;
    }
    if (st.mtimeMs < sinceMs - 2000) continue;
    if (!best || st.mtimeMs > best.mtimeMs) best = { dir, mtimeMs: st.mtimeMs, name: d };
  }
  if (!best) return { runDir: null };
  let tl = null;
  try {
    tl = JSON.parse(fs.readFileSync(path.join(best.dir, 'timeline.json'), 'utf8'));
  } catch (e) {}
  if (!tl) return { runDir: best.name, timeline: null };
  const marks = tl.marks || [];
  const m = (name) => [...marks].reverse().find((x) => x.name === name) || null;
  const codeRead = m('codeRead');
  const cand = m('registerCandidate');
  const reg = m('register');
  const ver = m('verifyModels');
  const spend = m('spendProbe');
  return {
    runDir: best.name,
    outcome: tl.outcome || null,
    mailLatencyMs: codeRead && typeof codeRead.sinceSendCodeMs === 'number' ? codeRead.sinceSendCodeMs : null,
    tokenAgeAtSubmitMs: reg ? reg.tokenAgeMs : null,
    tokenFrom: reg ? reg.tokenFrom || null : null,
    staleRejected: cand ? cand.staleRejected : null,
    onHandFresh: cand ? cand.onHandFresh : null,
    register: reg ? { status: reg.status, success: !!reg.success } : null,
    verify: ver ? { status: ver.status, exit: ver.exit, sameEgress: ver.sameEgress } : null,
    spend: spend ? { model: spend.model, status: spend.status } : null,
  };
}

let attemptsUsed = 0;
const rows = [];
const startKeys = keyLines().length;

async function attemptOnce(lane) {
  const i = ++attemptsUsed;
  const t0 = Date.now();
  const logPath = path.join(LOOP_DIR, `attempt-${i}.log`);
  const beforeKeys = keyLines().length;
  log(`--- attempt ${i} (lane ${lane}, keys ${beforeKeys}/${startKeys + COUNT})`);
  console.log(`… #${i} başladı (lane ${lane}, ${POOL_LABEL})`);
  const code = await new Promise((resolve) => {
    const out = fs.createWriteStream(logPath);
    const laneArgs = [LANE, '--runs', RUNS, '--tag', TAG, ...(POOL ? ['--api-exits', POOL, '--mount-exits', POOL] : [])];
    const child = spawn(process.execPath, laneArgs, { cwd: DIR, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    const killer = setTimeout(() => {
      try {
        child.kill();
      } catch (e) {}
    }, 25 * 60 * 1000);
    child.on('close', (c) => {
      clearTimeout(killer);
      out.end();
      resolve(c);
    });
  });
  const keys = keyLines();
  const y = readYield(t0);
  const row = { lane, attempt: i, exitCode: code, seconds: Math.round((Date.now() - t0) / 1000), keysAfter: keys.length, ...y };
  rows.push(row);
  fs.appendFileSync(
    path.join(LOOP_DIR, 'yield.tsv'),
    [i, lane, row.seconds, row.outcome || '-', row.mailLatencyMs == null ? '-' : row.mailLatencyMs, row.tokenAgeAtSubmitMs == null ? '-' : Math.round(row.tokenAgeAtSubmitMs), row.tokenFrom || '-', row.register ? `${row.register.status}${row.register.success ? ' ok' : ''}` : '-', row.verify ? `${row.verify.status} sameEgress=${row.verify.sameEgress}` : '-', row.spend ? `${row.spend.model} ${row.spend.status}` : '-'].join('\t') + '\n'
  );
  log(
    `attempt ${i}: ${row.seconds}s exit=${code} outcome=${row.outcome} mail=${row.mailLatencyMs}ms tokenAge=${row.tokenAgeAtSubmitMs == null ? '-' : Math.round(row.tokenAgeAtSubmitMs) + 'ms'} (${row.tokenFrom || '-'}) register=${row.register ? row.register.status + (row.register.success ? ' ok' : '') : '-'} verify=${row.verify ? row.verify.status + ' sameEgress=' + row.verify.sameEgress : '-'} keys=${keys.length}`
  );
  fs.writeFileSync(path.join(LOOP_DIR, 'summary.json'), JSON.stringify({ at: new Date().toISOString(), count: COUNT, attemptsCap: ATTEMPTS, conc: CONC, keysBefore: startKeys, keysAfter: keyLines().length, rows }, null, 2));
  if (keys.length > beforeKeys) {
    const fresh = keys[keys.length - 1];
    console.log(`✓ #${i} KEY ALINDI: ${fresh.slice(0, 22)}…   [${keys.length - startKeys} ok / ${i} deneme]`);
  } else {
    console.log(`✗ #${i} key yok: ${row.outcome || 'no outcome'}`);
  }
}

async function worker(lane) {
  for (;;) {
    if (keyLines().length >= startKeys + COUNT) return;
    if (attemptsUsed >= ATTEMPTS) return;
    await attemptOnce(lane);
    if (GAP_MS) await sleep(GAP_MS);
  }
}

(async () => {
  const poolFile = POOL || path.join(DIR, 'proxies.txt');
  let pool = 0;
  try {
    pool = fs.readFileSync(poolFile, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length;
  } catch (e) {
    /* no pool file — direct mode */
  }
  log(`mint start: count=${COUNT} attempts≤${ATTEMPTS} conc=${CONC} runs=${RUNS} keys=${startKeys} ${pool ? `pool=${pool} exit line(s) from ${path.relative(DIR, poolFile) || poolFile}` : 'no pool — direct egress'}`);
  await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i + 1)));
  const after = keyLines().length;
  log(`mint done: keys ${startKeys} -> ${after} (${after - startKeys} new) in ${rows.length} attempt(s); yield: ${path.relative(DIR, path.join(LOOP_DIR, 'yield.tsv'))}`);
  console.log(`MINT ${after - startKeys}/${COUNT} OK`);
  process.exit(0);
})().catch((e) => {
  log(`FATAL ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
  process.exit(1);
});
