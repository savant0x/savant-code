import { TextAttributes } from '@opentui/core'
import { pluralize } from '@savant-code/common/util/string'
import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'
import { PublishConfirmation } from '../publish-confirmation'
import { Separator } from '../separator'

import type { LocalAgentInfo } from '../../utils/local-agent-registry'

/** Confirmation step: review selection + dependents, then Back or Publish. */
export const ConfirmationStep: React.FC<{
  width: number
  selectedAgents: LocalAgentInfo[]
  agents: LocalAgentInfo[]
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>
  includeDependents: boolean
  isPublishing: boolean
  publishAgentCount: number
  onToggleDependents: () => void
  onBack: () => void
  onPublish: () => void
}> = ({
  width,
  selectedAgents,
  agents,
  agentDefinitions,
  includeDependents,
  isPublishing,
  publishAgentCount,
  onToggleDependents,
  onBack,
  onPublish,
}) => {
  const theme = useTheme()
  const [backButtonHovered, setBackButtonHovered] = useState(false)
  const [publishButtonHovered, setPublishButtonHovered] = useState(false)
  return (
    <>
      <Separator width={width} widthOffset={4} />
      <box style={{ paddingTop: 1, paddingBottom: 1 }}>
        <PublishConfirmation
          selectedAgents={selectedAgents}
          allAgents={agents}
          agentDefinitions={agentDefinitions}
          includeDependents={includeDependents}
          onToggleDependents={onToggleDependents}
        />
      </box>

      {/* Footer with Back and Publish buttons */}
      <Separator width={width} widthOffset={4} />
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
          gap: 2,
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
              BACK
            </span>
          </text>
        </Button>
        <Button
          onClick={onPublish}
          onMouseOver={() => setPublishButtonHovered(true)}
          onMouseOut={() => setPublishButtonHovered(false)}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: isPublishing ? theme.border : theme.success,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text
            style={{ wrapMode: 'none' }}
            attributes={isPublishing ? TextAttributes.DIM : undefined}
          >
            <span
              fg={
                isPublishing
                  ? theme.muted
                  : publishButtonHovered
                    ? theme.success
                    : theme.foreground
              }
            >
              {isPublishing
                ? 'PUBLISHING...'
                : `PUBLISH ${pluralize(publishAgentCount, 'AGENT')}`}
            </span>
          </text>
        </Button>
      </box>
    </>
  )
}
