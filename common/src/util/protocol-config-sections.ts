import {
  boolOr,
  extractYamlSection,
  parseHookConfigs,
  parseYamlBool,
  parseYamlNumber,
  parseYamlString,
} from './protocol-config-parser'

import type {
  ProtocolCavemanConfig,
  ProtocolCompressionConfig,
  ProtocolProvenanceConfig,
  ProtocolTelemetryConfig,
  ProtocolYagniConfig,
} from './protocol-config-types'
import type { HookConfig } from '../types/hooks'

// FID-2026-0819-005 Loop 150: per-section config appliers, extracted
// verbatim from protocol-config.ts. Each takes the section lines plus the
// mutable defaults object and applies the YAML overrides in place.

/** Token-optimization settings (FID-2026-0806-003, design doc §5). All
 *  keys are optional — missing keys keep the defaults. */
export function applyCompressionSection(
  lines: string[],
  compression: ProtocolCompressionConfig,
): void {
  const compressionText = lines.join('\n')

  if (lines.length === 0) return
  const enabled = parseYamlBool(compressionText, 'enabled')
  const microCompact = parseYamlBool(compressionText, 'microCompact')
  const keepRecentTokens = parseYamlNumber(compressionText, 'keepRecentTokens')
  const autoCompactRatio = parseYamlNumber(compressionText, 'autoCompactRatio')
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
  // FID-2026-0824-024 post-closure amendment: digest caps.
  const digestHeadChars = parseYamlNumber(compressionText, 'digestHeadChars')
  if (digestHeadChars !== undefined) {
    compression.digestHeadChars = digestHeadChars
  }
  const digestTailChars = parseYamlNumber(compressionText, 'digestTailChars')
  if (digestTailChars !== undefined) {
    compression.digestTailChars = digestTailChars
  }
  if (model !== undefined) {
    compression.model = model
  }

  const idleLines = extractYamlSection(lines, 'idleCompaction', 2)
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

  const summaryLines = extractYamlSection(lines, 'summary', 2)
  const summaryText = summaryLines.join('\n')
  if (summaryLines.length > 0) {
    compression.summary.requiredSections = boolOr(
      parseYamlBool(summaryText, 'requiredSections'),
      compression.summary.requiredSections,
    )
    const exactIdentifiers = parseYamlString(summaryText, 'exactIdentifiers')
    if (exactIdentifiers === 'strict' || exactIdentifiers === 'normal') {
      compression.summary.exactIdentifiers = exactIdentifiers
    }
  }
}

export function applyYagniSection(
  lines: string[],
  yagni: ProtocolYagniConfig,
): void {
  const yagniText = lines.join('\n')
  if (lines.length === 0) return
  yagni.enforced = boolOr(parseYamlBool(yagniText, 'enforced'), yagni.enforced)
  const ledger = parseYamlString(yagniText, 'ledger')
  if (ledger !== undefined) {
    yagni.ledger = ledger
  }
}

export function applyCavemanSection(
  lines: string[],
  caveman: ProtocolCavemanConfig,
): void {
  const cavemanText = lines.join('\n')
  if (lines.length === 0) return
  caveman.enabled = boolOr(
    parseYamlBool(cavemanText, 'enabled'),
    caveman.enabled,
  )
  caveman.autoClarity = boolOr(
    parseYamlBool(cavemanText, 'autoClarity'),
    caveman.autoClarity,
  )
}

export function applyTelemetrySection(
  lines: string[],
  telemetry: ProtocolTelemetryConfig,
): void {
  const telemetryText = lines.join('\n')
  if (lines.length === 0) return
  telemetry.enabled = boolOr(
    parseYamlBool(telemetryText, 'enabled'),
    telemetry.enabled,
  )
  const cacheHitAlertDrop = parseYamlNumber(telemetryText, 'cacheHitAlertDrop')
  if (cacheHitAlertDrop !== undefined) {
    telemetry.cacheHitAlertDrop = cacheHitAlertDrop
  }
}

/** FID-2026-0813-004: ZTAP provenance mode. Only `off|record|enforce` are
 *  accepted; anything else (or a missing key) keeps the `record` default. */
export function applyProvenanceSection(
  lines: string[],
  provenance: ProtocolProvenanceConfig,
): void {
  const provenanceText = lines.join('\n')
  if (lines.length === 0) return
  const mode = parseYamlString(provenanceText, 'mode')
  if (mode === 'off' || mode === 'record' || mode === 'enforce') {
    provenance.mode = mode
  }
}

/** FID-2026-0814-003: project-scoped lifecycle hooks. Invalid entries are
 *  dropped fail-safe (see parseHookConfigs). */
export function applyHooksSection(lines: string[], hooks: HookConfig[]): void {
  if (lines.length === 0) return
  hooks.push(...parseHookConfigs(lines))
}
