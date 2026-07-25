import { TextAttributes } from '@opentui/core'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'
import { glyph } from '../../utils/glyphs'
import { safeOpen } from '../../utils/open-url'
import { Button } from '../button'
import { phaseMapping, statusMapping } from '../savant-ui/echo/phase-info'
import { resolveThemeColor, type ThemeColorKey } from '../savant-ui/icon-theme-keys'

import type {
  ToolBlock,
  ToolRenderConfig,
  ToolRenderOptions,
} from './types'
import type { ChatTheme } from '../../types/theme-system'
import type { RenderUIButtonWidget } from '@savant-code/common/tools/params/tool/render-ui'
import type { JSONValue } from '@savant-code/common/types/json'

type RenderUIButtonVariant = NonNullable<RenderUIButtonWidget['variant']>

// ---- Widget types (lightweight subset of the discriminated union) ----------

interface TableWidgetData {
  type: 'table'
  columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>
  rows: Record<string, JSONValue>[]
  title?: string
}

interface CardWidgetData {
  type: 'card'
  title: string
  status?: string
  severity?: string
  summary: string
  body?: string
}

interface StepperWidgetData {
  type: 'stepper'
  steps: Array<{ label: string; status?: 'pending' | 'active' | 'done' | 'error' }>
  current?: number
}

interface BadgeWidgetData {
  type: 'badge'
  variant?:
    | 'open'
    | 'closed'
    | 'critical'
    | 'high'
    | 'medium'
    | 'low'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
  text: string
}

interface PerfectionLoopWidgetData {
  type: 'perfection_loop'
  phase: string
  iteration?: number
  maxIterations?: number
  fidName?: string
}

// ---- Type guards ------------------------------------------------------------

const isRenderUIButtonWidget = (
  widget: unknown,
): widget is RenderUIButtonWidget => {
  if (widget === null || typeof widget !== 'object') {
    return false
  }

  const candidate = widget as Partial<RenderUIButtonWidget>
  return (
    candidate.type === 'button' &&
    typeof candidate.text === 'string' &&
    candidate.text.trim().length > 0 &&
    typeof candidate.link === 'string' &&
    candidate.link.trim().length > 0 &&
    (candidate.variant === undefined ||
      candidate.variant === 'primary' ||
      candidate.variant === 'secondary')
  )
}

const isTableWidget = (w: unknown): w is TableWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'table'
const isCardWidget = (w: unknown): w is CardWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'card'
const isStepperWidget = (w: unknown): w is StepperWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'stepper'
const isBadgeWidget = (w: unknown): w is BadgeWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'badge'
const isPerfectionLoopWidget = (w: unknown): w is PerfectionLoopWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'perfection_loop'

// ---- Button widget (unchanged logic) ---------------------------------------

const getButtonColors = (
  theme: ReturnType<typeof useTheme>,
  variant: RenderUIButtonVariant,
) => {
  const accent = variant === 'secondary' ? theme.secondary : theme.primary
  return {
    backgroundColor: undefined,
    foregroundColor: accent,
    borderColor: accent,
  }
}

const CLICK_FLASH_DURATION_MS = 150

const RenderUIButton = ({ widget }: { widget: RenderUIButtonWidget }) => {
  const theme = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variant = widget.variant ?? 'primary'
  const { backgroundColor, foregroundColor, borderColor } = getButtonColors(
    theme,
    variant,
  )

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  const handleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
    }
    setIsClicked(true)
    safeOpen(widget.link)
    clickTimeoutRef.current = setTimeout(
      () => setIsClicked(false),
      CLICK_FLASH_DURATION_MS,
    )
  }, [widget.link])

  const textAttributes = isClicked
    ? TextAttributes.DIM
    : isHovered
      ? TextAttributes.BOLD | TextAttributes.UNDERLINE
      : TextAttributes.BOLD

  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Button
        onClick={handleClick}
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
        style={{
          backgroundColor,
          borderStyle: 'rounded',
          borderColor,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text>
          <span fg={foregroundColor} attributes={textAttributes}>
            {widget.text}
          </span>
          <span fg={foregroundColor} attributes={textAttributes}>{' ↗'}</span>
        </text>
      </Button>
    </box>
  )
}

