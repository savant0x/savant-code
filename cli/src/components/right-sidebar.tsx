import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React from 'react'

import { SidebarFoldButton } from './right-sidebar-control'
import { sidebarDensity } from './right-sidebar-display'
import {
  createSidebarFocusController,
  isSidebarFocusCycleKey,
  SidebarFocusContext,
} from './right-sidebar-focus'
import { formatCompactionStatus, formatCost } from './right-sidebar-format'
import { SidebarHeader } from './right-sidebar-header'
import {
  SidebarActiveAgents,
  SidebarActiveFids,
  SidebarFilesChanged,
  SidebarHistoryTimeline,
  SidebarSession,
  SidebarToolsList,
} from './right-sidebar-sections'
import { SidebarContextSummary } from './right-sidebar-summary'
import { SidebarSupporting } from './right-sidebar-supporting'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'
import { Branding } from './savant-ui/branding'
import {
  createChatScrollbarOptions,
  createSidebarSurfaceStyle,
} from '../chat/styles'
import { useFids } from '../hooks/use-fids'
import { useChatStore } from '../state/chat-store'
import { glyph } from '../utils/glyphs'
import { getVersion } from '../utils/version'
import { AgentStatus } from './savant-ui/echo/agent-status'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

import type { SidebarFocusController } from './right-sidebar-focus'
import type { AgentInfo, FilesChanged, ToolCall } from './right-sidebar-format'
import type { StatusIndicatorState } from '../utils/status-indicator-state'
import type {
  BoxRenderable,
  KeyEvent,
  ScrollBoxRenderable,
} from '@opentui/core'

export interface RightSidebarProps {
  tokensUsed: number
  tokensMax: number
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
  lifecycle?: StatusIndicatorState
  focusController?: SidebarFocusController
  onCollapse?: () => void
  /** Existing loader injection for native fixtures and embedded consumers. */
  fidsDir?: string
  /** Responsive peek can yield columns to the chat; full mode remains 40. */
  width?: number
}

/**
 * Split a fully-qualified model slug into its provider prefix and the model
 * remainder at the first `/`. A slug with no `/` carries no provider prefix —
 * the whole string is the model (Law 14: every input shape resolves).
 */
function splitModelSlug(model: string): { provider?: string; model: string } {
  const slash = model.indexOf('/')
  if (slash <= 0) return { model }
  return { provider: model.slice(0, slash), model: model.slice(slash + 1) }
}

