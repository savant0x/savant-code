import { createEhelGate } from './ehel-gate'
import { createHookGate, createProvenanceGate } from './hook-gate'
import {
  createParseErrorGate,
  createCapabilityGate,
  createWriteAndFsmGate,
  createSandboxGate,
} from './pre-dispatch-gates'
import { formatValueForError } from '../../util/format-value'

import type { GateStage } from './gate-context'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Gate-chain assembly (FID-2026-0905-001). The ORDER of this array is the
 * runtime's most important robustness invariant — see gate-context.ts and
 * the characterization suite (`tool-executor-gate-order.test.ts`).
 */
export function buildGateChain<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  hookProjectRoot: string
  declaredToolNames: () => readonly string[]
  fullResponse: () => string
  projectRoot: () => string | undefined
  isCapabilityOverride: () => boolean
  isFsmOverride: () => boolean
  isSandboxOverride: () => boolean
}): GateStage<T>[] {
  return [
    // 1. FID-2026-0802-005 C1: parse error precedes ANY input dereference.
    createParseErrorGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
      formatValueForError: (value: unknown) =>
        formatValueForError(value as never),
    }),
    // 2. Capability allowlist — undeclared tools never reach a gate with
    // side effects.
    createCapabilityGate<T>({
      onResponseChunk: deps.onResponseChunk,
      isCapabilityOverride: deps.isCapabilityOverride,
      declaredToolNames: deps.declaredToolNames,
    }),
    // 3. Write/containment + FSM phase gates.
    createWriteAndFsmGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
      isFsmOverride: deps.isFsmOverride,
    }),
    // 4. Sandbox policy gate.
    createSandboxGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
      isSandboxOverride: deps.isSandboxOverride,
    }),
    // 5. EHEL pre-write enforcement (unconditional — dev policy cannot
    // bypass it) + YAGNI payload strip.
    createEhelGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
      fullResponse: deps.fullResponse,
      projectRoot: deps.projectRoot,
    }),
    // 6. PreToolUse hooks (additional gate after EHEL, never a bypass).
    createHookGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
      hookProjectRoot: () => deps.hookProjectRoot,
    }),
    // 7. ZTAP enforce fail-closed pre-dispatch gate.
    createProvenanceGate<T>({
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
    }),
  ]
}
