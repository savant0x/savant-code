import { memo } from 'react'
import { TextAttributes } from '@opentui/core'

import { useTheme } from '../hooks/use-theme'
import { getVersion } from '../utils/version'

interface ToolCall {
  name: string
  timestamp: number
}

interface AgentInfo {
  id: string
  isActive: boolean
}

interface FilesChanged {
  modified: number
  added: number
  deleted: number
}

interface RightSidebarProps {
  tokensUsed: number
  tokensMax: number
  contextPercent: number
  cost: number
  model: string
  mode: string
  agent: string
  toolsUsed: string[]
  toolsAvailable: string[]
  filesChanged: FilesChanged
  agentStack: AgentInfo[]
  toolHistory: ToolCall[]
}

const ContextBar = ({ percent }: { percent: number }) => {
  const theme = useTheme()
  const barWidth = 10
  const filled = Math.round((percent / 100) * barWidth)
  const empty = barWidth - filled

  // Color based on usage: green (0-40%), yellow (40-70%), red (70-100%)
  let barColor = theme.success
  if (percent > 70) barColor = theme.error
  else if (percent > 40) barColor = theme.warning

  return (
    <span>
      <span fg={barColor}>{'█'.repeat(filled)}</span>
      <span fg={theme.muted}>{'░'.repeat(empty)}</span>
    </span>
  )
}

export const RightSidebar = memo(function RightSidebar({
  tokensUsed,
  tokensMax,
  contextPercent,
  cost,
  model,
  mode,
  agent,
  toolsUsed,
  toolsAvailable,
  filesChanged,
  agentStack,
  toolHistory,
}: RightSidebarProps) {
  const theme = useTheme()

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`
  }

  const truncate = (str: string, max: number): string => {
    return str.length > max ? str.slice(0, max - 1) + '…' : str
  }

  return (
    <box
      style={{
        flexDirection: 'column',
        width: 30,
        paddingLeft: 1,
        paddingRight: 1,
        borderStyle: 'single',
        borderFg: theme.border,
      }}
    >
      {/* Header */}
      <text attributes={TextAttributes.BOLD} fg={theme.accent}>
        {'┌─ SAVANT ─────────────┐'}
      </text>
      <text fg={theme.muted} marginBottom={1}>
        {'│ One Mind. A Thousand │'}
      </text>
      <text fg={theme.muted} marginBottom={1}>
        {'│   Faces.             │'}
      </text>

      {/* Session Section */}
      <box flexDirection="column" marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ┌─ Session ────────────┐
        </text>
        <text fg={theme.foreground}>
          {' '}tokens    {formatTokens(tokensUsed)}/{formatTokens(tokensMax)}
        </text>
        <text fg={theme.foreground}>
          {' '}context   {contextPercent.toFixed(1)}% <ContextBar percent={contextPercent} />
        </text>
        <text fg={theme.foreground}>
          {' '}cost      {formatCost(cost)}
        </text>
        <text fg={theme.foreground}>
          {' '}model     {truncate(model, 14)}
        </text>
        <text fg={theme.foreground}>
          {' '}mode      [{mode}]
        </text>
        <text fg={theme.foreground}>
          {' '}agent     {truncate(agent === 'main-agent' ? 'Savant' : agent, 14)}
        </text>
        <text fg={theme.muted}>
          └──────────────────────┘
        </text>
      </box>

      {/* Tools Section */}
      <box flexDirection="column" marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ┌─ Tools ──────────────┐
        </text>
        {toolsUsed.map((tool, i) => (
          <text key={`used-${i}`} fg={theme.foreground}>
            {' '}<span fg={theme.primary}>●</span> {tool}
          </text>
        ))}
        {toolsAvailable
          .filter((t) => !toolsUsed.includes(t))
          .slice(0, 5)
          .map((tool, i) => (
            <text key={`avail-${i}`} fg={theme.muted}>
              {' '}○ {tool}
            </text>
          ))}
        <text fg={theme.muted}>
          └──────────────────────┘
        </text>
      </box>

      {/* Files Changed Section */}
      <box flexDirection="column" marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ┌─ Files Changed ───┐
        </text>
        <text fg={theme.foreground}>
          {' '} {filesChanged.modified} modified
        </text>
        <text fg={theme.foreground}>
          {' '} {filesChanged.added} added
        </text>
        <text fg={theme.foreground}>
          {' '} {filesChanged.deleted} deleted
        </text>
        <text fg={theme.muted}>
          └──────────────────┘
        </text>
      </box>

      {/* Agent Stack Section */}
      <box flexDirection="column" marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ┌─ Agent Stack ───────┐
        </text>
        {agentStack.map((a, i) => (
          <text key={`agent-${i}`} fg={theme.foreground}>
            {' '} {a.isActive ? <span fg={theme.primary}>◆</span> : <span fg={theme.muted}>○</span>} {a.id}{a.isActive ? ' (active)' : ''}
          </text>
        ))}
        <text fg={theme.muted}>
          └──────────────────────┘
        </text>
      </box>

      {/* History Section */}
      <box flexDirection="column">
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ┌─ History ──────────┐
        </text>
        {toolHistory.slice(-5).map((call, i) => {
          const date = new Date(call.timestamp)
          const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
          return (
            <text key={`history-${i}`} fg={theme.muted}>
              {' '} {time}  {call.name}
            </text>
          )
        })}
        <text fg={theme.muted}>
          └──────────────────────┘
        </text>
      </box>

      {/* Version */}
      <text
        style={{
          fg: theme.muted,
          justifyContent: 'flex-end',
          marginTop: 'auto',
        }}
      >
        {'          v' + getVersion()}
      </text>
    </box>
  )
})
