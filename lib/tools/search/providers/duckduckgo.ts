import type { SearchProvider, SearchResponse, SearchResult } from '../types'

// Kept as a fallback provider. DuckDuckGo blocks scrapers aggressively so
// results are unreliable; prefer Brave in production.
export const duckduckgoProvider: SearchProvider = {
  name: 'duckduckgo',
  async search({ query, max_results }): Promise<SearchResponse> {
    try {
      const res = await fetch(
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; SalenceBot/1.0; +https://salence.app)',
          },
        }
      )
      if (!res.ok) {
        return { results: [], error: `DuckDuckGo HTTP ${res.status}` }
      }
      const html = await res.text()
      const results: SearchResult[] = []
      const re =
        /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
      let m: RegExpExecArray | null
      const max = max_results ?? 8
      while ((m = re.exec(html)) !== null && results.length < max) {
        const url = decodeURIComponent(
          m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]
        )
        const title = stripTags(m[2]).trim()
        const snippet = stripTags(m[3]).trim()
        if (url && title) results.push({ title, url, snippet })
      }
      if (results.length === 0) {
        return {
          results: [],
          error: 'DuckDuckGo returned no results (likely blocked or rate-limited)',
        }
      }
      return { results, error: null }
    } catch (err) {
      return { results: [], error: (err as Error).message }
    }
  },
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}
