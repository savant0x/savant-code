import type { BakedLiterals } from './handle-steps-template-body-a'

// FID-2026-1013-012 W3-6: serialized-body fragment C — the
// compaction-yield tail of fragment B: the proactive/forced pruner spawn
// yields, the STEP yield, the amortized-fold pass, and the generators
// closing brace. Moved verbatim from handle-steps-template-body-b.ts and
// concatenated directly after it, so the emitted source is
// byte-identical. No backticks inside the template content.

export function buildSavantHandleStepsBodyC(baked: BakedLiterals): string {
  const { keepRecentTokensParam, cacheExpiryParam } = baked
  return `
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
            forceMargin,
          },
          'savant handleSteps: auto-compact trigger evaluated',
        )
      }
      if (forceDue) {
        // FID-2026-1009-003 L4: the forced pass supersedes the escalation
        // ladder — reset it so proactive compaction resumes next turn.
        escalationStage = 0
        holdBaselineCount = 0
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