/** A bounded operational summary above a stable, scrollable detail tree. */
export const RightSidebar = React.memo(function RightSidebar(
  props: RightSidebarProps,
) {
  const theme = useTheme()
  const width = props.width ?? 40
  const localController = React.useMemo(
    () => createSidebarFocusController(),
    [],
  )
  const controller = props.focusController ?? localController
  const surfaceRef = React.useRef<BoxRenderable | null>(null)
  const scrollRef = React.useRef<ScrollBoxRenderable | null>(null)
  const [allocatedHeight, setAllocatedHeight] = React.useState(0)
  const density = sidebarDensity(allocatedHeight)
  React.useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return undefined
    const measure = () => setAllocatedHeight(surface.height)
    measure()
    let measurementTimer = setTimeout(measure, 16)
    const onResize = () => {
      measure()
      clearTimeout(measurementTimer)
      measurementTimer = setTimeout(measure, 16)
    }
    surface.on('resize', onResize)
    return () => {
      surface.off('resize', onResize)
      clearTimeout(measurementTimer)
    }
  }, [])
  React.useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return undefined
    scroll.scrollTop = controller.scrollTop
    return () => {
      controller.scrollTop = scroll.scrollTop
    }
  }, [controller, allocatedHeight > 1])
  useKeyboard(
    React.useCallback(
      (key: KeyEvent) => {
        if (!isSidebarFocusCycleKey(key)) return
        key.preventDefault?.()
        key.stopPropagation?.()
        controller.focusNext()
      },
      [controller],
    ),
  )

  const modelSlug = splitModelSlug(props.model)
  const devMode = useChatStore((s) => s.devMode)
  const activityKind = useChatStore((s) => s.activity.kind)
  const compaction = useChatStore((s) => s.compactionStatus)
  const compactionCount = useChatStore((s) => s.compactionCount)
  const cacheUsage = useChatStore(
    (s) => s.runState?.sessionState?.mainAgentState?.cacheUsage,
  )
  const { fids, archivedCount, isLoading } = useFids(props.fidsDir)

  return (
    <SidebarFocusContext.Provider value={controller}>
      <box
        ref={surfaceRef}
        style={{
          ...createSidebarSurfaceStyle(theme.surface),
          width,
          flexGrow: 0,
          paddingLeft: 1,
          paddingRight: 1,
          position: 'relative',
        }}
        border={['left']}
        borderColor={theme.border}
        focusable={false}
        selectable={false}
      >
        {props.onCollapse && (
          <box position="absolute" left={-3} top={0} zIndex={10}>
            <SidebarFoldButton
              id="sidebar-fold"
              label={glyph('navForward') === '>' ? '>' : '»'}
              onActivate={props.onCollapse}
            />
          </box>
        )}
        <box
          flexDirection="column"
          flexShrink={0}
          gap={density === 'spacious' ? 1 : 0}
          maxHeight={density === 'spacious' ? 9 : density === 'compact' ? 3 : 1}
          overflow="hidden"
        >
          {density === 'spacious' &&
            (width === 40 ? (
              <SidebarHeader />
            ) : (
              <Branding text="S" font="tiny" />
            ))}
          {density === 'compact' && (
            <box alignItems="center">
              <Branding text="S" font="tiny" />
            </box>
          )}
        </box>
        {allocatedHeight > 1 && (
          <scrollbox
            ref={scrollRef}
            id="sidebar-details"
            scrollX={false}
            scrollbarOptions={{ visible: false }}
            verticalScrollbarOptions={createChatScrollbarOptions(theme)}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              contentOptions: {
                flexDirection: 'column',
                flexShrink: 0,
                gap: density === 'minimal' ? 0 : 1,
              },
            }}
            focusable={false}
            selectable={false}
          >
            {density === 'minimal' &&
              (width === 40 ? (
                <SidebarHeader />
              ) : (
                <Branding text="S" font="tiny" />
              ))}
            {devMode && (
              <text fg={theme.error} attributes={TextAttributes.BOLD}>
                [DEV MODE]
              </text>
            )}
            {/* FID-2026-1009-007: the single home for live status. The
                fixed area above no longer repeats the activity/phase/
                model/mode facts (the duplication the operator reported);
                the section is default-expanded so the status is visible
                without a click, and the phase line carries the phase's
                own color (AgentStatus). */}
            <SidebarSection title="Activity detail" id="Status" defaultExpanded>
              <AgentStatus lifecycle={props.lifecycle} detailOnly />
              {modelSlug.provider && (
                <KeyValueRow label="Provider" value={modelSlug.provider} />
              )}
              <KeyValueRow label="Model" value={modelSlug.model} />
              <KeyValueRow
                label="Mode"
                value={`${props.mode} · ${formatCost(props.cost)}`}
              />
            </SidebarSection>
            <SidebarActiveAgents
              agentStack={props.agentStack}
              agent={props.agent}
              isStreaming={props.isStreaming}
              isWaitingForResponse={props.isWaitingForResponse}
              isThinking={activityKind === 'thinking'}
            />
            <SidebarSession
              {...props}
              summaryVisible
              compactionStatus={
                compaction ? formatCompactionStatus(compaction) : null
              }
              compactionCount={compactionCount}
              cacheUsage={cacheUsage}
            />
            <SidebarSupporting
              fsmPhase={props.fsmPhase}
              fidsDir={props.fidsDir}
            />
            <SidebarToolsList
              toolsUsed={props.toolsUsed}
              toolsAvailable={props.toolsAvailable}
            />
            <SidebarFilesChanged filesChanged={props.filesChanged} />
            <SidebarActiveFids
              fids={fids}
              archivedCount={archivedCount}
              isLoading={isLoading}
            />
            <SidebarHistoryTimeline toolHistory={props.toolHistory} />
            {density !== 'spacious' && (
              <SidebarContextSummary {...props} showVersion />
            )}
          </scrollbox>
        )}
        {density === 'spacious' && (
          <box flexDirection="column" flexShrink={0}>
            <box alignItems="center" flexShrink={0}>
              <text
                id="sidebar-version"
                fg={theme.muted}
                selectable={false}
              >{`v${getVersion()}`}</text>
            </box>
            <box
              flexDirection="column"
              flexShrink={0}
              border={['top']}
              borderColor={theme.border}
            >
              <SidebarContextSummary {...props} />
            </box>
          </box>
        )}
      </box>
    </SidebarFocusContext.Provider>
  )
})
