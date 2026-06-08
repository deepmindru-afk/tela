-- 0026_org_login_settings.sql — per-org control over which sign-in methods show
-- on that org's custom-domain login screen (white-label).
--
-- On a custom domain (tela.ngss.io) the login screen is org-scoped: it can hide
-- the password form and/or the social buttons so an org can present, say,
-- "SSO only". Org SSO itself shows whenever an org_sso row exists. One row per
-- org; absent ⇒ everything enabled (today's behavior). Booleans as INTEGER 0/1
-- per the project convention. The canonical host always shows the full,
-- instance-wide set regardless of these rows.
CREATE TABLE org_login_settings (
  org_id           BIGINT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  password_enabled INTEGER NOT NULL DEFAULT 1 CHECK (password_enabled IN (0,1)),
  social_enabled   INTEGER NOT NULL DEFAULT 1 CHECK (social_enabled IN (0,1)),
  updated_at       TEXT NOT NULL DEFAULT tela_now()
);
