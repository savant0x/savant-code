import { AdvisoryLogger } from './advisory-logger'
import { runDesignContractScanner } from './design-contract'
import { createEnforcementState, resetForNewTurn } from './enforcement-state'
import {
  createGroundingCheckpoint,
  getRequiredGroundingPaths,
  isAgentGrounded,
  normalizeGroundingPath,
} from './grounding'
import { evaluateLaw4TurnEnd } from './law4-turn-end'
import { runPostWriteScanners } from './post-write-scanners'
import { runPreWriteGates } from './pre-write-gates'
import { buildProtocolRefreshSummary } from './protocol-summary'
import { buildSteeringText, formatTurnEndReport } from './violation-handler'
import { detectsVerificationCommand } from '../util/echo-compliance'

import type {
  AdvisoryWarning,
  EnforcementMode,
  EnforcementResult,
} from './types'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type { AgentState } from '@savant-code/common/types/session-state'

const enforcementInstances = new WeakMap<object, EchoEnforcement>()

export const CONDENSED_REFRESH_USER_TURNS = 5
export const MAX_INTERNAL_STEPS_WITHOUT_REFRESH = 12
export const MAX_ACTIVE_MS_WITHOUT_REFRESH = 600_000

export function resolveEnforcementMode(
  value: AgentState['enforcementMode'],
): EnforcementMode {
  if (value === undefined) return 'hybrid'
  if (value === 'hybrid' || value === 'strict') return value
  throw new Error(`Invalid EHEL enforcement mode: ${String(value)}`)
}

function getTier(mode: EnforcementMode): 'core_4' | 'all_15' {
  return mode === 'strict' ? 'all_15' : 'core_4'
}

/**
 * FID-2026-0810-002 Change 5: hard retry cap for the first-turn completion
 * gate. After this many ungrounded text-only completions, the completion gate
 * disarms for the session with a one-time notice (the tool-level gate stays
 * armed).
 */
export const COMPLETION_GATE_MAX_RETRIES = 3

function buildCompletionGateSteering(protocolFile: string): string {
  return `Session-init grounding required: read \`${protocolFile}\` 0-EOF before ending your turn (also read \`ARCHITECTURE.md\`, \`protocol.config.yaml\`, and \`dev/LEARNINGS.md\`). The harness blocks ungrounded final answers.`
}

const COMPLETION_GATE_DISARM_NOTICE =
  'The session-init grounding gate has been disarmed for this session after repeated attempts; proceeding without the boot reads.'

export interface EchoEnforcementOptions {
  /** Protocol file the session-init gate requires (default `ECHO.md`). */
  protocolFile?: string
  /** Active declarative design contract for visual-write scanning. */
  designContract?: DesignContract
  /** Current serializable state to restore and synchronize. */
  agentState?: AgentState
  /**
   * FID-2026-0806-005: seed the session-init gate as already satisfied.
   * Subagents spawned by a compliant parent inherit the parent's read.
   */
  protocolPreSeeded?: boolean
  /**
   * FID-2026-0810-002 Change 3: arm the session-init gate. Universal — no
   * longer gated on strict mode. The shared factory passes
   * `Boolean(agentState.protocolFile)`, so CLI harness sessions (which always
   * resolve a boot contract) gate in every mode while SDK embedders with no
   * protocol variant keep legacy no-gate behavior. Defaults to true for
   * direct constructions (the historical strict-mode contract).
   */
  gateArmed?: boolean
}

/**
 * Shared enforcement factory (FID-2026-0810-002 Change 4). Creates the
 * main-agent EchoEnforcement instance eagerly at loop start so `protocolRead`
 * state exists before the first step — a text-only first turn can no longer
 * bypass the gate by never triggering lazy construction. Subagents inherit the
 * parent's read via `protocolPreSeeded`; gate arming follows the resolved boot
 * contract (`agentState.protocolFile`), never a seeded bypass.
 */
export function getOrCreateEnforcement(
  agentState: AgentState,
): EchoEnforcement {
  const existing = enforcementInstances.get(agentState)
  if (existing) return existing
  const enforcement = new EchoEnforcement(
    resolveEnforcementMode(agentState.enforcementMode),
    {
      protocolFile: agentState.protocolFile,
      protocolPreSeeded: Boolean(agentState.parentId),
      gateArmed: Boolean(agentState.protocolFile),
      designContract: agentState.designContract,
      agentState,
    },
  )
  enforcementInstances.set(agentState, enforcement)
  return enforcement
}

