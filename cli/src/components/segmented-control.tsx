import React, { useEffect, useRef, useState } from 'react'
import stringWidth from 'string-width'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'

import type { ChatTheme } from '../types/theme-system'

export interface Segment {
  id: string
  label: string
  isBold?: boolean
  isSelected?: boolean
  defaultHighlighted?: boolean // Highlighted when nothing else is hovered
  disabled?: boolean // Gray out and de-emphasize disabled items
  /** Optional one-line description surfaced by a parent hovertip (FID-2026-0805-001). */
  description?: string
}

/**
 * SegmentedControlProps
 *
 * Renders a bordered segmented toggle. Pure UI; all behavior is driven by
 * the parent via callbacks.
 */
interface SegmentedControlProps {
  segments: Segment[]
  onSegmentClick?: (id: string) => void
  onMouseOver?: () => void
  onMouseOut?: () => void
  /** Fired with the hovered segment id (or null on leave) so a parent can
   *  render a hovertip (FID-2026-0805-001). */
  onHoverChange?: (id: string | null) => void
}

export const SegmentedControl = ({
  segments,
  onSegmentClick,
  onMouseOver,
  onMouseOut,
  onHoverChange,
}: SegmentedControlProps) => {
  const theme = useTheme()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hasHoveredSinceOpen, setHasHoveredSinceOpen] = useState(false)
  // Hover-intent grace: delay clearing the parent's hover notification so a
  // hovertip (which sits ABOVE this control) does not flicker away when the
  // cursor leaves the segment cells toward the tip (FID-2026-0805-001).
  const hoverGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HOVER_GRACE_MS = 150

  useEffect(() => {
    return () => {
      if (hoverGraceRef.current) {
        clearTimeout(hoverGraceRef.current)
      }
    }
  }, [])

  const processedSegments = processSegments(
    segments,
    hoveredId,
    hasHoveredSinceOpen,
    theme,
  )
  const hoveredIndex = hoveredId
    ? processedSegments.findIndex((s) => s.id === hoveredId)
    : processedSegments.length - 1

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 0,
        backgroundColor: 'transparent',
      }}
      onMouseOver={onMouseOver}
      onMouseOut={() => {
        setHoveredId(null)
        if (hoverGraceRef.current) {
          clearTimeout(hoverGraceRef.current)
        }
        hoverGraceRef.current = setTimeout(() => {
          onHoverChange?.(null)
        }, HOVER_GRACE_MS)
        onMouseOut && onMouseOut()
      }}
    >
      {/* Segments rendered with dynamic left/right edges based on hover */}
      {processedSegments.map((seg, idx) => {
        const leftOfHovered = idx <= hoveredIndex
        const rightOfHovered = idx >= hoveredIndex

        return (
          <React.Fragment key={seg.id}>
            {leftOfHovered ? (
              <box style={{ flexDirection: 'column', gap: 0 }}>
                <text fg={seg.frameColor} selectable={false}>
                  ╭
                </text>
                <text fg={seg.frameColor} selectable={false}>
                  │
                </text>
                <text fg={seg.frameColor} selectable={false}>
                  ╰
                </text>
              </box>
            ) : null}

            <Button
              onClick={() => onSegmentClick && onSegmentClick(seg.id)}
              onMouseOver={() => {
                if (hoverGraceRef.current) {
                  clearTimeout(hoverGraceRef.current)
                }
                setHoveredId(seg.id)
                setHasHoveredSinceOpen(true)
                onHoverChange?.(seg.id)
              }}
              style={{
                flexDirection: 'column',
                gap: 0,
                width: seg.width,
                minWidth: seg.width,
              }}
            >
              <text fg={seg.frameColor}>{seg.topBorder}</text>
              <text fg={seg.textColor}>
                {seg.isItalic ? (
                  <i>{seg.content}</i>
                ) : seg.isBold ? (
                  <b>{seg.content}</b>
                ) : (
                  seg.content
                )}
              </text>
              <text fg={seg.frameColor}>{seg.bottomBorder}</text>
            </Button>

            {rightOfHovered ? (
              <box style={{ flexDirection: 'column', gap: 0 }}>
                <text fg={seg.frameColor} selectable={false}>
                  ╮
                </text>
                <text fg={seg.frameColor} selectable={false}>
                  │
                </text>
                <text fg={seg.frameColor} selectable={false}>
                  ╯
                </text>
              </box>
            ) : null}
          </React.Fragment>
        )
      })}
    </box>
  )
}

export type ProcessedSegment = {
  id: string
  topBorder: string
  content: string
  bottomBorder: string
  frameColor: string
  leftBorderColor: string
  textColor: string
  isHovered: boolean
  isBold: boolean
  isItalic: boolean
  label: string
  width: number
}

/**
 * Pure function that maps input segments + UI state to render-ready
 * segment descriptors. This is exported for unit testing.
 */
export const processSegments = (
  segments: Segment[],
  hoveredId: string | null,
  hasHoveredSinceOpen: boolean,
  theme: ChatTheme,
): ProcessedSegment[] => {
  return segments.map((seg) => {
    // Normalized flags
    const isDisabled = !!seg.disabled
    const isSelected = !!seg.isSelected
    const defaultHL = !!seg.defaultHighlighted

    // Hover and highlight state
    const canHover = !isSelected || defaultHL
    const isHovered = hoveredId === seg.id && canHover
    const isDefaultHighlighted = defaultHL && !hasHoveredSinceOpen
    const isHighlighted = isHovered || isDefaultHighlighted

    // Emphasis
    const isBold = !!(seg.isBold || isHovered || (isSelected && isHighlighted))

    // Colors — the highlight/hover frame is the brand cyan, not off-white
    // (operator feedback 2026-08-16: mode chips next to the input showed a
    // white stroke on hover).
    const frameColor = isHighlighted ? theme.primary : theme.border
    const textMuted = isDisabled || (isSelected && !isHighlighted)
    const textColor = textMuted ? theme.muted : theme.foreground

    // Content + metrics
    const content = ` ${seg.label} `
    const width = stringWidth(content)
    const horizontal = '─'.repeat(width)

    // Return render-ready descriptor
    // - Computed (complex conditions): frameColor, textColor, isBold
    // - Inlined (simple): isItalic (disabled), leftBorderColor (= frameColor)
    return {
      id: seg.id,
      topBorder: horizontal,
      content,
      bottomBorder: horizontal,
      frameColor,
      leftBorderColor: frameColor,
      textColor,
      isHovered,
      isBold,
      isItalic: isDisabled,
      label: seg.label,
      width,
    }
  })
}
