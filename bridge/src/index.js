#!/usr/bin/env node
/* Slack Shell bridge.
   - REST endpoints (mirroring the shell's LiveProvider) on the same port as
   - a WebSocket endpoint (/ws) that fans Slack events out to browsers.
   All Slack tokens stay here; the browser only ever holds BRIDGE_SHARED_SECRET. */
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config, originAllowed, validateConfig } from './config.js';
import * as tokens from './tokens.js';
import * as slack from './slack.js';
import * as events from './events.js';

const startedAt = Date.now();

/* ---------- helpers ---------- */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  return !origin || originAllowed(origin);
}
function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch (e) { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); } });
    req.on('error', reject);
  });
}
function authorized(req, url) {
  const secret = config.sharedSecret;
  if (!secret) return false;
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const token = bearer || url.searchParams.get('token') || '';
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
const need = (body, ...keys) => { for (const k of keys) if (body[k] == null || body[k] === '') throw Object.assign(new Error('missing field: ' + k), { status: 400 }); };

/* ---------- routes ---------- */
const routes = {
  'GET /api/workspace': async () => {
    const ws = await slack.loadWorkspace();
    return Object.assign({ ok: true }, ws);
  },
  'GET /api/history': async ({ url }) => {
    const channel = url.searchParams.get('channel');
    if (!channel) throw Object.assign(new Error('channel is required'), { status: 400 });
    try {
      return await slack.history(channel, { cursor: url.searchParams.get('cursor'), limit: url.searchParams.get('limit') });
    } catch (err) {
      // A bot that is not yet in a public channel: join, then retry once.
      if (err && err.data && err.data.error === 'not_in_channel' && !tokens.hasUserToken()) {
        await slack.join(channel).catch(() => {});
        return slack.history(channel, { cursor: url.searchParams.get('cursor'), limit: url.searchParams.get('limit') });
      }
      throw err;
    }
  },
  'GET /api/thread': async ({ url }) => {
    const channel = url.searchParams.get('channel'); const ts = url.searchParams.get('ts');
    if (!channel || !ts) throw Object.assign(new Error('channel and ts are required'), { status: 400 });
    return slack.replies(channel, ts, url.searchParams.get('cursor'));
  },
  'GET /api/members': async ({ url }) => {
    const channel = url.searchParams.get('channel');
    if (!channel) throw Object.assign(new Error('channel is required'), { status: 400 });
    return slack.listMembers(channel);
  },
  'POST /api/messages': async ({ body }) => { need(body, 'channel', 'text'); return slack.postMessage(body); },
  'PATCH /api/messages': async ({ body }) => { need(body, 'channel', 'ts', 'text'); return slack.updateMessage(body); },
  'DELETE /api/messages': async ({ body }) => { need(body, 'channel', 'ts'); return slack.deleteMessage(body); },
  'POST /api/reactions': async ({ body }) => { need(body, 'channel', 'ts', 'name'); return slack.addReaction(body); },
  'DELETE /api/reactions': async ({ body }) => { need(body, 'channel', 'ts', 'name'); return slack.removeReaction(body); },
  'POST /api/mark': async ({ body }) => { need(body, 'channel', 'ts'); return slack.mark(body); },
  'POST /api/topic': async ({ body }) => { need(body, 'channel'); return slack.setTopic({ channel: body.channel, topic: body.topic || '' }); },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const allowed = cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(allowed ? 204 : 403); res.end(); return; }
  if (!allowed) return send(res, 403, { ok: false, error: 'origin_not_allowed', origin: req.headers.origin });

  if (url.pathname === '/' || url.pathname === '/health') {
    return send(res, 200, {
      ok: true, service: 'slack-shell-bridge', uptime_s: Math.round((Date.now() - startedAt) / 1000),
      slack: { socket_mode: events.status.connected, events: events.status.events, posts_as: slack.identity.user ? 'user' : (slack.identity.bot ? 'bot' : null), team: (slack.identity.user || slack.identity.bot || {}).team || null },
      tokens: tokens.snapshot(), browsers: events.socketCount(),
    });
  }
  if (!url.pathname.startsWith('/api/')) return send(res, 404, { ok: false, error: 'not_found' });
  if (!authorized(req, url)) return send(res, 401, { ok: false, error: 'unauthorized', message: 'Send the bridge shared secret as "Authorization: Bearer <secret>"' });

  const handler = routes[req.method + ' ' + url.pathname];
  if (!handler) return send(res, 404, { ok: false, error: 'not_found' });
  try {
    const body = req.method === 'GET' ? {} : await readJson(req);
    const out = await handler({ url, body, req });
    send(res, 200, out && typeof out === 'object' ? out : { ok: true, result: out });
  } catch (err) {
    if (err && err.status) return send(res, err.status, { ok: false, error: err.message });
    const { status, body } = slack.slackErrorToHttp(err);
    if (status >= 500) console.error('[api]', req.method, url.pathname, err);
    send(res, status, body);
  }
});

/* ---------- WebSocket fan-out ---------- */
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  if (!originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (!authorized(req, url)) { ws.close(4401, 'unauthorized'); return; }
    events.addSocket(ws);
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now(), event: { slack: events.status.connected ? 'connected' : 'connecting', posts_as: slack.identity.user ? 'user' : 'bot' } }));
    ws.on('message', (data) => { if (String(data) === 'ping') ws.send('{"type":"pong"}'); });
  });
});
const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (ws.readyState === 1) ws.ping(); } }, 30000);
heartbeat.unref();

/* ---------- boot ---------- */
async function main() {
  const problems = validateConfig();
  if (problems.length) {
    console.error('Bridge is not configured:\n  - ' + problems.join('\n  - ') + '\nSee bridge/.env.example');
    process.exit(2);
  }
  await tokens.initTokens();
  if (tokens.rotationEnabled()) console.log('[tokens] token rotation active');
  const who = await slack.whoami();
  const id = who.user || who.bot;
  console.log(`[slack] connected to ${id.team} (${id.url}) — posting as ${who.user ? '@' + who.user.user + ' (user token)' : who.bot ? 'bot ' + who.bot.user : 'nobody'}`);
  await events.startEvents();
  server.listen(config.port, () => {
    console.log(`[bridge] listening on http://localhost:${config.port}  (health: /health, api: /api/*, ws: /ws)`);
    console.log(`[bridge] allowed origins: localhost, ${config.allowedOrigins.join(', ') || '(none besides localhost)'}`);
  });
}

const shutdown = async () => { console.log('\n[bridge] shutting down'); server.close(); await events.stopEvents(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  const code = err && err.data && err.data.error;
  console.error('[bridge] failed to start:', code ? `Slack said "${code}"` : err.message || err);
  if (code === 'invalid_auth' || code === 'not_authed') console.error('  Check SLACK_BOT_TOKEN / SLACK_USER_TOKEN (and, for rotating tokens, SLACK_REFRESH_TOKEN + SLACK_CLIENT_ID/SECRET).');
  process.exit(1);
});
