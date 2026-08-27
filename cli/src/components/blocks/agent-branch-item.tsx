import { TextAttributes } from '@opentui/core'
import React, { memo, type ReactNode } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { useWhyDidYouUpdateById } from '../../hooks/use-why-did-you-update'
import { getCliEnv } from '../../utils/env'
import { MAX_COLLAPSED_LINES, truncateToLines } from '../../utils/strings'
import { Button } from '../button'
import { CollapseButton } from '../collapse-button'
import { ShimmerText } from '../shimmer-text'
import { TrafficLights } from '../traffic-lights'
import { renderExpandedContent } from './block-helpers'

interface AgentBranchItemProps {
  name: string
  children?: ReactNode
  prompt?: string
  agentId?: string
  isCollapsed: boolean
  isStreaming: boolean
  /** Preview text shown when collapsed (empty string = no preview) */
  preview: string
  statusLabel?: string
  statusColor?: string
  statusIndicator?: string
  onToggle?: () => void
  titleSuffix?: string
}

export const AgentBranchItem = memo((props: AgentBranchItemProps) => {
  const {
    name,
    children,
    prompt,
    agentId,
    isCollapsed,
    isStreaming,
    preview,
    statusLabel,
    statusColor,
    statusIndicator = '●',
    onToggle,
    titleSuffix,
  } = props
  useWhyDidYouUpdateById('AgentBranchItem', agentId ?? '', props, {
    logLevel: 'debug',
    enabled: getCliEnv().SAVANT_CODE_PERF_TEST === 'true',
  })
  const theme = useTheme()

  const baseTextAttributes = theme.messageTextAttributes ?? 0
  const getAttributes = (extra: number = 0): number | undefined => {
    const combined = baseTextAttributes | extra
    return combined === 0 ? undefined : combined
  }

  const isExpanded = !isCollapsed
  const toggleIconColor = isStreaming ? theme.primary : theme.foreground
  const bulletChar = '• '
  const toggleIndicator = onToggle ? (isCollapsed ? '▸ ' : '▾ ') : ''
  const toggleLabel = onToggle ? toggleIndicator : bulletChar
  const statusText =
    statusLabel && statusLabel.length > 0
      ? statusIndicator === '✓'
        ? `${statusLabel} ${statusIndicator}`
        : `${statusIndicator} ${statusLabel}`
      : null
  const showCollapsedPreview = preview.length > 0

  return (
    <box
      style={{
        flexDirection: 'column',
        gap: 0,
        flexShrink: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingBottom: 0,
        width: '100%',
      }}
    >
      {/* FID-2026-0822-006: frame re-skinned to the unified TrafficLightPanel
          chrome language — rounded border on theme.border over the surface
          background, matching every panel in the transcript. Collapse and
          streaming UX are unchanged (chevron, status, shimmer preserved);
          state signaling stays on the icon color + bold + status text. */}
      <box
        border
        borderStyle="rounded"
        borderColor={theme.border}
        style={{
          flexDirection: 'column',
          gap: 0,
          backgroundColor: theme.surface,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          width: '100%',
        }}
      >
        <Button
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            width: '100%',
          }}
          onClick={onToggle}
        >
          <box
            selectable={false}
            style={{ flexDirection: 'row', flexShrink: 0 }}
          >
            <text fg={toggleIconColor} style={{ wrapMode: 'none' }}>
              {toggleLabel}
            </text>
            <text
              fg={theme.foreground}
              style={{ wrapMode: 'none' }}
              attributes={isExpanded ? TextAttributes.BOLD : undefined}
            >
              {name}
            </text>
            {titleSuffix ? (
              <text
                fg={theme.foreground}
                style={{ wrapMode: 'none' }}
                attributes={TextAttributes.BOLD}
              >
                {` ${titleSuffix}`}
              </text>
            ) : null}
            {statusText ? (
              <text
                fg={statusColor ?? theme.muted}
                style={{ wrapMode: 'none' }}
                attributes={TextAttributes.DIM}
              >
                {` ${statusText}`}
              </text>
            ) : null}
          </box>
          {/* Compact chrome lights — right-aligned like every panel title
              bar (FID-2026-0822-006 unification). */}
          <box selectable={false} style={{ flexShrink: 0 }}>
            <TrafficLights />
          </box>
        </Button>

        {isCollapsed ? (
          showCollapsedPreview ? (
            <Button
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
              }}
              onClick={onToggle}
            >
              <text
                fg={isStreaming ? theme.foreground : theme.muted}
                attributes={getAttributes(TextAttributes.ITALIC)}
              >
                {truncateToLines(preview, MAX_COLLAPSED_LINES)}
              </text>
            </Button>
          ) : null
        ) : (
          <box
            style={{
              flexDirection: 'column',
              gap: 0,
              paddingLeft: 1,
              paddingRight: 1,
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            {prompt && (
              <box
                style={{
                  flexDirection: 'row',
                  gap: 0,
                  alignItems: 'stretch',
                  marginBottom: children ? 1 : 0,
                }}
              >
<box
                  style={{
                    width: 1,
                    backgroundColor: theme.primary,
                    marginTop: 0,
                    marginBottom: 0,
                  }}
                />
                <box
                  style={{
                    paddingLeft: 1,
                    flexGrow: 1,
                  }}
                >
                  <text
                    fg={theme.foreground}
                    style={{ wrapMode: 'word' }}
                    attributes={getAttributes(TextAttributes.ITALIC)}
                  >
                    {prompt}
                  </text>
                </box>
              </box>
            )}
            {renderExpandedContent(children, theme, getAttributes)}
            {onToggle && <CollapseButton onClick={onToggle} />}
          </box>
        )}
        {isStreaming && isExpanded && (
          <box
            style={{
              paddingLeft: 1,
              paddingBottom: 0,
            }}
          >
            <ShimmerText
              text="thinking..."
              interval={160}
              primaryColor={theme.primary}
              host="box"
            />
          </box>
        )}
      </box>
    </box>
  )
})
