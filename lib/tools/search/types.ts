export interface SearchResult {
  title: string
  url: string
  snippet: string
  published_date?: string
}

export interface SearchResponse {
  results: SearchResult[]
  error: string | null
}

export interface SearchProvider {
  name: string
  search: (args: {
    query: string
    max_results?: number
    recency?: 'day' | 'week' | 'month' | 'year' | null
  }) => Promise<SearchResponse>
}
