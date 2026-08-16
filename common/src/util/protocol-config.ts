import fs from 'fs'
import path from 'path'

import { HOOK_EVENTS } from '../types/hooks'

import type { HookConfig, HookEvent } from '../types/hooks'

export interface ProtocolContractConfig {
  version: string
  strictMode: boolean
}

/** Backward-compatible name for the normalized Savant contract. */
export type SavantProtocolConfig = ProtocolContractConfig

function parseProtocolContract(lines: string[]): ProtocolContractConfig | null {
  const versionMatch = lines
    .join('\n')
    .match(/^\s+version:\s*["']([^"']+)["']/m)
  const strictMatch = lines.join('\n').match(/^\s+strict_mode:\s*(true|false)/m)
  if (!versionMatch || !strictMatch) return null
  return {
    version: versionMatch[1],
    strictMode: strictMatch[1] === 'true',
  }
}

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

const DEFAULT_COMPRESSION: ProtocolCompressionConfig = {
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

const DEFAULT_YAGNI: ProtocolYagniConfig = {
  enforced: true,
  ledger: 'dev/YAGNI-LEDGER.md',
}

const DEFAULT_CAVEMAN: ProtocolCavemanConfig = {
  enabled: false,
  autoClarity: true,
}

const DEFAULT_TELEMETRY: ProtocolTelemetryConfig = {
  enabled: true,
  cacheHitAlertDrop: 0.3,
}

const DEFAULT_PROVENANCE: ProtocolProvenanceConfig = {
  mode: 'record',
}

/**
 * FID-2026-0814-003: parse the `hooks:` block (a list of hook entries). Each
 * entry starts with a `- event: ...` line; following indented `key: value`
 * lines fill in the entry. Invalid entries (unknown event, missing command,
 * non-positive timeout) are DROPPED fail-safe — a malformed hook can never
 * brick a session or silently change enforcement semantics.
 */
function parseHookConfigs(lines: string[]): HookConfig[] {
  const hooks: HookConfig[] = []
  let current: Partial<HookConfig> | null = null
  let env: Record<string, string> | undefined
  let inEnv = false

  const flush = () => {
    if (!current) return
    if (
      current.event !== undefined &&
      HOOK_EVENTS.includes(current.event as HookEvent) &&
      typeof current.command === 'string' &&
      current.command.trim() !== ''
    ) {
      const timeout =
        typeof current.timeout === 'number' && current.timeout > 0
          ? current.timeout
          : undefined
      hooks.push({
        event: current.event as HookEvent,
        command: current.command.trim(),
        ...(current.matcher !== undefined ? { matcher: current.matcher } : {}),
        ...(timeout !== undefined ? { timeout } : {}),
        ...(current.cwd !== undefined ? { cwd: current.cwd } : {}),
        ...(env !== undefined && Object.keys(env).length > 0 ? { env } : {}),
      })
    }
    current = null
    env = undefined
    inEnv = false
  }

  const parseValue = (raw: string): string => {
    const trimmed = raw.trim()
    const unquoted = trimmed.replace(/^["']|["']$/g, '')
    // Strip YAML inline comments outside quotes (best-effort).
    return unquoted.split(/#/)[0].trim()
  }

  for (const line of lines) {
    if (line.trim() === '') continue
    const entryMatch = line.match(/^\s*-\s+event:\s*(.+)$/)
    if (entryMatch) {
      flush()
      current = { event: parseValue(entryMatch[1]) as HookEvent }
      inEnv = false
      continue
    }
    if (!current) continue
    const fieldMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/)
    if (!fieldMatch) {
      inEnv = false
      continue
    }
    const key = fieldMatch[1]
    const raw = fieldMatch[2]
    if (key === 'env') {
      env = {}
      inEnv = true
      continue
    }
    if (inEnv && key !== 'command' && key !== 'event') {
      // env sub-entries are `  key: value` pairs (indent deeper than 4).
      if (env) env[key] = parseValue(raw)
      continue
    }
    inEnv = false
    if (key === 'event') {
      current.event = parseValue(raw) as HookEvent
    } else if (key === 'command') {
      current.command = parseValue(raw)
    } else if (key === 'matcher') {
      current.matcher = parseValue(raw)
    } else if (key === 'timeout') {
      const parsed = Number.parseInt(raw.trim(), 10)
      if (Number.isFinite(parsed) && parsed > 0) current.timeout = parsed
    } else if (key === 'cwd') {
      current.cwd = parseValue(raw)
    }
  }
  flush()
  return hooks
}

function extractYamlSection(
  lines: string[],
  key: string,
  indentation: number,
): string[] {
  const header = `${key}:`
  const start = lines.findIndex(
    (line) =>
      line.trim() === header &&
      line.length - line.trimStart().length === indentation,
  )
  if (start === -1) return []

  const section: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') {
      section.push(line)
      continue
    }
    const lineIndentation = line.length - line.trimStart().length
    if (lineIndentation <= indentation) break
    section.push(line)
  }
  return section
}

/**
 * Reads protocol.config.yaml from the project root.
 * Returns parsed config with defaults for the Savant protocol contract.
 */
export function readProtocolConfig(cwd: string): ProtocolConfig {
  let strictMode = true
  let language: string | null = null
  let maxIterations = 10
  let harness: ProtocolContractConfig | null = null
  let singleAgent: ProtocolContractConfig | null = null
  let savant: SavantProtocolConfig | null = null
  const compression: ProtocolCompressionConfig = {
    ...DEFAULT_COMPRESSION,
    idleCompaction: { ...DEFAULT_COMPRESSION.idleCompaction },
    summary: { ...DEFAULT_COMPRESSION.summary },
  }
  const yagni: ProtocolYagniConfig = { ...DEFAULT_YAGNI }
  const caveman: ProtocolCavemanConfig = { ...DEFAULT_CAVEMAN }
  const telemetry: ProtocolTelemetryConfig = { ...DEFAULT_TELEMETRY }
  const provenance: ProtocolProvenanceConfig = { ...DEFAULT_PROVENANCE }
  const hooks: HookConfig[] = []

  try {
    const configPath = path.join(cwd, 'protocol.config.yaml')
    const content = fs.readFileSync(configPath, 'utf8')
    const lines = content.split(/\r?\n/)

    const protocolLines = extractYamlSection(lines, 'protocol', 0)
    const protocolStrictMatch = protocolLines
      .join('\n')
      .match(/^\s+strict_mode:\s*(true|false)/m)
    if (protocolStrictMatch) {
      strictMode = protocolStrictMatch[1] === 'true'
    }
    harness = parseProtocolContract(protocolLines)

    // perfection_loop.max_iterations drives the FSM circuit breaker
    // (transition-phase.ts). FID-2026-0803-001 ECHO-3.
    const perfectionLoopLines = extractYamlSection(lines, 'perfection_loop', 0)
    const maxIterationsMatch = perfectionLoopLines
      .join('\n')
      .match(/^\s+max_iterations:\s*(\d+)/m)
    if (maxIterationsMatch) {
      const parsed = Number.parseInt(maxIterationsMatch[1], 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        maxIterations = parsed
      }
    }

    // Single-agent protocol documents use `single_agent.protocol`. Normalize
    // that contract into the Savant runtime shape while also accepting the
    // forward-looking `savant.protocol` alias.
    const singleAgentLines = extractYamlSection(lines, 'single_agent', 0)
    const savantLines = extractYamlSection(lines, 'savant', 0)
    const singleAgentProtocolLines = extractYamlSection(
      singleAgentLines,
      'protocol',
      2,
    )
    const savantProtocolLines = extractYamlSection(savantLines, 'protocol', 2)
    singleAgent = parseProtocolContract(singleAgentProtocolLines)
    const explicitSavant = parseProtocolContract(savantProtocolLines)
    // Preserve the historical normalized compatibility field while exposing
    // both explicit contracts for variant-aware boot resolution.
    savant = explicitSavant ?? singleAgent

    const langMatch = lines
      .map((line) => line.match(/^language:\s*["']([^"']+)["']/))
      .find((match): match is RegExpMatchArray => match !== null)
    if (langMatch && langMatch[1] !== 'CHANGE_ME') {
      language = langMatch[1]
    }

    // Token-optimization settings (FID-2026-0806-003, design doc §5). All
    // keys are optional — missing keys keep the defaults above, so old configs
    // and configs that only override one field behave predictably.
    const compressionLines = extractYamlSection(lines, 'compression', 0)
    const compressionText = compressionLines.join('\n')
    const parseBool = (text: string, key: string): boolean | undefined => {
      const match = text.match(new RegExp(`^\\s+${key}:\\s*(true|false)`, 'm'))
      return match ? match[1] === 'true' : undefined
    }
    const parseNumber = (text: string, key: string): number | undefined => {
      const match = text.match(new RegExp(`^\\s+${key}:\\s*([0-9.]+)`, 'm'))
      return match ? Number.parseFloat(match[1]) : undefined
    }
    const parseString = (text: string, key: string): string | undefined => {
      const match = text.match(
        new RegExp(`^\\s+${key}:\\s*["']?([^#\\s"']+)["']?`, 'm'),
      )
      return match ? match[1] : undefined
    }
    const boolOr = (v: boolean | undefined, d: boolean): boolean => v ?? d

    if (compressionLines.length > 0) {
      const enabled = parseBool(compressionText, 'enabled')
      const microCompact = parseBool(compressionText, 'microCompact')
      const keepRecentTokens = parseNumber(compressionText, 'keepRecentTokens')
      const autoCompactRatio = parseNumber(compressionText, 'autoCompactRatio')
      const forceCompactOffset = parseNumber(
        compressionText,
        'forceCompactOffset',
      )
      const microCompactMaxKeepRecent = parseNumber(
        compressionText,
        'microCompactMaxKeepRecent',
      )
      const microCompactFloorTokens = parseNumber(
        compressionText,
        'microCompactFloorTokens',
      )
      const model = parseString(compressionText, 'model')
      compression.enabled = boolOr(enabled, compression.enabled)
      compression.microCompact = boolOr(microCompact, compression.microCompact)
      if (keepRecentTokens !== undefined) {
        compression.keepRecentTokens = keepRecentTokens
      }
      if (autoCompactRatio !== undefined) {
        compression.autoCompactRatio = autoCompactRatio
      }
      if (forceCompactOffset !== undefined) {
        compression.forceCompactOffset = forceCompactOffset
      }
      if (microCompactMaxKeepRecent !== undefined) {
        compression.microCompactMaxKeepRecent = microCompactMaxKeepRecent
      }
      if (microCompactFloorTokens !== undefined) {
        compression.microCompactFloorTokens = microCompactFloorTokens
      }
      if (model !== undefined) {
        compression.model = model
      }

      const idleLines = extractYamlSection(
        compressionLines,
        'idleCompaction',
        2,
      )
      const idleText = idleLines.join('\n')
      if (idleLines.length > 0) {
        compression.idleCompaction.enabled = boolOr(
          parseBool(idleText, 'enabled'),
          compression.idleCompaction.enabled,
        )
        const idleAfterSeconds = parseNumber(idleText, 'idleAfterSeconds')
        if (idleAfterSeconds !== undefined) {
          compression.idleCompaction.idleAfterSeconds = idleAfterSeconds
        }
        const floorTokens = parseNumber(idleText, 'floorTokens')
        if (floorTokens !== undefined) {
          compression.idleCompaction.floorTokens = floorTokens
        }
      }

      const summaryLines = extractYamlSection(compressionLines, 'summary', 2)
      const summaryText = summaryLines.join('\n')
      if (summaryLines.length > 0) {
        compression.summary.requiredSections = boolOr(
          parseBool(summaryText, 'requiredSections'),
          compression.summary.requiredSections,
        )
        const exactIdentifiers = parseString(summaryText, 'exactIdentifiers')
        if (exactIdentifiers === 'strict' || exactIdentifiers === 'normal') {
          compression.summary.exactIdentifiers = exactIdentifiers
        }
      }
    }

    const yagniLines = extractYamlSection(lines, 'yagni', 0)
    const yagniText = yagniLines.join('\n')
    if (yagniLines.length > 0) {
      yagni.enforced = boolOr(parseBool(yagniText, 'enforced'), yagni.enforced)
      const ledger = parseString(yagniText, 'ledger')
      if (ledger !== undefined) {
        yagni.ledger = ledger
      }
    }

    const cavemanLines = extractYamlSection(lines, 'caveman', 0)
    const cavemanText = cavemanLines.join('\n')
    if (cavemanLines.length > 0) {
      caveman.enabled = boolOr(
        parseBool(cavemanText, 'enabled'),
        caveman.enabled,
      )
      caveman.autoClarity = boolOr(
        parseBool(cavemanText, 'autoClarity'),
        caveman.autoClarity,
      )
    }

    const telemetryLines = extractYamlSection(lines, 'telemetry', 0)
    const telemetryText = telemetryLines.join('\n')
    if (telemetryLines.length > 0) {
      telemetry.enabled = boolOr(
        parseBool(telemetryText, 'enabled'),
        telemetry.enabled,
      )
      const cacheHitAlertDrop = parseNumber(telemetryText, 'cacheHitAlertDrop')
      if (cacheHitAlertDrop !== undefined) {
        telemetry.cacheHitAlertDrop = cacheHitAlertDrop
      }
    }

    // FID-2026-0813-004: ZTAP provenance mode. Only `off|record|enforce` are
    // accepted; anything else (or a missing key) keeps the `record` default.
    const provenanceLines = extractYamlSection(lines, 'provenance', 0)
    const provenanceText = provenanceLines.join('\n')
    if (provenanceLines.length > 0) {
      const mode = parseString(provenanceText, 'mode')
      if (mode === 'off' || mode === 'record' || mode === 'enforce') {
        provenance.mode = mode
      }
    }

    // FID-2026-0814-003: project-scoped lifecycle hooks. Invalid entries are
    // dropped fail-safe (see parseHookConfigs).
    const hooksLines = extractYamlSection(lines, 'hooks', 0)
    if (hooksLines.length > 0) {
      hooks.push(...parseHookConfigs(hooksLines))
    }
  } catch {
    // File doesn't exist or can't be read — use defaults
  }

  const openFids = scanOpenFids(cwd)

  return {
    strictMode,
    language,
    openFids,
    maxIterations,
    harness,
    singleAgent,
    savant,
    compression,
    yagni,
    caveman,
    telemetry,
    provenance,
    hooks,
  }
}

/**
 * Scans dev/fids/ for open FID files (FID-*.md, not in archive/).
 * Exported for direct use by the FSM transition handler to avoid
 * re-reading protocol.config.yaml on every transition.
 */
export function scanOpenFids(cwd: string): string[] {
  const fidsDir = path.join(cwd, 'dev', 'fids')
  try {
    const entries = fs.readdirSync(fidsDir)
    return entries.filter(
      (entry) =>
        entry.startsWith('FID-') &&
        entry.endsWith('.md') &&
        !entry.includes('archive'),
    )
  } catch {
    return []
  }
}
