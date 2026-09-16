/* Slack Shell — data providers.
   Loaded after data.js and before app.js. Exposes window.SlackShellProviders with:
     - settings helpers (mode / bridge URL / shared secret, from the query string or localStorage)
     - SeededProvider: wraps the seeded SLACK_DATA workspace (default; no network)
     - LiveProvider: talks to the bridge service (bridge/) over HTTP + WebSocket
     - createAdapter(D): normalizes raw Slack API shapes into the shell's internal model
   The UI (app.js) only talks to a provider; it never sees raw Slack payloads. */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
     Settings
  ------------------------------------------------------------------ */
  const LS = { mode: 'slackShellMode', bridge: 'slackShellBridge', secret: 'slackShellSecret' };
  const DEFAULT_BRIDGE = 'http://localhost:8787';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  function readSettings() {
    const q = new URLSearchParams(global.location ? global.location.search : '');
    let mode = lsGet(LS.mode) === 'live' ? 'live' : 'seeded';
    let bridge = lsGet(LS.bridge) || DEFAULT_BRIDGE;
    const live = q.get('live');
    if (live === '1' || live === 'true') mode = 'live';
    if (live === '0' || live === 'false') mode = 'seeded';
    if (q.get('bridge')) { bridge = q.get('bridge'); lsSet(LS.bridge, bridge); }
    return { mode, bridge: bridge.replace(/\/+$/, ''), secret: lsGet(LS.secret) || '' };
  }
  function saveSettings(s) {
    if (s.mode != null) lsSet(LS.mode, s.mode === 'live' ? 'live' : 'seeded');
    if (s.bridge != null) lsSet(LS.bridge, s.bridge.trim().replace(/\/+$/, ''));
    if (s.secret != null) lsSet(LS.secret, s.secret);
  }

  /* ------------------------------------------------------------------
     Small event emitter
  ------------------------------------------------------------------ */
  function emitter() {
    const subs = new Set();
    return {
      on(cb) { subs.add(cb); return () => subs.delete(cb); },
      emit(ev) { subs.forEach((cb) => { try { cb(ev); } catch (e) { console.error('[slack-shell] event handler failed', e); } }); },
    };
  }

  /* ------------------------------------------------------------------
     Adapter: raw Slack API shapes -> shell model
     (see data.js for the target shapes)
  ------------------------------------------------------------------ */
  const PALETTE = ['#E01E5A', '#36C5F0', '#2EB67D', '#ECB22E', '#1264A3', '#E8912D', '#7C3085', '#DE4E2B', '#0B8043', '#3F51B5', '#00796B', '#C2185B', '#5D4037', '#611F69'];
  const SYSTEM_SUBTYPES = { channel_join: 'userPlus', group_join: 'userPlus', channel_leave: 'logout', group_leave: 'logout', channel_topic: 'edit', group_topic: 'edit', channel_purpose: 'edit', group_purpose: 'edit', channel_name: 'edit', group_name: 'edit', channel_archive: 'archive', group_archive: 'archive', channel_unarchive: 'archive', pinned_item: 'pin', unpinned_item: 'pin', bot_add: 'apps', bot_remove: 'apps', reminder_add: 'bell' };
  const SKIN = /[\u{1F3FB}-\u{1F3FF}]|‍|️/gu;

  function createAdapter(D) {
    const hashColor = (s) => PALETTE[Array.from(String(s)).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
    const initialsOf = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    const tsToMs = (ts) => Math.round(parseFloat(ts) * 1000);
    const idFromTs = (ts) => 'm' + String(ts).replace('.', '_');
    const emojiChar = (name) => {
      if (!name) return null;
      const base = name.split('::')[0];
      const e = D.EMOJI_BY_NAME && D.EMOJI_BY_NAME[base];
      if (e) return e.ch;
      return ':' + base + ':';
    };
    const emojiName = (ch) => {
      if (!ch) return null;
      if (/^:[a-z0-9_+\-]+:$/.test(ch)) return ch.slice(1, -1);
      const bare = ch.replace(SKIN, '');
      const e = (D.EMOJI || []).find((x) => x.ch === ch || x.ch.replace(SKIN, '') === bare);
      return e ? e.name : null;
    };
    const userName = (id) => { const u = D.users && D.users[id]; return u ? u.name : id; };

    function text(raw, opts) {
      opts = opts || {};
      let s = String(raw == null ? '' : raw);
      s = s.replace(/<#([A-Z0-9_]+)\|([^>]*)>/g, '<#$1>');
      s = s.replace(/<!(channel|here|everyone)>/g, '@$1');
      s = s.replace(/<!subteam\^[A-Z0-9]+\|([^>]*)>/g, '$1');
      s = s.replace(/<!date\^\d+\^[^|>]*\|([^>]*)>/g, '$1');
      s = s.replace(/<!([a-z_]+)>/g, '@$1');
      s = s.replace(/<mailto:([^|>]+)\|([^>]*)>/g, '$2');
      s = s.replace(/<mailto:([^|>]+)>/g, '$1');
      s = s.replace(/<(https?:\/\/[^|>\s]+)>/g, '$1');
      s = s.replace(/<(https?:\/\/[^|>\s]+)\|([^>]*)>/g, (m, url, label) => (url === label || url.replace(/^https?:\/\//, '') === label ? url : m));
      if (opts.plainMentions) s = s.replace(/<@([A-Z0-9_]+)(?:\|[^>]*)?>/g, (m, id) => '@' + userName(id));
      else s = s.replace(/<@([A-Z0-9_]+)\|[^>]*>/g, '<@$1>');
      s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      return s;
    }

    function user(U) {
      const p = U.profile || {};
      const name = p.real_name || U.real_name || p.display_name || U.name || U.id;
      const bot = !!(U.is_bot || U.id === 'USLACKBOT');
      const out = {
        id: U.id,
        name,
        handle: (p.display_name || U.name || '').toLowerCase() || undefined,
        title: p.title || '',
        initials: initialsOf(name),
        color: U.color ? '#' + U.color : hashColor(U.id),
        presence: bot ? 'none' : (U.presence === 'active' ? 'active' : 'away'),
        status: p.status_text ? { emoji: emojiChar(String(p.status_emoji || '').replace(/^:|:$/g, '')) || '💬', text: p.status_text, until: p.status_expiration ? new Date(p.status_expiration * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '' } : null,
        tz: U.tz || undefined,
        email: p.email || undefined,
        phone: p.phone || undefined,
        pronouns: p.pronouns || undefined,
        image: p.image_72 || p.image_48 || undefined,
        deleted: !!U.deleted,
      };
      if (bot) out.bot = true;
      return out;
    }
    function botUser(M) {
      const bp = M.bot_profile || {};
      const name = bp.name || M.username || 'App';
      return { id: M.bot_id, name, initials: initialsOf(name), color: hashColor(M.bot_id), bot: true, presence: 'none', image: bp.icons && (bp.icons.image_72 || bp.icons.image_48) };
    }

    function channel(C) {
      return {
        id: C.id,
        name: C.name || C.name_normalized || C.id,
        type: 'channel',
        private: !!C.is_private,
        archived: !!C.is_archived,
        topic: (C.topic && C.topic.value) || '',
        description: (C.purpose && C.purpose.value) || '',
        members: Array.isArray(C.members) ? C.members.slice() : [],
        memberCount: C.num_members || (Array.isArray(C.members) ? C.members.length : 0),
        created: (C.created || 0) * 1000,
        starred: !!C.is_starred,
        muted: false,
        integrations: [],
        pinnedCount: 0,
      };
    }
    function dm(C, meId) {
      if (C.is_im) return { id: C.id, type: 'dm', members: C.user === meId ? [meId] : [meId, C.user], self: C.user === meId };
      const members = Array.isArray(C.members) ? C.members.slice() : [];
      if (meId && !members.includes(meId)) members.unshift(meId);
      return { id: C.id, type: 'dm', members };
    }

    function prettySize(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return Math.round(n / 1024) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
    function attachments(M) {
      const out = [];
      (M.files || []).forEach((f) => {
        if (f.mode === 'tombstone' || f.mode === 'hidden_by_limit') return;
        out.push({ type: 'file', name: f.title || f.name || 'file', kind: (f.filetype || (f.name || '').split('.').pop() || '').toLowerCase(), size: prettySize(f.size), url: f.permalink, mimetype: f.mimetype });
      });
      (M.attachments || []).forEach((a) => {
        if (a.is_msg_unfurl || a.is_share) return;
        const url = a.title_link || a.original_url || a.from_url;
        if (!url && !a.text) return;
        let site = a.service_name || '';
        if (!site && url) { try { site = new URL(url).hostname; } catch (e) { site = ''; } }
        out.push({ type: 'link', url: url || '', site, title: a.title || a.fallback || url || '', description: text(a.text || '', { plainMentions: true }) });
      });
      return out;
    }
    function message(M) {
      const isSys = !!(M.subtype && SYSTEM_SUBTYPES[M.subtype]);
      const m = {
        id: idFromTs(M.ts),
        slackTs: M.ts,
        user: M.user || M.bot_id || 'USLACKBOT',
        ts: tsToMs(M.ts),
        text: text(M.text, { plainMentions: isSys }),
        reactions: (M.reactions || []).map((r) => ({ emoji: emojiChar(r.name), name: r.name, users: (r.users || []).slice() })),
        replies: [],
        replyCount: M.reply_count || 0,
        replyUsers: (M.reply_users || []).slice(),
        latestReply: M.latest_reply ? tsToMs(M.latest_reply) : null,
        attachments: attachments(M),
      };
      if (M.thread_ts && M.thread_ts !== M.ts) m.threadTs = M.thread_ts;
      if (M.edited) m.edited = true;
      if (M.pinned_to && M.pinned_to.length) m.pinned = true;
      if (isSys) { m.type = 'system'; m.systemKind = SYSTEM_SUBTYPES[M.subtype]; }
      if (!M.user && M.bot_id) m.botProfile = botUser(M);
      return m;
    }

    /* Whole-workspace normalization. `raw` is the bridge's /api/workspace response:
       { team, me, users:[], channels:[], ims:[], mpims:[], lastRead:{ [id]: ts } } */
    function workspace(raw) {
      const meId = raw.me && raw.me.user_id;
      const users = {};
      (raw.users || []).forEach((U) => { if (!U.deleted || U.id === meId) users[U.id] = user(U); });
      if (meId && !users[meId]) users[meId] = { id: meId, name: (raw.me && raw.me.user) || 'You', initials: initialsOf((raw.me && raw.me.user) || 'You'), color: '#4A154B', presence: 'active', status: null };
      if (users[meId]) users[meId].presence = 'active';
      if (!users.USLACKBOT) users.USLACKBOT = { id: 'USLACKBOT', name: 'Slackbot', initials: 'S', color: '#611F69', bot: true, presence: 'none' };
      const channels = (raw.channels || []).filter((C) => !C.is_archived).map(channel).sort((a, b) => a.name.localeCompare(b.name));
      const dms = (raw.ims || []).concat(raw.mpims || []).filter((C) => !(C.is_im && C.user !== meId && (!users[C.user] || users[C.user].deleted))).map((C) => dm(C, meId));
      const team = raw.team || {};
      const name = team.name || 'Slack';
      const lastRead = {};
      channels.concat(dms).forEach((c) => { const lr = raw.lastRead && raw.lastRead[c.id]; lastRead[c.id] = lr ? tsToMs(lr) : Date.now(); });
      return {
        workspace: { id: team.id || 'T', name, domain: team.domain ? team.domain + '.slack.com' : '', initials: initialsOf(name).slice(0, 2), color: '#611F69', plan: '', icon: team.icon && (team.icon.image_68 || team.icon.image_44) },
        me: meId,
        users, channels, dms, lastRead,
      };
    }

    /* Bridge WebSocket frames: { type, event } where `event` is the raw Slack event payload. */
    function event(frame) {
      const ev = frame && frame.event ? frame.event : frame;
      const type = frame && frame.type ? frame.type : (ev && ev.type);
      if (!ev) return null;
      switch (type) {
        case 'message': {
          const sub = ev.subtype;
          if (sub === 'message_changed') return { type: 'message_changed', convId: ev.channel, ts: ev.message && ev.message.ts, message: ev.message ? message(Object.assign({}, ev.message, { ts: ev.message.ts })) : null };
          if (sub === 'message_deleted') return { type: 'message_deleted', convId: ev.channel, ts: ev.deleted_ts, threadTs: ev.previous_message && ev.previous_message.thread_ts };
          if (sub === 'message_replied') return null;
          const m = message(ev);
          return { type: 'message', convId: ev.channel, threadTs: ev.thread_ts && ev.thread_ts !== ev.ts ? ev.thread_ts : null, broadcast: sub === 'thread_broadcast', message: m };
        }
        case 'reaction_added':
        case 'reaction_removed':
          if (!ev.item || ev.item.type !== 'message') return null;
          return { type, convId: ev.item.channel, ts: ev.item.ts, emoji: emojiChar(ev.reaction), name: ev.reaction, user: ev.user };
        case 'user_typing':
          return { type: 'user_typing', convId: ev.channel, user: ev.user };
        case 'channel_created':
          return { type: 'channel_created', channel: channel(ev.channel || {}) };
        case 'channel_rename':
          return { type: 'channel_rename', convId: ev.channel && ev.channel.id, name: ev.channel && ev.channel.name };
        case 'member_joined_channel':
          return { type: 'member_joined', convId: ev.channel, user: ev.user };
        case 'member_left_channel':
          return { type: 'member_left', convId: ev.channel, user: ev.user };
        case 'user_change':
        case 'team_join':
          return { type: 'user_change', user: user(ev.user || {}) };
        case 'presence_change':
          return { type: 'presence_change', user: ev.user, presence: ev.presence === 'active' ? 'active' : 'away' };
        case 'channel_marked':
        case 'group_marked':
        case 'im_marked':
        case 'mpim_marked':
          return { type: 'marked', convId: ev.channel, ts: tsToMs(ev.ts) };
        case 'im_created':
          return { type: 'dm_created', dm: dm(ev.channel || {}, ev.user) };
        case 'hello':
        case 'bridge_status':
          return { type, data: ev };
        default:
          return null;
      }
    }

    return { text, user, botUser, channel, dm, message, workspace, event, emojiChar, emojiName, tsToMs, idFromTs };
  }

  /* ------------------------------------------------------------------
     SeededProvider — the shipped demo workspace. The shell mutates the
     in-memory store directly (exactly as before); these methods only
     exist so call sites are provider-agnostic.
  ------------------------------------------------------------------ */
  class SeededProvider {
    constructor(D) {
      this.kind = 'seeded';
      this.simulated = true; // app.js runs its teammate simulation only when this is true
      this.D = D;
      this.status = 'seeded';
      this.events = emitter();
      this.statusEvents = emitter();
    }
    connect() { /* nothing to connect to */ }
    disconnect() { /* no-op */ }
    onEvent(cb) { return this.events.on(cb); }
    onStatus(cb) { return this.statusEvents.on(cb); }
    async loadWorkspace() { return null; /* null = keep SLACK_DATA as is */ }
    async loadHistory(convId) { return { messages: this.D.messages[convId] || [], cursor: null }; }
    async loadThread(convId, parent) { return parent && parent.replies ? parent.replies : []; }
    async sendMessage() { return { ok: true }; }
    async editMessage() { return { ok: true }; }
    async deleteMessage() { return { ok: true }; }
    async addReaction() { return { ok: true }; }
    async removeReaction() { return { ok: true }; }
    async markRead() { return { ok: true }; }
    async setTopic() { return { ok: true }; }
  }

  /* ------------------------------------------------------------------
     LiveProvider — HTTP + WebSocket client for bridge/
  ------------------------------------------------------------------ */
  class BridgeError extends Error {
    constructor(message, status, code) { super(message); this.name = 'BridgeError'; this.status = status || 0; this.code = code || (status === 401 ? 'unauthorized' : status ? 'http_' + status : 'network'); }
  }

  class LiveProvider {
    constructor(D, settings) {
      this.kind = 'live';
      this.simulated = false;
      this.D = D;
      this.adapter = createAdapter(D);
      this.base = settings.bridge;
      this.secret = settings.secret;
      this.status = 'connecting';
      this.events = emitter();
      this.statusEvents = emitter();
      this.ws = null;
      this.retry = 0;
      this.closed = false;
      this.lastError = null;
    }
    setStatus(s, err) { this.status = s; this.lastError = err || null; this.statusEvents.emit({ status: s, error: err || null }); }
    onEvent(cb) { return this.events.on(cb); }
    onStatus(cb) { return this.statusEvents.on(cb); }

    async api(method, path, body) {
      const headers = { Accept: 'application/json' };
      if (this.secret) headers.Authorization = 'Bearer ' + this.secret;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      let res;
      try {
        res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), mode: 'cors' });
      } catch (e) {
        throw new BridgeError('Cannot reach bridge at ' + this.base + ' (' + (e && e.message ? e.message : 'network error') + ')', 0, 'network');
      }
      let json = null;
      try { json = await res.json(); } catch (e) { json = null; }
      if (!res.ok) throw new BridgeError((json && (json.error || json.message)) || ('Bridge returned HTTP ' + res.status), res.status, json && json.error);
      if (json && json.ok === false) throw new BridgeError(json.error || 'Slack API error', res.status, json.error);
      return json;
    }

    async loadWorkspace() {
      const raw = await this.api('GET', '/api/workspace');
      return this.adapter.workspace(raw);
    }
    async loadHistory(convId, opts) {
      opts = opts || {};
      const qs = new URLSearchParams({ channel: convId });
      if (opts.cursor) qs.set('cursor', opts.cursor);
      if (opts.limit) qs.set('limit', String(opts.limit));
      const raw = await this.api('GET', '/api/history?' + qs);
      const messages = (raw.messages || []).map((M) => this.adapter.message(M)).sort((a, b) => a.ts - b.ts);
      return {
        messages,
        cursor: (raw.response_metadata && raw.response_metadata.next_cursor) || null,
        hasMore: !!raw.has_more,
        lastRead: raw.last_read ? this.adapter.tsToMs(raw.last_read) : null,
        members: Array.isArray(raw.members) ? raw.members : null,
      };
    }
    async loadThread(convId, parent) {
      const ts = parent.slackTs || parent.id;
      const raw = await this.api('GET', '/api/thread?' + new URLSearchParams({ channel: convId, ts }));
      return (raw.messages || []).filter((M) => M.ts !== ts).map((M) => this.adapter.message(M)).sort((a, b) => a.ts - b.ts);
    }
    async loadMembers(convId) {
      const raw = await this.api('GET', '/api/members?' + new URLSearchParams({ channel: convId }));
      return raw.members || [];
    }
    async sendMessage(convId, text, opts) {
      opts = opts || {};
      const body = { channel: convId, text };
      if (opts.threadTs) body.thread_ts = opts.threadTs;
      if (opts.broadcast) body.reply_broadcast = true;
      const raw = await this.api('POST', '/api/messages', body);
      return { ts: raw.ts, message: raw.message ? this.adapter.message(Object.assign({}, raw.message, { ts: raw.ts })) : null };
    }
    async editMessage(convId, msg, text) {
      const raw = await this.api('PATCH', '/api/messages', { channel: convId, ts: msg.slackTs || msg.id, text });
      return { ts: raw.ts };
    }
    async deleteMessage(convId, msg) {
      return this.api('DELETE', '/api/messages', { channel: convId, ts: msg.slackTs || msg.id });
    }
    async addReaction(convId, msg, emoji) {
      const name = this.adapter.emojiName(emoji);
      if (!name) throw new BridgeError('Unknown emoji ' + emoji, 0, 'unknown_emoji');
      return this.api('POST', '/api/reactions', { channel: convId, ts: msg.slackTs || msg.id, name });
    }
    async removeReaction(convId, msg, emoji) {
      const name = this.adapter.emojiName(emoji);
      if (!name) throw new BridgeError('Unknown emoji ' + emoji, 0, 'unknown_emoji');
      return this.api('DELETE', '/api/reactions', { channel: convId, ts: msg.slackTs || msg.id, name });
    }
    async markRead(convId, msg) {
      if (!msg || !(msg.slackTs || msg.id)) return { ok: true };
      return this.api('POST', '/api/mark', { channel: convId, ts: msg.slackTs || msg.id });
    }
    async setTopic(convId, topic) {
      return this.api('POST', '/api/topic', { channel: convId, topic });
    }

    wsUrl() {
      const u = new URL(this.base);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      u.pathname = (u.pathname.replace(/\/+$/, '')) + '/ws';
      u.search = this.secret ? '?token=' + encodeURIComponent(this.secret) : '';
      return u.toString();
    }
    connect() {
      if (this.closed || typeof WebSocket === 'undefined') return;
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      let ws;
      try { ws = new WebSocket(this.wsUrl()); } catch (e) { this.setStatus('error', new BridgeError('Invalid bridge URL', 0, 'bad_url')); return; }
      this.ws = ws;
      if (this.status !== 'live') this.setStatus('connecting');
      ws.addEventListener('open', () => { this.retry = 0; this.setStatus('live'); });
      ws.addEventListener('message', (e) => {
        let frame; try { frame = JSON.parse(e.data); } catch (err) { return; }
        if (frame && frame.type === 'error') { this.setStatus('error', new BridgeError(frame.error || 'Bridge error', frame.status || 0, frame.code)); return; }
        const ev = this.adapter.event(frame);
        if (ev) this.events.emit(ev);
      });
      ws.addEventListener('close', (e) => {
        if (this.closed) return;
        if (e.code === 4401) { this.setStatus('error', new BridgeError('Bridge rejected the shared secret', 401, 'unauthorized')); return; }
        this.setStatus(this.retry > 2 ? 'error' : 'connecting', new BridgeError('Realtime connection lost, reconnecting…', 0, 'ws_closed'));
        const delay = Math.min(30000, 1000 * Math.pow(2, this.retry++));
        setTimeout(() => this.connect(), delay);
      });
      ws.addEventListener('error', () => { /* close follows */ });
    }
    disconnect() { this.closed = true; if (this.ws) try { this.ws.close(); } catch (e) { /* ignore */ } }
  }

  function create(D, settings) {
    settings = settings || readSettings();
    return settings.mode === 'live' ? new LiveProvider(D, settings) : new SeededProvider(D);
  }

  global.SlackShellProviders = { readSettings, saveSettings, createAdapter, SeededProvider, LiveProvider, BridgeError, create, DEFAULT_BRIDGE, LS };
})(typeof window !== 'undefined' ? window : globalThis);
