import fs from 'fs'
import path from 'path'

import {
  boolOr,
  extractYamlSection,
  parseHookConfigs,
  parseProtocolContract,
  parseYamlBool,
  parseYamlNumber,
  parseYamlString,
} from './protocol-config-parser'
import {
  DEFAULT_CAVEMAN,
  DEFAULT_COMPRESSION,
  DEFAULT_PROVENANCE,
  DEFAULT_TELEMETRY,
  DEFAULT_YAGNI,
} from './protocol-config-types'

import type {
  ProtocolCavemanConfig,
  ProtocolCompressionConfig,
  ProtocolConfig,
  ProtocolContractConfig,
  ProtocolProvenanceConfig,
  ProtocolTelemetryConfig,
  ProtocolYagniConfig,
  SavantProtocolConfig,
} from './protocol-config-types'
import type { HookConfig } from '../types/hooks'

// Re-export the protocol config contract + defaults from the original path.
export type {
  ProtocolCavemanConfig,
  ProtocolCompressionConfig,
  ProtocolConfig,
  ProtocolContractConfig,
  ProtocolHooksConfig,
  ProtocolProvenanceConfig,
  ProtocolTelemetryConfig,
  ProtocolYagniConfig,
  SavantProtocolConfig,
} from './protocol-config-types'

/** Reads protocol.config.yaml from the project root with defaults. */
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

    // Single-agent documents use `single_agent.protocol`; normalize it into
    // the runtime shape while accepting the `savant.protocol` alias.
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
    // Preserve the compatibility field; expose both explicit contracts.
    savant = explicitSavant ?? singleAgent

    const langMatch = lines
      .map((line) => line.match(/^language:\s*["']([^"']+)["']/))
      .find((match): match is RegExpMatchArray => match !== null)
    if (langMatch && langMatch[1] !== 'CHANGE_ME') {
      language = langMatch[1]
    }

    // Token-optimization settings (FID-2026-0806-003, design doc §5). All
    // keys are optional — missing keys keep the defaults above.
    const compressionLines = extractYamlSection(lines, 'compression', 0)
    const compressionText = compressionLines.join('\n')

    if (compressionLines.length > 0) {
      const enabled = parseYamlBool(compressionText, 'enabled')
      const microCompact = parseYamlBool(compressionText, 'microCompact')
      const keepRecentTokens = parseYamlNumber(
        compressionText,
        'keepRecentTokens',
      )
      const autoCompactRatio = parseYamlNumber(
        compressionText,
        'autoCompactRatio',
      )
      const forceCompactOffset = parseYamlNumber(
        compressionText,
        'forceCompactOffset',
      )
      const microCompactMaxKeepRecent = parseYamlNumber(
        compressionText,
        'microCompactMaxKeepRecent',
      )
      const microCompactFloorTokens = parseYamlNumber(
        compressionText,
        'microCompactFloorTokens',
      )
      const model = parseYamlString(compressionText, 'model')
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
          parseYamlBool(idleText, 'enabled'),
          compression.idleCompaction.enabled,
        )
        const idleAfterSeconds = parseYamlNumber(idleText, 'idleAfterSeconds')
        if (idleAfterSeconds !== undefined) {
          compression.idleCompaction.idleAfterSeconds = idleAfterSeconds
        }
        const floorTokens = parseYamlNumber(idleText, 'floorTokens')
        if (floorTokens !== undefined) {
          compression.idleCompaction.floorTokens = floorTokens
        }
      }

      const summaryLines = extractYamlSection(compressionLines, 'summary', 2)
      const summaryText = summaryLines.join('\n')
      if (summaryLines.length > 0) {
        compression.summary.requiredSections = boolOr(
          parseYamlBool(summaryText, 'requiredSections'),
          compression.summary.requiredSections,
        )
        const exactIdentifiers = parseYamlString(
          summaryText,
          'exactIdentifiers',
        )
        if (exactIdentifiers === 'strict' || exactIdentifiers === 'normal') {
          compression.summary.exactIdentifiers = exactIdentifiers
        }
      }
    }

    const yagniLines = extractYamlSection(lines, 'yagni', 0)
    const yagniText = yagniLines.join('\n')
    if (yagniLines.length > 0) {
      yagni.enforced = boolOr(
        parseYamlBool(yagniText, 'enforced'),
        yagni.enforced,
      )
      const ledger = parseYamlString(yagniText, 'ledger')
      if (ledger !== undefined) {
        yagni.ledger = ledger
      }
    }

    const cavemanLines = extractYamlSection(lines, 'caveman', 0)
    const cavemanText = cavemanLines.join('\n')
    if (cavemanLines.length > 0) {
      caveman.enabled = boolOr(
        parseYamlBool(cavemanText, 'enabled'),
        caveman.enabled,
      )
      caveman.autoClarity = boolOr(
        parseYamlBool(cavemanText, 'autoClarity'),
        caveman.autoClarity,
      )
    }

    const telemetryLines = extractYamlSection(lines, 'telemetry', 0)
    const telemetryText = telemetryLines.join('\n')
    if (telemetryLines.length > 0) {
      telemetry.enabled = boolOr(
        parseYamlBool(telemetryText, 'enabled'),
        telemetry.enabled,
      )
      const cacheHitAlertDrop = parseYamlNumber(
        telemetryText,
        'cacheHitAlertDrop',
      )
      if (cacheHitAlertDrop !== undefined) {
        telemetry.cacheHitAlertDrop = cacheHitAlertDrop
      }
    }

    // FID-2026-0813-004: ZTAP provenance mode. Only `off|record|enforce` are
    // accepted; anything else (or a missing key) keeps the `record` default.
    const provenanceLines = extractYamlSection(lines, 'provenance', 0)
    const provenanceText = provenanceLines.join('\n')
    if (provenanceLines.length > 0) {
      const mode = parseYamlString(provenanceText, 'mode')
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

/** Scans dev/fids/ for open FID files (FID-*.md, not in archive/). */
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
