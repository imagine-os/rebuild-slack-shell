/* Slack Web API calls. Thin wrappers that pick the right token (user token when
   available so actions appear as you, bot token otherwise), retry once after a
   token refresh on auth errors, and return raw Slack shapes. Normalization into
   the shell's model happens in the browser (provider.js). */
import { WebClient, LogLevel } from '@slack/web-api';
import * as tokens from './tokens.js';

const clients = new Map();
function clientFor(token) {
  if (!token) throw Object.assign(new Error('no_token'), { data: { error: 'no_token' } });
  let c = clients.get(token);
  if (!c) {
    c = new WebClient(token, { logLevel: LogLevel.WARN, retryConfig: { retries: 2, factor: 2, minTimeout: 500 } });
    clients.set(token, c);
    if (clients.size > 8) clients.delete(clients.keys().next().value);
  }
  return c;
}

/** Run `fn(client)` with the given kind of token ('user' | 'bot'); fall back bot->user or user->bot when one is missing. */
async function call(kind, fn) {
  let k = kind;
  if (k === 'user' && !tokens.userToken()) k = 'bot';
  if (k === 'bot' && !tokens.botToken()) k = 'user';
  const token = k === 'user' ? tokens.userToken() : tokens.botToken();
  try {
    return await fn(clientFor(token), k);
  } catch (err) {
    if (tokens.isAuthError(err) && (await tokens.refreshAfterAuthError(k).catch(() => false))) {
      const t2 = k === 'user' ? tokens.userToken() : tokens.botToken();
      return fn(clientFor(t2), k);
    }
    throw err;
  }
}
const asUser = (fn) => call('user', fn);
const asBot = (fn) => call('bot', fn);

/* Concurrency-limited map for per-channel look-ups (Tier 3 methods allow ~50/min). */
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}
async function paginate(fn, key) {
  let cursor; const out = [];
  do {
    const res = await fn(cursor);
    out.push(...(res[key] || []));
    cursor = res.response_metadata && res.response_metadata.next_cursor;
  } while (cursor);
  return out;
}

/* ---------- identity ---------- */
export let identity = { bot: null, user: null };

export async function whoami() {
  const out = { bot: null, user: null };
  if (tokens.botToken()) out.bot = await asBot((c) => c.auth.test());
  if (tokens.userToken()) out.user = await asUser((c) => c.auth.test());
  identity = out;
  return out;
}

/* ---------- workspace ---------- */
export async function loadWorkspace() {
  const [team, users, convs] = await Promise.all([
    asBot((c) => c.team.info()).then((r) => r.team).catch(() => null),
    paginate((cursor) => asBot((c) => c.users.list({ limit: 200, cursor })), 'members'),
    // The user token sees the channels *you* are in (incl. private ones); the bot only sees channels it was added to.
    paginate((cursor) => asUser((c) => c.users.conversations({ types: 'public_channel,private_channel,mpim,im', exclude_archived: true, limit: 200, cursor })), 'channels'),
  ]);
  const channels = convs.filter((c) => !c.is_im && !c.is_mpim);
  const ims = convs.filter((c) => c.is_im);
  const mpims = convs.filter((c) => c.is_mpim);
  // Members + last_read per conversation (conversations.info / conversations.members). Tolerant of failures/rate limits.
  const lastRead = {};
  await pmap(channels.concat(mpims), 4, async (c) => {
    try {
      const info = await asUser((cl) => cl.conversations.info({ channel: c.id }));
      if (info.channel && info.channel.last_read) lastRead[c.id] = info.channel.last_read;
      if (info.channel && info.channel.topic) c.topic = info.channel.topic;
      if (info.channel && info.channel.purpose) c.purpose = info.channel.purpose;
    } catch (e) { /* ignore */ }
    try {
      if ((c.num_members || 0) <= 500) {
        const mem = await asUser((cl) => cl.conversations.members({ channel: c.id, limit: 500 }));
        c.members = mem.members || [];
      } else c.members = [];
    } catch (e) { c.members = []; }
  });
  await pmap(ims, 4, async (c) => {
    try { const info = await asUser((cl) => cl.conversations.info({ channel: c.id })); if (info.channel && info.channel.last_read) lastRead[c.id] = info.channel.last_read; } catch (e) { /* ignore */ }
  });
  const me = identity.user || identity.bot || (await whoami()).user || identity.bot;
  return { team, me, users, channels, ims, mpims, lastRead, postsAs: identity.user ? 'user' : 'bot' };
}

