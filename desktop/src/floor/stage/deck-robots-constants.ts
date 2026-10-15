/**
 * Cast-wide constants for the robot figure factory. Extracted verbatim from
 * deck-robots.ts; shared by the GLB figure factory and the fallback figure.
 */

/** Cast figures normalize to this height (world units). FID-2026-0828-002
 * coherent-world rescale: the earlier 25-unit target came from an
 * eye-scaling session against a broken normalization (stale matrices), so
 * the multiplier tuning was compensating for a measurement bug. With the
 * bounds now measured truthfully, the floor was originally designed around
 * a ~5-unit cast: pad ring radius 16, station ring radius 9, pad spacing
 * ~8.3 units, camera default distance 22 — a 62-unit cast cannot fit in
 * that world without stacking. Return to the designed scale.
 * Rescale 25 → 6 (operator: robots now massive and stacked on top of each
 * other; a specialist pad has ~8.3 units of separation). */
export const ROBOT_TARGET_HEIGHT = 6

/** Emissive intensity levels — the 1:1 chat-mirror contract: IDLE cast is
 * visibly dim standby holograms; only an agent with a LIVE contract burns
 * full holographic brightness (operator: "non-active agents should be
 * dimmer, the active ones should be fully holographic"). The old 1.4/2.2
 * pair made the whole roster read active all the time.
 * FID-2026-0829-001 L1: active 2.2 → 4.0, standby 0.7 → 1.2. The deck
 * must be unmistakably alive — agents glow brightly when active and
 * visibly at standby (not off). The dim standby LOOK still comes from
 * the translucent base + dark tinted chassis, but the emissive is now
 * high enough to read the accent under any lighting rig. */
export const STANDBY_EMISSIVE = 1.2
export const ACTIVE_EMISSIVE = 4.0
/** Crossfade speed for clip weights and emissive levels (0..1 per second). */
export const BLEND_RATE_PER_SEC = 6
