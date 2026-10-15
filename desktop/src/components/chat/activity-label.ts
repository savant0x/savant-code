// FID-2026-0901-006 P26 — one shared activity label (Law 13: one function,
// one truth). RunStatusBar, SessionStatusPanel, and the deck mini-chat all
// render "what is the agent doing right now"; the wording must not drift
// between surfaces, so the switch lives here exactly once.

import type { CurrentActivity } from '../../state/transcript-store'

/** One human label per activity kind — mirrors the CLI status indicator. */
export function activityLabel(activity: CurrentActivity | null): string {
  if (activity === null) return 'Working…'
  switch (activity.kind) {
    case 'thinking':
      return 'Thinking…'
    case 'tool':
      return `Running ${activity.toolName}${
        activity.target !== undefined ? ` · ${activity.target}` : ''
      }`
    case 'subagent':
      return `Delegating to ${activity.agentType}…`
    case 'researching':
      return `Researching: ${activity.query}`
  }
}
