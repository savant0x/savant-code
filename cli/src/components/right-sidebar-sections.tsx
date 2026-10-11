import React from 'react'

import {
  formatCacheUsage,
  formatToolHistoryEvent,
  toolDisplayName,
  resolveActiveAgentDisplay,
} from './right-sidebar-format'
import { SidebarSessionSummary } from './right-sidebar-summary'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'
import { AgentStack } from './savant-ui'
import { glyph } from '../utils/glyphs'
import { Timeline } from './savant-ui/data-display/timeline'
import { FidList } from './savant-ui/echo/fid-list'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

import type {
  AgentInfo,
  ToolCall,
  formatCompactionStatus,
} from './right-sidebar-format'
import type { SidebarSummaryProps } from './right-sidebar-summary'
import type { FidData } from './savant-ui/echo/fid-list'
import type { CacheUsageSummary } from '@savant-code/common/types/session-state-cache-usage'

export function SidebarActiveAgents({
  agentStack,
  agent,
  isStreaming,
  isWaitingForResponse,
  isThinking = false,
}: {
  agentStack: AgentInfo[]
  agent: string
  isStreaming: boolean
  isWaitingForResponse: boolean
  isThinking?: boolean
}) {
  const agents = resolveActiveAgentDisplay(
    agentStack,
    agent,
    isStreaming,
    isWaitingForResponse,
    isThinking,
  )
  if (!agents.length) return null
  return (
    <SidebarSection title="Active Agents" count={agents.length} defaultExpanded>
      <AgentStack agents={agents} />
    </SidebarSection>
  )
}

export function SidebarToolsList({
  toolsUsed,
  toolsAvailable,
}: {
  toolsUsed: string[]
  toolsAvailable: string[]
}) {
  const theme = useTheme()
  const used = [...new Set(toolsUsed)].sort((a, b) => a.localeCompare(b))
  const available = [...new Set(toolsAvailable)]
    .filter((t) => !used.includes(t))
    .sort()
    .slice(0, Math.max(0, 5 - used.length))
  return (
    <SidebarSection title="Tools" count={used.length}>
      {used.map((tool) => (
        <text
          key={tool}
          fg={theme.foreground}
          wrapMode="word"
          selectable={false}
        >{`${glyph('statusActive')} ${toolDisplayName(tool)}`}</text>
      ))}
      {available.map((tool) => (
        <text
          key={tool}
          fg={theme.muted}
          wrapMode="word"
          selectable={false}
        >{`${glyph('statusInactive')} ${toolDisplayName(tool)}`}</text>
      ))}
    </SidebarSection>
  )
}

export function SidebarActiveFids({
  fids,
  archivedCount,
  isLoading = false,
}: {
  fids: FidData[]
  archivedCount: number
  isLoading?: boolean
}) {
  const theme = useTheme()
  const attention = fids.filter(
    (fid) => fid.severity === 'critical' || fid.severity === 'high',
  ).length
  return (
    <SidebarSection
      title="Active FIDs"
      id="FIDs"
      count={
        isLoading
          ? 'Loading'
          : attention
            ? `${fids.length} · ${attention}!`
            : fids.length
      }
      attention={attention > 0}
    >
      {isLoading ? (
        <text fg={theme.muted}>Loading FIDs…</text>
      ) : fids.length ? (
        <FidList fids={fids} sortBy="severity" />
      ) : (
        <text fg={theme.muted} selectable={false}>
          (none active)
        </text>
      )}
      {archivedCount > 0 && (
        <text
          fg={theme.muted}
          selectable={false}
        >{`${archivedCount} archived`}</text>
      )}
    </SidebarSection>
  )
}

export function SidebarHistoryTimeline({
  toolHistory,
}: {
  toolHistory: ToolCall[]
}) {
  const theme = useTheme()
  return (
    <SidebarSection title="History" count={toolHistory.length}>
      {toolHistory.length ? (
        <Timeline events={toolHistory.map(formatToolHistoryEvent)} />
      ) : (
        <text fg={theme.muted} selectable={false}>
          (empty)
        </text>
      )}
    </SidebarSection>
  )
}

export function SidebarSession({
  agent,
  compactionStatus,
  compactionCount,
  cacheUsage,
  summaryVisible = false,
  ...summary
}: SidebarSummaryProps & {
  agent: string
  compactionStatus: ReturnType<typeof formatCompactionStatus> | null
  compactionCount: number
  cacheUsage?: CacheUsageSummary
  summaryVisible?: boolean
}) {
  const theme = useTheme()
  return (
    <SidebarSection
      title="Session"
      defaultExpanded
      attention={compactionStatus?.warning}
    >
      {!summaryVisible && <SidebarSessionSummary {...summary} />}
      {agent !== 'main-agent' && agent !== 'Savant' && (
        <KeyValueRow label="Agent" value={agent} />
      )}
      {compactionStatus && (
        <KeyValueRow
          label="Compaction"
          value={compactionStatus.label}
          valueColor={
            compactionStatus.warning
              ? theme.warning
              : compactionStatus.band === 'red'
                ? theme.error
                : compactionStatus.band === 'orange' ||
                    compactionStatus.band === 'yellow'
                  ? theme.warning
                  : undefined
          }
        />
      )}
      {compactionCount > 0 && (
        <KeyValueRow label="Compactions" value={compactionCount.toString()} />
      )}
      <KeyValueRow label="Cache" value={formatCacheUsage(cacheUsage)} />
    </SidebarSection>
  )
}

export function SidebarFilesChanged({
  filesChanged,
}: {
  filesChanged: { created: number; modified: number }
}) {
  return (
    <SidebarSection
      title="Files Changed"
      id="Files"
      count={`+${filesChanged.created} / ~${filesChanged.modified}`}
      defaultExpanded
    >
      <KeyValueRow label="Created" value={filesChanged.created.toString()} />
      <KeyValueRow label="Modified" value={filesChanged.modified.toString()} />
    </SidebarSection>
  )
}
