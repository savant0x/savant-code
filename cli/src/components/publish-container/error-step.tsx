import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'
import { Separator } from '../separator'

import type { PublishErrorResult } from '../../state/publish-store'

/** Error step: show the failure, with Try Again and Close. */
export const ErrorStep: React.FC<{
  width: number
  errorResult: PublishErrorResult
  onBack: () => void
  onClose: () => void
}> = ({ width, errorResult, onBack, onClose }) => {
  const theme = useTheme()
  const [backButtonHovered, setBackButtonHovered] = useState(false)
  const [closeButtonHovered, setCloseButtonHovered] = useState(false)
  return (
    <>
      <Separator width={width} widthOffset={4} />
      <box
        style={{
          paddingTop: 1,
          paddingBottom: 1,
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: theme.error }}>✗</text>
          <text style={{ fg: theme.error, attributes: TextAttributes.BOLD }}>
            Publish failed
          </text>
        </box>

        <box style={{ flexDirection: 'column', gap: 0, paddingLeft: 2 }}>
          {errorResult.error && (
            <text style={{ fg: theme.foreground }}>{errorResult.error}</text>
          )}
          {errorResult.details && (
            <text style={{ fg: theme.muted }}>{errorResult.details}</text>
          )}
          {errorResult.hint && (
            <text style={{ fg: theme.warning, marginTop: 1 }}>
              💡 {errorResult.hint}
            </text>
          )}
        </box>
      </box>

      <Separator width={width} widthOffset={4} />
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <Button
          onClick={onBack}
          onMouseOver={() => setBackButtonHovered(true)}
          onMouseOut={() => setBackButtonHovered(false)}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: theme.border,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={backButtonHovered ? theme.foreground : theme.secondary}>
              TRY AGAIN
            </span>
          </text>
        </Button>
        <Button
          onClick={onClose}
          onMouseOver={() => setCloseButtonHovered(true)}
          onMouseOut={() => setCloseButtonHovered(false)}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: theme.border,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={closeButtonHovered ? theme.foreground : theme.secondary}>
              CLOSE
            </span>
          </text>
        </Button>
      </box>
    </>
  )
}
