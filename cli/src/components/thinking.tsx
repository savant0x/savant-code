import { TextAttributes } from '@opentui/core'
import React, { memo, type ReactNode } from 'react'

import { Button } from './button'
import {
  TRAFFIC_PANEL_WIDTH_ALLOWANCE,
  TrafficLightPanel,
} from './traffic-light-panel'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { useTypewriter } from '../hooks/use-typewriter'
import { getLastNVisualLines } from '../utils/text-layout'

import type { ThinkingCollapseState } from '../types/chat'

const PREVIEW_LINE_COUNT = 5

interface ThinkingProps {
  content: string
  thinkingCollapseState: ThinkingCollapseState
  /** Whether the thinking has completed (streaming finished) */
  isThinkingComplete: boolean
  onToggle: () => void
  availableWidth?: number
}

export const Thinking = memo(
  ({
    content,
    thinkingCollapseState,
    isThinkingComplete,
    onToggle,
    availableWidth,
  }: ThinkingProps): ReactNode => {
    const theme = useTheme()
    const { contentMaxWidth } = useTerminalDimensions()
    // Reveal the streamed reasoning progressively (chunked commits) while
    // thinking is in flight; completed content is shown in full immediately.
    const displayedContent = useTypewriter(content, !isThinkingComplete)

    // Special case: single **bold** string under 100 chars gets compact rendering
    const singleBoldMatch =
      content.length < 100 ? content.trim().match(/^\*\*([^*]+)\*\*$/) : null
    if (singleBoldMatch) {
      return null
    }

    const width = Math.max(10, availableWidth ?? contentMaxWidth)
    // Normalize content to single line for consistent preview (but preserve in expanded mode)
    const normalizedContent = displayedContent.replace(/\n+/g, ' ').trim()
    // FID-2026-0822-010: the preview wraps its lines INSIDE the
    // TrafficLightPanel chrome, which consumes 4 horizontal columns around
    // its content. Subtract that allowance before wrapping (same discipline
    // as the framed tool renderers) or the pre-wrapped rows run flush
    // against the border glyph and words end mid-word against it (`FSM is
    // b│`, `suggest_follo│` — live captures fid-011-smoke/s3,s11). The
    // expanded path wraps natively (wrapMode:'word' at the box width) and
    // does not need the deduction.
    const previewTextWidth = Math.max(1, width - TRAFFIC_PANEL_WIDTH_ALLOWANCE)
    // Account for "..." prefix (3 chars) when calculating line widths
    const effectiveWidth = Math.max(1, previewTextWidth - 3)
    const { lines, hasMore } = getLastNVisualLines(
      normalizedContent,
      effectiveWidth,
      PREVIEW_LINE_COUNT,
      // FID-2026-0822-010: getLastNVisualLines char-splits oversize tokens
      // (long URLs, paths); trim those rows to a word boundary with a
      // visible ellipsis marker so no word is ever clipped mid-word.
      { ellipsizeMidWordCuts: true },
    )
    // In expanded mode, preserve original line breaks for proper markdown rendering
    const expandedContent = displayedContent.replace(/\n\n+/g, '\n\n').trim()

    const showFull = thinkingCollapseState === 'expanded'
    const showPreview = thinkingCollapseState === 'preview' && lines.length > 0

    const toggleIndicator = !isThinkingComplete
      ? '• '
      : showFull
        ? '▾ '
        : showPreview
          ? '• '
          : '▸ '

    // FID-2026-0822-010: reasoning panels speak the unified
    // TrafficLightPanel chrome language (bordered surface panel + glowing
    // title bar) instead of the bare frameless layout.
    return (
      <TrafficLightPanel>
        <Button
          style={{
            flexDirection: 'column',
            gap: 0,
          }}
          onClick={onToggle}
        >
          <text style={{ fg: theme.foreground }}>
            <span>{toggleIndicator}</span>
            <span attributes={TextAttributes.BOLD}>reasoning</span>
          </text>
          {showPreview && (
            <box style={{ paddingLeft: 2 }}>
              <text
                style={{
                  wrapMode: 'none',
                  fg: theme.muted,
                }}
                attributes={TextAttributes.ITALIC}
              >
                {hasMore ? '...' + lines.join('\n') : lines.join('\n')}
              </text>
            </box>
          )}
          {showFull && (
            <box style={{ paddingLeft: 2 }}>
              <text
                style={{
                  wrapMode: 'word',
                  fg: theme.muted,
                }}
                attributes={TextAttributes.ITALIC}
              >
                {expandedContent}
              </text>
            </box>
          )}
        </Button>
      </TrafficLightPanel>
    )
  },
)
