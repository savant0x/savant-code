import React from 'react'

export interface SpacerProps {
  size?: number
  direction?: 'horizontal' | 'vertical'
}

export function Spacer({ size = 1, direction = 'vertical' }: SpacerProps) {
  if (direction === 'horizontal') {
    return <box width={size} />
  }
  return <box height={size} />
}