export class EchoEnforcement {
  private state = createEnforcementState()
  private logger = new AdvisoryLogger()
  private mode: EnforcementMode
  private requiredProtocolFile: string
  private gateArmed: boolean
  private designContract?: DesignContract
  private readonly agentState?: AgentState
  private lastRefreshAtMs: number | null = null
  private lastRefreshTurn = 0
  private lastRefreshEpoch: string | null = null
  private internalStepsSinceRefresh = 0
  private groundingReadPending = false

  // Steering budget (mirrors the tracker's FID-2026-0804-009 budgeting): a
  // blocked pre-write advisory (Law 7/8) collects corrective text that the
  // tool executor injects into the agent's message history so the running
  // agent knows what to do next — bounded, deduped per law+file, so a
  // non-compliant agent is nudged a couple of times, never looped.
  private pendingSteering: AdvisoryWarning[] = []
  private steeredKeys = new Set<string>()
  private steeringCount = 0
  private readonly steeringPerLaw = new Map<number, number>()

  // With the current per-law caps (7:1, 8:1) the practical maximum is two
  // steers per instance; MAX_STEERING_TOTAL is a defensive ceiling should a
  // future advisory law carry a larger per-law budget.
  private static readonly MAX_STEERING_TOTAL = 3
  private static readonly MAX_STEERING_PER_LAW: Record<number, number> = {
    7: 1,
    8: 1,
  }

  constructor(mode: EnforcementMode, options: EchoEnforcementOptions = {}) {
    this.mode = mode
    this.requiredProtocolFile = options.protocolFile ?? 'ECHO.md'
    this.gateArmed = options.gateArmed ?? true
    this.designContract = options.designContract
    this.agentState = options.agentState
    if (this.agentState) {
      const checkpoint = this.agentState.groundingCheckpoint
      if (checkpoint && isAgentGrounded(this.agentState)) {
        this.state.protocolRead = true
        this.state.turnCount = checkpoint.logicalUserTurnCount
        this.lastRefreshAtMs = checkpoint.lastRefreshAtMs ?? null
        this.lastRefreshTurn = checkpoint.lastRefreshTurn ?? 0
        this.lastRefreshEpoch = checkpoint.lastRefreshEpoch ?? null
        this.internalStepsSinceRefresh =
          checkpoint.internalStepsSinceRefresh ?? 0
        this.state.completionGateRetries = checkpoint.completionGateRetries
        this.state.completionGateDisarmed = checkpoint.completionGateDisarmed
      } else if (this.gateArmed) {
        this.agentState.groundingCheckpoint = createGroundingCheckpoint(
          this.agentState,
        )
      }
    }
    // FID-2026-0806-005: subagents inherit the parent's protocol read.
    if (options.protocolPreSeeded === true) {
      this.state.protocolRead = true
    }
  }

