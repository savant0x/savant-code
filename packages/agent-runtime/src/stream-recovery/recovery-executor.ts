/**
 * FID-2026-1005-007 — bounded recovery execution (converged design
 * decisions 4–6). One logical turn = at most TWO physical requests; the
 * recovery leg carries NO tools (structurally: the request exposes an empty
 * tool set and the executor never populates one); a truncation during
 * recovery is terminal (STREAM_CUT — never a third request). Accounting
 * records the physical/logical split per turn.
 */

import {
  StreamCutError,
  classifyStreamOutcome,
  emptyAccumulation,
} from './outcome'
import { buildRecoveryPrompt, planRecovery } from './recovery-plan'

import type { StreamClose, StreamCloseKind, TurnAccumulation } from './outcome'
import type { RecoveryBudget } from './recovery-plan'

export interface RecoveryRequest {
  logicalTurnId: string
  physicalRequestIndex: number
  prompt: string
  /** Structurally empty — tools are disabled for the recovery segment. */
  tools: Record<string, never>
  outputCapTokens: number
  segmentBudgetMs: number
}

export interface RecoveryAccountingRecord {
  logicalTurnId: string
  physicalRequestIndex: number
  recovered: boolean
  outcome: string
}

export interface TurnWithRecoveryParams<C, R> {
  logicalTurnId: string
  originalInput: string
  create: () => AsyncGenerator<C, R>
  createRecovery: (request: RecoveryRequest) => AsyncGenerator<C, R>
  observeChunk: (turn: TurnAccumulation, chunk: C) => void
  closeKindOf: (error: unknown) => StreamCloseKind
  onAccounting: (record: RecoveryAccountingRecord) => void
  budget: RecoveryBudget | ((turn: TurnAccumulation) => RecoveryBudget)
  /** A classified retry may already have used the second physical request. */
  canRecover?: () => boolean
  physicalRequestCount?: () => number
}

/**
 * Run one logical turn with bounded recovery. Re-yields the original
 * stream; on the one recoverable truncation, issues exactly one recovery
 * request and delivers its output as the turn's answer (no reasoning
 * replay).
 */
export async function* runTurnWithRecovery<C, R>(
  params: TurnWithRecoveryParams<C, R>,
): AsyncGenerator<C, R> {
  const turn = emptyAccumulation()
  let sawErrorFrame = false
  let close: StreamClose = { kind: 'done' }
  let result: R | undefined
  let thrown: unknown

  // Physical request #1 — the original turn.
  try {
    const stream = params.create()
    let next = await stream.next()
    while (!next.done) {
      params.observeChunk(turn, next.value)
      if ((next.value as { type?: unknown }).type === 'error') sawErrorFrame = true
      yield next.value
      next = await stream.next()
    }
    result = next.value as R
    close = { kind: 'done', sawErrorFrame }
  } catch (error) {
    thrown = error
    close = { kind: params.closeKindOf(error), sawErrorFrame }
  }

  const outcome = classifyStreamOutcome(turn, close)
  const budget = typeof params.budget === 'function' ? params.budget(turn) : params.budget
  const plan = planRecovery(turn.reasoning, budget)
  const recoverable =
    outcome === 'reasoning-only-truncation' &&
    (params.canRecover?.() ?? true) &&
    plan.go &&
    plan.checkpoint.trim().length > 0

  if (!recoverable) {
    params.onAccounting({
      logicalTurnId: params.logicalTurnId,
      physicalRequestIndex: params.physicalRequestCount?.() ?? 1,
      recovered: false,
      outcome,
    })
    if (outcome === 'reasoning-only-truncation') throw new StreamCutError()
    if (thrown !== undefined) throw thrown
    return result as R
  }

  // Physical request #2 — the single bounded recovery leg.
  const request: RecoveryRequest = {
    logicalTurnId: params.logicalTurnId,
    physicalRequestIndex: (params.physicalRequestCount?.() ?? 1) + 1,
    prompt: buildRecoveryPrompt(params.originalInput, plan.checkpoint),
    tools: {},
    outputCapTokens: plan.outputCapTokens,
    segmentBudgetMs: plan.segmentBudgetMs,
  }
  const recoveryTurn = emptyAccumulation()
  let recoveryResult: R | undefined
  try {
    const recovery = params.createRecovery(request)
    let next = await recovery.next()
    while (!next.done) {
      params.observeChunk(recoveryTurn, next.value)
      yield next.value
      next = await recovery.next()
    }
    recoveryResult = next.value as R
  } catch {
    params.onAccounting({
      logicalTurnId: params.logicalTurnId,
      physicalRequestIndex: params.physicalRequestCount?.() ?? 2,
      recovered: false,
      outcome: 'recovery-failed',
    })
    throw new StreamCutError()
  }
  const recoveryOutcome = classifyStreamOutcome(recoveryTurn, {
    kind: 'done',
    sawErrorFrame: false,
  })
  const recovered = recoveryOutcome === 'normal' && recoveryTurn.bodyChars > 0
  params.onAccounting({
    logicalTurnId: params.logicalTurnId,
    physicalRequestIndex: params.physicalRequestCount?.() ?? 2,
    recovered,
    outcome: recoveryOutcome,
  })
  if (!recovered) throw new StreamCutError()
  return recoveryResult as R
}
