/* Token management, including Slack token rotation.

   Plain tokens (xoxb-/xoxp-) never expire; we just hand them out.
   Rotating tokens (xoxe.xoxb-/xoxe.xoxp-) expire after 12 hours. When a refresh
   token (xoxe-1-...) plus client id/secret are configured we:
     - refresh on boot (so a stale access token in the env does not matter),
     - refresh again ~11h later, and on any invalid_auth / token_expired error,
     - keep the newest access + refresh tokens in memory and persist the refresh
       tokens to SLACK_TOKEN_STORE (default ./.tokens.json, gitignored), because a
       refresh token is single-use: the one in your .env goes stale after the
       first refresh and the file is the only copy of the current one. */
import fs from 'node:fs';
import path from 'node:path';
import { WebClient } from '@slack/web-api';
import { config } from './config.js';

const REFRESH_AFTER_MS = 11 * 60 * 60 * 1000; // tokens live 12h; refresh a bit early
const s = config.slack;

/** @type {{ bot: TokenSet, user: TokenSet }} */
const sets = {
  bot: { kind: 'bot', accessToken: s.botToken || null, refreshToken: s.refreshToken || null, expiresAt: null, userId: null },
  user: { kind: 'user', accessToken: s.userToken || null, refreshToken: s.userRefreshToken || null, expiresAt: null, userId: null },
};
const timers = { bot: null, user: null };
const inflight = { bot: null, user: null };
const listeners = new Set();

export function onTokensChanged(cb) { listeners.add(cb); return () => listeners.delete(cb); }
const notify = () => listeners.forEach((cb) => { try { cb(snapshot()); } catch (e) { console.error('[tokens] listener failed', e); } });

export const rotationEnabled = () => !!(s.clientId && s.clientSecret && (sets.bot.refreshToken || sets.user.refreshToken));

export function snapshot() {
  return {
    bot: { hasToken: !!sets.bot.accessToken, rotating: !!sets.bot.refreshToken, expiresAt: sets.bot.expiresAt },
    user: { hasToken: !!sets.user.accessToken, rotating: !!sets.user.refreshToken, expiresAt: sets.user.expiresAt },
  };
}

export const botToken = () => sets.bot.accessToken;
export const userToken = () => sets.user.accessToken;
export const hasUserToken = () => !!sets.user.accessToken;

/* ---------- persistence ---------- */
function storePath() { return path.resolve(process.cwd(), s.tokenStore || './.tokens.json'); }

function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    for (const kind of ['bot', 'user']) {
      const saved = raw && raw[kind];
      if (!saved) continue;
      // The stored refresh token is always newer than the one in the environment.
      if (saved.refreshToken) sets[kind].refreshToken = saved.refreshToken;
      if (saved.accessToken && saved.expiresAt && saved.expiresAt > Date.now() + 60_000) {
        sets[kind].accessToken = saved.accessToken;
        sets[kind].expiresAt = saved.expiresAt;
      }
      if (saved.userId) sets[kind].userId = saved.userId;
    }
    console.log('[tokens] loaded rotation state from', storePath());
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[tokens] could not read token store:', e.message);
  }
}

function saveStore() {
  const out = {};
  for (const kind of ['bot', 'user']) {
    if (!sets[kind].refreshToken) continue;
    out[kind] = { accessToken: sets[kind].accessToken, refreshToken: sets[kind].refreshToken, expiresAt: sets[kind].expiresAt, userId: sets[kind].userId };
  }
  if (!Object.keys(out).length) return;
  try {
    const p = storePath();
    fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n', { mode: 0o600 });
    try { fs.chmodSync(p, 0o600); } catch (e) { /* not supported on every fs */ }
  } catch (e) {
    console.warn('[tokens] could not persist token store:', e.message);
  }
}

