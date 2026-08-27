import { canonicalizePath } from '../../../echo/path-canonicalization'

import type { JSONValue } from '@savant-code/common/types/json'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-0823-008 — Recorder write-required relay guard.
 *
 * The Recorder's contract (its instructionsPrompt) is that every run writes
 * FID files (`dev/fids/**` incl. archive, or `CHANGELOG.md`) or seals via
 * `set_output` — "NEVER return without calling write_file." That contract is
 * prompt text only; the loop terminates on any text turn and the spawn relay
 * reports whatever the run produced, so a read-but-no-write finish relays as
 * a silent pass. This checker inspects the child's message history at the
 * subagent-finish boundary so the relay fails visibly instead of stalling
 * silently (same discipline as the FID-2026-0821-005 A10 relay digest).
 */

/** Allowed write targets per the Recorder's rules (FIDs + CHANGELOG). */
export const RECORDER_ALLOWED_WRITE_TARGETS = [
  'dev/fids/',
  'CHANGELOG.md',
] as const

/**
 * FID-2026-0823-012 ISSUE-D — corrective retries per stalled recorder spawn.
 * Bounded at exactly one: an identical re-spawn reproduces an identical
 * stall, so the single variation channel is a failure-naming corrective
 * suffix; beyond that, escalation belongs to the Orchestrator.
 */
export const RECORDER_STALL_RETRY_LIMIT = 1

export type RecorderOutcome = { ok: true } | { ok: false; reason: string }

/**
 * FID-2026-0823-014 (rev 2): allowed-target matching runs on CANONICAL
 * paths and is CWD-INDEPENDENT.
 *
 * Rev 1 scoped matches to `canonicalizePath('.')` (process.cwd() at module
 * load) — but the CLI's cwd is launch-dependent (`--cwd=cli`, launcher
 * contexts), so every legit absolutized write failed the scoping check in
 * production while repo-root unit tests passed. Rev 2 matches the canonical
 * `/dev/fids/` segment or `/CHANGELOG.md` suffix anywhere in the resolved
 * path: both raw spellings (relative + SDK-absolutized) converge through
 * canonicalizePath regardless of cwd, and the guard remains a relay
 * CLASSIFIER (write enforcement lives in the EHEL exempt-path gates), so a
 * slightly wider suffix match is the correct trade.
 */
function isAllowedWritePath(path: string): boolean {
  const canonical = canonicalizePath(path)
  return (
    canonical.includes('/dev/fids/') || canonical.endsWith('/CHANGELOG.md')
  )
}

/** A tool result is a failure when any JSON part carries an errorMessage. */
function toolResultHasError(message: ToolMessage): boolean {
  for (const part of message.content) {
    if (part.type !== 'json') continue
    const value = part.value
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as Record<string, JSONValue>).errorMessage === 'string'
    ) {
      return true
    }
  }
  return false
}

/**
 * True when the run fulfilled the Recorder's contract: at least one
 * successful write_file to an allowed target, or a set_output call (the
 * scaffold-seal terminal — handleSteps' scaffoldCompleteSignal branch calls
 * set_output only).
 */
export function checkRecorderOutcome(
  messageHistory: Message[],
): RecorderOutcome {
  const allowedWriteCallIds = new Set<string>()
  const successfulAllowedWrites = new Set<string>()
  let sealedOutput = false

  for (const message of messageHistory) {
    if (message.role === 'assistant') {
      for (const part of message.content) {
        if (part.type !== 'tool-call') continue
        if (part.toolName === 'write_file') {
          const path = part.input.path
          if (typeof path === 'string' && isAllowedWritePath(path)) {
            allowedWriteCallIds.add(part.toolCallId)
          }
        } else if (part.toolName === 'set_output') {
          sealedOutput = true
        }
      }
      continue
    }

    if (
      message.role === 'tool' &&
      allowedWriteCallIds.has(message.toolCallId) &&
      !toolResultHasError(message)
    ) {
      successfulAllowedWrites.add(message.toolCallId)
    }
  }

  if (sealedOutput || successfulAllowedWrites.size > 0) {
    return { ok: true }
  }

  return {
    ok: false,
    reason:
      'Recorder stalled: read without write — no successful write_file to ' +
      'dev/fids/** or CHANGELOG.md and no set_output before the run ended.',
  }
}

/**
 * FID-2026-0823-012 ISSUE-D — builds the corrective retry prompt for a
 * stalled recorder run: original prompt verbatim, then a delimited block
 * naming the EXACT relay-guard reason and restating the write-required
 * terminal contract. Pure so the ladder stays unit-testable; the post-run
 * relay guard remains the single outcome authority either way.
 */
export function buildRecorderRetryPrompt(
  originalPrompt: string,
  reason: string,
): string {
  return [
    originalPrompt,
    '',
    '---',
    '',
    `CORRECTIVE RETRY — your previous run FAILED: ${reason}`,
    'This run succeeds ONLY with a successful write_file to dev/fids/** ' +
      'or CHANGELOG.md (or a set_output seal).',
    'If the target must be read first, call read_files and then call ' +
      'write_file IN THE VERY NEXT STEP with the complete updated content.',
    'Never end this run with a text reply — ending without a successful ' +
      'write_file fails identically.',
  ].join('\n')
}