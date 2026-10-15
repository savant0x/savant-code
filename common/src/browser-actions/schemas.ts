import { z } from 'zod/v4'

/**
 * Browser-action schemas, defaults, and response types.
 * (FID-2026-0809-016: extracted from `common/src/browser-actions.ts`.)
 */

export { BROWSER_DEFAULTS } from './defaults'

/**
 * Response schema for browser action results
 */
export const LogSchema = z.object({
  type: z.enum(['error', 'warning', 'info', 'debug', 'verbose']),
  message: z.string(),
  timestamp: z.number(),
  location: z.string().optional(),
  stack: z.string().optional(),
  category: z.string().optional(),
  level: z.number().optional(),
  source: z.enum(['browser', 'tool']).default('tool'),
})

export type Log = z.infer<typeof LogSchema>

export const MetricsSchema = z.object({
  loadTime: z.number(),
  memoryUsage: z.number(),
  jsErrors: z.number(),
  networkErrors: z.number(),
  ttfb: z.number().optional(),
  lcp: z.number().optional(),
  fcp: z.number().optional(),
  domContentLoaded: z.number().optional(),
  sessionDuration: z.number().optional(),
})

export const NetworkEventSchema = z.object({
  url: z.string(),
  method: z.string(),
  status: z.number().optional(),
  errorText: z.string().optional(),
  timestamp: z.number(),
})

export const LogFilterSchema = z.object({
  types: z
    .array(z.enum(['error', 'warning', 'info', 'debug', 'verbose']))
    .optional(),
  minLevel: z.number().optional(),
  categories: z.array(z.string()).optional(),
})

// Required options for each action type
export const RequiredRetryOptionsSchema = z.object({
  maxRetries: z.number(),
  retryDelay: z.number(),
  retryOnErrors: z.array(z.string()),
})

// Optional configurations that can be added to any action
export const OptionalBrowserConfigSchema = z.object({
  timeout: z.number().optional(),
  retryOptions: z
    .object({
      maxRetries: z.number().optional(),
      retryDelay: z.number().optional(),
      retryOnErrors: z.array(z.string()).optional(),
    })
    .optional(),
  logFilter: LogFilterSchema.optional(),
  debug: z.boolean().optional(),
})

// Advanced optional configurations specific to start action
export const OptionalStartConfigSchema = z.object({
  maxConsecutiveErrors: z.number().optional(),
  totalErrorThreshold: z.number().optional(),
})

export type BrowserConfig = z.infer<typeof OptionalBrowserConfigSchema> &
  z.infer<typeof OptionalStartConfigSchema>

// Optional configurations specific to each action type
export const OptionalNavigateConfigSchema = z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0']).optional(),
})

export const OptionalClickConfigSchema = z.object({
  waitForNavigation: z.boolean().optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  // New optional fields for visual verification
  visualVerify: z.boolean().optional(),
  visualThreshold: z.number().min(0).max(1).optional(), // fraction from 0..1
})

export const OptionalTypeConfigSchema = z.object({
  delay: z.number().optional(),
})

export const OptionalScreenshotConfigSchema = z.object({
  fullPage: z.boolean().optional(),
  screenshotCompression: z.enum(['jpeg', 'png']).optional(),
  screenshotCompressionQuality: z.number().optional(),
  compressScreenshotData: z.boolean().optional(),
})

// Maximum size for a single WebSocket message (10MB)
export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024

export const BrowserResponseChunkSchema = z.object({
  id: z.string(),
  total: z.number(),
  index: z.number(),
  data: z.string(), // Base64 encoded chunk
})

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.literal('image/jpeg'),
    data: z.string(),
  }),
})
export type ImageContent = z.infer<typeof ImageContentSchema>

export const BrowserResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  logs: z.array(LogSchema),
  logFilter: LogFilterSchema.optional(),
  networkEvents: z.array(NetworkEventSchema).optional(),
  metrics: MetricsSchema.optional(),
  screenshots: z
    .object({
      pre: ImageContentSchema.optional(),
      post: ImageContentSchema,
    })
    .optional(),
})

