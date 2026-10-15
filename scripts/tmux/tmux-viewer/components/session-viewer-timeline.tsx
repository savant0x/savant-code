import { TextAttributes } from '@opentui/core'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { Capture } from '../types'
import type { ViewerTheme } from './theme'
import type { ScrollBoxRenderable } from '@opentui/core'

// Timeline panel component (bottom) - card-style items with borders
const TIMELINE_CARD_WIDTH = 28

// Get actual terminal width, with fallback
function getTerminalWidth(): number {
  return process.stdout.columns || 120
}

export const TimelinePanel: React.FC<{
  captures: Capture[]
  selectedIndex: number
  isPlaying: boolean
  theme: ViewerTheme
}> = ({ captures, selectedIndex, isPlaying, theme }) => {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  // Track terminal width for centering calculations
  const [terminalWidth, setTerminalWidth] = useState(getTerminalWidth)

  // Listen for terminal resize
  useEffect(() => {
    const handleResize = () => setTerminalWidth(getTerminalWidth())
    process.stdout.on('resize', handleResize)
    return () => {
      process.stdout.off('resize', handleResize)
    }
  }, [])

  // Calculate padding needed to allow centering at edges
  // Account for the timeline panel border (2 chars) and some margin
  const viewportWidth = terminalWidth - 4
  const centerPadding = Math.floor(viewportWidth / 2)

  // Auto-scroll to center the selected item
  useLayoutEffect(() => {
    if (scrollRef.current?.scrollTo && captures.length > 0) {
      // Each card takes TIMELINE_CARD_WIDTH + 1 (for gap)
      const cardTotalWidth = TIMELINE_CARD_WIDTH + 1
      // Position of the selected card's center (including left padding)
      const cardCenterPosition =
        centerPadding + selectedIndex * cardTotalWidth + TIMELINE_CARD_WIDTH / 2
      // Scroll so that the card center is in the middle of the viewport
      const scrollX = Math.max(0, cardCenterPosition - viewportWidth / 2)
      scrollRef.current.scrollTo({ x: scrollX, y: 0 })
    }
  }, [selectedIndex, captures.length, centerPadding, viewportWidth])

  // Timeline title shows play/pause status
  const timelineTitle = isPlaying ? '▶ Playing' : '⏸ Paused'

  if (captures.length === 0) {
    return (
      <box
        title={timelineTitle}
        style={{
          flexDirection: 'column',
          height: 9,
          borderStyle: 'single',
          borderColor: theme.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        border={['top', 'bottom', 'left', 'right']}
      >
        <text style={{ fg: theme.muted }}>No captures</text>
      </box>
    )
  }

  return (
    <box
      title={timelineTitle}
      style={{
        flexDirection: 'column',
        height: 9,
        borderStyle: 'single',
        borderColor: theme.border,
      }}
      border={['top', 'bottom', 'left', 'right']}
    >
      <scrollbox
        ref={scrollRef}
        scrollX={true}
        scrollY={false}
        scrollbarOptions={{ visible: false }}
        style={{
          flexGrow: 1,
          rootOptions: { backgroundColor: 'transparent' },
          wrapperOptions: { border: false, backgroundColor: 'transparent' },
          contentOptions: {
            flexDirection: 'row',
            backgroundColor: 'transparent',
            gap: 1,
            paddingLeft: centerPadding,
            paddingRight: centerPadding,
            paddingTop: 1,
            paddingBottom: 1,
          },
        }}
      >
        {captures.map((capture, idx) => {
          const isSelected = idx === selectedIndex
          const label =
            capture.frontMatter.label ||
            `Capture ${capture.frontMatter.sequence}`
          const time = formatTime(capture.frontMatter.timestamp)
          const seq = capture.frontMatter.sequence
          const afterCommand = capture.frontMatter.after_command

          return (
            <TimelineCard
              key={capture.path}
              isSelected={isSelected}
              seq={seq}
              time={time}
              label={label}
              afterCommand={afterCommand}
              theme={theme}
            />
          )
        })}
      </scrollbox>
    </box>
  )
}

// Individual timeline card component
const TimelineCard: React.FC<{
  isSelected: boolean
  seq: number
  time: string
  label: string
  afterCommand: string | null
  theme: ViewerTheme
}> = ({ isSelected, seq, time, label, afterCommand, theme }) => {
  const indicator = isSelected ? '▶' : '○'
  const titleText = `${indicator} [${seq}] ${time}`
  const truncatedLabel = label.slice(0, TIMELINE_CARD_WIDTH - 4)
  // Show a short command snippet if available
  const commandSnippet = afterCommand
    ? truncateCommand(afterCommand, TIMELINE_CARD_WIDTH - 6)
    : null

  return (
    <box
      title={titleText}
      style={{
        flexDirection: 'column',
        width: TIMELINE_CARD_WIDTH,
        height: 5,
        borderStyle: 'single',
        borderColor: isSelected ? theme.primary : theme.border,
        backgroundColor: isSelected ? theme.surfaceHover : 'transparent',
        justifyContent: 'center',
      }}
      border={['top', 'bottom', 'left', 'right']}
    >
      {/* Label inside the box */}
      <box style={{ paddingLeft: 1, paddingRight: 1 }}>
        <text
          style={{
            fg: isSelected ? theme.foreground : theme.muted,
            attributes: isSelected ? TextAttributes.BOLD : undefined,
          }}
        >
          {truncatedLabel}
        </text>
      </box>
      {/* Command snippet - always render to keep consistent height */}
      <box style={{ paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: theme.muted }}>
          {commandSnippet ? `$ ${commandSnippet}` : ' '}
        </text>
      </box>
    </box>
  )
}

// Helper to format ISO timestamp into HH:MM:SS
function formatTime(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return isoTimestamp.slice(11, 19)
  }
}

// Helper to truncate command strings for display
function truncateCommand(command: string, maxLength: number): string {
  // Remove newlines and extra whitespace
  const cleaned = command.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }
  return cleaned.slice(0, maxLength - 1) + '…'
}
