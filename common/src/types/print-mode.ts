import z from 'zod/v4'

import { jsonValueSchema } from './json'
import { toolResultOutputSchema } from './messages/content-part'

export const printModeStartSchema = z.object({
  type: z.literal('start'),
  agentId: z.string().optional(),
  messageHistoryLength: z.number(),
})
export type PrintModeStart = z.infer<typeof printModeStartSchema>

export const printModeErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
})
export type PrintModeError = z.infer<typeof printModeErrorSchema>

export const printModeDownloadStatusSchema = z.object({
  type: z.literal('download'),
  version: z.string(),
  status: z.enum(['complete', 'failed']),
})
export type PrintModeDownloadStatus = z.infer<
  typeof printModeDownloadStatusSchema
>

export const printModeToolCallSchema = z.object({
  type: z.literal('tool_call'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.record(z.string(), jsonValueSchema),
  agentId: z.string().optional(),
  parentAgentId: z.string().optional(),
  includeToolCall: z.boolean().optional(),
})
export type PrintModeToolCall = z.infer<typeof printModeToolCallSchema>

export const printModeToolResultSchema = z.object({
  type: z.literal('tool_result'),
  toolCallId: z.string(),
  toolName: z.string(),
  output: toolResultOutputSchema.array(),
  parentAgentId: z.string().optional(),
})
export type PrintModeToolResult = z.infer<typeof printModeToolResultSchema>

export const printModeTextSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  agentId: z.string().optional(),
})
export type PrintModeText = z.infer<typeof printModeTextSchema>

export const printModeFinishSchema = z.object({
  type: z.literal('finish'),
  agentId: z.string().optional(),
  totalCost: z.number(),
})
export type PrintModeFinish = z.infer<typeof printModeFinishSchema>

export const printModeSubagentStartSchema = z.object({
  type: z.literal('subagent_start'),
  agentId: z.string(),
  agentType: z.string(),
  displayName: z.string(),
  onlyChild: z.boolean(),
  parentAgentId: z.string().optional(),
  params: z.record(z.string(), jsonValueSchema).optional(),
  prompt: z.string().optional(),
})
export type PrintModeSubagentStart = z.infer<
  typeof printModeSubagentStartSchema
>

export const printModeSubagentFinishSchema = z.object({
  type: z.literal('subagent_finish'),
  agentId: z.string(),
  agentType: z.string(),
  displayName: z.string(),
  onlyChild: z.boolean(),
  parentAgentId: z.string().optional(),
  params: z.record(z.string(), jsonValueSchema).optional(),
  prompt: z.string().optional(),
})
export type PrintModeSubagentFinish = z.infer<
  typeof printModeSubagentFinishSchema
>

export const printModeReasoningDeltaSchema = z.object({
  type: z.literal('reasoning_delta'),
  text: z.string(),
  ancestorRunIds: z.string().array(),
  runId: z.string(),
  /** The reasoning agent's stable id (matches subagent_start/subagent_chunk
   *  agentId), so consumers can attribute reasoning to the right agent. */
  agentId: z.string(),
})
export type PrintModeReasoningDelta = z.infer<
  typeof printModeReasoningDeltaSchema
>

// FID-2026-0718-009 — runtime activity indicator (separate from fsmPhase).
// The activity variant below is exported as a discriminated union so the SDK
// handler can narrow `kind` at the type level without a runtime cast.
// Fields marked required match AgentActivity's discriminated union shape;
// optional fields stay optional. The runtime contract is that all writes go
// through `setActivity()` which enforces the strict shape.
const idleShape = { kind: 'idle' as const, since: 0 }
const thinkingShape = { kind: 'thinking' as const, startedAt: 0 }
const toolShape = { kind: 'tool' as const, toolName: '', startedAt: 0 }
const subagentShape = { kind: 'subagent' as const, agentType: '', startedAt: 0 }
const researchingShape = {
  kind: 'researching' as const,
  query: '',
  startedAt: 0,
  source: 'web' as const,
}

export const printModeActivitySchema = z.object({
  type: z.literal('activity'),
  activity: z.union([
    z.object({ ...idleShape, since: z.number() }),
    z.object({
      ...thinkingShape,
      startedAt: z.number(),
      model: z.string().optional(),
    }),
    z.object({
      ...toolShape,
      startedAt: z.number(),
      target: z.string().optional(),
    }),
    z.object({
      ...subagentShape,
      startedAt: z.number(),
      prompt: z.string().optional(),
    }),
    z.object({
      ...researchingShape,
      startedAt: z.number(),
      query: z.string(),
      source: z.enum(['web', 'docs']),
    }),
  ]),
  agentId: z.string().optional(),
  parentAgentId: z.string().optional(),
})
export type PrintModeActivity = z.infer<typeof printModeActivitySchema>

export const printModeEventSchema = z.discriminatedUnion('type', [
  printModeDownloadStatusSchema,
  printModeErrorSchema,
  printModeFinishSchema,
  printModeStartSchema,
  printModeSubagentFinishSchema,
  printModeSubagentStartSchema,
  printModeTextSchema,
  printModeToolCallSchema,
  printModeToolResultSchema,

  printModeReasoningDeltaSchema,

  printModeActivitySchema,
])

export type PrintModeEvent = z.infer<typeof printModeEventSchema>
