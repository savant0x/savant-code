import { runDesignContractScanner } from '../design-contract'
import { resetForNewTurn } from '../enforcement-state'
import { evaluateLaw4TurnEnd } from '../law4-turn-end'
import { runPostWriteScanners } from '../post-write-scanners'
import { formatTurnEndReport } from '../violation-handler'
import {
  buildCompletionGateSteering,
  COMPLETION_GATE_DISARM_NOTICE,
  COMPLETION_GATE_MAX_RETRIES,
  getTier,
} from './helpers'

import type { EnforcementResult } from '../types'
import type { EnforcementSelf } from './self'

/**
 * Turn-end evaluation (FID-2026-0819-005 Loop 303: extracted verbatim from
 * `echo/enforcement.ts`; `this.` → `self.`).
 */
export function evaluateTurnEndImpl(self: EnforcementSelf): {
  blocked: boolean
  report: string
} {
  const tier = getTier(self.mode)
  const results: EnforcementResult[] = []

  // Law 4: call-graph reachability
  results.push(
    evaluateLaw4TurnEnd({
      state: self.state,
      mode: self.mode,
      tier,
    }),
  )

  // Law 15: build stays clean (cumulative — a dirty file is clean once
  // it appears in verifiedFiles; FID-2026-0819-001).
  const unverifiedDirty = [...self.state.dirtyFiles].filter(
    (f) => !self.state.verifiedFiles.has(f),
  )
  if (unverifiedDirty.length > 0) {
    if (tier === 'all_15') {
      results.push({
        blocked: true,
        reason: 'Law 15: Files modified without verification (typecheck/lint)',
        warnings: [],
      })
    } else {
      results.push({
        blocked: false,
        warnings: [
          {
            law: 15,
            severity: 'warning',
            message: 'Files modified without running typecheck/lint',
          },
        ],
      })
    }
  }

  // Post-write scanners (Strict mode only)
  if (tier === 'all_15') {
    results.push(
      runPostWriteScanners({
        state: self.state,
        mode: self.mode,
        tier,
        getWrittenFileContent: (filePath) =>
          self.state.writtenFileContent.get(filePath),
      }),
    )
  }

  results.push(
    runDesignContractScanner({
      state: self.state,
      mode: self.mode,
      contract: self.designContract,
      getWrittenFileContent: (filePath) =>
        self.state.writtenFileContent.get(filePath),
    }),
  )

  const blocked = results.some((r) => r.blocked)
  const report = formatTurnEndReport(results)

  // Preserve dirty files and their content when strict enforcement blocks the
  // turn so the next loop iteration can repair the violation and re-evaluate
  // the same evidence. Only a completed turn starts a fresh batch.
  if (!blocked) {
    resetForNewTurn(self.state)
    self.state.hasSearchedSinceGreen = false
    self.state.intentLogged = false
  }

  return { blocked, report }
}

export function evaluateUngroundedTurnEndImpl(self: EnforcementSelf): {
  blocked: boolean
  steering?: string
  notice?: string
} {
  if (self.state.protocolRead || !self.gateArmed) {
    return { blocked: false }
  }
  if (self.state.completionGateDisarmed) {
    return { blocked: false }
  }
  self.state.completionGateRetries += 1
  if (self.state.completionGateRetries > COMPLETION_GATE_MAX_RETRIES) {
    self.state.completionGateDisarmed = true
    self.syncCheckpoint()
    return { blocked: false, notice: COMPLETION_GATE_DISARM_NOTICE }
  }
  // FID-2026-0822-003 (stager contract): sync the live retry count on the
  // blocked path too, not only at disarm. The stream stager reads the
  // checkpoint mid-turn to decide whether output staging is still active;
  // without this sync it sees a stale 0 and cannot recognize that the
  // gate's bounded budget is spent.
  self.syncCheckpoint()
  return {
    blocked: true,
    steering: buildCompletionGateSteering(self.requiredProtocolFile),
  }
}
