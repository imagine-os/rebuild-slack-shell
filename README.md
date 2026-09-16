# Slack Shell

A pixel-faithful, self-contained recreation of the Slack desktop application shell (2024–2026 design) as a static web app. No frameworks, no build step, no runtime dependencies. Everything — the workspace "Playset", 15 people, 10 channels, 8 DMs, ~200 seeded messages with threads, reactions, files, polls and app posts — is generated client-side from `data.js`, with timestamps relative to *now* so it always reads as current.

> This is a UI recreation for design/engineering reference. Nothing is sent anywhere; all state lives in memory and `localStorage`.

## Run it

```sh
# option 1: just open the file
open index.html            # macOS   (xdg-open on Linux, start on Windows)

# option 2: serve the folder (recommended; relative paths work from any subpath, e.g. GitHub Pages /paperos/)
npx serve -l 5173 .
# or
python3 -m http.server 5173
```

A single-file bundle with CSS, JS and data inlined lives at `dist/slack-shell.html`. Rebuild it with `node build-single.js`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Entry point. Applies the saved theme before first paint, loads `styles.css`, `data.js`, `app.js` with relative paths. |
| `styles.css` | All styles. Design tokens on `:root`, dark theme under `[data-theme="dark"]`, sidebar themes under `[data-sidebar]`, responsive breakpoints at 1200 / 1100 / 900 / 640 px. |
| `app.js` | The application (single IIFE, vanilla JS): rendering, markdown, composer, pickers, modals, keyboard shortcuts, simulation. |
| `data.js` | Seeded workspace: users, channels, DMs, messages, threads, reactions, files, canvases, workflows, emoji table, slash commands. |
| `build-single.js` | Node script that inlines everything into `dist/slack-shell.html`. |

## Features

**Layout & chrome**
- 44px top bar (history back/forward, centered search with `⌘K` hint, help, avatar with presence dot and profile popover).
- Workspace rail with letter-avatar workspaces, active indicator, add-workspace, Home / DMs / Activity / Later / More navigation with badges, new-message button.
- Channel sidebar (resizable 200–420px via drag handle, double-click resets): workspace menu, compose, Unreads / Threads / Drafts rows, collapsible Starred / Channels / Direct messages / Apps sections with hover `…` and `+` actions, unread bold + badge counts, muted style, private lock icons, DM presence dots and status emoji, ghost "Add channels / Add teammates" rows, Unreads-only filter.
- Channel header: name (click for details modal with About / Members / Integrations / Settings tabs), star toggle, topic, member facepile → members panel, huddle button with caret menu, details and more menus; tabbed row (Messages / Files / Pins / Canvas / +) that actually switches the content.
- Right panel (400px, overlay under 1100px): Thread, channel details, members, profile, saved items, threads list, search results.

**Messages**
- Day-divider pills, grouping by author within 5 minutes (continuations show time-on-hover in the gutter), 36px avatars, `APP` badge for bots, status emoji next to names, `(edited)` marker, pinned/saved flags, red `New` unread divider, "Jump to present" chip, skeleton shimmer on channel switch, typing indicator.
- Slack markdown: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, ```` ```blocks``` ````, `> quotes`, bullet and numbered lists, links, `<url|label>`, `@mentions` (with "you" highlight), `#channel` links, `:emoji:` shortcodes (jumbo for emoji-only messages).
- Attachments: file cards (PDF/XLSX/DOCX), image thumbnails (CSS gradients) with lightbox, link unfurls, canvas cards, live poll (click to vote), GitHub / Vercel / PagerDuty / Datadog / Zoom app cards, GIF cards, huddle system messages.
- Reactions with highlighted "you reacted" state and toggling; hover toolbar with quick reacts ✅ 👀 🙌, add reaction, reply in thread, forward, save, and a `…` menu (copy link, copy text, mark unread, remind me, pin/unpin, save, forward, edit (own), delete (own, with confirmation)).
- Threads: parent + replies + own composer with "Also send to #channel".

**Composer**
- Formatting toolbar (bold, italic, strike, link, ordered/bulleted list, quote, code, code block) that wraps the selection with Slack markdown; toggleable via `Aa`.
- Auto-growing textarea (to 50% of the viewport), Enter sends / Shift+Enter newline, `↑` in an empty composer edits your last message, per-conversation drafts persisted in `localStorage`.
- Autocomplete for `:emo`, `@people` and `/commands` (arrow keys, Enter/Tab to accept). Slash commands: `/status`, `/remind`, `/shrug`, `/away`, `/dnd`, `/giphy`, `/huddle`, `/mute`, `/topic`, `/collapse`.
- Attach menu, emoji picker, @ button, video/audio (stubs), send button with Schedule dropdown.
- Simulated teammate reply ~4s after you post in #general; a random teammate posts into a random inactive channel every 25–40s (unread counts, rail badge, Activity list and toasts update).

