/* Slack Shell — application script (vanilla JS, single IIFE, no dependencies). */
(function () {
  'use strict';
  const D = window.SLACK_DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
  const MOD = IS_MAC ? '⌘' : 'Ctrl';
  const ALT = IS_MAC ? '⌥' : 'Alt';
  const SHIFT = IS_MAC ? '⇧' : 'Shift';
  const modKey = (e) => (IS_MAC ? e.metaKey : e.ctrlKey);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = (s) => esc(s).replace(/\n/g, ' ');
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ss.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ss.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  const state = {
    view: 'home',
    conv: 'c_general',
    history: ['c_general'],
    histIdx: 0,
    rpanel: null,
    drafts: store.get('drafts', {}),
    lastRead: Object.assign({}, D.lastRead),
    newDividerAt: {},
    collapsed: store.get('collapsed', {}),
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    sidebarTheme: store.get('sidebarTheme', 'default'),
    prefs: Object.assign({ density: 'clean', typing: true, reduceMotion: false, underlineLinks: false, sendWithEnter: true, showFmt: true, sound: true, notifyAll: 'mentions', badge: true, timeFormat: '12', sidebarUnreads: false, sidebarSort: 'alpha', language: 'en-US', markRead: 'onview' }, store.get('prefs', {})),
    huddle: null,
    presence: 'active',
    paused: null,
    status: null,
    activityTab: 'all',
    activitySel: null,
    laterTab: 'progress',
    laterSel: null,
    laterState: store.get('laterState', {}),
    editing: null,
    sidebarOpen: false,
    mobileConv: false,
    channelTab: 'messages',
    loading: false,
    typing: null,
    unreadsOnly: false,
    frequent: store.get('frequent', D.FREQUENT.slice()),
    skin: store.get('skin', ''),
    quickReacts: ['✅', '👀', '🙌'],
    starred: {},
    muted: {},
    dmTab: 'all',
  };
  D.channels.forEach((c) => { state.starred[c.id] = !!c.starred; state.muted[c.id] = !!c.muted; });

  /* ------------------------------------------------------------------
     Data helpers
  ------------------------------------------------------------------ */
  const me = () => D.users[D.me];
  const user = (id) => D.users[id] || { id, name: 'Unknown', initials: '?', color: '#616061', presence: 'none' };
  const convs = () => D.channels.concat(D.dms);
  const conv = (id) => convs().find((c) => c.id === id);
  const msgs = (convId) => (D.messages[convId] || (D.messages[convId] = []));
  const isDM = (c) => c && c.type === 'dm';
  const dmOther = (c) => c.members.filter((m) => m !== D.me);
  const convName = (c) => {
    if (!c) return '';
    if (c.type === 'channel') return c.name;
    if (c.self) return me().name + ' (you)';
    const others = dmOther(c).map((u) => user(u).name);
    return others.length === 1 ? others[0] : others.map((n) => n.split(' ')[0]).join(', ');
  };
  const findMsg = (id) => {
    for (const cid of Object.keys(D.messages)) {
      for (const m of D.messages[cid]) {
        if (m.id === id) return { msg: m, convId: cid };
        for (const r of m.replies) if (r.id === id) return { msg: r, convId: cid, parent: m };
      }
    }
    return null;
  };
  const allMsgs = () => {
    const out = [];
    for (const cid of Object.keys(D.messages)) for (const m of D.messages[cid]) { out.push({ m, cid }); m.replies.forEach((r) => out.push({ m: r, cid, parent: m })); }
    return out;
  };
  const mentionsMe = (m) => (m.text || '').includes('<@me>');
  const unreadOf = (cid) => msgs(cid).filter((m) => m.ts > (state.lastRead[cid] || 0) && m.user !== D.me);
  const unreadCount = (cid) => unreadOf(cid).length;
  const mentionCount = (cid) => unreadOf(cid).filter(mentionsMe).length;
  const badgeCount = (cid) => { const c = conv(cid); return isDM(c) ? unreadCount(cid) : mentionCount(cid); };
  const totalBadge = () => convs().reduce((n, c) => n + (state.muted[c.id] ? 0 : badgeCount(c.id)), 0);
  const emojiOf = (name) => (D.EMOJI_BY_NAME[name] ? D.EMOJI_BY_NAME[name].ch : null);
  const emojiName = (ch) => { const e = D.EMOJI.find((x) => x.ch === ch); return e ? e.name : null; };
  const displayStatus = (u) => (u.id === D.me ? state.status : u.status);
  const presenceOf = (u) => (u.id === D.me ? (state.paused ? 'dnd' : state.presence) : u.presence);

  /* ------------------------------------------------------------------
     Time formatting
  ------------------------------------------------------------------ */
  const fmtTime = (ts) => {
    const d = new Date(ts);
    if (state.prefs.timeFormat === '24') return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    let h = d.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + d.getMinutes().toString().padStart(2, '0') + ' ' + ampm;
  };
  const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDay = (ts) => {
    const today = startOfDay(Date.now()); const day = startOfDay(ts);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    const d = new Date(ts);
    if (diff < 7) return DAYS[d.getDay()];
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : '');
  };
  const fmtFull = (ts) => { const d = new Date(ts); return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' at ' + fmtTime(ts); };
  const fmtShortDate = (ts) => { const d = new Date(ts); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
  const relTime = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m + ' minute' + (m === 1 ? '' : 's') + ' ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    const d = Math.round(h / 24); if (d < 7) return d + ' day' + (d === 1 ? '' : 's') + ' ago';
    return fmtShortDate(ts);
  };
  const sidebarTime = (ts) => { if (startOfDay(ts) === startOfDay(Date.now())) return fmtTime(ts); if (Date.now() - ts < 7 * 86400000) return DAYS[new Date(ts).getDay()].slice(0, 3); return fmtShortDate(ts); };

  /* ------------------------------------------------------------------
     Icons (inline SVG, 20px, stroke 1.75)
  ------------------------------------------------------------------ */
  const ICONS = {
    hash: '<path d="M8.5 3 6.5 17M13.5 3l-2 14M3.5 7.5h14M2.5 12.5h14"/>',
    lock: '<rect x="4" y="8.5" width="12" height="9" rx="2"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5"/>',
    chevDown: '<path d="m5.5 8 4.5 4.5L14.5 8"/>',
    chevRight: '<path d="m8 5.5 4.5 4.5L8 14.5"/>',
    chevLeft: '<path d="M12 5.5 7.5 10 12 14.5"/>',
    chevUp: '<path d="m5.5 12.5 4.5-4.5 4.5 4.5"/>',
    close: '<path d="m5 5 10 10M15 5 5 15"/>',
    search: '<circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3.5 3.5"/>',
    home: '<path d="M3.5 9.5 10 3.5l6.5 6v7a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1z"/>',
    dms: '<path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z"/>',
    activity: '<path d="M10 3a5 5 0 0 0-5 5v3.5L3.5 14h13L15 11.5V8a5 5 0 0 0-5-5zM8 16.5a2 2 0 0 0 4 0"/>',
    later: '<path d="M5 3.5h10v13l-5-3.5-5 3.5z"/>',
    more: '<circle cx="4.5" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.5" fill="currentColor" stroke="none"/>',
    moreV: '<circle cx="10" cy="4.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    compose: '<path d="M4 16h12M12.5 3.5l3 3L8 14H5v-3z"/>',
    star: '<path d="m10 2.8 2.2 4.6 5 .6-3.7 3.5.9 5-4.4-2.4-4.4 2.4.9-5L2.8 8l5-.6z"/>',
    starFill: '<path fill="currentColor" d="m10 2.8 2.2 4.6 5 .6-3.7 3.5.9 5-4.4-2.4-4.4 2.4.9-5L2.8 8l5-.6z"/>',
    headphones: '<path d="M4 12V10a6 6 0 0 1 12 0v2"/><rect x="3" y="11.5" width="4" height="5.5" rx="1.5"/><rect x="13" y="11.5" width="4" height="5.5" rx="1.5"/>',
    bookmark: '<path d="M5.5 3.5h9v13L10 13l-4.5 3.5z"/>',
    bookmarkFill: '<path fill="currentColor" d="M5.5 3.5h9v13L10 13l-4.5 3.5z"/>',
    pin: '<path d="m12.5 3 4.5 4.5-2 1-1 4-2.5-2.5-5 5-.5-.5 5-5L8.5 7l4-1z"/>',
    thread: '<path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z"/><path d="M7 8h6M7 11h4"/>',
    forward: '<path d="M11 5.5 15.5 10 11 14.5M15 10H8.5A4 4 0 0 0 4.5 14v.5"/>',
    emoji: '<circle cx="10" cy="10" r="7.5"/><path d="M6.5 11.5s1.2 2 3.5 2 3.5-2 3.5-2"/><circle cx="7.5" cy="8" r=".7" fill="currentColor"/><circle cx="12.5" cy="8" r=".7" fill="currentColor"/>',
    emojiPlus: '<path d="M17 10a7 7 0 1 1-7-7"/><path d="M6.5 11.5s1.2 2 3.5 2 3.5-2 3.5-2"/><circle cx="7.5" cy="8" r=".7" fill="currentColor"/><circle cx="12.5" cy="8" r=".7" fill="currentColor"/><path d="M15 2.5v5M12.5 5h5"/>',
    at: '<circle cx="10" cy="10" r="3"/><path d="M13 10v1.2a1.8 1.8 0 0 0 3.6 0V10a6.6 6.6 0 1 0-2.6 5.3"/>',
    video: '<rect x="2.5" y="5.5" width="10.5" height="9" rx="2"/><path d="m13 9 4.5-2.5v7L13 11"/>',
    videoOff: '<rect x="2.5" y="5.5" width="10.5" height="9" rx="2"/><path d="m13 9 4.5-2.5v7L13 11M3 3l14 14"/>',
    mic: '<rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5"/>',
    micOff: '<rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5M3 3l14 14"/>',
    send: '<path d="M2.5 3.5 17.5 10 2.5 16.5l2-6.5zM4.5 10h7"/>',
    bold: '<path d="M6 3.5h5a3 3 0 0 1 0 6H6zM6 9.5h6a3.5 3.5 0 0 1 0 7H6z"/>',
    italic: '<path d="M8 3.5h8M4 16.5h8M12 3.5l-4 13"/>',
    strike: '<path d="M4 10h12M6.5 6.5c0-1.7 1.6-3 3.5-3 2 0 3.4 1 3.6 2.5M6 13c.3 2 1.9 3.5 4 3.5 2.2 0 3.8-1.3 3.8-3"/>',
    link: '<path d="M8.5 11.5 11.5 8.5M7 13l-1.5 1.5a2.8 2.8 0 0 1-4-4L4 8M13 7l1.5-1.5a2.8 2.8 0 0 1 4 4L16 12"/>',
    ol: '<path d="M8 5.5h9M8 10h9M8 14.5h9M3 4l1.5-1v4M3 12.5c0-1 2-1.3 2-.3s-2 1.6-2 2.8h2.2"/>',
    ul: '<path d="M8 5.5h9M8 10h9M8 14.5h9"/><circle cx="4" cy="5.5" r="1" fill="currentColor"/><circle cx="4" cy="10" r="1" fill="currentColor"/><circle cx="4" cy="14.5" r="1" fill="currentColor"/>',
    quote: '<path d="M4 4v12M8 6h9M8 10h9M8 14h6"/>',
    code: '<path d="m7 6-4 4 4 4M13 6l4 4-4 4M11.5 4l-3 12"/>',
    codeBlock: '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="m8 8-2 2 2 2M12 8l2 2-2 2"/>',
    text: '<path d="M3.5 16 8.5 4l5 12M5.5 12h6M14.5 9.5c1.2-.8 2.8-.5 3 .7v5.8m0-3.5c-.8-.5-3.2-.6-3.2 1.2 0 1.8 2.5 2 3.2.5"/>',
    help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 0 1 4.4.7c0 1.5-2.2 1.8-2.2 3.2"/><circle cx="10" cy="14.4" r=".6" fill="currentColor"/>',
    bell: '<path d="M10 3a5 5 0 0 0-5 5v3.5L3.5 14h13L15 11.5V8a5 5 0 0 0-5-5zM8 16.5a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="M10 3a5 5 0 0 0-5 5v3.5L3.5 14h13L15 11.5V8a5 5 0 0 0-5-5zM8 16.5a2 2 0 0 0 4 0M3 3l14 14"/>',
    check: '<path d="m4 10.5 4 4 8-9"/>',
    edit: '<path d="M4 16h12M12.5 3.5l3 3L8 14H5v-3z"/>',
    trash: '<path d="M4 5.5h12M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5l.7 10a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-10M8.5 9v5M11.5 9v5"/>',
    copy: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>',
    clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2.5"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
    eyeOff: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10zM3 3l14 14"/><circle cx="10" cy="10" r="2.5"/>',
    screen: '<rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17M10 6.5v4M8 8.5l2-2 2 2"/>',
    canvas: '<rect x="3.5" y="2.5" width="13" height="15" rx="2"/><path d="M7 7h6M7 10.5h6M7 14h3"/>',
    files: '<path d="M5 2.5h6.5L16 7v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1-1.5z"/><path d="M11.5 2.5V7H16"/>',
    workflows: '<circle cx="5" cy="5" r="2.5"/><circle cx="15" cy="15" r="2.5"/><circle cx="15" cy="5" r="2.5"/><path d="M7.5 5h5M15 7.5v5M5 7.5v3a2 2 0 0 0 2 2h5.5"/>',
    people: '<circle cx="8" cy="7" r="3"/><path d="M2.5 16.5a5.5 5.5 0 0 1 11 0M13 4.5a3 3 0 0 1 0 5.2M17.5 16.5a5.5 5.5 0 0 0-4-5.2"/>',
    external: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.5 2.5 3.5 5 3.5 7.5s-1 5-3.5 7.5C7.5 15 6.5 12.5 6.5 10s1-5 3.5-7.5z"/>',
    info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.5v.2"/>',
    settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    apps: '<rect x="3" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2"/><path d="M14.25 11.5v5.5M11.5 14.25h5.5"/>',
    menu: '<path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"/>',
    arrowDown: '<path d="M10 3.5v13M4.5 11l5.5 5.5 5.5-5.5"/>',
    arrowUp: '<path d="M10 16.5v-13M4.5 9 10 3.5 15.5 9"/>',
    arrowLeft: '<path d="M16.5 10h-13M9 4.5 3.5 10 9 15.5"/>',
    calendar: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8.5h14M7 2.5v3M13 2.5v3"/>',
    moon: '<path d="M16 12.5A6.5 6.5 0 0 1 7.5 4 6.5 6.5 0 1 0 16 12.5z"/>',
    sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    filter: '<path d="M3 4.5h14l-5.5 6.5v5l-3 1.5v-6.5z"/>',
    zap: '<path d="M11 2.5 4 11.5h5.5L9 17.5l7-9h-5.5z"/>',
    image: '<rect x="3" y="3.5" width="14" height="13" rx="2"/><circle cx="7.5" cy="8" r="1.5"/><path d="m3 14 4-4 3 3 3-3 4 4"/>',
    download: '<path d="M10 3v10M6 9l4 4 4-4M4 16.5h12"/>',
    share: '<path d="M10 3v10M6.5 6.5 10 3l3.5 3.5M4 11.5v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/>',
    volume: '<path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3zM13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10"/>',
    sparkle: '<path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12l-5.5-2L8 8z"/>',
    dnd: '<circle cx="10" cy="10" r="7.5"/><path d="M6 10h8"/>',
    keyboard: '<rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M5.5 8h1M8.5 8h1M11.5 8h1M14.5 8h1M5.5 11h1M8.5 11h1M11.5 11h1M14.5 11h1M7 12.5h6"/>',
    logout: '<path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M12.5 13.5 16 10l-3.5-3.5M16 10H8"/>',
    giphy: '<rect x="4" y="2.5" width="12" height="15" rx="1"/><path d="M4 6.5h12M7.5 10.5h5M7.5 13.5h3"/>',
    poll: '<path d="M4 16.5V9M10 16.5v-13M16 16.5v-7"/>',
    reply: '<path d="M8 5 3.5 9.5 8 14M4 9.5h7.5a5 5 0 0 1 5 5v1"/>',
    slash: '<path d="M13 3.5 7 16.5"/>',
    mute: '<path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3zM13 8l4 4M17 8l-4 4"/>',
    minus: '<path d="M4 10h12"/>',
    userPlus: '<circle cx="8" cy="7" r="3"/><path d="M2.5 16.5a5.5 5.5 0 0 1 11 0M15 7v5M12.5 9.5h5"/>',
    sort: '<path d="M6 3.5v13M3 13.5l3 3 3-3M14 16.5v-13M11 6.5l3-3 3 3"/>',
    inbox: '<path d="M3.5 11.5h4l1 2h3l1-2h4M3.5 11.5V15a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3.5M5.5 4.5h9l2 7"/>',
    archive: '<rect x="3" y="4" width="14" height="4" rx="1"/><path d="M4 8v7.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V8M8 11.5h4"/>',
    checkCircle: '<circle cx="10" cy="10" r="7.5"/><path d="m6.5 10.5 2.5 2.5 4.5-5"/>',
    a11y: '<circle cx="10" cy="4" r="1.5"/><path d="M4 7.5c4 1 8 1 12 0M10 8.5v4l-2.5 5M10 12.5l2.5 5"/>',
    lang: '<path d="M3 5h9M7.5 3v2M9 5c-.5 3-3 6-6 7.5M5 8c1 2 3 3.5 5 4.5M11 17l3.5-9 3.5 9M12.3 14h4.4"/>',
    shield: '<path d="M10 2.5 4 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5z"/>',
    sliders: '<path d="M4 6h12M4 10h12M4 14h12M7 4.5v3M13 8.5v3M9 12.5v3"/>',
    mail: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="m2.5 6 7.5 5 7.5-5"/>',
    phone: '<path d="M6.5 3.5 8.5 7 7 8.5a7 7 0 0 0 4.5 4.5L13 11.5l3.5 2-1 2.5c-6 1-12-5-11-11z"/>',
    dot: '<circle cx="10" cy="10" r="3" fill="currentColor" stroke="none"/>',
    globe: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.5 2.5 3.5 5 3.5 7.5s-1 5-3.5 7.5C7.5 15 6.5 12.5 6.5 10s1-5 3.5-7.5z"/>',
    leaf: '<path d="M4 16c0-7 4-11 12-12-1 8-5 12-12 12zM4 16l6-6"/>',
    coffee: '<path d="M4 7.5h9v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM13 9h1.5a2 2 0 1 1 0 4H13M3 17.5h11M7 3v2M10 3v2"/>',
    plane: '<path d="M17 10 3.5 4.5 5.5 10l-2 5.5zM5.5 10H17"/>',
    flag: '<path d="M4.5 17.5v-14M4.5 4h10l-2 3.5 2 3.5h-10"/>',
    ball: '<circle cx="10" cy="10" r="7.5"/><path d="M10 2.5c-3 3-3 12 0 15M10 2.5c3 3 3 12 0 15M2.5 10h15"/>',
    symbols: '<path d="M4 4h5v5H4zM13.5 4l2.5 4.5h-5zM4 11h5v5H4z"/><circle cx="13.5" cy="13.5" r="2.5"/>',
    back: '<path d="M12.5 4.5 7 10l5.5 5.5"/>',
  };
  const I = (name, size, cls) => {
    const body = ICONS[name] || ICONS.dot;
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };

  /* ------------------------------------------------------------------
     Avatars & presence
  ------------------------------------------------------------------ */
  function avatar(u, size, opts) {
    opts = opts || {};
    if (typeof u === 'string') u = user(u);
    const p = presenceOf(u);
    const dot = opts.presence && !u.bot ? '<span class="presence-dot ' + p + '" aria-hidden="true"></span>' : '';
    const click = opts.click === false ? '' : ' data-act="profile" data-user="' + u.id + '"';
    return '<span class="avatar sz-' + (size || 36) + '" style="background:' + u.color + '"' + click + ' role="img" aria-label="' + attr(u.name) + '">' + esc(u.initials) + dot + '</span>';
  }

  /* ------------------------------------------------------------------
     Slack markdown → HTML
  ------------------------------------------------------------------ */
  const BLK = '@@BLK';
  function inlineFmt(s) {
    // s is already HTML-escaped
    s = s.replace(/(^|[\s(])\*([^*\n]+?)\*(?=$|[\s.,!?;:)])/g, '$1<b>$2</b>');
    s = s.replace(/(^|[\s(])_([^_\n]+?)_(?=$|[\s.,!?;:)])/g, '$1<i>$2</i>');
    s = s.replace(/(^|[\s(])~([^~\n]+?)~(?=$|[\s.,!?;:)])/g, '$1<del>$2</del>');
    s = s.replace(/&lt;(https?:\/\/[^|&\s]+)\|([^&]+?)&gt;/g, (m, url, label) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
    s = s.replace(/(^|[^"'>])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m, pre, url) => pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>');
    s = s.replace(/&lt;@([a-z0-9_]+)&gt;/g, (m, id) => { const u = user(id); return '<span class="mention' + (id === D.me ? ' me' : '') + '" data-act="profile" data-user="' + id + '">@' + esc(u.name) + '</span>'; });
    s = s.replace(/&lt;#([a-z0-9_]+)&gt;/g, (m, id) => { const c = conv(id); return c ? '<span class="ch-link" data-act="open" data-conv="' + id + '">#' + esc(c.name) + '</span>' : m; });
    s = s.replace(/(^|[^\w>])@(justin|me)\b/gi, (m, pre) => pre + '<span class="mention me" data-act="profile" data-user="me">@' + esc(me().name) + '</span>');
    s = s.replace(/(^|[^\w>])@([a-z][a-z0-9._-]*)/gi, (m, pre, h) => { const u = Object.values(D.users).find((x) => x.handle === h.toLowerCase()); return u ? pre + '<span class="mention" data-act="profile" data-user="' + u.id + '">@' + esc(u.name) + '</span>' : m; });
    s = s.replace(/(^|[^\w>&])#([a-z0-9][a-z0-9_-]*)/g, (m, pre, n) => { const c = D.channels.find((x) => x.name === n); return c ? pre + '<span class="ch-link" data-act="open" data-conv="' + c.id + '">#' + esc(c.name) + '</span>' : m; });
    s = s.replace(/:([a-z0-9_+\-]+):/g, (m, n) => { const e = emojiOf(n); return e ? '<span class="emoji" title=":' + n + ':">' + e + '</span>' : m; });
    return s;
  }
  function renderText(text, opts) {
    opts = opts || {};
    if (!text) return '';
    const blocks = [];
    let s = esc(text);
    s = s.replace(/```([\s\S]*?)```/g, (m, code) => { blocks.push('<pre><code>' + code.replace(/^\n|\n$/g, '') + '</code></pre>'); return BLK + (blocks.length - 1) + '@@'; });
    s = s.replace(/`([^`\n]+)`/g, (m, code) => { blocks.push('<code>' + code + '</code>'); return BLK + (blocks.length - 1) + '@@'; });
    const lines = s.split('\n');
    const out = [];
    let list = null;
    let quote = null;
    const flushList = () => { if (list) { out.push('<' + (list.type === 'ul' ? 'ul class="bullets"' : 'ol class="ordered"') + '>' + list.items.map((i) => '<li>' + i + '</li>').join('') + '</' + list.type + '>'); list = null; } };
    const flushQuote = () => { if (quote) { out.push('<blockquote>' + quote.join('<br>') + '</blockquote>'); quote = null; } };
    lines.forEach((ln) => {
      let mm;
      if ((mm = ln.match(/^\s*(?:•|-)\s+(.*)$/))) { flushQuote(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(inlineFmt(mm[1])); return; }
      if ((mm = ln.match(/^\s*\d+\.\s+(.*)$/))) { flushQuote(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(inlineFmt(mm[1])); return; }
      if ((mm = ln.match(/^&gt;\s?(.*)$/))) { flushList(); if (!quote) quote = []; quote.push(inlineFmt(mm[1])); return; }
      flushList(); flushQuote();
      out.push(inlineFmt(ln));
    });
    flushList(); flushQuote();
    let html = out.join('\n').replace(/\n(<(?:ul|ol|blockquote|pre))/g, '$1').replace(/(<\/(?:ul|ol|blockquote|pre)>)\n/g, '$1');
    html = html.replace(/@@BLK(\d+)@@/g, (m, i) => blocks[i]);
    const stripped = html.replace(/<span class="emoji"[^>]*>[^<]*<\/span>/g, '').replace(/\s/g, '');
    if (!stripped && (html.match(/class="emoji"/g) || []).length <= 3 && !opts.noBig) html = html.replace(/class="emoji"/g, 'class="emoji big"');
    return html;
  }
  const plainText = (text) => (text || '').replace(/<@([a-z0-9_]+)>/g, (m, id) => '@' + user(id).name).replace(/<#([a-z0-9_]+)>/g, (m, id) => { const c = conv(id); return c ? '#' + c.name : m; }).replace(/:([a-z0-9_+\-]+):/g, (m, n) => emojiOf(n) || m).replace(/[*_~`>]/g, '');

  /* ------------------------------------------------------------------
     UI primitives: tooltip, popover, modal, toast, live region
  ------------------------------------------------------------------ */
  const layer = $('#layer');
  let tipEl = null, tipTimer = null;
  function showTip(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    hideTip();
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.setAttribute('role', 'tooltip');
    const sub = target.getAttribute('data-tip-sub');
    tipEl.innerHTML = esc(text) + (sub ? '<span class="tt-sub">' + esc(sub) + '</span>' : '');
    layer.appendChild(tipEl);
    const r = target.getBoundingClientRect(); const tr = tipEl.getBoundingClientRect();
    let top = r.top - tr.height - 8; let below = false;
    if (top < 4) { top = r.bottom + 8; below = true; }
    let left = r.left + r.width / 2 - tr.width / 2;
    if (left < 4) { left = 4; tipEl.classList.add('left'); }
    if (left + tr.width > window.innerWidth - 4) { left = window.innerWidth - tr.width - 4; tipEl.classList.add('right'); }
    if (below) tipEl.classList.add('below');
    tipEl.style.top = top + 'px'; tipEl.style.left = left + 'px';
    requestAnimationFrame(() => tipEl && tipEl.classList.add('show'));
  }
  function hideTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } }
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(t), 350);
  });
  document.addEventListener('mouseout', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) hideTip(); });
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) showTip(t); });
  document.addEventListener('focusout', hideTip);

  let popovers = [];
  function closePopovers(keep) { popovers.filter((p) => p !== keep).forEach((p) => { if (p.onClose) p.onClose(); p.el.remove(); }); popovers = popovers.filter((p) => p === keep); $$('.menu-open').forEach((m) => m.classList.remove('menu-open')); }
  function popover(anchor, html, opts) {
    opts = opts || {};
    if (!opts.stack) closePopovers();
    const el = document.createElement('div');
    el.className = 'popover ' + (opts.cls || '');
    el.setAttribute('role', opts.role || 'menu');
    el.innerHTML = html;
    layer.appendChild(el);
    const p = { el, anchor, onClose: opts.onClose };
    popovers.push(p);
    positionPop(el, anchor, opts);
    if (opts.init) opts.init(el, p);
    el.setAttribute('tabindex', '-1');
    if (opts.focus !== false) { const f = el.querySelector('input'); if (f) f.focus(); else el.focus({ preventScroll: true }); }
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const items = $$('.menu-item, .ep-tab', el).filter((x) => x.offsetParent !== null); if (!items.length) return;
      e.preventDefault();
      let i = items.indexOf(document.activeElement);
      if (e.key === 'Home') i = 0; else if (e.key === 'End') i = items.length - 1; else i = i < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items[i].focus();
    });
    return el;
  }
  function positionPop(el, anchor, opts) {
    const r = typeof anchor.getBoundingClientRect === 'function' ? anchor.getBoundingClientRect() : anchor;
    const er = el.getBoundingClientRect();
    const pad = 8; const W = window.innerWidth; const H = window.innerHeight;
    let top, left;
    const place = opts.place || 'below';
    if (place === 'above') top = r.top - er.height - 6; else if (place === 'right') { top = r.top; left = r.right + 6; } else if (place === 'left') { top = r.top; left = r.left - er.width - 6; } else top = r.bottom + 6;
    if (left == null) left = opts.align === 'end' ? r.right - er.width : opts.align === 'center' ? r.left + r.width / 2 - er.width / 2 : r.left;
    if (top + er.height > H - pad) top = Math.max(pad, (place === 'below' ? r.top - er.height - 6 : H - er.height - pad));
    if (top < pad) top = pad;
    if (left + er.width > W - pad) left = W - er.width - pad;
    if (left < pad) left = pad;
    el.style.top = top + 'px'; el.style.left = left + 'px';
    if (er.height > H - 2 * pad) { el.style.maxHeight = (H - 2 * pad) + 'px'; el.style.overflowY = 'auto'; }
  }
  document.addEventListener('mousedown', (e) => {
    if (!popovers.length) return;
    const inside = popovers.some((p) => p.el.contains(e.target) || (p.anchor && p.anchor.contains && p.anchor.contains(e.target)));
    if (!inside) closePopovers();
  });

  let modals = [];
  function modal(html, opts) {
    opts = opts || {};
    closePopovers();
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true"' + (opts.label ? ' aria-label="' + attr(opts.label) + '"' : '') + '>' + html + '</div>';
    document.body.appendChild(bd);
    const m = { el: bd, box: bd.firstElementChild, prevFocus: document.activeElement, onClose: opts.onClose, opts };
    modals.push(m);
    bd.addEventListener('mousedown', (e) => { if (e.target === bd && opts.dismissable !== false) closeModal(m); });
    bd.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', m.box).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (opts.init) opts.init(m.box, m);
    const auto = m.box.querySelector('[autofocus]') || m.box.querySelector('input, textarea, button:not(.modal-close)');
    if (auto) setTimeout(() => auto.focus(), 10);
    return m;
  }
  function closeModal(m) {
    m = m || modals[modals.length - 1];
    if (!m) return false;
    modals = modals.filter((x) => x !== m);
    if (m.onClose) m.onClose();
    m.el.remove();
    if (m.prevFocus && m.prevFocus.focus) try { m.prevFocus.focus(); } catch (e) { /* ignore */ }
    return true;
  }
  function closeAllModals() { while (modals.length) closeModal(); }
  const modalHead = (title, opts) => '<div class="modal-head"><h2>' + title + '</h2>' + ((opts && opts.extra) || '') + '<button class="modal-close" data-act="modal-close" aria-label="Close">' + I('close', 20) + '</button></div>';

  function toast(text, opts) {
    opts = opts || {};
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = (opts.icon ? I(opts.icon, 18) : '') + '<span>' + esc(text) + '</span>' + (opts.action ? '<button data-act="' + attr(opts.action.act) + '">' + esc(opts.action.label) + '</button>' : '');
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s'; setTimeout(() => t.remove(), 220); }, opts.ms || 2600);
  }
  function announce(text) { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = text; }, 30); }
  const kbd = (keys) => keys.split(' ').map((k) => '<span class="kbd">' + esc(k) + '</span>').join('');

  /* ------------------------------------------------------------------
     Rendering: top bar & rail
  ------------------------------------------------------------------ */
  function renderTopbar() {
    const btn = $('#me-avatar-btn');
    btn.innerHTML = avatar(me(), 26, { presence: true, click: false });
    btn.setAttribute('data-tip', me().name);
    $('#search-kbd-hint').innerHTML = kbd(MOD + ' K').replace(/class="kbd"/g, 'class="kbd" style="height:18px;min-width:18px;font-size:11px;background:rgba(255,255,255,.15);border-color:transparent;color:inherit"');
    $('#search-input').placeholder = 'Search ' + D.workspace.name;
    $('#nav-back').disabled = state.histIdx <= 0;
    $('#nav-fwd').disabled = state.histIdx >= state.history.length - 1;
  }
  const RAIL_ITEMS = [
    { id: 'home', label: 'Home', icon: 'home', tip: 'Home' },
    { id: 'dms', label: 'DMs', icon: 'dms', tip: 'Direct messages', sub: MOD + ' ' + SHIFT + ' K' },
    { id: 'activity', label: 'Activity', icon: 'activity', tip: 'Activity', sub: MOD + ' ' + SHIFT + ' M' },
    { id: 'later', label: 'Later', icon: 'later', tip: 'Later', sub: MOD + ' ' + SHIFT + ' S' },
    { id: 'more', label: 'More', icon: 'more', tip: 'More' },
  ];
  const MORE_VIEWS = ['canvases', 'files', 'workflows', 'people', 'external'];
  function renderRail() {
    const badge = totalBadge();
    const dmBadge = D.dms.reduce((n, c) => n + unreadCount(c.id), 0);
    const actBadge = activityItems().filter((a) => a.unread).length;
    const active = MORE_VIEWS.includes(state.view) ? 'more' : state.view;
    $('#rail').innerHTML =
      '<button class="rail-ws active" style="background:' + D.workspace.color + '" data-act="ws-menu" data-tip="' + attr(D.workspace.name) + '" aria-label="' + attr(D.workspace.name) + ' workspace">' + esc(D.workspace.initials) + '</button>' +
      D.otherWorkspaces.map((w) => '<button class="rail-ws" style="background:' + w.color + '" data-act="switch-ws" data-ws="' + w.id + '" data-tip="' + attr(w.name) + '" aria-label="Switch to ' + attr(w.name) + '">' + esc(w.initials) + '</button>').join('') +
      '<button class="rail-ws add" data-act="add-ws" data-tip="Add a workspace" aria-label="Add a workspace">' + I('plus', 18) + '</button>' +
      '<div class="rail-sep"></div>' +
      '<div class="rail-nav" role="tablist">' +
      RAIL_ITEMS.map((r) => {
        let b = '';
        if (r.id === 'home' && badge && state.prefs.badge) b = '<span class="rail-badge">' + (badge > 99 ? '99+' : badge) + '</span>';
        if (r.id === 'dms' && dmBadge) b = '<span class="rail-badge">' + dmBadge + '</span>';
        if (r.id === 'activity' && actBadge) b = '<span class="rail-dot" aria-label="New activity"></span>';
        return '<button class="rail-item' + (active === r.id ? ' active' : '') + '" data-act="view" data-view="' + r.id + '" role="tab" aria-selected="' + (active === r.id) + '" data-tip="' + attr(r.tip) + '"' + (r.sub ? ' data-tip-sub="' + attr(r.sub) + '"' : '') + ' aria-label="' + attr(r.label) + '"><span class="rail-ico">' + I(r.icon, 20) + b + '</span><span class="rail-label">' + esc(r.label) + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="rail-bottom"><button class="rail-new" data-act="new-message" data-tip="New message" aria-label="New message">' + I('compose', 18) + '</button>' +
      '<button class="avatar-btn" data-act="me-menu" aria-label="Your profile" data-tip="' + attr(me().name) + '">' + avatar(me(), 32, { presence: true, click: false }) + '</button></div>';
  }

  /* ------------------------------------------------------------------
     Rendering: sidebar
  ------------------------------------------------------------------ */
  function sbItem(c, opts) {
    opts = opts || {};
    const unread = unreadCount(c.id) > 0;
    const badge = badgeCount(c.id);
    const muted = state.muted[c.id];
    const sel = state.conv === c.id && !MORE_VIEWS.includes(state.view);
    let ico, name;
    if (c.type === 'channel') { ico = '<span class="sb-item-ico">' + I(c.private ? 'lock' : 'hash', 16) + '</span>'; name = c.name; }
    else if (c.self) { ico = avatar(me(), 20, { presence: true, click: false }); name = me().name.split(' ')[0] + ' (you)'; }
    else if (c.members.length > 2) { ico = '<span class="sb-item-ico" style="background:var(--sb-hover);border-radius:4px;font-size:11px;font-weight:700">' + (c.members.length - 1) + '</span>'; name = convName(c); }
    else { ico = avatar(user(dmOther(c)[0]), 20, { presence: true, click: false }); name = convName(c); }
    const st = c.type === 'dm' && c.members.length === 2 && !c.self ? displayStatus(user(dmOther(c)[0])) : null;
    return '<li role="listitem"><button class="sb-item' + (unread && !muted ? ' unread' : '') + (muted ? ' muted' : '') + (sel ? ' selected' : '') + (c.type === 'dm' ? ' dm-row' : '') + '" data-act="open" data-conv="' + c.id + '" aria-current="' + (sel ? 'page' : 'false') + '">' + ico + '<span class="sb-item-name">' + esc(name) + '</span>' + (st ? '<span class="status-emoji" title="' + attr(st.text) + '">' + esc(st.emoji) + '</span>' : '') + (badge && !muted ? '<span class="sb-item-badge">' + badge + '</span>' : '') + (opts.closable ? '<span class="sb-item-x" data-act="close-dm" data-conv="' + c.id + '" data-tip="Close conversation">' + I('close', 14) + '</span>' : '') + '</button></li>';
  }
  function sbSection(key, title, itemsHtml, opts) {
    opts = opts || {};
    const collapsed = !!state.collapsed[key];
    return '<div class="sb-section' + (collapsed ? ' collapsed' : '') + '" data-section="' + key + '"><div class="sb-section-head"><button class="caret" data-act="toggle-section" data-section="' + key + '" aria-expanded="' + !collapsed + '" aria-label="' + (collapsed ? 'Expand' : 'Collapse') + ' ' + attr(title) + '">' + I('chevDown', 16) + '</button><button class="sb-section-name" data-act="section-menu" data-section="' + key + '">' + esc(title) + '</button><span class="sb-section-actions"><button class="sb-icon-btn" data-act="section-menu" data-section="' + key + '" data-tip="Section options" aria-label="Section options">' + I('moreV', 16) + '</button>' + (opts.add ? '<button class="sb-icon-btn" data-act="' + opts.add + '" data-tip="' + attr(opts.addTip || 'Add') + '" aria-label="' + attr(opts.addTip || 'Add') + '">' + I('plus', 16) + '</button>' : '') + '</span></div><ul class="sb-list" role="list">' + itemsHtml + '</ul></div>';
  }
  function sortConvs(list) {
    if (state.prefs.sidebarSort === 'recent') return list.slice().sort((a, b) => (lastTs(b.id) - lastTs(a.id)));
    return list;
  }
  const lastTs = (cid) => { const l = msgs(cid); return l.length ? l[l.length - 1].ts : 0; };
  function sidebarHeader(title, extra) {
    return '<div class="sb-header"><button class="sb-ws-name" data-act="ws-menu" aria-haspopup="true"><span>' + esc(title) + '</span>' + I('chevDown', 18) + '</button>' + (extra != null ? extra : '<button class="sb-icon-btn sb-compose" data-act="new-message" data-tip="New message" aria-label="New message">' + I('compose', 18) + '</button>') + '</div>';
  }
  function renderSidebar() {
    const sb = $('#sidebar');
    let html = '';
    if (state.view === 'dms') html = renderDMSidebar();
    else if (state.view === 'activity') html = renderActivitySidebar();
    else if (state.view === 'later') html = renderLaterSidebar();
    else if (MORE_VIEWS.includes(state.view)) html = renderMoreSidebar();
    else html = renderHomeSidebar();
    html += renderHuddleChip();
    html += '<div class="sb-mobile-nav" role="tablist">' + RAIL_ITEMS.slice(0, 4).map((r) => '<button class="' + (state.view === r.id ? 'active' : '') + '" data-act="view" data-view="' + r.id + '">' + I(r.icon, 20) + esc(r.label) + '</button>').join('') + '</div>';
    sb.innerHTML = html;
    sb.classList.toggle('open', state.sidebarOpen);
    $('#sidebar-scrim').classList.toggle('show', state.sidebarOpen);
  }
  function renderHomeSidebar() {
    const filter = (c) => !state.unreadsOnly || unreadCount(c.id) > 0 || state.conv === c.id;
    const starred = convs().filter((c) => state.starred[c.id] && filter(c));
    const channels = sortConvs(D.channels.filter((c) => !state.starred[c.id] && filter(c)));
    const dms = sortConvs(D.dms.filter((c) => !state.starred[c.id] && filter(c)));
    let body = '<div class="sb-static"><ul role="list">' +
      '<li><button class="sb-item' + (state.unreadsOnly ? ' selected' : '') + '" data-act="toggle-unreads"><span class="sb-item-ico">' + I('inbox', 16) + '</span><span class="sb-item-name">Unreads</span>' + (state.unreadsOnly ? '' : '<span class="sb-item-time">' + convs().filter((c) => unreadCount(c.id) > 0 && !state.muted[c.id]).length + '</span>') + '</button></li>' +
      '<li><button class="sb-item" data-act="open-threads"><span class="sb-item-ico">' + I('thread', 16) + '</span><span class="sb-item-name">Threads</span></button></li>' +
      '<li><button class="sb-item" data-act="view" data-view="huddles-list" style="display:none"></button></li>' +
      '<li><button class="sb-item" data-act="drafts"><span class="sb-item-ico">' + I('compose', 16) + '</span><span class="sb-item-name">Drafts &amp; sent</span>' + (Object.values(state.drafts).filter(Boolean).length ? '<span class="sb-item-time">' + Object.values(state.drafts).filter(Boolean).length + '</span>' : '') + '</button></li>' +
      '</ul></div>';
    if (starred.length) body += sbSection('starred', 'Starred', starred.map((c) => sbItem(c)).join(''));
    body += sbSection('channels', 'Channels', channels.map((c) => sbItem(c)).join('') + '<li><button class="sb-item ghost" data-act="add-channel"><span class="sb-item-ico">' + I('plus', 14) + '</span><span class="sb-item-name">Add channels</span></button></li>', { add: 'add-channel', addTip: 'Add channels' });
    body += sbSection('dms', 'Direct messages', dms.map((c) => sbItem(c, { closable: true })).join('') + '<li><button class="sb-item ghost" data-act="add-teammates"><span class="sb-item-ico">' + I('plus', 14) + '</span><span class="sb-item-name">Add teammates</span></button></li>', { add: 'new-message', addTip: 'Open a direct message' });
    body += sbSection('apps', 'Apps', ['b_github', 'b_polly', 'b_slackbot'].map((b) => '<li><button class="sb-item" data-act="open-app" data-user="' + b + '">' + avatar(user(b), 20, { click: false }) + '<span class="sb-item-name">' + esc(user(b).name) + '</span></button></li>').join('') + '<li><button class="sb-item ghost" data-act="add-app"><span class="sb-item-ico">' + I('plus', 14) + '</span><span class="sb-item-name">Add apps</span></button></li>', { add: 'add-app', addTip: 'Add apps' });
    return sidebarHeader(D.workspace.name) + '<div class="sb-body scroll" role="navigation">' + body + '</div>';
  }
  function renderDMSidebar() {
    const list = D.dms.slice().sort((a, b) => lastTs(b.id) - lastTs(a.id)).filter((c) => state.dmTab === 'all' || unreadCount(c.id) > 0);
    const rows = list.map((c) => {
      const l = msgs(c.id); const last = l[l.length - 1];
      const other = c.self ? me() : c.members.length > 2 ? null : user(dmOther(c)[0]);
      const ico = other ? avatar(other, 36, { presence: true, click: false }) : '<span class="avatar sz-36" style="background:var(--sb-hover)">' + (c.members.length - 1) + '</span>';
      const unread = unreadCount(c.id) > 0;
      const preview = last ? ((last.user === D.me ? 'You: ' : c.members.length > 2 ? user(last.user).name.split(' ')[0] + ': ' : '') + plainText(last.text || (last.attachments[0] ? (last.attachments[0].name || last.attachments[0].title || 'Attachment') : ''))) : 'No messages yet';
      return '<li><button class="sb-rich' + (unread ? ' unread' : '') + (state.conv === c.id ? ' selected' : '') + '" data-act="open" data-conv="' + c.id + '">' + ico + '<span class="sb-rich-body"><span class="sb-rich-top"><span class="sb-rich-name">' + esc(convName(c)) + '</span><span class="sb-rich-meta">' + (last ? sidebarTime(last.ts) : '') + '</span></span><span class="sb-rich-preview">' + esc(preview) + '</span></span>' + (unread ? '<span class="unread-pip"></span>' : '') + '</button></li>';
    }).join('');
    return sidebarHeader('Direct messages') + '<div class="sb-body scroll"><div class="sb-tabs"><button class="sb-tab' + (state.dmTab === 'all' ? ' active' : '') + '" data-act="dm-tab" data-tab="all">All</button><button class="sb-tab' + (state.dmTab === 'unread' ? ' active' : '') + '" data-act="dm-tab" data-tab="unread">Unread</button></div><ul role="list">' + (rows || '<li class="sb-empty">' + I('checkCircle', 32) + 'You’re all caught up</li>') + '</ul></div>';
  }
  function activityItems() {
    const items = [];
    allMsgs().forEach(({ m, cid, parent }) => {
      if (m.user === D.me) {
        (m.reactions || []).forEach((r) => { if (r.users.length && !r.users.every((u) => u === D.me)) items.push({ type: 'reaction', m, cid, parent, ts: m.ts + 60000, who: r.users.filter((u) => u !== D.me), emoji: r.emoji, unread: false }); });
        return;
      }
      if (mentionsMe(m)) items.push({ type: 'mention', m, cid, parent, ts: m.ts, unread: m.ts > (state.lastRead[cid] || 0) });
      if (parent && parent.user === D.me) items.push({ type: 'thread', m, cid, parent, ts: m.ts, unread: false });
      else if (parent && parent.replies.some((r) => r.user === D.me) && m.user !== D.me && m.ts > Math.max(...parent.replies.filter((r) => r.user === D.me).map((r) => r.ts))) items.push({ type: 'thread', m, cid, parent, ts: m.ts, unread: false });
    });
    items.sort((a, b) => b.ts - a.ts);
    return items;
  }
  function renderActivitySidebar() {
    const tabs = [['all', 'All'], ['mention', 'Mentions'], ['thread', 'Threads'], ['reaction', 'Reactions']];
    const items = activityItems().filter((a) => state.activityTab === 'all' || a.type === state.activityTab);
    const rows = items.map((a) => {
      const c = conv(a.cid); const u = user(a.m.user);
      let label, preview, who = a.who ? user(a.who[0]) : u;
      if (a.type === 'mention') { label = 'Mention in ' + (c.type === 'channel' ? '#' + c.name : convName(c)); preview = plainText(a.m.text); }
      else if (a.type === 'thread') { label = 'Reply in ' + (c.type === 'channel' ? '#' + c.name : convName(c)); preview = plainText(a.m.text); }
      else { label = 'Reaction in ' + (c.type === 'channel' ? '#' + c.name : convName(c)); preview = who.name.split(' ')[0] + (a.who.length > 1 ? ' and ' + (a.who.length - 1) + ' other' + (a.who.length > 2 ? 's' : '') : '') + ' reacted ' + a.emoji + ' to: ' + plainText(a.m.text); }
      const key = a.type + ':' + a.m.id;
      return '<li><button class="sb-rich' + (a.unread ? ' unread' : '') + (state.activitySel === key ? ' selected' : '') + '" data-act="activity-open" data-key="' + key + '" data-conv="' + a.cid + '" data-msg="' + (a.parent ? a.parent.id : a.m.id) + '" data-target="' + a.m.id + '">' + avatar(who, 36, { click: false }) + '<span class="sb-rich-body"><span class="sb-rich-top"><span class="sb-rich-meta" style="overflow:hidden;text-overflow:ellipsis">' + esc(label) + '</span><span class="sb-rich-meta">' + sidebarTime(a.ts) + '</span></span><span class="sb-rich-name">' + esc(who.name) + '</span><span class="sb-rich-preview wrap">' + esc(preview) + '</span></span>' + (a.unread ? '<span class="unread-pip"></span>' : '') + '</button></li>';
    }).join('');
    return sidebarHeader('Activity', '<button class="sb-icon-btn" data-act="activity-filter" data-tip="Filter" aria-label="Filter">' + I('filter', 18) + '</button>') + '<div class="sb-body scroll"><div class="sb-tabs">' + tabs.map((t) => '<button class="sb-tab' + (state.activityTab === t[0] ? ' active' : '') + '" data-act="activity-tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><ul role="list">' + (rows || '<li class="sb-empty">' + I('checkCircle', 32) + 'Nothing new here</li>') + '</ul></div>';
  }
  function laterItems() {
    return allMsgs().filter(({ m }) => m.saved).map(({ m, cid, parent }) => ({ m, cid, parent, st: state.laterState[m.id] || 'progress' })).sort((a, b) => b.m.ts - a.m.ts);
  }
  function renderLaterSidebar() {
    const tabs = [['progress', 'In progress'], ['archived', 'Archived'], ['completed', 'Completed']];
    const items = laterItems().filter((x) => x.st === state.laterTab);
    const rows = items.map(({ m, cid, parent }) => {
      const c = conv(cid); const u = user(m.user);
      return '<li><button class="sb-rich' + (state.laterSel === m.id ? ' selected' : '') + '" data-act="later-open" data-conv="' + cid + '" data-msg="' + (parent ? parent.id : m.id) + '" data-target="' + m.id + '">' + avatar(u, 36, { click: false }) + '<span class="sb-rich-body"><span class="sb-rich-top"><span class="sb-rich-meta" style="overflow:hidden;text-overflow:ellipsis">' + esc(c.type === 'channel' ? '#' + c.name : convName(c)) + '</span><span class="sb-rich-meta">' + sidebarTime(m.ts) + '</span></span><span class="sb-rich-name">' + esc(u.name) + '</span><span class="sb-rich-preview wrap">' + esc(plainText(m.text) || (m.attachments[0] && (m.attachments[0].name || m.attachments[0].title)) || 'Attachment') + '</span></span></button></li>';
    }).join('');
    return sidebarHeader('Later', '<button class="sb-icon-btn" data-act="later-new" data-tip="New reminder" aria-label="New reminder">' + I('plus', 18) + '</button>') + '<div class="sb-body scroll"><div class="sb-tabs">' + tabs.map((t) => '<button class="sb-tab' + (state.laterTab === t[0] ? ' active' : '') + '" data-act="later-tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><ul role="list">' + (rows || '<li class="sb-empty">' + I('later', 32) + 'Nothing here yet. Save messages to find them later.</li>') + '</ul></div>';
  }
  const MORE_ITEMS = [
    { id: 'canvases', label: 'Canvases', icon: 'canvas', sub: 'Curate content and collaborate' },
    { id: 'files', label: 'Files', icon: 'files', sub: 'Documents, images, and links' },
    { id: 'workflows', label: 'Workflows', icon: 'workflows', sub: 'Automate routine work' },
    { id: 'people', label: 'People', icon: 'people', sub: 'Everyone in ' + D.workspace.name },
    { id: 'external', label: 'External connections', icon: 'external', sub: 'Work with other companies' },
  ];
  function renderMoreSidebar() {
    return sidebarHeader('More', '') + '<div class="sb-body scroll"><ul role="list">' + MORE_ITEMS.map((m) => '<li><button class="sb-rich' + (state.view === m.id ? ' selected' : '') + '" data-act="view" data-view="' + m.id + '"><span class="avatar sz-36" style="background:var(--sb-hover);color:var(--sb-text-strong)">' + I(m.icon, 20) + '</span><span class="sb-rich-body"><span class="sb-rich-name">' + esc(m.label) + '</span><span class="sb-rich-preview">' + esc(m.sub) + '</span></span></button></li>').join('') + '</ul></div>';
  }
  function renderHuddleChip() {
    const h = state.huddle; if (!h) return '';
    const c = conv(h.convId);
    return '<div class="huddle-chip" role="region" aria-label="Huddle"><div class="huddle-top">' + I('headphones', 16) + '<span class="huddle-title">' + esc(c.type === 'channel' ? '#' + c.name : convName(c)) + '</span><span class="huddle-timer" id="huddle-timer">' + huddleTime() + '</span></div><div class="huddle-avatars">' + avatar(me(), 28, { click: false }) + h.peers.map((p) => avatar(user(p), 28, { click: false }).replace('class="avatar', 'class="avatar speaking')).join('') + '</div><div class="huddle-controls"><button class="huddle-btn' + (h.muted ? ' off' : '') + '" data-act="huddle-mute" data-tip="' + (h.muted ? 'Unmute' : 'Mute') + '" aria-label="' + (h.muted ? 'Unmute' : 'Mute') + '" aria-pressed="' + h.muted + '">' + I(h.muted ? 'micOff' : 'mic', 18) + '</button><button class="huddle-btn' + (h.video ? ' off' : '') + '" data-act="huddle-video" data-tip="' + (h.video ? 'Turn off video' : 'Turn on video') + '" aria-label="Video">' + I(h.video ? 'video' : 'videoOff', 18) + '</button><button class="huddle-btn' + (h.share ? ' off' : '') + '" data-act="huddle-share" data-tip="Share screen" aria-label="Share screen">' + I('screen', 18) + '</button><button class="huddle-leave" data-act="huddle-leave">Leave</button></div></div>';
  }
  const huddleTime = () => { if (!state.huddle) return ''; const s = Math.floor((Date.now() - state.huddle.started) / 1000); return Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0'); };

  /* ------------------------------------------------------------------
     Rendering: main column
  ------------------------------------------------------------------ */
  function renderMain() {
    const main = $('#main');
    if (MORE_VIEWS.includes(state.view)) { main.innerHTML = renderPage(state.view); return; }
    const c = conv(state.conv);
    if (!c) { main.innerHTML = '<div class="empty-state"><h3>Select a conversation</h3></div>'; return; }
    main.innerHTML = renderChannelHeader(c) + '<div class="msg-scroll"><button class="jump-chip" id="jump-chip" data-act="jump-present">Jump to present ' + I('arrowDown', 14) + '</button><div class="msg-list scroll" id="msg-list" role="log" aria-label="Messages"></div><div class="typing" id="typing" aria-live="polite"></div></div>' + renderComposer(c, 'main');
    if (state.loading) { $('#msg-list').innerHTML = renderSkeleton(); }
    else refreshMessages(true);
    setupComposer($('#main .composer'), { convId: c.id });
    const list = $('#msg-list');
    list.addEventListener('scroll', onListScroll);
  }
  function renderSkeleton() {
    let h = '<div class="skeleton-list" aria-hidden="true">';
    for (let i = 0; i < 7; i++) h += '<div class="sk-row"><div class="sk sk-av"></div><div class="sk-lines"><div class="sk sk-line" style="width:' + (120 + (i * 37) % 120) + 'px"></div><div class="sk sk-line" style="width:' + (55 + (i * 23) % 40) + '%"></div>' + (i % 2 ? '<div class="sk sk-line" style="width:' + (30 + (i * 17) % 30) + '%"></div>' : '') + '</div></div>';
    return h + '</div>';
  }
  function renderChannelHeader(c) {
    const isCh = c.type === 'channel';
    const members = c.members || [];
    const facepile = isCh || c.members.length > 2 ? '<button class="facepile" data-act="rpanel" data-panel="members" data-tip="View all members"><span style="display:inline-flex">' + members.slice(0, 3).map((m) => avatar(user(m), 20, { click: false })).join('') + '</span><span class="fp-count">' + members.length + '</span></button>' : '';
    const other = !isCh && c.members.length === 2 ? user(dmOther(c)[0]) : null;
    const status = other ? displayStatus(other) : null;
    const title = isCh ? '<span class="ch-prefix">' + I(c.private ? 'lock' : 'hash', 18) + '</span><span class="ch-name">' + esc(c.name) + '</span>' : (other ? avatar(other, 24, { presence: true, click: false }) + '<span class="ch-name" style="margin-left:6px">' + esc(convName(c)) + '</span>' + (status ? '<span class="msg-status-emoji" title="' + attr(status.text) + '">' + esc(status.emoji) + '</span>' : '') : '<span class="ch-name">' + esc(convName(c)) + '</span>');
    const filesCount = msgs(c.id).reduce((n, m) => n + m.attachments.filter((a) => ['file', 'image'].includes(a.type)).length, 0);
    const pinsCount = msgs(c.id).filter((m) => m.pinned).length;
    const tabs = [['messages', 'Messages'], ['files', 'Files', filesCount], ['pins', 'Pins', pinsCount], ['canvas', 'Canvas']];
    const huddleOn = state.huddle && state.huddle.convId === c.id;
    return '<header class="ch-header"><div class="ch-header-top">' +
      '<button class="icon-btn hamburger" data-act="toggle-sidebar" aria-label="Open sidebar" data-tip="Menu">' + I('menu', 20) + '</button>' +
      '<button class="icon-btn mobile-back" data-act="mobile-back" aria-label="Back to conversations">' + I('back', 20) + '</button>' +
      '<button class="ch-title-btn" data-act="channel-details" data-tip="Get channel details">' + title + I('chevDown', 16, 'caret') + '</button>' +
      (isCh ? '<button class="icon-btn sm' + (state.starred[c.id] ? ' on' : '') + '" data-act="star" data-conv="' + c.id + '" data-tip="' + (state.starred[c.id] ? 'Remove from starred' : 'Star channel') + '" aria-label="Star channel" aria-pressed="' + !!state.starred[c.id] + '">' + I(state.starred[c.id] ? 'starFill' : 'star', 16) + '</button>' : '') +
      (isCh && c.topic ? '<button class="ch-topic" data-act="edit-topic" data-tip="Edit topic">' + esc(c.topic) + '</button>' : '<span class="ch-topic" style="pointer-events:none">' + (other ? esc(other.title) : '') + '</span>') +
      '<div class="ch-actions">' + facepile +
      '<div class="huddle-toggle' + (huddleOn ? ' on' : '') + '"><button data-act="huddle-toggle" data-tip="' + (huddleOn ? 'Leave huddle' : 'Start huddle') + '" aria-label="' + (huddleOn ? 'Leave huddle' : 'Start huddle') + '">' + I('headphones', 18) + '</button><button data-act="huddle-menu" aria-label="Huddle options" data-tip="Huddle options">' + I('chevDown', 14) + '</button></div>' +
      '<button class="icon-btn" data-act="rpanel" data-panel="details" data-tip="Channel details" aria-label="Channel details">' + I('info', 20) + '</button>' +
      '<button class="icon-btn" data-act="header-more" data-tip="More options" aria-label="More options">' + I('moreV', 20) + '</button>' +
      '</div></div>' +
      '<div class="ch-tabs" role="tablist">' + tabs.map((t) => '<button class="ch-tab' + (state.channelTab === t[0] ? ' active' : '') + '" role="tab" aria-selected="' + (state.channelTab === t[0]) + '" data-act="ch-tab" data-tab="' + t[0] + '">' + (t[0] === 'canvas' ? I('canvas', 16) : '') + t[1] + (t[2] ? '<span class="tab-count">' + t[2] + '</span>' : '') + '</button>').join('') + '<button class="ch-tab add-tab" data-act="add-tab" data-tip="Add a bookmark or tab" aria-label="Add tab">' + I('plus', 16) + '</button></div></header>';
  }

  /* messages */
  function groupable(prev, m) {
    return prev && prev.user === m.user && !prev.type && !m.type && (m.ts - prev.ts) < 5 * 60000 && startOfDay(prev.ts) === startOfDay(m.ts);
  }
  function renderMessage(m, ctx) {
    ctx = ctx || {};
    const u = user(m.user);
    const cont = !ctx.forceHead && groupable(ctx.prev, m);
    const own = m.user === D.me;
    const st = displayStatus(u);
    const isSys = m.type === 'system';
    const selfReacted = (m.reactions || []).some((r) => r.users.includes(D.me));
    let head = '';
    if (isSys) head = '';
    else if (!cont) head = '<div class="msg-head"><button class="msg-author" data-act="profile" data-user="' + u.id + '">' + esc(u.name) + '</button>' + (u.bot ? '<span class="app-badge">APP</span>' : '') + (st ? '<span class="msg-status-emoji" title="' + attr(st.text) + '">' + esc(st.emoji) + '</span>' : '') + '<button class="msg-time" data-tip="' + attr(fmtFull(m.ts)) + '" data-act="copy-link" data-msg="' + m.id + '">' + fmtTime(m.ts) + '</button></div>';
    const gutter = isSys ? '<span class="sys-ico">' + I(m.systemKind === 'huddle_started' || m.systemKind === 'huddle_ended' ? 'headphones' : 'bell', 18) + '</span>' : cont ? '<span class="gutter-time">' + fmtTime(m.ts).replace(/ [AP]M/, '') + '</span>' : avatar(u, 36, { click: true });
    const flags = (m.pinned || m.saved) ? '<div class="msg-flags">' + (m.pinned ? '<span class="pinned-flag">' + I('pin', 12) + 'Pinned by ' + esc(user(m.pinnedBy || 'u12').name.split(' ')[0]) + '</span>' : '') + (m.saved ? '<span class="saved-flag">' + I('bookmarkFill', 12) + 'Saved for later</span>' : '') + '</div>' : '';
    const text = isSys ? '<div class="msg-text">' + esc(m.text) + '</div>' : (m.text ? '<div class="msg-text-wrap"><div class="msg-text">' + renderText(m.text) + (m.edited ? '<span class="edited">(edited)</span>' : '') + '</div></div>' : '');
    const editor = state.editing === m.id ? '<div class="msg-editor" id="msg-editor"><div class="composer"><div class="fmt-bar">' + fmtButtons() + '</div><textarea rows="1" aria-label="Edit message">' + esc(m.text) + '</textarea><div class="comp-bottom"><button class="icon-btn" data-act="emoji-composer" data-tip="Emoji">' + I('emoji', 18) + '</button><div class="comp-right"><button class="btn outline sm" data-act="edit-cancel">Cancel</button><button class="btn primary sm" data-act="edit-save" data-msg="' + m.id + '">Save</button></div></div></div></div>' : '';
    const reactions = renderReactions(m);
    const threadFoot = !ctx.inThread && m.replies.length ? renderThreadFoot(m, ctx.convId) : '';
    const attachments = renderAttachments(m);
    const actions = isSys ? '' : '<div class="msg-actions" role="toolbar" aria-label="Message actions">' +
      state.quickReacts.map((e) => '<button class="act quick" data-act="react" data-msg="' + m.id + '" data-emoji="' + e + '" data-tip="' + (emojiName(e) ? ':' + emojiName(e) + ':' : 'React') + '" aria-label="React with ' + e + '">' + e + '</button>').join('') +
      '<button class="act" data-act="react-pick" data-msg="' + m.id + '" data-tip="Find another reaction" aria-label="Add reaction">' + I('emojiPlus', 18) + '</button>' +
      (ctx.inThread ? '' : '<button class="act" data-act="open-thread" data-msg="' + (ctx.parentId || m.id) + '" data-conv="' + ctx.convId + '" data-tip="Reply in thread" aria-label="Reply in thread">' + I('thread', 18) + '</button>') +
      '<button class="act" data-act="forward" data-msg="' + m.id + '" data-tip="Forward message…" aria-label="Forward message">' + I('forward', 18) + '</button>' +
      '<button class="act' + (m.saved ? ' on' : '') + '" data-act="save" data-msg="' + m.id + '" data-tip="' + (m.saved ? 'Remove from Later' : 'Save for later') + '" aria-label="Save for later" aria-pressed="' + !!m.saved + '">' + I(m.saved ? 'bookmarkFill' : 'bookmark', 18) + '</button>' +
      '<button class="act" data-act="msg-more" data-msg="' + m.id + '" data-conv="' + ctx.convId + '" data-tip="More actions" aria-label="More actions">' + I('moreV', 18) + '</button></div>';
    return '<div class="msg' + (cont ? ' cont' : '') + (isSys ? ' system' : '') + (own ? ' own' : '') + (ctx.highlight === m.id ? ' highlight' : '') + '" id="msg-' + m.id + '" data-msg="' + m.id + '" role="article" tabindex="-1"><div class="msg-gutter">' + gutter + '</div><div class="msg-body">' + flags + head + (editor || text) + attachments + reactions + threadFoot + '</div>' + actions + '</div>';
  }
  function renderReactions(m) {
    const rs = (m.reactions || []).filter((r) => r.users.length);
    if (!rs.length) return '';
    return '<div class="reactions">' + rs.map((r) => { const on = r.users.includes(D.me); const names = r.users.slice(0, 5).map((u) => (u === D.me ? 'You' : user(u).name)); const tip = names.join(', ') + (r.users.length > 5 ? ' and ' + (r.users.length - 5) + ' others' : '') + ' reacted with :' + (emojiName(r.emoji) || r.emoji) + ':'; return '<button class="reaction' + (on ? ' on' : '') + '" data-act="react" data-msg="' + m.id + '" data-emoji="' + r.emoji + '" data-tip="' + attr(tip) + '" aria-pressed="' + on + '" aria-label="' + attr(tip) + '"><span class="emoji">' + r.emoji + '</span>' + r.users.length + '</button>'; }).join('') + '<button class="reaction add" data-act="react-pick" data-msg="' + m.id + '" data-tip="Add reaction" aria-label="Add reaction">' + I('emojiPlus', 16) + '</button></div>';
  }
  function renderThreadFoot(m, convId) {
    const who = []; m.replies.forEach((r) => { if (!who.includes(r.user)) who.push(r.user); });
    const last = m.replies[m.replies.length - 1];
    return '<button class="thread-foot" data-act="open-thread" data-msg="' + m.id + '" data-conv="' + convId + '"><span class="avatar-stack">' + who.slice(0, 3).map((u) => avatar(user(u), 24, { click: false })).join('') + '</span><span class="replies-count">' + m.replies.length + ' repl' + (m.replies.length === 1 ? 'y' : 'ies') + '</span><span class="last-reply">Last reply ' + relTime(last.ts) + '</span><span class="view-thread">View thread ' + I('chevRight', 14) + '</span></button>';
  }
  function fileKind(a) { const k = (a.kind || (a.name || '').split('.').pop() || '').toLowerCase(); return ['pdf', 'xlsx', 'docx', 'zip'].includes(k) ? k : 'default'; }
  function renderAttachments(m) {
    if (!m.attachments || !m.attachments.length) return '';
    const imgs = m.attachments.filter((a) => a.type === 'image');
    const rest = m.attachments.filter((a) => a.type !== 'image');
    let h = '<div class="attachments">';
    if (imgs.length) h += '<div class="att-images">' + imgs.map((a) => '<button class="att-image" data-act="view-image" data-msg="' + m.id + '" data-name="' + attr(a.name) + '" style="width:' + Math.min(a.w, 360) + 'px;height:' + Math.round(Math.min(a.w, 360) * a.h / a.w) + 'px;background:' + a.gradient + '" aria-label="View image ' + attr(a.name) + '"><span class="img-surface">' + I('image', 22) + '</span><span class="img-name">' + esc(a.name) + '</span></button>').join('') + '</div>';
    rest.forEach((a) => {
      if (a.type === 'file') h += '<div class="file-card" data-act="open-file" data-name="' + attr(a.name) + '" role="button" tabindex="0"><span class="file-ico ' + fileKind(a) + '">' + fileKind(a).toUpperCase().replace('DEFAULT', 'FILE') + '</span><span class="file-meta"><span class="file-name">' + esc(a.name) + '</span><span class="file-sub">' + esc((fileKind(a) === 'default' ? 'File' : fileKind(a).toUpperCase()) + (a.size ? ' · ' + a.size : '') + (a.pages ? ' · ' + a.pages + ' pages' : '')) + '</span></span><span class="file-actions"><button class="icon-btn sm" data-act="toast" data-text="Downloading ' + attr(a.name) + '…" data-tip="Download" aria-label="Download">' + I('download', 16) + '</button><button class="icon-btn sm" data-act="toast" data-text="Share file" data-tip="Share" aria-label="Share">' + I('share', 16) + '</button></span></div>';
      else if (a.type === 'link') h += '<div class="unfurl"><div class="unfurl-body"><div class="unfurl-site"><span class="site-fav">' + I('globe', 12) + '</span>' + esc(a.site) + '</div><a class="unfurl-title" href="' + attr(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a><div class="unfurl-desc">' + esc(a.description) + '</div></div><div class="unfurl-img" style="background:' + a.image + '"></div></div>';
      else if (a.type === 'canvas') h += '<div class="canvas-card" data-act="open-canvas" data-title="' + attr(a.title) + '" role="button" tabindex="0"><div class="canvas-strip"></div><div class="canvas-body"><span class="canvas-ico">' + I('canvas', 20) + '</span><div><div class="canvas-title">' + esc(a.title) + '</div><div class="canvas-excerpt">' + esc(a.excerpt) + '</div><div class="canvas-meta">Canvas · ' + esc(a.updated) + ' by ' + esc(user(a.by).name) + '</div></div></div></div>';
      else if (a.type === 'poll') {
        const total = a.options.reduce((n, o) => n + o.votes.length, 0);
        h += '<div class="poll"><div class="poll-q">' + I('poll', 16) + ' ' + renderText(a.question, { noBig: true }) + '</div>' + a.options.map((o, i) => { const pct = total ? Math.round(o.votes.length / total * 100) : 0; const voted = o.votes.includes(D.me); return '<button class="poll-opt' + (voted ? ' voted' : '') + '" data-act="vote" data-msg="' + m.id + '" data-opt="' + i + '" aria-pressed="' + voted + '"><span class="poll-bar" style="width:' + pct + '%"></span><span class="poll-row"><span>' + renderText(o.text, { noBig: true }) + '</span><span class="poll-count">' + o.votes.slice(0, 3).map((v) => avatar(user(v), 20, { click: false })).join('') + ' ' + o.votes.length + '</span></span></button>'; }).join('') + '<div class="poll-foot">' + total + ' votes · Created by ' + esc(user(a.by).name) + ' · Click an option to vote</div></div>';
      }
      else if (a.type === 'github') h += '<div class="gh-card"><div class="gh-kind">' + avatar(user('b_github'), 20, { click: false }) + esc(a.repo) + ' · ' + esc(a.kind) + '</div><a class="gh-title" href="#" data-act="toast" data-text="Opening on GitHub…">' + esc(a.title) + '</a><div class="gh-meta"><span>' + esc(a.by) + '</span><span><code style="font-family:var(--mono);font-size:12px">' + esc(a.branch) + '</code></span><span>' + esc(a.meta) + '</span></div></div>';
      else if (a.type === 'deploy') h += '<div class="deploy-card"><div class="kind">' + avatar(user('b_vercel'), 20, { click: false }) + esc(a.project) + ' · ' + esc(a.env) + '</div><div class="deploy-status">' + esc(a.status) + ' · <a href="#" data-act="toast" data-text="Opening ' + attr(a.url) + '">' + esc(a.url) + '</a></div><div class="meta"><span>' + esc(a.commit) + '</span><span>' + esc(a.duration) + '</span></div></div>';
      else if (a.type === 'alert') h += '<div class="alert-card ' + esc(a.severity) + '"><div class="kind">' + avatar(user(m.user), 20, { click: false }) + esc(a.service) + '</div><span class="alert-title">' + esc(a.title) + '</span><div class="meta"><span class="alert-pill">' + esc(a.status) + '</span>' + (a.assignee ? '<span>Assigned to ' + esc(user(a.assignee).name) + '</span>' : '') + (a.duration ? '<span>' + esc(a.duration) + '</span>' : '') + '</div></div>';
      else if (a.type === 'zoom') h += '<div class="zoom-card"><span class="zoom-ico">' + I('video', 22) + '</span><div><div class="zoom-title">' + esc(a.title) + '</div><div class="zoom-meta">Zoom meeting · Hosted by ' + esc(user(a.host).name) + ' · ' + esc(a.duration) + ' · ' + a.participants + ' participants</div></div></div>';
      else if (a.type === 'gif') h += '<div class="gif-card" style="background:' + a.gradient + '"><span class="gif-label">GIF</span><span class="gif-caption">' + esc(a.caption) + '</span></div>';
    });
    return h + '</div>';
  }
  function renderMessageList(convId, opts) {
    opts = opts || {};
    const c = conv(convId);
    const list = msgs(convId);
    const newAt = state.newDividerAt[convId];
    let html = '';
    if (!opts.noIntro) html += renderIntro(c);
    let prev = null; let newShown = false;
    list.forEach((m) => {
      if (!prev || startOfDay(prev.ts) !== startOfDay(m.ts)) { html += '<div class="day-divider" role="separator"><button class="day-pill" data-act="day-menu">' + fmtDay(m.ts) + I('chevDown', 14) + '</button></div>'; prev = null; }
      if (newAt && !newShown && m.ts > newAt && m.user !== D.me) { html += '<div class="new-divider" role="separator"><span>New</span></div>'; newShown = true; prev = null; }
      html += renderMessage(m, { prev, convId, highlight: opts.highlight });
      prev = m;
    });
    return '<div class="msg-list-inner">' + html + '</div>';
  }
  function renderIntro(c) {
    if (c.type === 'channel') return '<div class="ch-intro"><div class="intro-ico">' + I(c.private ? 'lock' : 'hash', 32) + '</div><h2>' + I(c.private ? 'lock' : 'hash', 22) + esc(c.name) + '</h2><p>' + (c.id === 'c_general' ? 'This is the very beginning of the <b>#' + esc(c.name) + '</b> channel. ' : '') + esc(c.description || '') + ' <a href="#" data-act="edit-description">Edit description</a></p><div class="intro-actions"><button class="btn outline sm" data-act="add-teammates">' + I('userPlus', 16) + 'Add people</button><button class="btn outline sm" data-act="channel-details">' + I('info', 16) + 'Channel details</button></div></div>';
    if (c.self) return '<div class="ch-intro">' + avatar(me(), 72, { click: false }) + '<h2>' + esc(me().name) + ' <span style="font-weight:400;color:var(--text-2);font-size:15px">(you)</span></h2><p><b>This is your space.</b> Draft messages, make to-do lists or keep links and files handy. You can also talk to yourself here, but please bear in mind you’ll have to provide both sides of the conversation.</p></div>';
    const others = dmOther(c).map((u) => user(u));
    if (others.length === 1) { const o = others[0]; return '<div class="ch-intro">' + avatar(o, 72, { click: true }) + '<h2>' + esc(o.name) + '</h2><p>' + esc(o.title) + ' · This conversation is just between <b>@' + esc(o.name) + '</b> and you. Check out their profile to learn more about them.</p><div class="intro-actions"><button class="btn outline sm" data-act="profile" data-user="' + o.id + '">View profile</button></div></div>'; }
    return '<div class="ch-intro"><div style="display:flex;gap:4px">' + others.map((o) => avatar(o, 48, { click: true })).join('') + '</div><h2>' + esc(others.map((o) => o.name.split(' ')[0]).join(', ')) + '</h2><p>This is the very beginning of your group conversation with ' + esc(others.map((o) => '@' + o.name).join(', ')) + '.</p></div>';
  }
  function refreshMessages(scrollBottom, highlightId) {
    const list = $('#msg-list'); if (!list) return;
    const wasBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const c = conv(state.conv);
    if (state.channelTab === 'files') list.innerHTML = renderFilesTab(c);
    else if (state.channelTab === 'pins') list.innerHTML = renderPinsTab(c);
    else if (state.channelTab === 'canvas') list.innerHTML = renderCanvasTab(c);
    else list.innerHTML = renderMessageList(state.conv, { highlight: highlightId });
    if (highlightId) { const el = $('#msg-' + highlightId); if (el) { el.scrollIntoView({ block: 'center' }); } }
    else if (scrollBottom || wasBottom) list.scrollTop = list.scrollHeight;
    onListScroll();
  }
  function onListScroll() {
    const list = $('#msg-list'); const chip = $('#jump-chip'); if (!list || !chip) return;
    const far = list.scrollHeight - list.scrollTop - list.clientHeight > 400;
    chip.classList.toggle('show', far);
  }
  function renderFilesTab(c) {
    const files = []; msgs(c.id).forEach((m) => m.attachments.forEach((a) => { if (a.type === 'file' || a.type === 'image') files.push({ a, m }); }));
    if (!files.length) return '<div class="empty-state"><div class="es-ico" style="background:var(--bg-2)">' + I('files', 40) + '</div><h3>No files yet</h3><p>Files shared in this channel will show up here.</p></div>';
    return '<div class="page-body"><div class="card-grid">' + files.map(({ a, m }) => '<button class="card" data-act="open-file" data-name="' + attr(a.name) + '"><div class="card-cover" style="background:' + (a.gradient || 'var(--bg-2)') + ';display:flex;align-items:center;justify-content:center;color:var(--text-2)">' + (a.type === 'file' ? '<span class="file-ico ' + fileKind(a) + '" style="width:44px;height:54px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;border-radius:4px;color:#fff;font-size:10px;font-weight:900">' + fileKind(a).toUpperCase() + '</span>' : '') + '</div><div class="card-body"><div class="card-title">' + esc(a.name) + '</div><div class="card-meta">' + avatar(user(m.user), 20, { click: false }) + esc(user(m.user).name) + ' · ' + fmtShortDate(m.ts) + (a.size ? ' · ' + esc(a.size) : '') + '</div></div></button>').join('') + '</div></div>';
  }
  function renderPinsTab(c) {
    const pins = msgs(c.id).filter((m) => m.pinned);
    if (!pins.length) return '<div class="empty-state"><div class="es-ico" style="background:var(--bg-2)">' + I('pin', 40) + '</div><h3>No pinned messages</h3><p>Pin important messages so they’re easy to find later.</p></div>';
    return '<div class="msg-list-inner" style="justify-content:flex-start"><div class="result-count">' + pins.length + ' pinned message' + (pins.length === 1 ? '' : 's') + '</div>' + pins.map((m) => renderMessage(m, { convId: c.id, forceHead: true })).join('') + '</div>';
  }
  function renderCanvasTab(c) {
    const cv = D.canvases.find((x) => x.channel === c.id);
    return '<div class="page-body" style="max-width:760px"><div style="height:8px;border-radius:4px;background:' + (cv ? cv.color : 'linear-gradient(90deg,#E01E5A,#ECB22E,#2EB67D,#36C5F0)') + ';margin-bottom:24px"></div><h1 style="font-size:30px;font-weight:900;margin:0 0 8px">' + esc(cv ? cv.title : (c.type === 'channel' ? '#' + c.name : convName(c)) + ' canvas') + '</h1><p class="muted-text" style="margin:0 0 20px">' + (cv ? 'Edited ' + relTime(cv.updated) + ' by ' + esc(user(cv.by).name) : 'Start your canvas — add notes, links and files that everyone in this channel can see.') + '</p>' + (cv ? '<p style="font-size:16px;line-height:1.6">' + esc(cv.excerpt) + '</p><h3>Open questions</h3><ul style="list-style:disc;padding-left:24px;line-height:1.8"><li>Who owns the follow-up on the customer interviews?</li><li>Do we need a separate rollout plan for enterprise accounts?</li><li>What is the success metric for the first 30 days?</li></ul><h3>Decisions</h3><p>✅ OIDC before SAML for SSO.<br>✅ Ship 2.14.1 hotfix tomorrow morning PT.<br>⏳ Sprint review time change — pending confirmation.</p>' : '<div class="ch-intro" style="padding:0"><div class="intro-actions"><button class="btn primary sm" data-act="toast" data-text="Canvas created">Create canvas</button><button class="btn outline sm" data-act="toast" data-text="Templates coming soon">Browse templates</button></div></div>') + '</div>';
  }

  /* ------------------------------------------------------------------
     Full-page views (More menu)
  ------------------------------------------------------------------ */
  function pageHead(title, extra) { return '<header class="page-head"><button class="icon-btn hamburger" data-act="toggle-sidebar" aria-label="Open sidebar">' + I('menu', 20) + '</button><button class="icon-btn mobile-back" data-act="mobile-back" aria-label="Back">' + I('back', 20) + '</button><h1>' + esc(title) + '</h1>' + (extra || '') + '</header>'; }
  function renderPage(view) {
    if (view === 'canvases') return '<div class="page">' + pageHead('Canvases', '<button class="btn primary sm" data-act="toast" data-text="New canvas created">' + I('plus', 16) + 'New canvas</button>') + '<div class="page-body scroll"><div class="page-toolbar"><div class="field">' + I('search', 16) + '<input placeholder="Search canvases" aria-label="Search canvases" data-filter="cards"></div><button class="btn outline sm" data-act="toast" data-text="Sorted by recently edited">' + I('sort', 16) + 'Recently edited</button></div><div class="card-grid" id="cards">' + D.canvases.map((cv) => '<button class="card" data-act="open-canvas" data-title="' + attr(cv.title) + '" data-search="' + attr(cv.title + ' ' + cv.excerpt) + '"><div class="card-cover" style="background:' + cv.color + '"></div><div class="card-body"><div class="card-title">' + esc(cv.title) + '</div><div class="card-excerpt">' + esc(cv.excerpt) + '</div><div class="card-meta">' + avatar(user(cv.by), 20, { click: false }) + esc(user(cv.by).name.split(' ')[0]) + ' · ' + relTime(cv.updated) + (cv.channel ? ' · #' + esc(conv(cv.channel).name) : '') + '</div></div></button>').join('') + '</div></div></div>';
    if (view === 'files') {
      const files = []; Object.keys(D.messages).forEach((cid) => D.messages[cid].forEach((m) => m.attachments.forEach((a) => { if (['file', 'image', 'canvas'].includes(a.type)) files.push({ a, m, cid }); })));
      files.sort((x, y) => y.m.ts - x.m.ts);
      return '<div class="page">' + pageHead('Files') + '<div class="page-body scroll"><div class="page-toolbar"><div class="field">' + I('search', 16) + '<input placeholder="Search files" aria-label="Search files" data-filter="rows"></div><button class="chip on">All types</button><button class="chip" data-act="toast" data-text="Filter: Images">Images</button><button class="chip" data-act="toast" data-text="Filter: Documents">Documents</button><button class="chip" data-act="toast" data-text="Filter: Canvases">Canvases</button></div><table class="table"><thead><tr><th>Name</th><th>Shared by</th><th>Where</th><th>Date</th><th>Size</th></tr></thead><tbody id="rows">' + files.map(({ a, m, cid }) => '<tr data-search="' + attr((a.name || a.title) + ' ' + user(m.user).name) + '" data-act="open-file" data-name="' + attr(a.name || a.title) + '" style="cursor:pointer"><td><span class="td-main">' + (a.type === 'image' ? '<span class="avatar sz-28" style="background:' + a.gradient + '"></span>' : a.type === 'canvas' ? '<span class="avatar sz-28" style="background:var(--bg-3);color:var(--text-2)">' + I('canvas', 16) + '</span>' : '<span class="avatar sz-28 file-ico ' + fileKind(a) + '" style="font-size:8px">' + fileKind(a).toUpperCase().slice(0, 4) + '</span>') + esc(a.name || a.title) + '</span></td><td>' + esc(user(m.user).name) + '</td><td>' + esc(conv(cid).type === 'channel' ? '#' + conv(cid).name : convName(conv(cid))) + '</td><td>' + fmtShortDate(m.ts) + '</td><td>' + esc(a.size || '—') + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    if (view === 'workflows') return '<div class="page">' + pageHead('Workflows', '<button class="btn primary sm" data-act="toast" data-text="Workflow builder opened">' + I('plus', 16) + 'New workflow</button>') + '<div class="page-body scroll"><div class="page-toolbar"><div class="field">' + I('search', 16) + '<input placeholder="Search workflows" aria-label="Search workflows" data-filter="rows"></div></div><table class="table"><thead><tr><th>Name</th><th>Starts when</th><th>Runs</th><th>Owner</th><th>Status</th></tr></thead><tbody id="rows">' + D.workflows.map((w) => '<tr data-search="' + attr(w.name + ' ' + w.trigger) + '"><td><span class="td-main"><span class="avatar sz-28" style="background:var(--bg-3);color:var(--text-2)">' + I('workflows', 16) + '</span>' + esc(w.name) + '</span></td><td>' + esc(w.trigger) + '</td><td>' + w.runs + '</td><td><span class="td-main" style="font-weight:400">' + avatar(user(w.by), 20, { click: false }) + esc(user(w.by).name) + '</span></td><td><span class="pill ' + (w.status === 'Published' ? 'green' : 'yellow') + '">' + esc(w.status) + '</span></td></tr>').join('') + '</tbody></table></div></div>';
    if (view === 'people') { const ppl = Object.values(D.users).filter((u) => !u.bot); return '<div class="page">' + pageHead('People', '<button class="btn outline sm" data-act="add-teammates">' + I('userPlus', 16) + 'Invite people</button>') + '<div class="page-body scroll"><div class="page-toolbar"><div class="field">' + I('search', 16) + '<input placeholder="Search people" aria-label="Search people" data-filter="cards"></div><span class="muted-text">' + ppl.length + ' members</span></div><div class="people-grid" id="cards">' + ppl.map((u) => { const st = displayStatus(u); return '<button class="person-card" data-act="profile" data-user="' + u.id + '" data-search="' + attr(u.name + ' ' + u.title) + '"><div class="pc-av">' + avatar(u, 192, { click: false }) + '</div><div class="pc-body"><div class="pc-name">' + esc(u.name) + '<span class="presence-dot inline ' + presenceOf(u) + '"></span>' + (st ? '<span>' + esc(st.emoji) + '</span>' : '') + '</div><div class="pc-title">' + esc(u.title) + '</div></div></button>'; }).join('') + '</div></div></div>'; }
    if (view === 'external') return '<div class="page">' + pageHead('External connections', '<button class="btn primary sm" data-act="toast" data-text="Invitation flow coming soon">' + I('plus', 16) + 'Create connection</button>') + '<div class="page-body scroll"><p class="muted-text" style="margin:0 0 16px">Work with people outside ' + esc(D.workspace.name) + ' in shared channels and DMs via Slack Connect.</p><table class="table"><thead><tr><th>Organization</th><th>Type</th><th>Channel</th><th>Members</th><th>Status</th></tr></thead><tbody>' + D.externalConnections.map((x) => '<tr><td><span class="td-main"><span class="avatar sz-28" style="background:' + ['#1264A3', '#E01E5A', '#2EB67D'][D.externalConnections.indexOf(x) % 3] + '">' + esc(x.name[0]) + '</span>' + esc(x.name) + '</span></td><td>' + esc(x.type) + '</td><td>' + (x.channel ? '#' + esc(x.channel) : '—') + '</td><td>' + x.members + '</td><td><span class="pill ' + (x.status === 'Active' ? 'green' : 'yellow') + '">' + esc(x.status) + '</span></td></tr>').join('') + '</tbody></table></div></div>';
    return '<div class="empty-state"><h3>Nothing here</h3></div>';
  }

  /* ------------------------------------------------------------------
     Right panel
  ------------------------------------------------------------------ */
  function openPanel(p) { state.rpanel = p; renderRPanel(); }
  function closePanel() { state.rpanel = null; renderRPanel(); }
  const rpHead = (title, sub, extra) => '<div class="rp-head"><div class="rp-title"><span>' + title + '</span>' + (sub ? '<span class="rp-sub">' + sub + '</span>' : '') + '</div>' + (extra || '') + '<button class="icon-btn" data-act="close-panel" aria-label="Close panel" data-tip="Close">' + I('close', 20) + '</button></div>';
  function renderRPanel() {
    const rp = $('#rpanel'); const p = state.rpanel;
    rp.classList.toggle('open', !!p);
    if (!p) { rp.innerHTML = ''; return; }
    const c = conv(p.convId || state.conv);
    if (p.type === 'thread') {
      const f = findMsg(p.msgId); if (!f) { closePanel(); return; }
      const m = f.msg;
      let replies = ''; let prev = null;
      m.replies.forEach((r) => { replies += renderMessage(r, { prev, convId: f.convId, inThread: true, parentId: m.id }); prev = r; });
      rp.innerHTML = rpHead('Thread', c.type === 'channel' ? '# ' + esc(c.name) : esc(convName(c))) + '<div class="rp-body"><div class="msg-list scroll" id="thread-list"><div class="thread-parent">' + renderMessage(m, { convId: f.convId, inThread: true, forceHead: true }) + '</div>' + (m.replies.length ? '<div class="replies-divider">' + m.replies.length + ' repl' + (m.replies.length === 1 ? 'y' : 'ies') + '</div>' : '') + replies + '</div>' + renderComposer(c, 'thread', m) + '</div>';
      setupComposer($('#rpanel .composer'), { convId: f.convId, threadId: m.id });
      const tl = $('#thread-list'); tl.scrollTop = tl.scrollHeight;
    } else if (p.type === 'details') {
      rp.innerHTML = rpHead(c.type === 'channel' ? '#&nbsp;' + esc(c.name) : esc(convName(c)), '') + '<div class="rp-body scroll">' + renderDetailsBody(c) + '</div>';
    } else if (p.type === 'members') {
      rp.innerHTML = rpHead('Members', c.members.length + '') + '<div class="rp-body scroll"><div class="rp-search-bar"><div class="field">' + I('search', 16) + '<input placeholder="Find members" aria-label="Find members" data-filter="members"></div></div><div id="members">' + c.members.map((id) => { const u = user(id); const st = displayStatus(u); return '<button class="rp-list-item" data-act="profile" data-user="' + id + '" data-search="' + attr(u.name + ' ' + u.title) + '">' + avatar(u, 36, { presence: true, click: false }) + '<span class="rp-li-body"><span class="rp-li-name">' + esc(u.name) + (id === D.me ? ' <span class="muted-text">(you)</span>' : '') + (st ? '<span>' + esc(st.emoji) + '</span>' : '') + '</span><span class="rp-li-sub">' + esc(u.title) + '</span></span></button>'; }).join('') + '</div><div style="padding:12px 20px"><button class="btn outline block" data-act="add-teammates">' + I('userPlus', 18) + 'Add people</button></div></div>';
    } else if (p.type === 'profile') {
      const u = user(p.userId); const st = displayStatus(u); const pr = presenceOf(u);
      const dm = D.dms.find((d) => d.members.length === 2 && d.members.includes(u.id)) || (u.id === D.me ? D.dms.find((d) => d.self) : null);
      rp.innerHTML = rpHead('Profile', '') + '<div class="rp-body scroll"><div class="profile-hero"><div style="max-width:260px">' + avatar(u, 192, { click: false }) + '</div><h3 class="profile-name">' + esc(u.name) + (u.pronouns ? '<span class="muted-text" style="font-size:13px;font-weight:400">' + esc(u.pronouns) + '</span>' : '') + '</h3><div class="profile-title">' + esc(u.title || (u.bot ? 'App' : '')) + '</div>' + (u.bot ? '' : '<div class="profile-presence"><span class="pdot ' + pr + '"></span>' + (pr === 'active' ? 'Active' : pr === 'dnd' ? 'Notifications paused' : 'Away') + ' · ' + (u.tz ? localTime(u.tz) + ' local time' : '') + '</div>') + (st ? '<div class="profile-status"><span>' + esc(st.emoji) + '</span><span>' + esc(st.text) + '</span>' + (st.until ? '<span class="muted-text">until ' + esc(st.until) + '</span>' : '') + '</div>' : '') + '<div class="profile-actions">' + (u.id === D.me ? '<button class="btn outline sm" data-act="set-status">' + I('emoji', 16) + 'Set a status</button><button class="btn outline sm" data-act="toast" data-text="Profile editor opened">' + I('edit', 16) + 'Edit profile</button>' : (dm ? '<button class="btn outline sm" data-act="open" data-conv="' + dm.id + '">' + I('dms', 16) + 'Message</button>' : '') + (u.bot ? '<button class="btn outline sm" data-act="toast" data-text="App settings opened">' + I('settings', 16) + 'Configure</button>' : '<button class="btn outline sm" data-act="huddle-with" data-user="' + u.id + '">' + I('headphones', 16) + 'Huddle</button>')) + '<button class="icon-btn" data-act="toast" data-text="Copied link to profile" data-tip="More" aria-label="More options">' + I('moreV', 20) + '</button></div></div>' + (u.bot ? '' : '<div class="rp-section"><h4>Contact information</h4><div class="profile-field"><div class="pf-label">' + I('mail', 14) + ' Email address</div><a class="pf-value" href="mailto:' + attr(u.email) + '">' + esc(u.email) + '</a></div>' + (u.phone ? '<div class="profile-field"><div class="pf-label">' + I('phone', 14) + ' Phone</div><div class="pf-value">' + esc(u.phone) + '</div></div>' : '') + '</div><div class="rp-section"><h4>About</h4><div class="profile-field"><div class="pf-label">Time zone</div><div class="pf-value plain">' + esc(u.tz || '') + '</div></div><div class="profile-field"><div class="pf-label">Local time</div><div class="pf-value plain">' + localTime(u.tz) + '</div></div></div>') + '</div>';
    } else if (p.type === 'saved') {
      const items = laterItems().filter((x) => x.st === 'progress');
      rp.innerHTML = rpHead('Saved items', items.length + '') + '<div class="rp-body scroll">' + (items.length ? items.map(({ m, cid }) => '<button class="search-result" data-act="jump" data-conv="' + cid + '" data-msg="' + m.id + '"><div class="sr-ctx">' + (conv(cid).type === 'channel' ? I('hash', 12) : I('dms', 12)) + '<b>' + esc(conv(cid).type === 'channel' ? conv(cid).name : convName(conv(cid))) + '</b> · ' + fmtShortDate(m.ts) + '</div><div class="sr-body">' + avatar(user(m.user), 28, { click: false }) + '<div class="sr-text"><b>' + esc(user(m.user).name) + '</b> ' + esc(plainText(m.text).slice(0, 160)) + '</div></div></button>').join('') : '<div class="empty-state"><h3>Nothing saved yet</h3><p>Save messages and files to find them here later.</p></div>') + '</div>';
    } else if (p.type === 'search') {
      rp.innerHTML = renderSearchPanel(p.query || '');
    } else if (p.type === 'threads') {
      const items = allMsgs().filter(({ m, parent }) => !parent && m.replies.length && (m.user === D.me || m.replies.some((r) => r.user === D.me) || m.replies.some((r) => mentionsMe(r)) || mentionsMe(m))).sort((a, b) => b.m.replies[b.m.replies.length - 1].ts - a.m.replies[a.m.replies.length - 1].ts);
      rp.innerHTML = rpHead('Threads', '') + '<div class="rp-body scroll">' + items.map(({ m, cid }) => { const last = m.replies[m.replies.length - 1]; return '<button class="search-result" data-act="open-thread" data-conv="' + cid + '" data-msg="' + m.id + '"><div class="sr-ctx">' + I('hash', 12) + '<b>' + esc(conv(cid).type === 'channel' ? conv(cid).name : convName(conv(cid))) + '</b> · ' + m.replies.length + ' replies · last ' + relTime(last.ts) + '</div><div class="sr-body">' + avatar(user(m.user), 28, { click: false }) + '<div class="sr-text"><b>' + esc(user(m.user).name) + '</b> ' + esc(plainText(m.text).slice(0, 140)) + '<div class="muted-text" style="margin-top:4px"><b>' + esc(user(last.user).name.split(' ')[0]) + ':</b> ' + esc(plainText(last.text).slice(0, 100)) + '</div></div></div></button>'; }).join('') + '</div>';
    }
  }
  function localTime(tz) { try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date()); } catch (e) { return fmtTime(Date.now()); } }
  function renderDetailsBody(c) {
    const isCh = c.type === 'channel';
    return '<div class="rp-section"><div style="display:flex;gap:8px;flex-wrap:wrap">' + (isCh ? '<button class="btn outline sm" data-act="star" data-conv="' + c.id + '">' + I(state.starred[c.id] ? 'starFill' : 'star', 16) + (state.starred[c.id] ? 'Starred' : 'Star') + '</button>' : '') + '<button class="btn outline sm" data-act="mute" data-conv="' + c.id + '">' + I(state.muted[c.id] ? 'bellOff' : 'bell', 16) + (state.muted[c.id] ? 'Unmute' : 'Mute') + '</button><button class="btn outline sm" data-act="huddle-toggle">' + I('headphones', 16) + 'Huddle</button></div></div>' +
      (isCh ? '<div class="rp-section"><div class="detail-row" style="border:0;padding:0"><div><div class="dr-label">Topic</div><div class="dr-sub">' + esc(c.topic || 'Add a topic') + '</div></div><button class="link-btn" data-act="edit-topic">Edit</button></div></div><div class="rp-section"><div class="detail-row" style="border:0;padding:0"><div><div class="dr-label">Description</div><div class="dr-sub">' + esc(c.description || 'Add a description') + '</div></div><button class="link-btn" data-act="edit-description">Edit</button></div></div><div class="rp-section"><div class="dr-label">Created by</div><div class="dr-sub">' + esc(user('u12').name) + ' on ' + fmtShortDate(c.created) + ', ' + new Date(c.created).getFullYear() + '</div></div>' : '') +
      '<button class="rp-list-item" data-act="rpanel" data-panel="members"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('people', 20) + '</span><span class="rp-li-body"><span class="rp-li-name">Members</span><span class="rp-li-sub">' + c.members.length + '</span></span>' + I('chevRight', 16) + '</button>' +
      '<button class="rp-list-item" data-act="ch-tab" data-tab="pins"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('pin', 20) + '</span><span class="rp-li-body"><span class="rp-li-name">Pinned</span><span class="rp-li-sub">' + msgs(c.id).filter((m) => m.pinned).length + '</span></span>' + I('chevRight', 16) + '</button>' +
      '<button class="rp-list-item" data-act="ch-tab" data-tab="files"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('files', 20) + '</span><span class="rp-li-body"><span class="rp-li-name">Files</span><span class="rp-li-sub">' + msgs(c.id).reduce((n, m) => n + m.attachments.filter((a) => ['file', 'image'].includes(a.type)).length, 0) + '</span></span>' + I('chevRight', 16) + '</button>' +
      (isCh ? '<button class="rp-list-item" data-act="channel-details" data-tab="integrations"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('apps', 20) + '</span><span class="rp-li-body"><span class="rp-li-name">Integrations</span><span class="rp-li-sub">' + (c.integrations || []).length + ' apps</span></span>' + I('chevRight', 16) + '</button><button class="rp-list-item" data-act="channel-details" data-tab="settings"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('settings', 20) + '</span><span class="rp-li-body"><span class="rp-li-name">Settings</span></span>' + I('chevRight', 16) + '</button><div class="rp-section" style="border:0"><button class="btn ghost" style="color:var(--danger)" data-act="toast" data-text="You left #' + attr(c.name) + ' (not really — this is a demo)">Leave channel</button></div>' : '') +
      '<div class="rp-section" style="border:0"><span class="muted-text">Channel ID: ' + esc(c.id.toUpperCase()) + '</span></div>';
  }

  /* search */
  function parseQuery(q) {
    const f = { text: [], in: null, from: null };
    q.split(/\s+/).forEach((t) => {
      let m;
      if ((m = t.match(/^in:#?(.+)$/))) f.in = m[1].toLowerCase();
      else if ((m = t.match(/^from:@?(.+)$/))) f.from = m[1].toLowerCase();
      else if (t) f.text.push(t.toLowerCase());
    });
    return f;
  }
  function searchMessages(q) {
    const f = parseQuery(q);
    if (!f.text.length && !f.in && !f.from) return [];
    return allMsgs().filter(({ m, cid }) => {
      if (m.type === 'system') return false;
      const c = conv(cid);
      if (f.in && !(c.type === 'channel' ? c.name.toLowerCase().includes(f.in) : convName(c).toLowerCase().includes(f.in))) return false;
      if (f.from) { const u = user(m.user); if (!(u.name.toLowerCase().includes(f.from) || (u.handle || '').includes(f.from) || (f.from === 'me' && m.user === D.me))) return false; }
      const hay = (plainText(m.text) + ' ' + m.attachments.map((a) => a.name || a.title || '').join(' ')).toLowerCase();
      return f.text.every((t) => hay.includes(t));
    }).sort((a, b) => b.m.ts - a.m.ts);
  }
  function highlight(text, terms) {
    let s = esc(text);
    terms.forEach((t) => { if (!t) return; s = s.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return s;
  }
  function renderSearchPanel(q) {
    const res = searchMessages(q); const f = parseQuery(q);
    const chans = D.channels.slice(0, 6);
    const people = ['me', 'u1', 'u2', 'u3', 'u4'];
    const chip = (label, on, act, val) => '<button class="chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-val="' + attr(val) + '">' + esc(label) + (on ? I('close', 12) : '') + '</button>';
    return rpHead('Search results', res.length ? res.length + ' result' + (res.length === 1 ? '' : 's') : '') + '<div class="rp-search-bar"><div class="field">' + I('search', 16) + '<input id="rp-search-input" value="' + attr(q) + '" placeholder="Search messages, files, and more" aria-label="Search"></div><div class="chips">' + (f.in ? chip('in: #' + f.in, true, 'search-chip', 'in:') : chip('In: ' + (conv(state.conv).type === 'channel' ? '#' + conv(state.conv).name : 'this conversation'), false, 'search-chip', 'in:' + (conv(state.conv).type === 'channel' ? conv(state.conv).name : convName(conv(state.conv)).split(' ')[0]))) + (f.from ? chip('from: @' + f.from, true, 'search-chip', 'from:') : chip('From: me', false, 'search-chip', 'from:me')) + '<button class="chip" data-act="search-more-filters">' + I('filter', 12) + 'More filters</button></div></div><div class="rp-body scroll">' + (res.length ? res.map(({ m, cid, parent }) => { const c = conv(cid); return '<button class="search-result" data-act="jump" data-conv="' + cid + '" data-msg="' + m.id + '" data-parent="' + (parent ? parent.id : '') + '"><div class="sr-ctx">' + (c.type === 'channel' ? I(c.private ? 'lock' : 'hash', 12) : I('dms', 12)) + '<b>' + esc(c.type === 'channel' ? c.name : convName(c)) + '</b>' + (parent ? ' · in thread' : '') + ' · ' + fmtShortDate(m.ts) + ' at ' + fmtTime(m.ts) + '</div><div class="sr-body">' + avatar(user(m.user), 28, { click: false }) + '<div class="sr-text"><b>' + esc(user(m.user).name) + '</b> ' + highlight(plainText(m.text || (m.attachments[0] && (m.attachments[0].name || m.attachments[0].title)) || '').slice(0, 220), f.text) + '</div></div></button>'; }).join('') : (q.trim() ? '<div class="empty-state"><div class="es-ico" style="background:var(--bg-2)">' + I('search', 40) + '</div><h3>No results for “' + esc(q) + '”</h3><p>Try a different search or remove a filter. You can use <code>in:#channel</code> and <code>from:@person</code>.</p></div>' : '<div class="empty-state"><div class="es-ico" style="background:var(--bg-2)">' + I('search', 40) + '</div><h3>Search ' + esc(D.workspace.name) + '</h3><p>Find messages, files, channels and people. Narrow results with <code>in:#channel</code> and <code>from:@person</code>.</p><div class="chips" style="justify-content:center;margin-top:12px">' + chans.map((c) => '<button class="chip" data-act="search-chip" data-val="in:' + c.name + '">in:#' + esc(c.name) + '</button>').join('') + people.map((p) => '<button class="chip" data-act="search-chip" data-val="from:' + (user(p).handle || 'me') + '">from:@' + esc(user(p).handle || 'me') + '</button>').join('') + '</div></div>')) + '</div>';
  }

  /* ------------------------------------------------------------------
     Composer
  ------------------------------------------------------------------ */
  const FMT = [['bold', 'Bold', MOD + ' B', 'bold'], ['italic', 'Italic', MOD + ' I', 'italic'], ['strike', 'Strikethrough', MOD + ' ' + SHIFT + ' X', 'strike'], null, ['link', 'Link', MOD + ' ' + SHIFT + ' U', 'link'], null, ['ol', 'Ordered list', MOD + ' ' + SHIFT + ' 7', 'ol'], ['ul', 'Bulleted list', MOD + ' ' + SHIFT + ' 8', 'ul'], null, ['quote', 'Blockquote', MOD + ' ' + SHIFT + ' 9', 'quote'], null, ['code', 'Code', MOD + ' ' + SHIFT + ' C', 'code'], ['codeBlock', 'Code block', MOD + ' ' + ALT + ' ' + SHIFT + ' C', 'codeBlock']];
  const fmtButtons = () => FMT.map((f) => f ? '<button class="fmt-btn" data-act="fmt" data-fmt="' + f[3] + '" data-tip="' + attr(f[1]) + '" data-tip-sub="' + attr(f[2]) + '" aria-label="' + attr(f[1]) + '">' + I(f[0], 16) + '</button>' : '<span class="fmt-sep"></span>').join('');
  function renderComposer(c, kind, parent) {
    const draftKey = kind === 'thread' ? 'thread:' + parent.id : c.id;
    const draft = state.drafts[draftKey] || '';
    const ph = kind === 'thread' ? 'Reply…' : 'Message ' + (c.type === 'channel' ? '#' + c.name : (c.self ? 'yourself' : convName(c)));
    const restricted = c.id === 'c_announcements';
    return '<div class="composer-wrap"><div class="composer' + (restricted ? ' disabled' : '') + '" data-draft-key="' + attr(draftKey) + '" data-kind="' + kind + '">' +
      '<div class="ac-pop" role="listbox"></div>' +
      '<div class="fmt-bar' + (state.prefs.showFmt ? '' : ' hidden') + '" role="toolbar" aria-label="Formatting">' + fmtButtons() + '</div>' +
      '<textarea rows="1" placeholder="' + attr(restricted ? 'Only admins can post in #announcements' : ph) + '" aria-label="' + attr(ph) + '"' + (restricted ? ' disabled' : '') + '>' + esc(draft) + '</textarea>' +
      (kind === 'thread' ? '<label class="also-send"><input type="checkbox" class="also-send-cb"> Also send to ' + (c.type === 'channel' ? '#' + esc(c.name) : esc(convName(c))) + '</label>' : '') +
      '<div class="comp-bottom">' +
      '<button class="icon-btn" data-act="attach-menu" data-tip="Attach" aria-label="Attach" style="background:var(--bg-3);border-radius:50%">' + I('plus', 18) + '</button>' +
      '<button class="icon-btn' + (state.prefs.showFmt ? ' on' : '') + '" data-act="toggle-fmt" data-tip="' + (state.prefs.showFmt ? 'Hide formatting' : 'Show formatting') + '" aria-label="Toggle formatting" aria-pressed="' + state.prefs.showFmt + '">' + I('text', 18) + '</button>' +
      '<button class="icon-btn" data-act="emoji-composer" data-tip="Emoji" aria-label="Emoji">' + I('emoji', 18) + '</button>' +
      '<button class="icon-btn" data-act="mention-composer" data-tip="Mention someone" aria-label="Mention someone">' + I('at', 18) + '</button>' +
      '<span class="sep"></span>' +
      '<button class="icon-btn" data-act="toast" data-text="Video clips are not available in this demo" data-tip="Record video clip" aria-label="Record video clip">' + I('video', 18) + '</button>' +
      '<button class="icon-btn" data-act="toast" data-text="Audio clips are not available in this demo" data-tip="Record audio clip" aria-label="Record audio clip">' + I('mic', 18) + '</button>' +
      '<span class="sep"></span>' +
      '<button class="icon-btn" data-act="slash-composer" data-tip="Shortcuts" aria-label="Shortcuts">' + I('slash', 18) + '</button>' +
      '<div class="comp-right"><span class="slash-hint">Type <b>/</b> for shortcuts</span><div class="send-group' + (draft.trim() ? '' : ' disabled') + '"><button class="send-btn" data-act="send" data-tip="Send now" data-tip-sub="Enter" aria-label="Send message"' + (draft.trim() ? '' : ' disabled') + '>' + I('send', 16) + '</button><button class="send-caret" data-act="send-menu" aria-label="Schedule for later" data-tip="Schedule for later">' + I('chevDown', 14) + '</button></div></div>' +
      '</div></div></div>';
  }
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.5) + 'px'; }
  function setupComposer(box, ctx) {
    if (!box) return;
    const ta = $('textarea', box); const ac = $('.ac-pop', box);
    box._ctx = ctx;
    autosize(ta);
    const updateSend = () => { const has = ta.value.trim().length > 0; $('.send-group', box).classList.toggle('disabled', !has); $('.send-btn', box).disabled = !has; };
    ta.addEventListener('input', () => { autosize(ta); state.drafts[box.dataset.draftKey] = ta.value; store.set('drafts', state.drafts); updateSend(); updateAutocomplete(box); });
    ta.addEventListener('keydown', (e) => onComposerKey(e, box));
    ta.addEventListener('blur', () => setTimeout(() => { if (!box.contains(document.activeElement)) ac.classList.remove('show'); }, 120));
    updateSend();
  }
  function composerWord(ta) {
    const pos = ta.selectionStart; const before = ta.value.slice(0, pos);
    const m = before.match(/(^|\s)([:@/][\w+\-]*)$/);
    if (!m) return null;
    const tok = m[2];
    if (tok[0] === '/' && before.trim() !== tok) return null;
    return { tok, start: pos - tok.length, end: pos };
  }
  function acItems(tok) {
    const q = tok.slice(1).toLowerCase();
    if (tok[0] === ':') { if (q.length < 2) return []; return D.EMOJI.filter((e) => e.name.includes(q)).slice(0, 8).map((e) => ({ kind: 'emoji', label: e.name, insert: ':' + e.name + ': ', emoji: e.ch })); }
    if (tok[0] === '@') return Object.values(D.users).filter((u) => !u.bot && (u.name.toLowerCase().includes(q) || (u.handle || '').includes(q))).slice(0, 8).map((u) => ({ kind: 'user', label: u.name, sub: u.title, insert: '@' + u.handle + ' ', user: u }));
    if (tok[0] === '/') return D.slashCommands.filter((c) => c.cmd.slice(1).startsWith(q)).map((c) => ({ kind: 'slash', label: c.cmd, args: c.args, sub: c.desc, insert: c.cmd + ' ' }));
    return [];
  }
  function updateAutocomplete(box) {
    const ta = $('textarea', box); const ac = $('.ac-pop', box);
    const w = composerWord(ta);
    const items = w ? acItems(w.tok) : [];
    if (!items.length) { ac.classList.remove('show'); ac.innerHTML = ''; box._ac = null; return; }
    box._ac = { items, idx: 0, word: w };
    const head = w.tok[0] === ':' ? 'Emoji matching “' + esc(w.tok.slice(1)) + '”' : w.tok[0] === '@' ? 'Members' : 'Shortcuts';
    ac.innerHTML = '<div class="ac-head">' + head + '</div>' + items.map((it, i) => '<button class="ac-item' + (i === 0 ? ' active' : '') + '" role="option" data-act="ac-pick" data-idx="' + i + '" aria-selected="' + (i === 0) + '">' + (it.kind === 'emoji' ? '<span class="ac-emoji">' + it.emoji + '</span><span class="ac-name">:' + esc(it.label) + ':</span>' : it.kind === 'user' ? avatar(it.user, 20, { presence: true, click: false }) + '<span class="ac-name">' + esc(it.label) + '</span><span class="ac-sub">' + esc(it.sub) + '</span>' : '<span class="ac-emoji">' + I('slash', 16) + '</span><span class="ac-name">' + esc(it.label) + '</span><span class="ac-args">' + esc(it.args) + '</span><span class="ac-desc muted-text">' + esc(it.sub) + '</span>') + '</button>').join('');
    ac.classList.add('show');
  }
  function acPick(box, idx) {
    const ta = $('textarea', box); const a = box._ac; if (!a) return;
    const it = a.items[idx == null ? a.idx : idx];
    ta.value = ta.value.slice(0, a.word.start) + it.insert + ta.value.slice(a.word.end);
    const pos = a.word.start + it.insert.length; ta.setSelectionRange(pos, pos);
    $('.ac-pop', box).classList.remove('show'); box._ac = null;
    ta.dispatchEvent(new Event('input')); ta.focus();
    if (it.kind === 'emoji') bumpFrequent(it.label);
  }
  function onComposerKey(e, box) {
    const ta = e.target; const a = box._ac;
    if (a && $('.ac-pop', box).classList.contains('show')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); a.idx = (a.idx + (e.key === 'ArrowDown' ? 1 : a.items.length - 1)) % a.items.length; $$('.ac-item', box).forEach((el, i) => { el.classList.toggle('active', i === a.idx); el.setAttribute('aria-selected', i === a.idx); if (i === a.idx) el.scrollIntoView({ block: 'nearest' }); }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acPick(box); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('.ac-pop', box).classList.remove('show'); box._ac = null; return; }
    }
    if (modKey(e) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b' && !e.shiftKey) { e.preventDefault(); applyFmt(ta, 'bold'); return; }
      if (k === 'i' && !e.shiftKey) { e.preventDefault(); applyFmt(ta, 'italic'); return; }
      if (k === 'x' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'strike'); return; }
      if (k === 'u' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'link'); return; }
      if (k === 'c' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'code'); return; }
      if (k === '7' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'ol'); return; }
      if (k === '8' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'ul'); return; }
      if (k === '9' && e.shiftKey) { e.preventDefault(); applyFmt(ta, 'quote'); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing) {
      if (state.prefs.sendWithEnter || modKey(e)) { e.preventDefault(); sendFromComposer(box); }
      return;
    }
    if (e.key === 'ArrowUp' && !ta.value && box.dataset.kind === 'main') {
      const mine = msgs(state.conv).filter((m) => m.user === D.me && !m.type);
      if (mine.length) { e.preventDefault(); startEdit(mine[mine.length - 1].id); }
    }
    if (e.key === 'Escape' && box.dataset.kind === 'edit') { e.preventDefault(); e.stopPropagation(); state.editing = null; refreshMessages(); }
  }
  function applyFmt(ta, fmt) {
    const s = ta.selectionStart, en = ta.selectionEnd; const sel = ta.value.slice(s, en);
    const wrap = (l, r) => { r = r == null ? l : r; const ins = l + (sel || '') + r; ta.setRangeText(ins, s, en, 'end'); if (!sel) ta.setSelectionRange(s + l.length, s + l.length); else ta.setSelectionRange(s + l.length, s + l.length + sel.length); };
    const linePrefix = (p) => { const ls = ta.value.lastIndexOf('\n', s - 1) + 1; const lines = ta.value.slice(ls, en).split('\n'); const out = lines.map((ln, i) => (typeof p === 'function' ? p(i) : p) + ln).join('\n'); ta.setRangeText(out, ls, en, 'end'); };
    if (fmt === 'bold') wrap('*'); else if (fmt === 'italic') wrap('_'); else if (fmt === 'strike') wrap('~'); else if (fmt === 'code') wrap('`'); else if (fmt === 'codeBlock') wrap('```\n', '\n```'); else if (fmt === 'ul') linePrefix('• '); else if (fmt === 'ol') linePrefix((i) => (i + 1) + '. '); else if (fmt === 'quote') linePrefix('> ');
    else if (fmt === 'link') { const ins = '<https://|' + (sel || 'link text') + '>'; ta.setRangeText(ins, s, en, 'end'); ta.setSelectionRange(s + 1, s + 9); }
    ta.dispatchEvent(new Event('input')); ta.focus();
  }
  function insertAtCursor(ta, text) { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(text, s, e, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); }
  function sendFromComposer(box) {
    const ta = $('textarea', box); const text = ta.value.replace(/\s+$/, ''); if (!text.trim()) return;
    const ctx = box._ctx;
    if (text.startsWith('/')) { if (runSlash(text, ctx)) { ta.value = ''; delete state.drafts[box.dataset.draftKey]; store.set('drafts', state.drafts); ta.dispatchEvent(new Event('input')); return; } }
    const also = $('.also-send-cb', box); const alsoSend = also && also.checked;
    const m = { id: uid('m'), user: D.me, ts: Date.now(), text, reactions: [], replies: [], attachments: [] };
    if (text.toLowerCase().includes('@channel') || Math.random() < 0) m.text = text;
    if (ctx.threadId) {
      const f = findMsg(ctx.threadId); if (!f) return;
      f.msg.replies.push(m);
      if (alsoSend) { msgs(ctx.convId).push(Object.assign({}, m, { id: uid('m'), replies: [], text: text })); }
      if (also) also.checked = false;
      renderRPanel(); refreshMessages(alsoSend); refreshSidebar();
      const nb = $('#rpanel .composer textarea'); if (nb) nb.focus();
    } else {
      msgs(ctx.convId).push(m);
      state.lastRead[ctx.convId] = m.ts;
      refreshMessages(true); refreshSidebar();
      ta.value = ''; ta.dispatchEvent(new Event('input')); ta.focus();
      simulateReply(ctx.convId, m);
    }
    delete state.drafts[box.dataset.draftKey]; store.set('drafts', state.drafts);
    if (ctx.threadId) { const nb = $('#rpanel .composer textarea'); if (nb) { nb.value = ''; nb.dispatchEvent(new Event('input')); } }
    announce('Message sent');
  }
  function runSlash(text, ctx) {
    const [cmd, ...rest] = text.split(/\s+/); const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case '/status': if (!arg) openStatusModal(); else { const em = arg.match(/^:([a-z0-9_+\-]+):\s*(.*)$/); state.status = em && emojiOf(em[1]) ? { emoji: emojiOf(em[1]), text: em[2] || '', until: 'Today' } : { emoji: '💬', text: arg, until: 'Today' }; toast('Status updated'); renderAll(); } return true;
      case '/remind': postSystem(ctx.convId, 'Reminder set' + (arg ? ': “' + arg + '”' : '') + '. Slackbot will remind you.', 'bell'); toast('Reminder set', { icon: 'bell' }); return true;
      case '/shrug': { const m = { id: uid('m'), user: D.me, ts: Date.now(), text: (arg ? arg + ' ' : '') + '¯\\_(ツ)_/¯', reactions: [], replies: [], attachments: [] }; if (ctx.threadId) { const f = findMsg(ctx.threadId); f.msg.replies.push(m); renderRPanel(); refreshMessages(); } else { msgs(ctx.convId).push(m); refreshMessages(true); } return true; }
      case '/away': state.presence = state.presence === 'active' ? 'away' : 'active'; toast(state.presence === 'away' ? 'You are now away' : 'You are now active'); renderAll(); return true;
      case '/dnd': state.paused = arg || '1 hour'; toast('Notifications paused for ' + state.paused, { icon: 'bellOff' }); renderAll(); return true;
      case '/giphy': { const m = { id: uid('m'), user: D.me, ts: Date.now(), text: '', reactions: [], replies: [], attachments: [{ type: 'gif', caption: arg || 'random', gradient: 'linear-gradient(135deg,#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + ',#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + ')' }] }; msgs(ctx.convId).push(m); refreshMessages(true); return true; }
      case '/huddle': if (!state.huddle) startHuddle(ctx.convId); return true;
      case '/mute': actions.mute({ dataset: { conv: ctx.convId } }); return true;
      case '/topic': { const c = conv(ctx.convId); if (c.type === 'channel') { c.topic = arg; postSystem(ctx.convId, 'You set the channel topic: ' + arg, 'edit'); renderMain(); } return true; }
      case '/collapse': toast('All images collapsed'); return true;
      default: toast(cmd + ' is not a recognized command'); return true;
    }
  }
  function postSystem(convId, text, kind) {
    msgs(convId).push({ id: uid('m'), user: D.me, ts: Date.now(), type: 'system', systemKind: kind, text, reactions: [], replies: [], attachments: [] });
    if (convId === state.conv) refreshMessages(true);
  }
  function startEdit(id) { state.editing = id; refreshMessages(); const ed = $('#msg-editor textarea'); if (ed) { ed.dataset.kind = 'edit'; autosize(ed); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); ed.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); actions['edit-save']({ dataset: { msg: id } }); } if (e.key === 'Escape') { e.stopPropagation(); state.editing = null; refreshMessages(); } }); ed.addEventListener('input', () => autosize(ed)); } }

  /* ------------------------------------------------------------------
     Emoji picker
  ------------------------------------------------------------------ */
  const SKINS = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
  const CAT_ICONS = { Frequent: 'clock', 'Smileys & Emotion': 'emoji', 'People & Body': 'people', 'Animals & Nature': 'leaf', 'Food & Drink': 'coffee', Activities: 'ball', 'Travel & Places': 'plane', Objects: 'bulb', Symbols: 'symbols', Flags: 'flag' };
  ICONS.bulb = '<path d="M7 14.5h6M8 17h4M10 2.5a5 5 0 0 1 3 9c-.6.5-1 1.2-1 2v1H8v-1c0-.8-.4-1.5-1-2a5 5 0 0 1 3-9z"/>';
  function bumpFrequent(name) { state.frequent = [name].concat(state.frequent.filter((n) => n !== name)).slice(0, 27); store.set('frequent', state.frequent); }
  function emojiPicker(anchor, onPick, opts) {
    opts = opts || {};
    const cats = ['Frequent'].concat(D.EMOJI_CATEGORIES);
    const grid = (q) => {
      q = (q || '').trim().toLowerCase();
      if (q) { const res = D.EMOJI.filter((e) => e.name.includes(q)); return res.length ? '<div class="ep-cat">Search results</div><div class="ep-row">' + res.slice(0, 90).map(eBtn).join('') + '</div>' : '<div class="ep-empty">No emoji found for “' + esc(q) + '”</div>'; }
      return cats.map((c) => { const list = c === 'Frequent' ? state.frequent.map((n) => D.EMOJI_BY_NAME[n]).filter(Boolean) : D.EMOJI.filter((e) => e.cat === c); return '<div class="ep-cat" data-cat="' + attr(c) + '">' + esc(c === 'Frequent' ? 'Frequently used' : c) + '</div><div class="ep-row">' + list.map(eBtn).join('') + '</div>'; }).join('');
    };
    const eBtn = (e) => '<button class="ep-e" data-name="' + attr(e.name) + '" aria-label="' + attr(e.name) + '">' + e.ch + '</button>';
    const html = '<div class="ep-search"><div class="field">' + I('search', 16) + '<input placeholder="Search all emoji" aria-label="Search emoji"></div><button class="skin-btn" data-tip="Skin tone" aria-label="Skin tone">' + (state.skin ? '✋' + state.skin : '✋') + '</button></div><div class="ep-tabs" role="tablist">' + cats.map((c, i) => '<button class="ep-tab' + (i === 0 ? ' active' : '') + '" role="tab" data-cat="' + attr(c) + '" data-tip="' + attr(c) + '" aria-label="' + attr(c) + '">' + I(CAT_ICONS[c] || 'dot', 16) + '</button>').join('') + '</div><div class="ep-grid scroll">' + grid('') + '</div><div class="ep-foot"><span class="ep-prev">😀</span><div><div class="ep-prev-name">Pick an emoji</div><div class="ep-prev-code">:grinning:</div></div></div>';
    popover(anchor, html, { cls: 'emoji-picker', place: opts.place || 'above', align: opts.align || 'end', role: 'dialog', init(el) {
      const inp = $('input', el); const g = $('.ep-grid', el);
      inp.addEventListener('input', () => { g.innerHTML = grid(inp.value); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = $('.ep-e', g); if (first) first.click(); } });
      g.addEventListener('mouseover', (e) => { const b = e.target.closest('.ep-e'); if (!b) return; $('.ep-prev', el).textContent = b.textContent; $('.ep-prev-name', el).textContent = b.dataset.name.replace(/_/g, ' '); $('.ep-prev-code', el).textContent = ':' + b.dataset.name + ':'; });
      g.addEventListener('click', (e) => { const b = e.target.closest('.ep-e'); if (!b) return; const em = D.EMOJI_BY_NAME[b.dataset.name]; bumpFrequent(em.name); const ch = state.skin && em.cat === 'People & Body' && !/[\u{1F3FB}-\u{1F3FF}]/u.test(em.ch) ? em.ch + state.skin : em.ch; onPick(ch, em); if (!opts.keepOpen) closePopovers(); });
      $$('.ep-tab', el).forEach((t) => t.addEventListener('click', () => { $$('.ep-tab', el).forEach((x) => x.classList.remove('active')); t.classList.add('active'); inp.value = ''; g.innerHTML = grid(''); const cat = $('.ep-cat[data-cat="' + t.dataset.cat.replace(/"/g, '\\"') + '"]', g); if (cat) g.scrollTop = cat.offsetTop - g.offsetTop; }));
      g.addEventListener('scroll', () => { const cats2 = $$('.ep-cat', g); let cur = cats2[0]; cats2.forEach((c) => { if (c.offsetTop - g.offsetTop <= g.scrollTop + 4) cur = c; }); if (cur) $$('.ep-tab', el).forEach((t) => t.classList.toggle('active', t.dataset.cat === cur.dataset.cat)); });
      $('.skin-btn', el).addEventListener('click', (e) => { e.stopPropagation(); popover(e.currentTarget, '<div class="skin-pop">' + SKINS.map((s) => '<button data-skin="' + s + '" aria-label="Skin tone">✋' + s + '</button>').join('') + '</div>', { stack: true, place: 'below', align: 'end', init(sp) { sp.addEventListener('click', (ev) => { const b = ev.target.closest('[data-skin]'); if (!b) return; state.skin = b.dataset.skin; store.set('skin', state.skin); $('.skin-btn', el).textContent = '✋' + state.skin; closePopovers(popovers[0]); }); } }); });
    } });
  }

  /* ------------------------------------------------------------------
     Quick switcher
  ------------------------------------------------------------------ */
  function fuzzy(q, s) { q = q.toLowerCase(); s = s.toLowerCase(); if (s.includes(q)) return s.indexOf(q) === 0 ? 3 : 2; let i = 0; for (const ch of s) { if (ch === q[i]) i++; if (i === q.length) return 1; } return 0; }
  function quickSwitcher(initial) {
    const recent = state.history.slice().reverse().filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
    const build = (q) => {
      let items;
      if (!q) items = recent.map((id) => ({ conv: conv(id) })).filter((x) => x.conv);
      else {
        items = convs().map((c) => ({ conv: c, score: fuzzy(q, c.type === 'channel' ? c.name : convName(c)) })).filter((x) => x.score > 0);
        Object.values(D.users).filter((u) => !u.bot && u.id !== D.me).forEach((u) => { const sc = fuzzy(q, u.name); if (sc > 0 && !D.dms.some((d) => d.members.length === 2 && d.members.includes(u.id))) items.push({ user: u, score: sc }); });
        items.sort((a, b) => b.score - a.score);
      }
      return items.slice(0, 12);
    };
    const row = (it, i, active) => {
      if (it.user) return '<button class="qs-item' + (active ? ' active' : '') + '" data-idx="' + i + '" role="option">' + avatar(it.user, 20, { presence: true, click: false }) + '<span class="qs-name">' + esc(it.user.name) + '</span><span class="qs-sub">' + esc(it.user.title) + '</span></button>';
      const c = it.conv;
      const ico = c.type === 'channel' ? '<span class="qs-ico">' + I(c.private ? 'lock' : 'hash', 16) + '</span>' : c.self ? avatar(me(), 20, { presence: true, click: false }) : c.members.length > 2 ? '<span class="qs-ico">' + I('people', 16) + '</span>' : avatar(user(dmOther(c)[0]), 20, { presence: true, click: false });
      return '<button class="qs-item' + (active ? ' active' : '') + '" data-idx="' + i + '" role="option">' + ico + '<span class="qs-name">' + esc(convName(c)) + '</span>' + (c.type === 'channel' && c.topic ? '<span class="qs-sub">' + esc(c.topic) + '</span>' : '') + (unreadCount(c.id) ? '<span class="qs-right">' + unreadCount(c.id) + ' unread</span>' : '') + '</button>';
    };
    let items = build(initial || ''); let idx = 0;
    modal('<div class="qs-input-wrap">' + I('search', 20) + '<input id="qs-input" placeholder="Find channels, DMs, people…" aria-label="Quick switcher" autocomplete="off" value="' + attr(initial || '') + '"></div><div class="qs-label" id="qs-label">' + (initial ? 'Results' : 'Recent') + '</div><div class="qs-list" id="qs-list" role="listbox"></div><div class="qs-foot"><span>' + kbd('↑') + kbd('↓') + ' to navigate</span><span>' + kbd('↵') + ' to open</span><span>' + kbd('esc') + ' to dismiss</span><span style="margin-left:auto">Tip: type <b>#</b> for channels, <b>@</b> for people</span></div>', { cls: 'qs-modal', label: 'Quick switcher', init(box, m) {
      const inp = $('#qs-input', box); const list = $('#qs-list', box);
      const paint = () => { list.innerHTML = items.map((it, i) => row(it, i, i === idx)).join('') || '<div class="empty-state" style="padding:24px"><p>No matches</p></div>'; $('#qs-label', box).textContent = inp.value ? 'Results' : 'Recent'; };
      const go = () => { const it = items[idx]; if (!it) return; closeModal(m); if (it.user) openDMWith(it.user.id); else openConv(it.conv.id); };
      inp.addEventListener('input', () => { items = build(inp.value.replace(/^[#@]/, '')); idx = 0; paint(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % Math.max(1, items.length); paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % Math.max(1, items.length); paint(); } else if (e.key === 'Enter') { e.preventDefault(); go(); } });
      list.addEventListener('click', (e) => { const b = e.target.closest('.qs-item'); if (!b) return; idx = +b.dataset.idx; go(); });
      paint();
    } });
  }
  function openDMWith(userId) {
    let dm = D.dms.find((d) => d.members.length === 2 && d.members.includes(userId));
    if (!dm) { dm = { id: 'd_' + userId, type: 'dm', members: [D.me, userId] }; D.dms.push(dm); D.messages[dm.id] = []; state.lastRead[dm.id] = Date.now(); }
    if (state.view !== 'dms' && state.view !== 'home') state.view = 'home';
    openConv(dm.id);
  }

  /* ------------------------------------------------------------------
     Modals: status, preferences, shortcuts, channel details, forward, etc.
  ------------------------------------------------------------------ */
  function openStatusModal() {
    const cur = state.status || { emoji: '', text: '', until: '' };
    const suggestions = [['📅', 'In a meeting', '1 hour'], ['🚌', 'Commuting', '30 minutes'], ['🤒', 'Out sick', 'Today'], ['🌴', 'Vacationing', 'Don’t clear'], ['🏠', 'Working remotely', 'Today']];
    modal(modalHead('Set a status') + '<div class="modal-body"><div class="status-row"><button class="emoji-pick" id="st-emoji" aria-label="Choose emoji">' + (cur.emoji || I('emoji', 22)) + '</button><input class="text-input" id="st-text" autofocus placeholder="What’s your status?" maxlength="100" value="' + attr(cur.text) + '"></div>' + (state.status ? '' : '<h3 style="margin-top:20px">For ' + esc(D.workspace.name) + '</h3>' + suggestions.map((s) => '<button class="suggest-status" data-emoji="' + s[0] + '" data-text="' + attr(s[1]) + '" data-until="' + attr(s[2]) + '"><span style="font-size:20px">' + s[0] + '</span><span>' + esc(s[1]) + '</span><span class="ss-sub">' + esc(s[2]) + '</span></button>').join('')) + '<h3 style="margin-top:20px">Remove status after…</h3><select class="select" id="st-until"><option' + (cur.until === 'Don’t clear' ? ' selected' : '') + '>Don’t clear</option><option' + (cur.until === '30 minutes' ? ' selected' : '') + '>30 minutes</option><option' + (cur.until === '1 hour' ? ' selected' : '') + '>1 hour</option><option' + (cur.until === '4 hours' ? ' selected' : '') + '>4 hours</option><option' + (!cur.until || cur.until === 'Today' ? ' selected' : '') + '>Today</option><option' + (cur.until === 'This week' ? ' selected' : '') + '>This week</option></select><div class="field-row" style="margin-top:12px"><label><input type="checkbox" id="st-pause"> <span><span class="fr-label">Pause notifications</span><span class="fr-sub" style="display:block">Until the status is cleared</span></span></label></div></div><div class="modal-foot space"><button class="btn outline" id="st-clear"' + (state.status ? '' : ' style="visibility:hidden"') + '>Clear status</button><div style="display:flex;gap:12px"><button class="btn outline" data-act="modal-close">Cancel</button><button class="btn primary" id="st-save">Save</button></div></div>', { label: 'Set a status', init(box, m) {
      let emoji = cur.emoji;
      $('#st-emoji', box).addEventListener('click', (e) => emojiPicker(e.currentTarget, (ch) => { emoji = ch; $('#st-emoji', box).textContent = ch; }, { place: 'below', align: 'start' }));
      $$('.suggest-status', box).forEach((b) => b.addEventListener('click', () => { emoji = b.dataset.emoji; $('#st-emoji', box).textContent = emoji; $('#st-text', box).value = b.dataset.text; const opt = Array.from($('#st-until', box).options).find((o) => o.text === b.dataset.until); if (opt) opt.selected = true; }));
      $('#st-save', box).addEventListener('click', () => { const text = $('#st-text', box).value.trim(); if (!text && !emoji) { state.status = null; } else state.status = { emoji: emoji || '💬', text, until: $('#st-until', box).value }; if ($('#st-pause', box).checked) state.paused = 'until status clears'; closeModal(m); renderAll(); toast(state.status ? 'Status set' : 'Status cleared'); });
      $('#st-clear', box).addEventListener('click', () => { state.status = null; closeModal(m); renderAll(); toast('Status cleared'); });
    } });
  }
  const SHORTCUTS = [
    ['Navigation', [['Quick switcher', MOD + ' K'], ['Search current channel', MOD + ' F'], ['Search everywhere', MOD + ' G'], ['Previous / next channel', ALT + ' ↑ | ' + ALT + ' ↓'], ['Previous / next unread channel', ALT + ' ' + SHIFT + ' ↑ | ↓'], ['Back / forward in history', MOD + ' [ | ' + MOD + ' ]'], ['All unreads', MOD + ' ' + SHIFT + ' A'], ['Threads', MOD + ' ' + SHIFT + ' T'], ['Direct messages', MOD + ' ' + SHIFT + ' K'], ['Activity', MOD + ' ' + SHIFT + ' M'], ['Saved items (Later)', MOD + ' ' + SHIFT + ' S'], ['Toggle right pane', MOD + ' .'], ['Close panel / modal', 'Esc']]],
    ['Messages & formatting', [['Send message', 'Enter'], ['New line', SHIFT + ' Enter'], ['Edit your last message', '↑', 'in an empty composer'], ['Bold', MOD + ' B'], ['Italic', MOD + ' I'], ['Strikethrough', MOD + ' ' + SHIFT + ' X'], ['Inline code', MOD + ' ' + SHIFT + ' C'], ['Link', MOD + ' ' + SHIFT + ' U'], ['Bulleted list', MOD + ' ' + SHIFT + ' 8'], ['Blockquote', MOD + ' ' + SHIFT + ' 9'], ['Emoji autocomplete', ':', 'then 2+ letters'], ['Mention autocomplete', '@'], ['Slash commands', '/']]],
    ['App', [['Keyboard shortcuts', MOD + ' /'], ['Toggle dark mode', MOD + ' ' + SHIFT + ' D'], ['Set a status', MOD + ' ' + SHIFT + ' Y'], ['Preferences', MOD + ' ,'], ['Start / leave huddle', MOD + ' ' + SHIFT + ' H'], ['Toggle sidebar (mobile)', MOD + ' ' + SHIFT + ' L']]],
  ];
  function openShortcutsModal() {
    modal(modalHead('Keyboard shortcuts') + '<div class="modal-body"><p class="muted">Shown for ' + (IS_MAC ? 'macOS' : 'Windows / Linux') + '. All of these work in this demo.</p>' + SHORTCUTS.map((g) => '<h3>' + esc(g[0]) + '</h3><div class="shortcut-grid">' + g[1].map((s) => '<div class="shortcut-row"><span>' + esc(s[0]) + (s[2] ? ' <span class="muted-text">' + esc(s[2]) + '</span>' : '') + '</span><span class="keys">' + s[1].split(' ').map((k) => k === '|' ? '<span class="muted-text" style="padding:0 2px">/</span>' : '<span class="kbd">' + esc(k) + '</span>').join('') + '</span></div>').join('') + '</div>').join('') + '</div>', { cls: 'wide', label: 'Keyboard shortcuts' });
  }
  const PREF_TABS = [['notifications', 'Notifications', 'bell'], ['navigation', 'Navigation', 'compass'], ['home', 'Home', 'home'], ['themes', 'Themes', 'sun'], ['messages', 'Messages & media', 'dms'], ['language', 'Language & region', 'lang'], ['accessibility', 'Accessibility', 'a11y'], ['markread', 'Mark as read', 'check'], ['audio', 'Audio & video', 'video'], ['privacy', 'Privacy & visibility', 'shield'], ['advanced', 'Advanced', 'sliders']];
  ICONS.compass = '<circle cx="10" cy="10" r="7.5"/><path d="m13 7-1.5 4.5L7 13l1.5-4.5z"/>';
  const THEMES = [['default', 'Aubergine', '#3F0E40', '#1164A3'], ['dark', 'Dark', '#19171D', '#1164A3'], ['ochin', 'Ochin', '#303E4D', '#6698C8'], ['workhard', 'Work Hard', '#4D394B', '#4C9689'], ['hoth', 'Hoth', '#F8F8FA', '#1164A3']];
  function prefToggle(key, label, sub, opts) { opts = opts || {}; const on = opts.value != null ? opts.value : !!state.prefs[key]; return '<div class="field-row"><label><input type="checkbox" data-pref="' + key + '"' + (on ? ' checked' : '') + (opts.value != null ? ' data-pref-value="' + attr(opts.value) + '"' : '') + '><span><span class="fr-label">' + esc(label) + '</span>' + (sub ? '<span class="fr-sub" style="display:block">' + esc(sub) + '</span>' : '') + '</span></label></div>'; }
  function prefRadio(key, val, label, sub) { return '<div class="field-row"><label><input type="radio" name="pref-' + key + '" data-pref="' + key + '" value="' + attr(val) + '"' + (state.prefs[key] === val ? ' checked' : '') + '><span><span class="fr-label">' + esc(label) + '</span>' + (sub ? '<span class="fr-sub" style="display:block">' + esc(sub) + '</span>' : '') + '</span></label></div>'; }
  function prefsBody(tab) {
    switch (tab) {
      case 'notifications': return '<h3>Notify me about…</h3>' + prefRadio('notifyAll', 'all', 'All new messages') + prefRadio('notifyAll', 'mentions', 'Direct messages, mentions & keywords') + prefRadio('notifyAll', 'none', 'Nothing') + '<h3>My keywords</h3><input class="text-input" placeholder="e.g. release, outage, Playset" value="release, SSO"><p class="muted">Show a badge in #channels when someone uses one of your keywords.</p><h3>Notification schedule</h3><div class="field-row"><select class="select"><option>Every day</option><option>Weekdays</option><option>Custom</option></select><select class="select" style="min-width:100px"><option>8:00 AM</option><option>9:00 AM</option></select><select class="select" style="min-width:100px"><option>6:00 PM</option><option>10:00 PM</option></select></div><h3>Sound & appearance</h3>' + prefToggle('sound', 'Play a sound when receiving a notification') + prefToggle('badge', 'Show a badge on the Home icon for unread mentions', 'Also used for the tab title') + '<div class="field-row"><label><span class="fr-label">Notification sound</span></label><select class="select" style="margin-left:auto"><option>Ding</option><option>Boing</option><option>Drop</option><option>Knock brush</option><option>Wow</option></select></div>';
      case 'navigation': return '<h3>Navigation bar</h3><p class="muted">Choose what shows in the navigation rail.</p>' + prefToggle('navHome', 'Home', null, { value: true }) + prefToggle('navDMs', 'DMs', null, { value: true }) + prefToggle('navActivity', 'Activity', null, { value: true }) + prefToggle('navLater', 'Later', null, { value: true }) + '<h3>Sidebar sort</h3>' + prefRadio('sidebarSort', 'alpha', 'Alphabetically') + prefRadio('sidebarSort', 'recent', 'By most recent activity');
      case 'home': return '<h3>Always show in the sidebar</h3>' + prefToggle('showUnreads', 'Unreads', null, { value: true }) + prefToggle('showThreads', 'Threads', null, { value: true }) + prefToggle('showDrafts', 'Drafts & sent', null, { value: true }) + '<h3>Show…</h3>' + prefRadio('sidebarShow', 'all', 'All your conversations') + prefRadio('sidebarShow', 'unreads', 'Unreads only') + prefRadio('sidebarShow', 'mentions', 'Mentions only') + prefToggle('sidebarUnreads', 'Show unread conversations at the top of sections');
      case 'themes': return '<h3>Color mode</h3><div class="field-row" style="gap:8px"><button class="btn ' + (state.theme === 'light' ? 'primary' : 'outline') + '" data-act="set-theme" data-theme="light">' + I('sun', 16) + 'Light</button><button class="btn ' + (state.theme === 'dark' ? 'primary' : 'outline') + '" data-act="set-theme" data-theme="dark">' + I('moon', 16) + 'Dark</button><button class="btn ' + (state.theme === 'system' ? 'primary' : 'outline') + '" data-act="set-theme" data-theme="system">' + I('settings', 16) + 'System</button></div><p class="muted">Toggle any time with ' + MOD + ' ' + SHIFT + ' D.</p><h3>Sidebar theme</h3><div class="theme-grid">' + THEMES.map((t) => '<button class="theme-card' + ((t[0] === 'dark' ? state.theme === 'dark' && state.sidebarTheme === 'default' : state.sidebarTheme === t[0] && (t[0] !== 'default' || state.theme !== 'dark')) ? ' active' : '') + '" data-act="set-sidebar-theme" data-st="' + t[0] + '"><span class="theme-preview" style="background:' + (t[0] === 'dark' ? '#1A1D21' : '#fff') + '"><span class="tp-sb" style="background:' + t[2] + '"><i style="background:' + t[3] + '"></i><i' + (t[0] === 'hoth' ? ' style="background:rgba(29,28,29,.2)"' : '') + '></i><i' + (t[0] === 'hoth' ? ' style="background:rgba(29,28,29,.2)"' : '') + '></i></span><span class="tp-main"><i style="background:' + (t[0] === 'dark' ? '#35373B' : '#DDD') + '"></i><i style="background:' + (t[0] === 'dark' ? '#35373B' : '#DDD') + '"></i></span></span><span class="theme-name">' + esc(t[1]) + (((t[0] === 'dark' && state.theme === 'dark') || (t[0] !== 'dark' && state.sidebarTheme === t[0] && state.theme !== 'dark')) ? I('check', 16) : '') + '</span></button>').join('') + '</div>';
      case 'messages': return '<h3>Theme</h3>' + prefRadio('density', 'clean', 'Clean', 'Easy to scan, more white space') + prefRadio('density', 'compact', 'Compact', 'Fit as many messages on screen as possible') + '<h3>Additional options</h3>' + prefToggle('typing', 'Display information about who is currently typing a message') + prefToggle('showFmt', 'Show the formatting toolbar in the composer') + prefToggle('sendWithEnter', 'Enter sends the message', 'When off, use ' + MOD + ' Enter to send') + prefToggle('bigEmoji', 'Show emoji at a larger size in emoji-only messages', null, { value: true }) + '<h3>Inline media & links</h3>' + prefToggle('unfurlLinks', 'Show website previews for links', null, { value: true }) + prefToggle('unfurlImages', 'Show images and files uploaded to Slack', null, { value: true }) + '<h3>Emoji</h3><div class="field-row"><label><span class="fr-label">Default skin tone</span></label><span style="margin-left:auto;font-size:20px">✋' + state.skin + '</span></div>';
      case 'language': return '<h3>Language</h3><select class="select" data-pref-select="language"><option value="en-US"' + (state.prefs.language === 'en-US' ? ' selected' : '') + '>English (US)</option><option value="en-GB"' + (state.prefs.language === 'en-GB' ? ' selected' : '') + '>English (UK)</option><option value="de">Deutsch</option><option value="es">Español</option><option value="fr">Français</option><option value="ja">日本語</option></select><h3>Time zone</h3><select class="select"><option>(UTC−08:00) Pacific Time</option><option>(UTC−05:00) Eastern Time</option><option>(UTC+01:00) Central European Time</option></select><h3>Time format</h3>' + prefRadio('timeFormat', '12', '12-hour clock (e.g. 2:30 PM)') + prefRadio('timeFormat', '24', '24-hour clock (e.g. 14:30)') + '<h3>Spelling</h3>' + prefToggle('spellcheck', 'Enable spellcheck on messages', null, { value: true });
      case 'accessibility': return '<h3>Animation</h3>' + prefToggle('reduceMotion', 'Reduce motion', 'Turn off animations and transitions throughout the app') + '<h3>Links</h3>' + prefToggle('underlineLinks', 'Underline links in messages') + '<h3>Keyboard</h3>' + prefToggle('kbdNav', 'Press ↑ to edit your last message', null, { value: true }) + prefToggle('kbdFocus', 'Show visible focus rings for keyboard navigation', null, { value: true }) + '<h3>Screen reader</h3>' + prefToggle('srAnnounce', 'Announce incoming messages', null, { value: true });
      case 'markread': return '<h3>When I view a channel</h3>' + prefRadio('markRead', 'onview', 'Start me where I left off, and mark the channel read') + prefRadio('markRead', 'newest', 'Start me at the newest message, and mark the channel read') + prefRadio('markRead', 'manual', 'Start me at the newest message, but leave unseen messages unread') + '<p class="muted">Use <b>Esc</b> to mark the current channel as read, and <b>' + SHIFT + ' Esc</b> to mark everything read.</p>';
      case 'audio': return '<h3>Microphone</h3><select class="select"><option>Default — MacBook Pro Microphone</option><option>External USB Mic</option></select><h3>Speaker</h3><select class="select"><option>Default — MacBook Pro Speakers</option><option>AirPods Pro</option></select><h3>Camera</h3><select class="select"><option>FaceTime HD Camera</option></select><h3>Huddles</h3>' + prefToggle('huddleMute', 'Mute my microphone when joining a huddle', null, { value: true }) + prefToggle('huddleCaptions', 'Show live captions', null, { value: false }) + prefToggle('huddleMusic', 'Play music while waiting', null, { value: true });
      case 'privacy': return '<h3>Contact information</h3><div class="field-row"><label><span class="fr-label">Who can see your email address</span></label><select class="select" style="margin-left:auto"><option>Everyone</option><option>Workspace members</option><option>Nobody</option></select></div><h3>Slack Connect</h3>' + prefToggle('connectDiscover', 'Let people in other organizations discover me by email', null, { value: true }) + '<h3>Activity</h3>' + prefToggle('typingVisible', 'Show others when I’m typing', null, { value: true }) + prefToggle('presenceVisible', 'Show my active status', null, { value: true });
      case 'advanced': return '<h3>Input options</h3>' + prefToggle('markdown', 'Format messages with markup', null, { value: true }) + prefToggle('emojiAutocomplete', 'Show emoji autocomplete when typing :', null, { value: true }) + '<h3>Search options</h3>' + prefToggle('searchExclude', 'Exclude muted channels from search', null, { value: false }) + '<h3>Other options</h3>' + prefToggle('hwAccel', 'Enable hardware acceleration', null, { value: true }) + prefToggle('spellRight', 'Send debug logs to Slack', null, { value: false }) + '<div class="field-row"><button class="btn outline" data-act="reset-app">Reset demo data & preferences</button></div>';
    }
    return '';
  }
  function openPreferences(tab) {
    tab = tab || 'notifications';
    modal(modalHead('Preferences') + '<div class="modal-split"><nav class="split-nav" aria-label="Preference sections">' + PREF_TABS.map((t) => '<button class="split-nav-item' + (t[0] === tab ? ' active' : '') + '" data-pref-tab="' + t[0] + '">' + I(t[2], 18) + esc(t[1]) + '</button>').join('') + '</nav><div class="split-body" id="pref-body">' + prefsBody(tab) + '</div></div>', { cls: 'wide', label: 'Preferences', init(box) {
      box.addEventListener('click', (e) => { const t = e.target.closest('[data-pref-tab]'); if (!t) return; tab = t.dataset.prefTab; $$('.split-nav-item', box).forEach((x) => x.classList.toggle('active', x === t)); $('#pref-body', box).innerHTML = prefsBody(tab); });
      box.addEventListener('change', (e) => { const el = e.target; if (el.dataset.pref && !el.dataset.prefValue) { state.prefs[el.dataset.pref] = el.type === 'checkbox' ? el.checked : el.value; store.set('prefs', state.prefs); applyPrefs(); if (['density', 'showFmt', 'timeFormat', 'sidebarSort', 'sendWithEnter'].includes(el.dataset.pref)) renderAll(); } if (el.dataset.prefSelect) { state.prefs[el.dataset.prefSelect] = el.value; store.set('prefs', state.prefs); } });
    } });
    window._rerenderPrefs = () => { const b = $('#pref-body'); if (b) b.innerHTML = prefsBody(tab); };
  }
  function openChannelDetails(tab) {
    const c = conv(state.conv); if (!c) return;
    const isCh = c.type === 'channel';
    tab = tab || 'about';
    const tabs = isCh ? [['about', 'About'], ['members', 'Members ' + c.members.length], ['integrations', 'Integrations'], ['settings', 'Settings']] : [['about', 'About'], ['members', 'Members ' + c.members.length]];
    const body = (t) => {
      if (t === 'about') return (isCh ? '<div class="detail-row"><div><div class="dr-label">Topic</div><div class="dr-sub">' + esc(c.topic || 'Add a topic') + '</div></div><button class="link-btn" data-act="edit-topic">Edit</button></div><div class="detail-row"><div><div class="dr-label">Description</div><div class="dr-sub">' + esc(c.description || 'Add a description') + '</div></div><button class="link-btn" data-act="edit-description">Edit</button></div><div class="detail-row"><div><div class="dr-label">Created by</div><div class="dr-sub">' + esc(user('u12').name) + ' on ' + fmtShortDate(c.created) + ', ' + new Date(c.created).getFullYear() + '</div></div></div><div class="detail-row" style="border:0"><button class="btn ghost" style="color:var(--danger);padding:0" data-act="toast" data-text="Left channel (demo)">Leave channel</button></div>' : '<div class="detail-row"><div><div class="dr-label">Members</div><div class="dr-sub">' + esc(c.members.map((m) => user(m).name).join(', ')) + '</div></div></div>') + '<div class="detail-row" style="border:0"><span class="muted-text">Channel ID: ' + esc(c.id.toUpperCase()) + '</span></div>';
      if (t === 'members') return '<div class="member-search"><div class="page-toolbar" style="margin:0"><div class="field" style="max-width:100%">' + I('search', 16) + '<input placeholder="Find members" aria-label="Find members" data-filter="members"></div><button class="btn primary sm" data-act="add-teammates">Add</button></div></div><div id="members">' + c.members.map((id) => { const u = user(id); return '<div class="member-row" data-search="' + attr(u.name + ' ' + u.title) + '">' + avatar(u, 36, { presence: true }) + '<div><div class="mr-name">' + esc(u.name) + (id === D.me ? ' <span class="muted-text">(you)</span>' : '') + '</div><div class="mr-sub">' + esc(u.title) + '</div></div><span class="mr-right">' + (presenceOf(u) === 'active' ? 'Active' : presenceOf(u) === 'dnd' ? 'Paused' : 'Away') + '</span></div>'; }).join('') + '</div>';
      if (t === 'integrations') return '<h3>Apps</h3>' + ((c.integrations || []).length ? c.integrations.map((b) => '<div class="integration-row">' + avatar(user(b), 36) + '<div><div class="ir-name">' + esc(user(b).name) + '</div><div class="ir-sub">Posts updates to this channel</div></div><button class="btn outline sm" style="margin-left:auto" data-act="toast" data-text="App configuration opened">Configure</button></div>').join('') : '<p class="muted">No apps in this channel yet.</p>') + '<div class="field-row"><button class="btn outline sm" data-act="add-app">' + I('plus', 16) + 'Add an app</button></div><h3>Workflows</h3>' + D.workflows.filter((w) => w.trigger.toLowerCase().includes(c.name)).map((w) => '<div class="integration-row"><span class="avatar sz-36" style="background:var(--bg-3);color:var(--text-2)">' + I('workflows', 18) + '</span><div><div class="ir-name">' + esc(w.name) + '</div><div class="ir-sub">' + esc(w.trigger) + ' · ' + w.runs + ' runs</div></div></div>').join('') + '<div class="field-row"><button class="btn outline sm" data-act="toast" data-text="Workflow builder opened">' + I('plus', 16) + 'Add a workflow</button></div>';
      if (t === 'settings') return '<div class="detail-row"><div><div class="dr-label">Channel name</div><div class="dr-sub">#' + esc(c.name) + '</div></div><button class="link-btn" data-act="toast" data-text="Rename is disabled in the demo">Edit</button></div><div class="detail-row"><div><div class="dr-label">Notifications</div><div class="dr-sub">' + (state.muted[c.id] ? 'Muted' : 'Mentions only') + '</div></div><button class="link-btn" data-act="mute" data-conv="' + c.id + '">' + (state.muted[c.id] ? 'Unmute' : 'Mute') + '</button></div><div class="detail-row"><div><div class="dr-label">Huddles</div><div class="dr-sub">Anyone can start a huddle in this channel</div></div><button class="link-btn" data-act="toast" data-text="Saved">Change</button></div><div class="detail-row"><div><div class="dr-label">Posting permissions</div><div class="dr-sub">' + (c.id === 'c_announcements' ? 'Only workspace admins can post' : 'Everyone can post') + '</div></div><button class="link-btn" data-act="toast" data-text="Saved">Change</button></div><div class="detail-row"><div><div class="dr-label">' + (c.private ? 'Change to a public channel' : 'Change to a private channel') + '</div><div class="dr-sub">' + (c.private ? 'Anyone in the workspace will be able to join.' : 'Only invited people can view or join.') + '</div></div><button class="link-btn" data-act="toast" data-text="Privacy change is disabled in the demo">Change</button></div><div class="detail-row" style="border:0"><div><div class="dr-label" style="color:var(--danger)">Archive channel for everyone</div><div class="dr-sub">Members won’t be able to send messages.</div></div><button class="link-btn" style="color:var(--danger)" data-act="toast" data-text="Archive is disabled in the demo">Archive</button></div>';
      return '';
    };
    modal(modalHead((isCh ? I(c.private ? 'lock' : 'hash', 22) : '') + '<span>' + esc(convName(c)) + '</span>', { extra: isCh ? '<button class="icon-btn' + (state.starred[c.id] ? ' on' : '') + '" data-act="star" data-conv="' + c.id + '" data-tip="Star" aria-label="Star channel">' + I(state.starred[c.id] ? 'starFill' : 'star', 18) + '</button>' : '' }) + '<div class="modal-tabs" role="tablist">' + tabs.map((t) => '<button class="modal-tab' + (t[0] === tab ? ' active' : '') + '" role="tab" data-ctab="' + t[0] + '">' + esc(t[1]) + '</button>').join('') + '</div><div class="modal-body" id="cd-body" style="padding-top:12px">' + body(tab) + '</div>', { cls: 'lg', label: 'Channel details', init(box) {
      box.addEventListener('click', (e) => { const t = e.target.closest('[data-ctab]'); if (!t) return; tab = t.dataset.ctab; $$('.modal-tab', box).forEach((x) => x.classList.toggle('active', x === t)); $('#cd-body', box).innerHTML = body(tab); });
    } });
  }
  function openForwardModal(msgId) {
    const f = findMsg(msgId); if (!f) return;
    modal(modalHead('Forward this message') + '<div class="modal-body"><input class="text-input" id="fw-to" placeholder="Search for channel or person" autofocus><div id="fw-list" style="margin:8px 0;max-height:180px;overflow:auto"></div><textarea class="text-input" placeholder="Add a message, if you’d like." rows="2"></textarea><div style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:8px 12px 8px 0">' + renderMessage(f.msg, { convId: f.convId, forceHead: true, inThread: true }).replace(/<div class="msg-actions".*$/, '</div>') + '</div></div><div class="modal-foot"><button class="btn outline" data-act="modal-close">Cancel</button><button class="btn primary" id="fw-send" disabled>Forward</button></div>', { label: 'Forward message', init(box, m) {
      let target = null;
      const list = $('#fw-list', box); const inp = $('#fw-to', box);
      const paint = () => { const q = inp.value.toLowerCase(); list.innerHTML = convs().filter((c) => c.id !== f.convId && convName(c).toLowerCase().includes(q)).slice(0, 8).map((c) => '<button class="qs-item' + (target === c.id ? ' active' : '') + '" data-id="' + c.id + '"><span class="qs-ico">' + (c.type === 'channel' ? I(c.private ? 'lock' : 'hash', 16) : I('dms', 16)) + '</span><span class="qs-name">' + esc(convName(c)) + '</span></button>').join(''); };
      inp.addEventListener('input', paint);
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; target = b.dataset.id; inp.value = convName(conv(target)); paint(); $('#fw-send', box).disabled = false; });
      $('#fw-send', box).addEventListener('click', () => { const note = $('textarea', box).value.trim(); const fwd = Object.assign({}, f.msg, { id: uid('m'), user: D.me, ts: Date.now(), text: (note ? note + '\n' : '') + '> ' + (f.msg.text || '').split('\n').join('\n> ') + '\n_— forwarded from ' + user(f.msg.user).name + ' in ' + (conv(f.convId).type === 'channel' ? '#' + conv(f.convId).name : 'a direct message') + '_', replies: [], reactions: [], attachments: f.msg.attachments.slice() }); msgs(target).push(fwd); closeModal(m); toast('Message forwarded to ' + convName(conv(target)), { icon: 'forward', action: { label: 'View', act: 'open-' + target } }); refreshSidebar(); if (target === state.conv) refreshMessages(true); });
      paint();
    } });
  }
  function confirmModal(title, text, okLabel, onOk, danger) {
    modal(modalHead(esc(title)) + '<div class="modal-body"><p style="margin:0 0 8px">' + text + '</p></div><div class="modal-foot"><button class="btn outline" data-act="modal-close">Cancel</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="cf-ok">' + esc(okLabel) + '</button></div>', { cls: 'sm', label: title, init(box, m) { $('#cf-ok', box).addEventListener('click', () => { closeModal(m); onOk(); }); } });
  }
  function promptModal(title, label, value, onOk, opts) {
    opts = opts || {};
    modal(modalHead(esc(title)) + '<div class="modal-body"><label class="muted-text" style="display:block;margin-bottom:6px">' + esc(label) + '</label>' + (opts.multiline ? '<textarea class="text-input" id="pm-val" rows="3">' + esc(value || '') + '</textarea>' : '<input class="text-input" id="pm-val" value="' + attr(value || '') + '">') + (opts.help ? '<p class="muted">' + esc(opts.help) + '</p>' : '') + '</div><div class="modal-foot"><button class="btn outline" data-act="modal-close">Cancel</button><button class="btn primary" id="pm-ok">' + esc(opts.ok || 'Save') + '</button></div>', { cls: 'sm', label: title, init(box, m) { const ok = () => { closeModal(m); onOk($('#pm-val', box).value); }; $('#pm-ok', box).addEventListener('click', ok); $('#pm-val', box).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); ok(); } }); } });
  }

  /* ------------------------------------------------------------------
     Navigation & rendering orchestration
  ------------------------------------------------------------------ */
  function renderAll() {
    applyPrefs();
    renderTopbar(); renderRail(); renderSidebar(); renderMain(); renderRPanel();
    updateTitle();
    $('#app').classList.toggle('mobile-conv', state.mobileConv);
  }
  function refreshSidebar() { renderSidebar(); renderRail(); updateTitle(); }
  function updateTitle() { const n = totalBadge(); document.title = (n && state.prefs.badge ? '(' + n + ') ' : '') + D.workspace.name + ' - Slack'; }
  function applyPrefs() {
    const root = document.documentElement;
    root.setAttribute('data-density', state.prefs.density);
    root.setAttribute('data-reduce-motion', state.prefs.reduceMotion ? 'true' : 'false');
    root.setAttribute('data-underline-links', state.prefs.underlineLinks ? 'true' : 'false');
  }
  function setTheme(t) {
    if (t === 'system') { t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; store.set('theme', null); try { localStorage.removeItem('ss.theme'); } catch (e) { /* ignore */ } }
    else try { localStorage.setItem('ss.theme', t); } catch (e) { /* ignore */ }
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    if (window._rerenderPrefs) window._rerenderPrefs();
  }
  function setSidebarTheme(st) {
    if (st === 'dark') { setTheme('dark'); st = 'default'; }
    else if (state.theme === 'dark' && st !== 'default') setTheme('light');
    else if (st === 'default' && state.theme === 'dark') setTheme('light');
    state.sidebarTheme = st; store.set('sidebarTheme', st);
    if (st === 'default') document.documentElement.removeAttribute('data-sidebar'); else document.documentElement.setAttribute('data-sidebar', st);
    if (window._rerenderPrefs) window._rerenderPrefs();
  }
  let loadTimer = null;
  function openConv(id, opts) {
    opts = opts || {};
    const c = conv(id); if (!c) return;
    if (MORE_VIEWS.includes(state.view)) state.view = 'home';
    if (state.view === 'dms' && c.type === 'channel') state.view = 'home';
    if (state.conv !== id) {
      if (!opts.noHistory) { state.history = state.history.slice(0, state.histIdx + 1); state.history.push(id); if (state.history.length > 50) state.history.shift(); state.histIdx = state.history.length - 1; }
      state.channelTab = 'messages';
      state.editing = null;
      if (state.rpanel && (state.rpanel.type === 'thread' || state.rpanel.type === 'details' || state.rpanel.type === 'members') && state.rpanel.convId !== id && !opts.keepPanel) state.rpanel = null;
    }
    state.conv = id;
    state.newDividerAt[id] = unreadCount(id) ? state.lastRead[id] : null;
    state.mobileConv = true;
    state.sidebarOpen = false;
    state.loading = !opts.instant;
    clearTimeout(loadTimer);
    renderAll();
    const finish = () => { state.loading = false; const list = $('#msg-list'); if (list && state.conv === id) { refreshMessages(!opts.highlight, opts.highlight); if (opts.highlight) { const el = $('#msg-' + opts.highlight); if (el) el.scrollIntoView({ block: 'center' }); } } markRead(id); if (opts.focus !== false && window.innerWidth > 640) { const ta = $('#main .composer textarea'); if (ta && !ta.disabled) ta.focus({ preventScroll: true }); } };
    if (state.loading) loadTimer = setTimeout(finish, state.prefs.reduceMotion ? 150 : 600); else finish();
  }
  function markRead(id) { const l = msgs(id); if (l.length) state.lastRead[id] = Math.max(state.lastRead[id] || 0, l[l.length - 1].ts); refreshSidebar(); }
  function setView(v) {
    if (v === 'more') return;
    state.view = v;
    state.mobileConv = MORE_VIEWS.includes(v);
    state.sidebarOpen = false;
    if (v === 'dms' && conv(state.conv).type !== 'dm') { const first = D.dms.slice().sort((a, b) => lastTs(b.id) - lastTs(a.id))[0]; state.conv = first.id; state.newDividerAt[first.id] = unreadCount(first.id) ? state.lastRead[first.id] : null; }
    if (v === 'activity') { const items = activityItems(); if (items.length && !state.activitySel) { const a = items[0]; state.activitySel = a.type + ':' + a.m.id; state.conv = a.cid; state._highlight = a.m.id; } }
    if (v === 'later') { const items = laterItems().filter((x) => x.st === state.laterTab); if (items.length && !state.laterSel) { state.laterSel = items[0].m.id; state.conv = items[0].cid; state._highlight = items[0].m.id; } }
    renderAll();
    if (state._highlight) { const h = state._highlight; state._highlight = null; refreshMessages(false, h); }
    if (!MORE_VIEWS.includes(v)) markRead(state.conv);
  }
  function jumpTo(convId, msgId, parentId) {
    if (parentId) { openConv(convId, { keepPanel: true, highlight: parentId }); openPanel({ type: 'thread', msgId: parentId, convId }); setTimeout(() => { const el = $('#msg-' + msgId); if (el) { el.classList.add('highlight'); el.scrollIntoView({ block: 'center' }); } }, 50); }
    else openConv(convId, { keepPanel: true, highlight: msgId, instant: true });
  }
  function toggleReaction(msgId, emoji) {
    const f = findMsg(msgId); if (!f) return;
    const m = f.msg; let r = m.reactions.find((x) => x.emoji === emoji);
    if (!r) { r = { emoji, users: [] }; m.reactions.push(r); }
    const i = r.users.indexOf(D.me);
    if (i >= 0) r.users.splice(i, 1); else { r.users.push(D.me); const n = emojiName(emoji); if (n) bumpFrequent(n); }
    m.reactions = m.reactions.filter((x) => x.users.length);
    refreshMessages(); renderRPanel();
  }

  /* ------------------------------------------------------------------
     Huddle
  ------------------------------------------------------------------ */
  let huddleTimer = null;
  function startHuddle(convId, opts) {
    opts = opts || {};
    const c = conv(convId);
    const peers = c.members.filter((m) => m !== D.me && !user(m).bot).slice(0, 2);
    state.huddle = { convId, started: Date.now(), muted: false, video: !!opts.video, share: false, peers };
    postSystem(convId, 'You started a huddle', 'huddle_started');
    refreshSidebar(); renderMain();
    clearInterval(huddleTimer);
    huddleTimer = setInterval(() => { const t = $('#huddle-timer'); if (t) t.textContent = huddleTime(); }, 1000);
    announce('Huddle started');
  }
  function leaveHuddle() {
    if (!state.huddle) return;
    const mins = Math.max(1, Math.round((Date.now() - state.huddle.started) / 60000));
    const convId = state.huddle.convId;
    state.huddle = null; clearInterval(huddleTimer);
    postSystem(convId, 'Huddle ended · ' + mins + ' min', 'huddle_ended');
    refreshSidebar(); renderMain();
    toast('You left the huddle', { icon: 'headphones' });
  }

  /* ------------------------------------------------------------------
     Simulation: incoming messages, typing, replies
  ------------------------------------------------------------------ */
  const SIM_LINES = ['Anyone free for a quick review? :eyes:', 'Just pushed the fix, CI is running.', 'Can we move standup 15 min later tomorrow?', 'That’s a great point <@me>, let’s discuss in the thread.', 'Updated the doc with the latest numbers :chart_with_upwards_trend:', 'Reminder: demo at 3pm today!', 'lgtm :+1:', 'Heads up, staging will be down for 10 min.', 'Who has context on the billing webhook?', 'Merged! Thanks for the review :pray:', 'Coffee run, anyone want anything? :coffee:', '<@me> can you take a look when you have a sec?', 'This is looking really good :fire:', 'Filed #1451 for the flaky test.', 'New designs are up in Figma :art:'];
  const REPLY_LINES = ['Nice, thanks <@me>! :raised_hands:', 'Agreed :+1:', 'Good call. I’ll follow up in the thread.', 'Sounds good to me!', ':eyes: on it', 'Ha, love it.', 'Makes sense. Let’s ship it :ship:'];
  function scheduleSim() {
    setTimeout(() => {
      const candidates = D.channels.filter((c) => c.id !== state.conv && c.id !== 'c_announcements' && c.id !== 'c_ops');
      const c = candidates[Math.floor(Math.random() * candidates.length)];
      const humansIn = c.members.filter((m) => m !== D.me && !user(m).bot);
      const u = humansIn[Math.floor(Math.random() * humansIn.length)];
      const text = SIM_LINES[Math.floor(Math.random() * SIM_LINES.length)];
      const m = { id: uid('m'), user: u, ts: Date.now(), text, reactions: [], replies: [], attachments: [] };
      msgs(c.id).push(m);
      refreshSidebar();
      if (state.view === 'activity' && mentionsMe(m)) renderSidebar();
      announce('New message from ' + user(u).name + ' in #' + c.name);
      if (mentionsMe(m) && !state.paused && state.prefs.notifyAll !== 'none') toast(user(u).name + ' mentioned you in #' + c.name, { icon: 'bell', action: { label: 'View', act: 'open-' + c.id } });
      scheduleSim();
    }, 25000 + Math.random() * 15000);
  }
  function scheduleTyping() {
    setTimeout(() => {
      const busy = ['c_general', 'c_eng', 'c_random', 'c_rebuild'];
      if (state.prefs.typing && busy.includes(state.conv) && !state.typing) {
        const c = conv(state.conv); const ppl = c.members.filter((m) => m !== D.me && !user(m).bot);
        const u = user(ppl[Math.floor(Math.random() * ppl.length)]);
        showTyping(u.name.split(' ')[0], 2500 + Math.random() * 2500);
      }
      scheduleTyping();
    }, 12000 + Math.random() * 20000);
  }
  function showTyping(name, ms) {
    const el = $('#typing'); if (!el) return;
    state.typing = name;
    el.innerHTML = '<span class="dots"><i></i><i></i><i></i></span><span><b>' + esc(name) + '</b> is typing…</span>';
    setTimeout(() => { state.typing = null; const t = $('#typing'); if (t) t.innerHTML = ''; }, ms);
  }
  function simulateReply(convId, m) {
    if (convId !== 'c_general') return;
    const who = ['u1', 'u2', 'u4', 'u3'][Math.floor(Math.random() * 4)];
    setTimeout(() => { if (state.conv === convId && state.prefs.typing) showTyping(user(who).name.split(' ')[0], 2000); }, 1500);
    setTimeout(() => {
      const reply = { id: uid('m'), user: who, ts: Date.now(), text: REPLY_LINES[Math.floor(Math.random() * REPLY_LINES.length)], reactions: [], replies: [], attachments: [] };
      msgs(convId).push(reply);
      if (state.conv === convId) { state.typing = null; const t = $('#typing'); if (t) t.innerHTML = ''; refreshMessages(); markRead(convId); } else refreshSidebar();
      announce(user(who).name + ' replied in #general');
    }, 4000);
  }

  /* ------------------------------------------------------------------
     Actions (event delegation via data-act)
  ------------------------------------------------------------------ */
  const menuItem = (act, label, icon, opts) => { opts = opts || {}; return '<button class="menu-item' + (opts.danger ? ' danger' : '') + '" data-act="' + act + '" ' + Object.keys(opts.data || {}).map((k) => 'data-' + k + '="' + attr(opts.data[k]) + '"').join(' ') + ' role="menuitem">' + (icon ? I(icon, 18) : '') + '<span>' + label + (opts.sub ? '<span class="menu-sub">' + esc(opts.sub) + '</span>' : '') + '</span>' + (opts.kbd ? '<span class="menu-kbd">' + esc(opts.kbd) + '</span>' : '') + (opts.chev ? '<span class="menu-chev">' + I('chevRight', 16) + '</span>' : '') + '</button>'; };
  const actions = {
    'view': (el) => { if (el.dataset.view === 'more') { popover(el, '<div class="menu-label">More</div>' + MORE_ITEMS.map((m) => menuItem('view', esc(m.label), m.icon, { data: { view: m.id }, sub: m.sub })).join(''), { place: window.innerWidth <= 640 ? 'above' : 'right' }); return; } closePopovers(); setView(el.dataset.view); },
    'open': (el) => { closePopovers(); closeAllModals(); openConv(el.dataset.conv); },
    'jump': (el) => { jumpTo(el.dataset.conv, el.dataset.msg, el.dataset.parent || null); },
    'toggle-section': (el) => { const k = el.dataset.section; state.collapsed[k] = !state.collapsed[k]; store.set('collapsed', state.collapsed); renderSidebar(); },
    'section-menu': (el) => { const k = el.dataset.section; popover(el, '<div class="menu-label">' + esc(k) + '</div>' + menuItem('sort-section', 'Sort', 'sort', { data: { mode: 'alpha' }, sub: state.prefs.sidebarSort === 'alpha' ? 'Alphabetically' : 'Recent activity', chev: true }) + menuItem('toggle-unreads', 'Show', 'filter', { sub: state.unreadsOnly ? 'Unreads only' : 'All conversations', chev: true }) + '<div class="menu-sep"></div>' + menuItem('toggle-section', (state.collapsed[k] ? 'Expand' : 'Collapse') + ' section', 'chevDown', { data: { section: k } }) + menuItem('toast', 'Create new section', 'plus', { data: { text: 'Custom sections are not available in the demo' } }) + menuItem('toast', 'Manage sections', 'settings', { data: { text: 'Manage sections opened' } })); },
    'sort-section': () => { state.prefs.sidebarSort = state.prefs.sidebarSort === 'alpha' ? 'recent' : 'alpha'; store.set('prefs', state.prefs); closePopovers(); renderSidebar(); toast('Sorted ' + (state.prefs.sidebarSort === 'alpha' ? 'alphabetically' : 'by recent activity')); },
    'toggle-unreads': () => { state.unreadsOnly = !state.unreadsOnly; closePopovers(); renderSidebar(); },
    'open-threads': () => { closePopovers(); openPanel({ type: 'threads' }); },
    'drafts': () => { const keys = Object.keys(state.drafts).filter((k) => state.drafts[k] && state.drafts[k].trim()); popover($('#sidebar .sb-header'), '<div class="menu-label">Drafts</div>' + (keys.length ? keys.map((k) => { const cid = k.replace(/^thread:/, ''); const c = conv(cid) || conv(state.conv); return menuItem('open', esc(c ? convName(c) : k), 'compose', { data: { conv: c ? c.id : state.conv }, sub: state.drafts[k].slice(0, 60) }); }).join('') : '<div class="sb-empty" style="color:var(--text-2)">No drafts</div>'), { align: 'start' }); },
    'ws-menu': (el) => { popover(el, '<div class="menu-head"><span class="avatar sz-36" style="background:' + D.workspace.color + ';border-radius:8px">' + esc(D.workspace.initials) + '</span><div><div class="mh-name">' + esc(D.workspace.name) + '</div><div class="mh-sub">' + esc(D.workspace.domain) + '</div></div></div><div class="menu-sep"></div>' + menuItem('add-teammates', 'Invite people to ' + esc(D.workspace.name), 'userPlus') + menuItem('add-channel', 'Create a channel', 'hash') + '<div class="menu-sep"></div>' + menuItem('preferences', 'Preferences', 'settings', { kbd: MOD + ' ,' }) + menuItem('toast', 'Tools &amp; settings', 'sliders', { data: { text: 'Admin tools open in the browser' }, chev: true }) + '<div class="menu-sep"></div>' + menuItem('toast', 'Sign in to another workspace', 'plus', { data: { text: 'Sign-in flow is not part of the demo' } }) + menuItem('sign-out', 'Sign out of ' + esc(D.workspace.name), 'logout'), { align: 'start' }); },
    'switch-ws': (el) => toast('Switching workspaces is not available in this demo'),
    'add-ws': () => toast('Add a workspace: not available in this demo'),
    'new-message': () => { closePopovers(); quickSwitcher('@'); },
    'me-menu': (el) => openMeMenu(el),
    'add-channel': () => { closePopovers(); promptModal('Create a channel', 'Name', '', (name) => { name = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, ''); if (!name) return; const c = { id: 'c_' + name.replace(/-/g, '_') + '_' + Date.now().toString(36), name, type: 'channel', topic: '', description: '', members: ['me', 'u1', 'u2'], created: Date.now(), integrations: [] }; D.channels.push(c); D.messages[c.id] = []; state.lastRead[c.id] = Date.now(); postSystem(c.id, 'You created this channel'); openConv(c.id); toast('#' + name + ' created', { icon: 'hash' }); }, { help: 'Channels are where conversations happen around a topic. Use a name that is easy to find and understand.', ok: 'Create' }); },
    'add-teammates': () => { closePopovers(); closeAllModals(); promptModal('Invite people to ' + D.workspace.name, 'To:', '', (v) => toast(v.trim() ? 'Invitation sent to ' + v.trim() : 'No one invited'), { help: 'Enter email addresses separated by commas.', ok: 'Send' }); },
    'add-app': () => toast('App Directory is not part of this demo'),
    'open-app': (el) => openPanel({ type: 'profile', userId: el.dataset.user }),
    'close-dm': (el, e) => { e.stopPropagation(); toast('Conversation closed (still available via search)'); },
    'dm-tab': (el) => { state.dmTab = el.dataset.tab; renderSidebar(); },
    'activity-tab': (el) => { state.activityTab = el.dataset.tab; renderSidebar(); },
    'activity-filter': (el) => popover(el, menuItem('toast', 'Unread only', 'filter', { data: { text: 'Filter applied' } }) + menuItem('toast', 'Mentions only', 'at', { data: { text: 'Filter applied' } }), { align: 'end' }),
    'activity-open': (el) => { state.activitySel = el.dataset.key; state.mobileConv = true; jumpTo(el.dataset.conv, el.dataset.target, el.dataset.msg !== el.dataset.target ? el.dataset.msg : null); renderSidebar(); },
    'later-tab': (el) => { state.laterTab = el.dataset.tab; renderSidebar(); },
    'later-open': (el) => { state.laterSel = el.dataset.target; state.mobileConv = true; jumpTo(el.dataset.conv, el.dataset.target, el.dataset.msg !== el.dataset.target ? el.dataset.msg : null); renderSidebar(); },
    'later-new': () => promptModal('New reminder', 'Remind me about…', '', (v) => { if (!v.trim()) return; toast('Reminder saved for later', { icon: 'bell' }); }, { ok: 'Save' }),
    'later-state': (el) => { state.laterState[el.dataset.msg] = el.dataset.state; store.set('laterState', state.laterState); closePopovers(); renderSidebar(); toast(el.dataset.state === 'completed' ? 'Marked as completed' : el.dataset.state === 'archived' ? 'Archived' : 'Moved to In progress'); },
    'huddle-toggle': () => { if (state.huddle) leaveHuddle(); else startHuddle(state.conv); },
    'huddle-with': (el) => { closePanel(); openDMWith(el.dataset.user); setTimeout(() => startHuddle(state.conv), 700); },
    'huddle-menu': (el) => popover(el, menuItem('huddle-start', 'Start a huddle', 'headphones') + menuItem('huddle-start-video', 'Start a huddle with video', 'video') + '<div class="menu-sep"></div>' + menuItem('toast', 'Copy huddle link', 'link', { data: { text: 'Huddle link copied' } }) + menuItem('toast', 'Schedule a huddle', 'calendar', { data: { text: 'Calendar opened' } }), { align: 'end' }),
    'huddle-start': () => { closePopovers(); if (!state.huddle) startHuddle(state.conv); },
    'huddle-start-video': () => { closePopovers(); if (!state.huddle) startHuddle(state.conv, { video: true }); },
    'huddle-mute': () => { state.huddle.muted = !state.huddle.muted; renderSidebar(); },
    'huddle-video': () => { state.huddle.video = !state.huddle.video; renderSidebar(); },
    'huddle-share': () => { state.huddle.share = !state.huddle.share; renderSidebar(); toast(state.huddle.share ? 'You are sharing your screen' : 'Stopped sharing'); },
    'huddle-leave': () => leaveHuddle(),
    'toggle-sidebar': () => { state.sidebarOpen = !state.sidebarOpen; $('#sidebar').classList.toggle('open', state.sidebarOpen); $('#sidebar-scrim').classList.toggle('show', state.sidebarOpen); },
    'mobile-back': () => { state.mobileConv = false; if (MORE_VIEWS.includes(state.view)) state.view = 'home'; renderAll(); },
    'channel-details': (el) => { closePopovers(); openChannelDetails(el.dataset.tab); },
    'star': (el) => { const id = el.dataset.conv || state.conv; state.starred[id] = !state.starred[id]; renderSidebar(); renderMain(); if (state.rpanel && state.rpanel.type === 'details') renderRPanel(); toast(state.starred[id] ? 'Added to Starred' : 'Removed from Starred', { icon: 'star' }); if (modals.length) { closeAllModals(); } },
    'mute': (el) => { const id = el.dataset.conv || state.conv; state.muted[id] = !state.muted[id]; closePopovers(); refreshSidebar(); if (state.rpanel) renderRPanel(); toast(state.muted[id] ? 'Channel muted' : 'Channel unmuted', { icon: state.muted[id] ? 'bellOff' : 'bell' }); if (modals.length) closeAllModals(); },
    'edit-topic': () => { const c = conv(state.conv); closePopovers(); closeAllModals(); promptModal('Edit topic', 'Topic', c.topic, (v) => { c.topic = v.trim(); postSystem(c.id, 'You set the channel topic: ' + c.topic, 'edit'); renderMain(); if (state.rpanel) renderRPanel(); }, { help: 'Let people know what this channel is focused on right now.' }); },
    'edit-description': (el, e) => { if (e) e.preventDefault(); const c = conv(state.conv); closeAllModals(); promptModal('Edit description', 'Description', c.description, (v) => { c.description = v.trim(); renderMain(); if (state.rpanel) renderRPanel(); }, { multiline: true }); },
    'rpanel': (el) => { closePopovers(); const t = el.dataset.panel; if (state.rpanel && state.rpanel.type === t && state.rpanel.convId === state.conv) closePanel(); else openPanel({ type: t, convId: state.conv }); },
    'close-panel': () => closePanel(),
    'header-more': (el) => { const c = conv(state.conv); popover(el, menuItem('mute', (state.muted[c.id] ? 'Unmute' : 'Mute') + ' ' + (c.type === 'channel' ? 'channel' : 'conversation'), state.muted[c.id] ? 'bell' : 'bellOff', { data: { conv: c.id } }) + menuItem('star', state.starred[c.id] ? 'Remove from Starred' : 'Star', 'star', { data: { conv: c.id } }) + menuItem('toast', 'Change notifications', 'settings', { data: { text: 'Notification preferences opened' }, chev: true }) + '<div class="menu-sep"></div>' + menuItem('search-in', 'Search in ' + (c.type === 'channel' ? '#' + esc(c.name) : 'conversation'), 'search', { kbd: MOD + ' F' }) + menuItem('toast', 'Copy link', 'link', { data: { text: 'Link copied to clipboard' } }) + menuItem('channel-details', 'Open channel details', 'info') + (c.type === 'channel' ? '<div class="menu-sep"></div>' + menuItem('toast', 'Leave channel', 'logout', { data: { text: 'You left #' + c.name + ' (demo)' }, danger: true }) : ''), { align: 'end' }); },
    'ch-tab': (el) => { closePopovers(); state.channelTab = el.dataset.tab; if (state.rpanel && state.rpanel.type === 'details') closePanel(); renderMain(); },
    'add-tab': (el) => popover(el, menuItem('toast', 'Add a bookmark', 'bookmark', { data: { text: 'Bookmark added' } }) + menuItem('ch-tab', 'Add canvas tab', 'canvas', { data: { tab: 'canvas' } }) + menuItem('toast', 'Add a list', 'ol', { data: { text: 'Lists are not available in the demo' } }) + menuItem('toast', 'Add workflow', 'workflows', { data: { text: 'Workflow builder opened' } })),
    'jump-present': () => { const l = $('#msg-list'); if (l) l.scrollTo({ top: l.scrollHeight, behavior: state.prefs.reduceMotion ? 'auto' : 'smooth' }); },
    'day-menu': (el) => popover(el, menuItem('jump-day', 'Today', 'calendar', { data: { day: 0 } }) + menuItem('jump-day', 'Yesterday', 'calendar', { data: { day: 1 } }) + menuItem('jump-day', 'Last week', 'calendar', { data: { day: 7 } }) + menuItem('jump-day', 'Last month', 'calendar', { data: { day: 30 } }) + menuItem('jump-day', 'The very beginning', 'calendar', { data: { day: 9999 } }) + '<div class="menu-sep"></div>' + menuItem('toast', 'Jump to a specific date…', 'search', { data: { text: 'Date picker is not part of the demo' } }), { align: 'center' }),
    'jump-day': (el) => { closePopovers(); const days = +el.dataset.day; const target = startOfDay(Date.now()) - days * 86400000; const list = msgs(state.conv); const m = days > 1000 ? list[0] : list.find((x) => x.ts >= target) || list[0]; if (m) { const e = $('#msg-' + m.id); if (e) e.scrollIntoView({ block: 'start' }); } },
    'profile': (el, e) => { if (e) e.stopPropagation(); closePopovers(); closeAllModals(); openPanel({ type: 'profile', userId: el.dataset.user }); },
    'copy-link': (el) => { closePopovers(); try { navigator.clipboard && navigator.clipboard.writeText(location.href.split('#')[0] + '#' + el.dataset.msg); } catch (e) { /* ignore */ } toast('Link copied to clipboard', { icon: 'link' }); },
    'react': (el) => { toggleReaction(el.dataset.msg, el.dataset.emoji); },
    'react-pick': (el) => { emojiPicker(el, (ch) => toggleReaction(el.dataset.msg, ch), { place: 'below', align: 'end' }); },
    'open-thread': (el) => { closePopovers(); const cid = el.dataset.conv || state.conv; if (cid !== state.conv) openConv(cid, { keepPanel: true }); openPanel({ type: 'thread', msgId: el.dataset.msg, convId: cid }); if (window.innerWidth > 640) { const ta = $('#rpanel .composer textarea'); if (ta) ta.focus(); } },
    'forward': (el) => { closePopovers(); openForwardModal(el.dataset.msg); },
    'save': (el) => { const f = findMsg(el.dataset.msg); if (!f) return; f.msg.saved = !f.msg.saved; if (!f.msg.saved) delete state.laterState[f.msg.id]; closePopovers(); refreshMessages(); renderRPanel(); if (state.view === 'later') renderSidebar(); toast(f.msg.saved ? 'Saved for later' : 'Removed from Later', { icon: 'bookmark' }); },
    'msg-more': (el) => {
      const f = findMsg(el.dataset.msg); if (!f) return; const m = f.msg; const own = m.user === D.me;
      el.closest('.msg').classList.add('menu-open');
      popover(el, menuItem('toast', 'Turn off notifications for replies', 'bellOff', { data: { text: 'Notifications for replies turned off' } }) + menuItem('mark-unread', 'Mark unread', 'eyeOff', { data: { msg: m.id } }) + menuItem('remind-menu', 'Remind me about this', 'clock', { data: { msg: m.id }, chev: true }) + '<div class="menu-sep"></div>' + menuItem('copy-link', 'Copy link', 'link', { data: { msg: m.id } }) + menuItem('copy-text', 'Copy text', 'copy', { data: { msg: m.id } }) + menuItem('pin', (m.pinned ? 'Unpin from' : 'Pin to') + ' ' + (conv(f.convId).type === 'channel' ? 'channel' : 'conversation'), 'pin', { data: { msg: m.id } }) + menuItem('save', m.saved ? 'Remove from Later' : 'Save for later', 'bookmark', { data: { msg: m.id } }) + (m.saved ? menuItem('later-state', 'Mark as completed', 'checkCircle', { data: { msg: m.id, state: 'completed' } }) + menuItem('later-state', 'Archive', 'archive', { data: { msg: m.id, state: 'archived' } }) : '') + menuItem('forward', 'Forward message…', 'forward', { data: { msg: m.id } }) + (own ? '<div class="menu-sep"></div>' + menuItem('edit', 'Edit message', 'edit', { data: { msg: m.id }, kbd: 'E' }) + menuItem('delete', 'Delete message…', 'trash', { data: { msg: m.id }, danger: true, kbd: 'Delete' }) : '') + '<div class="menu-sep"></div>' + menuItem('toast', 'Add a message shortcut…', 'zap', { data: { text: 'Shortcuts are not part of the demo' } }), { align: 'end', onClose: () => $$('.menu-open').forEach((x) => x.classList.remove('menu-open')) });
    },
    'remind-menu': (el) => { popover(el, '<div class="menu-label">Remind me</div>' + ['In 20 minutes', 'In 1 hour', 'In 3 hours', 'Tomorrow', 'Next week'].map((t) => menuItem('remind', t, null, { data: { when: t, msg: el.dataset.msg } })).join('') + '<div class="menu-sep"></div>' + menuItem('remind', 'Custom…', 'calendar', { data: { when: 'a custom time', msg: el.dataset.msg } }), { place: 'right', stack: true }); },
    'remind': (el) => { closePopovers(); toast('I’ll remind you about this ' + el.dataset.when.toLowerCase().replace(/^in /, 'in '), { icon: 'bell' }); },
    'mark-unread': (el) => { const f = findMsg(el.dataset.msg); closePopovers(); state.lastRead[f.convId] = f.msg.ts - 1; state.newDividerAt[f.convId] = f.msg.ts - 1; refreshMessages(); refreshSidebar(); toast('Marked as unread'); },
    'copy-text': (el) => { const f = findMsg(el.dataset.msg); closePopovers(); try { navigator.clipboard && navigator.clipboard.writeText(plainText(f.msg.text)); } catch (e) { /* ignore */ } toast('Text copied', { icon: 'copy' }); },
    'pin': (el) => { const f = findMsg(el.dataset.msg); closePopovers(); f.msg.pinned = !f.msg.pinned; f.msg.pinnedBy = D.me; refreshMessages(); renderMain(); toast(f.msg.pinned ? 'Pinned to channel' : 'Unpinned', { icon: 'pin' }); },
    'edit': (el) => { closePopovers(); startEdit(el.dataset.msg); },
    'edit-cancel': () => { state.editing = null; refreshMessages(); },
    'edit-save': (el) => { const f = findMsg(el.dataset.msg); const ta = $('#msg-editor textarea'); if (!f || !ta) return; const v = ta.value.trim(); if (v && v !== f.msg.text) { f.msg.text = v; f.msg.edited = true; } state.editing = null; refreshMessages(); renderRPanel(); },
    'delete': (el) => { closePopovers(); const f = findMsg(el.dataset.msg); confirmModal('Delete message', 'Are you sure you want to delete this message? This cannot be undone.<div style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:8px 8px 8px 0">' + renderMessage(f.msg, { convId: f.convId, forceHead: true, inThread: true }).replace(/<div class="msg-actions".*$/, '</div>') + '</div>', 'Delete', () => { if (f.parent) f.parent.replies = f.parent.replies.filter((r) => r.id !== f.msg.id); else D.messages[f.convId] = D.messages[f.convId].filter((x) => x.id !== f.msg.id); refreshMessages(); renderRPanel(); refreshSidebar(); toast('Message deleted', { icon: 'trash' }); }, true); },
    'vote': (el) => { const f = findMsg(el.dataset.msg); const poll = f.msg.attachments.find((a) => a.type === 'poll'); poll.options.forEach((o, i) => { const k = o.votes.indexOf(D.me); if (i === +el.dataset.opt) { if (k >= 0) o.votes.splice(k, 1); else o.votes.push(D.me); } else if (k >= 0) o.votes.splice(k, 1); }); refreshMessages(); },
    'view-image': (el) => { const f = findMsg(el.dataset.msg); const a = f.msg.attachments.find((x) => x.name === el.dataset.name); modal('<div class="modal-head" style="padding:12px 16px"><h2 style="font-size:15px">' + avatar(user(f.msg.user), 24, { click: false }) + '<span>' + esc(a.name) + '</span><span class="muted-text" style="font-weight:400">' + esc(a.size || '') + '</span></h2><button class="icon-btn" data-act="toast" data-text="Downloading…" data-tip="Download" aria-label="Download">' + I('download', 20) + '</button><button class="modal-close" data-act="modal-close" aria-label="Close">' + I('close', 20) + '</button></div><div style="background:' + a.gradient + ';width:min(90vw,' + Math.max(a.w * 2, 600) + 'px);aspect-ratio:' + a.w + '/' + a.h + ';display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.35)">' + I('image', 48) + '</div>', { cls: 'wide', label: a.name }); },
    'open-file': (el) => toast('Opening ' + el.dataset.name + '…', { icon: 'files' }),
    'open-canvas': (el) => { closeAllModals(); toast('Opening canvas “' + el.dataset.title + '”', { icon: 'canvas' }); const cv = D.canvases.find((c) => c.title === el.dataset.title); if (cv && cv.channel) { openConv(cv.channel, { instant: true }); state.channelTab = 'canvas'; renderMain(); } },
    'toast': (el, e) => { if (e && el.tagName === 'A') e.preventDefault(); closePopovers(); toast(el.dataset.text || 'Done'); },
    'modal-close': () => closeModal(),
    'set-status': () => { closePopovers(); closePanel(); openStatusModal(); },
    'clear-status': () => { state.status = null; closePopovers(); renderAll(); toast('Status cleared'); },
    'pause-menu': (el) => popover(el, '<div class="menu-label">Pause notifications for…</div>' + ['30 minutes', '1 hour', '2 hours', 'Until tomorrow', 'Until next week'].map((t) => menuItem('pause', t, null, { data: { for: t } })).join('') + '<div class="menu-sep"></div>' + menuItem('toast', 'Custom…', 'calendar', { data: { text: 'Custom schedule is not part of the demo' } }) + menuItem('toast', 'Set a notification schedule', 'settings', { data: { text: 'Preferences → Notifications' } }) + (state.paused ? '<div class="menu-sep"></div>' + menuItem('pause', 'Resume notifications', 'bell', { data: { for: '' } }) : ''), { place: 'left', stack: true }),
    'pause': (el) => { state.paused = el.dataset.for || null; closePopovers(); renderAll(); toast(state.paused ? 'Notifications paused for ' + state.paused.toLowerCase() : 'Notifications resumed', { icon: state.paused ? 'bellOff' : 'bell' }); },
    'toggle-away': () => { state.presence = state.presence === 'active' ? 'away' : 'active'; closePopovers(); renderAll(); toast(state.presence === 'away' ? 'You are set to away' : 'You are set to active'); },
    'preferences': (el) => { closePopovers(); openPreferences(el && el.dataset.tab); },
    'shortcuts': () => { closePopovers(); openShortcutsModal(); },
    'toggle-theme': () => { closePopovers(); setTheme(state.theme === 'dark' ? 'light' : 'dark'); toast(state.theme === 'dark' ? 'Dark mode on' : 'Light mode on', { icon: state.theme === 'dark' ? 'moon' : 'sun' }); },
    'set-theme': (el) => { setTheme(el.dataset.theme); },
    'set-sidebar-theme': (el) => { setSidebarTheme(el.dataset.st); },
    'sign-out': () => { closePopovers(); confirmModal('Sign out of ' + D.workspace.name + '?', 'You can sign back in any time. This is a demo, so nothing actually happens.', 'Sign out', () => toast('Signed out (demo)')); },
    'reset-app': () => { confirmModal('Reset demo?', 'This clears saved preferences, drafts and theme, then reloads the page.', 'Reset', () => { try { Object.keys(localStorage).filter((k) => k.startsWith('ss.')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } location.reload(); }, true); },
    'search-in': () => { closePopovers(); const c = conv(state.conv); const inp = $('#search-input'); inp.value = 'in:#' + (c.type === 'channel' ? c.name : convName(c).split(' ')[0]) + ' '; $('#top-search').classList.add('has-value'); inp.focus(); },
    'search-chip': (el) => { const inp = $('#rp-search-input'); const q = inp ? inp.value : (state.rpanel && state.rpanel.query) || ''; const v = el.dataset.val; let nq; if (v === 'in:' || v === 'from:') nq = q.split(/\s+/).filter((t) => !t.startsWith(v)).join(' '); else nq = (q.split(/\s+/).filter((t) => !t.startsWith(v.split(':')[0] + ':')).join(' ') + ' ' + v).trim(); openPanel({ type: 'search', query: nq }); $('#search-input').value = nq; $('#top-search').classList.toggle('has-value', !!nq); },
    'search-more-filters': (el) => popover(el, '<div class="menu-label">Filter by</div>' + menuItem('toast', 'Date range', 'calendar', { data: { text: 'Date filters are not part of the demo' } }) + menuItem('toast', 'Has file', 'files', { data: { text: 'File filter applied (demo)' } }) + menuItem('toast', 'Has reaction', 'emoji', { data: { text: 'Reaction filter applied (demo)' } })),
    'fmt': (el) => { const box = el.closest('.composer'); applyFmt($('textarea', box), el.dataset.fmt); },
    'toggle-fmt': () => { state.prefs.showFmt = !state.prefs.showFmt; store.set('prefs', state.prefs); $$('.composer .fmt-bar').forEach((b) => b.classList.toggle('hidden', !state.prefs.showFmt)); $$('[data-act="toggle-fmt"]').forEach((b) => { b.classList.toggle('on', state.prefs.showFmt); b.setAttribute('data-tip', state.prefs.showFmt ? 'Hide formatting' : 'Show formatting'); }); },
    'emoji-composer': (el) => { const box = el.closest('.composer'); const ta = $('textarea', box); emojiPicker(el, (ch, em) => insertAtCursor(ta, ':' + em.name + ': '), { place: 'above', align: 'start', keepOpen: false }); },
    'mention-composer': (el) => { const box = el.closest('.composer'); const ta = $('textarea', box); insertAtCursor(ta, (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + '@'); updateAutocomplete(box); },
    'slash-composer': (el) => { const box = el.closest('.composer'); const ta = $('textarea', box); if (!ta.value) { insertAtCursor(ta, '/'); updateAutocomplete(box); } else popover(el, '<div class="menu-label">Shortcuts</div>' + D.slashCommands.slice(0, 6).map((c) => menuItem('slash-insert', esc(c.cmd) + ' <span class="muted-text">' + esc(c.args) + '</span>', 'slash', { data: { cmd: c.cmd }, sub: c.desc })).join(''), { place: 'above' }); },
    'slash-insert': (el) => { closePopovers(); const ta = $('#main .composer textarea'); if (ta) { ta.value = el.dataset.cmd + ' '; ta.dispatchEvent(new Event('input')); ta.focus(); } },
    'attach-menu': (el) => popover(el, '<div class="menu-label">Add to your message</div>' + menuItem('toast', 'Upload from your computer', 'download', { data: { text: 'File upload is not part of the demo' }, kbd: MOD + ' U' }) + menuItem('toast', 'Recent files', 'files', { data: { text: 'Recent files opened' }, chev: true }) + '<div class="menu-sep"></div>' + menuItem('toast', 'Canvas', 'canvas', { data: { text: 'New canvas created' } }) + menuItem('toast', 'Create a poll', 'poll', { data: { text: 'Polly opened' } }) + menuItem('toast', 'Record video clip', 'video', { data: { text: 'Video clips are not part of the demo' } }) + menuItem('toast', 'Record audio clip', 'mic', { data: { text: 'Audio clips are not part of the demo' } }) + '<div class="menu-sep"></div>' + menuItem('toast', 'Set a reminder', 'clock', { data: { text: '/remind' } }), { place: 'above' }),
    'send': (el) => sendFromComposer(el.closest('.composer')),
    'send-menu': (el) => popover(el, menuItem('send', 'Send now', 'send', { kbd: 'Enter' }) + '<div class="menu-sep"></div><div class="menu-label">Schedule message</div>' + menuItem('schedule', 'Tomorrow at 9:00 AM', 'clock', { data: { when: 'tomorrow at 9:00 AM' } }) + menuItem('schedule', 'Monday at 9:00 AM', 'clock', { data: { when: 'Monday at 9:00 AM' } }) + menuItem('schedule', 'Custom time…', 'calendar', { data: { when: 'a custom time' } }), { place: 'above', align: 'end' }),
    'schedule': (el) => { const box = $('#main .composer'); const ta = $('textarea', box); closePopovers(); if (!ta.value.trim()) { toast('Type a message to schedule it'); return; } ta.value = ''; ta.dispatchEvent(new Event('input')); toast('Message scheduled for ' + el.dataset.when, { icon: 'clock' }); },
    'ac-pick': (el) => acPick(el.closest('.composer'), +el.dataset.idx),
  };
  function openMeMenu(el) {
    const st = state.status; const pr = presenceOf(me());
    popover(el, '<div class="menu-head">' + avatar(me(), 36, { click: false }) + '<div><div class="mh-name">' + esc(me().name) + '</div><div class="mh-sub"><span class="pdot ' + pr + '"></span>' + (state.paused ? 'Notifications paused' : pr === 'active' ? 'Active' : 'Away') + '</div></div></div>' +
      '<button class="menu-status-btn" data-act="set-status">' + (st ? '<span>' + esc(st.emoji) + '</span><span style="color:var(--text)">' + esc(st.text) + '</span>' + (st.until ? '<span class="muted-text" style="margin-left:auto">' + esc(st.until) + '</span>' : '') : I('emoji', 18) + 'Update your status') + '</button>' +
      (st ? menuItem('clear-status', 'Clear status', 'close') : '') +
      menuItem('toggle-away', 'Set yourself as <b>' + (state.presence === 'active' ? 'away' : 'active') + '</b>', pr === 'active' ? 'moon' : 'sun') +
      menuItem('pause-menu', state.paused ? 'Notifications paused <span class="muted-text">(' + esc(state.paused) + ')</span>' : 'Pause notifications', state.paused ? 'bellOff' : 'bell', { chev: true }) +
      '<div class="menu-sep"></div>' + menuItem('profile', 'Profile', 'people', { data: { user: 'me' } }) + menuItem('preferences', 'Preferences', 'settings', { kbd: MOD + ' ,' }) + menuItem('toggle-theme', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', state.theme === 'dark' ? 'sun' : 'moon', { kbd: MOD + ' ' + SHIFT + ' D' }) + menuItem('shortcuts', 'Keyboard shortcuts', 'keyboard', { kbd: MOD + ' /' }) + '<div class="menu-sep"></div>' + menuItem('sign-out', 'Sign out of ' + esc(D.workspace.name), 'logout'), { align: 'end' });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (el.tagName === 'A' && act !== 'toast' && act !== 'edit-description') return;
    if (actions[act]) { actions[act](el, e); return; }
    if (act.startsWith('open-') && conv(act.slice(5))) { openConv(act.slice(5)); return; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { const el = e.target.closest && e.target.closest('[role="button"][data-act]'); if (el && el.tagName !== 'BUTTON') { e.preventDefault(); el.click(); } }
  });
  // generic list filtering: <input data-filter="id"> filters [data-search] children of #id
  document.addEventListener('input', (e) => {
    const inp = e.target; if (!inp.dataset || !inp.dataset.filter) return;
    const q = inp.value.toLowerCase(); const root = document.getElementById(inp.dataset.filter) || inp.closest('.modal, .rpanel, .page');
    $$('[data-search]', root).forEach((el) => { el.style.display = el.dataset.search.toLowerCase().includes(q) ? '' : 'none'; });
  });
  // top search
  const searchInput = $('#search-input');
  searchInput.addEventListener('input', () => $('#top-search').classList.toggle('has-value', !!searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); closePopovers(); openPanel({ type: 'search', query: searchInput.value.trim() }); searchInput.blur(); }
    if (e.key === 'Escape') { searchInput.value = ''; $('#top-search').classList.remove('has-value'); searchInput.blur(); }
  });
  searchInput.addEventListener('focus', () => { if (!searchInput.value && !modals.length) { popover($('#top-search'), '<div class="menu-label">Search options</div>' + ['from:@', 'in:#', 'has:link', 'is:saved', 'before:'].map((t) => menuItem('search-fill', '<code style="font-family:var(--mono);font-size:13px">' + esc(t) + '</code>', 'search', { data: { val: t }, sub: t === 'from:@' ? 'Messages from a person' : t === 'in:#' ? 'Messages in a channel' : t === 'has:link' ? 'Messages containing links' : t === 'is:saved' ? 'Saved messages' : 'Messages before a date' })).join('') + '<div class="menu-sep"></div><div class="menu-label">Recent searches</div>' + ['SSO spec', 'in:#engineering RFC', 'from:@ann figma'].map((t) => menuItem('search-run', esc(t), 'clock', { data: { val: t } })).join(''), { align: 'start', focus: false, cls: 'search-pop' }); const p = popovers[popovers.length - 1]; if (p) { p.el.style.width = $('#top-search').getBoundingClientRect().width + 'px'; p.el.style.maxWidth = 'none'; } } });
  actions['search-fill'] = (el) => { searchInput.value = el.dataset.val; $('#top-search').classList.add('has-value'); closePopovers(); searchInput.focus(); };
  actions['search-run'] = (el) => { searchInput.value = el.dataset.val; $('#top-search').classList.add('has-value'); closePopovers(); openPanel({ type: 'search', query: el.dataset.val }); };
  searchInput.addEventListener('blur', () => setTimeout(() => { const p = popovers.find((x) => x.el.classList.contains('search-pop')); if (p && !p.el.contains(document.activeElement)) closePopovers(); }, 150));
  $('#search-clear').addEventListener('click', () => { searchInput.value = ''; $('#top-search').classList.remove('has-value'); searchInput.focus(); });
  $('#me-avatar-btn').addEventListener('click', (e) => openMeMenu(e.currentTarget));
  $('#help-btn').addEventListener('click', (e) => popover(e.currentTarget, menuItem('shortcuts', 'Keyboard shortcuts', 'keyboard', { kbd: MOD + ' /' }) + menuItem('toast', 'Help center', 'help', { data: { text: 'Help center opens in the browser' } }) + menuItem('toast', 'What’s new', 'sparkle', { data: { text: 'Release notes: v2.14.0' } }) + '<div class="menu-sep"></div>' + menuItem('toast', 'Contact support', 'mail', { data: { text: 'Support form opened' } }) + menuItem('toast', 'About this demo', 'info', { data: { text: 'Slack Shell — a static recreation of the Slack desktop app' } }), { align: 'end' }));
  $('#nav-back').addEventListener('click', () => { if (state.histIdx > 0) { state.histIdx--; openConv(state.history[state.histIdx], { noHistory: true, instant: true }); } });
  $('#nav-fwd').addEventListener('click', () => { if (state.histIdx < state.history.length - 1) { state.histIdx++; openConv(state.history[state.histIdx], { noHistory: true, instant: true }); } });
  $('#nav-history').addEventListener('click', (e) => { const recent = state.history.slice().reverse().filter((x, i, a) => a.indexOf(x) === i).slice(0, 8); popover(e.currentTarget, '<div class="menu-label">History</div>' + recent.map((id) => menuItem('open', esc(convName(conv(id))), conv(id).type === 'channel' ? 'hash' : 'dms', { data: { conv: id } })).join(''), { align: 'start' }); });
  $('#sidebar-scrim').addEventListener('click', () => actions['toggle-sidebar']());
  // rpanel search input
  document.addEventListener('keydown', (e) => { if (e.target.id === 'rp-search-input' && e.key === 'Enter') { e.preventDefault(); openPanel({ type: 'search', query: e.target.value.trim() }); searchInput.value = e.target.value.trim(); $('#top-search').classList.toggle('has-value', !!searchInput.value); } });

  /* sidebar resize */
  (function () {
    const rz = $('#sidebar-resizer'); let dragging = false;
    const setW = (w) => { w = clamp(w, 200, 420); document.documentElement.style.setProperty('--sidebar-w', w + 'px'); try { localStorage.setItem('ss.sidebarWidth', w); } catch (e) { /* ignore */ } };
    rz.addEventListener('pointerdown', (e) => { dragging = true; rz.classList.add('dragging'); rz.setPointerCapture(e.pointerId); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; });
    rz.addEventListener('pointermove', (e) => { if (!dragging) return; const railW = $('#rail').getBoundingClientRect().width; setW(e.clientX - railW); });
    const end = () => { if (!dragging) return; dragging = false; rz.classList.remove('dragging'); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    rz.addEventListener('pointerup', end); rz.addEventListener('pointercancel', end);
    rz.addEventListener('keydown', (e) => { const cur = $('#sidebar').getBoundingClientRect().width; if (e.key === 'ArrowLeft') { e.preventDefault(); setW(cur - 16); } if (e.key === 'ArrowRight') { e.preventDefault(); setW(cur + 16); } });
    rz.addEventListener('dblclick', () => setW(260));
  })();

  /* ------------------------------------------------------------------
     Global keyboard shortcuts
  ------------------------------------------------------------------ */
  function convList() { const starred = convs().filter((c) => state.starred[c.id]); return starred.concat(D.channels.filter((c) => !state.starred[c.id])).concat(D.dms.filter((c) => !state.starred[c.id])); }
  document.addEventListener('keydown', (e) => {
    const k = e.key; const lower = k.toLowerCase(); const mod = modKey(e);
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (k === 'Escape') {
      if (popovers.length) { closePopovers(); return; }
      if (modals.length) { closeModal(); return; }
      if (state.editing) { state.editing = null; refreshMessages(); return; }
      if (state.sidebarOpen) { actions['toggle-sidebar'](); return; }
      if (state.rpanel) { closePanel(); return; }
      if (e.shiftKey) { convs().forEach((c) => markRead(c.id)); toast('All conversations marked as read'); return; }
      if (!inField) { markRead(state.conv); }
      return;
    }
    if (mod && lower === 'k' && !e.shiftKey) { e.preventDefault(); if (modals.length) closeAllModals(); else quickSwitcher(); return; }
    if (mod && lower === 'g' && !e.shiftKey) { e.preventDefault(); quickSwitcher(); return; }
    if (mod && k === '/') { e.preventDefault(); if (modals.length) closeAllModals(); else openShortcutsModal(); return; }
    if (mod && k === ',') { e.preventDefault(); openPreferences(); return; }
    if (mod && k === '.') { e.preventDefault(); if (state.rpanel) closePanel(); else openPanel({ type: 'details', convId: state.conv }); return; }
    if (mod && lower === 'f' && !e.shiftKey) { e.preventDefault(); actions['search-in'](); return; }
    if (mod && (k === '[' || k === ']')) { e.preventDefault(); $(k === '[' ? '#nav-back' : '#nav-fwd').click(); return; }
    if (mod && e.shiftKey) {
      const map = { d: () => actions['toggle-theme'](), a: () => { state.unreadsOnly = !state.unreadsOnly; setView('home'); toast(state.unreadsOnly ? 'Showing unreads only' : 'Showing all conversations'); }, t: () => openPanel({ type: 'threads' }), s: () => setView('later'), m: () => setView('activity'), k: () => setView('dms'), y: () => openStatusModal(), h: () => actions['huddle-toggle'](), l: () => actions['toggle-sidebar']() };
      if (map[lower] && !(inField && ['x', 'c', 'u'].includes(lower))) { e.preventDefault(); closePopovers(); map[lower](); return; }
    }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      let list = convList(); if (e.shiftKey) list = list.filter((c) => unreadCount(c.id) > 0 || c.id === state.conv);
      if (!list.length) return;
      const i = list.findIndex((c) => c.id === state.conv);
      const next = list[(i + (k === 'ArrowDown' ? 1 : list.length - 1) + (i < 0 ? 1 : 0)) % list.length];
      if (next) openConv(next.id, { instant: true });
      return;
    }
    if (!inField && !mod && !e.altKey && k.length === 1 && /[a-z0-9]/i.test(k) && !modals.length) {
      const ta = $('#main .composer textarea'); if (ta && !ta.disabled) { ta.focus(); }
    }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900 && state.sidebarOpen) { state.sidebarOpen = false; $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.remove('show'); } });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { try { if (!localStorage.getItem('ss.theme')) setTheme(e.matches ? 'dark' : 'light'); } catch (er) { /* ignore */ } });

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  function init() {
    if (state.sidebarTheme && state.sidebarTheme !== 'default') document.documentElement.setAttribute('data-sidebar', state.sidebarTheme);
    state.newDividerAt.c_general = unreadCount('c_general') ? state.lastRead.c_general : null;
    state.mobileConv = false;
    renderAll();
    refreshMessages(true);
    markRead('c_general');
    scheduleSim(); scheduleTyping();
    setInterval(() => { $$('.thread-foot .last-reply').forEach(() => {}); }, 60000);
    window.SlackShell = { state, data: D, openConv, setView, toast, setTheme, actions };
  }
  init();
})();
