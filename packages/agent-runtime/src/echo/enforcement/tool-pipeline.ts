import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

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
import { canonicalizePath } from '../path-canonicalization'
import { runPreWriteGates } from '../pre-write-gates'
import { noteCompliantIntervening } from './escalation'
import { mirrorReadIntoLedger } from './read-ledger'
import { evaluateSettledStateCheck } from './vacuous-verifier'
import {
  creditCallGraphSearch,
  creditVerificationRun,
} from './verification-credit'
import { maybeCaptureWorktreeBaseline } from './worktree-capture'
import { recordAfterToolMutationBookkeeping } from './write-bookkeeping-pipeline'

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
  const settled = evaluateSettledStateCheck({
    state: self.state,
    toolName,
    input: safeToJSONValue(input),
  })
  if (settled.reason) {
    const warning = {
      law: 3,
      severity: 'warning' as const,
      message: settled.reason,
    }
    self.pendingSteering.push(warning)
    self.state.advisoryWarnings.push(warning)
    if (settled.status === 'block')
      return { blocked: true, reason: settled.reason, warnings: [warning] }
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

  // Track FID file writes (FID-2026-1013-010 W1-1: includes apply_patch)
  const targetPath = getTargetPath(input)
  if (isWriteTool(toolName) && targetPath != null && isFidFile(targetPath)) {
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

  const mutation = self.state.pendingMutation
  self.state.pendingMutation = null
  recordAfterToolMutationBookkeeping({
    state: self.state,
    toolName,
    input,
    mutation,
    writtenContent,
    writeSucceeded,
    commandSucceeded,
  })

  // Track verification commands for Law 3 (cumulative — FID-2026-0819-001;
  // outcome-aware — FID-2026-0919-015). Extracted to ./verification-credit.
  creditVerificationRun({
    toolName,
    input,
    state: self.state,
    commandSucceeded,
    verificationFailurePaths,
    warnings,
    commandOutputText: result.text,
    agentId: self.agentState?.agentId,
  })

  // Track grep/search for Law 4 (call-graph verification); extracted to
  // ./verification-credit (RED-003: both terminal types included).
  creditCallGraphSearch({ toolName, input, state: self.state })

  return { blocked: false, warnings }
}
