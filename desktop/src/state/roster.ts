import { DECK_ROLE_IDS, ROLE_LABELS } from '../floor/roles'

export type RosterPresence = 'standby' | 'active'

export type RosterEntry = {
  roleId: (typeof DECK_ROLE_IDS)[number]
  label: string
  presence: RosterPresence
  agentId?: string
}

export function initialRoster(): RosterEntry[] {
  return DECK_ROLE_IDS.map((roleId) => ({
    roleId,
    label: ROLE_LABELS[roleId],
    presence: 'standby',
  }))
}

export function applyRosterEvent(
  roster: RosterEntry[],
  event:
    | { type: 'start'; agentId?: string }
    | { type: 'subagent_start'; agentId: string; agentType: string }
    | { type: 'subagent_finish'; agentId: string; agentType: string },
): RosterEntry[] {
  if (event.type === 'start') {
    return roster.map((entry) =>
      entry.roleId === 'savant'
        ? {
            ...entry,
            presence: 'active',
            ...(event.agentId ? { agentId: event.agentId } : {}),
          }
        : entry,
    )
  }

  const roleId = event.agentType.trim().toLowerCase()
  const known = roster.some((entry) => entry.roleId === roleId)
  if (!known) return roster

  return roster.map((entry) =>
    entry.roleId === roleId
      ? {
          ...entry,
          presence: event.type === 'subagent_start' ? 'active' : 'standby',
          ...(event.type === 'subagent_start'
            ? { agentId: event.agentId }
            : { agentId: undefined }),
        }
      : entry,
  )
}