  beforeToolCall(params: {
    toolName: string
    input: Record<string, unknown>
    agentId: string
  }): EnforcementResult {
    const tier = getTier(this.mode)

    // FID-2026-0810-002 Change 3: session-init protocol gate — UNIVERSAL.
    // No longer gated on strict mode (`tier === 'all_15'` removed). Until the
    // governing protocol file has been read 0-EOF, only read-only context
    // tools, intent logging, and clarification are allowed — in every mode.
    // The gate is armed via `gateArmed` (boot contract resolved); it is never
    // seeded for the main agent, and the read always succeeds (local file or
    // embedded bundle), so the ritual is real everywhere. The gate clears when
    // a read targets the protocol file (normalized path match).
    if (!this.state.protocolRead && this.gateArmed) {
      if (this.isGroundingReadCall(params.toolName, params.input)) {
        this.groundingReadPending = true
        if (!this.agentState) {
          this.state.protocolRead = true
        }
      } else if (
        !this.isPreReadAllowed(params.toolName) &&
        !(this.groundingReadPending && this.isTerminalTool(params.toolName))
      ) {
        return {
          blocked: true,
          reason: `Must read ${this.requiredProtocolFile} 0-EOF before using tools`,
          warnings: [],
        }
      } else if (
        this.groundingReadPending &&
        this.isTerminalTool(params.toolName)
      ) {
        // Native streams can announce a terminal tool before the preceding
        // grounding handler settles. Let the handler finish; completion
        // enforcement still fails closed if the read later errors.
        this.groundingReadPending = false
      }
    }

    // Track reads for Law 1
    if (
      params.toolName === 'read_files' ||
      params.toolName === 'read_subtree'
    ) {
      const paths = this.extractPaths(params.input)
      for (const p of paths) {
        this.state.filesRead.add(p)
      }
    }

    // Track searches for Law 7
    if (
      params.toolName === 'glob' ||
      params.toolName === 'code_search' ||
      params.toolName === 'list_directory' ||
      params.toolName === 'detective' ||
      params.toolName === 'scout'
    ) {
      this.state.hasSearchedSinceGreen = true
    }

    // Track intent logging for Law 8
    if (params.toolName === 'write_todos' || params.toolName === 'ask_user') {
      this.state.intentLogged = true
    }

    // Track FID file writes
    const targetPath = this.getTargetPath(params.input)
    if (
      (params.toolName === 'write_file' || params.toolName === 'str_replace') &&
      targetPath != null &&
      this.isFidFile(targetPath)
    ) {
      this.state.fidFilesWritten.add(targetPath)
    }

    // Run pre-write gates for write tools
    if (this.isWriteTool(params.toolName)) {
      const result = runPreWriteGates({
        toolName: params.toolName,
        input: params.input,
        agentId: params.agentId,
        state: this.state,
        mode: this.mode,
        tier,
      })

      // Any advisory attached to a gate result (Law 7/8) also becomes
      // corrective steering — the tool executor drains it via
      // takeSteeringMessages() and injects it into the agent's history.
      if (result.warnings.length > 0) {
        this.pendingSteering.push(...result.warnings)
      }

      if (result.blocked) {
        return result
      }

      if (result.warnings.length > 0) {
        this.logger.logBatch(result.warnings)
        this.state.advisoryWarnings.push(...result.warnings)
      }
      // Return the warnings so the tool executor can emit them as
      // compliance_warning receipts (the state.advisoryWarnings copy above
      // remains the internal audit trail). Previously they were swallowed,
      // making the executor's advisory emission unreachable.
      return { blocked: false, warnings: result.warnings }
    }

    return { blocked: false, warnings: [] }
  }

  afterToolCall(params: {
    toolName: string
    input: Record<string, unknown>
    result: { text?: string; error?: string }
    writtenContent?: string
    writeSucceeded?: boolean
  }): EnforcementResult {
    // Record only successful writes. The exact post-write payload is kept in a
    // bounded per-path ledger so turn-end scanners never reread unrelated disk
    // changes and can distinguish an empty file from unavailable content.
    if (this.isWriteTool(params.toolName)) {
      const path = this.getTargetPath(params.input)
      if (path && params.writeSucceeded !== false) {
        this.state.filesWritten.add(path)
        this.state.dirtyFiles.add(path)
        this.state.hasVerifiedSinceLastDirty = false
        this.state.writeCount++

        if (params.writtenContent !== undefined) {
          this.state.writtenFileContent.set(path, params.writtenContent)
        } else {
          this.state.writtenFileContent.delete(path)
        }

        // Check for export statements (Law 4 wiring)
        const content =
          params.writtenContent ??
          (params.input.content as string) ??
          (params.input.newString as string) ??
          ''
        if (/export\s+(default\s+)?/.test(content)) {
          this.state.featuresWired.add(path)
        }
      }
    }

    // Track verification commands for Law 3 (cumulative — FID-2026-0819-001).
    // Handles both terminal command types (RED-003) via the shared detector.
    if (
      params.toolName === 'run_terminal_command' ||
      params.toolName === 'run_readonly_command'
    ) {
      const cmd = (params.input.command as string) ?? ''
      if (detectsVerificationCommand(cmd)) {
        for (const f of this.state.dirtyFiles) {
          this.state.verifiedFiles.add(f)
        }
      }
    }

    // Track grep/search for Law 4 (call-graph verification)
    if (
      params.toolName === 'code_search' ||
      params.toolName === 'run_terminal_command'
    ) {
      const pattern = (params.input.pattern as string) ?? ''
      const cmd = (params.input.command as string) ?? ''
      if (
        pattern.includes('grep') ||
        cmd.includes('grep') ||
        cmd.includes('find')
      ) {
        for (const wired of this.state.featuresWired) {
          this.state.featuresVerified.add(wired)
        }
      }
    }

    return { blocked: false, warnings: [] }
  }

