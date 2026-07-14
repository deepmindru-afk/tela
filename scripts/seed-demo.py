#!/usr/bin/env python3
"""Populate a tela demo account with a realistic 'Demo' space for directory
reviewers (Claude / ChatGPT MCP-app submissions need a populated, no-MFA test
account — empty accounts are a rejection cause).

Usage:
    TELA_BASE_URL=https://tla.portalos.ru \
    TELA_DEMO_PAT=tela_pat_xxx \
    python3 scripts/seed-demo.py

The PAT must belong to the demo account and carry write scope. Idempotent-ish:
re-running creates a fresh 'Demo (N)' space rather than duplicating pages, so it
never corrupts an existing seed. Read-only: touches only the demo account.
"""
import json
import os
import sys
import urllib.request

BASE = os.environ.get("TELA_BASE_URL", "https://tla.portalos.ru").rstrip("/")
PAT = os.environ.get("TELA_DEMO_PAT")
if not PAT:
    sys.exit("set TELA_DEMO_PAT (a write-scoped PAT for the demo account)")


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + PAT)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or "{}")


# Realistic engineering-wiki content mirroring the landing's examples, so a
# reviewer's `search "deploy"` / `semantic_search` calls return meaningful hits.
PAGES = [
    ("Deploy runbook", """# Deploy runbook

Standard production deploy for the API.

1. Tag the release: `git tag vX.Y.Z && git push --tags`.
2. Rebuild and **deploy** on `:8780`, then re-probe `/api/version`.
3. Verify the reported `commit` matches `git rev-parse --short HEAD`.
4. Purge the edge cache last — Cloudflare purges on every deploy.

> [!note] Roll back in one click from the release timeline if `/api/version` drifts.
"""),
    ("Incident response", """# Incident response

When a service degrades, the **on-call engineer** owns it.

- Page `@on-call` before deploying anyone else.
- Open an incident page from this template and link the affected runbook.
- Post status updates every 15 minutes until resolved.
- Write the postmortem within 48 hours; link it here.

See [[Deploy runbook]] for the rollback path.
"""),
    ("Release checklist", """# Release checklist

- [ ] Tag the release and push tags.
- [ ] Deploy and verify `/api/version` matches HEAD.
- [ ] Smoke-test the critical paths (auth, search, MCP connect).
- [ ] Announce in #releases with the changelog.
"""),
    ("On-call rotation", """# On-call rotation

Primary and secondary rotate weekly (Mon 10:00).

| Week | Primary | Secondary |
|------|---------|-----------|
| This week | Sam | Lee |
| Next week | Lee | Sam |

Hand-off notes go at the bottom of this page each Friday.
"""),
    ("Architecture overview", """# Architecture overview

tela is a Go + PostgreSQL backend with a React frontend and a built-in MCP
server, so agents read and write the same markdown the team does.

- **Backend** — Go, hand-written SQL over `pgx`. Page bodies are canonical markdown.
- **Frontend** — React + Milkdown editor with live Yjs collaboration.
- **MCP** — `/api/mcp`, OAuth 2.1 (WorkOS) or PAT; 20 tools, 2 resources, 2 widgets.

Edge: Cloudflare → Caddy → backend. Search is full-text + semantic (RRF).
"""),
]


def main():
    # Find a non-colliding space name.
    spaces = api("GET", "/api/spaces").get("spaces", [])
    names = {s["name"] for s in spaces}
    name, n = "Demo", 1
    while name in names:
        n += 1
        name = f"Demo ({n})"

    sp = api("POST", "/api/spaces", {"name": name, "slug": ""})
    space = sp.get("space", sp)
    sid = space["id"]
    print(f"created space {name!r} (id {sid})")

    for title, body in PAGES:
        pg = api("POST", "/api/pages", {"space_id": sid, "title": title, "body": body})
        page = pg.get("page", pg)
        print(f"  + page {title!r} (id {page.get('id')})")

    print(f"\ndone — demo space {name!r} populated with {len(PAGES)} pages.")
    print(f"reviewer login: the demo account; first space is {name!r}.")


if __name__ == "__main__":
    main()
