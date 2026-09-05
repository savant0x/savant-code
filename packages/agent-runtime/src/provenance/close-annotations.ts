import {
  jcsCanonicalize,
  signPayload,
  type RoleKeypair,
} from '@savant-code/common/crypto'

import { buildVerdictPayload } from './verdict'

import type { JSONValue } from '@savant-code/common/types/json'
import type {
  LedgerEntry,
  ProvenanceEvent,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

// FID-2026-0819-005 Loop 157: the session-close no-verdict annotation
// resolver, extracted from provenance/session.ts. Operates on a minimal
// context interface so behavior is verbatim while the class stays under the
// size ceiling.

export interface CloseAnnotationContext {
  sessionId: string
  mode: 'off' | 'record' | 'enforce'
  receipts: Map<number, TrustReceipt>
  ledger: {
    enqueue: (entry: LedgerEntry) => void
  }
  emit: (event: ProvenanceEvent) => void
  getRoleKey: (role: string) => Promise<RoleKeypair>
  emitNotice: (message: string) => void
}

/**
 * FID-2026-0814-005: honest terminal for receipts that never received an
 * independent Verifier/Adversary verdict. A system-role close annotation is
 * signed onto the ledger per open receipt (documenting the ABSENCE of an
 * audit — never fabricating one) and the receipt status becomes
 * `no_verdict`, which the Trust Matrix renders as a terminal row.
 */
export async function resolveOpenReceiptsAtClose(
  ctx: CloseAnnotationContext,
): Promise<TrustReceipt[]> {
  if (ctx.mode === 'off') return []
  const open = [...ctx.receipts.values()].filter(
    (receipt) => receipt.status === 'pending',
  )
  if (open.length === 0) return []
  let keypair: RoleKeypair
  try {
    keypair = await ctx.getRoleKey('system')
  } catch (error) {
    ctx.emitNotice(
      `close annotation signing unavailable (system role): ${String(error)}`,
    )
    // Honest degradation: without a signing key the annotation cannot be
    // ledgered — leave the receipts pending rather than fake a close.
    return []
  }
  const resolved: TrustReceipt[] = []
  for (const receipt of open) {
    const timestamp = new Date().toISOString()
    const verdictText =
      'No independent verdict — session closed without Verifier/Adversary verdicts'
    const payload = buildVerdictPayload({
      changeHash: receipt.changeHash,
      phase: 'audit',
      agentType: 'system',
      agentId: 'session-close',
      verdictText,
      timestamp,
    })
    const canonical = jcsCanonicalize(payload as unknown as JSONValue)
    const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
    receipt.verdicts.push({
      phase: 'audit',
      agentType: 'system',
      agentId: 'session-close',
      verdictText,
      timestamp,
      over,
      sig,
    })
    receipt.status = 'no_verdict'
    ctx.ledger.enqueue({
      type: 'verdict',
      sessionId: ctx.sessionId,
      seq: receipt.seq,
      phase: 'audit',
      agentType: 'system',
      agentId: 'session-close',
      verdictText,
      timestamp,
      changeHash: receipt.changeHash,
      over,
      sig,
    })
    ctx.emit({
      type: 'verdict_bound',
      sessionId: ctx.sessionId,
      phase: 'audit',
      receipt,
    })
    resolved.push(receipt)
  }
  return resolved
}
