import type { BakedLiterals } from './handle-steps-template-body-a'

// FID-2026-0819-005 Loop 140: serialized-body fragment B (escalation
// ladder through turn end), moved verbatim from handle-steps-factory.ts.
// Byte-identical; no backticks inside. See handle-steps-template.ts.

export function buildSavantHandleStepsBodyB(baked: BakedLiterals): string {
  const { keepRecentTokensParam, cacheExpiryParam } = baked
  return `    // FID-2026-0821-001 P2-2: two-rung escalation ladder (generator-local;
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
}
