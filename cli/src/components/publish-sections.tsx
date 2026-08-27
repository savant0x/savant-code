import { TextAttributes } from '@opentui/core'

import { createChatScrollbarOptions } from '../chat/styles'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { useTheme } from '../hooks/use-theme'
import type React from 'react'

export interface AgentSectionProps {
  title?: string
  titleInBorder?: boolean
  agents: Array<{ id: string; displayName: string }>
  theme: ReturnType<typeof useTheme>
  symbol: string
  symbolColor: string
  textColor: string
  maxHeight: number
  rightContent?: React.ReactNode
}

export const AgentSection: React.FC<AgentSectionProps> = ({
  title,
  titleInBorder = false,
  agents,
  theme,
  symbol,
  symbolColor,
  textColor,
  maxHeight,
  rightContent,
}) => {
  const needsScroll = agents.length > maxHeight

  // If no agents and no right content (like a toggle), don't render
  if (agents.length === 0 && !rightContent) {
    return null
  }

  // Check if we should show the header (title or rightContent) - but not if titleInBorder
  const showHeader = (title && !titleInBorder) || rightContent

  const titleText = title ? `${title} (${agents.length})` : undefined

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      {/* Header with optional right content - only show if title or rightContent */}
      {showHeader && (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {title && !titleInBorder ? (
            <text
              style={{ fg: theme.secondary, attributes: TextAttributes.BOLD }}
            >
              {titleText}
            </text>
          ) : (
            <text>{/* spacer */}</text>
          )}
          {rightContent}
        </box>
      )}

      {/* Agent list in a box - only show if there are agents */}
      {agents.length > 0 && (
        <box
          border
          borderStyle="single"
          borderColor={theme.border}
          customBorderChars={BORDER_CHARS}
          style={{
            flexDirection: 'column',
          }}
        >
          {/* Title row inside the box when titleInBorder is true */}
          {titleInBorder && titleText && (
            <box style={{ paddingLeft: 1, paddingRight: 1 }}>
              <text
                style={{ fg: theme.secondary, attributes: TextAttributes.BOLD }}
              >
                {titleText}
              </text>
            </box>
          )}
          <scrollbox
            scrollX={false}
            scrollbarOptions={{ visible: false }}
            verticalScrollbarOptions={{
              visible: needsScroll,
              ...createChatScrollbarOptions(theme),
            }}
            style={{
              height: Math.min(agents.length, maxHeight),
              rootOptions: {
                flexDirection: 'row',
                backgroundColor: 'transparent',
              },
              wrapperOptions: {
                border: false,
                backgroundColor: 'transparent',
                flexDirection: 'column',
              },
              contentOptions: {
                flexDirection: 'column',
                gap: 0,
                backgroundColor: 'transparent',
                paddingLeft: 1,
                paddingRight: 1,
              },
            }}
          >
            {agents.map((agent) => {
              const displayText =
                agent.displayName !== agent.id
                  ? `${agent.displayName} (${agent.id})`
                  : agent.displayName

              return (
                <box key={agent.id} style={{ flexDirection: 'row', gap: 1 }}>
                  <text style={{ fg: symbolColor }}>{symbol}</text>
                  <text style={{ fg: textColor }}>{displayText}</text>
                </box>
              )
            })}
          </scrollbox>
        </box>
      )}
    </box>
  )
}

export const DirectionLabel: React.FC<{
  theme: ReturnType<typeof useTheme>
  direction: 'up' | 'down'
}> = ({ theme, direction }) => (
  <box style={{ flexDirection: 'column', alignItems: 'center', gap: 0 }}>
    <text style={{ fg: theme.border }}> │</text>
    <text style={{ fg: theme.muted }}>spawns</text>
    <text style={{ fg: theme.border }}>
      {' '}
      {direction === 'down' ? '↓' : '↑'}
    </text>
  </box>
)
