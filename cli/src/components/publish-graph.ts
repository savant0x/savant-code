import { getSimpleAgentId } from '@savant-code/common/util/agent-id-parsing'

import type { LocalAgentInfo } from '../utils/local-agent-registry'

/** Shared shape for the spawnable-agents lookup used by the graph functions. */
export type PublishAgentDefinitions = Map<
  string,
  { spawnableAgents?: string[] }
>

// Compute all dependencies (agents that the selected agents spawn)
export function computeDependencies(
  selectedAgentIds: Set<string>,
  agentDefinitions: PublishAgentDefinitions,
  localAgentIds: Set<string>,
): Set<string> {
  const dependencies = new Set<string>()
  const visited = new Set<string>()

  function collectDependencies(agentId: string) {
    if (visited.has(agentId)) return
    visited.add(agentId)

    const definition = agentDefinitions.get(agentId)
    const spawnableAgents = definition?.spawnableAgents ?? []

    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (localAgentIds.has(simpleId) && !selectedAgentIds.has(simpleId)) {
        dependencies.add(simpleId)
        collectDependencies(simpleId)
      }
    }
  }

  for (const agentId of selectedAgentIds) {
    collectDependencies(agentId)
  }

  return dependencies
}

// Compute all dependents (agents that spawn the selected agents - reverse dependencies)
// This finds agents that directly or transitively spawn the selected agents
export function computeDependents(
  selectedAgentIds: Set<string>,
  dependencyIds: Set<string>,
  agentDefinitions: PublishAgentDefinitions,
  localAgentIds: Set<string>,
): Set<string> {
  const dependents = new Set<string>()
  // Combined set of agents we're already including (selected + their children)
  const alreadyIncluded = new Set([...selectedAgentIds, ...dependencyIds])

  // Build a reverse map: for each agent, which agents spawn it?
  const spawnedBy = new Map<string, Set<string>>()
  for (const [agentId, definition] of agentDefinitions) {
    const spawnableAgents = definition.spawnableAgents ?? []
    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (!spawnedBy.has(simpleId)) {
        spawnedBy.set(simpleId, new Set())
      }
      spawnedBy.get(simpleId)!.add(agentId)
    }
  }

  // Find all agents that transitively spawn any of the selected agents
  const visited = new Set<string>()
  function findParents(agentId: string) {
    const parents = spawnedBy.get(agentId)
    if (!parents) return

    for (const parentId of parents) {
      if (visited.has(parentId)) continue
      visited.add(parentId)

      // Skip if already included or not a local agent
      if (alreadyIncluded.has(parentId)) continue
      if (!localAgentIds.has(parentId)) continue

      dependents.add(parentId)
      // Recursively find parents of this parent
      findParents(parentId)
    }
  }

  // Start from each selected agent and find all its parents
  for (const agentId of selectedAgentIds) {
    findParents(agentId)
  }

  return dependents
}

// Export helper to get all agent IDs for publishing (recursive)
export function getAllPublishAgentIds(
  selectedAgents: LocalAgentInfo[],
  allAgents: LocalAgentInfo[],
  agentDefinitions: PublishAgentDefinitions,
  includeDependents: boolean = false,
): string[] {
  // Defensively filter out bundled agents to ensure they're never published
  const publishableAgents = allAgents.filter((a) => !a.isBundled)
  const publishableSelectedAgents = selectedAgents.filter((a) => !a.isBundled)
  const localAgentIds = new Set(publishableAgents.map((a) => a.id))

  const selectedIds = new Set(publishableSelectedAgents.map((a) => a.id))
  const result = new Set<string>(selectedIds)

  // Collect dependencies (agents the selected agents spawn)
  function collectDependencies(agentId: string) {
    if (!localAgentIds.has(agentId)) return

    const definition = agentDefinitions.get(agentId)
    const spawnableAgents = definition?.spawnableAgents ?? []

    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (localAgentIds.has(simpleId) && !result.has(simpleId)) {
        result.add(simpleId)
        collectDependencies(simpleId)
      }
    }
  }

  for (const agent of publishableSelectedAgents) {
    collectDependencies(agent.id)
  }

  // Optionally collect dependents (agents that spawn the selected/dependency agents)
  if (includeDependents) {
    // Build a reverse lookup of child -> parent agents for publishable agents
    const parentMap = new Map<string, string[]>()

    for (const [agentId, definition] of agentDefinitions) {
      if (!localAgentIds.has(agentId)) continue

      const spawnableAgents = definition.spawnableAgents ?? []
      for (const spawnableId of spawnableAgents) {
        const simpleId = getSimpleAgentId(spawnableId)
        if (!localAgentIds.has(simpleId)) continue

        const parents = parentMap.get(simpleId)
        if (parents) {
          parents.push(agentId)
        } else {
          parentMap.set(simpleId, [agentId])
        }
      }
    }

    // Walk upward from the currently included agents to gather all ancestors
    const stack = Array.from(result)
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue

      const parents = parentMap.get(current) ?? []
      for (const parentId of parents) {
        if (result.has(parentId)) continue

        result.add(parentId)
        stack.push(parentId)
      }
    }
  }

  return Array.from(result)
}
