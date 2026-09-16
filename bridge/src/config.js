/* Environment-only configuration. No config files, no defaults for secrets. */
const env = (k, d) => {
  const v = process.env[k];
  return v == null || v === '' ? d : v;
};

export const config = {
  port: Number(env('BRIDGE_PORT', 8787)),
  allowedOrigins: env('BRIDGE_ALLOWED_ORIGINS', '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  sharedSecret: env('BRIDGE_SHARED_SECRET', ''),
  slack: {
    botToken: env('SLACK_BOT_TOKEN', ''),
    appToken: env('SLACK_APP_TOKEN', ''),
    userToken: env('SLACK_USER_TOKEN', ''),
    clientId: env('SLACK_CLIENT_ID', ''),
    clientSecret: env('SLACK_CLIENT_SECRET', ''),
    refreshToken: env('SLACK_REFRESH_TOKEN', ''),
    userRefreshToken: env('SLACK_USER_REFRESH_TOKEN', ''),
    tokenStore: env('SLACK_TOKEN_STORE', './.tokens.json'),
  },
};

export function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin || '');
}

export function originAllowed(origin) {
  if (!origin) return true; // same-origin / curl
  if (isLocalOrigin(origin)) return true;
  return config.allowedOrigins.includes(origin.replace(/\/+$/, ''));
}

export function validateConfig() {
  const problems = [];
  const s = config.slack;
  const hasBot = !!(s.botToken || s.refreshToken);
  const hasUser = !!(s.userToken || s.userRefreshToken);
  if (!hasBot && !hasUser) problems.push('Set SLACK_BOT_TOKEN (or SLACK_REFRESH_TOKEN with SLACK_CLIENT_ID/SLACK_CLIENT_SECRET).');
  if (!s.appToken) problems.push('Set SLACK_APP_TOKEN (xapp-..., scope connections:write) for Socket Mode.');
  if ((s.refreshToken || s.userRefreshToken) && !(s.clientId && s.clientSecret)) problems.push('Token rotation needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET alongside the refresh token.');
  if (!config.sharedSecret) problems.push('Set BRIDGE_SHARED_SECRET (any long random string); the shell sends it as a bearer token.');
  return problems;
}
