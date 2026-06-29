# Editions rollout — deploy runbook & live breakage analysis

The editions/pricing rework (see [`editions-and-pricing.md`](editions-and-pricing.md))
is **built, tested, committed — NOT deployed**. This is the operator runbook to take
it live safely, and the code-grounded analysis of what can break on the live cloud.

## What shipped (by phase)

| Phase | Status | What |
|---|---|---|
| 1 — cloud ladder + entitlement | ✅ built+tested | migration `0059` (Plus→Personal, Team $10/$96, pages/spaces unlimited, storage backstop, sso+audit on Enterprise), `entitled()` gate, SSO config+usage gating, frontend catalog |
| 2 — license keys + ee module | ✅ built+tested | `internal/ee` ed25519 offline keys, `tela license issue/verify`, admin `/api/admin/license` + License tab, EE license headers |
| 3 — audit gating | ✅ built+tested | org audit view gated as Enterprise; SCIM + premium connectors = **scoped follow-on** (need external OAuth apps — see below) |
| 4 — BYO-AI + licensing docs | ✅ built | `docker-compose.ai.yml` + `make up-ai`, `docs/licensing.md`, README |

## ⛔ Hard pre-deploy gates (do these FIRST)

### 1. Reprice the Polar Team products

`migration 0059` updates the **display** price (Team $10/mo, $96/yr). The actual charge
is the **Polar product** price, still $6/$60. Deploying without repricing → the
catalog/landing advertise $10 but customers are charged the old price (under-charge, not
a crash).

- In the Polar dashboard, set the **org_team monthly** product to **$10** and **org_team@year**
  to **$96**. Confirm **personal_plus** is **$8 / $72** (unchanged).
- If Polar prices are immutable (new price = new product id): create the new products and
  update **`TELA_POLAR_PRODUCTS`** in `deploy/.env` to the new uuids, then redeploy.
- Verify: a Team checkout shows $10/mo (or $8/mo billed yearly).

### 2. Move every SSO org to Enterprise (CRITICAL — lockout risk)

SSO is now gated on `entitled(org,'sso')` (Enterprise only on cloud). **SSO-provisioned
users have a random password they don't know** — if their org isn't Enterprise after
deploy, they can't start SSO login *and* can't password-login (recoverable only via
password-reset email). Audit is likewise gated, but that's only a hidden tab, not a lockout.

Run this on the box **before** deploy and remediate any rows:

```sql
-- Orgs with SSO configured that are NOT entitled to it under the new plans →
-- their SSO breaks on deploy. Move each to org_enterprise (or grant the feature).
SELECT o.id, o.name, o.plan_key
  FROM org_sso s JOIN orgs o ON o.id = s.org_id
 WHERE (SELECT (p.features->>'sso')::boolean FROM plans p WHERE p.key = o.plan_key)
       IS DISTINCT FROM true;

-- Remediate (per org):  UPDATE orgs SET plan_key='org_enterprise' WHERE id = <id>;
```

(Operator-assigned org customers using SSO are Enterprise anyway — just confirm the plan_key.)

## Breakage analysis (everything else)

| # | Area | Effect on deploy | Risk | Mitigation |
|---|---|---|---|---|
| 1 | **Polar price** | catalog $10, charge $6 until reprice | 🔴 high | gate 1 above |
| 2 | **SSO gating** | non-Enterprise SSO orgs stranded | 🔴 high | gate 2 above |
| 3 | **Audit gating** | non-Enterprise org admins lose the audit tab (upgrade nudge) | 🟢 low | expected; not a lockout |
| 4 | `managed_rag`/`ask_docs`/`publishing` | routed through `entitled()`; on cloud `entitled == featureEnabled` (license nil) | 🟢 none | identical behavior — verified |
| 5 | **migration 0059** | data-only UPDATEs on `plans`; storage raised (more lenient); forward-only | 🟢 low | re-runnable; small table |
| 6 | **license load on boot** | `TELA_LICENSE_KEY` unset on cloud → `s.license` nil → plan-flag path; invalid key logs+nil (never boot-fatal) | 🟢 none | no new required env on cloud |
| 6b | **managedCloud gate** | entitlement plan-flag path is honoured only when `managedCloud` = (Polar billing on \|\| `TELA_CLOUD=1`). The live cloud has Polar → auto-true, so plan entitlements (managed_rag, sso, …) keep working with NO new env. | 🟡 | if Polar is ever unset on the cloud, also set `TELA_CLOUD=1` or plan entitlements go dark |
| 7 | `/api/admin/license` | instance-admin only; token stored under `secret/` (excluded from settings dump; generic settings-patch 403s `secret/`) | 🟢 none | verified |
| 8 | **landing deploy** | `/pricing` self-host section is contact-sales (mailto) — honest pre-EE-sales; cloud half needs Polar reprice | 🟡 | deploy landing only after gates 1–2 |

**Not changed on cloud:** the entitlement spine is `entitled = featureEnabled(plan) || license.Grants`. On the managed cloud the license is nil, so `entitled == featureEnabled` — the *only* new gates are SSO (was ungated) and audit (was org-admin-only). Everything else behaves exactly as before.

## Deploy order

1. Reprice Polar (gate 1); confirm `TELA_POLAR_PRODUCTS` in `deploy/.env`.
2. Run the SSO-org SQL (gate 2); set at-risk orgs to `org_enterprise`.
3. `make deploy-backend` (applies migration `0059` on boot) → health-gate `/api/version`.
4. `make deploy-frontend`.
5. `make deploy-landing`.
6. **Post-deploy verification** below.

## Post-deploy verification

- `curl -s <PUBLIC_URL>/api/version` → commit matches `git rev-parse --short HEAD`.
- `GET /api/plans` (any auth) → Team `price_cents=1000`, `price_cents_yearly=9600`, name `Team`; `personal_plus` name `Personal`.
- A Team checkout opens at $10/mo (or $8/mo yearly).
- An Enterprise org can still start SSO; a non-Enterprise org's `/api/orgs/{id}/audit` → 402.
- (Optional self-host smoke) `tela license issue … | tela license verify` round-trips; pasting a key in Settings → License flips the instance to Enterprise.

## Post-deploy: update the tela Docs space (space 16)

Deferred on purpose — don't describe the new model in user docs until it's live. After
deploy, update the **"Plans & limits"** page (id 225) for the unified ladder + Team $10,
and add a **self-host editions / license** page (Community vs Enterprise, installing a key).

## Remaining follow-on (net-new EE — needs external resources)

These are advertised on `/pricing` as Enterprise and are **entitlement-ready** (gate them
on `entitled(org, <feature>)` exactly like SSO/audit), but each needs external setup so
they're a scoped follow-on, not faked here:

- **SCIM provisioning** — a SCIM 2.0 endpoint (`/scim/v2/Users`,`/Groups`) with bearer
  auth, mapped onto `users`/`org_members`. Needs testing against a real IdP (Okta/Entra).
- **Premium Atlas connectors** (Slack/Drive/GitHub/Confluence) — each needs a registered
  OAuth app + ingestion into the Atlas source pipeline (today: git + Jira only).
- **Advanced RBAC / retention / white-label / HA** — incremental; white-label partly
  exists (org branding). Gate behind `entitled()` as built.
