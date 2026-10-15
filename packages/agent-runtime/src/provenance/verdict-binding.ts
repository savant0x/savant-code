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

// FID-2026-0819-005 Loop 165: the verdict-binding engine, extracted from
// provenance/session.ts. Operates on a minimal context interface (same
// pattern as close-annotations.ts) so behavior is verbatim while the class
// stays under the size ceiling.

export interface VerdictBindingContext {
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
 * FID-2026-0813-004 D4: bind an independent verdict (audit or adversarial)
 * onto every pending receipt whose chain of custody it covers. Each receipt
 * receives one signed verdict entry; receipts carrying both audit and
 * adversarial verdicts transition to `complete` status, which the Trust
 * Matrix renders as fully verified.
 */
export async function bindVerdicts(
  ctx: VerdictBindingContext,
  params: {
    phase: 'audit' | 'adversarial'
    agentId: string
    agentType: string
    verdictText: string
  },
): Promise<TrustReceipt[]> {
  if (ctx.mode === 'off') return []
  const { phase, agentId, agentType, verdictText } = params
  if (verdictText.trim().length === 0) return []
  const pending = [...ctx.receipts.values()].filter(
    (receipt) => !receipt.verdicts.some((v) => v.phase === phase),
  )
  if (pending.length === 0) return []
  let keypair: RoleKeypair
  try {
    keypair = await ctx.getRoleKey(agentType)
  } catch (error) {
    ctx.emitNotice(
      `verdict signing unavailable for ${agentType}: ${String(error)}`,
    )
    return []
  }
  for (const receipt of pending) {
    const timestamp = new Date().toISOString()
    const payload = buildVerdictPayload({
      changeHash: receipt.changeHash,
      phase,
      agentType,
      agentId,
      verdictText,
      timestamp,
    })
    const canonical = jcsCanonicalize(payload as unknown as JSONValue)
    const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
    receipt.verdicts.push({
      phase,
      agentType,
      agentId,
      verdictText,
      timestamp,
      over,
      sig,
    })
    const hasAudit = receipt.verdicts.some((v) => v.phase === 'audit')
    const hasAdversarial = receipt.verdicts.some(
      (v) => v.phase === 'adversarial',
    )
    if (hasAudit && hasAdversarial) {
      receipt.status = 'complete'
    }
    ctx.ledger.enqueue({
      type: 'verdict',
      sessionId: ctx.sessionId,
      seq: receipt.seq,
      phase,
      agentType,
      agentId,
      verdictText,
      timestamp,
      changeHash: receipt.changeHash,
      over,
      sig,
    })
    ctx.emit({
      type: 'verdict_bound',
      sessionId: ctx.sessionId,
      phase,
      receipt,
    })
  }
  return pending
}
