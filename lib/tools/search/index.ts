import { braveProvider } from './providers/brave'
import { duckduckgoProvider } from './providers/duckduckgo'
import type { SearchProvider, SearchResponse } from './types'

export type { SearchResponse, SearchResult, SearchProvider } from './types'

const PROVIDERS: Record<string, SearchProvider> = {
  brave: braveProvider,
  duckduckgo: duckduckgoProvider,
}

export function getSearchProvider(name?: string): SearchProvider {
  const key = (name || process.env.SEARCH_PROVIDER || 'brave').toLowerCase()
  return PROVIDERS[key] || braveProvider
}

export async function search_web(input: {
  query: string
  max_results?: number
  recency?: 'day' | 'week' | 'month' | 'year' | null
}): Promise<SearchResponse> {
  if (!input.query || !input.query.trim()) {
    return { results: [], error: 'Empty query' }
  }
  const provider = getSearchProvider()
  return provider.search({
    query: input.query,
    max_results: input.max_results,
    recency: input.recency ?? null,
  })
}
