// Canonical documentation links. They point at the public docs on
// telawiki.com (the "tela Docs" space) so they work the same for self-hosted
// instances — a self-hoster's own server doesn't carry the docs space, but the
// public docs are the one canonical source. One place to maintain these.
const DOCS_BASE = 'https://telawiki.com'

export const DOCS = {
  home: `${DOCS_BASE}/tela/docs`,
  plans: `${DOCS_BASE}/public/spaces/16/pages/225/plans-billing`,
  tour: `${DOCS_BASE}/public/spaces/16/pages/325/tela-team-onboarding`,
  webdav: `${DOCS_BASE}/public/spaces/16/pages/218/sync-your-vault-webdav`,
  rclone: `${DOCS_BASE}/public/spaces/16/pages/219/sync-with-rclone`,
  mcp: `${DOCS_BASE}/public/spaces/16/pages/211/agents-mcp`,
  apiTokens: `${DOCS_BASE}/public/spaces/16/pages/224/api-personal-access-tokens`,
  sso: `${DOCS_BASE}/public/spaces/16/pages/220/single-sign-on-sso`,
  selfHosting: `${DOCS_BASE}/public/spaces/16/pages/210/self-hosting`,
} as const
