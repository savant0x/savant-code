import z from 'zod/v4'

import { jsonValueSchema } from '../../../types/json'
import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'render_ui'
const endsAgentStep = false

const buttonLinkSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'https:' || url.protocol === 'http:'
      } catch {
        return false
      }
    },
    { message: 'Button links must use http:// or https://' },
  )

const buttonWidgetSchema = z.object({
  type: z
    .literal('button')
    .describe('Widget type. Currently, the only supported widget is button.'),
  text: z
    .string()
    .min(1)
    .max(80)
    .describe('Short button label shown to the user.'),
  link: buttonLinkSchema.describe(
    'The http:// or https:// URL to open when the user clicks the button.',
  ),
  variant: z
    .enum(['primary', 'secondary'])
    .optional()
    .default('primary')
    .describe(
      'Theme-aware color treatment. Use primary for the main action and secondary for lower-emphasis actions.',
    ),
})

export type RenderUIButtonWidget = z.infer<typeof buttonWidgetSchema>

// Table widget
const tableColumnSchema = z.object({
  key: z.string().describe('Column data key'),
  label: z.string().describe('Column header label'),
  align: z.enum(['left', 'center', 'right']).optional().default('left'),
})

const tableWidgetSchema = z.object({
  type: z.literal('table'),
  columns: z.array(tableColumnSchema).describe('Column definitions'),
  rows: z
    .array(z.record(z.string(), jsonValueSchema))
    .describe('Row data objects keyed by column key'),
  title: z.string().optional().describe('Optional table title'),
})

export type RenderUITableWidget = z.infer<typeof tableWidgetSchema>

// Card widget (for FID summaries)
const cardWidgetSchema = z.object({
  type: z.literal('card'),
  title: z.string().describe('Card title'),
  status: z.string().optional().describe('Status text (e.g. open, closed)'),
  severity: z
    .string()
    .optional()
    .describe('Severity (critical, high, medium, low)'),
  summary: z.string().describe('Short summary text'),
  body: z.string().optional().describe('Optional longer body text'),
})

export type RenderUICardWidget = z.infer<typeof cardWidgetSchema>

// Stepper widget (for Perfection Loop phases)
const stepperStepSchema = z.object({
  label: z.string().describe('Step label'),
  status: z
    .enum(['pending', 'active', 'done', 'error'])
    .optional()
    .default('pending'),
})

const stepperWidgetSchema = z.object({
  type: z.literal('stepper'),
  steps: z.array(stepperStepSchema).describe('Step definitions'),
  current: z.number().int().min(0).optional().describe('Current step index'),
})

export type RenderUIStepperWidget = z.infer<typeof stepperWidgetSchema>

// Badge widget
const badgeWidgetSchema = z.object({
  type: z.literal('badge'),
  variant: z
    .enum([
      'open',
      'closed',
      'critical',
      'high',
      'medium',
      'low',
      'info',
      'success',
      'warning',
      'error',
    ])
    .optional()
    .default('info'),
  text: z.string().describe('Badge text'),
})

export type RenderUIBadgeWidget = z.infer<typeof badgeWidgetSchema>

// Perfection Loop widget
const perfectionLoopWidgetSchema = z.object({
  type: z.literal('perfection_loop'),
  phase: z
    .string()
    .describe(
      'Current FSM phase (idle, red, green, audit, self_correct, complete)',
    ),
  iteration: z.number().int().optional().describe('Current iteration count'),
  maxIterations: z
    .number()
    .int()
    .optional()
    .default(10)
    .describe('Max iterations'),
  fidName: z.string().optional().describe('Associated FID name'),
})

export type RenderUIPerfectionLoopWidget = z.infer<
  typeof perfectionLoopWidgetSchema
>

const widgetSchema = z.discriminatedUnion('type', [
  buttonWidgetSchema,
  tableWidgetSchema,
  cardWidgetSchema,
  stepperWidgetSchema,
  badgeWidgetSchema,
  perfectionLoopWidgetSchema,
])

const inputSchema = z
  .object({
    widget: widgetSchema.describe('The UI widget to render.'),
  })
  .describe(
    'Render a visual UI widget in the Savant CLI. Supports buttons, tables, cards, steppers, badges, and perfection loop visualizations.',
  )

const outputSchema = z.object({
  message: z.string(),
})

const description = `
Render a visual UI widget in the Savant CLI.

Supported widgets:
- button: clickable button with text and an http(s) link
- table: structured data grid with columns and rows
- card: summary card with title, status, severity, and summary (for FIDs)
- stepper: multi-step progress indicator (for Perfection Loop phases)
- badge: colored status tag (open, closed, critical, high, medium, low)
- perfection_loop: Perfection Loop FSM visualization with phase and iteration

Use tables for FID lists, issue catalogs, and agent rosters.
Use cards for FID summaries.
Use steppers for Perfection Loop phase visualization.
Use badges for status indicators.
Use perfection_loop for real-time FSM phase feedback.

${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    widget: {
      type: 'button',
      text: 'Open preview',
      link: 'https://example.com/preview',
      variant: 'primary',
    },
  },
  endsAgentStep,
})}
`.trim()

export const renderUIParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(outputSchema),
} satisfies $ToolParams
