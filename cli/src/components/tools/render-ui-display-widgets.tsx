import { TextAttributes } from '@opentui/core'
import { memo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { glyph } from '../../utils/glyphs'
import { phaseMapping, statusMapping } from '../savant-ui/echo/phase-info'
import {
  resolveThemeColor,
  type ThemeColorKey,
} from '../savant-ui/icon-theme-keys'

import type {
  BadgeWidgetData,
  CardWidgetData,
  PerfectionLoopWidgetData,
  StepperWidgetData,
  TableWidgetData,
} from './render-ui-widget-types'

// ---- Table widget ----------------------------------------------------------

export const TableWidget = memo(({ widget }: { widget: TableWidgetData }) => {
  const theme = useTheme()
  const COL_W = 15

  return (
    <box flexDirection="column">
      {widget.title && (
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          {widget.title}
        </text>
      )}
      <box flexDirection="row" gap={2}>
        {widget.columns.map((col) => (
          <text key={col.key} attributes={TextAttributes.BOLD} fg={theme.muted}>
            {col.label.padEnd(COL_W)}
          </text>
        ))}
      </box>
      {widget.rows.map((row, i) => (
        <box key={i} flexDirection="row" gap={2}>
          {widget.columns.map((col) => (
            <text key={col.key} fg={theme.foreground}>
              {String(row[col.key] ?? '').padEnd(COL_W)}
            </text>
          ))}
        </box>
      ))}
    </box>
  )
})
TableWidget.displayName = 'TableWidget'

// ---- Card widget (for FID summaries) ---------------------------------------

/**
 * FID-033c Phase C: severity → ThemeColorKey mapping (no hardcoded hex).
 * Sourced from the shared ChatTheme token system, not literal colors.
 */
const SEVERITY_COLOR_KEY: Record<string, ThemeColorKey> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'muted',
}

export const CardWidget = memo(({ widget }: { widget: CardWidgetData }) => {
  const theme = useTheme()
  const severityColor = resolveThemeColor(
    theme,
    widget.severity
      ? (SEVERITY_COLOR_KEY[widget.severity] ?? 'muted')
      : 'muted',
  )

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" gap={1}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {widget.title}
        </text>
        {widget.severity && <text fg={severityColor}>[{widget.severity}]</text>}
        {widget.status && <text fg={theme.muted}>({widget.status})</text>}
      </box>
      <text fg={theme.foreground}>{widget.summary}</text>
      {widget.body && <text fg={theme.muted}>{widget.body}</text>}
    </box>
  )
})
CardWidget.displayName = 'CardWidget'

// ---- Stepper widget --------------------------------------------------------

/**
 * FID-033c Phase C: uses shared `statusMapping()` + `glyph()` from Phase B
 * (Law 13 — eliminates the duplicate STEP_STATUS_ICONS hex table that
 * previously existed here AND in stepper.tsx).
 */
export const StepperWidget = memo(
  ({ widget }: { widget: StepperWidgetData }) => {
    const theme = useTheme()
    const resolved = widget.steps.map((s, i) => ({
      ...s,
      status: s.status ?? (i === widget.current ? 'active' : 'pending'),
    }))

    return (
      <box flexDirection="row" alignItems="center">
        {resolved.map((step, i) => {
          const statusInfo = statusMapping(step.status)
          const color = resolveThemeColor(theme, statusInfo.colorKey)
          const icon = glyph(statusInfo.glyph)
          const isLast = i === resolved.length - 1
          return (
            <box key={i} flexDirection="row">
              {!isLast && <text fg={theme.muted}> ── </text>}
              <text fg={color}>
                {icon} {step.label}
              </text>
            </box>
          )
        })}
      </box>
    )
  },
)
StepperWidget.displayName = 'StepperWidget'

// ---- Badge widget ----------------------------------------------------------

/**
 * FID-033c Phase C: badge variant → ThemeColorKey (no hardcoded hex).
 */
const BADGE_COLOR_KEY: Record<string, ThemeColorKey> = {
  open: 'secondary',
  closed: 'success',
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'muted',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

export const BadgeWidget = memo(({ widget }: { widget: BadgeWidgetData }) => {
  const theme = useTheme()
  const color = resolveThemeColor(
    theme,
    BADGE_COLOR_KEY[widget.variant ?? 'info'] ?? 'muted',
  )
  return <text fg={color}>[{widget.text}]</text>
})
BadgeWidget.displayName = 'BadgeWidget'

// ---- Perfection Loop widget ------------------------------------------------

const PL_PHASES = [
  'idle',
  'red',
  'green',
  'audit',
  'self_correct',
  'complete',
] as const

/**
 * FID-033c Phase C: uses shared `phaseMapping()` + `glyph()` from Phase B
 * (Law 13 — eliminates the duplicate PL_PHASE_COLORS hex table that was a
 * copy of the phaseMapping colorKey values).
 */
export const PerfectionLoopWidget = memo(
  ({ widget }: { widget: PerfectionLoopWidgetData }) => {
    const theme = useTheme()
    const phaseIndex = PL_PHASES.indexOf(
      widget.phase as (typeof PL_PHASES)[number],
    )
    const iter = widget.iteration ?? 0
    const maxIter = widget.maxIterations ?? 10
    const filled = Math.round((iter / maxIter) * 15)

    return (
      <box flexDirection="column">
        <box flexDirection="row" alignItems="center">
          {PL_PHASES.map((p, i) => {
            const isActive = p === widget.phase
            const isPast = i < phaseIndex
            const phaseInfo = phaseMapping(p)
            const color = isActive
              ? resolveThemeColor(theme, phaseInfo.colorKey)
              : isPast
                ? theme.primary
                : theme.muted
            const icon = isActive
              ? glyph('phaseActive')
              : isPast
                ? glyph('phaseComplete')
                : glyph('phaseIdle')
            return (
              <box key={p} flexDirection="row">
                {i > 0 && <text fg={theme.muted}> ── </text>}
                <text fg={color}>
                  {icon} {p.toUpperCase()}
                </text>
              </box>
            )
          })}
        </box>
        <text fg={theme.muted}>
          {`iterations ${'█'.repeat(filled)}${'░'.repeat(15 - filled)} ${iter}/${maxIter}`}
        </text>
        {widget.fidName && (
          <text fg={theme.primary}>FID: {widget.fidName}</text>
        )}
      </box>
    )
  },
)
PerfectionLoopWidget.displayName = 'PerfectionLoopWidget'
