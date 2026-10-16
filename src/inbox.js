#!/usr/bin/env node
'use strict';

/**
 * inbox.js — Mailtrap sandbox inboxes without a local broker.
 *
 * This panel's mail gate was measured against the Mailtrap class: an
 * address issued by Mailtrap is accepted (`/api/verification` →
 * `200 Verification code sent, please check your inbox`) and the verification
 * mail arrives in seconds. The toolchain’s dev lanes reach Mailtrap through a local
 * broker (`127.0.0.1:9700`) — a clone cannot, so this module talks to
 * api.mailtrap.io directly and keeps the same surface the lane's poller uses:
 * `list(box)` / `read(box, id)` with `{id, subject, from, receivedAt, text, html}`.
 *
 * Auth: `MAILTRAP_TOKEN` env, else `~/.river-mailtrap-token` (one line, the API
 * token from your Mailtrap account → Settings → API tokens). Inboxes are created
 * inside a per-provider folder so a shared account stays tidy.
 *
 *   MAILTRAP_TOKEN=… node src/turnstile-lane.js --mail mailtrap
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const API = 'https://mailtrap.io/api';
const TOKEN_FILE = path.join(os.homedir(), '.river-mailtrap-token');

function token() {
  if (process.env.MAILTRAP_TOKEN) return process.env.MAILTRAP_TOKEN.trim();
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch (e) {
    return '';
  }
}

async function api(method, endpoint, body) {
  const t = token();
  if (!t) throw new Error('no Mailtrap token (set MAILTRAP_TOKEN or ~/.river-mailtrap-token)');
  const res = await fetch(API + endpoint, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    /* some endpoints answer non-JSON on errors */
  }
  if (res.status >= 400) {
    throw new Error(`mailtrap ${method} ${endpoint} -> ${res.status} ${String(text).slice(0, 160)}`);
  }
  // Mailtrap answers errors as JSON too (rate limits, quota, bad token): an object
  // carrying an `errors` array is NOT a success payload.
  if (json && Array.isArray(json.errors) && json.errors.length) {
    throw new Error(`mailtrap ${method} ${endpoint} -> ${JSON.stringify(json.errors).slice(0, 160)}`);
  }
  return json;
}

/** Find the folder by name, create it when it does not exist (Mailtrap caps folders per account). */
async function ensureFolder(name) {
  const data = await api('GET', '/inbound/folders');
  const list = Array.isArray(data) ? data : (data && (data.folders || data.data)) || [];
  const hit = list.find((f) => String(f.name).toLowerCase() === String(name).toLowerCase());
  if (hit) return hit.id;
  const made = await api('POST', '/inbound/folders', { name });
  return made.id;
}

const rand = (n) => Math.random().toString(36).slice(2, 2 + n);

module.exports = {
  /** Is a token present at all? (the lane falls back to its broker box when not) */
  available: () => !!token(),

  async create({ folder = 'bulk', tag = 'or' } = {}) {
    const folderId = await ensureFolder(folder);
    const inbox = await api('POST', `/inbound/folders/${folderId}/inboxes`, { name: `${tag}-as${rand(6)}` });
    const address = inbox && (inbox.address || inbox.email);
    if (!inbox || !address || inbox.id === undefined) {
      throw new Error(`mailtrap inbox create answered without an address/id: ${JSON.stringify(inbox).slice(0, 160)}`);
    }
    return { address, token: String(inbox.id), provider: 'mailtrap', direct: true };
  },

  async list(box) {
    const data = await api('GET', `/inbound/inboxes/${box.token}/messages`);
    return (Array.isArray(data) ? data : (data && data.data) || []).map((m) => ({
      id: String(m.id),
      subject: m.subject || '',
      from: m.from_email || m.from || '',
      receivedAt: m.created_at || null,
      text: m.text_body || '',
      html: m.html_body || '',
    }));
  },

  async read(box, id) {
    const m = await api('GET', `/inbound/inboxes/${box.token}/messages/${id}`);
    return {
      id: String(m.id),
      subject: m.subject || '',
      from: m.from_email || m.from || '',
      receivedAt: m.created_at || null,
      text: m.text_body || '',
      html: m.html_body || '',
    };
  },
};

if (require.main === module) {
  (async () => {
    if (!module.exports.available()) {
      console.error(`no Mailtrap token: set MAILTRAP_TOKEN or write one line into ${TOKEN_FILE}`);
      process.exit(2);
    }
    const box = await module.exports.create({ folder: 'orcarouter-selfcheck', tag: 'self' });
    console.log(JSON.stringify(box, null, 2));
  })().catch((e) => {
    console.error('inbox selfcheck failed:', e.message);
    process.exit(1);
  });
}