  evaluateTurnEnd(): { blocked: boolean; report: string } {
    const tier = getTier(this.mode)
    const results: EnforcementResult[] = []

    // Law 4: call-graph reachability
    results.push(
      evaluateLaw4TurnEnd({
        state: this.state,
        mode: this.mode,
        tier,
      }),
    )

    // Law 15: build stays clean (cumulative — a dirty file is clean once
    // it appears in verifiedFiles; FID-2026-0819-001).
    const unverifiedDirty = [...this.state.dirtyFiles].filter(
      (f) => !this.state.verifiedFiles.has(f),
    )
    if (unverifiedDirty.length > 0) {
      if (tier === 'all_15') {
        results.push({
          blocked: true,
          reason:
            'Law 15: Files modified without verification (typecheck/lint)',
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
          state: this.state,
          mode: this.mode,
          tier,
          getWrittenFileContent: (filePath) =>
            this.state.writtenFileContent.get(filePath),
        }),
      )
    }

    results.push(
      runDesignContractScanner({
        state: this.state,
        mode: this.mode,
        contract: this.designContract,
        getWrittenFileContent: (filePath) =>
          this.state.writtenFileContent.get(filePath),
      }),
    )

    const blocked = results.some((r) => r.blocked)
    const report = formatTurnEndReport(results)

    // Preserve dirty files and their content when strict enforcement blocks the
    // turn so the next loop iteration can repair the violation and re-evaluate
    // the same evidence. Only a completed turn starts a fresh batch.
    if (!blocked) {
      resetForNewTurn(this.state)
      this.state.hasSearchedSinceGreen = false
      this.state.intentLogged = false
    }

    return { blocked, report }
  }

  /**
   * Advances the bounded internal-step safety backstop. Logical user turns
   * are recorded separately at the outer run boundary.
   */
  onStepBoundary(): { refreshText?: string } {
    this.internalStepsSinceRefresh++
    if (this.agentState?.groundingCheckpoint) {
      this.agentState.groundingCheckpoint.internalStepsSinceRefresh =
        this.internalStepsSinceRefresh
    }
    if (!this.state.protocolRead || !this.gateArmed) return {}

    const checkpoint = this.ensureCheckpoint()
    const now = Date.now()
    const lastRefreshTurn = checkpoint?.lastRefreshTurn ?? this.lastRefreshTurn
    const turnGap = this.state.turnCount - lastRefreshTurn
    const cadenceDue = turnGap >= CONDENSED_REFRESH_USER_TURNS
    const backstopDue =
      this.internalStepsSinceRefresh >= MAX_INTERNAL_STEPS_WITHOUT_REFRESH ||
      (this.lastRefreshAtMs !== null &&
        now - this.lastRefreshAtMs >= MAX_ACTIVE_MS_WITHOUT_REFRESH)
    // Backstop freshness is independent of the five-turn cadence. A single
    // long/tool-heavy logical turn must be able to refresh immediately after a
    // cadence refresh; the epoch below still makes the same trigger idempotent.
    if (!(cadenceDue || backstopDue)) return {}

    const reason = cadenceDue ? 'cadence' : 'backstop'
    const epoch = `${checkpoint?.groundingSetFingerprint ?? 'unknown'}:${this.state.turnCount}:${reason}`
    if (checkpoint?.lastRefreshEpoch === epoch) return {}

    this.internalStepsSinceRefresh = 0
    this.lastRefreshAtMs = now
    this.lastRefreshTurn = this.state.turnCount
    this.lastRefreshEpoch = epoch
    if (checkpoint) {
      checkpoint.lastRefreshTurn = this.state.turnCount
      checkpoint.lastRefreshReason = reason
      checkpoint.lastRefreshEpoch = epoch
      checkpoint.lastRefreshAtMs = now
      checkpoint.internalStepsSinceRefresh = 0
    }
    return { refreshText: buildProtocolRefreshSummary() }
  }

  /** Count one completed logical user turn; internal loop steps do not count. */
  recordLogicalUserTurn(): { refreshText?: string } {
    this.state.turnCount++
    const checkpoint = this.ensureCheckpoint()
    if (checkpoint) {
      checkpoint.logicalUserTurnCount = this.state.turnCount
    }
    return this.onStepBoundary()
  }

