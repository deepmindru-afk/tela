# tela-mcp

MCP server for [Tela](https://tela.cagdas.io). Exposes spaces, pages, search and backlinks to MCP-capable clients (Claude Code, etc.) over stdio.

This is the read-only phase (M16.B.1). Write tools (`create_page`, `update_page`, `delete_page`, `add_comment`, `import_markdown`) ship in M16.C.1.

## Install

Once published:

```sh
npm install -g tela-mcp
```

Or invoke via `npx`:

```sh
npx -y tela-mcp
```

## Configure

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "tela": {
      "command": "npx",
      "args": ["-y", "tela-mcp"],
      "env": {
        "TELA_BASE_URL": "https://tela.cagdas.io",
        "TELA_API_KEY": "${TELA_API_KEY}"
      }
    }
  }
}
```

Get an API key from Tela → Settings → API Keys (admin-only). Keep the raw `tela_pat_*` value in your shell rc, not in version control.

## Tools

| Tool             | Description                                                                  | Required env scope |
|------------------|------------------------------------------------------------------------------|--------------------|
| `list_spaces`    | List every space the API key can access.                                     | read               |
| `list_pages`     | Flat page listing inside a space. Optional `parent_id` for direct children.  | read               |
| `get_page`       | Full markdown body + metadata for a page id.                                 | read               |
| `search`         | FTS5 full-text search across title + body. Returns highlighted snippets.     | read               |
| `search_bodies`  | Fuzzy body search within a single space. No snippet — re-fetch via get_page. | read               |
| `list_backlinks` | Pages that link to a given page via `[[wikilink]]` / `tela://page/{id}`.     | read               |

## Resources

`tela://page/{id}` — matches the wikilink scheme Tela writes into markdown, so resource @-mentions round-trip with the IDs you read out of page bodies.

## Develop

```sh
cd mcp
npm install
npm run build
npm test
```

Smoke-boot the stdio server (locally — needs a running Tela backend):

```sh
TELA_BASE_URL=http://localhost:8780 TELA_API_KEY=tela_pat_xxx node dist/server.js
```