/* ---------- refreshing ---------- */
function applyGrant(kind, grant) {
  // grant = the oauth.v2.access response. For a bot refresh the top level is the bot token;
  // for a user refresh the top level is the user token (token_type: "user"). A bot grant may
  // also carry authed_user tokens; we keep those too.
  const top = { accessToken: grant.access_token, refreshToken: grant.refresh_token, expiresIn: grant.expires_in, tokenType: grant.token_type, userId: grant.bot_user_id || (grant.authed_user && grant.authed_user.id) || null };
  const target = top.tokenType === 'user' ? 'user' : (top.tokenType === 'bot' ? 'bot' : kind);
  if (top.accessToken) {
    sets[target].accessToken = top.accessToken;
    sets[target].refreshToken = top.refreshToken || sets[target].refreshToken;
    sets[target].expiresAt = Date.now() + (top.expiresIn || 43200) * 1000;
    if (top.userId) sets[target].userId = top.userId;
  }
  const au = grant.authed_user;
  if (au && au.access_token && target !== 'user') {
    sets.user.accessToken = au.access_token;
    sets.user.refreshToken = au.refresh_token || sets.user.refreshToken;
    sets.user.expiresAt = Date.now() + (au.expires_in || 43200) * 1000;
    sets.user.userId = au.id || sets.user.userId;
  }
  return target;
}

export async function refresh(kind, reason) {
  const set = sets[kind];
  if (!set.refreshToken) return false;
  if (!s.clientId || !s.clientSecret) throw new Error('SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are required to refresh rotating tokens');
  if (inflight[kind]) return inflight[kind];
  inflight[kind] = (async () => {
    console.log(`[tokens] refreshing ${kind} token (${reason || 'scheduled'})`);
    const client = new WebClient(); // no token needed for oauth.v2.access
    const grant = await client.oauth.v2.access({ client_id: s.clientId, client_secret: s.clientSecret, grant_type: 'refresh_token', refresh_token: set.refreshToken });
    if (!grant.ok) throw new Error('oauth.v2.access failed: ' + grant.error);
    const target = applyGrant(kind, grant);
    saveStore();
    schedule(target);
    if (target !== kind) {
      // The refresh token in SLACK_REFRESH_TOKEN turned out to be for a user token (e.g. an app that
      // only has a user token). Move it so future refreshes target the right set.
      set.refreshToken = null;
      set.accessToken = set.accessToken && set.accessToken.startsWith('xoxe.') ? null : set.accessToken;
      console.log(`[tokens] refresh token in ${kind} slot is a ${target} token; using it as the ${target} token`);
    }
    notify();
    console.log(`[tokens] ${target} token refreshed; next refresh ~${new Date(Date.now() + REFRESH_AFTER_MS).toISOString()}`);
    return true;
  })().finally(() => { inflight[kind] = null; });
  return inflight[kind];
}

function schedule(kind) {
  clearTimeout(timers[kind]);
  if (!sets[kind].refreshToken) return;
  const due = sets[kind].expiresAt ? Math.max(30_000, sets[kind].expiresAt - Date.now() - 60 * 60 * 1000) : REFRESH_AFTER_MS;
  timers[kind] = setTimeout(() => refresh(kind, 'scheduled').catch((e) => { console.error('[tokens] scheduled refresh failed:', e.message); timers[kind] = setTimeout(() => schedule(kind), 60_000); }), Math.min(due, REFRESH_AFTER_MS));
  timers[kind].unref && timers[kind].unref();
}

/** Call once on boot. Loads the persisted store and refreshes any rotating tokens. */
export async function initTokens() {
  loadStore();
  for (const kind of ['bot', 'user']) {
    if (!sets[kind].refreshToken) continue;
    const fresh = sets[kind].expiresAt && sets[kind].expiresAt - Date.now() > 60 * 60 * 1000;
    if (fresh) { schedule(kind); continue; }
    await refresh(kind, 'boot');
  }
  return snapshot();
}

/** Is this Slack API error one that a token refresh could fix? */
export function isAuthError(err) {
  const code = err && err.data && err.data.error;
  return code === 'invalid_auth' || code === 'token_expired' || code === 'token_revoked' || code === 'not_authed';
}

/** Force a refresh of whichever kind of token produced an auth error. Resolves false when nothing can be refreshed. */
export async function refreshAfterAuthError(kind) {
  if (!sets[kind].refreshToken) return false;
  return refresh(kind, 'auth error');
}
