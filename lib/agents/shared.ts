// Shared prompt fragments reused across agents.

export const FAILURE_HANDLING_BLOCK = `FAILURE HANDLING:
- If a required tool (search_web, scrape_url, list_gmail_threads, etc.)
  returns an error or empty result that prevents meaningful output, do
  NOT fabricate.
- Render a clear message explaining what happened and what the user can
  do to retry or unblock.
- Do NOT write memory records for failed runs (preserves de-dup integrity).`
