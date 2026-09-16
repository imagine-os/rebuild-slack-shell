# Slack Shell bridge

A small Node 20 service that lets the static [Slack Shell](../README.md) app run on a **real Slack workspace**.

```
browser (GitHub Pages / localhost)  <-- HTTPS + WebSocket -->  bridge (this)  <-- Web API + Socket Mode -->  Slack
      holds: BRIDGE_SHARED_SECRET                         holds: SLACK_* tokens
```

The shell is plain static files, so it can never hold a Slack token safely (anything in a public page is public). The bridge holds the tokens, does the Slack calls, and pushes Slack events to the browser. See [`docs/LIVE_DATA.md`](../docs/LIVE_DATA.md) for the plain-language architecture.

- `src/index.js` — HTTP REST endpoints (mirroring the shell's `LiveProvider`), CORS, bearer-token auth, `/ws` WebSocket fan-out.
- `src/slack.js` — Web API calls (`users.conversations`, `users.list`, `conversations.history/replies/info/members`, `chat.postMessage/update/delete`, `reactions.add/remove`, `conversations.mark`, `conversations.setTopic`).
- `src/events.js` — Bolt app in Socket Mode; forwards `message*`, `reaction_*`, `channel_*`, `member_*`, `user_change`, `team_join` events to connected browsers.
- `src/tokens.js` — token handling including Slack token rotation.
- `src/config.js` — env-var configuration only.
- `manifest.yml` — the Slack app manifest.
- `Dockerfile`, `fly.toml` — deployment.

## 1. Create the Slack app (or update your existing one)

**What is the manifest?** `manifest.yml` is a configuration file that lists everything the app needs from Slack: the bot user, its permissions (OAuth scopes), which events it wants to receive, and that it uses Socket Mode. You paste its contents into Slack once instead of clicking through every scope and event by hand.

New app:

1. Go to <https://api.slack.com/apps> → **Create New App** → **From an app manifest**.
2. Pick your workspace, choose **YAML**, paste the contents of [`manifest.yml`](manifest.yml), review, **Create**.
3. **Install App** → **Install to Workspace** → allow. (The manifest requests both bot and user scopes; installing grants both.)
4. **OAuth & Permissions**: copy the **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`, and optionally the **User OAuth Token** (`xoxp-…`) → `SLACK_USER_TOKEN` so posts appear as *you* rather than the bot.
5. **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes** → add scope `connections:write` → generate. Copy the `xapp-1-…` token → `SLACK_APP_TOKEN`. This is what Socket Mode uses; it never rotates.

### I already have an app (with token rotation)

If you created the app earlier and enabled **Token Rotation**, your tokens look like `xoxe.xoxb-…` / `xoxe.xoxp-…` (access tokens, valid 12 hours) and `xoxe-1-…` (refresh tokens). The bridge supports both plain and rotating tokens.

1. Open your app at <https://api.slack.com/apps> → **App Manifest** (left sidebar). Paste [`manifest.yml`](manifest.yml) over the existing YAML and **Save Changes**. This applies the scopes, events and Socket Mode setting to the *existing* app; no need to create a new one. (The manifest deliberately does not include `token_rotation_enabled`, so your rotation setting stays as it is.) If Slack reports new scopes, reinstall the app when prompted.
2. **Basic Information** → **App Credentials**: copy **Client ID** → `SLACK_CLIENT_ID` and **Client Secret** → `SLACK_CLIENT_SECRET`.
3. Copy your refresh token(s) (`xoxe-1-…`) from **OAuth & Permissions** (or from the OAuth response you saved when installing): bot refresh token → `SLACK_REFRESH_TOKEN`, user refresh token → `SLACK_USER_REFRESH_TOKEN`. If your app only has a user token, put its refresh token in `SLACK_REFRESH_TOKEN`; the bridge detects the token type from the refresh response.
4. You can still set `SLACK_BOT_TOKEN` / `SLACK_USER_TOKEN` to the current `xoxe.…` access tokens, but it is not required: with a refresh token present the bridge refreshes on boot.
5. Still generate the **App-Level Token** (`xapp-1-…`) as in step 5 above.

How rotation works in the bridge: on boot, and then roughly every 11 hours (tokens live 12 h), and immediately on an `invalid_auth` / `token_expired` error, `src/tokens.js` calls `oauth.v2.access` with `grant_type=refresh_token`, keeps the new access + refresh tokens in memory and writes the newest refresh tokens to `SLACK_TOKEN_STORE` (default `./.tokens.json`, gitignored, mode 600). Refresh tokens are single-use, so after the first refresh the file is the only copy of the current one; keep it on a persistent disk (the `Dockerfile`/`fly.toml` use `/data/.tokens.json` on a volume). If it is ever lost, generate a new refresh token by reinstalling the app.

## 2. Run locally

```sh
cd bridge
npm install
cp .env.example .env        # fill in the values; .env is gitignored
set -a; source .env; set +a
npm start
# [slack] connected to <team> — posting as @you (user token)
# [events] socket mode connected
# [bridge] listening on http://localhost:8787
```

Then open the shell with `?live=1&bridge=http://localhost:8787` (for example `npx serve -l 5173 ..` and visit <http://localhost:5173/?live=1&bridge=http://localhost:8787>). The shell asks for the shared secret once and keeps it in `localStorage`.

Check `GET /health` at any time; it reports Socket Mode state, which identity it posts as, token status and connected browsers (no secrets).

## 3. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | yes* | Bot token `xoxb-…` (or rotating `xoxe.xoxb-…`). |
| `SLACK_APP_TOKEN` | yes | App-level token `xapp-1-…` with `connections:write`, for Socket Mode. |
| `SLACK_USER_TOKEN` | no | User token `xoxp-…` / `xoxe.xoxp-…`. When present, messages, edits, reactions and read-marks are done as you, and channel lists are the channels *you* are in. |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | rotation | From **Basic Information → App Credentials**. |
| `SLACK_REFRESH_TOKEN` | rotation | Refresh token `xoxe-1-…` for the bot token (or for the user token if the app only has one). |
| `SLACK_USER_REFRESH_TOKEN` | no | Refresh token for the user token. |
| `SLACK_TOKEN_STORE` | no | File where the newest refresh tokens are persisted. Default `./.tokens.json`. |
| `BRIDGE_PORT` | no | Port to listen on. Default `8787`. |
| `BRIDGE_ALLOWED_ORIGINS` | yes for Pages | Comma-separated browser origins allowed by CORS, e.g. `https://imagine-os.github.io`. `localhost` / `127.0.0.1` are always allowed. |
| `BRIDGE_SHARED_SECRET` | yes | Random string the shell sends as `Authorization: Bearer …` (and `?token=` on the WebSocket). `openssl rand -hex 24`. |

\* `SLACK_BOT_TOKEN` can be omitted when `SLACK_REFRESH_TOKEN` + client id/secret are set.

Never commit real tokens. `.env` and `.tokens.json` are gitignored here and at the repo root.

## 4. Deploy (Fly.io)

```sh
cd bridge
fly launch --no-deploy --copy-config          # accept the fly.toml, pick a name and region
fly volumes create bridge_data --size 1       # persists .tokens.json (only needed with rotation)
fly secrets set SLACK_BOT_TOKEN=... SLACK_APP_TOKEN=... SLACK_USER_TOKEN=... \
                BRIDGE_SHARED_SECRET=... BRIDGE_ALLOWED_ORIGINS=https://imagine-os.github.io
# with rotation also: SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_REFRESH_TOKEN [SLACK_USER_REFRESH_TOKEN]
fly deploy
```

`fly.toml` keeps one machine always running (Socket Mode needs a persistent connection) and mounts the volume at `/data`. Any other host that runs a Docker image with env vars and a persistent disk works the same way (`docker build -t slack-shell-bridge . && docker run --env-file .env -p 8787:8787 -v bridge_data:/data slack-shell-bridge`).

## 5. Point the shell at it

Open the deployed shell (GitHub Pages) → workspace name menu → **Data source** → choose **Live Slack via bridge**, enter the bridge URL (`https://your-app.fly.dev`) and the shared secret → **Save & reload**. Or use the URL form: `https://imagine-os.github.io/rebuild-slack-shell/?live=1&bridge=https://your-app.fly.dev`. The pill at the bottom of the sidebar shows seeded / connecting / live / error.

## API

All `/api/*` routes need `Authorization: Bearer $BRIDGE_SHARED_SECRET`. Responses are raw Slack shapes; the shell normalizes them.

| Method & path | Slack call |
| --- | --- |
| `GET /health` | – (no auth) |
| `GET /api/workspace` | `team.info`, `users.list`, `users.conversations`, `conversations.info/members` per channel |
| `GET /api/history?channel=&cursor=&limit=` | `conversations.history` (+ `conversations.info` for `last_read`) |
| `GET /api/thread?channel=&ts=` | `conversations.replies` |
| `GET /api/members?channel=` | `conversations.members` |
| `POST /api/messages` `{channel,text,thread_ts?,reply_broadcast?}` | `chat.postMessage` |
| `PATCH /api/messages` `{channel,ts,text}` | `chat.update` |
| `DELETE /api/messages` `{channel,ts}` | `chat.delete` |
| `POST /api/reactions` / `DELETE /api/reactions` `{channel,ts,name}` | `reactions.add` / `reactions.remove` |
| `POST /api/mark` `{channel,ts}` | `conversations.mark` (user token only) |
| `POST /api/topic` `{channel,topic}` | `conversations.setTopic` |
| `WS /ws?token=` | frames `{type, event, ts}` with the raw Slack event |

## Limitations

- `user_typing` is not delivered by the Events API, so typing indicators only work in seeded mode.
- Presence is not polled; live users show as "away" until a `presence_change` arrives (which needs the RTM API and is not subscribed).
- File contents are not proxied; file cards link to the Slack permalink.
- Pins, saves, stars, mutes and channel creation stay local to the browser in live mode.
