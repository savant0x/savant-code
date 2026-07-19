import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { Sparkline } from '../data-display/sparkline'
import { KeyValue, KeyValueItem } from '../data-display/key-value'

export interface CostTrackerProps {
  cost: number
  trend?: number[]
  model?: string
  budget?: number
}

export function CostTracker({ cost, trend, model, budget }: CostTrackerProps) {
  const theme = useTheme()

  const items: KeyValueItem[] = [
    { label: 'cost', value: `$${cost.toFixed(2)}`, color: cost > 1 ? theme.error : theme.foreground },
  ]
  if (model) {
    items.push({ label: 'model', value: model })
  }
  if (budget) {
    const remaining = budget - cost
    items.push({
      label: 'remaining',
      value: `$${remaining.toFixed(2)}`,
      color: remaining < 0 ? theme.error : remaining < budget * 0.2 ? theme.warning : theme.foreground,
    })
  }

  return (
    <box flexDirection="column">
      <KeyValue items={items} labelWidth={10} />
      {trend && trend.length > 1 && (
        <box flexDirection="row" gap={1}>
          <text fg={theme.muted}>{'trend'.padEnd(10)}</text>
          <Sparkline data={trend} color="#18faf9" />
        </box>
      )}
    </box>
  )
}
