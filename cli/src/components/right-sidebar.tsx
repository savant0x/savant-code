import { TextAttributes } from '@opentui/core'
import React from 'react'

import { AgentStack, LearnOverlay } from './savant-ui'
import { createSidebarSurfaceStyle } from '../chat/styles'
import { useFids } from '../hooks/use-fids'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { EasterEggLogo } from './savant-ui/easter-egg-logo'
import { getVersion } from '../utils/version'
import { Timeline } from './savant-ui/data-display/timeline'
import { AgentStatus } from './savant-ui/echo/agent-status'
import { DriveStatusPanel } from './savant-ui/echo/drive-status-panel'
import { FidList } from './savant-ui/echo/fid-list'
import { LoopStatusPanel } from './savant-ui/echo/loop-status-panel'
import { PerfectionLoop } from './savant-ui/echo/perfection-loop'
import {
  reduceTrustMatrixEvents,
  summarizeTrustRows,
  TrustMatrix,
} from './savant-ui/echo/trust-matrix'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

import type { CompactionStatus } from '@savant-code/common/types/session-state'

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
  created: number
  added: number
  deleted: number
}

export interface RightSidebarProps {
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
  /** Manual fold (FID-2026-0816-010 follow-up): when provided, renders a `»`
   *  collapse button on the sidebar's LEFT edge (overlapping the fold line),
   *  matching the folded rail's `«` button. Omitted when rendered inside the
   *  SidebarRail's hover-expanded state so the two collapse affordances don't
   *  stack. */
  onCollapse?: () => void
}

/** Max active FIDs rendered before a "+N more active" overflow line. */
const MAX_VISIBLE_FIDS = 4

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

/** FID-2026-0813-023: compact the runtime compaction status into a display
 *  label. Read-only; the runtime is the source of truth. */
