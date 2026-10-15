/**
 * @module hooks/deny-mutating-terminal
 *
 * FID-2026-1001-003 step 1 — defence-in-depth builtin hook action
 * ("Operator decides whether to ship it" — shipped under the operator's
 * 2026-10-02 "complete all work" directive). Declared in
 * `protocol.config.yaml` as a `PreToolUse` hook matched on
 * `run_terminal_command`; it categorically DENIES worktree-mutating terminal
 * commands BEFORE dispatch — the mitigation that narrows the live hole while
 * the classifier-gated pre-write chain (the fix) does the enforcement.
 *
 * - The SAME effect classifier as the pre-write gates decides (Law 13):
 *   `echo/enforcement/helpers.ts → classifyMutation`. The hook must never
 *   grow a divergent copy of the mutation vocabulary.
 * - Fail-open by construction: the sink is pure; any throw is caught by
 *   `engine.ts → triggerBlock` and ALLOWED (a mitigation must never take
 *   the session down).
 * - Non-mutating commands (verification runs, searches, `git status`) pass
 *   untouched — the verification-escape and credit paths are unaffected.
 */

import { classifyMutation } from '../echo/enforcement/helpers'

import type { HookInputData, HookRunResult } from './types'

export function runDenyMutatingTerminal(input: HookInputData): HookRunResult {
  const toolName = input.tool_name
  if (
    toolName !== 'run_terminal_command' &&
    toolName !== 'run_readonly_command'
  ) {
    // The config matcher routes terminal tools here; anything else passes.
    return { outcome: 'allowed' }
  }
  const classification = classifyMutation({
    toolName,
    params: input.tool_input,
  })
  if (!classification.mutates) {
    return { outcome: 'allowed' }
  }
  return {
    outcome: 'blocked',
    reason:
      'Defence-in-depth hook (FID-2026-1001-003 step 1): this terminal command ' +
      'mutates the worktree and is denied before dispatch. Use the write tools ' +
      '(write_file / str_replace / apply_patch) for file mutations; read-only ' +
      'and verification commands are unaffected.',
  }
}
