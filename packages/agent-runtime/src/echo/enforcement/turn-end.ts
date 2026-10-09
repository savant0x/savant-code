import { readFileSync } from 'node:fs'

import { runComplianceCapture } from '../../hooks/compliance-capture'
import { classifyFileKind } from '../../util/echo-compliance-core'
import { runDesignContractScanner } from '../design-contract'
import { resetForNewTurn } from '../enforcement-state'
import { advanceWorktreeBaseline } from './worktree-capture'
import { reconcileWorktree } from './worktree-reconcile'
import { evaluateLaw4TurnEnd } from '../law4-turn-end'
import { runPostWriteScanners } from '../post-write-scanners'
import { formatTurnEndReport } from '../violation-handler'
import {
  buildCompletionGateSteering,
  COMPLETION_GATE_DISARM_NOTICE,
  COMPLETION_GATE_MAX_RETRIES,
  getTier,
} from './helpers'

import type { EnforcementResult, EnforcementState } from '../types'
import type { EnforcementSelf } from './self'
import type { GateLayer } from '@savant-code/common/types/telemetry'

/**
 * FID-2026-1007-012 FID 2: emit one turn-end result. Blocks carry the
 * construction-documented law; warnings carry their own law (the type
 * requires it). Results whose blocks lack law attribution (post-write
 * scanners, design-contract scanner) are never routed here — documented
 * boundary, not silent scope.
 */
