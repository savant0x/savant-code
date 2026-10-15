import fs from 'node:fs'
import path from 'node:path'

import { readProtocolConfig } from './protocol-config'
import { EMBEDDED_PROTOCOL_BUNDLE } from '../constants/protocol-bundle.generated'

import type { ProtocolContractConfig } from './protocol-config'

export type ProtocolVariant = 'harness' | 'single-agent'

export {
  BOOT_LEARNINGS_PATH,
  BOOT_LEARNINGS_MAX_CHARACTERS,
} from '../constants/learnings-boot'

/** Where the resolved contract's content lives (FID-2026-0810-002 Change 2). */
export type ProtocolSource = 'local' | 'embedded'

export type ResolvedBootContract = {
  variant: ProtocolVariant
  protocolFile: string
  protocolVersion: string
  strictMode: boolean
  /** 'local' = project files in cwd; 'embedded' = baked-in harness bundle. */
  protocolSource: ProtocolSource
}

const BOOT_CONTRACTS: Record<
  ProtocolVariant,
  {
    markerFile: string
    protocolFile?: string
    configKey: 'harness' | 'singleAgent'
  }
> = {
  harness: {
    markerFile: 'ECHO.md',
    protocolFile: 'ECHO.md',
    configKey: 'harness',
  },
  'single-agent': {
    markerFile: 'ECHO-single-agent.md',
    configKey: 'singleAgent',
  },
}

function resolveMarkerProtocolFile(cwd: string, markerFile: string): string {
  const markerPath = path.resolve(cwd, markerFile)
  let marker: string
  try {
    marker = fs.readFileSync(markerPath, 'utf8')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Boot contract marker cannot be read at ${markerPath}: ${detail}.`,
    )
  }

  const match = marker.match(/```text\s*([^\s`]+)\s*```/i)
  if (!match) {
    throw new Error(
      `Boot contract marker ${markerPath} does not declare a protocol file in a text code block.`,
    )
  }
  return match[1]
}

/**
 * Tries to resolve the contract from the user's project files (local-first).
 * Returns null on ANY local resolution failure (missing config, missing
 * contract block, unreadable/empty protocol file) so the harness variant can
 * fall back to the embedded bundle instead of crashing.
 */
function tryResolveLocalContract(
  cwd: string,
  variant: ProtocolVariant,
): ResolvedBootContract | null {
  const selection = BOOT_CONTRACTS[variant]
  const config = readProtocolConfig(cwd)
  const contract = config[selection.configKey]

  if (!contract) return null

  const protocolFile =
    selection.protocolFile ??
    resolveMarkerProtocolFile(cwd, selection.markerFile)
  const protocolPath = path.resolve(cwd, protocolFile)
  try {
    const contents = fs.readFileSync(protocolPath, 'utf8')
    if (contents.trim().length === 0) {
      return null
    }
  } catch {
    return null
  }

  return {
    variant,
    protocolFile,
    protocolVersion: contract.version,
    strictMode: contract.strictMode,
    protocolSource: 'local',
  }
}

/**
 * Resolves one explicitly selected governance contract at session boot
 * (FID-2026-0810-002 Change 2 — local-first with embedded fallback).
 *
 * - **harness (the product):** local project files win when present; when the
 *   local `protocol.config.yaml`/protocol file are absent or unreadable (an
 *   npm install in an arbitrary project), the contract resolves from the
 *   embedded harness grounding-set bundle instead of crashing. Nothing is
 *   scaffolded into the user's project. A genuine build defect (missing
 *   embedded content) still fails closed with an actionable error.
 * - **single-agent (third-party bridge):** unchanged fail-closed local-only
 *   resolution. The single-agent document is NOT bundled — it belongs to a
 *   third-party harness for outside agents working on the repo, not the
 *   savant-code product (operator directive 2026-08-10).
 */
export function resolveBootContract(
  cwd: string,
  variant: ProtocolVariant,
): ResolvedBootContract {
  const local = tryResolveLocalContract(cwd, variant)
  if (local) return local

  if (variant !== 'harness') {
    // single-agent: fail closed on absent local files (no embedded fallback).
    const selection = BOOT_CONTRACTS[variant]
    const config = readProtocolConfig(cwd)
    const contract = config[selection.configKey]
    if (!contract) {
      throw new Error(
        `Boot contract configuration for protocol variant "${variant}" is missing in ${path.join(cwd, 'protocol.config.yaml')}. Define the ${selection.configKey}.protocol block before starting the session.`,
      )
    }
    const protocolFile =
      selection.protocolFile ??
      resolveMarkerProtocolFile(cwd, selection.markerFile)
    const protocolPath = path.resolve(cwd, protocolFile)
    try {
      const contents = fs.readFileSync(protocolPath, 'utf8')
      if (contents.trim().length === 0) {
        throw new Error('file is empty')
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Selected ${variant} boot protocol cannot be read at ${protocolPath}: ${detail}. Refusing to fall back to another protocol.`,
      )
    }
    // Unreachable: tryResolveLocalContract succeeded above. Kept for exhaustiveness.
    throw new Error(`Unreachable: local ${variant} resolution failed.`)
  }

  // harness fallback: embedded bundle. Build-defect fail-closed only.
  const embedded = EMBEDDED_PROTOCOL_BUNDLE
  const embeddedFiles = embedded.files as Record<string, string>
  if (
    !embedded ||
    embedded.variant !== 'harness' ||
    !embeddedFiles[embedded.protocolFile.toLowerCase()]
  ) {
    throw new Error(
      'Embedded harness protocol bundle is missing or incomplete (build defect). Run `bun run generate:protocol-bundle` and rebuild.',
    )
  }
  return {
    variant: 'harness',
    protocolFile: embedded.protocolFile,
    protocolVersion: embedded.protocolVersion,
    strictMode: embedded.strictMode,
    protocolSource: 'embedded',
  }
}

export function getProtocolContractConfig(
  contract: ResolvedBootContract,
): ProtocolContractConfig {
  return {
    version: contract.protocolVersion,
    strictMode: contract.strictMode,
  }
}
