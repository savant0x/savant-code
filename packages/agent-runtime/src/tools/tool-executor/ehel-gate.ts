import { injectEhelSteering } from './steering'
import { isWriteToolName } from './write-bookkeeping'
import {
  formatBlockingError,
  buildComplianceWarningChunks,
} from '../../echo/violation-handler'
import { resolveYagniEnforced } from '../../echo/yagni-pre-write-gate'
import { stripYagniCheckBlocksFromWritePayload } from '../../util/think-tags'

import type { GateContext, GateHalt, GateStage } from './gate-context'
import type { EchoEnforcement } from '../../echo/enforcement'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * EHEL pre-write enforcement gate (extracted verbatim from
 * `tool-executor/native.ts` :295 context — FID-2026-0905-001).
 *
 * Blocks writes that violate Laws 1, 3, 7, 8, or FID Recorder gate.
 * This call is unconditional: development policy cannot bypass EHEL.
 * FID-2026-0813-002: the gate outcomes are captured into the write record
 * (and later the ZTAP receipt's lawChecks field) so law enforcement is
 * persisted, not just enforced.
 */
export function createEhelGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  fullResponse: () => string
  projectRoot: () => string | undefined
}): GateStage<T> {
  return (ctx: GateContext<T>): GateHalt => {
    const enforcement: EchoEnforcement = ctx.enforcement
    let writeLawChecks: { law: number; outcome: 'advisory' }[] = []
    const enforceResult = enforcement.beforeToolCall({
      toolName: ctx.toolCall.toolName,
      input: ctx.toolCall.input as Record<string, unknown>,
      agentId: ctx.params.agentState.agentId,
      // FID-2026-0822-004: the yagni gate also consumes the assistant TEXT
      // channel (the Forge emits the block at the top of its response) and
      // honors `yagni.enforced` from protocol.config.yaml.
      assistantText: deps.fullResponse(),
      yagniEnforced: resolveYagniEnforced(deps.projectRoot()),
    })
    if (!enforceResult.blocked && enforceResult.warnings.length > 0) {
      writeLawChecks = enforceResult.warnings.map((warning) => ({
        law: warning.law,
        outcome: 'advisory' as const,
      }))
    }
    if (enforceResult.blocked) {
      // EHEL blocking results carry their advisory warnings (strict-mode
      // Law 7/8 attach the advisory to the blocked result). Surface them as
      // compliance_warning receipts first — with their ACTUAL law — then the
      // blocking error that drives the retry flow.
      for (const chunk of buildComplianceWarningChunks(
        enforceResult.warnings,
      )) {
        deps.onResponseChunk(chunk)
      }
      // FID-2026-0901-002: self-healing gates (e.g. session-init
      // grounding) mark their result `silent` — the agent still gets
      // corrective steering below, but no visible BLOCKED error chunk in
      // the transcript.
      if (!enforceResult.silent) {
        deps.onResponseChunk({
          type: 'error',
          message: formatBlockingError(
            enforceResult.reason ?? 'ECHO violation',
            enforceResult.classification,
          ),
        })
      }
      // Steer the running agent: inject budgeted corrective text ("search
      // first" / "log intent first") so it self-corrects instead of seeing
      // only a block error.
      injectEhelSteering(ctx.params.agentState, enforcement)
      ctx.writeLawChecks = writeLawChecks
      return { halt: true, status: 'failed' }
    }
    // EHEL advisories carry their ACTUAL law (law7 / law8 — never a
    // hardcoded law1). The tracker's receipts and the EHEL advisories emit
    // disjoint law sets, so this can never double-report a violation.
    if (enforceResult.warnings.length > 0) {
      for (const chunk of buildComplianceWarningChunks(
        enforceResult.warnings,
      )) {
        deps.onResponseChunk(chunk)
      }
      injectEhelSteering(ctx.params.agentState, enforcement)
    }
    ctx.writeLawChecks = writeLawChecks

    // FID-2026-0822-004: sanitize write payloads AFTER the gate parsed the
    // <yagni_check> block (the gate's regex extraction is read-only) but
    // BEFORE execution, so a payload-embedded block never pollutes the
    // written file — or the tool-call display/history/ZTAP receipt, which all
    // derive from the same input object below. Covers write_file `content`,
    // str_replace `newString`/`replacements[].newString`, and apply_patch
    // `operation.diff`.
    if (isWriteToolName(ctx.toolCall.toolName)) {
      stripYagniCheckBlocksFromWritePayload(
        ctx.toolCall.input as Record<string, unknown>,
      )
    }
    return { halt: false }
  }
}
