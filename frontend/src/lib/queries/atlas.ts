import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// Mirrors the backend atlas DTOs (internal/api/atlas_http.go) + core types
// (internal/atlas/core). atlas turns a git repo into coverage-audited docs in a
// managed space; see docs/atlas.md.

export interface AtlasGap {
  kind: string
  name: string
  file: string
  line: number
}

export interface AtlasCoverage {
  total: number
  covered: number
  must_total: number
  must_covered: number
  gaps: AtlasGap[]
  citations: number
  bad_citations: number
  bad_cites?: string[]
  mermaid: number
  mermaid_valid: number
  mermaid_invalid: number
}

export interface AtlasUsage {
  chat_calls: number
  embed_calls: number
  prompt_tokens: number
  completion_tokens: number
  embed_tokens: number
}

export interface AtlasStats {
  files: number
  surface: number
  chunks: number
  pages: number
  duration_sec: number
  chat_model: string
  embed_model: string
  usage: AtlasUsage
  cost: number
}

export type AtlasRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'canceled'

export interface AtlasSource {
  id: number
  space_id: number
  parent_page_id?: number
  type: string
  location: string
  name: string
  ref: string
  branch?: string
  subpath?: string
  include?: string
  exclude?: string
  cadence: string
  auto_update: boolean
  last_refresh_at?: string
  created_at: string
  last_run_id?: number
  last_run_status?: AtlasRunStatus
  last_must_rate?: number
}

export interface AtlasRun {
  id: number
  source_id: number
  kind: string
  status: AtlasRunStatus
  stage: string
  err?: string
  coverage?: AtlasCoverage
  stats?: AtlasStats
  started_at: string
  finished_at?: string
}

export interface AtlasRunEvent {
  run_id: number
  stage: string
  level: 'info' | 'warn' | 'error'
  msg: string
  cur: number
  total: number
  at: string
}

// Rates are Go methods (not serialized) — compute them here.
export function coverageRate(c?: AtlasCoverage): number {
  if (!c || c.total === 0) return 1
  return c.covered / c.total
}
export function mustCoverRate(c?: AtlasCoverage): number {
  if (!c || c.must_total === 0) return 1
  return c.must_covered / c.must_total
}

export const TERMINAL_STATUSES: AtlasRunStatus[] = ['done', 'failed', 'canceled']
export function isTerminal(s?: AtlasRunStatus): boolean {
  return s != null && TERMINAL_STATUSES.includes(s)
}

export interface CreateAtlasSourceInput {
  type?: string // 'git' (default)
  location: string
  name?: string
  branch?: string
  subpath?: string
  include?: string
  exclude?: string
  parent_page_id?: number
  cadence?: string
  auto_update?: boolean
}

export const atlasKeys = {
  all: ['atlas'] as const,
  sources: (spaceId: number) => [...atlasKeys.all, 'sources', spaceId] as const,
  runs: (sourceId: number) => [...atlasKeys.all, 'runs', sourceId] as const,
  run: (runId: number) => [...atlasKeys.all, 'run', runId] as const,
}

// Sources bound to a space (+ whether the space is atlas-managed).
export function useAtlasSources(spaceId: number | null | undefined) {
  return useQuery({
    queryKey: spaceId != null ? atlasKeys.sources(spaceId) : atlasKeys.sources(-1),
    queryFn: () =>
      api<{ sources: AtlasSource[]; managed: boolean; can_manage: boolean }>(
        `/api/spaces/${spaceId}/atlas/sources`,
      ),
    enabled: spaceId != null,
  })
}

export function useCreateAtlasSource(spaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAtlasSourceInput) =>
      api<{ source: AtlasSource }>(`/api/spaces/${spaceId}/atlas/sources`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: atlasKeys.sources(spaceId) })
    },
  })
}

export function useDeleteAtlasSource(spaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sourceId: number) =>
      api<void>(`/api/atlas/sources/${sourceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: atlasKeys.sources(spaceId) })
    },
  })
}

export function useStartAtlasRun(spaceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sourceId: number) =>
      api<{ run_id: number }>(`/api/atlas/sources/${sourceId}/run`, { method: 'POST' }),
    onSuccess: (_data, sourceId) => {
      void qc.invalidateQueries({ queryKey: atlasKeys.sources(spaceId) })
      void qc.invalidateQueries({ queryKey: atlasKeys.runs(sourceId) })
    },
  })
}

export function useAtlasSourceRuns(sourceId: number | null | undefined) {
  return useQuery({
    queryKey: sourceId != null ? atlasKeys.runs(sourceId) : atlasKeys.runs(-1),
    queryFn: () => api<{ runs: AtlasRun[] }>(`/api/atlas/sources/${sourceId}/runs`),
    enabled: sourceId != null,
  })
}

export function useAtlasRun(runId: number | null | undefined) {
  return useQuery({
    queryKey: runId != null ? atlasKeys.run(runId) : atlasKeys.run(-1),
    queryFn: () => api<{ run: AtlasRun }>(`/api/atlas/runs/${runId}`),
    enabled: runId != null,
  })
}

// useAtlasRunStream subscribes to a run's live progress over SSE. The backend
// replays the full persisted event log on every (re)connect, so we clear on
// `onopen` — a reconnect then re-renders the complete log with no duplication.
// On the terminal '__end__' marker it closes and calls onEnd (e.g. to refetch
// the run for its final coverage/stats).
export function useAtlasRunStream(
  runId: number | null | undefined,
  opts?: { enabled?: boolean; onEnd?: () => void },
): { events: AtlasRunEvent[]; streaming: boolean } {
  const [events, setEvents] = useState<AtlasRunEvent[]>([])
  const [streaming, setStreaming] = useState(false)
  const enabled = (opts?.enabled ?? true) && runId != null
  const onEnd = opts?.onEnd

  useEffect(() => {
    if (!enabled || runId == null) return
    const es = new EventSource(`/api/atlas/runs/${runId}/stream`)
    es.onopen = () => {
      setEvents([])
      setStreaming(true)
    }
    es.onmessage = (e) => {
      let ev: AtlasRunEvent
      try {
        ev = JSON.parse(e.data) as AtlasRunEvent
      } catch {
        return
      }
      if (ev.stage === '__end__') {
        es.close()
        setStreaming(false)
        onEnd?.()
        return
      }
      setEvents((prev) => [...prev, ev])
    }
    return () => {
      es.close()
      setStreaming(false)
    }
  }, [runId, enabled, onEnd])

  return { events, streaming }
}
