import { TextAttributes } from '@opentui/core'
import { useCallback, useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { Button } from '../button'

import type { SuggestedFollowup } from '../../types/store'

export const EMPTY_CLICKED_SET = new Set<number>()

interface PastFollowupItemProps {
  followup: SuggestedFollowup
  isClicked: boolean
}

const PastFollowupItem = ({ followup, isClicked }: PastFollowupItemProps) => {
  const theme = useTheme()
  const displayLabel = followup.label || followup.prompt
  const showFullPrompt = followup.label && followup.label !== followup.prompt

  return (
    <box style={{ flexDirection: 'column', marginLeft: 2 }}>
      <text>
        <span fg={isClicked ? theme.success : theme.muted}>
          {isClicked ? '✓' : '→'}
        </span>
        <span fg={isClicked ? theme.muted : theme.foreground}>
          {' '}
          {displayLabel}
        </span>
      </text>
      {showFullPrompt && (
        <text style={{ marginLeft: 2 }}>
          <span fg={theme.muted} attributes={TextAttributes.ITALIC}>
            {followup.prompt}
          </span>
        </text>
      )}
    </box>
  )
}

interface PastFollowupsToggleProps {
  toolCallId: string
  followups: SuggestedFollowup[]
}

export const PastFollowupsToggle = ({
  toolCallId,
  followups,
}: PastFollowupsToggleProps) => {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const clickedIndices = useChatStore(
    (state) => state.clickedFollowupsMap.get(toolCallId) ?? EMPTY_CLICKED_SET,
  )

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const toggleIndicator = isExpanded ? '▾' : '▸'

  return (
    <box style={{ flexDirection: 'column' }}>
      <Button onClick={handleToggle}>
        <text>
          <span fg={theme.muted}>{toggleIndicator}</span>
          <span fg={theme.muted} attributes={TextAttributes.ITALIC}>
            {' '}
            Previously suggested followups
          </span>
        </text>
      </Button>
      {isExpanded && (
        <box style={{ flexDirection: 'column', marginTop: 0 }}>
          {followups.map((followup, index) => (
            <PastFollowupItem
              key={`past-followup-${index}`}
              followup={followup}
              isClicked={clickedIndices.has(index)}
            />
          ))}
        </box>
      )}
    </box>
  )
}
