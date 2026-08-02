import { TextAttributes } from '@opentui/core'
import React from 'react'

import { AgentStack } from './savant-ui'
import { Branding } from './savant-ui/branding'
import { useFids } from '../hooks/use-fids'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { loadSavantCodeModelPreference } from '../utils/settings'
import { getVersion } from '../utils/version'
import { Timeline } from './savant-ui/data-display/timeline'
import { AgentStatus } from './savant-ui/echo/agent-status'
import { FidList } from './savant-ui/echo/fid-list'
import { LoopStatusPanel } from './savant-ui/echo/loop-status-panel'
import { PerfectionLoop } from './savant-ui/echo/perfection-loop'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

interface ToolCall {
  name: string
  timestamp: number
}

interface AgentInfo {
  id: string
  displayName?: string
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
  cost: number
  model: string
  mode: string
  agent: string
  toolsUsed: string[]
  toolsAvailable: string[]
  filesChanged: FilesChanged
  agentStack: AgentInfo[]
  toolHistory: ToolCall[]
  isStreaming: boolean
  isWaitingForResponse: boolean
  fsmPhase: string
}

/**
 * Format a token count for display, e.g. 1200 -> "1.2k".
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Format a cost for display, e.g. 0.05 -> "$0.05".
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

/**
 * Right sidebar — ECHO Protocol status and session metadata surface.
 *
 * Implemented with native OpenTUI flexbox and borders. Each information block is
 * wrapped in a collapsible SidebarSection; key/value rows use the KeyValueRow
 * primitive. ASCII box-drawing and manual padding have been removed.
 */
export const RightSidebar = React.memo(function RightSidebar({
  tokensUsed,
  tokensMax,
  cost,
  model,
  mode,
  agent,
  toolsUsed,
  toolsAvailable,
  filesChanged,
  agentStack,
  toolHistory,
  isStreaming,
  isWaitingForResponse,
  fsmPhase,
}: RightSidebarProps) {
  const theme = useTheme()

  const devMode = useChatStore((s) => s.devMode)

  // FID-2026-0720-033c Phase C: live FID data from dev/fids/ — wires the
  // useFids hook (production consumer of loadFids) into the sidebar.
  const { fids: activeFids } = useFids()

  // Resolve the model label based on mode.
  const displayModel = IS_SAVANT_FREE
    ? useSavantFreeModelStore.getState().selectedModel
    : loadSavantCodeModelPreference() ?? model

  // Pass full FID summaries so the card can display the complete description.
  const fids = activeFids

  return (
    <box
      flexDirection="column"
      width={40}
      flexShrink={0}
      paddingTop={3}
      paddingBottom={1}
      paddingLeft={1}
      paddingRight={1}
      gap={1}
      focusable={false}
      selectable={false}
    >
      {/* Header */}
      <box
        flexDirection="column"
        alignItems="center"
        gap={1}
        paddingBottom={1}
        focusable={false}
        selectable={false}
      >
        <box flexDirection="column" alignItems="center" flexShrink={1} width="100%" selectable={false}>
          <Branding font="tiny" text="Savant" color="primary" />
        </box>
        <box flexDirection="column" alignItems="center" flexShrink={1} width="100%" selectable={false}>
          <text fg={theme.muted} selectable={false}>One Mind. A Thousand Faces.</text>
        </box>
      </box>

      {devMode && (
        <text attributes={TextAttributes.BOLD} fg={theme.error} selectable={false}>
          [DEV MODE]
        </text>
      )}

      {/* Active Agents — only show agents that are currently active. Inactive
          agents are hidden so the sidebar stays clean during long sessions
          with many spawned subagents. */}
      {(() => {
        const activeAgents = agentStack.filter((a) => a.isActive)
        const displayAgents = activeAgents.length > 0
          ? activeAgents
          : isStreaming || isWaitingForResponse
            ? [{ id: agent, isActive: true } as AgentInfo]
            : []
        if (displayAgents.length === 0) return null
        return (
          <SidebarSection title="Active Agents" defaultExpanded>
            <AgentStack
              agents={displayAgents.map((a) => ({
                name: a.displayName ?? a.id,
                active: true,
              }))}
            />
          </SidebarSection>
        )
      })()}

      <AgentStatus />

      {/* Session */}
      <SidebarSection title="Session" defaultExpanded>
        <KeyValueRow label="Agent" value={agent === 'main-agent' ? 'Savant' : agent} />
        <KeyValueRow label="Cost" value={formatCost(cost)} />
        <KeyValueRow label="Mode" value={mode} />
        <KeyValueRow label="Model" value={displayModel} />
        <KeyValueRow
          label="Tokens"
          value={`${formatTokens(tokensUsed)}/${formatTokens(tokensMax)}`}
        />
      </SidebarSection>

      {/* Perfection Loop — only show when the FSM is in an active phase
          (not idle). When idle, the loop section is hidden to reduce
          visual clutter. */}
      {fsmPhase !== 'idle' && <PerfectionLoop />}

      {/* Loop Status — shows active loop cadence, goal condition, and iteration count */}
      <LoopStatusPanel />

      {/* Tools */}
      <SidebarSection title="Tools">
        {[...toolsUsed]
          .sort((a, b) => a.localeCompare(b))
          .map((tool, i) => (
            <text key={`used-${i}`} fg={theme.foreground} wrapMode="none" selectable={false}>
              {`● ${tool}`}
            </text>
          ))}
        {toolsAvailable
          .filter((t) => !toolsUsed.includes(t))
          .sort((a, b) => a.localeCompare(b))
          .slice(0, Math.max(0, 5 - toolsUsed.length))
          .map((tool, i) => (
            <text key={`avail-${i}`} fg={theme.muted} wrapMode="none" selectable={false}>
              {`○ ${tool}`}
            </text>
          ))}
      </SidebarSection>

      {/* Files Changed */}
      <SidebarSection title="Files Changed" defaultExpanded>
        <KeyValueRow label="Added" value={filesChanged.added.toString()} />
        <KeyValueRow label="Deleted" value={filesChanged.deleted.toString()} />
        <KeyValueRow
          label="Modified"
          value={filesChanged.modified.toString()}
        />
      </SidebarSection>

      {/* Active FIDs */}
      <SidebarSection title="Active FIDs">
        {fids.length > 0 ? (
          <FidList fids={fids.slice(0, 3)} sortBy="severity" />
        ) : (
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            (none — loop converged)
          </text>
        )}
      </SidebarSection>

      {/* History */}
      <SidebarSection title="History">
        {toolHistory.length > 0 ? (
          <Timeline
            events={toolHistory.slice(-5).map((call) => {
              const date = new Date(call.timestamp)
              const hours = date.getHours().toString().padStart(2, '0')
              const minutes = date.getMinutes().toString().padStart(2, '0')
              return { time: `${hours}:${minutes}`, label: call.name }
            })}
            maxItems={5}
          />
        ) : (
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            (empty)
          </text>
        )}
      </SidebarSection>

      {/* Version — pushed to the bottom, centered */}
      <box
        marginTop="auto"
        width="100%"
        alignItems="center"
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`v${getVersion()}`}
        </text>
      </box>
    </box>
  )
})
