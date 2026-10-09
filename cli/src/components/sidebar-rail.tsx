import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import React from 'react'

import { RightSidebar } from './right-sidebar'
import { SidebarFoldButton } from './right-sidebar-control'
import { sidebarActivity } from './right-sidebar-display'
import {
  createSidebarFocusController,
  isSidebarFocusCycleKey,
  SidebarFocusContext,
} from './right-sidebar-focus'
import { RailControl } from './right-sidebar-rail-control'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'
import { Branding } from './savant-ui/branding'
import { SavantMark } from './savant-ui/savant-mark'
import { createChatScrollbarOptions } from '../chat/styles'
import { useFids } from '../hooks/use-fids'
import { useChatStore } from '../state/chat-store'
import { glyph } from '../utils/glyphs'
import { getVersion } from '../utils/version'

import type { RightSidebarProps } from './right-sidebar'
import type { BoxRenderable, KeyEvent } from '@opentui/core'

/** Sticky manual fold and responsive peek share live, scrollable navigation. */
export function SidebarRail({
  onUnfold,
  ...props
}: RightSidebarProps & { onUnfold?: () => void }) {
  const theme = useTheme()
  const terminal = useTerminalDimensions()
  const [expanded, setExpanded] = React.useState(false)
  const [height, setHeight] = React.useState(0)
  const ref = React.useRef<BoxRenderable | null>(null)
  const fallback = React.useMemo(() => createSidebarFocusController(), [])
  const controller = props.focusController ?? fallback
  const activity = useChatStore((s) => s.activity)
  const compaction = useChatStore((s) => s.compactionStatus)
  const goal = useChatStore(
    (s) => s.runState?.sessionState?.mainAgentState?.goal,
  )
  const drive = useChatStore(
    (s) => s.runState?.sessionState?.mainAgentState?.driveStatus,
  )
  const { fids, isLoading } = useFids(props.fidsDir)
  const urgent = fids.filter(
    (fid) => fid.severity === 'critical' || fid.severity === 'high',
  ).length
  const display = sidebarActivity(activity.kind, props.lifecycle)
  const compactionAttention =
    compaction?.phase === 'blocked' || compaction?.phase === 'ineffective'
  const goalAttention = goal?.status === 'paused' || goal?.status === 'blocked'
  React.useEffect(() => {
    const rail = ref.current
    if (!rail) return undefined
    const measure = () => setHeight(rail.height)
    measure()
    let measurementTimer = setTimeout(measure, 16)
    const onResize = () => {
      measure()
      clearTimeout(measurementTimer)
      measurementTimer = setTimeout(measure, 16)
    }
    rail.on('resize', onResize)
    return () => {
      rail.off('resize', onResize)
      clearTimeout(measurementTimer)
    }
  }, [expanded])
  useKeyboard(
    React.useCallback(
      (key: KeyEvent) => {
        if (
          expanded &&
          (key.name === 'escape' || (key.ctrl && key.name === 'c'))
        ) {
          key.preventDefault?.()
          key.stopPropagation?.()
          setExpanded(false)
          return
        }
        if (expanded || !isSidebarFocusCycleKey(key)) return
        key.preventDefault?.()
        key.stopPropagation?.()
        controller.focusNext()
      },
      [expanded, controller],
    ),
  )
  const activate = (id: string) => {
    setExpanded(true)
    controller.focusSection(id)
  }
  if (expanded)
    return (
      <RightSidebar
        {...props}
        width={Math.min(40, Math.max(27, terminal.width - 20))}
        focusController={controller}
        onCollapse={() => setExpanded(false)}
      />
    )
  const items = [
    {
      id: 'Status',
      label: 'Activity',
      detail: display.label,
      attention: display.tone === 'warning',
    },
    {
      id: 'Session',
      label: 'Session',
      detail: compactionAttention ? `! ${compaction.phase}` : 'Model/cache',
      attention: compactionAttention,
    },
    {
      id: 'Loop',
      label: 'Loop',
      detail: goal?.status ?? 'No goal',
      attention: goalAttention,
    },
    ...(drive
      ? [
          {
            id: 'Auto Drive',
            label: 'Drive',
            detail: `${drive.phase ?? 'Unknown'} · ${drive.queueTrend > 0 ? '+' : ''}${drive.queueTrend}`,
            attention: drive.queueTrend > 0,
          },
        ]
      : []),
    {
      id: 'Tools',
      label: 'Tools',
      detail: `${new Set(props.toolsUsed).size} used`,
    },
    {
      id: 'Files',
      label: 'Files',
      detail: `+${props.filesChanged.created} / ~${props.filesChanged.modified}`,
    },
    {
      id: 'FIDs',
      label: 'FIDs',
      detail: isLoading
        ? 'Loading'
        : urgent
          ? `${fids.length} · ${urgent} urgent`
          : `${fids.length} active`,
      attention: urgent > 0,
    },
    {
      id: 'History',
      label: 'History',
      detail: `${props.toolHistory.length} events`,
    },
  ]
  return (
    <SidebarFocusContext.Provider value={controller}>
      <box
        ref={ref}
        width={14}
        height="100%"
        flexShrink={0}
        flexDirection="column"
        border={['left']}
        borderColor={theme.border}
        backgroundColor={theme.surface}
        paddingLeft={1}
        paddingRight={1}
        position="relative"
        focusable={false}
        onMouseMove={onUnfold ? undefined : () => setExpanded(true)}
      >
        {onUnfold && (
          <box position="absolute" left={-3} top={0} zIndex={10}>
            <SidebarFoldButton
              id="rail-unfold"
              label={glyph('navBack') === '<' ? '<' : '«'}
              onActivate={onUnfold}
            />
          </box>
        )}
        <box
          flexShrink={0}
          height={height > 1 ? 2 : 1}
          marginBottom={height > 4 ? 1 : 0}
          overflow="hidden"
          flexDirection="column"
          alignItems="center"
        >
          <box
            id="rail-brand"
            width="100%"
            alignItems="center"
            selectable={false}
          >
            <box marginRight={1} selectable={false}>
              <SavantMark fallback={<Branding font="tiny" text="S" color="primary" />} />
            </box>
          </box>
        </box>
        {height > 2 && (
          <scrollbox
            scrollX={false}
            scrollbarOptions={{ visible: false }}
            verticalScrollbarOptions={createChatScrollbarOptions(theme)}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              contentOptions: {
                flexDirection: 'column',
                gap: 1,
                flexShrink: 0,
              },
            }}
          >
            {items.map((item) => (
              <RailControl
                key={item.id}
                {...item}
                activate={() => activate(item.id)}
              />
            ))}
          </scrollbox>
        )}
        {height >= 20 && (
          <box alignItems="center" flexShrink={0}>
            <text
              fg={theme.muted}
              selectable={false}
            >{`v${getVersion()}`}</text>
          </box>
        )}
      </box>
    </SidebarFocusContext.Provider>
  )
}
