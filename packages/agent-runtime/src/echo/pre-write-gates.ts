/**
 * @module echo/pre-write-gates
 *
 * Pre-write enforcement gates for the ECHO Harness Enforcement Layer.
 * Runs BEFORE tool execution. Checks Laws 1, 3, 7, 8 and the FID
 * Recorder gate.
 *
 * - Law 1: Path must be in filesRead (or be a new file)
 * - Law 3: dirtyFiles must be empty OR hasVerifiedSinceLastDirty must be true
 * - Law 7 (Strict): hasSearchedSinceGreen before writing a new file
 * - Law 8 (Strict): intentLogged before first write
 * - FID gate: Orchestrator → FID > 20 lines → route through Recorder
 * - P5b YAGNI gate (FID-2026-0806-003): Forge writes that declare
 *   speculative scope (`yagni_check.isSpeculative`) are blocked unless a
 *   documented `ponytail:` debt marker was recorded. Safe-by-construction
 *   exemptions (trust boundary / error path / type safety — Law 6/14) never
 *   trip the gate. See packages/agent-runtime/src/yagni-ladder.ts.
 */

import { existsSync } from 'node:fs'

import { assessWrite, parseYagniCheckBlock } from '../yagni-ladder'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/** Regex matching FID file paths under dev/fids/. */
const FID_FILE_PATTERN = /dev\/fids\/FID-[\w.-]+\.md$/

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
}): EnforcementResult {
  if (!isWriteTool(params.toolName)) {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const targetPath = getTargetPath(params.toolName, params.input)

  // ── Law 1: Read 0-EOF Before Touch ──────────────────────────────────
  // New files are exempt: a path that does not exist on disk cannot have
  // been read, so Law 1 cannot apply to it (matches the documented contract
  // "Path must be in filesRead (or be a new file)"). In hybrid (core_4)
  // mode the gate is deliberately inert — the non-blocking
  // EchoComplianceTracker (FID-2026-0804-009) records the read-before-write
  // receipt on the tool-executor hot path, and emitting a duplicate warning
  // here would double-report the same violation. This inertness depends on
  // the tracker being attached to agentState (the harness always does so);
  // do not re-enable a hybrid block here without also suppressing the
  // tracker's receipt. Strict (all_15) mode keeps hard enforcement: the
  // write is blocked until the file is read.
  //
  // The `isNewFile` probe is a synchronous `existsSync` (FID-2026-0815-011
  // E-03): it only pays off in strict mode where the block actually fires,
  // so it is gated behind `tier === 'all_15'`. Hybrid mode skips the disk
  // probe entirely — the gate is inert there regardless of its result.
  if (targetPath && !params.state.filesRead.has(targetPath)) {
    if (params.tier === 'all_15' && !isNewFile(targetPath)) {
      const msg = `Law 1: Read 0-EOF before touch — "${targetPath}" has not been read`
      return { blocked: true, reason: msg, warnings }
    }
  }

  // ── Law 3: Verify Before Proceed ────────────────────────────────────
  if (
    params.state.dirtyFiles.size > 0 &&
    !params.state.hasVerifiedSinceLastDirty
  ) {
    const count = params.state.dirtyFiles.size
    const msg =
      `Law 3: Verify before proceeding — ${count} unverified ` +
      `file(s): [${Array.from(params.state.dirtyFiles).join(', ')}]. ` +
      `Run typecheck/lint before more writes.`
    return { blocked: true, reason: msg, warnings }
  }

  // ── P5b YAGNI gate (FID-2026-0806-003) ──────────────────────────────
  // The Forge emits a `yagni_check` JSON block in its write payload BEFORE
  // the code. Validate its shape and verdict: speculative scope without a
  // documented debt marker is a hard block (the research doc's warning —
  // unstructured "write one-liners" drops trust-boundary guards). Exempted
  // domains (Law 6 type safety / Law 14 error paths) never trip the gate.
  const yagniResult = runYagniGate(params)
  if (yagniResult.blocked) {
    return yagniResult
  }
  if (yagniResult.warnings.length > 0) {
    warnings.push(...yagniResult.warnings)
  }

  // ── FID Recorder Gate (narrow) ──────────────────────────────────────
  if (targetPath && FID_FILE_PATTERN.test(targetPath)) {
    const content = params.input.content ?? params.input.newString ?? ''
    const lineCount = countLines(content)

    if (params.agentId === 'orchestrator' && lineCount > 20) {
      const msg =
        `FID gate: "${targetPath}" is ${lineCount} lines ` +
        `(> 20). Route through the Recorder agent.`
      return { blocked: true, reason: msg, warnings }
    }
  }

  // ── Extended laws (Strict mode only) ────────────────────────────────
  if (params.tier === 'all_15') {
    // ── Law 7: Search Before Create ───────────────────────────────────
    if (targetPath && !params.state.filesWritten.has(targetPath)) {
      if (!params.state.hasSearchedSinceGreen) {
        const blocked = params.tier === 'all_15'
        const warning: AdvisoryWarning = {
          law: 7,
          severity: blocked ? 'warning' : 'info',
          message:
            'Law 7: Search for existing code before creating new — ' +
            'no search performed since entering GREEN phase',
          file: targetPath,
        }
        if (blocked) {
          return {
            blocked: true,
            reason: warning.message,
            warnings: [...warnings, warning],
          }
        }
        warnings.push(warning)
      }
    }

    // ── Law 8: Log Intent Before Coding ───────────────────────────────
    if (!params.state.intentLogged && params.state.writeCount === 0) {
      const blocked = params.tier === 'all_15'
      const warning: AdvisoryWarning = {
        law: 8,
        severity: blocked ? 'warning' : 'info',
        message:
          'Law 8: Log intent before coding — no intent logged in ' +
          'session summary or FID before first write',
      }
      if (blocked) {
        return {
          blocked: true,
          reason: warning.message,
          warnings: [...warnings, warning],
        }
      }
      warnings.push(warning)
    }
  }

  return { blocked: false, warnings }
}

/**
 * P5b — YAGNI gate (FID-2026-0806-003).
 *
 * Extracts the Forge's `yagni_check` JSON block from the write input (the
 * block precedes the code inside the `content`/`newString` payload per the
 * Forge prompt), validates it with the ladder module, and blocks speculative
 * writes that lack a documented debt marker. Records the assessment on the
 * enforcement state so the Verifier's YAGNI Assessment can audit it.
 */
function runYagniGate(params: {
  toolName: string
  input: Record<string, unknown>
  agentId: string
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
}): EnforcementResult {
  const { input, state } = params
  // Only gate the Forge (and only its actual write tools). Other agents
  // (Scout/Recorder/Orchestrator writes) are outside the Forge's YAGNI
  // contract.
  if (params.agentId !== 'forge') {
    return { blocked: false, warnings: [] }
  }

  const payload = input.content ?? input.newString ?? ''
  if (typeof payload !== 'string') {
    return { blocked: false, warnings: [] }
  }

  const blockMatch = payload.match(
    /<yagni_check>([\s\S]*?)<\/yagni_check>|<yagni_check\s*\/?>([\s\S]*?)(?:<\/yagni_check>)?$/i,
  )
  if (!blockMatch) {
    // Forge writes without a yagni_check block are a compliance warning, not
    // a hard block — the block is a thinking aid; the code itself is still
    // audited by the Verifier.
    return {
      blocked: false,
      warnings: [
        {
          law: 0,
          severity: 'info',
          message:
            'P5b YAGNI: Forge write without a <yagni_check> block — audit the diff for speculative scope (Verifier YAGNI Assessment).',
          file: getTargetPath(params.toolName, input),
        },
      ],
    }
  }

  const { assessment, reason } = parseYagniCheckBlock(blockMatch[1] ?? '')
  if (reason) {
    return {
      blocked: false,
      warnings: [
        {
          law: 0,
          severity: 'warning',
          message: `P5b YAGNI: malformed yagni_check block (${reason}) — treat as speculative until Verifier assessment.`,
          file: getTargetPath(params.toolName, input),
        },
      ],
    }
  }

  // Record the assessment for the Verifier / analytics.
  state.yagni = {
    ...state.yagni,
    lastAssessment: {
      isSpeculative: assessment.isSpeculative,
      reusedEntities: assessment.reusedEntities,
      debtMarkersInserted: assessment.debtMarkersInserted,
    },
  }

  const verdict = assessWrite({ assessment })
  if (verdict.verdict === 'rejected') {
    state.yagni = {
      ...state.yagni,
      speculativeWritesRejected: state.yagni.speculativeWritesRejected + 1,
    }
    return {
      blocked: true,
      reason: `${verdict.reason} (${getTargetPath(params.toolName, input) ?? params.toolName})`,
      warnings: [],
    }
  }

  return { blocked: false, warnings: [] }
}

/**
 * A path that does not exist on disk is a brand-new file — Law 1 cannot
 * require reading a file that has not been created yet.
 */
function isNewFile(path: string): boolean {
  try {
    return !existsSync(path)
  } catch {
    // Defensive: on stat failure treat as an existing file. Worst case in
    // strict mode the gate blocks; in hybrid mode the tracker's own
    // existsSync (native.ts) fails identically and still emits its receipt.
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
  const raw = input.path
  return typeof raw === 'string' ? raw : undefined
}

/** Count newlines in a string to estimate line count. */
function countLines(content: unknown): number {
  if (typeof content !== 'string') return 0
  return content.split('\n').length
}
