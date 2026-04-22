import type { SearchProvider, SearchResponse, SearchResult } from '../types'

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

// Brave freshness codes: pd=past day, pw=past week, pm=past month, py=past year
const RECENCY_TO_FRESHNESS: Record<string, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
  year: 'py',
}

interface BraveResultRaw {
  title?: string
  url?: string
  description?: string
  age?: string
  page_age?: string
}

interface BraveResponseRaw {
  web?: { results?: BraveResultRaw[] }
  error?: { message?: string; code?: number }
  message?: string
}

export const braveProvider: SearchProvider = {
  name: 'brave',
  async search({ query, max_results, recency }): Promise<SearchResponse> {
    const apiKey = process.env.BRAVE_API_KEY?.trim()
    if (!apiKey) {
      return {
        results: [],
        error:
          'BRAVE_API_KEY is not set on the server. Add it to .env.local and Vercel env.',
      }
    }
    const count = Math.min(Math.max(max_results ?? 10, 1), 20)
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      safesearch: 'moderate',
    })
    if (recency && RECENCY_TO_FRESHNESS[recency]) {
      params.set('freshness', RECENCY_TO_FRESHNESS[recency])
    }
    try {
      const res = await fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          results: [],
          error: `Brave search HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        }
      }
      const data = (await res.json()) as BraveResponseRaw
      if (data.error) {
        return {
          results: [],
          error: data.error.message || 'Brave search returned an error',
        }
      }
      const raw = data.web?.results || []
      const results: SearchResult[] = raw
        .filter((r) => r.url && r.title)
        .map((r) => ({
          title: decodeHtml(r.title || ''),
          url: r.url as string,
          snippet: decodeHtml(r.description || ''),
          published_date: r.page_age || r.age,
        }))
      return { results, error: null }
    } catch (err) {
      return { results: [], error: (err as Error).message }
    }
  },
}

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}
