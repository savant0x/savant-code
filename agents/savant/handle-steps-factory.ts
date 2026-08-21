import type { SecretAgentDefinition } from '../types/secret-agent-definition'

export type SavantHandleSteps = Extract<
  NonNullable<SecretAgentDefinition['handleSteps']>,
  (...args: never[]) => unknown
>

// FID-2026-0802-005 L5: the four handleSteps variants differed only in two
// literals (the fallback maxContextLength and the free-tier cacheExpiryMs) and
// duplicated `asNumber` four times. They were collapsed into one factory.
// handleSteps is serialized via .toString() and re-eval'd (prebuild-agents.ts
// + run-programmatic-step.ts deserializeHandleSteps), so the generated
// function MUST be fully self-contained: only literals, params, and locals —
// no closure variables. Baking the config values as literals into the
// generated source guarantees that. The eval runs once at module load with
// numeric literals only — the same trust domain as the runtime's existing
// deserializeHandleSteps.
//
// FID-2026-0806-003 Phases 3/6: P3a amortized fold + P3c idle compaction + P3d
// force ratio (Hermes pattern, off by default) are baked the same way — the
// factory is the ONLY surface where compression config becomes trigger
// behavior; protocol.config.yaml values are threaded in here by the caller.
export function createSavantHandleSteps(config: {
  defaultMaxContextLength: 250_000 | 400_000
  cacheExpiryMs?: number
  /** P3a — fold one oldest exchange per completed turn (off by default). */
  amortizedFold?: boolean
  /** P3a — fold only above this context floor (tokens). */
  foldFloorTokens?: number
  /** P3c — idle compaction predicate (off by default). */
  idleCompaction?: {
    enabled: boolean
    idleAfterSeconds: number
    floorTokens: number
  }
  /** FID-2026-0814-004 H-07 — pruner tail budget (tokens), from
   *  `compression.keepRecentTokens`. Baked as a literal; the pruner reads it
   *  from its spawn params (`agents/context-pruner/main.ts:177-178`). */
  keepRecentTokens?: number
  /** FID-2026-0814-004 H-07 — proactive pruner ratio, from
   *  `compression.autoCompactRatio` (default 0.8). */
  autoCompactRatio?: number
  /** FID-2026-0814-013 — force pruner offset (tokens below the window), from
   *  `compression.forceCompactOffset` (default 15_000). */
  forceCompactOffset?: number
}): SavantHandleSteps {
  const {
    defaultMaxContextLength,
    cacheExpiryMs,
    amortizedFold = false,
    foldFloorTokens = 40_000,
    idleCompaction = {
      enabled: false,
      idleAfterSeconds: 1800,
      floorTokens: 40_000,
    },
    keepRecentTokens = 16_384,
    autoCompactRatio = 0.8,
    forceCompactOffset = 15_000,
  } = config
  const cacheExpiryParam =
    cacheExpiryMs === undefined ? '' : `cacheExpiryMs: ${cacheExpiryMs},`
  const keepRecentTokensParam = `keepRecentTokens: ${keepRecentTokens},`
  const autoCompactRatioLiteral = String(autoCompactRatio)
  const forceCompactOffsetLiteral = String(forceCompactOffset)
  const amortizedFoldLiteral = amortizedFold ? 'true' : 'false'
  const foldFloorLiteral = String(foldFloorTokens)
  const idleEnabledLiteral = idleCompaction.enabled ? 'true' : 'false'
  const idleAfterMsLiteral = String(idleCompaction.idleAfterSeconds * 1000)
  const idleFloorLiteral = String(idleCompaction.floorTokens)
  const source = `function* ({ params, agentState, logger }) {
    function asNumber(value) {
      return typeof value === 'number' ? value : null
    }
    // FID-2026-0814-011 C-03: bounded observability channel. The runtime
    // passes a streaming logger; tests and resumed deserialization may pass
    // none, so every call is guarded and wrapped — the debug channel must
    // never break the trigger.
    function logDebug(data, message) {
      try {
        if (logger && typeof logger.debug === 'function') {
          logger.debug(data, message)
        }
      } catch (_) {
        // ignore — observability must never gate compaction
      }
    }
    const p = params ?? {}
    // FID-2026-0814-011 C-01: never silently adopt the baked fallback. The
    // resolved window (agentState.maxContextLength, set by the runtime from
    // the ContextCompactor thresholds) is authoritative; the baked default is
    // a last resort only, and its use is logged so a divergence is visible.
    const resolvedMaxContextLength =
      agentState.maxContextLength ?? asNumber(p.maxContextLength)
    const maxContextLength =
      resolvedMaxContextLength ?? ${defaultMaxContextLength}
    if (resolvedMaxContextLength == null) {
      logDebug(
        { fallbackMaxContextLength: ${defaultMaxContextLength} },
        'savant handleSteps: maxContextLength unresolved — adopting baked default; auto-compact trigger may diverge from the resolved window',
      )
    }
    // P3a/P3c/P3d (FID-2026-0806-003) — baked literals; see the factory.
    const amortizedFold = ${amortizedFoldLiteral}
    const foldFloorTokens = ${foldFloorLiteral}
    const idleEnabled = ${idleEnabledLiteral}
    const idleAfterMs = ${idleAfterMsLiteral}
    const idleFloorTokens = ${idleFloorLiteral}
    // FID-2026-0814-004 H-07 / FID-2026-0814-013: compression thresholds
    // baked from the factory (protocol.config.yaml compression.autoCompactRatio
    // / forceCompactOffset).
    const forceCompactOffset = ${forceCompactOffsetLiteral}
    const autoCompactRatio = ${autoCompactRatioLiteral}
    // FID-2026-0814-001: after a pruner run completes (stamped by the runtime
    // spawn boundary), back off the proactive spawn for one cooldown so an
    // ineffective summary cannot silently re-spawn the pruner every step. The
    // force path still fires for hard-overflow safety.
    const prunerCooldownMs = 30_000
    let idleChecked = false
    while (true) {
      const lastPrunerCompletionAt =
        typeof agentState.lastPrunerCompletionAt === 'number'
          ? agentState.lastPrunerCompletionAt
          : 0
      // P3c idle compaction: evaluate ONCE per run (a run = one user turn, so
      // this is the session-resume moment). Idle gap > idleAfterMs AND context
      // above the floor => compact up front with force so the pruner proceeds
      // even when its own gates wouldn't fire. Self-regulating: a fresh
      // compaction refreshes sentAt timestamps, so the next run sees no gap.
      if (!idleChecked) {
        idleChecked = true
        if (idleEnabled) {
          let newestSentAt = 0
          for (const m of agentState.messageHistory) {
            if (typeof m.sentAt === 'number' && m.sentAt > newestSentAt) {
              newestSentAt = m.sentAt
            }
          }
          const idleMs = newestSentAt > 0 ? Date.now() - newestSentAt : 0
          if (
            idleMs > idleAfterMs &&
            agentState.contextTokenCount > idleFloorTokens
          ) {
            agentState.compactionStatus = { phase: 'compacting' }
            yield {
              toolName: 'spawn_agent_inline',
              input: {
                agent_type: 'context-pruner',
                params: {
                  maxContextLength,
                  ...(params ?? {}),
                  force: true,
                  ${keepRecentTokensParam}
                  ${cacheExpiryParam}
                },
              },
              includeToolCall: false,
            }
          }
        }
      }
      // P3d force offset: above (maxContextLength − forceCompactOffset) the
      // pruner proceeds even for low-value folds (force: true bypasses the
      // pruner's own gates) rather than risking a hard overflow. The
      // autoCompactRatio proactive trigger stays as-is. Both thresholds come
      // from the factory (H-07 / FID-2026-0814-013).
      // FID-2026-0814-011 C-02: single trigger authority. autoCompactDue
      // is set every step by prepareStepContext from the proven
      // shouldAutoCompact verdict; the ratio arithmetic below is a fallback
      // only (e.g. a resumed run where the flag was never set). The force
      // path still fires for hard-overflow safety and bypasses the cooldown.
      const autoCompactDue = agentState.autoCompactDue === true
      const forceDue =
        agentState.contextTokenCount > maxContextLength - forceCompactOffset
      const proactiveDue =
        autoCompactDue ||
        agentState.contextTokenCount > maxContextLength * autoCompactRatio
      if (proactiveDue || forceDue) {
        logDebug(
          {
            contextTokenCount: agentState.contextTokenCount,
            maxContextLength,
            autoCompactDue,
            forceDue,
            autoCompactRatio,
            forceCompactOffset,
          },
          'savant handleSteps: auto-compact trigger evaluated',
        )
      }
      if (forceDue) {
        agentState.compactionStatus = { phase: 'compacting' }
        yield {
          toolName: 'spawn_agent_inline',
          input: {
            agent_type: 'context-pruner',
            params: {
              maxContextLength,
              ...(params ?? {}),
              force: true,
              ${keepRecentTokensParam}
              ${cacheExpiryParam}
            },
          },
          includeToolCall: false,
        }
      } else if (
        proactiveDue &&
        Date.now() - lastPrunerCompletionAt > prunerCooldownMs
      ) {
        agentState.compactionStatus = { phase: 'compacting' }
        yield {
          toolName: 'spawn_agent_inline',
          input: {
            agent_type: 'context-pruner',
            params: {
              maxContextLength,
              ...(params ?? {}),
              ${keepRecentTokensParam}
              ${cacheExpiryParam}
            },
          },
          includeToolCall: false,
        }
      }
      const { stepsComplete } = yield 'STEP'
      if (stepsComplete) {
        // P3a amortized fold: at turn end, fold ONE oldest un-absorbed
        // exchange into the running summary (Hermes pattern) when the fold is
        // enabled and context is above the floor. The pruner no-ops when
        // there is nothing un-absorbed, so early turns are cheap. The turn
        // does not close until this pass finishes (same yield contract).
        if (
          amortizedFold &&
          agentState.contextTokenCount > foldFloorTokens
        ) {
          yield {
            toolName: 'spawn_agent_inline',
            input: {
              agent_type: 'context-pruner',
              params: {
                maxContextLength,
                ...(params ?? {}),
                foldOldestExchange: true,
                ${keepRecentTokensParam}
                ${cacheExpiryParam}
              },
            },
            includeToolCall: false,
          }
        }
        break
      }
    }
  }`
  return eval(`(${source})`) as SavantHandleSteps
}

export const handleStepsFree250k = createSavantHandleSteps({
  defaultMaxContextLength: 250_000,
  keepRecentTokens: 16_384,
  autoCompactRatio: 0.8,
  forceCompactOffset: 15_000,
  cacheExpiryMs: 30 * 60 * 1000,
})
export const handleStepsFree400k = createSavantHandleSteps({
  defaultMaxContextLength: 400_000,
  cacheExpiryMs: 30 * 60 * 1000,
})
export const handleSteps250k = createSavantHandleSteps({
  defaultMaxContextLength: 250_000,
})
export const handleSteps400k = createSavantHandleSteps({
  defaultMaxContextLength: 400_000,
})
