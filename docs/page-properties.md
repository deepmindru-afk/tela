# Page properties / frontmatter (design notes — not yet built)

Status: **design only.** Today frontmatter is *destroyed* on import — `mdimport.
StripFrontmatter` pulls a single `title:` out of a leading YAML block via regex
and silently drops everything else (the comment in `frontmatter.go` says so).
There is no place to store page metadata, no round-trip out, and the only
markdown egress is MCP `get_page`/`fetch` (no `.md` export endpoint exists).

This doc specifies turning frontmatter into a first-class **page-properties**
system: a single source of truth for page metadata that import/sync populates
automatically and that agents, search, and the graph can query — without
violating the `pages.body` "canonical markdown forever" rule.

## Goals

1. **Stop discarding.** Imported frontmatter is preserved, not dropped.
2. **Single source of truth.** Each piece of metadata has exactly one owner —
   either a tela column or the property bag — never both.
3. **Clean ser/deser, non-hacky queries.** Storage is idiomatic Postgres
   (JSONB + GIN), not embedded YAML text and not an EAV join-fest.
4. **Round-trip.** db → frontmatter-text reproduces a valid, value-faithful YAML
   block (canonical key order; comments / exact ordering are not preserved).
5. **Agent-first payoff.** Agents can filter pages by property
   (`list_pages` where `status=draft`) instead of reading every body.

## Why not raw frontmatter in `pages.body`

`pages.body` is canonical markdown for the page's **content**. Frontmatter is
metadata *about* the page, not content — keeping it inline would force a YAML
parse on every query and tangle metadata edits into the Yjs collab document.

Instead, properties follow the **comments precedent**: comments are already
"SQL-only, decoupled from body/Yjs" (`0001_init.sql`). Properties ride the same
lane — structured, edited via REST, not part of the collaborative doc. You don't
need real-time OT on a status dropdown. The body stays pure prose.

This also mirrors `search_tsv`: a queryable projection of the page, derived and
indexed, that is never a second source of truth.

## Representation

```sql
-- 0005_page_props.sql
ALTER TABLE pages ADD COLUMN props JSONB NOT NULL DEFAULT '{}';
CREATE INDEX idx_pages_props ON pages USING GIN (props jsonb_path_ops);

ALTER TABLE page_revisions ADD COLUMN props JSONB NOT NULL DEFAULT '{}';
```

- **Ser/deser** is symmetric and built on the existing `gopkg.in/yaml.v3` dep:
  YAML → `map[string]any` → JSONB on the way in; JSONB → `map[string]any` →
  `yaml.Marshal` on the way out. No custom format, no regex.
- **Queries are idiomatic, GIN-indexed Postgres** — not joins:
  - `WHERE props @> '{"status":"draft"}'` — containment
  - `WHERE props->>'owner' = 'cagdas'` — scalar
  - `WHERE props->'aliases' ? 'rfc'` — array membership
  - `ORDER BY (props->>'due')::date` — typed sort (add an expression index for
    hot keys)
- **EAV (`page_properties(page_id,key,value)`) is rejected** — multi-predicate
  filters become self-joins; that is the hacky/slow path JSONB avoids.

## Reserved-key policy (the actual spec)

Frontmatter is **not** a greenfield bag — several conventional keys map onto
things tela already owns. Model every key along two axes: does it come **IN**
from frontmatter, and does it go **OUT** to frontmatter?

| key | accepted IN? | written OUT? | source of truth |
|---|---|---|---|
| `id` | no | yes | `pages.id` |
| `slug` | no | yes | derived `pageSlug(title)` |
| `link` / URL | no | yes | derived `id` + title |
| `created` | no | yes | `created_at` column |
| `updated` | no | yes | `updated_at` column |
| `title` | seed-only (import precedence; never via the bag) | yes | `title` column |
| `space`, `parent`, `position` | no | **no (for now)** | columns |
| `published`/`draft`/`tags`/`*` | yes (bag) | yes (bag) | the bag |

The **emit-only set** — `id`, `slug`, `link`, `created`, `updated` — only ever
flows *out*: never accepted as input, always (re)written from the source of truth
when we generate frontmatter text. `title` is the near-exception (emitted from
the column; its only input path is the import title-precedence seed).

> **Silent-drop rule (the consistency guarantee).** If inbound frontmatter
> contains *any* reserved key (`id`, `slug`, `created`, `title`-as-bag-key, …) it
> is **silently dropped** — not stored, not errored. It isn't authoritative and
> will be regenerated on emit. So importing a file with `id: 999` or a hand-edited
> `slug:` is safe: the value is discarded in, the real one written back out. The
> reserved-key list is a **fixed namespace**; everything outside it is free-form.

The three tiers below are these same keys grouped by ownership.

### Tier 1 — column-derived
`title`, `created`/`date`, `updated`/`modified`, `slug`, `link`/canonical URL,
`id`.

- **Source of truth is a tela column** (`title`, `created_at`, `updated_at`) or a
  pure derivation (`slug` = `pageSlug(title)` from `slug.go`; `link` =
  `tela://page/{id}` + public URL).
