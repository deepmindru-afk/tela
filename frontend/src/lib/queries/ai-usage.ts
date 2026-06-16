import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

// AI usage log rollups (GET /api/admin/ai-usage). Token counts are length-based
// estimates — the raw material for cost estimation. See backend ai_usage.go.

export interface AIUsageWeek {
  week: string
  chat_tokens: number
  embed_tokens: number
  images: number
}

export interface AIUsageModel {
  model: string
  kind: string
  tokens: number
  units: number
  calls: number
}

export interface AIUsage {
  weeks: AIUsageWeek[]
  models: AIUsageModel[]
}

export const aiUsageKeys = { usage: ['admin-ai-usage'] as const }

export function useAIUsage() {
  return useQuery({
    queryKey: aiUsageKeys.usage,
    queryFn: () => api<AIUsage>('/api/admin/ai-usage'),
    staleTime: 60_000,
  })
}
