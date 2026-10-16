/**
 * @module echo/pre-write-gates
 *
 * Pre-write enforcement gates for the ECHO Harness Enforcement Layer.
 * Runs BEFORE tool execution. Checks Laws 1, 3, 7, 8 and the FID
 * Recorder gate.
 *
 * - Law 1: Path must be in filesRead (or be a new file)
 * - Law 3: re-editing a dirty-unverified file blocks; OTHER files' pending
 *   verification is advisory (FID-2026-0918-005 two-part rule — the old
 *   any-file hard block deadlocked interlocked multi-file batches; turn-end
 *   Law 15 preserves the no-unverified-exit invariant)
 * - Law 7 (Strict): hasSearchedSinceGreen before writing a new file
 * - Law 8 (Strict): intentLogged before first write
 * - FID gate: Orchestrator → FID > 100 lines → route through Recorder
 *   (operator directive 2026-08-23: hybrid escalation threshold raised
 *   from 20 to 100 — anything above 100 lines needs the Recorder)
 * - P5b YAGNI gate (FID-2026-0806-003): Forge writes that declare
 *   speculative scope (`yagni_check.isSpeculative`) are blocked unless a
 *   documented `ponytail:` debt marker was recorded. Safe-by-construction
 *   exemptions (trust boundary / error path / type safety — Law 6/14) never
 *   trip the gate. See packages/agent-runtime/src/yagni-ladder.ts.
 */

import { isValidSkillName } from '@savant-code/common/constants/skills'
import {
  readSkillFile,
  skillCanonicalDir,
} from '@savant-code/common/util/skill-management'

import { runComplianceCapture } from '../hooks/compliance-capture'
import { recordLawBlock } from './enforcement/escalation'
import {
  getTargetPath,
  isWriteTool,
  terminalCommandCandidates,
} from './enforcement/helpers'
import { canonicalizePath } from './path-canonicalization'
import { runFidGates } from './pre-write-gates-fid'
import { runLaw1Gate } from './pre-write-gates-law1'
import { runLaw2Gate } from './pre-write-gates-law2'
import { runLaw3Gate } from './pre-write-gates-law3'
import { runScopeDispositionGate } from './scope-disposition-guard'
import { runYagniPreWriteGate } from './yagni-pre-write-gate'
import { detectsVerificationCommand } from '../util/echo-compliance'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/**
 * FID-2026-0824-012 — block raw writes to any file under an `immutable:
 * true` skill's directory (live or quarantine). Returns the block reason or
 * null when the write is not an immutable-skill target.
 */
