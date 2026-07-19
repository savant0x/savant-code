import { memo } from 'react'
import { TextAttributes } from '@opentui/core'

import { useTheme } from '../hooks/use-theme'
import { getVersion } from '../utils/version'
import { IS_FREEBUFF } from '../utils/constants'
import { loadCodebuffModelPreference } from '../utils/settings'
import { useFreebuffModelStore } from '../state/freebuff-model-store'
import { useChatStore } from '../state/chat-store'
import { AgentStack, Timeline } from './savant-ui'

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
  const fsmPhase = useChatStore((s) => s.fsmPhase) ?? 'idle'
  const devMode = useChatStore((s) => s.devMode)

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

  // Fix: use the correct model source based on mode
  const displayModel = IS_FREEBUFF
    ? useFreebuffModelStore.getState().selectedModel
    : loadCodebuffModelPreference() ?? model

  // Dynamic border width
  const W = 40
  const inner = W - 4
  const pad = (s: string, w: number = inner) => s.padEnd(w)

  const topBorder = '┌' + '─'.repeat(W - 2) + '┐'
  const midBorder = '├' + '─'.repeat(W - 2) + '┤'
  const botBorder = '└' + '─'.repeat(W - 2) + '┘'

  const LABEL_W = 9
  const row = (label: string, value: string) => `│ ${pad(label.padEnd(LABEL_W) + value)} │`
  const line = (content: string) => `│ ${pad(content)} │`
  const centerLine = (content: string) => {
    const space = inner - content.length
    const left = Math.floor(space / 2)
    const right = space - left
    return `│ ${' '.repeat(left)}${content}${' '.repeat(right)} │`
  }

  // ECHO FSM phase display — inlined (not <PhaseIndicator/>) because
  // OpenTUI forbids nesting <text> inside <text>. Using <span> children is
  // the idiomatic mixed-color pattern (see RenderUIButton).
  const PHASE_INFO: Record<string, { fg: string; label: string; icon: string }> = {
    idle: { fg: '#6b7280', label: 'IDLE', icon: '○' },
    red: { fg: '#ef4444', label: 'RED', icon: '●' },
    green: { fg: '#39ff14', label: 'GREEN', icon: '●' },
    audit: { fg: '#eab308', label: 'AUDIT', icon: '●' },
    self_correct: { fg: '#f97316', label: 'FIX', icon: '●' },
    complete: { fg: '#06b6d4', label: 'DONE', icon: '●' },
  }
  const pi = PHASE_INFO[fsmPhase] ?? PHASE_INFO.idle
  const phaseStr = `${pi.icon} ${pi.label}`
  const phaseContent = `phase  ${phaseStr}`
  const phasePad = ' '.repeat(Math.max(0, inner - phaseContent.length))

  // FID-2026-0718-009: runtime activity indicator (distinct from fsmPhase).
  const activity = useChatStore((s) => s.activity)
  const ACT_INFO: Record<string, { fg: string; label: string; icon: string }> =
    {
      idle: { fg: '#6b7280', label: 'idle', icon: '○' },
      thinking: { fg: '#a78bfa', label: 'thinking', icon: '⚡' },
      tool: { fg: '#eab308', label: 'tool', icon: '⚙' },
      subagent: { fg: '#f97316', label: 'subagent', icon: '◆' },
      researching: { fg: '#3b82f6', label: 'researching', icon: '◇' },
    }
  const ai = ACT_INFO[activity.kind] ?? ACT_INFO.idle
  let activityDetail = ''
  if (activity.kind === 'tool') {
    activityDetail = activity.target
      ? `${activity.toolName}: ${activity.target}`
      : (activity.toolName ?? '')
  } else if (activity.kind === 'subagent') {
    activityDetail = activity.agentType ?? ''
  } else if (activity.kind === 'researching') {
    activityDetail = activity.query ?? ''
  } else if (activity.kind === 'thinking' && activity.model) {
    activityDetail = activity.model
  }
  const activityStr = activityDetail
    ? `${ai.icon} ${activityDetail}`
    : ai.icon
  const actContent = `work  ${activityStr}`
  const actPad = ' '.repeat(Math.max(0, inner - actContent.length))

  return (
    <box flexDirection="column" width={W} flexShrink={0}>
      {/* Header */}
      <text fg={theme.muted}>{topBorder}</text>
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {centerLine('SAVANT')}
      </text>
      <text fg={theme.muted}>
        {centerLine('One Mind. A Thousand Faces.')}
      </text>
      <text fg={theme.muted}>{midBorder}</text>

      {/* ECHO Phase Section — inlined phase indicator as <span> children.
          (PhaseIndicator returns <text>, which can't nest inside <text> in OpenTUI.) */}
      {devMode && (
        <text attributes={TextAttributes.BOLD} fg="#ff4444">
          {centerLine('[DEV MODE]')}
        </text>
      )}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('ECHO Protocol')}
      </text>
      <text>
        <span fg={theme.muted}>{'│ phase  '}</span>
        <span fg={pi.fg}>{phaseStr}</span>
        <span fg={theme.muted}>{`${phasePad} │`}</span>
      </text>
      {/* Work row spacing MUST use 2 trailing spaces (matching phase row)
          — actContent is `work  ${activityStr}` (2 spaces). 3 trailing spaces
          here makes the line 41 chars wide vs the 40-cell sidebar → wrap
          artifact appears as a stray blank line below. */}
      <text>
        <span fg={theme.muted}>{'│ work  '}</span>
        <span fg={ai.fg}>{activityStr}</span>
        <span fg={theme.muted}>{`${actPad} │`}</span>
      </text>
      <text fg={theme.muted}>{midBorder}</text>

      {/* Session Section */}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('Session')}
      </text>
      <text fg={theme.muted}>{row('tokens', `${formatTokens(tokensUsed)}/${formatTokens(tokensMax)}`)}</text>
      <text fg={theme.muted}>{row('cost', formatCost(cost))}</text>
      <text fg={theme.muted}>{row('model', truncate(displayModel, inner - LABEL_W))}</text>
      <text fg={theme.muted}>{row('mode', `[${mode}]`)}</text>
      <text fg={theme.muted}>{row('agent', truncate(agent === 'main-agent' ? 'Savant' : agent, inner - LABEL_W))}</text>
      <text fg={theme.muted}>{midBorder}</text>

      {/* Tools Section */}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('Tools')}
      </text>
      {toolsUsed.map((tool, i) => (
        <text key={`used-${i}`} fg={theme.foreground}>
          {line(`● ${tool}`)}
        </text>
      ))}
      {toolsAvailable
        .filter((t) => !toolsUsed.includes(t))
        .slice(0, 5)
        .map((tool, i) => (
          <text key={`avail-${i}`} fg={theme.muted}>
            {line(`○ ${tool}`)}
          </text>
        ))}
      <text fg={theme.muted}>{midBorder}</text>

      {/* Files Section */}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('Files Changed')}
      </text>
      <text fg={theme.muted}>{line(`  ${filesChanged.modified} modified`)}</text>
      <text fg={theme.muted}>{line(`  ${filesChanged.added} added`)}</text>
      <text fg={theme.muted}>{line(`  ${filesChanged.deleted} deleted`)}</text>
      <text fg={theme.muted}>{midBorder}</text>

      {/* Agent Stack Section */}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('Agent Stack')}
      </text>
      <AgentStack
        agents={agentStack.map((a) => ({
          name: a.id,
          active: a.isActive,
        }))}
      />
      <text fg={theme.muted}>{midBorder}</text>

      {/* History Section */}
      <text attributes={TextAttributes.BOLD} fg={theme.primary}>
        {line('History')}
      </text>
      {toolHistory.length > 0 ? (
        <Timeline
          events={toolHistory.slice(-5).map((call) => {
            const date = new Date(call.timestamp)
            const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
            return { time, label: call.name }
          })}
          maxItems={5}
        />
      ) : (
        <text fg={theme.muted}>{line('(empty)')}</text>
      )}
      <text fg={theme.muted}>{botBorder}</text>

      {/* Version */}
      <text
        style={{
          fg: theme.muted,
          justifyContent: 'flex-end',
          marginTop: 'auto',
        }}
      >
        {' '.repeat(W - 12) + 'v' + getVersion()}
      </text>
    </box>
  )
})
