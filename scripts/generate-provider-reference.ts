#!/usr/bin/env bun
/**
 * Generate provider reference docs from PROVIDER_REGISTRY — the single source
 * of truth (FID-2026-0809-001 Phase 5).
 *
 * Renders two checked-in surfaces between explicit markers so the hand-written
 * prose around them survives:
 *
 *   1. `.env.example` — the "Gateway providers" env-var section
 *      (markers: `# GENERATED:provider-gateway-env-start/end`).
 *   2. `cli/release/README.md` — the "Provider Setup" table rows
 *      (markers: `<!-- GENERATED:provider-table-start/end -->`).
 *
 * Usage:
 *   bun run generate:provider-docs            # rewrite in place
 *   bun run generate:provider-docs --check    # exit 1 if any file is stale
 *
 * The `--check` mode is the drift guard: a provider added to the registry but
 * not reflected in the docs (or a hand edit to a generated section) fails CI.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import type { ProviderConfig } from '@savant-code/common/providers/types'

const ROOT = resolve(import.meta.dir, '..')

const ENV_START = '# GENERATED:provider-gateway-env-start'
const ENV_END = '# GENERATED:provider-gateway-env-end'
const TABLE_START = '<!-- GENERATED:provider-table-start -->'
const TABLE_END = '<!-- GENERATED:provider-table-end -->'

const ENV_DUMMY = (envVar: string): string =>
  `dummy-${envVar.toLowerCase()}-replace-me`

/** Registry entries ordered by picker order, then id (deterministic). */
function orderedProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY).sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  )
}

// ---------------------------------------------------------------------------
// .env.example gateway section
// ---------------------------------------------------------------------------

function renderEnvSection(): string {
  const lines: string[] = []
  for (const config of orderedProviders()) {
    // Local runtimes (ollama) have no key env var — handled by detection.
    if (!config.credentials.envVar) continue

    const resolverNote =
      config.credentials.resolver === 'openrouter'
        ? ' (resolver: OR_MASTER_KEY → OPENROUTER_API_KEY → INFERENCE_API_KEY)'
        : config.credentials.resolver === 'opencode'
          ? ' (shared OpenCode key; legacy OPENCODE_GO_API_KEY honored)'
          : ''
    lines.push(`# ${config.label}: ${config.baseUrl}${resolverNote}`)
    lines.push(
      `${config.credentials.envVar}=${ENV_DUMMY(config.credentials.envVar)}`,
    )
    for (const extra of config.credentials.extra ?? []) {
      lines.push(`# ${extra.label} (${extra.envVar})`)
      lines.push(`${extra.envVar}=${ENV_DUMMY(extra.envVar)}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

// ---------------------------------------------------------------------------
// cli/release/README.md provider table
// ---------------------------------------------------------------------------

const TABLE_NOTES: Record<string, string> = {
  ollama: 'Local inference; no API key required',
  openrouter:
    'Default provider; free tier (`openrouter/free`) is the boot default; direct mode without the Savant backend',
  tokenrouter: 'Multi-provider gateway',
  tokenharbor: 'OpenAI-compatible hosted gateway',
  nvidia: 'NVIDIA-hosted inference',
  'opencode-go': 'Hosted gateway (dual-protocol)',
  commandcode: 'OpenAI-compatible hosted inference (dual-protocol)',
  nous: 'OpenAI-compatible direct inference; Portal OAuth is separate',
  kiosapi: 'OpenAI-compatible gateway (live catalog)',
  'opencode-zen':
    'Pay-per-use gateway, 70 models incl. free tier (multi-protocol)',
  cloudflare:
    'Env-only — not in the `/provider` picker; requires the account id too',
}

const TABLE_SELECTION: Record<string, string> = {
  ollama: 'Automatic detection',
  cloudflare: 'Environment configuration',
}

function renderTableRows(): string {
  const rows: string[] = []
  for (const config of orderedProviders()) {
    const selection =
      TABLE_SELECTION[config.id] ??
      (config.setupAvailable
        ? `\`/provider ${config.id}\` or \`DIRECT_PROVIDER=${config.id}\``
        : 'Environment configuration')
    const envVars =
      config.id === 'openrouter'
        ? '`OR_MASTER_KEY`, `OPENROUTER_API_KEY`, or `INFERENCE_API_KEY`'
        : config.id === 'ollama'
          ? '`OLLAMA_HOST` (optional)'
          : [
              `\`${config.credentials.envVar}\``,
              ...(config.credentials.extra?.map((e) => `\`${e.envVar}\``) ??
                []),
            ].join(' + ')
    const notes = TABLE_NOTES[config.id] ?? 'Hosted gateway'
    rows.push(`| ${config.label} | ${selection} | ${envVars} | ${notes} |`)
  }
  rows.push(
    '| Custom endpoint | Environment configuration | `INFERENCE_BASE_URL`, `INFERENCE_API_KEY` | Advanced OpenAI-compatible endpoint |',
  )
  return rows.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Marker-based section replacement
// ---------------------------------------------------------------------------

/**
 * Compute the file content with the section between markers replaced.
 * Throws when the markers are missing. Does not write.
 */
function renderBetween(
  filePath: string,
  startMarker: string,
  endMarker: string,
  replacement: string,
): string {
  const file = resolve(ROOT, filePath)
  const content = readFileSync(file, 'utf8')
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Markers not found in ${filePath} (${startMarker} … ${endMarker}). ` +
        `Add them before running the generator.`,
    )
  }
  const before = content.slice(0, startIdx + startMarker.length)
  const after = content.slice(endIdx)
  return `${before}\n${replacement}${after}`
}

function main(): void {
  const check = process.argv.includes('--check')
  const envOutput = renderEnvSection()
  const tableOutput = renderTableRows()

  const envFile = '.env.example'
  const tableFile = 'cli/release/README.md'

  const render = (file: string, start: string, end: string, output: string) =>
    renderBetween(file, start, end, output)

  if (check) {
    let stale = false
    for (const [file, start, end, output] of [
      [envFile, ENV_START, ENV_END, envOutput],
      [tableFile, TABLE_START, TABLE_END, tableOutput],
    ] as const) {
      try {
        const next = render(file, start, end, output)
        if (next !== readFileSync(resolve(ROOT, file), 'utf8')) {
          console.error(`STALE: ${file} is out of sync with the registry`)
          stale = true
        }
      } catch (error) {
        console.error(
          `STALE: ${file} — ${error instanceof Error ? error.message : String(error)}`,
        )
        stale = true
      }
    }
    if (stale) {
      console.error('Run `bun run generate:provider-docs` to regenerate.')
      process.exit(1)
    }
    console.log('Provider reference docs are up to date.')
    return
  }

  const envPath = resolve(ROOT, envFile)
  const tablePath = resolve(ROOT, tableFile)
  const envNext = render(envFile, ENV_START, ENV_END, envOutput)
  const tableNext = render(tableFile, TABLE_START, TABLE_END, tableOutput)
  const envChanged = envNext !== readFileSync(envPath, 'utf8')
  const tableChanged = tableNext !== readFileSync(tablePath, 'utf8')
  if (envChanged) writeFileSync(envPath, envNext)
  if (tableChanged) writeFileSync(tablePath, tableNext)
  console.log(`provider env reference: ${envChanged ? 'updated' : 'unchanged'}`)
  console.log(`provider table: ${tableChanged ? 'updated' : 'unchanged'}`)
}

main()
