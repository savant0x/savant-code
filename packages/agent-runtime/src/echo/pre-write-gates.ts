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

import { existsSync } from 'node:fs'

import { isValidSkillName } from '@savant-code/common/constants/skills'
import {
  readSkillFile,
  skillCanonicalDir,
} from '@savant-code/common/util/skill-management'

import { canonicalizePath } from './path-canonicalization'
import { runFidGates } from './pre-write-gates-fid'
import { runLaw3Gate } from './pre-write-gates-law3'
import { runYagniPreWriteGate } from './yagni-pre-write-gate'

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
}): EnforcementResult {
  if (!isWriteTool(params.toolName)) {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const targetPath = getTargetPath(params.toolName, params.input)

  // ── Law 1: Read 0-EOF Before Touch ──────────────────────────────────
  // New files are exempt: a path that does not exist on disk cannot have
  // been read, so Law 1 cannot apply to it (matches the documented contract
  // "Path must be in filesRead (or be a new file)"). FID-2026-0823-007
  // (operator directive 2026-0823): Laws 1-4 are immutable process laws and
  // BLOCK in every execution mode — the former core_4 inertness (deferring
  // to tracker advisories) is revoked, and the existsSync new-file probe
  // now runs in both tiers instead of only under `tier === 'all_15'`.
  // FID-2026-0823-007 (operator directive 2026-0823): Laws 1-4 are immutable
  // process laws and BLOCK in every execution mode — the former core_4
  // inertness (deferring to tracker advisories) is revoked; the existsSync
  // new-file probe now runs in both tiers.
  //
  // No exempt-path carve-out exists for Law 1 by design: isExemptWritePath
  // belongs to the Law 3 gate only, so UPDATING an existing dev/fids|nova|
  // scratchpad file requires a prior tracked read_files/read_subtree call;
  // CREATEs stay exempt via isNewFile.
  //
  // Duplicate-receipt safety: recordWrite (native.ts:444) sits AFTER these
  // gates on the dispatch path, so a blocked write never produces a tracker
  // law1 receipt and a passing write had a tracked read — no double-report.
  // FID-2026-0823-009: reads may be registered under ANY path spelling
  // (raw relative pre-fix entries, canonicalized post-fix) while writes can
  // arrive absolutized by SDK-side resolution. Compare canonical forms on
  // both sides so one registered read satisfies any spelling of the same
  // file. The raw-equality fast path keeps the common case allocation-free.
  let wasRead = false
  if (targetPath && params.state.filesRead.size > 0) {
    const targetCanonical = canonicalizePath(targetPath)
    for (const registered of params.state.filesRead) {
      if (
        registered === targetPath ||
        canonicalizePath(registered) === targetCanonical
      ) {
        wasRead = true
        break
      }
    }
  }
  if (targetPath && !wasRead && !isNewFile(targetPath)) {
    const msg = `Law 1: Read 0-EOF before touch — "${targetPath}" has not been read`
    return { blocked: true, reason: msg, warnings }
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
      return { blocked: true, reason: immutableReason, warnings }
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
  const law3Result = runLaw3Gate({
    targetPath,
    state: params.state,
    warnings,
  })
  if (law3Result.blocked) {
    return { blocked: true, reason: law3Result.reason, warnings }
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
    return yagniResult
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
    return fidResult
  }

  return { blocked: false, warnings }
}

/**
 * A path that does not exist on disk is a brand-new file — Law 1 cannot
 * require reading a file that has not been created yet.
 */
function isNewFile(path: string): boolean {
  try {
    return !existsSync(path)
  } catch {
    // Defensive: on stat failure treat as an existing file. Worst case the
    // gate blocks in every mode (FID-2026-0823-007); recovery is one
    // read_files call.
    return false
  }
}

/** Detect if a tool call writes to the filesystem. */
function isWriteTool(toolName: string): boolean {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}

/** Extract the target file path from a write tool's input. */
function getTargetPath(
  toolName: string,
  input: Record<string, unknown>,
): string | undefined {
  if (typeof input.path === 'string') return input.path
  // apply_patch nests the target under `operation.path`
  // (sdk/src/tools/apply-patch.ts). Without this branch every apply_patch
  // call resolved an undefined target and silently bypassed the Law 1/7
  // gates and the FID gate (FID-2026-0820-014 EC-2) — while
  // enforcement.ts's own getTargetPath tracked the write as dirty.
  const operation = input.operation
  if (operation && typeof operation === 'object') {
    const path = (operation as Record<string, unknown>).path
    if (typeof path === 'string') return path
  }
  return undefined
}
