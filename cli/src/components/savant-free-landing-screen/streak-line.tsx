import React from 'react'

import { useTheme } from '../../hooks/use-theme'
import { getSavantFreeStreakLine } from '../../utils/savant-free-streak-line'

/** Inline streak indicator rendered as the line immediately after the
 *  sessions-used/title row. Shows "N day streak" with a week of filled/empty
 *  progress dots; for streak === 0 the row is rendered blank so new / lapsed
 *  users are nudged to start using the product rather than shown an empty
 *  streak (and so the picker doesn't jump once they earn their first day). */
export const StreakInlineLine: React.FC<{
  streak: number
  marginTop: number
}> = ({ streak, marginTop }) => {
  const theme = useTheme()
  const line = getSavantFreeStreakLine(streak)
  if (!line) {
    return <text style={{ marginTop, flexShrink: 0 }}> </text>
  }
  return (
    <text
      style={{
        marginTop,
        flexShrink: 0,
        wrapMode: 'none',
      }}
    >
      <span fg={theme.foreground}>{line.label}</span>
      <span fg={theme.primary}>{`  ${line.dots}`}</span>
    </text>
  )
}
