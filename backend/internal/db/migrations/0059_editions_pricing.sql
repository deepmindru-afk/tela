-- 0059_editions_pricing.sql — pricing/editions rework (docs/editions-and-pricing.md).
-- Cloud is now ONE unified ladder presented as Free / Personal / Team / Enterprise.
-- Everything here is DATA (the plans table is the source of truth); no schema change.
--
--   - personal_plus display name 'Plus' → 'Personal'. The KEY stays personal_plus:
--     the Polar product map (TELA_POLAR_PRODUCTS), the registration trial, and the
--     webhook downgrade targets all key off it — renaming the key would break them.
--   - org_team repriced $6 → $10/seat/mo and $60 → $96/seat/yr (the per-month
--     annual equivalent is $8 = 20% off). The matching Polar products MUST be
--     repriced to $10/mo + $96/yr or checkout will charge the old amount.
--   - Pages & spaces are no longer a headline gate — unlimited (NULL) on every
--     tier (they're cheap rows; the metered axis is AI + seats, not row counts).
--   - Storage stays a SILENT anti-abuse backstop (not advertised), raised
--     generously. NULL = unlimited.
--   - SSO + audit become Enterprise-only entitlements: features {sso, audit} on
--     org_enterprise. They already exist in the core, ungated — entitled()
--     (limits.go) now gates them; this flips the flag the cloud path reads.
--
-- AI caps (max_llm_calls_per_month: Free 50 · Personal 1000 · Team 2000 · Ent ∞)
-- and Atlas source caps (1 · 5 · 20 · ∞) already match the model — left untouched.

-- Display name: Plus → Personal.
UPDATE plans SET name = 'Personal', updated_at = tela_now() WHERE key = 'personal_plus';

-- Team reprice: $10/seat/mo, $96/seat/yr.
UPDATE plans SET price_cents = 1000, price_cents_yearly = 9600, updated_at = tela_now()
 WHERE key = 'org_team';

-- Pages & spaces off the headline — unlimited on every listed tier.
UPDATE plans SET max_spaces = NULL, max_pages_per_space = NULL, updated_at = tela_now()
 WHERE key IN ('personal_free','personal_plus','org_free','org_team','org_enterprise');

-- Storage: silent anti-abuse backstop, raised. 2GB=2147483648, 5GB=5368709120,
-- 50GB=53687091200, 500GB=536870912000. enterprise/unlimited stay NULL.
UPDATE plans SET max_storage_bytes = 2147483648,   updated_at = tela_now() WHERE key = 'personal_free';
UPDATE plans SET max_storage_bytes = 53687091200,  updated_at = tela_now() WHERE key = 'personal_plus';
UPDATE plans SET max_storage_bytes = 5368709120,   updated_at = tela_now() WHERE key = 'org_free';
UPDATE plans SET max_storage_bytes = 536870912000, updated_at = tela_now() WHERE key = 'org_team';

-- SSO + audit are Enterprise entitlements. jsonb '||' merges without disturbing
-- the existing managed_rag/publishing/ask_docs flags.
UPDATE plans SET features = features || '{"sso": true, "audit": true}'::jsonb, updated_at = tela_now()
 WHERE key = 'org_enterprise';
