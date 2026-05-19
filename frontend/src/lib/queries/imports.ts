// M14.1 — markdown bulk import. Wraps the M14.0 backend endpoint
// POST /api/spaces/{id}/import (multipart). Cache invalidation on a successful
// real run refreshes the sidebar tree and refreshes the body-fuzzy index for
// the target space; dry-runs don't touch caches because no rows changed.
//
// Yjs scope (Hard Rule #6): zero Yjs imports in this file.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api'
import { emitPageMutation } from '../pageMutationEvent'
import { pageKeys } from './pages'

// Mirrors backend/internal/mdimport.ImportedPage exactly. ParentID is nullable
// (null = the page sits at the request's parent_id; serialized as null for
// space-root imports).
export interface ImportedPage {
  id: number
  title: string
  parent_id: number | null
  path: string
}

export interface ImportSkippedFile {
  path: string
  reason: string
}

export interface ImportErrorFile {
  path: string
  reason: string
}

export interface ImportSummary {
  created: number
  skipped: number
  conflicts_renamed: number
}

export interface ImportResult {
  summary: ImportSummary
  pages: ImportedPage[]
  skipped: ImportSkippedFile[]
  errors: ImportErrorFile[]
}

export interface ImportPagesInput {
  spaceId: number
  // Optional target parent page id. Omit / null for "(space root)".
  parentId: number | null
  // FileList entries from the form input. Folder mode → each File carries
  // `webkitRelativePath`; single-file mode → falls back to `file.name`. The
  // backend reads the multipart filename header to recover the directory
  // hierarchy, so we MUST pass the relative path as the third arg to
  // FormData.append.
  files: File[]
  // When true, the backend parses + plans but does not write. Response shape
  // is identical; the caller renders a planned-tree preview.
  dryRun: boolean
}

// Run the import via fetch — `api()` doesn't handle multipart bodies because
// it stamps Content-Type: application/json. The browser sets the multipart
// boundary automatically when we hand it a FormData. Failure path matches
// `api()`: throws ApiError with the parsed `{error, code}` envelope.
async function postImport(input: ImportPagesInput): Promise<ImportResult> {
  const form = new FormData()
  if (input.parentId != null) form.set('parent_id', String(input.parentId))
  form.set('dry_run', input.dryRun ? 'true' : 'false')
  for (const f of input.files) {
    form.append('files', f, f.webkitRelativePath || f.name)
  }

  let res: Response
  try {
    res = await fetch(`/api/spaces/${input.spaceId}/import`, {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
  } catch (err) {
    throw new ApiError(
      0,
      'network',
      err instanceof Error ? err.message : 'network error',
    )
  }

  if (!res.ok) {
    const ct = res.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
        code?: string
      } | null
      if (body && typeof body.error === 'string' && typeof body.code === 'string') {
        throw new ApiError(res.status, body.code, body.error)
      }
    }
    const fallback = await res.text().catch(() => '')
    throw new ApiError(res.status, 'http_error', fallback || `HTTP ${res.status}`)
  }

  return (await res.json()) as ImportResult
}

export function useImportPages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postImport,
    onSuccess: (result, input) => {
      if (input.dryRun) return
      void qc.invalidateQueries({ queryKey: pageKeys.space(input.spaceId) })
      emitPageMutation()
      // Body-fuzzy refresh: if the target space's index is loaded, pull the
      // deltas now so palette tier-3 + /search pick up the new bodies without
      // waiting for the next palette-open drift check. Dynamic import keeps
      // Orama runtime off the main chunk for users who never import.
      if (result.summary.created > 0) {
        void import('../search/body-index').then((m) => {
          const idx = m.getLoadedBodyIndex(input.spaceId)
          if (idx) void idx.refresh()
        })
      }
    },
  })
}
