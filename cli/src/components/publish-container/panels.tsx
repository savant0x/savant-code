import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'

/** Terminal too small — show a placeholder explaining the menu can't fit. */
export const TooSmallPanel: React.FC<{ onCancel: () => void }> = ({
  onCancel,
}) => {
  const theme = useTheme()
  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.info}
      customBorderChars={BORDER_CHARS}
      style={{
        flexDirection: 'column',
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <text style={{ fg: theme.warning, attributes: TextAttributes.BOLD }}>
        Terminal too small
      </text>
      <text style={{ fg: theme.muted }}>
        Please resize your terminal to use the publish menu.
      </text>
      <Button
        onClick={onCancel}
        style={{
          marginTop: 1,
          paddingLeft: 1,
          paddingRight: 1,
          borderStyle: 'single',
          borderColor: theme.border,
        }}
        customBorderChars={BORDER_CHARS}
      >
        <text style={{ fg: theme.foreground }}>CLOSE</text>
      </Button>
    </box>
  )
}

/** Empty state — no user agents found to publish. */
export const EmptyStatePanel: React.FC<{ onCancel: () => void }> = ({
  onCancel,
}) => {
  const theme = useTheme()
  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.info}
      customBorderChars={BORDER_CHARS}
      style={{
        flexDirection: 'column',
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <text style={{ fg: theme.warning, attributes: TextAttributes.BOLD }}>
        No agents found
      </text>
      <text style={{ fg: theme.muted }}>
        Create agents in the .agents/ directory to publish them.
      </text>
      <text style={{ fg: theme.muted }}>
        See: https://savant-code.com/docs/agents for guidance.
      </text>
      <Button
        onClick={onCancel}
        style={{
          marginTop: 1,
          paddingLeft: 1,
          paddingRight: 1,
          borderStyle: 'single',
          borderColor: theme.border,
        }}
        customBorderChars={BORDER_CHARS}
      >
        <text style={{ fg: theme.foreground }}>CLOSE</text>
      </Button>
    </box>
  )
}
