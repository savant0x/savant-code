import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useChatStore } from '../../../state/chat-store'
import { glyph } from '../../../utils/glyphs'
import {
  sidebarActivity,
  sidebarEllipsis,
  sidebarPhase,
} from '../../right-sidebar-display'
import { SidebarFocusContext } from '../../right-sidebar-focus'
import { SidebarActivityAccent } from '../../right-sidebar-motion'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'

import type { StatusIndicatorState } from '../../../utils/status-indicator-state'

export function AgentStatus({
  lifecycle,
  compact = false,
  detailOnly = false,
  hideDetail = false,
  cells = 33,
}: {
  lifecycle?: StatusIndicatorState
  compact?: boolean
  detailOnly?: boolean
  hideDetail?: boolean
  cells?: number
}) {
  const theme = useTheme()
  const phase = useChatStore((s) => s.fsmPhase) ?? 'idle'
  const activity = useChatStore((s) => s.activity)
  const controller = React.useContext(SidebarFocusContext)
  const display = sidebarActivity(activity.kind, lifecycle)
  const detail =
    activity.kind === 'tool'
      ? [activity.toolName, activity.target].filter(Boolean).join(': ')
      : activity.kind === 'researching'
        ? (activity.query ?? '')
        : activity.kind === 'subagent'
          ? (activity.agentType ?? '')
          : activity.kind === 'thinking'
            ? (activity.model ?? '')
            : ''
  const color =
    display.tone === 'warning'
      ? theme.warning
      : display.tone === 'active'
        ? theme.primary
        : theme.muted
  if (detailOnly)
    return (
      <box flexDirection="column">
        {detail && (
          <text fg={theme.foreground} wrapMode="word" selectable={false}>
            {detail}
          </text>
        )}
        <text fg={theme.muted} wrapMode="word" selectable={false}>
          {sidebarPhase(phase)}
        </text>
      </box>
    )
  return (
    <SidebarActivityAccent
      kind={
        lifecycle?.kind === 'paused' ||
        lifecycle?.kind === 'connecting' ||
        lifecycle?.kind === 'retrying'
          ? lifecycle.kind
          : activity.kind
      }
      disabled={controller?.reducedMotion ?? true}
    >
      {(emphasized) => (
        <box
          flexDirection="column"
          border={['left']}
          borderColor={color}
          paddingLeft={1}
          flexShrink={0}
          backgroundColor={emphasized ? theme.surfaceHover : undefined}
        >
          <text fg={color} attributes={TextAttributes.BOLD} selectable={false}>
            {`${glyph(display.tone === 'idle' ? 'phaseIdle' : display.tone === 'warning' ? 'alertWarning' : 'phaseActive')} ${sidebarEllipsis(display.label, cells - 2)}`}
          </text>
          {!compact && !hideDetail && detail && (
            <text fg={theme.foreground} selectable={false}>
              {sidebarEllipsis(detail, cells)}
            </text>
          )}
          {!compact && (
            <text fg={theme.muted} selectable={false}>
              {sidebarEllipsis(sidebarPhase(phase), cells)}
            </text>
          )}
        </box>
      )}
    </SidebarActivityAccent>
  )
}