function emitTurnEndResult(
  rootDir: string | undefined,
  agentId: string,
  result: EnforcementResult,
  blockLaw: number,
  identity: EnforcementState['telemetryIdentity'],
): void {
  if (rootDir === undefined) return
  const layer: GateLayer = 'turn-end'
  if (result.blocked) {
    runComplianceCapture(
      rootDir,
      {
        lawId: blockLaw,
        violationClass: 'rejected',
        gateLayer: layer,
        agentId,
      },
      identity,
    )
  }
  for (const warning of result.warnings) {
    runComplianceCapture(
      rootDir,
      {
        lawId: warning.law,
        violationClass: 'flagged',
        gateLayer: layer,
        agentId,
      },
      identity,
    )
  }
}

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
  // Historical callers without resolved identity retain their agentId proxy.
  const agentId = self.agentState?.agentId ?? ''

  // FID-2026-1001-003 step 6 (livelock backstop): reconcile the wiring ledger
  // against file-kind ground truth before Law 4 reads it. A docs-classified
  // path can never be a wired code feature (afterToolCallImpl now rejects
  // them at registration), so a stale false registration must be evicted here
  // — this path runs even when the turn is blocked, unlike resetForNewTurn,
  // so a false entry can neither wedge turn end nor survive the turn.
  for (const feature of self.state.featuresWired) {
    if (classifyFileKind(feature) !== 'code') {
      self.state.featuresWired.delete(feature)
      self.state.featuresVerified.delete(feature)
    }
  }

  // FID-2026-1001-003 step 2: Law 15 worktree reconciliation — files mutated
  // outside tracked write tools (terminal bypass) are merged into dirtyFiles
  // and block, per the "merge and block" mandate. Runs before the Law 15
  // verdict so merged files join the same batch predicate. Degraded/unverifiable
  // scans are surfaced as diagnostics; the Q5-A ruling makes a degraded scan a
  // loud notice (fail-open on COST, fail-closed on DETECTION when verifiable).
  // Reconcile against the CAPTURE root — the baseline's namespace is
  // `worktreeBaselineRoot` (capture records `process.cwd()` in production, so
  // behavior is identical there); reconciling against any other root diffs
  // the fixture-sized baseline against an unrelated tree.
  const checkpoint = self.ensureCheckpoint()
  // FID-2026-1007-012 FID 2: sink root for observe-only telemetry, derived
  // from the checkpoint this function already computes (production: captured
  // repo root; tests: temp fixture root or absent = silent). Never ambient.
  const telemetryRootDir = checkpoint?.worktreeBaselineRoot
  const reconcile = reconcileWorktree({
    checkpoint,
    repoRoot: checkpoint?.worktreeBaselineRoot ?? process.cwd(),
    dirtyFiles: self.state.dirtyFiles,
  })
  if (reconcile.diagnostic) {
    const reconcileResult: EnforcementResult = {
      blocked: false,
      warnings: [
        {
          law: 15,
          severity: reconcile.unverifiable ? 'warning' : 'info',
          message: reconcile.diagnostic,
        },
      ],
    }
    results.push(reconcileResult)
    emitTurnEndResult(
      telemetryRootDir,
      agentId,
      reconcileResult,
      15,
      self.state.telemetryIdentity,
    )
  }

  // Law 4: call-graph reachability (blocks are law 4 by construction).
  const law4Result = evaluateLaw4TurnEnd({
    state: self.state,
    mode: self.mode,
    tier,
  })
  results.push(law4Result)
  emitTurnEndResult(
    telemetryRootDir,
    agentId,
    law4Result,
    4,
    self.state.telemetryIdentity,
  )

  // Law 15: build stays clean (cumulative — a dirty file is clean once
  // it appears in verifiedFiles; FID-2026-0819-001).
  const unverifiedDirty = [...self.state.dirtyFiles].filter(
    (f) => !self.state.verifiedFiles.has(f),
  )
  if (unverifiedDirty.length > 0) {
    if (tier === 'all_15') {
      const law15Result: EnforcementResult = {
        blocked: true,
        reason: 'Law 15: Files modified without verification (typecheck/lint)',
        warnings: [],
      }
      results.push(law15Result)
      emitTurnEndResult(
        telemetryRootDir,
        agentId,
        law15Result,
        15,
        self.state.telemetryIdentity,
      )
    } else {
      const law15Advisory: EnforcementResult = {
        blocked: false,
        warnings: [
          {
            law: 15,
            severity: 'warning',
            message: 'Files modified without running typecheck/lint',
          },
        ],
      }
      results.push(law15Advisory)
      emitTurnEndResult(
        telemetryRootDir,
        agentId,
        law15Advisory,
        15,
        self.state.telemetryIdentity,
      )
    }
  }

  // FID-2026-1001-003 step 1: terminal-bypass targets (and step-2's
  // reconcile-merged paths) have NO writtenFileContent ledger entry — the
  // bytes were written outside tracked write tools, so demanding ledger
  // content would wedge strict turn end forever, even after a green
  // verification. Fall back to the post-mutation disk content (the only
  // honest source for those paths); an unreadable path stays undefined so
  // the scanners keep failing closed (content-unavailable violation)
  // rather than silently skipping the file.
  const writtenOrDiskContent = (filePath: string): string | undefined => {
    const ledgered = self.state.writtenFileContent.get(filePath)
    if (ledgered !== undefined) return ledgered
    try {
      return readFileSync(filePath, 'utf8')
    } catch {
      return undefined
    }
  }

  // Post-write scanners (Strict mode only)
  if (tier === 'all_15') {
    results.push(
      runPostWriteScanners({
        state: self.state,
        mode: self.mode,
        tier,
        getWrittenFileContent: writtenOrDiskContent,
      }),
    )
  }

  results.push(
    runDesignContractScanner({
      state: self.state,
      mode: self.mode,
      contract: self.designContract,
      getWrittenFileContent: writtenOrDiskContent,
    }),
  )

  const blocked = results.some((r) => r.blocked)
  const report = formatTurnEndReport(results)

  // Preserve dirty files and their content when strict enforcement blocks the
  // turn so the next loop iteration can repair the violation and re-evaluate
  // the same evidence. Only a completed turn starts a fresh batch.
  if (!blocked) {
    // FID-2026-1001-003 step 2: advance the durable baseline over the paths
    // this session has VERIFICATION CREDIT for, so later turns never re-flag
    // accounted content. Verified — not the whole dirty batch — because in
    // hybrid mode an unverified (advisory-only) terminal mutation must stay
    // outside the baseline and re-surface next turn, never be silently
    // absorbed. A blocked turn leaves the baseline frozen so the same
    // evidence re-evaluates next iteration. The advance root MUST be the
    // baseline's own captured root — the same authority reconciliation uses
    // above (FID-2026-1002-005): the baseline's namespace is
    // `worktreeBaselineRoot`, and advancing against any other root (e.g. a
    // cwd that moved to a different project mid-session) silently skips
    // every verified path and re-flags them next turn.
    advanceWorktreeBaseline({
      checkpoint,
      repoRoot: checkpoint?.worktreeBaselineRoot ?? process.cwd(),
      paths: [...self.state.verifiedFiles],
    })
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
