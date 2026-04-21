import type { AgentDefinition } from './types'
import { kitchenSteward } from './kitchen-steward'
import { inboxTriage } from './inbox-triage'
import { coach } from './coach'
import { signalKeeper } from './signal-keeper'

export const AGENTS: Record<string, AgentDefinition> = {
  [kitchenSteward.id]: kitchenSteward,
  [inboxTriage.id]: inboxTriage,
  [coach.id]: coach,
  [signalKeeper.id]: signalKeeper,
}

export const AGENT_LIST: AgentDefinition[] = [
  kitchenSteward,
  inboxTriage,
  coach,
  signalKeeper,
]
