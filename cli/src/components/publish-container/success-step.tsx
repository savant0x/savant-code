import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'
import { Separator } from '../separator'

import type { PublishSuccessResult } from '../../state/publish-store'

/** Success step: list the published agents and a Done button. */
export const SuccessStep: React.FC<{
  width: number
  successResult: PublishSuccessResult
  onDone: () => void
}> = ({ width, successResult, onDone }) => {
  const theme = useTheme()
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
          <text style={{ fg: theme.success }}>✓</text>
          <text
            style={{
              fg: theme.foreground,
              attributes: TextAttributes.BOLD,
            }}
          >
            Successfully published {successResult.agents.length} agent
            {successResult.agents.length !== 1 ? 's' : ''}!
          </text>
        </box>

        <box style={{ flexDirection: 'column', gap: 0, paddingLeft: 2 }}>
          {successResult.agents.map((agent) => (
            <box key={agent.id} style={{ flexDirection: 'row', gap: 1 }}>
              <text style={{ fg: theme.muted }}>•</text>
              <text style={{ fg: theme.foreground }}>{agent.displayName}</text>
              <text style={{ fg: theme.secondary }}>
                ({successResult.publisherId}/{agent.id}@{agent.version})
              </text>
            </box>
          ))}
        </box>
      </box>

      <Separator width={width} widthOffset={4} />
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <Button
          onClick={onDone}
          onMouseOver={() => setCloseButtonHovered(true)}
          onMouseOut={() => setCloseButtonHovered(false)}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: theme.success,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={closeButtonHovered ? theme.success : theme.foreground}>
              DONE
            </span>
          </text>
        </Button>
      </box>
    </>
  )
}
