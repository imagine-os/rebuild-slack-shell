# Running the Slack Shell on real Slack data

The Slack Shell is a static web app: three files (`index.html`, `styles.css`, `app.js`) plus data, served by GitHub Pages. By default it shows a made-up workspace ("Playset") generated from `data.js`. This document explains how the same app can show and act on a **real** Slack workspace, and why that needs one extra moving part.

## The short version

```
┌──────────────────────────┐   HTTPS (REST) + WebSocket   ┌──────────────────────┐   Web API + Socket Mode   ┌────────┐
│  Slack Shell (browser)   │ ───────────────────────────► │  bridge (Node 20)    │ ────────────────────────► │ Slack  │
│  static, GitHub Pages    │ ◄─────────────────────────── │  small server you    │ ◄──────────────────────── │        │
│  holds: shared secret    │        events pushed         │  run; holds tokens   │      events pushed        │        │
└──────────────────────────┘                              └──────────────────────┘                           └────────┘
```

1. **The shell** (this repo, static) draws the UI. In live mode it asks the bridge for the workspace, channel history and threads, sends messages/edits/reactions to the bridge, and listens on a WebSocket for things that happen in Slack.
2. **The bridge** (`bridge/`) is a ~400-line Node service. It holds the Slack tokens, translates the shell's simple REST calls into Slack Web API calls, and keeps a Socket Mode connection open to Slack so it hears about new messages, edits, reactions, new channels and so on, which it forwards to every connected browser.
3. **Slack** is Slack. The bridge appears there as a Slack app with a bot user, and optionally acts as *you* (user token) so posts show under your name.

## Why the token cannot live in the static page

A Slack token is a password. Whatever the browser downloads from GitHub Pages is public: anyone can open DevTools, or simply fetch `app.js`, and read it. A token embedded there would let anyone read every channel the app can see and post as the app (or as you). Slack's own guidance is the same: tokens belong on a server you control.

There is also a practical reason. Slack pushes events to apps either by calling a public HTTPS URL (Events API) or over an outbound WebSocket that the *app* opens (Socket Mode). A static page has no URL Slack can call and cannot keep a server-side connection open when nobody is looking at it. Slack's Web API also does not allow cross-origin requests from arbitrary web pages.

So the smallest secure design is: keep the token in a tiny server, let the browser talk to that server, and have the server authenticate the browser with something *revocable and low-value* — here a single shared secret (`BRIDGE_SHARED_SECRET`) that only unlocks the bridge, never Slack itself. If the secret leaks, you rotate it in the bridge's environment; the Slack tokens are untouched.

## Seeded mode vs live mode

| | Seeded (default) | Live |
| --- | --- | --- |
| Data | `data.js`, generated in the browser | Your Slack workspace via the bridge |
| Network | none | HTTPS to the bridge, WebSocket for events |
| Sending a message | added to memory; a teammate "replies" after 4 s | `chat.postMessage` through the bridge; the message shows immediately as pending and is confirmed by Slack's echo |
| Edits, deletes, reactions, read marks | in memory | `chat.update`, `chat.delete`, `reactions.add/remove`, `conversations.mark` |
| Inbound | random simulated teammate posts | real `message`, `message_changed`, `message_deleted`, `reaction_added/removed`, `channel_created`, `member_joined_channel`, `user_change`, `team_join` |
| Status pill (bottom of sidebar) | "Seeded demo data" | "Connecting…" → "Live · <workspace>" or "Bridge error" |

### Switching

- **UI:** click the workspace name (top of the sidebar) → **Data source**, or click the status pill. Choose *Seeded demo data* or *Live Slack via bridge*, enter the bridge URL and the shared secret, then **Save & reload**.
- **URL:** `?live=1&bridge=https://your-bridge.example` switches to live for that visit (the bridge URL is remembered). `?live=0` forces seeded.
- **Storage:** the choice is kept in `localStorage` under `slackShellMode` (`"live"` / `"seeded"`), `slackShellBridge` (URL) and `slackShellSecret` (the shared secret, entered once when the bridge answers 401).

The deployed GitHub Pages site stays seeded for everyone who does not opt in; there is no server involved until you flip the switch.

## How it fits in the code

- `provider.js` defines a small **DataProvider** interface: `loadWorkspace()`, `loadHistory(channelId, {cursor})`, `loadThread(channelId, parent)`, `sendMessage(channelId, text, {threadTs})`, `editMessage`, `deleteMessage`, `addReaction`, `removeReaction`, `markRead`, `onEvent(cb)`, `onStatus(cb)`, `connect()`.
  - `SeededProvider` wraps `window.SLACK_DATA`; the UI keeps mutating the in-memory store exactly as before, so seeded behaviour is unchanged.
  - `LiveProvider` implements the same methods against the bridge (`fetch` + `WebSocket`), with reconnect/backoff.
  - `createAdapter()` is the one place that knows Slack's JSON: it turns Slack users/channels/messages/events into the shell's model (numeric millisecond timestamps, CSS-safe message ids derived from Slack `ts`, `<@U…>` mentions, `<#C…|name>` channel links, reaction names → emoji, `reply_count` metadata, `files` → file cards, `subtype` → system messages, HTML entities unescaped).
- `app.js` applies changes optimistically to its store and then calls the provider; inbound events from `provider.onEvent` update the store and re-render. Slack's echo of your own message is matched to the pending copy so nothing shows twice.
- The bridge returns raw Slack shapes and does no translation, so it stays tiny and the shell's model remains the single source of truth.

## What you need

1. A Slack app created from `bridge/manifest.yml` (or the manifest applied to an app you already have), installed to the workspace.
2. The bridge running somewhere with the tokens in its environment (locally with `npm start`, or deployed with the included `Dockerfile` / `fly.toml`).
3. The shell pointed at the bridge URL with the shared secret.

Step-by-step instructions, the exact scopes, environment variables, token rotation and deployment are in [`bridge/README.md`](../bridge/README.md).
