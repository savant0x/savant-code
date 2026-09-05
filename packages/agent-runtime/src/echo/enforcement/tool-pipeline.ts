import {
  extractPaths,
  getTargetPath,
  getTier,
  isFidFile,
  isPreReadAllowed,
  isTerminalTool,
  isWriteTool,
  terminalCommandCandidates,
} from './helpers'
import { detectsVerificationCommand } from '../../util/echo-compliance'
import { canonicalizePath } from '../path-canonicalization'
import { runPreWriteGates } from '../pre-write-gates'

import type { EnforcementResult } from '../types'
import type { EnforcementSelf } from './self'

/**
 * beforeToolCall pipeline (FID-2026-0819-005 Loop 303: extracted verbatim
 * from `echo/enforcement.ts`; `this.` → `self.`, stateless predicates now
 * imported from `./helpers`).
 */
export function beforeToolCallImpl(
  self: EnforcementSelf,
  toolName: string,
  input: Record<string, unknown>,
  agentId: string,
  /** FID-2026-0822-004: the agent's assistant TEXT so far in this step —
   *  threaded to the P5b YAGNI gate (text channel). */
  assistantText?: string,
  /** FID-2026-0822-004: `yagni.enforced: false` disables the P5b gate. */
  yagniEnforced?: boolean,
): EnforcementResult {
  const tier = getTier(self.mode)

  // FID-2026-0810-002 Change 3: session-init protocol gate — UNIVERSAL.
  // No longer gated on strict mode (`tier === 'all_15'` removed). Until the
  // governing protocol file has been read 0-EOF, only read-only context
  // tools, intent logging, and clarification are allowed — in every mode.
  // The gate is armed via `gateArmed` (boot contract resolved); it is never
  // seeded for the main agent, and the read always succeeds (local file or
  // embedded bundle), so the ritual is real everywhere. The gate clears when
  // a read targets the protocol file (normalized path match).
  if (!self.state.protocolRead && self.gateArmed) {
    if (self.isGroundingReadCall(toolName, input)) {
      self.groundingReadPending = true
      if (!self.agentState) {
        self.state.protocolRead = true
      }
    } else if (
      !isPreReadAllowed(toolName) &&
      !(self.groundingReadPending && isTerminalTool(toolName))
    ) {
      return {
        blocked: true,
        reason: `Must read ${self.requiredProtocolFile} 0-EOF before using tools`,
        warnings: [],
        // FID-2026-0901-002: this gate self-heals — the agent reads the
        // protocol and retries within the same turn. Surface the block to
        // the agent via steering only; a visible error chunk in the
        // transcript reads as a crash to the operator.
        silent: true,
      }
    } else if (self.groundingReadPending && isTerminalTool(toolName)) {
      // Native streams can announce a terminal tool before the preceding
      // grounding handler settles. Let the handler finish; completion
      // enforcement still fails closed if the read later errors.
      self.groundingReadPending = false
    }
  }

  // Track reads for Law 1
  if (toolName === 'read_files' || toolName === 'read_subtree') {
    const paths = extractPaths(input)
    for (const p of paths) {
      // FID-2026-0823-009: store the canonical form so raw-string
      // membership matches writes arriving in any path spelling.
      self.state.filesRead.add(canonicalizePath(p))
    }
  }

  // Track searches for Law 7
  if (
    toolName === 'glob' ||
    toolName === 'code_search' ||
    toolName === 'list_directory' ||
    toolName === 'detective' ||
    toolName === 'scout'
  ) {
    self.state.hasSearchedSinceGreen = true
  }

  // Track intent logging for Law 8
  if (toolName === 'write_todos' || toolName === 'ask_user') {
    self.state.intentLogged = true
  }

  // Track FID file writes
  const targetPath = getTargetPath(input)
  if (
    (toolName === 'write_file' || toolName === 'str_replace') &&
    targetPath != null &&
    isFidFile(targetPath)
  ) {
    self.state.fidFilesWritten.add(targetPath)
  }

  // Run pre-write gates for write tools
  if (isWriteTool(toolName)) {
    const result = runPreWriteGates({
      toolName: toolName,
      input: input,
      agentId: agentId,
      state: self.state,
      mode: self.mode,
      tier,
      // FID-2026-0822-004: thread the text channel + enforced flag to the
      // P5b YAGNI gate so it fires on the Forge's prompted emission point.
      assistantText: assistantText,
      yagniEnforced: yagniEnforced,
    })

    // Any advisory attached to a gate result (Law 7/8) also becomes
    // corrective steering — the tool executor drains it via
    // takeSteeringMessages() and injects it into the agent's history.
    if (result.warnings.length > 0) {
      self.pendingSteering.push(...result.warnings)
    }

    if (result.blocked) {
      return result
    }

    if (result.warnings.length > 0) {
      self.logger.logBatch(result.warnings)
      self.state.advisoryWarnings.push(...result.warnings)
    }
    // Return the warnings so the tool executor can emit them as
    // compliance_warning receipts (the state.advisoryWarnings copy above
    // remains the internal audit trail). Previously they were swallowed,
    // making the executor's advisory emission unreachable.
    return { blocked: false, warnings: result.warnings }
  }

  return { blocked: false, warnings: [] }
}

