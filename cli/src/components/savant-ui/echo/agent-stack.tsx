import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface AgentStackAgent {
  name: string
  active?: boolean
}

export interface AgentStackProps {
  agents: AgentStackAgent[]
}

/**
 * Normalize a raw agent ID to a display-friendly name.
 *
 *   - 'savant' and 'main-agent' both render as 'Savant'.
 *   - Other kebab-case IDs render in Title Case.
 *   - Already-formatted names are returned unchanged.
 */
function formatAgentName(name: string): string {
  if (name === 'savant' || name === 'main-agent') return 'Savant'
  return name
    .split('-')
    .map((word) =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1),
    )
    .join(' ')
}

/**
 * Renders a stack of agents as a clean bullet list.
 *
 * Active agents are highlighted with the primary theme color; inactive agents
 * use the foreground color. The old ASCII tree prefixes (`└─`, `├─`) have
 * been removed in favor of simple, theme-aware bullets.
 */
export function AgentStack({ agents }: AgentStackProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      {agents.map((agent, i) => {
        const isActive = agent.active ?? false
        return (
          <box
            key={i}
            flexDirection="row"
            gap={1}
            alignItems="center"
            focusable={false}
            selectable={false}
          >
            <text
              fg={isActive ? theme.primary : theme.muted}
              selectable={false}
            >
              {isActive ? '●' : '○'}
            </text>
            <text
              fg={isActive ? theme.foreground : theme.muted}
              wrapMode="none"
              selectable={false}
            >
              {formatAgentName(agent.name)}
            </text>
          </box>
        )
      })}
    </box>
  )
}
