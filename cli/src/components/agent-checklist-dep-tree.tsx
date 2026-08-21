import { getSimpleAgentId } from '@savant-code/common/util/agent-id-parsing'
import React from 'react'

import type { useTheme } from '../hooks/use-theme'
import type { LocalAgentInfo } from '../utils/local-agent-registry'

/** Recursively count local dependencies for an agent. */
export function countDependencies(
  agentId: string,
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>,
  localAgentIds: Set<string>,
  visited: Set<string>,
): number {
  if (visited.has(agentId)) return 0
  visited.add(agentId)

  const definition = agentDefinitions.get(agentId)
  const spawnableAgents = definition?.spawnableAgents ?? []

  let count = 0
  for (const spawnableId of spawnableAgents) {
    const simpleId = getSimpleAgentId(spawnableId)
    if (localAgentIds.has(simpleId) && !visited.has(simpleId)) {
      count +=
        1 +
        countDependencies(simpleId, agentDefinitions, localAgentIds, visited)
    }
  }

  return count
}

/** Build dependency tree for an agent. */
export interface DepTreeNode {
  id: string
  displayName: string
  children: DepTreeNode[]
}

export function buildDepTree(
  agentId: string,
  agents: LocalAgentInfo[],
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>,
  localAgentIds: Set<string>,
  ancestorIds: Set<string>,
): DepTreeNode[] {
  const definition = agentDefinitions.get(agentId)
  const spawnableAgents = definition?.spawnableAgents ?? []

  const newAncestorIds = new Set(ancestorIds)
  newAncestorIds.add(agentId)

  const children: DepTreeNode[] = []
  for (const spawnableId of spawnableAgents) {
    const simpleId = getSimpleAgentId(spawnableId)
    if (localAgentIds.has(simpleId) && !newAncestorIds.has(simpleId)) {
      const agent = agents.find((a) => a.id === simpleId)
      if (agent) {
        children.push({
          id: agent.id,
          displayName: agent.displayName,
          children: buildDepTree(
            simpleId,
            agents,
            agentDefinitions,
            localAgentIds,
            newAncestorIds,
          ),
        })
      }
    }
  }

  return children
}

/** Render dependency tree recursively. */
export const DepTree: React.FC<{
  nodes: DepTreeNode[]
  depth: number
  theme: ReturnType<typeof useTheme>
}> = ({ nodes, depth, theme }) => {
  return (
    <>
      {nodes.map((node, idx) => {
        const isLast = idx === nodes.length - 1
        const prefix = isLast ? '└─' : '├─'
        const displayText =
          node.displayName !== node.id
            ? `${node.displayName} (${node.id})`
            : node.displayName

        return (
          <React.Fragment key={node.id}>
            <box
              style={{
                flexDirection: 'row',
                gap: 1,
                paddingLeft: depth * 3 + 3,
              }}
            >
              <text style={{ fg: theme.muted }}>{prefix}</text>
              <text style={{ fg: theme.muted }}>{displayText}</text>
            </box>
            {node.children.length > 0 && (
              <DepTree nodes={node.children} depth={depth + 1} theme={theme} />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
