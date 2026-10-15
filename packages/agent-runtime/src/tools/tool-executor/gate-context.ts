import type { ExecuteToolCallParams } from './types'
import type { EchoEnforcement } from '../../echo/enforcement'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Shared gate-pipeline contract (FID-2026-0905-001).
 *
 * The native tool executor's pre-dispatch chain is a sequence of gate stages.
 * Every stage returns a discriminated result: either it passes (with an
 * optional payload) or it halts dispatch with a terminal trace status. The
 * FACADE owns the halt semantics — `finishToolEvent(status)` plus the
 * `previousToolCallFinished` return — so they stay byte-identical to the
 * monolith's inline pattern at every halt site (native.ts:163, :198, :272,
 * :372, :497 pre-decomposition).
 */
export type GateHalt =
  { halt: true; status: 'failed' | 'cancelled' } | { halt: false }

export type GateContext<T extends ToolName> = {
  params: ExecuteToolCallParams<T>
  toolCall: SavantCodeToolCall<T>
  toolCallId: string
  toolName: T
  logger: ExecuteToolCallParams<T>['logger']
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  executionPolicy: {
    allowCapabilityOverride: boolean
    allowFsmOverride: boolean
    allowSandboxOverride: boolean
  }
  hookProjectRoot: string
  enforcement: EchoEnforcement
  /** Producer: write gate (:198). Consumer: Law-1 record (:421). */
  resolvedWritePath: string | undefined
  /** Producer: EHEL gate (:295). Consumers: Law-1 record + ZTAP receipt. */
  writeLawChecks: { law: number; outcome: 'advisory' }[]
  /** Producer: spawn validation (:474). Consumer: dispatch (:530). */
  effectiveInput: Record<string, JSONValue>
}

export type GateStage<T extends ToolName> = (
  ctx: GateContext<T>,
) => Promise<GateHalt> | GateHalt
