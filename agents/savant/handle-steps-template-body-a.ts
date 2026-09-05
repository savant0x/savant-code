export type BakedLiterals = {
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

// FID-2026-0819-005 Loop 140: serialized-body fragment A (manual /compact
// detection + idle compaction + trigger evaluation), moved verbatim from
// handle-steps-factory.ts. Byte-identical; no backticks inside. See
// handle-steps-template.ts for the serialization invariants.

export function buildSavantHandleStepsBodyA(baked: BakedLiterals): string {
  const {
    defaultMaxContextLength,
    amortizedFoldLiteral,
    foldFloorLiteral,
    idleEnabledLiteral,
    idleAfterMsLiteral,
    idleFloorLiteral,
    forceCompactOffsetLiteral,
    autoCompactRatioLiteral,
  } = baked
  return `
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
    let idleChecked = false`
}
