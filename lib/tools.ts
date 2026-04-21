// Real tool registry — distinct from the card tools in lib/cards.ts.
// Cards render UI; these do work: search, read/write memory, Gmail, Calendar.
// AUTO tools are executed server-side whenever the model calls them.
// CONFIRM tools MUST NOT execute directly — the model emits a
// card_confirm_action instead, and the user taps "Confirm" which routes
// through /api/tools/execute.

import type { ToolDefinition } from './model-router'

export interface ToolMeta {
  definition: ToolDefinition
  requires_confirmation: boolean
}

export const TOOLS: Record<string, ToolMeta> = {
  // ────── AUTO tools ─────────────────────────────────────────
  search_web: {
    requires_confirmation: false,
    definition: {
      name: 'search_web',
      description:
        'Search the web for current information. Returns a list of search results with title, url, and snippet.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          max_results: { type: 'number', default: 8 },
        },
        required: ['query'],
      },
    },
  },
  scrape_url: {
    requires_confirmation: false,
    definition: {
      name: 'scrape_url',
      description:
        'Fetch a URL and return readable text content. Strips nav/footer/scripts.',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          max_chars: { type: 'number', default: 8000 },
        },
        required: ['url'],
      },
    },
  },
  read_memory: {
    requires_confirmation: false,
    definition: {
      name: 'read_memory',
      description:
        "Retrieve records from the user's memory. Filter by domain, tag, or content_type. Returns recent matching records.",
      input_schema: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          tag: { type: 'string' },
          content_type: { type: 'string' },
          limit: { type: 'number', default: 20 },
          query_contains: {
            type: 'string',
            description: 'Optional substring to search content field',
          },
        },
      },
    },
  },
  write_memory: {
    requires_confirmation: false,
    definition: {
      name: 'write_memory',
      description:
        "Create a new memory record for the user. Use concise, specific content.",
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          content_type: { type: 'string', default: 'fact' },
          domain: { type: 'string', default: 'personal' },
          tags: { type: 'array', items: { type: 'string' } },
          structured_data: { type: 'object' },
        },
        required: ['content'],
      },
    },
  },
  list_gmail_threads: {
    requires_confirmation: false,
    definition: {
      name: 'list_gmail_threads',
      description:
        'List recent Gmail threads (read-only). Takes a time window. Returns thread ids, senders, subjects, snippets.',
      input_schema: {
        type: 'object',
        properties: {
          since_hours: { type: 'number', default: 24 },
          max_threads: { type: 'number', default: 50 },
        },
      },
    },
  },
  read_gmail_thread: {
    requires_confirmation: false,
    definition: {
      name: 'read_gmail_thread',
      description: 'Read a specific Gmail thread by id. Returns full messages.',
      input_schema: {
        type: 'object',
        properties: {
          thread_id: { type: 'string' },
        },
        required: ['thread_id'],
      },
    },
  },
  list_calendar_events: {
    requires_confirmation: false,
    definition: {
      name: 'list_calendar_events',
      description: 'List upcoming calendar events (read-only).',
      input_schema: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', default: 7 },
          calendar_id: { type: 'string' },
        },
      },
    },
  },
  draft_email: {
    requires_confirmation: false,
    definition: {
      name: 'draft_email',
      description:
        "Save a draft email to the user's Salence drafts table. Does NOT send. The user can approve and send via card_confirm_action.",
      input_schema: {
        type: 'object',
        properties: {
          thread_id: { type: 'string' },
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },

  // ────── CONFIRM tools ──────────────────────────────────────
  // These are advertised to the model so it can reference them in
  // card_confirm_action payloads, but the API route refuses to execute
  // them directly — the user must confirm.
  send_email: {
    requires_confirmation: true,
    definition: {
      name: 'send_email',
      description:
        'Send an email. REQUIRES user confirmation via card_confirm_action. Never call this tool directly.',
      input_schema: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          thread_id: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  create_calendar_event: {
    requires_confirmation: true,
    definition: {
      name: 'create_calendar_event',
      description:
        'Create a calendar event. REQUIRES user confirmation via card_confirm_action.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          description: { type: 'string' },
          attendees: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'start', 'end'],
      },
    },
  },
  delete_calendar_event: {
    requires_confirmation: true,
    definition: {
      name: 'delete_calendar_event',
      description:
        'Delete a calendar event. REQUIRES user confirmation via card_confirm_action.',
      input_schema: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
        },
        required: ['event_id'],
      },
    },
  },
  delete_memory_record: {
    requires_confirmation: true,
    definition: {
      name: 'delete_memory_record',
      description:
        'Delete a record from the user memory. REQUIRES user confirmation via card_confirm_action.',
      input_schema: {
        type: 'object',
        properties: {
          record_id: { type: 'string' },
        },
        required: ['record_id'],
      },
    },
  },
}

export function toolDefinitions(names: string[]): ToolDefinition[] {
  return names
    .map((n) => TOOLS[n]?.definition)
    .filter((t): t is ToolDefinition => !!t)
}

export function isConfirmTool(name: string): boolean {
  return !!TOOLS[name]?.requires_confirmation
}