**Emoji picker** — searchable, 10 category tabs (frequently used + 9), ~800 emoji, skin-tone selector, preview footer with shortcode.

**Search** — `⌘K` quick switcher with fuzzy matching and recent conversations; top-bar search (Enter) opens a results panel across all messages with `in:#channel` / `from:@user` filter chips and highlighted matches; `⌘F` pre-fills `in:#current`.

**Views** — Activity (All / Mentions / Threads / Reactions), DMs (two-pane), Later (In progress / Archived / Completed), and the More menu's Canvases, Files, Workflows, People and External connections pages, all rendered from seeded data.

**Themes & preferences** — light (Aubergine) and dark, plus Ochin, Work Hard and Hoth sidebar themes; persisted, honoring `prefers-color-scheme` on first load. Preferences modal with 11 tabs; wired controls: color mode, sidebar theme, clean/compact density, typing indicators, formatting toolbar, Enter-to-send, 12/24h time, sidebar sort, reduce motion, underline links, notification badge, reset.

**Status & presence** — set-status modal (emoji + text + clear-after + suggestions), pause notifications submenu, away/active toggle, presence dots (active / hollow away / DND "z").

**Huddle** — huddle chip at the bottom of the sidebar with live timer, mute / video / share toggles and Leave; posts "You started a huddle" and "Huddle ended · N min" system messages.

**Responsive** — ≥1200 full layout; 900–1200 compact rail; <900 sidebar becomes a slide-over with hamburger; <640 stacked mobile view (list *or* conversation) with a bottom tab bar; thread panel becomes a full overlay under 1100.

**Accessibility** — landmarks and roles, aria-labels on icon buttons, visible focus rings, focus trap and Escape in modals, arrow-key navigation in menus/pickers/switcher, `aria-live` announcements for new messages, `prefers-reduced-motion` respected (and a manual toggle).

## Keyboard shortcuts

`⌘` is `Ctrl` on Windows/Linux; the app detects the platform and shows the right glyphs.

| Shortcut | Action |
| --- | --- |
| `⌘ K` / `⌘ G` | Quick switcher |
| `⌘ /` | Keyboard shortcuts |
| `⌘ ,` | Preferences |
| `⌘ F` | Search in current channel |
| `⌘ .` | Toggle right pane |
| `⌘ [` / `⌘ ]` | Back / forward in history |
| `⌘ ⇧ D` | Toggle dark mode |
| `⌘ ⇧ A` | All unreads |
| `⌘ ⇧ T` | Threads |
| `⌘ ⇧ K` | Direct messages |
| `⌘ ⇧ M` | Activity (mentions & reactions) |
| `⌘ ⇧ S` | Saved items (Later) |
| `⌘ ⇧ Y` | Set a status |
| `⌘ ⇧ H` | Start / leave huddle |
| `⌘ ⇧ L` | Toggle sidebar (narrow screens) |
| `Alt ↑` / `Alt ↓` | Previous / next channel |
| `Alt ⇧ ↑` / `Alt ⇧ ↓` | Previous / next unread channel |
| `Esc` | Close menu / modal / panel; mark channel read |
| `⇧ Esc` | Mark all as read |
| `Enter` / `⇧ Enter` | Send / new line |
| `↑` (empty composer) | Edit your last message |
| `⌘ B` / `⌘ I` / `⌘ ⇧ X` | Bold / italic / strikethrough |
| `⌘ ⇧ C` / `⌘ ⇧ U` | Inline code / link |
| `⌘ ⇧ 7` / `⌘ ⇧ 8` / `⌘ ⇧ 9` | Ordered list / bulleted list / quote |
| `:` `@` `/` | Emoji / mention / command autocomplete |

## Notes

- Fonts: Lato is loaded from Google Fonts when online and falls back to the system stack offline; nothing else is fetched.
- Persistence: theme, sidebar theme, sidebar width, preferences, drafts, collapsed sections, frequently used emoji and Later item state are stored in `localStorage` under the `ss.` prefix. Preferences → Advanced → "Reset demo data" clears them.
- The simulated data and interactions never leave the browser.
