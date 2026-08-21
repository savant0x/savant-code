import React from 'react'

import {
  formatCost,
  formatToolHistoryEvent,
  formatTokens,
  MAX_VISIBLE_FIDS,
  resolveActiveAgentDisplay,
  type AgentInfo,
  type ToolCall,
  type formatCompactionStatus,
} from './right-sidebar-format'
import { AgentStack } from './savant-ui'
import { useTheme } from '../hooks/use-theme'
import { Timeline } from './savant-ui/data-display/timeline'
import { FidList, type FidData } from './savant-ui/echo/fid-list'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

/** Active Agents section — only active agents, or the main agent while
 *  streaming/waiting; hidden when there is nothing to show. */
export const SidebarActiveAgents = ({
  agentStack,
  agent,
  isStreaming,
  isWaitingForResponse,
}: {
  agentStack: AgentInfo[]
  agent: string
  isStreaming: boolean
  isWaitingForResponse: boolean
}) => {
  const displayAgents = resolveActiveAgentDisplay(
    agentStack,
    agent,
    isStreaming,
    isWaitingForResponse,
  )
  if (displayAgents.length === 0) return null
  return (
    <SidebarSection title="Active Agents" defaultExpanded>
      <AgentStack agents={displayAgents} />
    </SidebarSection>
  )
}

/** Tools section — used (●) then available (○), alphabetized, capped at 5. */
export const SidebarToolsList = ({
  toolsUsed,
  toolsAvailable,
}: {
  toolsUsed: string[]
  toolsAvailable: string[]
}) => {
  const theme = useTheme()
  return (
    <SidebarSection title="Tools">
      {[...toolsUsed]
        .sort((a, b) => a.localeCompare(b))
        .map((tool, i) => (
          <text
            key={`used-${i}`}
            fg={theme.foreground}
            wrapMode="none"
            selectable={false}
          >
            {`● ${tool}`}
          </text>
        ))}
      {toolsAvailable
        .filter((t) => !toolsUsed.includes(t))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, Math.max(0, 5 - toolsUsed.length))
        .map((tool, i) => (
          <text
            key={`avail-${i}`}
            fg={theme.muted}
            wrapMode="none"
            selectable={false}
          >
            {`○ ${tool}`}
          </text>
        ))}
    </SidebarSection>
  )
}

/** Active FIDs section — live from dev/fids/ via the harness watcher. */
export const SidebarActiveFids = ({
  fids,
  archivedCount,
}: {
  fids: FidData[]
  archivedCount: number
}) => {
  const theme = useTheme()
  return (
    <SidebarSection title="Active FIDs">
      {fids.length > 0 ? (
        <box
          flexDirection="column"
          gap={1}
          focusable={false}
          selectable={false}
        >
          <FidList fids={fids.slice(0, MAX_VISIBLE_FIDS)} sortBy="severity" />
          {fids.length > MAX_VISIBLE_FIDS && (
            <text fg={theme.muted} wrapMode="none" selectable={false}>
              {`+${fids.length - MAX_VISIBLE_FIDS} more active`}
            </text>
          )}
        </box>
      ) : (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {archivedCount > 0
            ? '(none active — all closed)'
            : '(none — loop converged)'}
        </text>
      )}
      {archivedCount > 0 && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`${archivedCount} archived (closed)`}
        </text>
      )}
    </SidebarSection>
  )
}

/** History section — the last 5 tool calls as a Timeline. */
export const SidebarHistoryTimeline = ({
  toolHistory,
}: {
  toolHistory: ToolCall[]
}) => {
  const theme = useTheme()
  return (
    <SidebarSection title="History">
      {toolHistory.length > 0 ? (
        <Timeline
          events={toolHistory.slice(-5).map(formatToolHistoryEvent)}
          maxItems={5}
        />
      ) : (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          (empty)
        </text>
      )}
    </SidebarSection>
  )
}

/** Session section — agent/cost/mode/model/context/compaction rows. */
export const SidebarSession = ({
  agent,
  cost,
  mode,
  model,
  tokensUsed,
  tokensMax,
  compactionStatus,
  compactionCount,
}: {
  agent: string
  cost: number
  mode: string
  model: string
  tokensUsed: number
  tokensMax: number
  compactionStatus: ReturnType<typeof formatCompactionStatus> | null
  compactionCount: number
}) => {
  const theme = useTheme()
  const compactionLabel = compactionStatus
  return (
    <SidebarSection title="Session" defaultExpanded>
      {agent !== 'main-agent' && agent !== 'Savant' && (
        <KeyValueRow label="Agent" value={agent} />
      )}
      <KeyValueRow label="Cost" value={formatCost(cost)} />
      <KeyValueRow label="Mode" value={mode} />
      <KeyValueRow label="Model" value={model} />
      {/* P4d (FID-2026-0806-003): live context-usage meter with color
          thresholds (Gemini CLI pattern) — warning at >=70%, error at
          >=100%. tokensMax of 0 means the window is unknown; fall back to
          the plain readout. */}
      {tokensMax > 0 ? (
        <KeyValueRow
          label="Context"
          value={`${formatTokens(tokensUsed)}/${formatTokens(tokensMax)}`}
          valueColor={
            tokensUsed >= tokensMax
              ? theme.error
              : tokensUsed / tokensMax >= 0.7
                ? theme.warning
                : undefined
          }
        />
      ) : (
        <KeyValueRow label="Tokens" value={`${formatTokens(tokensUsed)}`} />
      )}
      {compactionLabel !== null && (
        <KeyValueRow
          label="Compaction"
          value={compactionLabel.label}
          valueColor={
            compactionLabel.warning
              ? theme.warning
              : compactionLabel.band === 'red'
                ? theme.error
                : compactionLabel.band === 'orange'
                  ? theme.warning
                  : compactionLabel.band === 'yellow'
                    ? theme.warning
                    : undefined
          }
        />
      )}
      {/* FID-2026-0814-006: session compaction counter (OpenClaw pattern).
          Per-session aggregate, reset alongside the other sidebar data. */}
      {compactionCount > 0 && (
        <KeyValueRow label="Compactions" value={compactionCount.toString()} />
      )}
    </SidebarSection>
  )
}

/** Files Changed section — the SDK emits only created/modified events. */
export const SidebarFilesChanged = ({
  filesChanged,
}: {
  filesChanged: { created: number; modified: number }
}) => (
  <SidebarSection title="Files Changed" defaultExpanded>
    <KeyValueRow label="Created" value={filesChanged.created.toString()} />
    <KeyValueRow label="Modified" value={filesChanged.modified.toString()} />
  </SidebarSection>
)
