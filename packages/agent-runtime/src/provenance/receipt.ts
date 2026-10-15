import type {
  LawCheck,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

/**
 * Build a write-time `pending` receipt (FID-2026-0813-004, master D1).
 *
 * Pure construction — the signature, ledger enqueue, and event emission are
 * the session's job. Keeping the shape here (not inline in the class) makes
 * the immutable write record explicit and independently testable.
 */
export function buildWriteReceipt(params: {
  sessionId: string
  seq: number
  changeHash: string
  path: string
  tool: TrustReceipt['tool']
  fidId: string | null
  lawChecks: LawCheck[]
  failClosed: boolean
  writerAgentId: string
  writerAgentType: string
  fsmPhase: string
  timestamp: string
}): TrustReceipt {
  return {
    schema: 'savant.provenance.receipt.v1',
    sessionId: params.sessionId,
    seq: params.seq,
    status: 'pending',
    changeHash: params.changeHash,
    path: params.path,
    tool: params.tool,
    fidId: params.fidId,
    lawChecks: params.lawChecks,
    failClosed: params.failClosed,
    writer: {
      agentId: params.writerAgentId,
      agentType: params.writerAgentType,
      phase: params.fsmPhase,
    },
    timestamp: params.timestamp,
    signatures: [],
    verdicts: [],
  }
}
