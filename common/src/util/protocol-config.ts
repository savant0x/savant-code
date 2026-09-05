import fs from 'fs'
import path from 'path'

import {
  extractYamlSection,
  parseProtocolContract,
} from './protocol-config-parser'
import {
  applyCavemanSection,
  applyCompressionSection,
  applyHooksSection,
  applyProvenanceSection,
  applyTelemetrySection,
  applyYagniSection,
} from './protocol-config-sections'
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

    // Token-optimization settings (FID-2026-0806-003, design doc §5).
    // Section appliers extracted verbatim to protocol-config-sections.ts
    // (FID-2026-0819-005 Loop 150); each applies YAML overrides onto the
    // defaults above.
    applyCompressionSection(
      extractYamlSection(lines, 'compression', 0),
      compression,
    )
    applyYagniSection(extractYamlSection(lines, 'yagni', 0), yagni)
    applyCavemanSection(extractYamlSection(lines, 'caveman', 0), caveman)
    applyTelemetrySection(extractYamlSection(lines, 'telemetry', 0), telemetry)
    applyProvenanceSection(
      extractYamlSection(lines, 'provenance', 0),
      provenance,
    )
    applyHooksSection(extractYamlSection(lines, 'hooks', 0), hooks)
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
