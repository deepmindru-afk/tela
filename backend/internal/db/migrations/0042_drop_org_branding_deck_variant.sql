-- 0042_drop_org_branding_deck_variant.sql — remove the org's "recommended deck
-- variant".
--
-- 0040 added it as an org-level preferred deck variant; that was wrong. The
-- variant is the single biggest visual decision and must be a deliberate per-deck
-- choice — branding is the accent + logo, NOT the variant, and there is no
-- brand→variant mapping (a "recommendation" still nudges every org deck toward one
-- look). It was never applied at render anyway. Drop it.
ALTER TABLE org_branding DROP COLUMN deck_variant;
