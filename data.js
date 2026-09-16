/* Slack Shell — seeded sample data. All timestamps are relative to Date.now(). */
(function (global) {
  'use strict';
  const NOW = Date.now();
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const ago = (min) => NOW - Math.round(min * MIN);
  let seq = 1;
  const nid = (p) => p + '_' + (seq++).toString(36);

  /* ---------------- People ---------------- */
  const users = {
    me: { id: 'me', name: 'Justin Massion', handle: 'justin', title: 'Founder / Engineer', initials: 'JM', color: '#4A154B', presence: 'active', status: null, tz: 'America/Los_Angeles', email: 'justin@playset.dev', phone: '+1 (415) 555-0142', pronouns: 'he/him' },
    u1: { id: 'u1', name: 'Ann Okafor', handle: 'ann', title: 'Design Lead', initials: 'AO', color: '#E01E5A', presence: 'active', status: { emoji: '🎨', text: 'Designing', until: 'Today' }, tz: 'America/New_York', email: 'ann@playset.dev' },
    u2: { id: 'u2', name: 'Marcus Chen', handle: 'marcus', title: 'Staff Engineer', initials: 'MC', color: '#36C5F0', presence: 'active', status: null, tz: 'America/Los_Angeles', email: 'marcus@playset.dev' },
    u3: { id: 'u3', name: 'Priya Natarajan', handle: 'priya', title: 'Product Manager', initials: 'PN', color: '#2EB67D', presence: 'away', status: { emoji: '📅', text: 'In meetings', until: '3:00 PM' }, tz: 'Asia/Kolkata', email: 'priya@playset.dev' },
    u4: { id: 'u4', name: 'Diego Alvarez', handle: 'diego', title: 'Frontend Engineer', initials: 'DA', color: '#ECB22E', presence: 'active', status: { emoji: '🏠', text: 'Working from home', until: 'Today' }, tz: 'America/Mexico_City', email: 'diego@playset.dev' },
    u5: { id: 'u5', name: 'Sofia Rossi', handle: 'sofia', title: 'Backend Engineer', initials: 'SR', color: '#1264A3', presence: 'dnd', status: { emoji: '🎧', text: 'Heads down', until: '5:00 PM' }, tz: 'Europe/Rome', email: 'sofia@playset.dev' },
    u6: { id: 'u6', name: 'Tomás Lindqvist', handle: 'tomas', title: 'DevOps Engineer', initials: 'TL', color: '#E8912D', presence: 'active', status: null, tz: 'Europe/Stockholm', email: 'tomas@playset.dev' },
    u7: { id: 'u7', name: 'Hannah Kim', handle: 'hannah', title: 'Customer Success', initials: 'HK', color: '#7C3085', presence: 'away', status: { emoji: '🌴', text: 'Vacationing until Friday', until: 'Friday' }, tz: 'America/Chicago', email: 'hannah@playset.dev' },
    u8: { id: 'u8', name: 'Ravi Patel', handle: 'ravi', title: 'Data Engineer', initials: 'RP', color: '#DE4E2B', presence: 'away', status: null, tz: 'America/Toronto', email: 'ravi@playset.dev' },
    u9: { id: 'u9', name: 'Elena Petrova', handle: 'elena', title: 'QA Lead', initials: 'EP', color: '#0B8043', presence: 'active', status: { emoji: '🐛', text: 'Bug bash', until: 'Today' }, tz: 'Europe/Berlin', email: 'elena@playset.dev' },
    u10: { id: 'u10', name: 'Noah Williams', handle: 'noah', title: 'Marketing Lead', initials: 'NW', color: '#3F51B5', presence: 'active', status: { emoji: '🍕', text: 'Lunch', until: '1:00 PM' }, tz: 'America/Denver', email: 'noah@playset.dev' },
    u11: { id: 'u11', name: 'Aisha Bello', handle: 'aisha', title: 'Support Engineer', initials: 'AB', color: '#00796B', presence: 'active', status: null, tz: 'Africa/Lagos', email: 'aisha@playset.dev' },
    u12: { id: 'u12', name: "Liam O'Brien", handle: 'liam', title: 'CTO', initials: 'LO', color: '#C2185B', presence: 'dnd', status: { emoji: '✈️', text: 'Traveling', until: 'Thursday' }, tz: 'Europe/Dublin', email: 'liam@playset.dev' },
    u13: { id: 'u13', name: 'Mei Tanaka', handle: 'mei', title: 'Illustrator', initials: 'MT', color: '#5D4037', presence: 'away', status: null, tz: 'Asia/Tokyo', email: 'mei@playset.dev' },
    u14: { id: 'u14', name: 'Omar Haddad', handle: 'omar', title: 'Sales Lead', initials: 'OH', color: '#E01E5A', presence: 'active', status: { emoji: '📞', text: 'On a call', until: '2:30 PM' }, tz: 'Asia/Dubai', email: 'omar@playset.dev' },
    /* bots */
    b_github: { id: 'b_github', name: 'GitHub', initials: 'GH', color: '#24292E', bot: true, presence: 'none' },
    b_zoom: { id: 'b_zoom', name: 'Zoom', initials: 'Z', color: '#2D8CFF', bot: true, presence: 'none' },
    b_pagerduty: { id: 'b_pagerduty', name: 'PagerDuty', initials: 'PD', color: '#06AC38', bot: true, presence: 'none' },
    b_datadog: { id: 'b_datadog', name: 'Datadog', initials: 'DD', color: '#632CA6', bot: true, presence: 'none' },
    b_polly: { id: 'b_polly', name: 'Polly', initials: 'P', color: '#FF6B6B', bot: true, presence: 'none' },
    b_slackbot: { id: 'b_slackbot', name: 'Slackbot', initials: 'S', color: '#611F69', bot: true, presence: 'none' },
    b_vercel: { id: 'b_vercel', name: 'Vercel', initials: 'V', color: '#000000', bot: true, presence: 'none' },
  };
  const humans = Object.keys(users).filter((k) => !users[k].bot && k !== 'me');

  /* ---------------- Message helper ---------------- */
  // M(user, minutesAgo, text, extras)
  function M(user, min, text, x) {
    const m = Object.assign({ id: nid('m'), user, ts: ago(min), text, reactions: [], replies: [], attachments: [] }, x || {});
    if (m.replies.length) {
      // replies are given as [user, minutesAgo, text, extras]
      m.replies = m.replies.map((r) => Array.isArray(r) ? Object.assign({ id: nid('r'), user: r[0], ts: ago(r[1]), text: r[2], reactions: [], attachments: [] }, r[3] || {}) : r);
      m.replies.sort((a, b) => a.ts - b.ts);
    }
    return m;
  }
  const R = (emoji, users) => ({ emoji, users });
  const grad = (a, b, c) => `linear-gradient(135deg, ${a}, ${b}${c ? ', ' + c : ''})`;

  /* ---------------- Channels ---------------- */
  const channels = [
    { id: 'c_general', name: 'general', type: 'channel', topic: 'Company-wide announcements and work-based matters', description: 'This is the one channel that will always include everyone. It’s a great spot for announcements and team-wide conversations.', members: ['me', ...humans], created: NOW - 400 * DAY, starred: true, pinnedCount: 2, canvas: 'cv1', integrations: ['b_github', 'b_zoom', 'b_polly'] },
    { id: 'c_announcements', name: 'announcements', type: 'channel', topic: 'Official announcements only · posting restricted to admins', description: 'Company announcements from leadership.', members: ['me', ...humans], created: NOW - 398 * DAY, starred: false, integrations: [] },
    { id: 'c_rebuild', name: 'rebuild-slack', type: 'channel', topic: 'Pixel-faithful Slack shell rebuild · static web app', description: 'Coordination for the Slack desktop shell recreation project.', members: ['me', 'u1', 'u2', 'u4', 'u9', 'u13'], created: NOW - 12 * DAY, starred: true, integrations: ['b_github', 'b_vercel'] },
    { id: 'c_website', name: 'build-website', type: 'channel', topic: 'Marketing site v2 · launch target Oct 1', description: 'Everything about the new marketing website.', members: ['me', 'u1', 'u4', 'u10', 'u13', 'u14'], created: NOW - 60 * DAY, integrations: ['b_vercel'] },
    { id: 'c_eng', name: 'engineering', type: 'channel', topic: 'Eng-wide discussion · on-call: @tomas', description: 'Engineering team channel. RFCs, incidents, and architecture discussions.', members: ['me', 'u2', 'u4', 'u5', 'u6', 'u8', 'u9', 'u12'], created: NOW - 390 * DAY, integrations: ['b_github', 'b_pagerduty'] },
    { id: 'c_design', name: 'design', type: 'channel', topic: 'Design crits Tuesdays 11am · Figma → #design', description: 'Design team channel. Share work-in-progress and critiques.', members: ['me', 'u1', 'u4', 'u13', 'u3'], created: NOW - 380 * DAY, integrations: [] },
    { id: 'c_random', name: 'random', type: 'channel', topic: 'Non-work banter and water cooler conversation', description: 'A place for non-work-related flimflam, faffing, hodge-podge or jibber-jabber you’d prefer to keep out of more focused work-related channels.', members: ['me', ...humans], created: NOW - 400 * DAY, integrations: [] },
    { id: 'c_product', name: 'product', type: 'channel', topic: 'Roadmap, specs, and customer feedback', description: 'Product management channel.', members: ['me', 'u3', 'u1', 'u2', 'u12', 'u7', 'u14'], created: NOW - 300 * DAY, integrations: [] },
    { id: 'c_support', name: 'support-escalations', type: 'channel', private: true, topic: 'P0/P1 customer escalations · include ticket ID', description: 'Private channel for escalated support cases.', members: ['me', 'u7', 'u11', 'u2', 'u12'], created: NOW - 200 * DAY, integrations: ['b_pagerduty'] },
    { id: 'c_ops', name: 'ops-alerts', type: 'channel', muted: true, topic: 'Automated alerts from Datadog and PagerDuty', description: 'Bot-only channel for infrastructure alerts.', members: ['me', 'u6', 'u5', 'u2'], created: NOW - 250 * DAY, integrations: ['b_datadog', 'b_pagerduty'] },
  ];

  const dms = [
    { id: 'd_u1', type: 'dm', members: ['me', 'u1'] },
    { id: 'd_u2', type: 'dm', members: ['me', 'u2'] },
    { id: 'd_u3', type: 'dm', members: ['me', 'u3'] },
    { id: 'd_u4', type: 'dm', members: ['me', 'u4'] },
    { id: 'd_u9', type: 'dm', members: ['me', 'u9'] },
    { id: 'd_u12', type: 'dm', members: ['me', 'u12'] },
    { id: 'd_group', type: 'dm', members: ['me', 'u1', 'u2', 'u4'] },
    { id: 'd_me', type: 'dm', members: ['me'], self: true },
  ];

  /* ---------------- Messages ---------------- */
  const messages = {};

  messages.c_general = [
    M('u12', 4 * 1440 + 40, 'Morning all — quick reminder that Q3 planning kicks off *this Thursday*. Please have your team’s OKR drafts in the shared canvas by EOD Wednesday. :pray:', {
      reactions: [R('👍', ['u1', 'u2', 'u3', 'u6']), R('🙏', ['u4', 'u9'])],
      attachments: [{ type: 'canvas', title: 'Q3 Planning — OKR drafts', excerpt: 'One page per team. Keep it to 3 objectives, 3 KRs each. Add open questions at the bottom.', updated: 'Edited 2 days ago', by: 'u12' }],
      pinned: true,
    }),
    M('u3', 4 * 1440 + 22, 'On it. Product OKRs are ~80% done, will finish after the customer call.'),
    M('u1', 4 * 1440 + 15, 'Design is done :tada: added a section on the new component library rollout too.'),
    M('u2', 4 * 1440 - 30, 'Heads up: I’m going to bump the Node version on CI to 22 this afternoon. Should be a no-op, but shout if you see anything weird in your builds.', {
      replies: [
        ['u6', 4 * 1440 - 25, 'Sounds good. The Docker base images are already on 22 so we’re aligned.'],
        ['u4', 4 * 1440 - 20, 'Will `npm ci` still work with the old lockfile version?'],
        ['u2', 4 * 1440 - 18, 'Yep, lockfile v3 is fine on both. I tested it on a branch this morning.'],
        ['u9', 4 * 1440 - 5, 'Test suite is green on the branch :white_check_mark:'],
      ],
      reactions: [R('👀', ['u4', 'u5'])],
    }),
    M('b_github', 4 * 1440 - 60, '', {
      attachments: [{ type: 'github', repo: 'playset/app', kind: 'Pull request merged', title: '#1421 chore(ci): upgrade Node to 22 LTS', by: 'marcus-chen', branch: 'ci/node-22', meta: '+38 −22 · 4 files' }],
    }),
    M('u10', 3 * 1440 + 200, 'The blog post about our new pricing went live! https://playset.dev/blog/pricing-2026 :rocket:', {
      attachments: [{ type: 'link', url: 'https://playset.dev/blog/pricing-2026', site: 'playset.dev', title: 'Simpler pricing for teams of every size', description: 'Starting today, Playset has two plans: Free and Pro. Pro is $8/user/month with unlimited history, workflows, and priority support.', image: grad('#4A154B', '#E01E5A') }],
      reactions: [R('🚀', ['me', 'u1', 'u2', 'u3', 'u4', 'u7', 'u14']), R('🎉', ['u1', 'u9']), R('💯', ['u14'])],
      replies: [
        ['u14', 3 * 1440 + 190, 'Already got two inbound leads referencing it :chart_with_upwards_trend:'],
        ['u10', 3 * 1440 + 185, 'Love to see it. Tracking UTMs in the dashboard if anyone wants to peek.'],
      ],
    }),
    M('u7', 3 * 1440 + 120, 'Customer call notes from Acme are in <#c_product>. TL;DR they want SSO on the Pro tier, not just Enterprise.', { reactions: [R('👍', ['u3', 'u12'])] }),
    M('u5', 3 * 1440 + 60, 'PSA: the staging DB will be down for ~15 min at 4pm CET for the Postgres 16 upgrade.', { reactions: [R('🙏', ['u6', 'u8'])] }),
    M('b_zoom', 3 * 1440 + 30, '', { attachments: [{ type: 'zoom', title: 'All-hands sync', host: 'u12', duration: '48 min', participants: 14 }] }),
    M('u4', 3 * 1440 - 10, 'Recording of the all-hands is up in the drive for anyone who missed it. Timestamps in the description :movie_camera:', { saved: true }),
    M('u8', 2 * 1440 + 300, 'Data pipeline finished backfilling 2025 events overnight. Warehouse tables are fresh — `events_v2` is now the source of truth. `events` is deprecated and will be dropped next week.', {
      reactions: [R('🔥', ['u2', 'u5', 'u12']), R('👏', ['u3'])],
      replies: [
        ['u3', 2 * 1440 + 290, 'Does the Looker dashboard already point at v2?'],
        ['u8', 2 * 1440 + 285, 'Yes, swapped it this morning. Numbers match within 0.1%.'],
        ['u12', 2 * 1440 + 200, 'Great work Ravi :clap:'],
      ],
    }),
    M('b_polly', 2 * 1440 + 240, 'Team lunch on Friday — where should we go?', {
      attachments: [{ type: 'poll', question: 'Team lunch on Friday — where should we go?', options: [{ text: 'Tacos at La Taqueria :taco:', votes: ['u4', 'u10', 'u14', 'u1', 'me'] }, { text: 'Ramen bar :ramen:', votes: ['u2', 'u13', 'u9'] }, { text: 'The Thai place on 3rd', votes: ['u3', 'u7'] }, { text: 'Bring-your-own picnic :sandwich:', votes: ['u6'] }], by: 'u10', anonymous: false }],
    }),
    M('u9', 2 * 1440 + 180, 'Bug bash results are in :bug: 41 bugs filed, 12 P1s. Big ones are around the new composer and thread panel. Full list in the tracker.', {
      attachments: [{ type: 'file', name: 'bug-bash-sept-results.xlsx', kind: 'xlsx', size: '184 KB' }],
      reactions: [R('🐛', ['u2', 'u4', 'u1']), R('💪', ['u12'])],
      replies: [
        ['u4', 2 * 1440 + 170, 'Triage at 2? I can take the composer ones.'],
        ['u2', 2 * 1440 + 165, 'I’ll grab the thread panel bugs.'],
        ['u9', 2 * 1440 + 160, 'Perfect, calendar invite sent.'],
        ['u1', 2 * 1440 + 100, 'Some of these are design bugs — I’ll comment on the ones that are intended behavior.'],
        ['u9', 2 * 1440 + 90, 'Thanks Ann :heart:'],
      ],
    }),
    M('u1', 2 * 1440 + 60, 'New illustrations for the empty states from <@u13> :art: what do we think?', {
      attachments: [
        { type: 'image', name: 'empty-state-inbox.png', gradient: grad('#FFD6E8', '#C6E2FF'), w: 360, h: 220, size: '312 KB' },
        { type: 'image', name: 'empty-state-search.png', gradient: grad('#E0F7EF', '#FFF3C4'), w: 360, h: 220, size: '298 KB' },
      ],
      reactions: [R('😍', ['me', 'u3', 'u4', 'u10', 'u7']), R('🎨', ['u2'])],
    }),
    M('u13', 2 * 1440 + 55, 'Thanks! There are dark mode variants too, I’ll upload them to Figma tonight :crescent_moon:'),
    M('u3', 1440 + 420, '<@me> can you take a look at the SSO spec when you get a sec? Want your take on the SAML vs OIDC question before I bring it to eng.', {
      attachments: [{ type: 'file', name: 'SSO-spec-v2.pdf', kind: 'pdf', size: '2.4 MB', pages: 11 }],
      saved: true,
      replies: [
        ['me', 1440 + 400, 'Sure — reading now. First pass: OIDC first, SAML later for the enterprise folks who insist.'],
        ['u3', 1440 + 395, 'That matches what I heard from Acme. Cool, I’ll write it up.'],
        ['u12', 1440 + 380, '+1. SAML is a lot of surface area for very few customers right now.'],
      ],
      reactions: [R('👀', ['u2', 'u12'])],
    }),
    M('u6', 1440 + 300, 'Deployed the CDN cache fix. p95 TTFB on the marketing site dropped from 480ms → 120ms :zap:', {
      reactions: [R('⚡', ['me', 'u2', 'u4', 'u10']), R('🚀', ['u12'])],
    }),
    M('u2', 1440 + 240, 'Reminder: RFC-042 (event sourcing for the audit log) is open for comments until Friday. Link in <#c_eng>.'),
    M('u10', 1440 + 180, 'Who owns the Twitter account these days? Getting some questions about the pricing post that I want to answer.', {
      replies: [
        ['u14', 1440 + 175, 'That’s me. Send me the drafts and I’ll post.'],
        ['u10', 1440 + 170, ':salute: on it'],
      ],
    }),
    M('u11', 1440 + 120, 'Support volume is up ~30% since the pricing announcement, mostly billing questions. Nothing alarming, just FYI.', { reactions: [R('👍', ['u12', 'u7'])] }),
    M('u4', 1440 + 60, 'The new hover toolbar on messages is live on staging. Try reacting to something! :eyes:', {
      reactions: [R('👀', ['u1', 'u2', 'u9', 'u13']), R('🙌', ['u3', 'u10'])],
    }),
    M('u1', 1440 + 55, 'Looks great. The quick-react picks should probably be based on your recent emoji though, not a static set.'),
    M('u4', 1440 + 50, 'Yeah, that’s next. Static for now so we can ship.', { edited: true }),
    M('b_github', 1440 + 45, '', {
      attachments: [{ type: 'github', repo: 'playset/app', kind: 'Pull request opened', title: '#1438 feat(messages): hover action toolbar + quick reactions', by: 'diego-alvarez', branch: 'feat/hover-toolbar', meta: '+612 −48 · 14 files · 2 reviewers requested' }],
    }),
    M('u9', 1440 - 20, 'Ran the full regression suite against staging: *212 passed, 0 failed*. :white_check_mark:', { reactions: [R('✅', ['u2', 'u4', 'u6', 'u12'])] }),
    M('u12', 1440 - 60, 'Nice. Let’s ship it tomorrow morning PT.'),
    M('u3', 600, 'Morning! Sprint review is at 11. Agenda:\n• Hover toolbar demo (<@u4>)\n• Bug bash follow-ups (<@u9>)\n• SSO spec decision (<@me>)\n• Q3 OKR readout', {
      reactions: [R('☕', ['u2', 'u4', 'u9']), R('👍', ['u1'])],
    }),
    M('u7', 540, 'Back from vacation Friday — <@u11> is covering escalations until then. Thanks Aisha! :pray:'),
    M('u11', 535, 'Happy to! Enjoy the beach :beach_umbrella:'),
    M('u2', 420, 'Release 2.14.0 is out :ship:\n\n> *Highlights*\n> • Hover action toolbar on messages\n> • Faster channel switching (skeleton loading)\n> • 23 bug fixes from the bug bash\n\nFull changelog: https://github.com/playset/app/releases/tag/v2.14.0', {
      reactions: [R('🚢', ['me', 'u1', 'u3', 'u4', 'u6', 'u9', 'u10', 'u12']), R('🎉', ['u7', 'u11', 'u13'])],
      pinned: true,
      replies: [
        ['u10', 415, 'Drafting the release notes tweet now!'],
        ['u1', 410, 'The skeleton loading feels so much snappier :chef_kiss:'],
        ['u12', 300, 'Congrats team. Great sprint.'],
      ],
    }),
    M('b_vercel', 418, '', { attachments: [{ type: 'deploy', project: 'playset-app', env: 'Production', status: 'Ready', url: 'app.playset.dev', duration: '1m 42s', commit: 'a91f3c2 chore(release): v2.14.0' }] }),
    M('u4', 300, 'Anyone else seeing the sidebar flicker on channel switch in Safari? Can’t repro in Chrome.', {
      replies: [
        ['u2', 295, 'Yes, it’s the `will-change` on the list. Fix is small, PR in 10.'],
        ['u9', 280, 'Repro’d on Safari 18. Filed as #1442.'],
        ['u2', 240, 'Merged the fix. Should be gone after the next deploy.'],
        ['u4', 235, ':raised_hands:'],
      ],
    }),
    M('u10', 240, 'Pricing post hit 12k views. Best performing post this year :chart_with_upwards_trend:', { reactions: [R('📈', ['me', 'u14', 'u12', 'u3'])] }),
    M('u14', 180, 'Closed Northwind today — 240 seats on Pro :moneybag: Big thanks to <@u7> for the demo support and <@u11> for the trial help.', {
      reactions: [R('🎉', ['me', 'u1', 'u2', 'u3', 'u4', 'u6', 'u9', 'u10', 'u12', 'u13']), R('💰', ['u10', 'u12']), R('🙌', ['u7', 'u11'])],
    }),
    M('u12', 175, 'Huge. Congrats Omar :tada:'),
    M('u1', 150, '<@me> the Figma for the channel details modal is ready for review — the tabs are About / Members / Integrations / Settings like we discussed.', { saved: true, reactions: [R('👀', ['me'])] }),
    M('me', 140, 'Perfect, looking now. I like the About tab with the topic/description editing inline.'),
    M('u1', 138, 'Cool, I’ll spec the Settings tab next.'),
    M('u6', 95, 'FYI on-call handoff: <@u5> takes over from me at 6pm CET.'),
    M('u5', 90, 'Ack :saluting_face:'),
    M('u2', 70, 'Kicking off the huddle for the 2.14.1 hotfix triage if anyone wants to join.'),
    M('me', 69, '', { type: 'system', systemKind: 'huddle_ended', text: 'Huddle ended · 22 min · 4 participants' }),
    M('u3', 45, 'Quick one: are we okay to move sprint review to 11:30 next week? Conflicts with the Acme call.', {
      reactions: [R('👍', ['u1', 'u2', 'u4', 'u9', 'u12']), R('👎', [])],
    }),
    M('u9', 30, 'Fine by me.'),
    M('u4', 12, 'Pushed a fix for the emoji picker search — it was matching on category names instead of emoji names. :grimacing:', { reactions: [R('😅', ['u1', 'u9'])] }),
    M('u1', 4, 'Ha, that explains a lot. Thanks Diego!'),
  ];

  messages.c_announcements = [
    M('u12', 6 * 1440, ':loudspeaker: *Welcome to Playset!* This channel is for official announcements only. Posting is restricted to admins — reply in threads or take discussion to <#c_general>.', { pinned: true, reactions: [R('👋', ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'])] }),
    M('u12', 3 * 1440 + 30, ':calendar: *Q3 planning* starts Thursday. All-hands at 10am PT — Zoom link in the calendar invite. Recording will be posted here afterwards.', { reactions: [R('👍', humans.slice(0, 9))] }),
    M('u12', 1440 + 100, ':tada: Please welcome <@u13> (Mei), our new illustrator! Mei joins us from a studio in Tokyo and will be leading illustration for the product and marketing site. Say hi in <#c_random>!', {
      reactions: [R('🎉', ['me', 'u1', 'u2', 'u3', 'u4', 'u6', 'u9', 'u10']), R('👋', ['u5', 'u7', 'u11', 'u14']), R('🎨', ['u1'])],
      replies: [['u13', 1440 + 90, 'Thank you all, excited to be here! :bow:'], ['u1', 1440 + 88, 'So glad to have you Mei :heart:']],
    }),
    M('u12', 400, ':moneybag: *We closed Northwind* — our biggest deal to date. 240 seats on Pro. Thanks to everyone who pitched in on the trial. Details in <#c_general>.', { reactions: [R('🎉', ['me', ...humans])] }),
    M('u12', 200, ':closed_lock_with_key: Reminder: annual security training is due *Sept 30*. It takes ~25 minutes. Link in your email from Vanta.', { saved: true, reactions: [R('✅', ['u2', 'u5', 'u6', 'u9'])] }),
  ];

  messages.c_rebuild = [
    M('me', 5 * 1440, 'Starting a new side project: a pixel-faithful recreation of the Slack desktop shell as a static web app. No frameworks, no build step. This channel is for coordination.', {
      pinned: true,
      reactions: [R('🔥', ['u1', 'u2', 'u4', 'u9']), R('👀', ['u13'])],
    }),
    M('u1', 5 * 1440 - 20, 'Love it. I’ll pull the exact color tokens: Aubergine `#3F0E40` for the sidebar, `#350D36` for the top bar, `#1164A3` for the active item. Dark theme surfaces are `#1A1D21` / `#222529`.'),
    M('u4', 5 * 1440 - 40, 'The layout is a grid: 44px top bar, 70px rail, ~260px sidebar, 1fr main, optional ~400px right panel. Content frame has rounded corners on the top-left.', {
      replies: [
        ['me', 5 * 1440 - 30, 'Yep. And the sidebar should be resizable via a drag handle, 200–420px.'],
        ['u4', 5 * 1440 - 25, 'Easy enough with a pointer-move listener and a CSS variable.'],
      ],
    }),
    M('u2', 4 * 1440, 'Message list details I noticed:\n• Avatar 36px, radius 4px\n• 15px Lato, 1.46 line height\n• Messages group by author within 5 min; continuations show the time in the gutter on hover\n• Day dividers are pills on a hairline', { saved: true, reactions: [R('💯', ['me', 'u4'])] }),
    M('u9', 3 * 1440, 'I’ll write the Playwright smoke test: switch channel, open thread, send message, react, emoji picker, ⌘K, dark mode, prefs, huddle, responsive at 800 and 500.', { reactions: [R('🙏', ['me'])] }),
    M('u13', 2 * 1440, 'Mockups for the empty states in the Later and Activity views:', {
      attachments: [{ type: 'image', name: 'later-empty.png', gradient: grad('#FDF2F8', '#E0E7FF'), w: 320, h: 200, size: '145 KB' }, { type: 'image', name: 'activity-empty.png', gradient: grad('#ECFDF5', '#FEF3C7'), w: 320, h: 200, size: '152 KB' }],
      reactions: [R('😍', ['me', 'u1'])],
    }),
    M('b_github', 1440 + 30, '', { attachments: [{ type: 'github', repo: 'jmassion/slack-shell', kind: 'Push to main', title: '3 new commits', by: 'jmassion', branch: 'main', meta: 'feat: composer autocomplete for :emoji, @mentions, /commands' }] }),
    M('u1', 800, 'Reminder that the message hover toolbar should have quick reacts ✅ 👀 🙌, then react, reply in thread, forward, save, and the … menu.'),
    M('me', 780, 'Done. Also wired Copy link, Pin, Edit, Delete, Mark unread, and Remind me in the more menu.', { reactions: [R('✅', ['u1', 'u2'])] }),
    M('u4', 300, 'Themes: light, dark, plus Ochin `#303E4D`, Work Hard `#4D394B`, and Hoth (light gray). Persisted to localStorage, honoring `prefers-color-scheme` on first load.'),
    M('b_vercel', 120, '', { attachments: [{ type: 'deploy', project: 'slack-shell', env: 'Preview', status: 'Ready', url: 'slack-shell-git-main.vercel.app', duration: '0m 21s', commit: 'c4d19e7 feat: huddle bar + status modal' }] }),
    M('u2', 60, '<@me> ship it :ship: The only thing left is the single-file bundle in `dist/`.', { reactions: [R('🚢', ['me', 'u4'])] }),
  ];

  messages.c_website = [
    M('u10', 6 * 1440, 'Kicking off marketing site v2. Goal: launch Oct 1 with new pricing page, customer stories, and a proper docs entry point.', { pinned: true }),
    M('u1', 5 * 1440, 'Homepage hero explorations. Leaning toward option B.', {
      attachments: [{ type: 'image', name: 'hero-a.png', gradient: grad('#4A154B', '#E01E5A', '#ECB22E'), w: 360, h: 200, size: '1.1 MB' }, { type: 'image', name: 'hero-b.png', gradient: grad('#1264A3', '#36C5F0', '#2EB67D'), w: 360, h: 200, size: '1.0 MB' }],
      reactions: [R('🅱️', ['me', 'u4', 'u10', 'u14']), R('🅰️', ['u13'])],
      replies: [['u10', 5 * 1440 - 30, 'B for me. The gradient reads more “product” than “agency”.'], ['u14', 5 * 1440 - 60, 'B, and can we get the logo wall higher up?'], ['u1', 5 * 1440 - 70, 'Yes, moving it above the fold.']],
    }),
    M('u4', 3 * 1440, 'Lighthouse on the staging build: 98 / 100 / 100 / 100. The 2 points are the web font swap.', { reactions: [R('💯', ['u1', 'u10', 'u6'])] }),
    M('u6', 3 * 1440 - 40, 'We can preload Lato and self-host it, that gets rid of the swap.'),
    M('b_vercel', 2 * 1440, '', { attachments: [{ type: 'deploy', project: 'playset-www', env: 'Preview', status: 'Ready', url: 'playset-www-git-v2.vercel.app', duration: '0m 48s', commit: '7bd2a01 feat(pricing): comparison table' }] }),
    M('u14', 1440, 'Customer story from Northwind is approved by their comms team :white_check_mark: Copy in the doc.', { attachments: [{ type: 'file', name: 'Northwind-customer-story.docx', kind: 'docx', size: '48 KB' }], reactions: [R('🎉', ['u10', 'u1'])] }),
    M('u13', 500, 'Spot illustrations for the features section:', { attachments: [{ type: 'image', name: 'spot-workflows.png', gradient: grad('#FFE4E6', '#FECDD3'), w: 200, h: 200, size: '88 KB' }, { type: 'image', name: 'spot-search.png', gradient: grad('#DBEAFE', '#BFDBFE'), w: 200, h: 200, size: '92 KB' }, { type: 'image', name: 'spot-huddles.png', gradient: grad('#DCFCE7', '#BBF7D0'), w: 200, h: 200, size: '90 KB' }], reactions: [R('😍', ['u1', 'u10', 'me'])] }),
    M('u10', 90, '<@me> can you review the pricing page copy before Friday? Especially the FAQ section.', { saved: true }),
  ];

  messages.c_eng = [
    M('u2', 5 * 1440, '*RFC-042: Event sourcing for the audit log* is ready for review. Comments open until Friday.\nhttps://github.com/playset/rfcs/pull/42', {
      attachments: [{ type: 'link', url: 'https://github.com/playset/rfcs/pull/42', site: 'GitHub', title: 'RFC-042: Event sourcing for the audit log by marcus-chen · Pull Request #42', description: 'Proposes an append-only event store for audit events with projections into Postgres for querying. Includes migration plan and rollback strategy.', image: grad('#24292E', '#57606A') }],
      pinned: true,
      reactions: [R('👀', ['me', 'u5', 'u6', 'u8', 'u12'])],
      replies: [
        ['u5', 5 * 1440 - 60, 'Left comments on the projection rebuild section. Worried about rebuild time at our event volume.'],
        ['u2', 5 * 1440 - 50, 'Fair. I benchmarked ~2M events/min on a single worker; we could parallelize by tenant.'],
        ['u8', 5 * 1440 - 40, 'Kafka or Postgres for the store itself?'],
        ['u2', 5 * 1440 - 35, 'Postgres to start. We can move to Kafka if we outgrow it, the interface is the same.'],
        ['u12', 4 * 1440, 'Approve in principle. Let’s do a 2-week spike before committing.'],
        ['u6', 4 * 1440 - 30, 'Can we make sure the store is in its own database so backups are independent?'],
        ['u2', 4 * 1440 - 20, 'Yes, added to the RFC.'],
      ],
    }),
    M('b_pagerduty', 4 * 1440 + 100, '', { attachments: [{ type: 'alert', severity: 'high', title: '[P2] API latency p99 > 2s (us-east-1)', service: 'api-gateway', status: 'Resolved', assignee: 'u6', duration: '14 min' }] }),
    M('u6', 4 * 1440 + 80, 'Postmortem for the latency blip: a bad deploy of the rate limiter caused a hot loop. Rolled back in 14 min. Writeup incoming.', { reactions: [R('🙏', ['u2', 'u12'])] }),
    M('u5', 3 * 1440, 'Postgres 16 upgrade on staging done. Prod scheduled for Saturday 02:00 UTC. ~5 min of downtime, we’ll put up the maintenance page.', {
      reactions: [R('👍', ['u2', 'u6', 'u12'])],
      replies: [['u12', 3 * 1440 - 10, 'Status page post scheduled?'], ['u5', 3 * 1440 - 8, 'Yes, drafted and scheduled for Friday.']],
    }),
    M('u4', 2 * 1440, 'Proposal: adopt `biome` for lint+format and drop eslint+prettier. It’s ~20x faster and one config. Thoughts?', {
      reactions: [R('👍', ['u2', 'u9']), R('🤔', ['u5', 'u8'])],
      replies: [['u2', 2 * 1440 - 20, 'Plugin coverage is the question. We rely on a few eslint plugins for a11y.'], ['u4', 2 * 1440 - 15, 'Biome has a11y rules built in now. I’ll do a diff of what we’d lose.'], ['u9', 2 * 1440 - 10, 'As long as CI time goes down I’m in.']],
    }),
    M('b_github', 1440 + 200, '', { attachments: [{ type: 'github', repo: 'playset/app', kind: 'Pull request merged', title: '#1435 fix(api): rate limiter hot loop on burst', by: 'tomas-lindqvist', branch: 'fix/ratelimit-loop', meta: '+14 −6 · 2 files' }] }),
    M('u8', 1440, '`events` table will be dropped on Monday. If you have anything still reading from it, migrate to `events_v2` this week. Ping me with questions.', { reactions: [R('👍', ['u2', 'u5', 'u6'])] }),
    M('u2', 600, '<@me> RFC-042 needs your sign-off — you’re the last reviewer.', { saved: true }),
    M('me', 590, 'On it today.'),
    M('u9', 200, 'Flaky test alert: `thread-panel.spec.ts › closes on escape` failed 3 of the last 20 runs. Anyone touching that area?', { replies: [['u4', 190, 'That’s mine. It’s a focus timing thing, fixing.']] }),
    M('u6', 40, 'On-call handoff to <@u5> at 6pm CET. Quiet week so far :crossed_fingers:'),
  ];

  messages.c_design = [
    M('u1', 6 * 1440, 'Crit agenda for Tuesday: composer redesign, thread panel density, and the new empty states.', { pinned: true }),
    M('u1', 4 * 1440, 'Composer v3 explorations. Rounded box, toolbar on top, actions on the bottom row — matching the direction we agreed on.', {
      attachments: [{ type: 'image', name: 'composer-v3-light.png', gradient: grad('#F8FAFC', '#E2E8F0'), w: 420, h: 180, size: '420 KB' }, { type: 'image', name: 'composer-v3-dark.png', gradient: grad('#1A1D21', '#35373B'), w: 420, h: 180, size: '410 KB' }],
      reactions: [R('😍', ['me', 'u4', 'u3', 'u13']), R('🔥', ['u2'])],
      replies: [['u4', 4 * 1440 - 30, 'The send button with the caret dropdown is a nice touch.'], ['u3', 4 * 1440 - 20, 'Can the placeholder say “Message #channel-name”?'], ['u1', 4 * 1440 - 10, 'Yes, that’s the plan.']],
    }),
    M('u13', 3 * 1440, 'Icon set v2 — 20px, 1.5px stroke, rounded caps. Replaces the mixed set we had.', {
      attachments: [{ type: 'image', name: 'icons-v2-sheet.png', gradient: grad('#FEF9C3', '#FDE68A'), w: 480, h: 240, size: '760 KB' }],
      reactions: [R('👏', ['u1', 'u4', 'me'])],
    }),
    M('u3', 2 * 1440, 'From the customer interviews: 6 of 8 people said the thread panel feels cramped. Worth a look at density.', { reactions: [R('👀', ['u1'])] }),
    M('u1', 2 * 1440 - 30, 'Agreed. Trying 8px more vertical padding and a slightly larger reply font.'),
    M('u4', 1440, 'Implemented the day-divider pills. Screenshot:', { attachments: [{ type: 'image', name: 'day-dividers.png', gradient: grad('#FFFFFF', '#F1F5F9'), w: 400, h: 120, size: '64 KB' }], reactions: [R('✅', ['u1', 'u13'])] }),
    M('u1', 500, 'Dark mode palette locked: surfaces `#1A1D21` / `#222529`, text `#D1D2D3`, secondary `#ABABAD`, borders `#35373B`, link `#1D9BD1`.', { saved: true, reactions: [R('🌙', ['me', 'u4'])] }),
    M('u13', 120, 'Empty state illustrations in dark mode :crescent_moon:', { attachments: [{ type: 'image', name: 'empty-dark-1.png', gradient: grad('#1E1B4B', '#312E81'), w: 320, h: 200, size: '210 KB' }, { type: 'image', name: 'empty-dark-2.png', gradient: grad('#134E4A', '#115E59'), w: 320, h: 200, size: '205 KB' }], reactions: [R('😍', ['u1', 'me', 'u3'])] }),
  ];

  messages.c_random = [
    M('u10', 5 * 1440, 'Friday playlist is up :musical_note: :headphones: mostly synthwave this week.', { reactions: [R('🎶', ['u4', 'u1', 'u13']), R('🕺', ['u14'])] }),
    M('u4', 4 * 1440, 'My sourdough finally rose :bread: :raised_hands: after four failed attempts', { attachments: [{ type: 'image', name: 'IMG_4821.jpg', gradient: grad('#D97706', '#FCD34D'), w: 320, h: 240, size: '2.1 MB' }], reactions: [R('🍞', ['u1', 'u2', 'u3', 'u9', 'u10']), R('👨‍🍳', ['u6']), R('😂', ['u14'])], replies: [['u6', 4 * 1440 - 20, 'The fifth time’s the charm :chef_kiss:'], ['u4', 4 * 1440 - 15, 'Turns out my kitchen was just too cold :cold_face:']] }),
    M('u9', 3 * 1440, 'Cat tax :cat: she sat on my keyboard during the regression run and somehow all tests still passed', { attachments: [{ type: 'image', name: 'IMG_2201.jpg', gradient: grad('#6B7280', '#D1D5DB'), w: 320, h: 320, size: '1.8 MB' }], reactions: [R('😻', ['me', 'u1', 'u3', 'u4', 'u7', 'u10', 'u13']), R('😂', ['u2', 'u6'])] }),
    M('u14', 2 * 1440, 'Anyone in Dubai next month? :airplane: :palm_tree: Happy to show you around.'),
    M('u13', 1440 + 300, 'Hi everyone! :wave: Thanks for the warm welcome. Fun fact: I draw all my illustrations on an iPad on the Tokyo subway :train:', { reactions: [R('👋', ['me', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u9', 'u10']), R('🚇', ['u4']), R('🎨', ['u1', 'u3'])] }),
    M('u2', 1440, 'Hot take: tabs > spaces :fire: :fire: :fire:', { reactions: [R('🔥', ['u6', 'u8']), R('🙅', ['u4', 'u5', 'u9', 'u1']), R('🍿', ['me', 'u10'])], replies: [['u4', 1440 - 5, 'Reported :rotating_light:'], ['u5', 1440 - 3, 'This is a workplace, Marcus'], ['u2', 1440 - 1, ':innocent:']] }),
    M('u7', 800, 'Greetings from the beach :sunny: :beach_umbrella: :cocktail: don’t @ me', { attachments: [{ type: 'image', name: 'beach.jpg', gradient: grad('#38BDF8', '#FDE68A'), w: 360, h: 240, size: '3.2 MB' }], reactions: [R('😎', ['u1', 'u3', 'u10', 'u11', 'u14']), R('🍹', ['me', 'u4'])] }),
    M('u10', 400, 'Lunch poll winner: tacos :taco: :taco: :taco: see you all Friday at noon!', { reactions: [R('🌮', ['me', 'u1', 'u4', 'u14']), R('🎉', ['u3'])] }),
    M('u6', 100, 'TIL you can type `/shrug` in Slack :shrug:'),
    M('u4', 95, '¯\\_(ツ)_/¯', { reactions: [R('😂', ['u6', 'u9'])] }),
  ];

  messages.c_product = [
    M('u3', 6 * 1440, ':compass: *Q3 roadmap* — SSO, workflows v2, and the new activity view. Full doc in the canvas.', { pinned: true, attachments: [{ type: 'canvas', title: 'Q3 Product Roadmap', excerpt: 'Themes: Enterprise readiness (SSO, audit log), Power users (workflows v2, shortcuts), Delight (activity view, new empty states).', updated: 'Edited yesterday', by: 'u3' }], reactions: [R('👍', ['me', 'u1', 'u2', 'u12'])] }),
    M('u7', 3 * 1440 + 120, '*Acme call notes*\n• They want SSO on Pro, not just Enterprise\n• Love the new pricing simplicity\n• Asked about SCIM provisioning (not urgent)\n• Renewal in Nov, 180 seats', { saved: true, reactions: [R('📝', ['u3', 'u12', 'u14'])], replies: [['u3', 3 * 1440 + 100, 'SSO on Pro is going to come up a lot. Adding to the pricing discussion.'], ['u12', 3 * 1440 + 60, 'Let’s look at the margin impact first.']] }),
    M('u3', 2 * 1440, 'Draft SSO spec v2 attached. Key question: SAML vs OIDC first?', { attachments: [{ type: 'file', name: 'SSO-spec-v2.pdf', kind: 'pdf', size: '2.4 MB', pages: 11 }] }),
    M('u14', 1440 + 60, 'Three prospects this week asked about a Slack export/import. Worth a look?', { reactions: [R('🤔', ['u3', 'u12'])] }),
    M('u3', 700, '<@me> could you weigh in on the export question above? Feels like a nice wedge.', { saved: true }),
    M('u1', 300, 'Activity view designs are in Figma — tabs for All / Mentions / Threads / Reactions.', { reactions: [R('👀', ['u3', 'me'])] }),
  ];

  messages.c_support = [
    M('u11', 4 * 1440, ':rotating_light: *ESC-2291* — Northwind (trial) can’t invite users via CSV. Error 500 on upload. P1 since they’re evaluating this week.', { pinned: true, reactions: [R('👀', ['u2', 'u12'])], replies: [['u2', 4 * 1440 - 30, 'Looking. Probably the BOM handling in the parser.'], ['u2', 4 * 1440 - 60, 'Confirmed. Fix deployed, they can retry.'], ['u11', 4 * 1440 - 70, 'They confirmed it works. Thanks Marcus :pray:']] }),
    M('b_pagerduty', 3 * 1440, '', { attachments: [{ type: 'alert', severity: 'critical', title: '[P1] ESC-2291 CSV invite failing for Northwind', service: 'support-escalations', status: 'Resolved', assignee: 'u2', duration: '1h 12m' }] }),
    M('u7', 2 * 1440, '*ESC-2294* — Globex reports missing notifications on mobile. Only Android. Ticket has device logs.', { reactions: [R('👀', ['u2'])], replies: [['u2', 2 * 1440 - 100, 'FCM token refresh issue. Known, fix is in 2.14.1.']] }),
    M('u11', 400, '*ESC-2301* — Initech asking for a data export before their renewal. Non-urgent but <@me> they asked for you specifically.', { saved: true }),
    M('u12', 380, 'I can take that call with you Justin, they’re a strategic account.'),
  ];

  messages.c_ops = [
    M('b_datadog', 5 * 1440, '', { attachments: [{ type: 'alert', severity: 'warn', title: '[Warn] Disk usage > 80% on db-replica-2', service: 'postgres', status: 'Triggered', duration: '' }] }),
    M('b_datadog', 5 * 1440 - 30, '', { attachments: [{ type: 'alert', severity: 'ok', title: '[Recovered] Disk usage > 80% on db-replica-2', service: 'postgres', status: 'Recovered', duration: '30 min' }] }),
    M('b_pagerduty', 4 * 1440 + 100, '', { attachments: [{ type: 'alert', severity: 'high', title: '[P2] API latency p99 > 2s (us-east-1)', service: 'api-gateway', status: 'Resolved', assignee: 'u6', duration: '14 min' }] }),
    M('b_datadog', 3 * 1440, '', { attachments: [{ type: 'alert', severity: 'warn', title: '[Warn] Error rate > 1% on web (5m)', service: 'web', status: 'Triggered', duration: '' }] }),
    M('b_datadog', 3 * 1440 - 8, '', { attachments: [{ type: 'alert', severity: 'ok', title: '[Recovered] Error rate > 1% on web (5m)', service: 'web', status: 'Recovered', duration: '8 min' }] }),
    M('u6', 2 * 1440, 'Tuned the error-rate monitor threshold to 2% over 10m — the 1% one was too noisy during deploys.', { reactions: [R('👍', ['u2', 'u5'])] }),
    M('b_datadog', 1440, '', { attachments: [{ type: 'alert', severity: 'warn', title: '[Warn] Redis memory > 75% (cache-1)', service: 'redis', status: 'Triggered', duration: '' }] }),
    M('b_datadog', 1440 - 45, '', { attachments: [{ type: 'alert', severity: 'ok', title: '[Recovered] Redis memory > 75% (cache-1)', service: 'redis', status: 'Recovered', duration: '45 min' }] }),
    M('b_pagerduty', 300, '', { attachments: [{ type: 'alert', severity: 'low', title: '[P4] Scheduled: Postgres 16 prod upgrade Sat 02:00 UTC', service: 'postgres', status: 'Scheduled', assignee: 'u5', duration: '' }] }),
    M('b_datadog', 20, '', { attachments: [{ type: 'alert', severity: 'ok', title: '[OK] Daily synthetic checks: 48/48 passing', service: 'synthetics', status: 'OK', duration: '' }] }),
  ];

  messages.d_u1 = [
    M('u1', 3 * 1440, 'Hey! Do you have 15 min tomorrow to go over the channel details modal?'),
    M('me', 3 * 1440 - 10, 'Sure, 10am works?'),
    M('u1', 3 * 1440 - 12, 'Perfect :+1:'),
    M('u1', 1440, 'Sent you the Figma link. The Members tab uses the same row component as the sidebar DMs.'),
    M('me', 1440 - 20, 'Nice, that’ll make it easy to build.'),
    M('u1', 200, 'Also — Mei’s dark mode illustrations are :chef_kiss: you should look'),
    M('u1', 25, 'One more thing: can we make the emoji picker preview footer show the shortcode too? Like `:tada:`', { reactions: [R('👍', ['me'])] }),
  ];
  messages.d_u2 = [
    M('u2', 4 * 1440, 'RFC-042 is up. Would love your eyes on the projection section especially.'),
    M('me', 4 * 1440 - 30, 'Will do this week.'),
    M('u2', 1440, 'Btw the Safari flicker is fixed, it was `will-change: transform` on the sidebar list.'),
    M('me', 1440 - 5, 'Ah classic. Thanks!'),
    M('u2', 50, 'Are you around for the hotfix triage huddle?'),
    M('u2', 15, 'nvm we wrapped. 2.14.1 goes out tomorrow AM.'),
  ];
  messages.d_u3 = [
    M('u3', 2 * 1440, 'Can you review the SSO spec before Thursday? :pray:'),
    M('me', 2 * 1440 - 60, 'Yes — OIDC first is my instinct but let me read it properly.'),
    M('u3', 600, 'Moving sprint review to 11:30 next week if that works?'),
    M('me', 590, 'Works for me.'),
    M('u3', 35, 'Acme wants a follow-up call Friday. Can you join? They asked about the roadmap.'),
  ];
  messages.d_u4 = [
    M('u4', 5 * 1440, 'Hover toolbar branch is up if you want an early look'),
    M('me', 5 * 1440 - 10, 'Looking :eyes:'),
    M('me', 5 * 1440 - 5, 'This is great. Can the quick-react set be configurable later?'),
    M('u4', 5 * 1440 - 3, 'Yeah, planning to base it on recently used.'),
    M('u4', 300, 'Emoji picker search fix is merged :tada:'),
  ];
  messages.d_u9 = [
    M('u9', 2 * 1440, 'Bug bash: 41 filed, 12 P1. Nice work on the composer, only 3 of those are yours :wink:'),
    M('me', 2 * 1440 - 15, 'Ha, I’ll take it. Send me the list?'),
    M('u9', 2 * 1440 - 14, 'Attached in #general :point_up:'),
    M('u9', 180, 'Regression suite is green against 2.14.0 :white_check_mark:'),
  ];
  messages.d_u12 = [
    M('u12', 3 * 1440, 'Great quarter so far. Let’s chat about hiring next week — I think we need one more backend engineer.'),
    M('me', 3 * 1440 - 30, 'Agreed. Sofia is stretched thin with the Postgres work.'),
    M('u12', 1440, 'Northwind closing today probably. Omar’s been great.'),
    M('u12', 400, 'And… closed :tada: 240 seats.'),
    M('me', 395, 'Incredible. Big milestone.'),
  ];
  messages.d_group = [
    M('u1', 2 * 1440, 'Design + eng sync: are we happy with the thread panel density now?'),
    M('u4', 2 * 1440 - 10, 'I bumped the padding to 12px. Feels better.'),
    M('u2', 2 * 1440 - 8, 'Ship it. We can adjust after the bug bash feedback.'),
    M('me', 2 * 1440 - 5, ':+1: from me'),
    M('u1', 60, 'Reminder: crit is Tuesday 11am. Bring the composer variants!', { reactions: [R('👍', ['me', 'u2', 'u4'])] }),
  ];
  messages.d_me = [
    M('me', 6 * 1440, 'Notes to self :memo:\n• Follow up with Priya on SSO\n• Review RFC-042\n• Book flights for the offsite'),
    M('me', 2 * 1440, 'Slack shell TODO:\n• Composer autocomplete :white_check_mark:\n• Emoji picker :white_check_mark:\n• Huddle bar\n• Preferences modal\n• Single-file bundle'),
    M('me', 100, 'Idea: quick switcher should show recent conversations first, then fuzzy matches.'),
  ];

  /* Last-read markers: which conversations have unread messages initially */
  const lastRead = {
    c_general: ago(100),        // a few unread incl. the huddle + emoji fix
    c_announcements: ago(250),  // security reminder unread (mention-less)
    c_rebuild: ago(70),         // unread mention from Marcus
    c_website: ago(100),        // unread mention from Noah
    c_eng: ago(30),             // read
    c_design: ago(150),         // one unread
    c_random: ago(0),
    c_product: ago(0),
    c_support: ago(0),
    c_ops: ago(1440 + 10),      // several unread (muted)
    d_u1: ago(30),              // one unread
    d_u2: ago(20),              // one unread
    d_u3: ago(40),              // one unread
    d_u4: ago(0), d_u9: ago(0), d_u12: ago(0), d_group: ago(0), d_me: ago(0),
  };

  /* ---------------- Canvases / Files / Workflows ---------------- */
  const canvases = [
    { id: 'cv1', title: 'Q3 Planning — OKR drafts', channel: 'c_general', by: 'u12', updated: ago(2 * 1440), excerpt: 'One page per team. Keep it to 3 objectives, 3 KRs each.', color: grad('#4A154B', '#7C3085') },
    { id: 'cv2', title: 'Q3 Product Roadmap', channel: 'c_product', by: 'u3', updated: ago(1440), excerpt: 'Themes: Enterprise readiness, Power users, Delight.', color: grad('#1264A3', '#36C5F0') },
    { id: 'cv3', title: 'Slack Shell — build notes', channel: 'c_rebuild', by: 'me', updated: ago(120), excerpt: 'Layout grid, color tokens, keyboard shortcuts, verification checklist.', color: grad('#0B8043', '#2EB67D') },
    { id: 'cv4', title: 'Onboarding checklist', channel: null, by: 'u7', updated: ago(5 * 1440), excerpt: 'Everything a new hire needs in week one.', color: grad('#E8912D', '#ECB22E') },
    { id: 'cv5', title: 'Incident response runbook', channel: 'c_eng', by: 'u6', updated: ago(9 * 1440), excerpt: 'Sev levels, paging, comms templates, postmortem format.', color: grad('#DE4E2B', '#E01E5A') },
    { id: 'cv6', title: 'Design principles', channel: 'c_design', by: 'u1', updated: ago(20 * 1440), excerpt: 'Clarity over cleverness. Density with breathing room. Motion with purpose.', color: grad('#C2185B', '#7C3085') },
  ];
  const workflows = [
    { id: 'wf1', name: 'New hire welcome', trigger: 'When someone joins #general', runs: 14, by: 'u7', status: 'Published' },
    { id: 'wf2', name: 'Incident kickoff', trigger: 'Shortcut in #engineering', runs: 6, by: 'u6', status: 'Published' },
    { id: 'wf3', name: 'Weekly standup', trigger: 'Every Monday at 9:00 AM', runs: 52, by: 'u3', status: 'Published' },
    { id: 'wf4', name: 'Escalation intake form', trigger: 'Shortcut in #support-escalations', runs: 23, by: 'u11', status: 'Published' },
    { id: 'wf5', name: 'Design crit signup', trigger: 'Every Monday at 4:00 PM', runs: 18, by: 'u1', status: 'Draft' },
  ];
  const externalConnections = [
    { id: 'x1', name: 'Northwind Traders', type: 'Slack Connect channel', channel: 'ext-northwind', members: 6, status: 'Active' },
    { id: 'x2', name: 'Acme Corp', type: 'Slack Connect channel', channel: 'ext-acme-support', members: 4, status: 'Active' },
    { id: 'x3', name: 'Globex', type: 'Slack Connect DM', channel: null, members: 2, status: 'Pending' },
  ];

  /* ---------------- Emoji ---------------- */
  // Compact: category -> "name emoji|name emoji|..."
  const EMOJI_SRC = {
    'Smileys & Emotion': 'grinning 😀|smiley 😃|smile 😄|grin 😁|laughing 😆|sweat_smile 😅|rofl 🤣|joy 😂|slightly_smiling_face 🙂|upside_down_face 🙃|wink 😉|blush 😊|innocent 😇|smiling_face_with_three_hearts 🥰|heart_eyes 😍|star_struck 🤩|kissing_heart 😘|relaxed ☺️|yum 😋|stuck_out_tongue 😛|stuck_out_tongue_winking_eye 😜|zany_face 🤪|money_mouth_face 🤑|hugs 🤗|hand_over_mouth 🤭|shushing_face 🤫|thinking 🤔|zipper_mouth_face 🤐|neutral_face 😐|expressionless 😑|no_mouth 😶|smirk 😏|unamused 😒|roll_eyes 🙄|grimacing 😬|lying_face 🤥|relieved 😌|pensive 😔|sleepy 😪|sleeping 😴|mask 😷|face_with_thermometer 🤒|nauseated_face 🤢|sneezing_face 🤧|hot_face 🥵|cold_face 🥶|woozy_face 🥴|dizzy_face 😵|exploding_head 🤯|cowboy_hat_face 🤠|partying_face 🥳|sunglasses 😎|nerd_face 🤓|monocle_face 🧐|confused 😕|worried 😟|slightly_frowning_face 🙁|open_mouth 😮|hushed 😯|astonished 😲|flushed 😳|pleading_face 🥺|frowning 😦|anguished 😧|fearful 😨|cold_sweat 😰|disappointed_relieved 😥|cry 😢|sob 😭|scream 😱|confounded 😖|persevere 😣|disappointed 😞|sweat 😓|weary 😩|tired_face 😫|yawning_face 🥱|triumph 😤|rage 😡|angry 😠|cursing_face 🤬|smiling_imp 😈|skull 💀|poop 💩|clown_face 🤡|ghost 👻|alien 👽|robot 🤖|saluting_face 🫡|melting_face 🫠|chef_kiss 🤌|heart ❤️|orange_heart 🧡|yellow_heart 💛|green_heart 💚|blue_heart 💙|purple_heart 💜|black_heart 🖤|white_heart 🤍|broken_heart 💔|two_hearts 💕|sparkling_heart 💖|heartpulse 💗|kiss 💋|100 💯|anger 💢|boom 💥|dizzy 💫|sweat_drops 💦|dash 💨|speech_balloon 💬|thought_balloon 💭|zzz 💤',
    'People & Body': 'wave 👋|raised_back_of_hand 🤚|raised_hand ✋|vulcan_salute 🖖|ok_hand 👌|pinched_fingers 🤌|v ✌️|crossed_fingers 🤞|love_you_gesture 🤟|metal 🤘|call_me_hand 🤙|point_left 👈|point_right 👉|point_up_2 👆|middle_finger 🖕|point_down 👇|point_up ☝️|+1 👍|thumbsup 👍|-1 👎|thumbsdown 👎|fist ✊|facepunch 👊|clap 👏|raised_hands 🙌|open_hands 👐|palms_up_together 🤲|handshake 🤝|pray 🙏|writing_hand ✍️|nail_care 💅|selfie 🤳|muscle 💪|ear 👂|nose 👃|brain 🧠|eyes 👀|eye 👁️|tongue 👅|lips 👄|baby 👶|child 🧒|boy 👦|girl 👧|adult 🧑|man 👨|woman 👩|older_adult 🧓|person_facepalming 🤦|shrug 🤷|person_shrugging 🤷|person_tipping_hand 💁|person_raising_hand 🙋|person_bowing 🙇|bow 🙇|no_good 🙅|ok_person 🙆|dancer 💃|man_dancing 🕺|technologist 🧑‍💻|cook 👨‍🍳|artist 👩‍🎨|detective 🕵️|superhero 🦸|zombie 🧟|runner 🏃|walking 🚶|family 👪|couple 👫|bust_in_silhouette 👤|busts_in_silhouette 👥|footprints 👣',
    'Animals & Nature': 'dog 🐶|cat 🐱|mouse 🐭|hamster 🐹|rabbit 🐰|fox_face 🦊|bear 🐻|panda_face 🐼|koala 🐨|tiger 🐯|lion 🦁|cow 🐮|pig 🐷|frog 🐸|monkey_face 🐵|see_no_evil 🙈|hear_no_evil 🙉|speak_no_evil 🙊|chicken 🐔|penguin 🐧|bird 🐦|hatched_chick 🐥|duck 🦆|eagle 🦅|owl 🦉|bat 🦇|wolf 🐺|boar 🐗|horse 🐴|unicorn 🦄|bee 🐝|bug 🐛|butterfly 🦋|snail 🐌|lady_beetle 🐞|ant 🐜|spider 🕷️|turtle 🐢|snake 🐍|lizard 🦎|t-rex 🦖|octopus 🐙|squid 🦑|shrimp 🦐|crab 🦀|blowfish 🐡|tropical_fish 🐠|fish 🐟|dolphin 🐬|whale 🐳|shark 🦈|crocodile 🐊|elephant 🐘|giraffe 🦒|sloth 🦥|otter 🦦|cat2 🐈|heart_eyes_cat 😻|smiley_cat 😺|bouquet 💐|cherry_blossom 🌸|rose 🌹|hibiscus 🌺|sunflower 🌻|blossom 🌼|tulip 🌷|seedling 🌱|evergreen_tree 🌲|deciduous_tree 🌳|palm_tree 🌴|cactus 🌵|herb 🌿|shamrock ☘️|four_leaf_clover 🍀|maple_leaf 🍁|fallen_leaf 🍂|mushroom 🍄|earth_americas 🌎|full_moon 🌕|crescent_moon 🌙|star ⭐|star2 🌟|sparkles ✨|zap ⚡|fire 🔥|rainbow 🌈|sunny ☀️|cloud ☁️|umbrella ☔|snowflake ❄️|snowman ⛄|ocean 🌊|comet ☄️',
    'Food & Drink': 'green_apple 🍏|apple 🍎|pear 🍐|tangerine 🍊|lemon 🍋|banana 🍌|watermelon 🍉|grapes 🍇|strawberry 🍓|melon 🍈|cherries 🍒|peach 🍑|mango 🥭|pineapple 🍍|coconut 🥥|kiwi_fruit 🥝|tomato 🍅|avocado 🥑|eggplant 🍆|potato 🥔|carrot 🥕|corn 🌽|hot_pepper 🌶️|broccoli 🥦|croissant 🥐|bread 🍞|baguette_bread 🥖|pretzel 🥨|cheese 🧀|egg 🥚|bacon 🥓|pancakes 🥞|waffle 🧇|fried_shrimp 🍤|poultry_leg 🍗|hamburger 🍔|fries 🍟|pizza 🍕|hotdog 🌭|sandwich 🥪|taco 🌮|burrito 🌯|salad 🥗|ramen 🍜|spaghetti 🍝|stew 🍲|curry 🍛|sushi 🍣|bento 🍱|dumpling 🥟|rice 🍚|rice_ball 🍙|oden 🍢|dango 🍡|shaved_ice 🍧|ice_cream 🍨|icecream 🍦|pie 🥧|cake 🍰|birthday 🎂|cupcake 🧁|lollipop 🍭|candy 🍬|chocolate_bar 🍫|popcorn 🍿|doughnut 🍩|cookie 🍪|honey_pot 🍯|baby_bottle 🍼|glass_of_milk 🥛|coffee ☕|tea 🍵|sake 🍶|beer 🍺|beers 🍻|clinking_glasses 🥂|wine_glass 🍷|tumbler_glass 🥃|cocktail 🍸|tropical_drink 🍹|champagne 🍾|bubble_tea 🧋|cup_with_straw 🥤|fork_and_knife 🍴|plate_with_cutlery 🍽️|chopsticks 🥢|salt 🧂',
    'Activities': 'soccer ⚽|basketball 🏀|football 🏈|baseball ⚾|softball 🥎|tennis 🎾|volleyball 🏐|rugby_football 🏉|8ball 🎱|ping_pong 🏓|badminton 🏸|goal_net 🥅|golf ⛳|ice_skate ⛸️|fishing_pole_and_fish 🎣|boxing_glove 🥊|martial_arts_uniform 🥋|ski 🎿|sled 🛷|curling_stone 🥌|dart 🎯|yo_yo 🪀|kite 🪁|8ball 🎱|video_game 🎮|joystick 🕹️|slot_machine 🎰|game_die 🎲|jigsaw 🧩|chess_pawn ♟️|teddy_bear 🧸|performing_arts 🎭|art 🎨|thread 🧵|yarn 🧶|musical_note 🎵|notes 🎶|microphone 🎤|headphones 🎧|radio 📻|saxophone 🎷|guitar 🎸|musical_keyboard 🎹|trumpet 🎺|violin 🎻|drum 🥁|clapper 🎬|bow_and_arrow 🏹|trophy 🏆|medal_sports 🏅|1st_place_medal 🥇|2nd_place_medal 🥈|3rd_place_medal 🥉|ticket 🎫|tickets 🎟️|circus_tent 🎪|jack_o_lantern 🎃|christmas_tree 🎄|fireworks 🎆|sparkler 🎇|balloon 🎈|tada 🎉|confetti_ball 🎊|tanabata_tree 🎋|ribbon 🎀|gift 🎁|reminder_ribbon 🎗️|running_shirt_with_sash 🎽|rotating_light 🚨',
    'Travel & Places': 'car 🚗|taxi 🚕|blue_car 🚙|bus 🚌|trolleybus 🚎|racing_car 🏎️|police_car 🚓|ambulance 🚑|fire_engine 🚒|minibus 🚐|truck 🚚|articulated_lorry 🚛|tractor 🚜|kick_scooter 🛴|bike 🚲|motor_scooter 🛵|motorcycle 🏍️|rotating_light 🚨|traffic_light 🚦|construction 🚧|anchor ⚓|sailboat ⛵|canoe 🛶|speedboat 🚤|ship 🚢|airplane ✈️|small_airplane 🛩️|flight_departure 🛫|flight_arrival 🛬|seat 💺|helicopter 🚁|rocket 🚀|flying_saucer 🛸|bullettrain_side 🚄|train 🚋|metro 🚇|tram 🚊|station 🚉|mountain ⛰️|volcano 🌋|mount_fuji 🗻|camping 🏕️|beach_umbrella 🏖️|desert 🏜️|desert_island 🏝️|national_park 🏞️|stadium 🏟️|classical_building 🏛️|building_construction 🏗️|houses 🏘️|house 🏠|house_with_garden 🏡|office 🏢|hospital 🏥|bank 🏦|hotel 🏨|convenience_store 🏪|school 🏫|department_store 🏬|factory 🏭|japanese_castle 🏯|european_castle 🏰|wedding 💒|tokyo_tower 🗼|statue_of_liberty 🗽|church ⛪|mosque 🕌|fountain ⛲|tent ⛺|foggy 🌁|night_with_stars 🌃|cityscape 🏙️|sunrise_over_mountains 🌄|sunrise 🌅|city_sunset 🌇|bridge_at_night 🌉|milky_way 🌌|carousel_horse 🎠|ferris_wheel 🎡|roller_coaster 🎢|world_map 🗺️|compass 🧭|hourglass ⌛|watch ⌚|alarm_clock ⏰|stopwatch ⏱️|timer_clock ⏲️|mantelpiece_clock 🕰️',
    'Objects': 'iphone 📱|computer 💻|desktop_computer 🖥️|printer 🖨️|keyboard ⌨️|computer_mouse 🖱️|floppy_disk 💾|cd 💿|dvd 📀|camera 📷|video_camera 📹|movie_camera 🎥|tv 📺|telephone ☎️|pager 📟|fax 📠|battery 🔋|electric_plug 🔌|bulb 💡|flashlight 🔦|candle 🕯️|wastebasket 🗑️|moneybag 💰|dollar 💵|credit_card 💳|gem 💎|hammer 🔨|wrench 🔧|nut_and_bolt 🔩|gear ⚙️|toolbox 🧰|magnet 🧲|microscope 🔬|telescope 🔭|satellite 📡|syringe 💉|pill 💊|door 🚪|bed 🛏️|couch_and_lamp 🛋️|toilet 🚽|shower 🚿|bathtub 🛁|shopping_cart 🛒|gift 🎁|balloon 🎈|envelope ✉️|email 📧|incoming_envelope 📨|mailbox 📫|package 📦|memo 📝|pencil2 ✏️|black_nib ✒️|fountain_pen 🖋️|pen 🖊️|paintbrush 🖌️|crayon 🖍️|briefcase 💼|file_folder 📁|open_file_folder 📂|card_index_dividers 🗂️|date 📅|calendar 📆|spiral_notepad 🗒️|spiral_calendar 🗓️|card_index 📇|chart_with_upwards_trend 📈|chart_with_downwards_trend 📉|bar_chart 📊|clipboard 📋|pushpin 📌|round_pushpin 📍|paperclip 📎|paperclips 🖇️|straight_ruler 📏|triangular_ruler 📐|scissors ✂️|lock 🔒|unlock 🔓|closed_lock_with_key 🔐|key 🔑|old_key 🗝️|bookmark 🔖|label 🏷️|books 📚|book 📖|newspaper 📰|link 🔗|mag 🔍|mag_right 🔎|loudspeaker 📢|mega 📣|bell 🔔|no_bell 🔕|hourglass_flowing_sand ⏳|shield 🛡️|crown 👑|tophat 🎩|mortar_board 🎓|eyeglasses 👓|dark_sunglasses 🕶️|necktie 👔|shirt 👕|jeans 👖|dress 👗|coat 🧥|socks 🧦|handbag 👜|school_satchel 🎒|athletic_shoe 👟|ring 💍',
    'Symbols': 'heart ❤️|white_check_mark ✅|heavy_check_mark ✔️|x ❌|negative_squared_cross_mark ❎|ballot_box_with_check ☑️|question ❓|exclamation ❗|grey_question ❔|grey_exclamation ❕|bangbang ‼️|interrobang ⁉️|warning ⚠️|no_entry ⛔|no_entry_sign 🚫|recycle ♻️|infinity ♾️|heavy_plus_sign ➕|heavy_minus_sign ➖|heavy_division_sign ➗|heavy_multiplication_x ✖️|heavy_dollar_sign 💲|currency_exchange 💱|tm ™️|copyright ©️|registered ®️|wavy_dash 〰️|curly_loop ➰|loop ➿|end 🔚|back 🔙|on 🔛|top 🔝|soon 🔜|arrow_up ⬆️|arrow_down ⬇️|arrow_left ⬅️|arrow_right ➡️|arrow_upper_right ↗️|arrow_lower_right ↘️|arrows_counterclockwise 🔄|repeat 🔁|repeat_one 🔂|arrow_forward ▶️|fast_forward ⏩|arrow_backward ◀️|rewind ⏪|play_or_pause_button ⏯️|stop_button ⏹️|record_button ⏺️|eject_button ⏏️|new 🆕|free 🆓|up 🆙|cool 🆒|ok 🆗|sos 🆘|a 🅰️|b 🅱️|o2 🅾️|ab 🆎|cl 🆑|information_source ℹ️|id 🆔|zero 0️⃣|one 1️⃣|two 2️⃣|three 3️⃣|four 4️⃣|five 5️⃣|six 6️⃣|seven 7️⃣|eight 8️⃣|nine 9️⃣|keycap_ten 🔟|hash #️⃣|asterisk *️⃣|1234 🔢|abc 🔤|capital_abcd 🔠|symbols 🔣|red_circle 🔴|orange_circle 🟠|yellow_circle 🟡|green_circle 🟢|large_blue_circle 🔵|purple_circle 🟣|black_circle ⚫|white_circle ⚪|red_square 🟥|orange_square 🟧|yellow_square 🟨|green_square 🟩|blue_square 🟦|purple_square 🟪|black_large_square ⬛|white_large_square ⬜|small_orange_diamond 🔸|small_blue_diamond 🔹|large_orange_diamond 🔶|large_blue_diamond 🔷|diamond_shape_with_a_dot_inside 💠|radio_button 🔘|white_square_button 🔳|black_square_button 🔲|speaker 🔈|sound 🔉|loud_sound 🔊|mute 🔇|eight_pointed_black_star ✴️|eight_spoked_asterisk ✳️|sparkle ❇️|star_and_crescent ☪️|peace_symbol ☮️|yin_yang ☯️|atom_symbol ⚛️|om 🕉️|wheel_of_dharma ☸️|latin_cross ✝️|orthodox_cross ☦️|star_of_david ✡️|menorah 🕎|six_pointed_star 🔯|aries ♈|taurus ♉|gemini ♊|cancer ♋|leo ♌|virgo ♍|libra ♎|scorpius ♏|sagittarius ♐|capricorn ♑|aquarius ♒|pisces ♓|ophiuchus ⛎|male_sign ♂️|female_sign ♀️|medical_symbol ⚕️|zzz 💤|100 💯|salute 🫡|eyes 👀',
    'Flags': 'checkered_flag 🏁|triangular_flag_on_post 🚩|crossed_flags 🎌|black_flag 🏴|white_flag 🏳️|rainbow_flag 🏳️‍🌈|pirate_flag 🏴‍☠️|us 🇺🇸|gb 🇬🇧|ca 🇨🇦|mx 🇲🇽|br 🇧🇷|ar 🇦🇷|fr 🇫🇷|de 🇩🇪|it 🇮🇹|es 🇪🇸|pt 🇵🇹|nl 🇳🇱|be 🇧🇪|ch 🇨🇭|at 🇦🇹|se 🇸🇪|no 🇳🇴|dk 🇩🇰|fi 🇫🇮|ie 🇮🇪|pl 🇵🇱|cz 🇨🇿|gr 🇬🇷|tr 🇹🇷|ru 🇷🇺|ua 🇺🇦|in 🇮🇳|cn 🇨🇳|jp 🇯🇵|kr 🇰🇷|sg 🇸🇬|au 🇦🇺|nz 🇳🇿|za 🇿🇦|ng 🇳🇬|ke 🇰🇪|eg 🇪🇬|ae 🇦🇪|sa 🇸🇦|il 🇮🇱|id 🇮🇩|th 🇹🇭|vn 🇻🇳|ph 🇵🇭|eu 🇪🇺|un 🇺🇳',
  };
  const EMOJI = [];
  const EMOJI_BY_NAME = {};
  const EMOJI_CATEGORIES = Object.keys(EMOJI_SRC);
  EMOJI_CATEGORIES.forEach((cat) => {
    EMOJI_SRC[cat].split('|').forEach((pair) => {
      const sp = pair.lastIndexOf(' ');
      const name = pair.slice(0, sp).trim();
      const ch = pair.slice(sp + 1).trim();
      if (!name || !ch) return;
      if (!EMOJI_BY_NAME[name]) {
        const e = { name, ch, cat };
        EMOJI.push(e);
        EMOJI_BY_NAME[name] = e;
      }
    });
  });
  // aliases
  const alias = { thumbsup: '+1', thumbsdown: '-1', heavy_check_mark: 'heavy_check_mark', clap: 'clap', movie_camera: 'movie_camera', salute: 'saluting_face', point_up: 'point_up', beach_umbrella: 'beach_umbrella', crossed_fingers: 'crossed_fingers', chef_kiss: 'chef_kiss', bug: 'bug', sandwich: 'sandwich', calendar: 'calendar', wink: 'wink', chart_with_upwards_trend: 'chart_with_upwards_trend' };
  Object.keys(alias).forEach((k) => { if (!EMOJI_BY_NAME[k] && EMOJI_BY_NAME[alias[k]]) EMOJI_BY_NAME[k] = EMOJI_BY_NAME[alias[k]]; });
  const FREQUENT = ['+1', 'white_check_mark', 'eyes', 'raised_hands', 'tada', 'heart', 'joy', 'pray', 'fire', 'rocket', 'clap', '100', 'wave', 'thinking', 'ship', 'sunglasses'];

  const slashCommands = [
    { cmd: '/status', args: '[emoji] [text]', desc: 'Set or clear your status' },
    { cmd: '/remind', args: '[@someone or #channel] [what] [when]', desc: 'Set a reminder' },
    { cmd: '/shrug', args: '[message]', desc: 'Append ¯\\_(ツ)_/¯ to your message' },
    { cmd: '/away', args: '', desc: 'Toggle your away status' },
    { cmd: '/dnd', args: '[time]', desc: 'Pause notifications' },
    { cmd: '/giphy', args: '[text]', desc: 'Search for a GIF' },
    { cmd: '/huddle', args: '', desc: 'Start a huddle in this conversation' },
    { cmd: '/mute', args: '', desc: 'Mute or unmute this channel' },
    { cmd: '/topic', args: '[text]', desc: 'Set the channel topic' },
    { cmd: '/collapse', args: '', desc: 'Collapse all images and videos' },
  ];

  global.SLACK_DATA = {
    workspace: { id: 'w1', name: 'Playset', domain: 'playset.slack.com', initials: 'P', color: '#611F69', plan: 'Pro' },
    otherWorkspaces: [{ id: 'w2', name: 'Acme Corp', initials: 'A', color: '#1264A3' }, { id: 'w3', name: 'Design Guild', initials: 'DG', color: '#E01E5A' }],
    me: 'me', users, channels, dms, messages, lastRead, canvases, workflows, externalConnections,
    EMOJI, EMOJI_BY_NAME, EMOJI_CATEGORIES, FREQUENT, slashCommands,
  };
})(typeof window !== 'undefined' ? window : globalThis);