  /**
   * Request a refresh for an explicit operator/governance event or a detected
   * contract change. The event is idempotent for the current checkpoint epoch.
   */
  requestGroundingRefresh(
    reason: 'contract-change' | 'explicit' | 'compaction',
  ): { refreshText?: string } {
    if (!this.state.protocolRead || !this.gateArmed) return {}
    const checkpoint = this.ensureCheckpoint()
    const fingerprint = checkpoint?.groundingSetFingerprint ?? 'unknown'
    const epoch = `${fingerprint}:${this.state.turnCount}:${reason}`
    if (
      checkpoint?.lastRefreshEpoch === epoch ||
      this.lastRefreshEpoch === epoch
    ) {
      return {}
    }

    const now = Date.now()
    this.internalStepsSinceRefresh = 0
    this.lastRefreshAtMs = now
    this.lastRefreshTurn = this.state.turnCount
    this.lastRefreshEpoch = epoch
    if (checkpoint) {
      checkpoint.lastRefreshTurn = this.state.turnCount
      checkpoint.lastRefreshReason = reason
      checkpoint.lastRefreshEpoch = epoch
      checkpoint.lastRefreshAtMs = now
      checkpoint.internalStepsSinceRefresh = 0
    }
    return { refreshText: buildProtocolRefreshSummary() }
  }

  /** Record a successful grounding-set read after its handler completed. */
  recordSuccessfulGroundingRead(paths: string[]): void {
    this.groundingReadPending = false
    if (!this.agentState) return
    this.recordGroundingReads(paths)
    if (this.isGroundingComplete()) {
      this.state.protocolRead = true
      this.syncCheckpoint()
    }
  }

  /**
   * FID-2026-0810-002 Change 5: first-turn completion gate. The loop calls
   * this when a MAIN agent would end its turn. While the protocol is unread
   * and the gate is armed, an ungrounded text-only completion is blocked:
   * corrective steering is returned for the loop to inject, and the loop
   * continues so the agent performs the boot reads. After
   * COMPLETION_GATE_MAX_RETRIES the completion gate disarms for the session
   * with a one-time notice (bounded — a model that never reads cannot wedge
   * the session or re-trigger steering on every subsequent message). The
   * tool-level gate (beforeToolCall) remains armed.
   */
  evaluateUngroundedTurnEnd(): {
    blocked: boolean
    steering?: string
    notice?: string
  } {
    if (this.state.protocolRead || !this.gateArmed) {
      return { blocked: false }
    }
    if (this.state.completionGateDisarmed) {
      return { blocked: false }
    }
    this.state.completionGateRetries += 1
    if (this.state.completionGateRetries > COMPLETION_GATE_MAX_RETRIES) {
      this.state.completionGateDisarmed = true
      this.syncCheckpoint()
      return { blocked: false, notice: COMPLETION_GATE_DISARM_NOTICE }
    }
    return {
      blocked: true,
      steering: buildCompletionGateSteering(this.requiredProtocolFile),
    }
  }

  private isGroundingReadCall(
    toolName: string,
    input: Record<string, unknown>,
  ): boolean {
    if (toolName !== 'read_files') {
      return false
    }
    if (!this.agentState) {
      const target = normalizeGroundingPath(this.requiredProtocolFile)
      return this.extractPaths(input).some(
        (p) => normalizeGroundingPath(String(p)) === target,
      )
    }
    const required = new Set(getRequiredGroundingPaths(this.agentState))
    return this.extractPaths(input).some((p) =>
      required.has(normalizeGroundingPath(String(p))),
    )
  }

  private recordGroundingReads(paths: string[]): void {
    const checkpoint = this.ensureCheckpoint()
    if (!checkpoint) return
    const required = new Set(checkpoint.requiredPaths)
    for (const filePath of paths.map(normalizeGroundingPath)) {
      if (
        required.has(filePath) &&
        !checkpoint.completedPaths.includes(filePath)
      ) {
        checkpoint.completedPaths.push(filePath)
      }
    }
    checkpoint.completedPaths.sort()
  }

  private isGroundingComplete(): boolean {
    const checkpoint = this.ensureCheckpoint()
    if (!checkpoint) return false
    const complete =
      checkpoint.completedPaths.length === checkpoint.requiredPaths.length &&
      checkpoint.completedPaths.every(
        (path, index) => path === checkpoint.requiredPaths[index],
      )
    if (complete) {
      checkpoint.fullGroundingCompleted = true
      checkpoint.lastFullGroundingTurn = checkpoint.logicalUserTurnCount
      checkpoint.completionGateRetries = this.state.completionGateRetries
      checkpoint.completionGateDisarmed = this.state.completionGateDisarmed
    }
    return complete
  }

