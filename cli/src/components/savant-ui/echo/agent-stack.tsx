import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface AgentStackAgent {
  name: string
  active?: boolean
}

export interface AgentStackProps {
  agents: AgentStackAgent[]
}

export function AgentStack({ agents }: AgentStackProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column">
      {agents.map((agent, i) => {
        const isLast = i === agents.length - 1
        const prefix = i === 0 ? '└─ ' : isLast ? '  └─ ' : '  ├─ '
        const isActive = agent.active

        return (
          <text key={i} fg={isActive ? theme.primary : theme.foreground}>
            {prefix}{isActive ? '● ' : '○ '}{agent.name}
          </text>
        )
      })}
    </box>
  )
}
