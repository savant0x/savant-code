import type { RenderUIButtonWidget } from '@savant-code/common/tools/params/tool/render-ui'
import type { JSONValue } from '@savant-code/common/types/json'

export type RenderUIButtonVariant = NonNullable<RenderUIButtonWidget['variant']>

// ---- Widget types (lightweight subset of the discriminated union) ----------

export interface TableWidgetData {
  type: 'table'
  columns: Array<{
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
  }>
  rows: Record<string, JSONValue>[]
  title?: string
}

export interface CardWidgetData {
  type: 'card'
  title: string
  status?: string
  severity?: string
  summary: string
  body?: string
}

export interface StepperWidgetData {
  type: 'stepper'
  steps: Array<{
    label: string
    status?: 'pending' | 'active' | 'done' | 'error'
  }>
  current?: number
}

export interface BadgeWidgetData {
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

export interface PerfectionLoopWidgetData {
  type: 'perfection_loop'
  phase: string
  iteration?: number
  maxIterations?: number
  fidName?: string
}

// ---- Type guards ------------------------------------------------------------

export const isRenderUIButtonWidget = (
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

export const isTableWidget = (w: unknown): w is TableWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'table'
export const isCardWidget = (w: unknown): w is CardWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'card'
export const isStepperWidget = (w: unknown): w is StepperWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'stepper'
export const isBadgeWidget = (w: unknown): w is BadgeWidgetData =>
  !!w && typeof w === 'object' && (w as { type?: string }).type === 'badge'
export const isPerfectionLoopWidget = (
  w: unknown,
): w is PerfectionLoopWidgetData =>
  !!w &&
  typeof w === 'object' &&
  (w as { type?: string }).type === 'perfection_loop'