- **Stripped on import** — they never enter the bag (storing a stale `created`
  that disagrees with `created_at` is exactly the double-source-of-truth we are
  avoiding). `title:` is still consumed as a **seed** through the existing import
  precedence (frontmatter → first H1 → filename; index pages use dir basename).
- **Synthesized on emit** from the columns, so exported frontmatter always shows
  correct, consistent values.

> Decision (with PO): `created_at`/`updated_at` stay 100% native tela. Frontmatter
> dates do **not** seed or drive them on import — they are only *produced* on the
> db → frontmatter-text conversion.

### Tier 2 — column-owned, ignored from frontmatter
`position`, `parent`, `space`.

Tree, ordering, and space come from tela (the import flatten / README-as-index
rules and `MAX(position)+1`). Frontmatter cannot drive them. **Not accepted in,
and not emitted out for now** (decision: keep the emitted block lean; revisit if
portability needs them).

### Tier 3 — free-form bag
Everything else, stored verbatim in `props`, queryable and round-tripped.

- `published` / `draft` / `public` — **no tela equivalent; no mapping.** They sit
  in the bag as ordinary data: stored, round-tripped, **never interpreted**. This
  is deliberate — interpreting them against `exposure`/`share_links` would be an
  accidental-publish footgun on import. Safety here comes from *not acting*, not
  from a guard.
- `tags` — stored in the bag for now (see Deferred).
- arbitrary user/agent keys — the queryable long tail.

## Two operations

- **import (frontmatter-text → db):** `yaml.v3` parse → silent-drop every
  reserved key (Tier 1 & Tier 2) → store the remainder in `props`. Title seeds via
  existing precedence.
- **emit (db → frontmatter-text):** synthesize the emit-only set + `title` from
  columns (`id`, `title`, `slug`, `link`, `created`, `updated`) + splice the
  `props` bag → canonical YAML block (key order: system keys first, then bag keys
  alphabetical), prepended to the body. This is where `slug`/`link` "fill in".
  **The system block is always emitted, even when the bag is empty** (consistent,
  round-trip-portable). `space`/`parent`/`position` are **not** emitted.

## Versioning

`page_revisions` (today `title + body` only) gains a `props` column, so a
property-only edit is versioned and shows in history/diff. Without it, property
changes would be invisible to history.

## Product-wide change map

| Surface | Change |
|---|---|
| **Schema** | `0005_page_props.sql`: `pages.props` + GIN; `page_revisions.props`. |
| **Import** (`mdimport/frontmatter.go`, `markdown.go`, `import_mira.go`) | `StripFrontmatter` → full `yaml.v3` parse returning `(body, props)`; title still seeds via existing precedence; persist `props`. |
| **Emit** (new helper) | `EmitFrontmatter(page)` — emit-only set (`id`/`title`/`slug`/`link`/`created`/`updated`) from columns + bag, canonical order; always emits the system block. |
| **Model / CRUD** (`models.go`, `pages.go`) | `Page.Props`; create/update accept props; revision writes capture props. |
| **MCP** (`mcp_tools.go`) | `get_page`/`create_page`/`update_page` carry props; `list_pages` gains containment filtering (`props @>`). The agent payoff. |
| **Egress** | Optional frontmatter-on flag in MCP `get_page`/`fetch`; a real `.md` export does not exist yet (open question). |
| **Graph / FTS / FE panel** | Deferred (Phase 3); seams left. |

## Phasing

- **Phase 1 — store + don't lose.** Schema, import parse, model/CRUD, revisions.
  After this nothing is discarded and it is all in the DB. Small and safe.
- **Phase 2 — agent reach.** MCP props in/out, `list_pages` filtering, emit
  helper. This is where it becomes *useful*.
- **Phase 3 — human reach.** FE properties panel (Notion/Obsidian-style, above
  the Milkdown doc, edits via REST — comments lane, no Yjs), graph coloring by
  property, tags-table promotion, optional prop-value folding into FTS.

## Deferred / open

- **Tags as a feature.** Tags-as-*data* are free in the bag from Phase 1
  (`props->'tags' ? 'x'`). Tags-as-a-*feature* — relational `tags`/`page_tags`,
  graph edges, clustering, the legend filters, a tag picker — is a later,
  non-destructive migration (backfill `page_tags` from `props->'tags'`). No
  regret cost in deferring.
- **Markdown export.** "Emit real frontmatter" implies a `.md` download path that
  does not exist today. Decide whether Phase 2 adds one or only reattaches
  frontmatter in the MCP egress.
- **FTS over property values.** `search_tsv` is title/body only. Folding selected
  prop values in (so `status: blocked` is findable) is a Phase 3 call.
- **Typing/coercion.** Frontmatter scalars are loose (strings, lists, dates,
  bools). v1 keeps them as parsed by `yaml.v3`; revisit if typed filters need
  stricter coercion.
</content>
</invoke>
