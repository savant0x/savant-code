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
// FID-2026-0821-003-B: the EXACT source text baked into the serialized
// generator for the auto-compact trigger. Serialized generators cannot
// import runtime modules, so the resolver formula is duplicated inline; this
// const is both interpolated into the template below AND evaled by the parity
// test (agents/__tests__/trigger-threshold-parity.test.ts), so the executed
// body IS the emitted body — future drift fails the sweep loudly.
//
// No backticks in this content (handle-steps-factory template rule). The
// 4-space prefix matches the template body indentation for readability.
export const TRIGGER_THRESHOLD_INLINE_SOURCE = `    const minTriggerTokens = 100000
    const autoCompactBuffer = 30000
    // FID-2026-0821-001 P0-3 / FID-2026-0821-003-B: single threshold owner.
    // Mirrors resolveTriggerThreshold in packages/agent-runtime (parity
    // pinned by the trigger-threshold-parity sweep test); serialized
    // generators cannot import runtime modules.
    function computeTriggerThreshold(windowTokens, ratio) {
      const scaled = windowTokens * ratio
      const upperBound = windowTokens - autoCompactBuffer
      if (upperBound < minTriggerTokens) {
        return Math.floor(Math.min(scaled, upperBound))
      }
      return Math.floor(
        Math.max(minTriggerTokens, Math.min(scaled, upperBound)),
      )
    }
`

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
    ${TRIGGER_THRESHOLD_INLINE_SOURCE.trimEnd()}
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
    // FID-2026-0821-001 P2-2: two-rung escalation ladder (generator-local;
    // fresh per turn). Stage 0 = idle; stage 1 = one ineffective pass (the
    // immediate retry escalates to a forced second pass that bypasses the
    // cooldown); stage 2 = escalation hold — a visible blocked(
    // 'escalation-hold') state until the count grows ≥5% past the held
    // baseline. The force path stays OUTSIDE the ladder: hard-overflow
    // safety never counts strikes and never holds.
    let escalationStage = 0
    let awaitingEffectCheck = false
    let holdBaselineCount = 0
    // FID-2026-0821-001 P1-4: manual /compact detection runs once per run.
    let manualCompactChecked = false
    while (true) {
      // FID-2026-0821-001 P1-4: first-class manual /compact. Detected ONCE
      // per run from the trailing USER_PROMPT; routes through the force
      // context-pruner (bypasses cooldown) then compact-and-stop — no LLM
      // summary pass (codex semantics). The spawn boundary emits the
      // truthful pruned/ineffective terminal phase on its own.
      if (!manualCompactChecked) {
        manualCompactChecked = true
        let isManualCompact = false
        const history = agentState.messageHistory
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i]
          if ((m.tags ?? []).indexOf('USER_PROMPT') === -1) continue
          const c = m.content
          let text = ''
          if (typeof c === 'string') {
            text = c
          } else if (Array.isArray(c)) {
            for (const part of c) {
              if (
                part &&
                part.type === 'text' &&
                typeof part.text === 'string'
              ) {
                text += part.text
              }
            }
          }
          // FID-2026-0822-001 RC1: production USER_PROMPT content is
          // XML-framed by buildUserMessageContent/asUserMessage - the text
          // arrives as '<user_message>/compact</user_message>', so a raw
          // equality compare never matched and /compact silently fell
          // through to a normal LLM step (the model was asked to summarize
          // and the near-window request errored). Unwrap the frame first
          // (parseUserMessage equivalent via indexOf/slice: serialized
          // generators cannot import runtime modules, and regex backslash
          // escapes would cook inside this template literal), keeping bare
          // text as the fallback form.
          const openTag = '<user_message>'
          const closeTag = '</user_message>'
          const openIndex = text.indexOf(openTag)
          const closeIndex = text.indexOf(closeTag)
          const compactCandidate =
            openIndex !== -1 && closeIndex > openIndex
              ? text.slice(openIndex + openTag.length, closeIndex)
              : text
          if (compactCandidate.trim().toLowerCase() === '/compact') {
            isManualCompact = true
          }
break
        }
        if (isManualCompact) {
          agentState.compactionStatus = { phase: 'compacting' }
          // FID-2026-0825-001: one-shot flag consumed by loopAgentSteps at
          // output assembly. This run ends via compact-and-stop with no LLM
          // turn, so an explicitly empty last-turn output is SUCCESS — never
          // the zero-assistant-history error ("No response from agent") and
          // never a stale pre-compaction turn echoed as the response.
          agentState.compactAndStop = true
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
          // Compact-and-stop: history has been replaced and recounted by the
          // spawn boundary — end the turn here.
          return
        }
      }
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
      const compactTrigger = computeTriggerThreshold(
        maxContextLength,
        autoCompactRatio,
      )
      const forceDue =
        agentState.contextTokenCount > maxContextLength - forceCompactOffset
      // P2-2: judge the PREVIOUS pass before arming a new one — the spawn
      // boundary recounts history synchronously, so this count is already
      // post-compaction.
      if (awaitingEffectCheck) {
        awaitingEffectCheck = false
        if (agentState.contextTokenCount > compactTrigger) {
          escalationStage += 1
          if (escalationStage >= 2) {
            holdBaselineCount = agentState.contextTokenCount
          }
        } else {
          escalationStage = 0
        }
      }
      if (
        escalationStage >= 2 &&
        agentState.contextTokenCount >= holdBaselineCount * 1.05
      ) {
        escalationStage = 0
      }
      const escalationHold =
        escalationStage >= 2 &&
        !forceDue &&
        agentState.contextTokenCount < holdBaselineCount * 1.05
      if (escalationHold) {
        agentState.compactionStatus = {
          phase: 'blocked',
          percentUsed: Math.round(
            (agentState.contextTokenCount / maxContextLength) * 100,
          ),
          blockReason: 'escalation-hold',
        }
        logDebug(
          { escalationStage, count: agentState.contextTokenCount },
          'savant handleSteps: escalation hold — blocked(escalation-hold)',
        )
      }
      const proactiveDue =
        (autoCompactDue ||
          agentState.contextTokenCount > compactTrigger) &&
        !escalationHold
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
        awaitingEffectCheck = true
        yield {
          toolName: 'spawn_agent_inline',
          input: {
            agent_type: 'context-pruner',
            params: {
              maxContextLength,
              ...(params ?? {}),
              // FID-2026-0822-001 RC2: ALWAYS force on the proactive path.
              // The single threshold owner (autoCompactDue /
              // compactTrigger) already decided compaction is due; without
              // force, the pruner's own ~window-level admission gate
              // (count + fudge > maxContextLength) no-oped every
              // trigger-threshold spawn, so auto-compact only ever ran at
              // hard overflow. Manual, idle, and hard-overflow spawns
              // already forced. The escalation ladder still judges
              // post-force outcomes honestly.
              force: true,
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
