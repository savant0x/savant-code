import z from 'zod/v4'

import { jsonValueSchema } from './json'

import type { TrustReceipt } from './provenance'

// FID-2026-0819-005 Loop 149: gateway-era PrintModeEvent members, extracted
// verbatim from print-mode.ts. These are the only genuinely-new members of
// the family since FID-2026-0820-008 (every other design-doc event maps onto
// a shipped printMode* schema); they live here so the core transcript
// schemas stay in print-mode.ts. Re-exported from print-mode.ts — the
// public surface is unchanged.

// FID-2026-0820-008 — desktop session gateway events. The gateway streams
// these over the localhost WebSocket; they are the only genuinely-new members
// of the PrintModeEvent family (every other design-doc event maps onto a
// shipped printMode* schema).
export const printModeApprovalRequestSchema = z.object({
  type: z.literal('approval_request'),
  approvalId: z.string(),
  requestType: z.enum(['diff', 'plan', 'deferral']),
  content: jsonValueSchema,
})
export type PrintModeApprovalRequest = z.infer<
  typeof printModeApprovalRequestSchema
>

// FID-2026-0825-009: scoped FID lifecycle amendment. `projectId` is a
// stable non-path identity supplied by the gateway so fleet consumers can
// aggregate while project consumers can filter without guessing ownership.
export const printModeFidQueueUpdateSchema = z.object({
  type: z.literal('fid_update'),
  fidId: z.string(),
  projectId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  status: z.enum([
    'created',
    'analyzed',
    'fixed',
    'verified',
    'converged',
    'closed',
  ]),
})
export type PrintModeFidQueueUpdate = z.infer<
  typeof printModeFidQueueUpdateSchema
>

// FID-2026-0820-010 Step 7 amendment: runtime compaction lifecycle status
// crosses the same PrintModeEvent wire used by the desktop gateway. The
// payload is a snapshot, not a command; consumers may render it without
// mutating runtime state.
export const printModeCompactionStatusSchema = z.object({
  type: z.literal('compaction_status'),
  phase: z.enum([
    'idle',
    'compacting',
    'compacted',
    'pruned',
    'warning',
    'ineffective',
    'blocked',
  ]),
  percentUsed: z.number().optional(),
  // FID-2026-0901-006 P4: absolute token accounting so a UI can render a
  // real window tracker ("84k / 200k") instead of deriving one from the
  // percent. Optional — older emitters stay wire-compatible.
  contextTokens: z.number().optional(),
  windowTokens: z.number().optional(),
  tokensSaved: z.number().optional(),
  blockReason: z
    .enum([
      'circuit-breaker-open',
      'cooldown',
      'escalation-hold',
      'pruner-unavailable',
      'compaction-disabled',
    ])
    .optional(),
})
export type PrintModeCompactionStatus = z.infer<
  typeof printModeCompactionStatusSchema
>

// FID-2026-0828-001: post-compaction summary output (the OpenClaw
// `isCompactionNotice` analog). Emitted once by the spawn boundary when a
// real context-pruner compaction completes (removedMessages > 0), carrying
// the pruner's summary of the window + the removal metrics. Consumers render
// it as a dedicated transcript block; unknown-event consumers ignore it.
export const printModeCompactionSummarySchema = z.object({
  type: z.literal('compaction_summary'),
  summary: z.string().min(1),
  removedMessages: z.number().int().nonnegative(),
  tokensSaved: z.number().int().nonnegative().optional(),
  percentUsed: z.number().optional(),
})
export type PrintModeCompactionSummary = z.infer<
  typeof printModeCompactionSummarySchema
>

// FID-2026-0813-009 — read-only ZTAP event. The receipt is the signed record;
// a display event without one is deliberately dropped by the matrix reducer.
// FID-2026-0814-005: `no_verdict` joins the terminal vocabulary — the honest
// close state for a session that ended without an independent audit.
export const printModeProvenanceReceiptSchema = z.object({
  type: z.literal('provenance_receipt'),
  sessionId: z.string(),
  seq: z.number().int().positive(),
  phase: z.enum(['write', 'audit', 'adversarial', 'supersession']),
  status: z.enum(['pending', 'complete', 'superseded', 'no_verdict']),
  signed: z.boolean(),
  receipt: z.custom<TrustReceipt>().optional(),
  verdictText: z.string().optional(),
})
export type PrintModeProvenanceReceipt = z.infer<
  typeof printModeProvenanceReceiptSchema
>