// Update action schemas to include retry options
// Required base schemas
export const RequiredBrowserStartActionSchema = z.object({
  type: z.literal('start'),
  url: z.string().url(),
})

// Combined schema
export const BrowserStartActionSchema = RequiredBrowserStartActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalStartConfigSchema)

export const RequiredBrowserNavigateActionSchema = z.object({
  type: z.literal('navigate'),
  url: z.string().url(),
})

export const BrowserNavigateActionSchema =
  RequiredBrowserNavigateActionSchema.merge(OptionalBrowserConfigSchema).merge(
    OptionalNavigateConfigSchema,
  )

const _RangeSchema = z.object({
  min: z.number(),
  max: z.number(),
})

export const RequiredBrowserClickActionSchema = z.object({
  type: z.literal('click'),
  // xRange: RangeSchema,
  // yRange: RangeSchema,
})

export const BrowserClickActionSchema = RequiredBrowserClickActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalClickConfigSchema)

export const RequiredBrowserTypeActionSchema = z.object({
  type: z.literal('type'),
  selector: z.string(),
  text: z.string(),
})

export const BrowserTypeActionSchema = RequiredBrowserTypeActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalTypeConfigSchema)

export const RequiredBrowserScrollActionSchema = z.object({
  type: z.literal('scroll'),
})

export const OptionalScrollConfigSchema = z.object({
  direction: z.enum(['up', 'down']).optional(),
})

export const BrowserScrollActionSchema =
  RequiredBrowserScrollActionSchema.merge(OptionalBrowserConfigSchema).merge(
    OptionalScrollConfigSchema,
  )

export const RequiredBrowserScreenshotActionSchema = z.object({
  type: z.literal('screenshot'),
})

export const BrowserScreenshotActionSchema =
  RequiredBrowserScreenshotActionSchema.merge(
    OptionalBrowserConfigSchema,
  ).merge(OptionalScreenshotConfigSchema)

export const RequiredBrowserStopActionSchema = z.object({
  type: z.literal('stop'),
})
export const BrowserStopActionSchema = RequiredBrowserStopActionSchema.merge(
  OptionalBrowserConfigSchema,
)

// First define the base action schemas without the diagnostic step
const BaseBrowserActionSchema = z.discriminatedUnion('type', [
  BrowserStartActionSchema,
  BrowserNavigateActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserScrollActionSchema,
  BrowserScreenshotActionSchema,
  BrowserStopActionSchema,
])

// Now we can define the diagnostic step schema that references the base actions
export const DiagnosticStepSchema = z.object({
  label: z.string().optional(),
  // The actual browser action to run
  action: BaseBrowserActionSchema,
  // Success conditions to verify after step
  expectedLogs: z.array(z.string()).optional(),
  noJsErrors: z.boolean().optional(),
  noNetworkErrors: z.boolean().optional(),
  customCondition: z.string().optional(),
})

// The 'diagnose' action for multi-step debugging
export const BrowserDiagnoseActionSchema = z.object({
  type: z.literal('diagnose'),
  // Array of steps to run
  steps: z.array(DiagnosticStepSchema),
  // Toggle whether to run all steps automatically or step-by-step
  automated: z.boolean().optional(),
  // Optional maximum steps/time to run
  maxSteps: z.number().optional(),
  sessionTimeoutMs: z.number().optional(),
  // Include optional browser config
  ...OptionalBrowserConfigSchema.shape,
})

// Finally, export the complete schema that includes diagnostic actions
export const BrowserActionSchema = z.discriminatedUnion('type', [
  BrowserStartActionSchema,
  BrowserNavigateActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserScrollActionSchema,
  BrowserScreenshotActionSchema,
  BrowserStopActionSchema,
  BrowserDiagnoseActionSchema,
])

export type BrowserResponse = z.infer<typeof BrowserResponseSchema>
export type BrowserAction = z.infer<typeof BrowserActionSchema>
