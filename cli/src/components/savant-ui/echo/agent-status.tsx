import { TextAttributes } from '@opentui/core'
import React from 'react'

import { activityIcon } from './agent-icons'
import { savantRasterDataUri } from '../../../hooks/use-savant-raster'
import { useChatStore } from '../../../state/chat-store'
import { glyph } from '../../../utils/glyphs'
import {
  renderInlineImage,
  supportsInlineImages,
} from '../../../utils/terminal-images'
import {
  sidebarActivity,
  sidebarEllipsis,
  sidebarPhase,
} from '../../right-sidebar-display'
import { SidebarFocusContext } from '../../right-sidebar-focus'
import { SidebarActivityAccent } from '../../right-sidebar-motion'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'

import type { SavantIconName } from '../../../constants/savant-icons'
import type { StatusIndicatorState } from '../../../utils/status-indicator-state'

/**
 * Family icon for the current activity line, as a 1-cell inline-image
 * sequence when the terminal supports one and the activity resolves to a
 * mark in the generated family (FID-2026-1009-004). Any miss — unsupported
 * terminal, idle, unknown kind, unmapped everything — degrades to `null`
 * and the row renders the existing glyph composition (Law 14).
 */
function activityIconSequence(
  kind: string,
  detail: { agentType?: string; toolName?: string },
): string | null {
  const icon: SavantIconName | null = activityIcon(kind, detail)
  if (!icon) return null
  if (!supportsInlineImages()) return null
  const dataUri = savantRasterDataUri(icon)
  if (!dataUri) return null
  return renderInlineImage(dataUri.replace(/^data:image\/png;base64,/, ''), {
    width: 1, // single-line activity row — same cell the glyph occupies
    height: 1,
  })
}

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
          {(() => {
            const iconSeq = activityIconSequence(activity.kind, {
              agentType:
                activity.kind === 'subagent' ? activity.agentType : undefined,
              toolName: activity.kind === 'tool' ? activity.toolName : undefined,
            })
            const glyphChar = glyph(
              display.tone === 'idle'
                ? 'phaseIdle'
                : display.tone === 'warning'
                  ? 'alertWarning'
                  : 'phaseActive',
            )
            const label = sidebarEllipsis(display.label, cells - 2)
            return iconSeq ? (
              <box
                flexDirection="row"
                gap={1}
                alignItems="center"
                selectable={false}
              >
                <text selectable={false}>{iconSeq}</text>
                <text
                  fg={color}
                  attributes={TextAttributes.BOLD}
                  selectable={false}
                >
                  {label}
                </text>
              </box>
            ) : (
              <text
                fg={color}
                attributes={TextAttributes.BOLD}
                selectable={false}
              >
                {`${glyphChar} ${label}`}
              </text>
            )
          })()}
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