/**
 * afterToolCall pipeline (same extraction contract as beforeToolCallImpl).
 */
export function afterToolCallImpl(
  self: EnforcementSelf,
  toolName: string,
  input: Record<string, unknown>,
  result: { text?: string; error?: string },
  writtenContent?: string,
  writeSucceeded?: boolean,
): EnforcementResult {
  // Record only successful writes. The exact post-write payload is kept in a
  // bounded per-path ledger so turn-end scanners never reread unrelated disk
  // changes and can distinguish an empty file from unavailable content.
  if (isWriteTool(toolName)) {
    const path = getTargetPath(input)
    if (path && writeSucceeded !== false) {
      self.state.filesWritten.add(path)
      self.state.dirtyFiles.add(path)
      // A fresh modification revokes any prior verification credit for
      // this file (FID-2026-0820-012 AUDIT): the cumulative
      // dirtyFiles-minus-verifiedFiles predicate (pre-write gate and
      // turn-end Law 15) must re-arm for re-modified files, or a
      // verified-then-edited file would keep its stale credit and never
      // block again.
      self.state.verifiedFiles.delete(path)
      self.state.hasVerifiedSinceLastDirty = false
      self.state.writeCount++

      if (writtenContent !== undefined) {
        self.state.writtenFileContent.set(path, writtenContent)
      } else {
        self.state.writtenFileContent.delete(path)
      }

      // Check for export statements (Law 4 wiring)
      const content =
        writtenContent ??
        (input.content as string) ??
        (input.newString as string) ??
        ''
      if (/export\s+(default\s+)?/.test(content)) {
        self.state.featuresWired.add(path)
      }
    }
  }

  // Track verification commands for Law 3 (cumulative — FID-2026-0819-001).
  // Handles both terminal command types (RED-003) via the shared detector.
  if (
    toolName === 'run_terminal_command' ||
    toolName === 'run_readonly_command'
  ) {
    const verified = terminalCommandCandidates(input).some(
      detectsVerificationCommand,
    )
    if (verified) {
      for (const f of self.state.dirtyFiles) {
        self.state.verifiedFiles.add(f)
      }
    }
  }

  // Track grep/search for Law 4 (call-graph verification).
  // run_readonly_command is included: it is the Orchestrator's
  // always-available read-only shell. RED-003 added both terminal types
  // for Law 3 but missed this Law 4 path, deadlocking hybrid sessions
  // whose only direct shell could never credit featuresVerified.
  if (
    toolName === 'code_search' ||
    toolName === 'run_terminal_command' ||
    toolName === 'run_readonly_command'
  ) {
    const pattern = (input.pattern as string) ?? ''
    const grepHit = terminalCommandCandidates(input).some(
      (cmd) => cmd.includes('grep') || cmd.includes('find'),
    )
    if (pattern.includes('grep') || grepHit) {
      for (const wired of self.state.featuresWired) {
        self.state.featuresVerified.add(wired)
      }
    }
  }

  return { blocked: false, warnings: [] }
}
