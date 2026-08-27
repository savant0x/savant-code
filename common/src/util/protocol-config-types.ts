import type { HookConfig } from '../types/hooks'

export interface ProtocolContractConfig {
  version: string
  strictMode: boolean
}

/** Backward-compatible name for the normalized Savant contract. */
export type SavantProtocolConfig = ProtocolContractConfig

/** Token-optimization settings (FID-2026-0806-003, design doc §5). */
export interface ProtocolCompressionConfig {
  enabled: boolean
  /** P3a per-turn folding — off by default (breaks the prompt-cache prefix). */
  microCompact: boolean
  /** P2a fixed verbatim recent-tail token budget. */
  keepRecentTokens: number
  /** P3d auto-compact trigger ratio. */
  autoCompactRatio: number
  /** P3d force-compact trigger offset (tokens below the window). */
  forceCompactOffset: number
  /** FID-2026-0814-004 H-06: recent tool results micro-compact keeps (pressure
   *  gate). Absent → 6 (runtime default). */
  microCompactMaxKeepRecent?: number
  /** FID-2026-0814-004 H-06: token floor below which micro-compact never
   *  clears (context pressure gate). Absent → no floor (count-only gate). */
  microCompactFloorTokens?: number
  /** FID-2026-0824-024 post-closure amendment: result-digest head/tail char
   *  caps for otherwise-unpreserved tool outputs in the context-pruner.
   *  Absent → pruner baked defaults (512 head / 256 tail). */
  digestHeadChars?: number
  digestTailChars?: number
  /** P3c idle compaction — off by default. */
  idleCompaction: {
    enabled: boolean
    idleAfterSeconds: number
    floorTokens: number
  }
  /** Dedicated summarization model override (OpenClaw pattern); null = parent model. */
  model: string | null
  /** P1a summary contract. */
  summary: {
    requiredSections: boolean
    exactIdentifiers: 'strict' | 'normal'
  }
}

/** YAGNI enforcement settings (P5b/P5c). */
export interface ProtocolYagniConfig {
  /** P5b — Forge `yagni_check` gate active. */
  enforced: boolean
  /** P5c — ponytail-debt ledger path relative to the project root. */
  ledger: string
}

/** P5f — Caveman telegraphic output rules (opt-in). */
export interface ProtocolCavemanConfig {
  enabled: boolean
  /** Auto-Clarity bypass: code, paths, errors, security warnings stay byte-exact. */
  autoClarity: boolean
}

/** P4 — token telemetry + cache-hit monitoring. */
export interface ProtocolTelemetryConfig {
  enabled: boolean
  /** Alert when the cached-token ratio drops this many points (e.g. 0.3 = 30). */
  cacheHitAlertDrop: number
}

/** FID-2026-0813-004 — ZTAP provenance mode from `provenance.mode`. */
export interface ProtocolProvenanceConfig {
  /** `off` disables the ledger; `record` signs + appends; `enforce` also
   *  fail-closes writes before EHEL gates have signed receipts. */
  mode: 'off' | 'record' | 'enforce'
}

/** FID-2026-0814-003 — project-scoped lifecycle hooks from `hooks:`. */
export interface ProtocolHooksConfig {
  hooks: HookConfig[]
}

export interface ProtocolConfig {
  strictMode: boolean
  language: string | null
  openFids: string[]
  /** Perfection-loop circuit breaker limit from `perfection_loop.max_iterations`. */
  maxIterations: number
  /** Top-level harness `protocol:` contract. */
  harness: ProtocolContractConfig | null
  /** Explicit single-agent `single_agent.protocol:` contract. */
  singleAgent: ProtocolContractConfig | null
  /** Legacy normalized Savant compatibility field. */
  savant: SavantProtocolConfig | null
  /** Token-optimization settings (FID-2026-0806-003). */
  compression: ProtocolCompressionConfig
  /** YAGNI enforcement settings (FID-2026-0806-003 P5b/P5c). */
  yagni: ProtocolYagniConfig
  /** P5f Caveman telegraphic output rules (opt-in). */
  caveman: ProtocolCavemanConfig
  /** P4 token telemetry + cache-hit monitoring. */
  telemetry: ProtocolTelemetryConfig
  /** FID-2026-0813-004 — ZTAP provenance mode (defaults to `record`). */
  provenance: ProtocolProvenanceConfig
  /** FID-2026-0814-003 — project-scoped lifecycle hooks (default: none). */
  hooks: HookConfig[]
}

export const DEFAULT_COMPRESSION: ProtocolCompressionConfig = {
  enabled: true,
  microCompact: false,
  keepRecentTokens: 16_384,
  autoCompactRatio: 0.8,
  forceCompactOffset: 15_000,
  idleCompaction: {
    enabled: false,
    idleAfterSeconds: 1_800,
    floorTokens: 40_000,
  },
  model: null,
  summary: {
    requiredSections: true,
    exactIdentifiers: 'strict',
  },
}

export const DEFAULT_YAGNI: ProtocolYagniConfig = {
  enforced: true,
  ledger: 'dev/YAGNI-LEDGER.md',
}

export const DEFAULT_CAVEMAN: ProtocolCavemanConfig = {
  enabled: false,
  autoClarity: true,
}

export const DEFAULT_TELEMETRY: ProtocolTelemetryConfig = {
  enabled: true,
  cacheHitAlertDrop: 0.3,
}

export const DEFAULT_PROVENANCE: ProtocolProvenanceConfig = {
  mode: 'record',
}
