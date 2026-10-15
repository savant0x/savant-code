#!/usr/bin/env bun
/**
 * Generate provider reference docs from PROVIDER_REGISTRY — the single source
 * of truth (FID-2026-0809-001 Phase 5).
 *
 * Renders four checked-in surfaces between explicit markers so the
 * hand-written prose around them survives:
 *
 *   1. `.env.example` — the "Gateway providers" env-var section
 *      (markers: `# GENERATED:provider-gateway-env-start/end`).
 *   2. `cli/release/README.md` — the "Provider Setup" table rows
 *      (markers: `<!-- GENERATED:provider-table-start/end -->`).
 *   3. `README.md` — the quick-start provider table rows (same markers;
 *      FID-2026-0913-005 — the main README table drifted two releases
 *      behind the registry because no generator owned it).
 *   4. `docs/providers.md` — the full registry table (markers:
 *      `<!-- GENERATED:registry-table-start/end -->`; FID-2026-1005-004 —
 *      the reference documented 4 of 24 providers because no generator
 *      owned it).
 *
 * The table renderers live in ./provider-tables (split out for the 300-line
 * quality ceiling); this module owns the surface list, the marker surgery,
 * and the drift report.
 *
 * Hand-maintained surfaces (translations, feature bullets, prefix lists)
 * cannot be byte-rendered; `--check` additionally runs the window/token
 * drift checks in ./provider-docs-drift so a provider that lands without
 * its hand-surface sync fails the same gate.
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

import { handSurfaceDrift } from './provider-docs-drift'
import {
  orderedProviders,
  renderProviderTable,
  renderRegistryTable,
} from './provider-tables'

export { renderRegistryTable }

const ROOT = resolve(import.meta.dir, '..')

const ENV_START = '# GENERATED:provider-gateway-env-start'
const ENV_END = '# GENERATED:provider-gateway-env-end'
const TABLE_START = '<!-- GENERATED:provider-table-start -->'
const TABLE_END = '<!-- GENERATED:provider-table-end -->'
const REGISTRY_TABLE_START = '<!-- GENERATED:registry-table-start -->'
const REGISTRY_TABLE_END = '<!-- GENERATED:registry-table-end -->'

const ENV_DUMMY = (envVar: string): string =>
  `dummy-${envVar.toLowerCase()}-replace-me`

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

type GeneratedSurface = {
  label: string
  file: string
  start: string
  end: string
  render: () => string
}

/** The four byte-exact GENERATED surfaces. */
const SURFACES: readonly GeneratedSurface[] = [
  {
    label: 'provider env reference',
    file: '.env.example',
    start: ENV_START,
    end: ENV_END,
    render: renderEnvSection,
  },
  {
    label: 'provider table (release README)',
    file: 'cli/release/README.md',
    start: TABLE_START,
    end: TABLE_END,
    render: renderProviderTable,
  },
  {
    label: 'provider table (README)',
    file: 'README.md',
    start: TABLE_START,
    end: TABLE_END,
    render: renderProviderTable,
  },
  {
    label: 'registry table (docs/providers.md)',
    file: 'docs/providers.md',
    start: REGISTRY_TABLE_START,
    end: REGISTRY_TABLE_END,
    render: renderRegistryTable,
  },
] as const

function main(): void {
  const check = process.argv.includes('--check')

  if (check) {
    let stale = false
    for (const surface of SURFACES) {
      try {
        const next = renderBetween(
          surface.file,
          surface.start,
          surface.end,
          surface.render(),
        )
        if (next !== readFileSync(resolve(ROOT, surface.file), 'utf8')) {
          console.error(
            `STALE: ${surface.file} is out of sync with the registry`,
          )
          stale = true
        }
      } catch (error) {
        console.error(
          `STALE: ${surface.file} — ${error instanceof Error ? error.message : String(error)}`,
        )
        stale = true
      }
    }
    const drift = handSurfaceDrift()
    if (drift.length > 0) {
      for (const issue of drift) console.error(`DRIFT: ${issue}`)
      console.error(
        'Hand-maintained provider surfaces are missing registry entries — ' +
          'sync them (see scripts/provider-docs-drift.ts).',
      )
      stale = true
    }
    if (stale) {
      console.error('Run `bun run generate:provider-docs` to regenerate.')
      process.exit(1)
    }
    console.log('Provider reference docs are up to date.')
    return
  }

  for (const surface of SURFACES) {
    const path = resolve(ROOT, surface.file)
    const next = renderBetween(
      surface.file,
      surface.start,
      surface.end,
      surface.render(),
    )
    const changed = next !== readFileSync(path, 'utf8')
    if (changed) writeFileSync(path, next)
    console.log(`${surface.label}: ${changed ? 'updated' : 'unchanged'}`)
  }
  // Write mode regenerates the byte-exact surfaces only; hand-maintained
  // surfaces are reported as a sync checklist (never silently ignored).
  const drift = handSurfaceDrift()
  if (drift.length > 0) {
    console.log('Hand-maintained surfaces need sync after this regeneration:')
    for (const issue of drift) console.log(`  - ${issue}`)
  }
}

// Guarded so the renderers stay importable (the pin suite imports
// `renderRegistryTable`); `import.meta.main` is true under `bun run`.
if (import.meta.main) main()
