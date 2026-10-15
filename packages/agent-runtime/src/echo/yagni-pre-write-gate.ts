import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import { assessWrite, parseYagniCheckBlock } from '../yagni-ladder'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
} from './types'

/** Per-cwd cache for `yagni.enforced` (mirrors caveman-rules.ts pattern). */
const yagniEnforcedCache = new Map<string, boolean>()

/** Clears the cache (test helper). */
export function __resetYagniEnforcedCacheForTests(): void {
  yagniEnforcedCache.clear()
}

/**
 * FID-2026-0822-004: resolve `yagni.enforced` from protocol.config.yaml
 * (default true when unreadable). Cached per project root so the pre-write
 * gate doesn't re-read the config on every write.
 */
export function resolveYagniEnforced(projectRoot: string | undefined): boolean {
  if (!projectRoot) return true
  const cached = yagniEnforcedCache.get(projectRoot)
  if (cached !== undefined) return cached
  let enforced = true
  try {
    enforced = readProtocolConfig(projectRoot).yagni.enforced
  } catch {
    // Unreadable config — defaults (gate stays active).
  }
  yagniEnforcedCache.set(projectRoot, enforced)
  return enforced
}

export type YagniPreWriteGateParams = {
  toolName: string
  input: Record<string, unknown>
  agentId: string
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
  targetPath?: string
  /**
   * FID-2026-0822-004: the Forge's assistant TEXT so far in this step. The
   * Forge prompt emits the <yagni_check> block at the top of the response
   * (text channel); the gate must also accept it there or P5b silently never
   * fires on the prompted path. The payload channel (`content`/`newString`)
   * is tried first, then this text channel.
   */
  assistantText?: string
  /**
   * FID-2026-0822-004: `yagni.enforced: false` (protocol.config.yaml)
   * disables the gate entirely — no assessment, no warnings. Defaults true.
   */
  yagniEnforced?: boolean
}

/** Shared extraction regex for the yagni_check block (gate + text channel). */
const YAGNI_BLOCK_RE =
  /<yagni_check>([\s\S]*?)<\/yagni_check>|<yagni_check\s*\/?>([\s\S]*?)(?:<\/yagni_check>)?$/i

/**
 * P5b — YAGNI gate (FID-2026-0806-003).
 *
 * Extracts the Forge's `yagni_check` JSON block from the write input (the
 * block precedes the code inside the `content`/`newString` payload per the
 * Forge prompt) OR from the assistant text channel (FID-2026-0822-004 — the
 * prompt emits the block at the top of the response), validates it with the
 * ladder module, and blocks speculative writes that lack a documented debt
 * marker. Records the assessment on the enforcement state so the Verifier's
 * YAGNI Assessment can audit it.
 */
export function runYagniPreWriteGate(
  params: YagniPreWriteGateParams,
): EnforcementResult {
  const { input, state } = params
  // FID-2026-0822-004: config-respect — `yagni.enforced: false` disables the
  // gate entirely (no assessment, no compliance warnings).
  if (params.yagniEnforced === false) {
    return { blocked: false, warnings: [] }
  }
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

  // FID-2026-0822-004: dual-channel extraction. The payload channel first
  // (write embedded per the gate comment); if absent, the assistant-text
  // channel (the Forge prompt's "top of your response" emission point).
  const blockMatch = payload.match(YAGNI_BLOCK_RE)
  const textMatch = blockMatch
    ? null
    : typeof params.assistantText === 'string'
      ? params.assistantText.match(YAGNI_BLOCK_RE)
      : null
  const match = blockMatch ?? textMatch
  if (!match) {
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

  const { assessment, reason } = parseYagniCheckBlock(match[1] ?? '')
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
