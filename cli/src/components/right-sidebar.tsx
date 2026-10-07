import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React from 'react'

import {
  createSidebarFocusController,
  isSidebarFocusCycleKey,
  SidebarFocusContext,
} from './right-sidebar-focus'
import { formatCompactionStatus } from './right-sidebar-format'
import { SidebarHeader } from './right-sidebar-header'
import {
  SidebarActiveAgents,
  SidebarActiveFids,
  SidebarFilesChanged,
  SidebarHistoryTimeline,
  SidebarSession,
  SidebarToolsList,
} from './right-sidebar-sections'
import { LearnOverlay } from './savant-ui'
import {
  createChatScrollbarOptions,
  createSidebarSurfaceStyle,
} from '../chat/styles'
import { useFids } from '../hooks/use-fids'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { getVersion } from '../utils/version'
import { AgentStatus } from './savant-ui/echo/agent-status'
import { DriveStatusPanel } from './savant-ui/echo/drive-status-panel'
import { LoopStatusPanel } from './savant-ui/echo/loop-status-panel'
import { PerfectionLoop } from './savant-ui/echo/perfection-loop'
import {
  reduceTrustMatrixEvents,
  summarizeTrustRows,
  TrustMatrix,
} from './savant-ui/echo/trust-matrix'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

import type { AgentInfo, FilesChanged, ToolCall } from './right-sidebar-format'
import type { KeyEvent } from '@opentui/core'

export interface RightSidebarProps {
  tokensUsed: number
  tokensMax: number
  /** FID-2026-0914-002 (MQ4): how the window value was resolved. */
  windowSource: 'catalog' | 'fallback-table' | 'default'
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
   *  collapse button on the sidebar's LEFT edge; omitted inside the rail's
   *  hover-expanded state so the two collapse affordances don't stack. */
  onCollapse?: () => void
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
  windowSource,
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

  // FID-2026-1005-002: the sidebar's keyboard focus cycle. Ctrl+G (input
  // unfocused or empty — the same guard as the Ctrl+B fold) moves focus
  // through the section headers and FID-card rows; each control activates
  // on Enter/Space (see right-sidebar-focus.ts). The controller reaches the
  // controls via the context provider below.
  const focusController = React.useMemo(
    () => createSidebarFocusController(),
    [],
  )
  useKeyboard(
    React.useCallback(
      (key: KeyEvent) => {
        if (!isSidebarFocusCycleKey(key)) return
        const { inputFocused, inputValue } = useChatStore.getState()
        if (inputFocused && inputValue.length > 0) return
        key.preventDefault?.()
        key.stopPropagation?.()
        focusController.focusNext()
      },
      [focusController],
    ),
  )

  const devMode = useChatStore((s) => s.devMode)
  const provenanceEvents = useChatStore((s) => s.provenanceEvents)
  const teacherState = useChatStore((s) => s.teacherState)
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const compactionCount = useChatStore((s) => s.compactionCount)
  // FID-2026-1007-009: the reported cache summary is read straight off the run
  // snapshot — the same transport `driveStatus` and `goal` use — rather than
  // mirrored into a second store slice, so there is exactly one copy.
  const cacheUsage = useChatStore(
    (s) => s.runState?.sessionState?.mainAgentState?.cacheUsage,
  )

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
  // FID-2026-1005-002: archivedCount comes from the directory-listing count
  // path (no archive parsing on refresh); the full `loadFidInventory`
  // contract stays available to callers that need archived metadata.
  const { fids: activeFids, archivedCount } = useFids()

  // Pass full FID summaries so the card can display the complete description.
  const fids = activeFids
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
      <SidebarFocusContext.Provider value={focusController}>
        <scrollbox
          scrollX={false}
          scrollbarOptions={{ visible: false }}
          verticalScrollbarOptions={createChatScrollbarOptions(theme)}
          style={{
            flexGrow: 1,
            contentOptions: {
              minHeight: '100%',
              flexDirection: 'column',
              flexShrink: 0,
              gap: 1,
            },
          }}
          focusable={false}
          selectable={false}
        >
          <SidebarHeader />
          {devMode && (
            <text
              attributes={TextAttributes.BOLD}
              fg={theme.error}
              selectable={false}
            >
              [DEV MODE]
            </text>
          )}
          <SidebarActiveAgents
            agentStack={agentStack}
            agent={agent}
            isStreaming={isStreaming}
            isWaitingForResponse={isWaitingForResponse}
          />
          <AgentStatus />
          <SidebarSession
            agent={agent}
            cost={cost}
            mode={mode}
            model={model}
            tokensUsed={tokensUsed}
            tokensMax={tokensMax}
            windowSource={windowSource}
            compactionStatus={compactionLabel}
            compactionCount={compactionCount}
            cacheUsage={cacheUsage}
          />
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
          {fsmPhase !== 'idle' && <PerfectionLoop />}
          {trustSummary.hasPending && (
            <SidebarSection title="Trust Matrix">
              <TrustMatrix events={provenanceEvents} />
            </SidebarSection>
          )}
          <LoopStatusPanel />
          <DriveStatusPanel />
          <SidebarToolsList
            toolsUsed={toolsUsed}
            toolsAvailable={toolsAvailable}
          />
          <SidebarFilesChanged filesChanged={filesChanged} />
          <SidebarActiveFids fids={fids} archivedCount={archivedCount} />
          <SidebarHistoryTimeline toolHistory={toolHistory} />
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
        </scrollbox>
      </SidebarFocusContext.Provider>
    </box>
  )
})
