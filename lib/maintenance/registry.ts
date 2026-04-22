import { deduplicator } from './tasks/deduplicator'
import { tagger } from './tasks/tagger'
import { patternFinder } from './tasks/pattern-finder'
import type { MaintenanceTask } from './types'

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  deduplicator,
  tagger,
  patternFinder,
]
