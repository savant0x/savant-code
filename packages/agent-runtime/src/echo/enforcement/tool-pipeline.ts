import {
  classifyMutation,
  extractPaths,
  getTargetPath,
  getTier,
  isFidFile,
  isPreReadAllowed,
  isTerminalTool,
  isWriteTool,
} from './helpers'
import {
  classifyFileKind,
  hasWiringDeclaration,
} from '../../util/echo-compliance-core'
import { canonicalizePath } from '../path-canonicalization'
import { runPreWriteGates } from '../pre-write-gates'
import { noteCompliantIntervening } from './escalation'
import { mirrorReadIntoLedger } from './read-ledger'
import {
  creditCallGraphSearch,
  creditVerificationRun,
} from './verification-credit'
import { maybeCaptureWorktreeBaseline } from './worktree-capture'

import type { EnforcementResult } from '../types'
import type { EnforcementSelf } from './self'

/**
 * beforeToolCall pipeline (FID-2026-0819-005 Loop 303: extracted from
 * `echo/enforcement.ts`; `this.` → `self.`, stateless predicates in
 * `./helpers`).
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
  /** FID-2026-0927-003 F2: the caller's current Perfection Loop phase. */
  fsmPhase?: string,
): EnforcementResult {
  const tier = getTier(self.mode)

  // FID-2026-1001-003 step 2: lazy worktree-baseline capture on the first
  // call that can reach the worktree (write-path tools, or any call the
  // step-1 classifier marks mutating — the first call being `sed -i` needs
  // its baseline BEFORE it fires). No checkpoint (SDK embedders) → no-op.
  maybeCaptureWorktreeBaseline(
    self.ensureCheckpoint(),
    toolName,
    process.cwd(),
    input,
  )

  // FID-2026-1001-003 step 1: classify by EFFECT (stash contract: EnforcementState.pendingMutation).
  self.state.pendingMutation = classifyMutation({ toolName, params: input })
  // FID-2026-1001-003 step 4: a compliant read (any law) or verification
  // command (law 3) resets the escalation ladder.
  noteCompliantIntervening({ state: self.state, toolName, input })

  // FID-2026-0810-002 Change 3: session-init protocol gate — UNIVERSAL.
  // No longer gated on strict mode (`tier === 'all_15'` removed). Until the
  // governing protocol file has been read 0-EOF, only read-only context
  // tools, intent logging, and clarification are allowed — in every mode.
  // The gate is armed via `gateArmed` (boot contract resolved); it is never
  // seeded for the main agent, and the read always succeeds (local file or
  // embedded bundle), so the ritual is real everywhere. The gate clears
  // when a read targets the protocol file (normalized path match).
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
        // protocol and retries within the same turn. Surface the block to the
        // agent via steering only; a visible error chunk in the transcript
        // reads as a crash to the operator.
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
      const canonical = canonicalizePath(p)
      self.state.filesRead.add(canonical)
      if (!self.state.filesReadCanonical.has(canonical)) {
        self.state.filesReadCanonical.set(canonical, Date.now())
      }
      // FID-2026-1001-003 step 3: durable read-ledger mirror (./read-ledger)
      // so a session restore hydrates the read set instead of re-blocking
      // Law 1. READS only, never write credit.
      const checkpoint = self.ensureCheckpoint()
      if (checkpoint) mirrorReadIntoLedger(checkpoint, canonical)
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

  // Run pre-write gates for MUTATING calls (FID-2026-1001-003 step 1: by
  // effect — a mutating run_terminal_command now passes through the same
  // gate chain; a mutating terminal call carries no fidFile/fidPaths
  // context and the Law 1 gate consumes the classified targets).
  const mutation = self.state.pendingMutation
  if (mutation?.mutates) {
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
      // FID-2026-0927-003 F2: the Law 3 gate needs the phase so the
      // self_correct repair path can permit the write a red run blocks.
      fsmPhase,
    })

    // Any advisory attached to a gate result (Law 7/8) also becomes
    // corrective steering — the tool executor drains it via
    // takeSteeringMessages() and injects it into the agent's history.
    if (result.warnings.length > 0) {
      self.pendingSteering.push(...result.warnings)
    }

    if (result.blocked) {
      // The command never dispatches — consume the stash now so a later
      // tool call cannot inherit this call's targets (the blocked command
      // mutated nothing).
      self.state.pendingMutation = null
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
  /** FID-2026-0919-015: command outcome when determinable; undefined = unknown. */
  commandSucceeded?: boolean,
  /** FID-2026-0927-003 F2: repo-relative source paths a FAILED verification
   *  run named. Recorded so the Law 3 gate can permit editing the file being
   *  reported — the only legal repair for a red run — without permitting the
   *  masking edit to any other file. */
  verificationFailurePaths?: string[],
): EnforcementResult {
  // FID-2026-0919-015: collect advisories (unknown-outcome verification) for
  // the caller; afterToolCall never blocks, it may only steer.
  const warnings: EnforcementResult['warnings'] = []

  // FID-2026-1001-003 step 1 (consume): a mutating terminal call's targets
  // join the tracking sets exactly as a write tool's would — Law 15's batch
  // predicate and step 2's reconciliation now see the bypass. Consumed and
  // cleared on the same call; tree-scope mutations leave targets empty and
  // defer to the reconciliation. Cleared BEFORE any early return below.
  const mutation = self.state.pendingMutation
  self.state.pendingMutation = null
  if (
    mutation?.mutates &&
    !isWriteTool(toolName) &&
    // A demonstrably FAILED command mutated nothing — never record it.
    commandSucceeded !== false
  ) {
    for (const target of mutation.targets) {
      self.state.filesWritten.add(target)
      self.state.dirtyFiles.add(target)
      // A bypassed file has no verification credit — Law 15 must block
      // until a verification run re-arms for it.
      self.state.verifiedFiles.delete(target)
      self.state.hasVerifiedSinceLastDirty = false
      self.state.writeCount++
    }
    if (mutation.targets.length > 0) {
      self.state.writtenFileContent.delete(mutation.targets[0])
    }
  }

  // Record only successful writes. The exact post-write payload is kept in a
  // bounded per-path ledger so turn-end scanners never reread unrelated disk
  // changes and can distinguish an empty file from unavailable content.
  if (isWriteTool(toolName)) {
    const path = getTargetPath(input)
    if (path && writeSucceeded !== false) {
      self.state.filesWritten.add(path)
      self.state.dirtyFiles.add(path)
      // A fresh modification revokes any prior verification credit for
      // this file (FID-2026-0820-012 AUDIT): the cumulative predicate must
      // re-arm for re-modified files, or a verified-then-edited file would
      // keep its stale credit and never block again.
      self.state.verifiedFiles.delete(path)
      self.state.hasVerifiedSinceLastDirty = false
      self.state.writeCount++

      if (writtenContent !== undefined) {
        self.state.writtenFileContent.set(path, writtenContent)
      } else {
        self.state.writtenFileContent.delete(path)
      }

      // Check for export statements (Law 4 wiring). FID-2026-1001-003
      // step 6: file type AND declaration structure — the raw probe matched
      // `export` inside markdown fences and Law 4 then blocked turn end for
      // a document (row H). Docs verify with lint:md, never Law 4.
      const content =
        writtenContent ??
        (input.content as string) ??
        (input.newString as string) ??
        ''
      if (classifyFileKind(path) === 'code' && hasWiringDeclaration(content)) {
        self.state.featuresWired.add(path)
      }
    }
  }

  // Track verification commands for Law 3 (cumulative — FID-2026-0819-001;
  // outcome-aware — FID-2026-0919-015). Extracted to ./verification-credit.
  creditVerificationRun({
    toolName,
    input,
    state: self.state,
    commandSucceeded,
    verificationFailurePaths,
    warnings,
  })

  // Track grep/search for Law 4 (call-graph verification); extracted to
  // ./verification-credit (RED-003: both terminal types included).
  creditCallGraphSearch({ toolName, input, state: self.state })

  return { blocked: false, warnings }
}
