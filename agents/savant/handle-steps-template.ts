// FID-2026-0819-005 Loop 140: the serialized-generator template, extracted
// from handle-steps-factory.ts. The emitted source is byte-identical to the
// pre-extraction template: the moved head/tail fragments below interpolate
// the SAME baked-literal names, and TRIGGER_THRESHOLD_INLINE_SOURCE is the
// SAME const (parity-pinned by
// agents/__tests__/trigger-threshold-parity.test.ts).
//
// handleSteps is serialized via .toString() and re-eval'd (prebuild-agents.ts
// + run-programmatic-step.ts deserializeHandleSteps), so the generated
// function MUST be fully self-contained: only literals, params, and locals —
// no closure variables. Baking the config values as literals into the
// generated source guarantees that.
//
// No backticks in the template content (handle-steps-factory template rule).

import { buildSavantHandleStepsBodyA } from './handle-steps-template-body-a'
import { buildSavantHandleStepsBodyB } from './handle-steps-template-body-b'

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

export type SavantHandleStepsBaked = {
  defaultMaxContextLength: 250_000 | 400_000
  keepRecentTokensParam: string
  cacheExpiryParam: string
  amortizedFoldLiteral: string
  foldFloorLiteral: string
  idleEnabledLiteral: string
  idleAfterMsLiteral: string
  idleFloorLiteral: string
  forceCompactOffsetLiteral: string
  autoCompactRatioLiteral: string
}

export function buildSavantHandleStepsSource(
  baked: SavantHandleStepsBaked,
): string {
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
    ${TRIGGER_THRESHOLD_INLINE_SOURCE.trimEnd()}${buildSavantHandleStepsBodyA(baked)}${buildSavantHandleStepsBodyB(baked)}`
  return source
}
