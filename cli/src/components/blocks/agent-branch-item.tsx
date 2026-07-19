import { TextAttributes } from '@opentui/core'
import React, { memo, type ReactNode } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { useWhyDidYouUpdateById } from '../../hooks/use-why-did-you-update'
import { getCliEnv } from '../../utils/env'
import { MAX_COLLAPSED_LINES, truncateToLines } from '../../utils/strings'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'
import { CollapseButton } from '../collapse-button'
import { ShimmerText } from '../shimmer-text'
import { isTextRenderable, renderExpandedContent } from './block-helpers'

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
    enabled: getCliEnv().CODEBUFF_PERF_TEST === 'true',
  })
  const theme = useTheme()

  const baseTextAttributes = theme.messageTextAttributes ?? 0
  const getAttributes = (extra: number = 0): number | undefined => {
    const combined = baseTextAttributes | extra
    return combined === 0 ? undefined : combined
  }

  const isExpanded = !isCollapsed
  const toggleFrameColor = isExpanded ? theme.secondary : theme.muted
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
      <box
        border
        borderStyle="single"
        borderColor={toggleFrameColor}
        customBorderChars={BORDER_CHARS}
        style={{
          flexDirection: 'column',
          gap: 0,
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
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            width: '100%',
          }}
          onClick={onToggle}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={toggleIconColor}>{toggleLabel}</span>
            <span
              fg={theme.foreground}
              attributes={isExpanded ? TextAttributes.BOLD : undefined}
            >
              {name}
            </span>
            {titleSuffix ? (
              <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
                {` ${titleSuffix}`}
              </span>
            ) : null}
            {statusText ? (
              <span
                fg={statusColor ?? theme.muted}
                attributes={TextAttributes.DIM}
              >
                {` ${statusText}`}
              </span>
            ) : null}
          </text>
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
                    backgroundColor: theme.aiLine,
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
            <text>
              <ShimmerText
                text="working..."
                interval={160}
                primaryColor={theme.secondary}
              />
            </text>
          </box>
        )}
      </box>
    </box>
  )
})
