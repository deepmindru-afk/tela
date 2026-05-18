# Tela

Tela is a self-hosted, markdown-native team wiki. v0 is single-user (no authentication), with spaces, nested pages, a live-preview markdown editor, full-text search, and three runtime-switchable themes. It is delivered as a small docker-compose stack you bring up on your own host.

## Status

v0 in development — M1 (scaffold) complete.

M1 delivers the running stack, the design-token + theming foundation, the owned UI primitives, and Storybook. Spaces / pages / editor / search land in later milestones.

## Prerequisites

- Docker with Compose v2 (`docker compose`, not `docker-compose`).
- GNU Make.

Node.js 20+ and Go 1.22+ are **only** required if you want to run the frontend or backend outside Docker via `make dev`, `make fe-dev`, `make be-dev`, or `make storybook`.

## Quick start

```
git clone git@github.com:zcag/tela.git
cd tela
make up
# visit http://localhost:8780
```

`make up` builds the three images on first run and starts the stack detached. Verify it is healthy:

```
curl http://localhost:8780/api/health
# {"status":"ok"}
```

`make down` stops the stack. `make clean FORCE=1` stops it and removes the named volumes (destroys data).

## Local development

These targets run the apps directly on your host, outside Docker. They are independent of `make up` — useful when you want hot reload or Storybook.

| Target           | What it runs                              | Reachable at              |
| ---------------- | ----------------------------------------- | ------------------------- |
| `make dev`       | `be-dev` and `fe-dev` together (parallel) | see the two rows below    |
| `make be-dev`    | `go run ./cmd/tela`                       | `http://localhost:8080`   |
| `make fe-dev`    | `vite` dev server                         | `http://localhost:5173`   |
| `make storybook` | `storybook dev -p 6006`                   | `http://localhost:6006`   |

`make be-dev` honors the `TELA_ADDR` environment variable if you need to bind a different address (default `:8080`).

The Vite dev server does **not** proxy `/api/*` to the backend — when running locally outside compose, the frontend talks to whatever URL its code is configured for. For end-to-end against the real stack, use `make up`.

## Project layout

```
tela/
├── backend/         Go HTTP server (single binary, internal :8080)
│   ├── cmd/tela/    main entrypoint
│   ├── internal/    handlers and packages
│   └── Dockerfile
├── frontend/        React 19 + Vite + TypeScript + Tailwind v4 (internal :80 via nginx)
│   ├── src/         app code, tokens, themes, owned UI primitives
│   ├── .storybook/  Storybook config
│   └── Dockerfile
├── deploy/
│   ├── docker-compose.yml   three-service stack definition
│   └── proxy/Caddyfile      reverse-proxy routing rules
├── Makefile         common targets (see `make help`)
└── README.md
```

## Architecture

The stack is three containers on a private compose network:

- `backend` — Go binary, listens internally on `:8080`. Not published to the host.
- `frontend` — static assets served by nginx, listens internally on `:80`. Not published to the host.
- `proxy` — Caddy. Routes `/api/*` to `backend:8080` and everything else to `frontend:80`. Published on host port `8780`.

Port **8780** is the only host port published by the stack. All cross-container traffic stays on the compose network.

Three named volumes carry state across restarts:

- `tela-data` — backend data (SQLite DB lives here once M2 lands).
- `caddy-data` and `caddy-config` — Caddy's runtime state.

`make clean FORCE=1` deletes all three.

## Make targets

Run `make help` for the same list inline.

| Target           | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `make up`        | Build and start the stack (backend + frontend + proxy) on port 8780.     |
| `make down`      | Stop the stack. Volumes are preserved.                                   |
| `make logs`      | Tail logs from all services.                                             |
| `make build`     | Rebuild images without starting them.                                    |
| `make clean`     | Stop the stack and delete named volumes. Requires `FORCE=1` to confirm.  |
| `make dev`       | Run `be-dev` and `fe-dev` together (no compose).                         |
| `make be-dev`    | Run the backend with `go run`.                                           |
| `make fe-dev`    | Run the Vite dev server.                                                 |
| `make storybook` | Run Storybook for the owned UI primitives.                               |

## Troubleshooting

**Port 8780 already in use.**
`make up` will fail with a bind error if something else holds the port. Identify the process with `ss -tlnp 'sport = :8780'` (or `lsof -iTCP:8780 -sTCP:LISTEN`) and stop it, or change the proxy's host mapping in `deploy/docker-compose.yml` (the `ports:` entry under the `proxy` service). The internal port is fixed at `:80`; only the host side is free to change.

**Docker build cache / stale images.**
If a rebuild seems to keep the old code, force a clean rebuild:

```
make down
docker compose -f deploy/docker-compose.yml build --no-cache
make up
```

To wipe data as well, use `make clean FORCE=1` before `make up`.

**Frontend hot reload doesn't work behind compose.**
`make up` builds the frontend into static assets served by nginx — there is no HMR through that path. For hot reload, stop the stack (or just the frontend container) and run `make fe-dev` instead; the Vite dev server on `http://localhost:5173` handles live updates. Restart the compose frontend with `make up` once you're done.

**Storybook port 6006 is in use.**
`make storybook` calls `storybook dev -p 6006` and will prompt to fall back to 6007. Accept the prompt, or stop whatever else is on 6006.

**Container logs.**
`make logs` tails all three services. To follow a single service, e.g. the proxy: `docker compose -f deploy/docker-compose.yml logs -f proxy`.

## Deploying behind a domain

The compose stack publishes plain HTTP on host port `8780`. TLS termination and any public ingress are intentionally out of scope for v0 — you bring your own.

To put `tela.cagdas.io` (or any domain) in front of this instance, point your upstream reverse proxy / tunnel at `host:8780`:

- **cloudflared** — `tunnel route` to `http://localhost:8780`.
- **A separate reverse proxy on the same host** (Caddy, nginx, Traefik) — proxy the public hostname to `http://127.0.0.1:8780`.
- **A managed PaaS or load balancer** — forward the public HTTPS listener to this host on port 8780.

**v0 has no authentication.** Anything that can reach port 8780 can read and write every page. Fence the instance off upstream (Cloudflare Access, a basic-auth layer at your edge proxy, a private network, etc.) until real auth ships in v0.2.
