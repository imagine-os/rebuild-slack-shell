/* Slack -> browsers. A Bolt app in Socket Mode receives events over Slack's
   outbound WebSocket (no public URL needed) and we forward each raw event to
   every connected browser as { type, event, ts }. */
import bolt from '@slack/bolt';
import * as tokens from './tokens.js';
import { config } from './config.js';

const { App, LogLevel } = bolt;

const FORWARDED = [
  'message', // includes subtypes message_changed, message_deleted, thread_broadcast, file_share, bot_message ...
  'reaction_added', 'reaction_removed',
  'channel_created', 'channel_rename', 'channel_archive', 'channel_unarchive', 'channel_deleted',
  'member_joined_channel', 'member_left_channel',
  'user_change', 'team_join',
  'pin_added', 'pin_removed',
  'user_typing', // not delivered by the Events API today; kept so it works if Slack ever adds it
];

const sockets = new Set();
export function addSocket(ws) { sockets.add(ws); ws.on('close', () => sockets.delete(ws)); }
export const socketCount = () => sockets.size;

export function broadcast(frame) {
  const data = JSON.stringify(Object.assign({ ts: Date.now() }, frame));
  for (const ws of sockets) {
    if (ws.readyState === 1) { try { ws.send(data); } catch (e) { /* dropped */ } }
  }
}

let app = null;
export const status = { connected: false, lastEventAt: null, events: 0, error: null };

/** Start Socket Mode. Resolves once the connection is established. */
export async function startEvents() {
  if (!config.slack.appToken) throw new Error('SLACK_APP_TOKEN is required for Socket Mode');
  app = new App({
    appToken: config.slack.appToken,
    socketMode: true,
    logLevel: LogLevel.WARN,
    // `authorize` runs per incoming event, so a rotated bot token is picked up automatically.
    authorize: async () => {
      const botToken = tokens.botToken() || tokens.userToken();
      return { botToken, botId: undefined, botUserId: undefined };
    },
  });

  for (const type of FORWARDED) {
    app.event(type, async ({ event }) => {
      status.events++;
      status.lastEventAt = Date.now();
      broadcast({ type, event });
    });
  }
  // Bolt logs "unhandled" for message subtypes it did not match; message() above catches all of them.
  app.error(async (err) => { status.error = err && err.message ? err.message : String(err); console.error('[events] bolt error:', status.error); });

  app.receiver.client.on('connected', () => { status.connected = true; status.error = null; console.log('[events] socket mode connected'); broadcast({ type: 'bridge_status', event: { slack: 'connected' } }); });
  app.receiver.client.on('disconnected', () => { status.connected = false; console.warn('[events] socket mode disconnected'); broadcast({ type: 'bridge_status', event: { slack: 'disconnected' } }); });
  app.receiver.client.on('reconnecting', () => { status.connected = false; });

  await app.start();
  status.connected = true;
  return app;
}

export async function stopEvents() { if (app) await app.stop().catch(() => {}); }
