import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface TimelineEvent {
  time: string
  label: string
  color?: string
}

export interface TimelineProps {
  events: TimelineEvent[]
  maxItems?: number
}

export function Timeline({ events, maxItems }: TimelineProps) {
  const theme = useTheme()
  const display = maxItems ? events.slice(-maxItems) : events

  return (
    <box flexDirection="column" gap={0} focusable={false} selectable={false}>
      {display.map((event, i) => (
        <box
          key={i}
          flexDirection="row"
          gap={1}
          focusable={false}
          selectable={false}
        >
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            {event.time}
          </text>
          <text
            fg={event.color ?? theme.foreground}
            wrapMode="word"
            selectable={false}
          >
            {event.label}
          </text>
        </box>
      ))}
    </box>
  )
}