  private syncCheckpoint(): void {
    const checkpoint = this.ensureCheckpoint()
    if (!checkpoint) return
    checkpoint.completionGateRetries = this.state.completionGateRetries
    checkpoint.completionGateDisarmed = this.state.completionGateDisarmed
    checkpoint.logicalUserTurnCount = this.state.turnCount
    checkpoint.internalStepsSinceRefresh = this.internalStepsSinceRefresh
  }

  private ensureCheckpoint() {
    if (!this.agentState?.protocolFile) return undefined
    if (!this.agentState.groundingCheckpoint) {
      this.agentState.groundingCheckpoint = createGroundingCheckpoint(
        this.agentState,
      )
    }
    return this.agentState.groundingCheckpoint
  }

  private isPreReadAllowed(toolName: string): boolean {
    return (
      toolName === 'read_files' ||
      toolName === 'read_subtree' ||
      toolName === 'ask_user' ||
      toolName === 'write_todos'
    )
  }

  private isTerminalTool(toolName: string): boolean {
    return toolName === 'end_turn' || toolName === 'task_completed'
  }

  /** Record that context compaction was requested before a history mutation. */
  recordCompaction(): { refreshText?: string } {
    return this.requestGroundingRefresh('compaction')
  }

  /**
   * Deliver a refresh after a history replacement has actually completed.
   * This bypasses the pre-compaction idempotency epoch because the replacement
   * may have discarded the refresh emitted before it.
   */
  recordHistoryReplacement(): { refreshText?: string } {
    if (!this.state.protocolRead || !this.gateArmed) return {}
    const checkpoint = this.ensureCheckpoint()
    const now = Date.now()
    const fingerprint = checkpoint?.groundingSetFingerprint ?? 'unknown'
    const epoch = `${fingerprint}:${this.state.turnCount}:compaction:replacement:${now}`
    this.internalStepsSinceRefresh = 0
    this.lastRefreshAtMs = now
    this.lastRefreshTurn = this.state.turnCount
    this.lastRefreshEpoch = epoch
    if (checkpoint) {
      checkpoint.lastRefreshTurn = this.state.turnCount
      checkpoint.lastRefreshReason = 'compaction'
      checkpoint.lastRefreshEpoch = epoch
      checkpoint.lastRefreshAtMs = now
      checkpoint.internalStepsSinceRefresh = 0
    }
    return { refreshText: buildProtocolRefreshSummary() }
  }

  /**
   * Drain budgeted corrective steering messages for blocked pre-write
   * advisories (Law 7/8). Bounded per enforcement instance: at most
   * MAX_STEERING_TOTAL messages total, one per law (deduped per law+file).
   */
  takeSteeringMessages(): string[] {
    const messages: string[] = []
    for (const warning of this.pendingSteering) {
      if (this.steeringCount >= EchoEnforcement.MAX_STEERING_TOTAL) break
      const key = `${warning.law}:${warning.file ?? ''}`
      if (this.steeredKeys.has(key)) continue
      const perLaw = this.steeringPerLaw.get(warning.law) ?? 0
      const cap = EchoEnforcement.MAX_STEERING_PER_LAW[warning.law] ?? 1
      if (perLaw >= cap) continue
      this.steeredKeys.add(key)
      this.steeringPerLaw.set(warning.law, perLaw + 1)
      this.steeringCount += 1
      messages.push(buildSteeringText(warning))
    }
    this.pendingSteering = []
    return messages
  }

  getState(): Readonly<ReturnType<typeof createEnforcementState>> {
    return this.state
  }

  setDesignContract(contract: DesignContract | undefined): void {
    this.designContract = contract
  }

  getMode(): EnforcementMode {
    return this.mode
  }

  setMode(mode: EnforcementMode): void {
    this.mode = mode
  }

  private isWriteTool(toolName: string): boolean {
    return (
      toolName === 'write_file' ||
      toolName === 'str_replace' ||
      toolName === 'apply_patch'
    )
  }

  private isFidFile(path: string): boolean {
    return /dev\/fids\/FID-[\w.-]+\.md$/.test(path)
  }

  private getTargetPath(input: Record<string, unknown>): string | undefined {
    if (typeof input.path === 'string') return input.path
    const operation = input.operation
    if (operation && typeof operation === 'object') {
      const path = (operation as Record<string, unknown>).path
      if (typeof path === 'string') return path
    }
    return undefined
  }

  private extractPaths(input: Record<string, unknown>): string[] {
    if (Array.isArray(input.paths))
      return input.paths.filter((p): p is string => typeof p === 'string')
    if (typeof input.path === 'string') return [input.path]
    return []
  }
}
