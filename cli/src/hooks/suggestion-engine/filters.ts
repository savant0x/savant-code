import {
  createHighlightIndices,
  createPushUnique,
  type MatchedAgentInfo,
  type MatchedSlashCommand,
} from './matchers'

import type { SlashCommand } from '../../data/slash-commands'
import type { LocalAgentInfo } from '../../utils/local-agent-registry'

export { filterFileMatches } from './filter-files'

export const filterSlashCommands = (
  commands: SlashCommand[],
  query: string,
): MatchedSlashCommand[] => {
  if (!query) {
    return commands
  }

  const normalized = query.toLowerCase()
  const matches: MatchedSlashCommand[] = []
  const seen = new Set<string>()
  const pushUnique = createPushUnique<MatchedSlashCommand, string>(
    (command) => command.id,
    seen,
  )
  const addMatch = (command: SlashCommand) => {
    const label = command.label.toLowerCase()
    const firstIndex = label.indexOf(normalized)
    const indices =
      firstIndex === -1
        ? null
        : createHighlightIndices(firstIndex, firstIndex + normalized.length)
    pushUnique(matches, {
      ...command,
      ...(indices && { labelHighlightIndices: indices }),
    })
  }

  // Exact command IDs take precedence over source order. This keeps `/model`
  // selected as `/model` even though the mode command family is declared first.
  for (const command of commands) {
    if (command.id.toLowerCase() === normalized) addMatch(command)
  }

  // Prefix of ID or alias
  for (const command of commands) {
    if (seen.has(command.id)) continue
    const id = command.id.toLowerCase()
    const aliasList = (command.aliases ?? []).map((alias) =>
      alias.toLowerCase(),
    )

    if (
      id.startsWith(normalized) ||
      aliasList.some((alias) => alias.startsWith(normalized))
    ) {
      addMatch(command)
    }
  }

  // Substring of ID or alias
  for (const command of commands) {
    if (seen.has(command.id)) continue
    const id = command.id.toLowerCase()
    const aliasList = (command.aliases ?? []).map((alias) =>
      alias.toLowerCase(),
    )

    if (
      id.includes(normalized) ||
      aliasList.some((alias) => alias.includes(normalized))
    ) {
      addMatch(command)
    }
  }

  // Substring of description
  for (const command of commands) {
    if (seen.has(command.id)) continue
    const description = command.description.toLowerCase()

    if (description.includes(normalized)) {
      const firstIndex = description.indexOf(normalized)
      const indices =
        firstIndex === -1
          ? null
          : createHighlightIndices(firstIndex, firstIndex + normalized.length)
      pushUnique(matches, {
        ...command,
        ...(indices && {
          descriptionHighlightIndices: indices,
        }),
      })
    }
  }

  return matches
}

export const filterAgentMatches = (
  agents: LocalAgentInfo[],
  query: string,
): MatchedAgentInfo[] => {
  if (!query) {
    return agents
  }

  const normalized = query.toLowerCase()
  const matches: MatchedAgentInfo[] = []
  const seen = new Set<string>()
  const pushUnique = createPushUnique<MatchedAgentInfo, string>(
    (agent) => agent.id,
    seen,
  )
  // Prefix of ID or name
  for (const agent of agents) {
    const id = agent.id.toLowerCase()

    if (id.startsWith(normalized)) {
      pushUnique(matches, {
        ...agent,
        idHighlightIndices: createHighlightIndices(0, normalized.length),
      })
      continue
    }

    const name = agent.displayName.toLowerCase()
    if (name.startsWith(normalized)) {
      pushUnique(matches, {
        ...agent,
        nameHighlightIndices: createHighlightIndices(0, normalized.length),
      })
    }
  }

  // Substring of ID or name
  for (const agent of agents) {
    if (seen.has(agent.id)) continue
    const id = agent.id.toLowerCase()
    const idFirstIndex = id.indexOf(normalized)
    if (idFirstIndex !== -1) {
      pushUnique(matches, {
        ...agent,
        idHighlightIndices: createHighlightIndices(
          idFirstIndex,
          idFirstIndex + normalized.length,
        ),
      })
      continue
    }

    const name = agent.displayName.toLowerCase()

    const nameFirstIndex = name.indexOf(normalized)
    if (nameFirstIndex !== -1) {
      pushUnique(matches, {
        ...agent,
        nameHighlightIndices: createHighlightIndices(
          nameFirstIndex,
          nameFirstIndex + normalized.length,
        ),
      })
      continue
    }
  }

  return matches
}
