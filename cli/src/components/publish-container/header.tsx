import { pluralize } from '@savant-code/common/util/string'
import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'

import type { PublishStep } from '../../state/publish-store'

/** Publish header: step title on the left, [x] close affordance on the right. */
export const PublishHeader: React.FC<{
  currentStep: PublishStep
  selectedAgentCount: number
  onCancel: () => void
}> = ({ currentStep, selectedAgentCount, onCancel }) => {
  const theme = useTheme()
  const [closeButtonHovered, setCloseButtonHovered] = useState(false)
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 1,
      }}
    >
      <text style={{ wrapMode: 'none', marginLeft: 1, marginRight: 1 }}>
        <span fg={theme.secondary}>
          {currentStep === 'selection' &&
            (selectedAgentCount > 0
              ? `Selected ${pluralize(selectedAgentCount, 'agent')} to publish`
              : 'Select agents to publish')}
          {currentStep === 'confirmation' && 'Confirm publish'}
          {currentStep === 'success' && 'Publish complete'}
          {currentStep === 'error' && 'Publish failed'}
        </span>
      </text>
      <box
        style={{ paddingRight: 1 }}
        onMouseDown={onCancel}
        onMouseOver={() => setCloseButtonHovered(true)}
        onMouseOut={() => setCloseButtonHovered(false)}
      >
        <text style={{ wrapMode: 'none' }} selectable={false}>
          <span fg={closeButtonHovered ? theme.foreground : theme.secondary}>
            [x]
          </span>
        </text>
      </box>
    </box>
  )
}
