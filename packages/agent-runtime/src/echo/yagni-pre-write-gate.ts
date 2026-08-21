import { assessWrite, parseYagniCheckBlock } from '../yagni-ladder'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
} from './types'

export type YagniPreWriteGateParams = {
  toolName: string
  input: Record<string, unknown>
  agentId: string
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
  targetPath?: string
}

/**
 * P5b — YAGNI gate (FID-2026-0806-003).
 *
 * Extracts the Forge's `yagni_check` JSON block from the write input (the
 * block precedes the code inside the `content`/`newString` payload per the
 * Forge prompt), validates it with the ladder module, and blocks speculative
 * writes that lack a documented debt marker. Records the assessment on the
 * enforcement state so the Verifier's YAGNI Assessment can audit it.
 */
export function runYagniPreWriteGate(
  params: YagniPreWriteGateParams,
): EnforcementResult {
  const { input, state } = params
  // Only gate the Forge (and only its actual write tools). Other agents
  // (Scout/Recorder/Orchestrator writes) are outside the Forge's YAGNI
  // contract.
  if (params.agentId !== 'forge') {
    return { blocked: false, warnings: [] }
  }

  const payload = input.content ?? input.newString ?? ''
  if (typeof payload !== 'string') {
    return { blocked: false, warnings: [] }
  }

  const blockMatch = payload.match(
    /<yagni_check>([\s\S]*?)<\/yagni_check>|<yagni_check\s*\/?>([\s\S]*?)(?:<\/yagni_check>)?$/i,
  )
  if (!blockMatch) {
    // Forge writes without a yagni_check block are a compliance warning, not
    // a hard block — the block is a thinking aid; the code itself is still
    // audited by the Verifier.
    return {
      blocked: false,
      warnings: [
        {
          law: 0,
          severity: 'info',
          message:
            'P5b YAGNI: Forge write without a <yagni_check> block — audit the diff for speculative scope (Verifier YAGNI Assessment).',
          file: params.targetPath ?? params.toolName,
        },
      ],
    }
  }

  const { assessment, reason } = parseYagniCheckBlock(blockMatch[1] ?? '')
  if (reason) {
    return {
      blocked: false,
      warnings: [
        {
          law: 0,
          severity: 'warning',
          message: `P5b YAGNI: malformed yagni_check block (${reason}) — treat as speculative until Verifier assessment.`,
          file: params.targetPath ?? params.toolName,
        },
      ],
    }
  }

  // Record the assessment for the Verifier / analytics.
  state.yagni = {
    ...state.yagni,
    lastAssessment: {
      isSpeculative: assessment.isSpeculative,
      reusedEntities: assessment.reusedEntities,
      debtMarkersInserted: assessment.debtMarkersInserted,
    },
  }

  const verdict = assessWrite({ assessment })
  if (verdict.verdict === 'rejected') {
    state.yagni = {
      ...state.yagni,
      speculativeWritesRejected: state.yagni.speculativeWritesRejected + 1,
    }
    return {
      blocked: true,
      reason: `${verdict.reason} (${params.targetPath ?? params.toolName})`,
      warnings: [],
    }
  }

  return { blocked: false, warnings: [] }
}
