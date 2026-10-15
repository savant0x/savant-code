import { TextAttributes } from '@opentui/core'

import { Button } from './button'
import { allChatsInterrupted } from './chat-history-format'
import { useTheme } from '../hooks/use-theme'

import type { ChatHistoryEntry } from '../utils/chat-history'

interface ChatHistoryTitleProps {
  chats: ChatHistoryEntry[]
}

/** Screen title + the interrupted-session hint. Hidden in compact mode. */
export const ChatHistoryTitle = ({ chats }: ChatHistoryTitleProps) => {
  const theme = useTheme()
  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 1,
        marginTop: 1,
        flexShrink: 0,
      }}
    >
      <text style={{ fg: theme.foreground, attributes: TextAttributes.BOLD }}>
        Select a chat to resume
      </text>
      {allChatsInterrupted(chats) && (
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          All sessions show as interrupted — this may be a display quirk; resume
          one to verify.
        </text>
      )}
    </box>
  )
}

interface ChatHistoryBottomBarProps {
  contentWidth: number
  isNarrowWidth: boolean
  statusMessage: string | null
  onNewChat: () => void
  onCancel: () => void
}

/** Bottom bar: help text + status message + New Chat / Cancel buttons. */
export const ChatHistoryBottomBar = ({
  contentWidth,
  isNarrowWidth,
  statusMessage,
  onNewChat,
  onCancel,
}: ChatHistoryBottomBarProps) => {
  const theme = useTheme()
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingTop: 0,
        paddingBottom: 0,
        borderStyle: 'single',
        borderColor: theme.border,
        flexShrink: 0,
        backgroundColor: theme.surface,
      }}
      border={['top']}
    >
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: contentWidth,
        }}
      >
        {/* Help text */}
        <box style={{ flexGrow: 1, flexShrink: 1 }}>
          <text style={{ fg: theme.muted }}>
            ↑↓ navigate · Enter select · Click [×] to remove · Esc cancel
          </text>
          {statusMessage && (
            <text style={{ fg: theme.muted }}>
              {' · '}
              {statusMessage}
            </text>
          )}
        </box>

        {/* Buttons - hidden on narrow screens */}
        {!isNarrowWidth && (
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <Button
              onClick={onNewChat}
              style={{
                paddingLeft: 2,
                paddingRight: 2,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.primary,
              }}
              border={['top', 'bottom', 'left', 'right']}
            >
              <text style={{ fg: theme.primary }}>New Chat</text>
            </Button>
            <Button
              onClick={onCancel}
              style={{
                paddingLeft: 2,
                paddingRight: 2,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.muted,
              }}
              border={['top', 'bottom', 'left', 'right']}
            >
              <text style={{ fg: theme.muted }}>Cancel</text>
            </Button>
          </box>
        )}
      </box>
    </box>
  )
}
