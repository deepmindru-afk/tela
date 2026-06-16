import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { reportableApiError } from './queryClient'

// The filter that decides which handled query/mutation failures are worth a
// client.error report. Genuine breakage (network + 5xx) is in; expected/handled
// outcomes (auth flow, 4xx, disabled-feature 503s) are out, to keep the feed
// signal.
describe('reportableApiError', () => {
  it('reports network failures (status 0)', () => {
    expect(reportableApiError(new ApiError(0, 'network', 'network error'))).toBe(true)
  })

  it('reports server errors (5xx)', () => {
    expect(reportableApiError(new ApiError(500, 'internal', 'boom'))).toBe(true)
    expect(reportableApiError(new ApiError(503, 'unavailable', 'down'))).toBe(true)
  })

  it('skips session expiry (401)', () => {
    expect(reportableApiError(new ApiError(401, 'unauthorized', 'no session'))).toBe(false)
  })

  it('skips ordinary handled 4xx', () => {
    for (const s of [403, 404, 409, 422, 429]) {
      expect(reportableApiError(new ApiError(s, 'x', 'handled'))).toBe(false)
    }
  })

  it('skips the disabled-feature 503 sentinels', () => {
    expect(reportableApiError(new ApiError(503, 'rag_disabled', 'off'))).toBe(false)
    expect(reportableApiError(new ApiError(503, 'llm_disabled', 'off'))).toBe(false)
  })

  it('reports a non-ApiError escaping a query (unexpected by definition)', () => {
    expect(reportableApiError(new Error('weird'))).toBe(true)
    expect(reportableApiError('string thrown')).toBe(true)
  })
})