export const listMembers = (channel) => asUser((c) => c.conversations.members({ channel, limit: 500 }));

/* ---------- history ---------- */
export async function history(channel, { cursor, limit } = {}) {
  const [hist, info] = await Promise.all([
    asUser((c) => c.conversations.history({ channel, cursor: cursor || undefined, limit: Math.min(Number(limit) || 100, 200), inclusive: true })),
    cursor ? Promise.resolve(null) : asUser((c) => c.conversations.info({ channel })).catch(() => null),
  ]);
  return { ok: true, messages: hist.messages || [], has_more: !!hist.has_more, response_metadata: hist.response_metadata || {}, last_read: info && info.channel ? info.channel.last_read : undefined, members: info && info.channel && Array.isArray(info.channel.members) ? info.channel.members : undefined };
}
export const replies = (channel, ts, cursor) => asUser((c) => c.conversations.replies({ channel, ts, cursor: cursor || undefined, limit: 200 }));

/* ---------- writes ---------- */
export const postMessage = ({ channel, text, thread_ts, reply_broadcast }) => asUser((c, kind) => c.chat.postMessage({ channel, text, thread_ts: thread_ts || undefined, reply_broadcast: !!reply_broadcast || undefined, as_user: kind === 'user' ? true : undefined, unfurl_links: true }));
export const updateMessage = ({ channel, ts, text }) => asUser((c, kind) => c.chat.update({ channel, ts, text, as_user: kind === 'user' ? true : undefined }));
export const deleteMessage = ({ channel, ts }) => asUser((c, kind) => c.chat.delete({ channel, ts, as_user: kind === 'user' ? true : undefined }));
export const addReaction = ({ channel, ts, name }) => asUser((c) => c.reactions.add({ channel, timestamp: ts, name }));
export const removeReaction = ({ channel, ts, name }) => asUser((c) => c.reactions.remove({ channel, timestamp: ts, name }));
export const setTopic = ({ channel, topic }) => asUser((c) => c.conversations.setTopic({ channel, topic }));
/* conversations.mark moves the *token owner's* read cursor, so it is only meaningful with a user token. */
export async function mark({ channel, ts }) {
  if (!tokens.hasUserToken()) return { ok: true, skipped: 'no_user_token' };
  return asUser((c) => c.conversations.mark({ channel, ts }));
}
/* Bots must join a public channel before reading its history; harmless when already a member. */
export const join = (channel) => asBot((c) => c.conversations.join({ channel }));

/** Turn a Slack SDK error into { status, body }. */
export function slackErrorToHttp(err) {
  const code = err && err.data && err.data.error;
  if (code) {
    const status = code === 'invalid_auth' || code === 'not_authed' || code === 'token_expired' ? 502 : code === 'ratelimited' ? 429 : code === 'channel_not_found' || code === 'message_not_found' ? 404 : code === 'missing_scope' || code === 'not_in_channel' || code === 'cant_update_message' || code === 'cant_delete_message' ? 403 : 400;
    return { status, body: { ok: false, error: code, needed: err.data.needed, provided: err.data.provided } };
  }
  if (err && err.message === 'no_token') return { status: 503, body: { ok: false, error: 'no_token', message: 'Bridge has no Slack token configured' } };
  return { status: 500, body: { ok: false, error: 'internal_error', message: err && err.message ? err.message : String(err) } };
}