function formatCompactionStatus(status: CompactionStatus): {
  label: string
  warning: boolean
  /** FID-2026-0814-006: OpenClaw-style color band for the percent (of the
   *  resolved window): green <60, yellow 60-80, orange 80-95, red ≥95. */
  band?: 'green' | 'yellow' | 'orange' | 'red'
} {
  // FID-2026-0814-001: window-relative label (percentUsed denominator is
  // maxContextLength) and distinct micro vs full-pruner outcomes so the row
  // states exactly what happened: idle · ✓ micro −N · compacting… · ✓ pruned
  // −N · ⚠ N% of window.
  const bandOf = (
    percent: number | undefined,
  ): 'green' | 'yellow' | 'orange' | 'red' => {
    const p = percent ?? 0
    if (p >= 95) return 'red'
    if (p >= 80) return 'orange'
    if (p >= 60) return 'yellow'
    return 'green'
  }
  switch (status.phase) {
    case 'warning':
      return {
        label: `⚠ ${status.percentUsed ?? '?'}% of window`,
        warning: true,
        band: bandOf(status.percentUsed),
      }
    case 'compacted':
      return {
        label: `✓ micro −${formatTokens(status.tokensSaved ?? 0)} tokens`,
        warning: false,
        band: bandOf(status.percentUsed),
      }
    case 'pruned':
      return {
        label: `✓ pruned −${formatTokens(status.tokensSaved ?? 0)} tokens`,
        warning: false,
        band: bandOf(status.percentUsed),
      }
    case 'compacting':
      return { label: 'compacting…', warning: false }
    default:
      return { label: 'idle', warning: false }
  }
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
  onCollapse,
}: RightSidebarProps) {
  const theme = useTheme()
  const [collapseHovered, setCollapseHovered] = React.useState(false)

  const devMode = useChatStore((s) => s.devMode)
  const provenanceEvents = useChatStore((s) => s.provenanceEvents)
  const teacherState = useChatStore((s) => s.teacherState)
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const compactionCount = useChatStore((s) => s.compactionCount)

  // Reactive trust surface (operator feedback 2026-08-16, two rounds): the
  // section mounts only while at least one receipt is still `pending` (signed,
  // no verdict yet) — it unmounts entirely once everything resolves, so it
  // never persists after completion — and it is collapsed by default. Round 2
  // removed the title status dot: an icon left of the title read as clutter,
  // and with mount-on-pending the section's presence IS the signal.
  const trustState = React.useMemo(
    () => reduceTrustMatrixEvents(provenanceEvents),
    [provenanceEvents],
  )
  const trustSummary = React.useMemo(
    () => summarizeTrustRows(trustState.rows),
    [trustState.rows],
  )

  // FID-2026-0720-033c Phase C: live FID data from dev/fids/ — wires the
  // useFids hook (production consumer of loadFids) into the sidebar. The
  // harness watcher keeps it live; archived FIDs are surfaced so a converged
  // project's FID history stays visible.
  const { fids: activeFids, archived: archivedFids } = useFids()

  // Pass full FID summaries so the card can display the complete description.
  const fids = activeFids
  const archivedCount = archivedFids.length
  const compactionLabel =
    compactionStatus !== null ? formatCompactionStatus(compactionStatus) : null

  return (
    <box
      style={{
        ...createSidebarSurfaceStyle(theme.background),
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
        gap: 1,
        // Positioning context for the fold button: the sidebar's left edge is
        // the chat/sidebar fold line (FID-2026-0816-010 follow-up round 2).
        position: 'relative',
      }}
      focusable={false}
      selectable={false}
    >
      {/* Manual fold handle (FID-2026-0816-010 follow-up): `»` collapses the
          sidebar to the icon rail at any width. Matches the folded rail's `«`
          button (operator feedback 2026-08-16): a raised, bordered button
          sitting on the sidebar's LEFT edge, overlapping the fold line into
          the chat column. Absolutely positioned at left: -2 so it straddles
          the edge despite the sidebar's own paddingLeft (the rail needs no
          such trick — it has no horizontal padding). Only rendered when
          ChatSidebar passes onCollapse (i.e. the standalone full sidebar, not
          the rail's hover-expanded copy). */}
      {onCollapse && (
        <box
          style={{ position: 'absolute', left: -3, top: 0, zIndex: 10 }}
          borderStyle="rounded"
          borderColor={collapseHovered ? theme.primary : theme.border}
          backgroundColor={theme.surface}
          paddingLeft={1}
          paddingRight={1}
          onMouseOver={() => setCollapseHovered(true)}
          onMouseOut={() => setCollapseHovered(false)}
          onMouseDown={onCollapse}
          focusable={false}
          selectable={false}
        >
          <text
            fg={collapseHovered ? theme.primary : theme.muted}
            attributes={TextAttributes.BOLD}
            selectable={false}
          >
            {'»'}
          </text>
        </box>
      )}
      {/* Header */}
      <box
        flexDirection="column"
        alignItems="center"
        gap={1}
        paddingBottom={1}
        focusable={false}
        selectable={false}
      >
        <box
          flexDirection="column"
          alignItems="center"
          flexShrink={1}
          width="100%"
          selectable={false}
        >
          <EasterEggLogo />
        </box>
        <box
          flexDirection="column"
          alignItems="center"
          flexShrink={1}
          width="100%"
          selectable={false}
        >
          <text fg={theme.muted} selectable={false}>
            One Mind. A Thousand Faces.
          </text>
        </box>
      </box>

      {devMode && (
        <text
          attributes={TextAttributes.BOLD}
          fg={theme.error}
          selectable={false}
        >
          [DEV MODE]
        </text>
      )}

      {/* Active Agents — only show agents that are currently active. Inactive
          agents are hidden so the sidebar stays clean during long sessions
          with many spawned subagents. */}
      {(() => {
        const activeAgents = agentStack.filter((a) => a.isActive)
        const displayAgents =
          activeAgents.length > 0
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

      {/* Session — the bound-agent identity is surfaced by the Active Agents
          stack (with its streaming fallback) for the default main agent, so
          only a session explicitly bound to a different agent needs its own
          row here. */}
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

      {/* FID-2026-0813-022: read-only live teacher surface. Sourced from the
          passive store mirror of the runtime singleton; the component has no
          tool or write authority. */}
      {teacherState !== null && teacherState.challenge !== null && (
        <SidebarSection title="Teacher">
          <LearnOverlay
            challenge={teacherState.challenge}
            events={teacherState.events}
            receipt={teacherState.receipt}
            persisted={teacherState.persisted}
            competencyState={teacherState.competencyState}
            phase={teacherState.phase}
            completionState={teacherState.completionState}
          />
        </SidebarSection>
      )}

      {/* Perfection Loop — only show when the FSM is in an active phase
          (not idle). When idle, the loop section is hidden to reduce
          visual clutter. */}
      {fsmPhase !== 'idle' && <PerfectionLoop />}

      {/* FID-2026-0813-009: read-only live governance surface. The SDK event
          handler stores every provenance_receipt event; the TrustMatrix
          reducer drops unsigned/unmatched ones, and the component has no tool
          or write authority. Mounts only while a receipt is still `pending`
          (operator feedback 2026-08-16 round 2: it must not persist after
          completion) and collapses by default so it stays subtle. */}
      {trustSummary.hasPending && (
        <SidebarSection title="Trust Matrix">
          <TrustMatrix events={provenanceEvents} />
        </SidebarSection>
      )}

      {/* Loop Status — shows active loop cadence, goal condition, and iteration count */}
      <LoopStatusPanel />

      {/* FID-2026-0818-007: live Auto Drive surface (read-only mirror). */}
      <DriveStatusPanel />

      {/* Tools */}
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

      {/* Files Changed — the SDK emits only `created` and `modified` write
          events (change-file.ts:32); Added/Deleted were dead counters. */}
      <SidebarSection title="Files Changed" defaultExpanded>
        <KeyValueRow label="Created" value={filesChanged.created.toString()} />
        <KeyValueRow
          label="Modified"
          value={filesChanged.modified.toString()}
        />
      </SidebarSection>

      {/* Active FIDs — live from dev/fids/ via the harness watcher; the
          archived count keeps a converged project's FID history visible. */}
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
