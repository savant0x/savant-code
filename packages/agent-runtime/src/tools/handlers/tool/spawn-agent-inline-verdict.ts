import { getOrCreateProvenance } from '../../../provenance'
import { extractVerdictText } from '../../../provenance/verdict'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

// FID-2026-0819-005 Loop 297: ZTAP verdict receipt binding extracted from
// spawn-agent-inline.ts. The body is the verbatim verifier/adversary block
// (including its FID-2026-0813-004 commentary); only the enclosing
// `if (agentType === 'verifier' || agentType === 'adversary')` remains at
// the call site, and closure references became explicit parameters.

/**
 * Bind a Verifier/Adversary child's verdict to every open provenance receipt
 * of the session as a signed verbatim payload (D7) and stream the receipts to
 * the client. Best-effort: a failed binding never fails the spawn.
 */
export function applyVerdictReceipts({
  agentType,
  childAgentId,
  resultAgentState,
  parentAgentState,
  projectRoot,
  writeToClient,
}: {
  agentType: string
  childAgentId: string
  resultAgentState: AgentState
  parentAgentState: AgentState
  projectRoot: string
  writeToClient: (chunk: string | PrintModeEvent) => void
}): void {
  const verdictText = extractVerdictText(resultAgentState)
  if (verdictText) {
    const provenance = getOrCreateProvenance(parentAgentState, {
      projectRoot,
    })
    void provenance
      .bindVerdict({
        phase: agentType === 'verifier' ? 'audit' : 'adversarial',
        agentId: childAgentId,
        agentType,
        verdictText,
      })
      .then((receipts) => {
        for (const receipt of receipts) {
          writeToClient({
            type: 'provenance_receipt',
            sessionId: receipt.sessionId,
            seq: receipt.seq,
            phase: agentType === 'verifier' ? 'audit' : 'adversarial',
            status: receipt.status,
            signed: receipt.signatures.length > 0,
            receipt,
            verdictText,
          })
        }
      })
      .catch(() => {
        // Best-effort: a failed binding never fails the spawn.
      })
  }
}