// ---- Table widget ----------------------------------------------------------

const TableWidget = memo(({ widget }: { widget: TableWidgetData }) => {
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

const CardWidget = memo(({ widget }: { widget: CardWidgetData }) => {
  const theme = useTheme()
  const severityColor = resolveThemeColor(
    theme,
    widget.severity ? (SEVERITY_COLOR_KEY[widget.severity] ?? 'muted') : 'muted',
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
        {widget.severity && (
          <text fg={severityColor}>[{widget.severity}]</text>
        )}
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
const StepperWidget = memo(({ widget }: { widget: StepperWidgetData }) => {
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
})
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

const BadgeWidget = memo(({ widget }: { widget: BadgeWidgetData }) => {
  const theme = useTheme()
  const color = resolveThemeColor(
    theme,
    BADGE_COLOR_KEY[widget.variant ?? 'info'] ?? 'muted',
  )
  return <text fg={color}>[{widget.text}]</text>
})
BadgeWidget.displayName = 'BadgeWidget'

// ---- Perfection Loop widget ------------------------------------------------

const PL_PHASES = ['idle', 'red', 'green', 'audit', 'self_correct', 'complete'] as const

/**
 * FID-033c Phase C: uses shared `phaseMapping()` + `glyph()` from Phase B
 * (Law 13 — eliminates the duplicate PL_PHASE_COLORS hex table that was a
 * copy of the phaseMapping colorKey values).
 */
const PerfectionLoopWidget = memo(({ widget }: { widget: PerfectionLoopWidgetData }) => {
  const theme = useTheme()
  const phaseIndex = PL_PHASES.indexOf(widget.phase as typeof PL_PHASES[number])
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
      {widget.fidName && <text fg={theme.primary}>FID: {widget.fidName}</text>}
    </box>
  )
})
PerfectionLoopWidget.displayName = 'PerfectionLoopWidget'

// ---- Tool component factory -----------------------------------------------

type RenderUIToolBlock = ToolBlock & { toolName: 'render_ui' }

export const RenderUIComponent = defineToolComponent<'render_ui'>({
  toolName: 'render_ui',

  render(
    toolBlock: RenderUIToolBlock,
    _theme: ChatTheme,
    _options: ToolRenderOptions,
  ): ToolRenderConfig {
    const widget = toolBlock.input?.widget

    if (!widget || typeof widget !== 'object' || !('type' in widget)) {
      return { content: null }
    }

    if (isRenderUIButtonWidget(widget)) {
      return {
        content: <RenderUIButton widget={widget} />,
        collapsedPreview: `${widget.text} -> ${widget.link}`,
      }
    }

    if (isTableWidget(widget)) {
      return {
        content: <TableWidget widget={widget} />,
        collapsedPreview: `table: ${widget.columns.length} cols, ${widget.rows.length} rows`,
      }
    }

    if (isCardWidget(widget)) {
      return {
        content: <CardWidget widget={widget} />,
        collapsedPreview: `${widget.title}: ${widget.summary.slice(0, 40)}`,
      }
    }

    if (isStepperWidget(widget)) {
      return {
        content: <StepperWidget widget={widget} />,
        collapsedPreview: `stepper: ${widget.steps.length} steps`,
      }
    }

    if (isBadgeWidget(widget)) {
      return {
        content: <BadgeWidget widget={widget} />,
        collapsedPreview: `[${widget.text}]`,
      }
    }

    if (isPerfectionLoopWidget(widget)) {
      return {
        content: <PerfectionLoopWidget widget={widget} />,
        collapsedPreview: `Perfection Loop: ${widget.phase}`,
      }
    }

    return { content: null }
  },
})
