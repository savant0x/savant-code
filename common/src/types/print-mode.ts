import z from 'zod/v4'

import { jsonValueSchema } from './json'
import { toolResultOutputSchema } from './messages/content-part'
import {
  printModeApprovalRequestSchema,
  printModeCompactionStatusSchema,
  printModeCompactionSummarySchema,
  printModeFidQueueUpdateSchema,
  printModeProvenanceReceiptSchema,
} from './print-mode-gateway'

import type {
  ComplianceSeverity,
  ComplianceWarningLaw,
} from './echo-compliance'

// FID-2026-0819-005 Loop 149: the gateway-era event schemas live in
// ./print-mode-gateway and are re-exported here — the public surface of
// this module (including the discriminated union below) is unchanged.
export {
  printModeApprovalRequestSchema,
  printModeCompactionStatusSchema,
  printModeCompactionSummarySchema,
  printModeFidQueueUpdateSchema,
  printModeProvenanceReceiptSchema,
} from './print-mode-gateway'
export type {
  PrintModeApprovalRequest,
  PrintModeCompactionStatus,
  PrintModeCompactionSummary,
  PrintModeFidQueueUpdate,
  PrintModeProvenanceReceipt,
} from './print-mode-gateway'

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
// FID-2026-0822-012 U7 drive-by fix: the five `kind` discriminators were
// previously spread from raw const VALUES (`kind: 'idle' as const`), which
// zod v4 rejects lazily — any parse through the enclosing union threw
// "Invalid element at key \"kind\": expected a Zod schema". They are proper
// z.literal schemas now; the inferred types are unchanged.
export const printModeActivitySchema = z.object({
  type: z.literal('activity'),
  activity: z.union([
    z.object({ kind: z.literal('idle'), since: z.number() }),
    z.object({
      kind: z.literal('thinking'),
      startedAt: z.number(),
      model: z.string().optional(),
    }),
    z.object({
      kind: z.literal('tool'),
      toolName: z.string(),
      startedAt: z.number(),
      target: z.string().optional(),
    }),
    z.object({
      kind: z.literal('subagent'),
      agentType: z.string(),
      startedAt: z.number(),
      prompt: z.string().optional(),
    }),
    z.object({
      kind: z.literal('researching'),
      query: z.string(),
      startedAt: z.number(),
      source: z.enum(['web', 'docs']),
    }),
  ]),
  agentId: z.string().optional(),
  parentAgentId: z.string().optional(),
})
export type PrintModeActivity = z.infer<typeof printModeActivitySchema>

// FID-2026-0804-009 — harness ECHO compliance receipt. Emitted at write time
// (law1), at step boundaries (law3 / verifier_criteria / fid), and by the EHEL
// enforcement layer for its pre-write advisories (law7 / law8). Always
// non-blocking; the CLI renders it as a muted transcript line.
export const printModeComplianceWarningSchema = z.object({
  type: z.literal('compliance_warning'),
  law: z.union([
    z.enum(['law1', 'law3', 'verifier_criteria', 'fid', 'design_contract']),
    z.string().regex(/^law\d+$/, 'law must be lawN (e.g. law7/law8)'),
  ]),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  path: z.string().optional(),
  fidId: z.string().optional(),
  stepNumber: z.number().optional(),
})
export type PrintModeComplianceWarning = z.infer<
  typeof printModeComplianceWarningSchema
> & {
  law: ComplianceWarningLaw | 'design_contract'
  severity: ComplianceSeverity
}

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

  printModeComplianceWarningSchema,
  printModeProvenanceReceiptSchema,

  printModeApprovalRequestSchema,
  printModeFidQueueUpdateSchema,
  printModeCompactionStatusSchema,
  printModeCompactionSummarySchema,
])

export type PrintModeEvent = z.infer<typeof printModeEventSchema>