function immutableSkillBlockReason(targetPath: string): string | null {
  const canonical = canonicalizePath(targetPath)
  const match = canonical.match(
    /\/\.agents\/skills\/(?:\.quarantine\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\//,
  )
  if (!match) return null
  const name = match[1]
  if (!isValidSkillName(name)) return null
  const live = readSkillFile(skillCanonicalDir(process.cwd(), name))
  if (live?.immutable) {
    return (
      `Immutable skill gate: skill '${name}' declares immutable: true — ` +
      'agent mutations are rejected (operator-only; FID-2026-0824-012 S2-A)'
    )
  }
  return null
}

/** Minimum unanswered questions required in strict mode. */
/**
 * Run all pre-write gates for a tool call.
 *
 * @returns EnforcementResult with `blocked: true` if any gate fails,
 *          or `blocked: false` with advisory warnings for hybrid mode.
 */
export function runPreWriteGates(params: {
  toolName: string
  input: Record<string, unknown>
  agentId: string
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
  /** FID-2026-0822-004: the agent's assistant TEXT so far in this step — the
   *  yagni gate's second extraction channel (payload first, then text). */
  assistantText?: string
  /** FID-2026-0822-004: `yagni.enforced: false` disables the P5b gate. */
  yagniEnforced?: boolean
  /** FID-2026-0927-003 F2: the caller's current Perfection Loop phase,
   *  forwarded to the Law 3 gate's self_correct repair path. */
  fsmPhase?: string
  /** FID-2026-1001-003 step 5a: injectable register path (test seam; the
   *  production default is `${process.cwd()}/SCOPE.md`). */
  scopePath?: string
}): EnforcementResult {
  // FID-2026-1001-003 step 1: the pipeline classifies by EFFECT and routes
  // mutating terminal calls here too (Law 1 consumes the targets below).
  if (!isWriteTool(params.toolName) && params.state.pendingMutation === null) {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const targetPath = getTargetPath(params.input)
  // FID-2026-1007-012 FID 2: single exit funnel for observe-only telemetry.
  // Blocks emit with their construction-known law (absent = unattributed:
  // warnings still emit); warnings emit by own law. Each run returns once,
  // so each observation emits exactly once. Never throws, never blocks.
  const finish = (
    result: EnforcementResult,
    blockLaw?: number,
  ): EnforcementResult => {
    const rootDir = params.state.telemetryRootDir
    if (rootDir !== undefined) {
      if (result.blocked && blockLaw !== undefined) {
        runComplianceCapture(
          rootDir,
          {
            lawId: blockLaw,
            violationClass: 'rejected',
            gateLayer: 'pre-write',
            agentId: params.agentId,
          },
          params.state.telemetryIdentity,
        )
      }
      for (const warning of result.warnings) {
        runComplianceCapture(
          rootDir,
          {
            lawId: warning.law,
            violationClass: 'flagged',
            gateLayer: 'pre-write',
            agentId: params.agentId,
          },
          params.state.telemetryIdentity,
        )
      }
    }
    return result
  }
  // Classified mutation targets (terminal bypass) — Law 1 iterates these.
  const mutationTargets = params.state.pendingMutation?.targets ?? []

  // ── Law 1: Read 0-EOF Before Touch ──────────────────────────────
  // Extracted verbatim to pre-write-gates-law1.ts (FID-2026-1001-003
  // quality-cap decomposition). Laws 1-4 block in every mode/tier
  // (FID-2026-0823-007); the new-file exemption lives with the gate.
  const law1Result = runLaw1Gate({
    targetPath,
    mutationTargets,
    filesRead: params.state.filesRead,
    projectRoot: params.state.telemetryRootDir,
  })
  if (law1Result.blocked) {
    return finish({ blocked: true, reason: law1Result.reason, warnings }, 1)
  }

  // ── Law 2: approved scope (FID-2026-1001-003 step 5a) ────────────
  // The write target AND the classified terminal mutation targets resolve
  // against the register; governance surfaces are gate-level exemptions
  // (operator ruling 2026-10-02); no pattern covering = block, fail-closed.
  const law2Result = runLaw2Gate({
    targets: [targetPath, ...mutationTargets],
    scopePath: params.scopePath,
    allowedWriteGlobs: params.state.allowedWriteGlobs,
  })
  if (law2Result.blocked) {
    return finish({ blocked: true, reason: law2Result.reason, warnings }, 2)
  }

  // ── Immutable skill gate (FID-2026-0824-012 S2-A) ──────────────────
  // Governance/safety/compliance skills declare `immutable: true` in their
  // frontmatter. Raw write tools (write_file/str_replace/apply_patch) to ANY
  // file under such a skill's directory (SKILL.md, references/, versions/,
  // VERSIONS.jsonl) are hard-blocked — the same contract the skill_manage
  // engine enforces in-process, now enforced at the EHEL boundary too
  // (defense in depth; the engine gate cannot be bypassed by a raw write).
  if (targetPath) {
    const immutableReason = immutableSkillBlockReason(targetPath)
    if (immutableReason) {
      return finish({ blocked: true, reason: immutableReason, warnings })
    }
  }

  // ── Law 3: Verify Before Proceed ────────────────────────────────────
  // FID-2026-0918-005: the gate body was extracted verbatim to
  // pre-write-gates-law3.ts with the blocking scope narrowed to the
  // two-part rule (target-dirty hard block, other-dirty advisory). The old
  // any-file hard block deadlocked interlocked multi-file batches: an
  // intermediate broken-typecheck state blocked the very write that would
  // repair it, twice requiring operator turn-ends on 2026-09-18. History:
  // FID-2026-0819-001 (cumulative credit), FID-2026-0820-012
  // (unverified-dirty predicate), FID-2026-0917-002 (docs/code split).
  // Turn-end Law 15 (enforcement/turn-end.ts) still blocks ending a turn
  // with unverified files.
  // FID-2026-1001-003 step 4: the verification-escape predicate — TRUE when
  // the pending call is itself a verification command (write tools carry no
  // command field, so this is false for them). Law 13: the SAME detector the
  // credit path uses, so the gate and the credit cannot disagree.
  const verificationEscape = terminalCommandCandidates(params.input).some(
    detectsVerificationCommand,
  )

  const law3Result = runLaw3Gate({
    targetPath,
    state: params.state,
    warnings,
    // FID-2026-0927-003 F2: without this the param is accepted and dropped,
    // and the self_correct exemption silently never fires.
    fsmPhase: params.fsmPhase,
    verificationEscape,
  })
  if (law3Result.blocked) {
    // FID-2026-1001-003 step 4: every hard block of this key feeds the N=3
    // escalation ladder (tracked separately from the steering budget).
    return finish(
      recordLawBlock({
        state: params.state,
        law: 3,
        toolName: params.toolName,
        targetPath,
        reason: law3Result.reason,
        warnings,
        agentId: params.agentId,
      }),
    )
  }

  // ── P5b YAGNI gate (FID-2026-0806-003) ──────────────────────────────
  // The Forge emits a `yagni_check` JSON block in its write payload BEFORE
  // the code. Validate its shape and verdict: speculative scope without a
  // documented debt marker is a hard block (the research doc's warning —
  // unstructured "write one-liners" drops trust-boundary guards). Exempted
  // domains (Law 6 type safety / Law 14 error paths) never trip the gate.
  const yagniResult = runYagniPreWriteGate({
    ...params,
    targetPath,
  })
  if (yagniResult.blocked) {
    return finish(yagniResult)
  }
  if (yagniResult.warnings.length > 0) {
    warnings.push(...yagniResult.warnings)
  }

  // ── FID Recorder Gate + Anti-Deferral tripwires + extended laws ────
  // FID-2026-0819-005 Loop 250: extracted verbatim to
  // pre-write-gates-fid.ts; null = no gate fired. Advisory warnings are
  // pushed into the same `warnings` array as before.
  const fidResult = runFidGates({
    targetPath,
    input: params.input,
    agentId: params.agentId,
    tier: params.tier,
    state: params.state,
    warnings,
  })
  if (fidResult) {
    return finish(fidResult)
  }

  // ── Scope-disposition gate (FID-2026-0919-024) ─────────────────────
  // No agent-side scope trimming: a write that would add `[OUT-OF-SCOPE]`,
  // `[OPEN-OUT-OF-SCOPE]`, `[DEFERRED]` or an unapproved `deferred::` /
  // `skipped::` marker to a scope surface is blocked here. The same authority
  // backs the `scope.*` checks in validate:repository.
  const scopeResult = runScopeDispositionGate({
    targetPath,
    input: params.input as Record<string, unknown>,
    warnings,
  })
  if (scopeResult) {
    return finish(scopeResult)
  }

  return finish({ blocked: false, warnings })
}
