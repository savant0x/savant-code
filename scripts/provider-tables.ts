/**
 * Provider table renderers (split from `generate-provider-reference.ts` for
 * the 300-line quality ceiling — FID-2026-1005-004).
 *
 * Two tables derive from `PROVIDER_REGISTRY`, the single source of truth:
 *
 * - `renderProviderTable()` — the quick-start table (Provider / Selection /
 *   Environment variable / Notes), written into `README.md` and
 *   `cli/release/README.md`.
 * - `renderRegistryTable()` — the full registry view (Provider / ID / Kind /
 *   Credential / API root / Protocol / Catalog), written into
 *   `docs/providers.md`.
 *
 * Both are pure functions of the registry: a new entry appears in each on the
 * next `generate:provider-docs` run, with no hand edit.
 */
import { MODEL_CATALOGS } from '@savant-code/common/providers/model-catalogs'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import type { ProviderConfig } from '@savant-code/common/providers/types'

/** Registry entries ordered by picker order, then id (deterministic). */
export function orderedProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY).sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  )
}

// ---------------------------------------------------------------------------
// Quick-start table (README.md + cli/release/README.md)
// ---------------------------------------------------------------------------

/** Per-provider Notes cell. Falls back to `Hosted gateway`. */
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
  apinex: 'Hosted gateway with an authenticated live model catalog',
  orcarouter:
    'Multi-provider gateway with a live model catalog (free tier currently gated vendor-side on GitHub account linkage)',
  bai: 'OpenAI-compatible gateway with an authenticated live model catalog',
  hcnsec: 'OpenAI-compatible gateway on an audited static 7-model allowlist',
  tokenbom: 'OpenAI-compatible gateway on an audited static 7-model allowlist',
  'opencode-zen':
    'Pay-per-use gateway, 70 models incl. free tier (multi-protocol)',
  cloudflare:
    'Workers AI gateway; the `/provider` flow prompts for the token, then the account id (env vars take precedence)',
}

/** Per-provider Selection cell override. */
const TABLE_SELECTION: Record<string, string> = {
  ollama: 'Automatic detection',
}

/**
 * Full contiguous provider table — header + delimiter + rows. The markers
 * wrap the ENTIRE table: an HTML comment between the delimiter row and the
 * body rows terminates the table token, which un-exempts the rows from
 * markdownlint MD013's `tables: false` and breaks strict renderers
 * (FID-2026-0913-005 Loop 2 — the original marker placement had shipped
 * broken in cli/release/README.md, masked by that file's MD013 disable).
 */
export function renderProviderTable(): string {
  const rows: string[] = [
    '| Provider | Selection | Environment variable | Notes |',
    '| --- | --- | --- | --- |',
  ]
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
    '| Custom endpoint | Environment configuration | `INFERENCE_BASE_URL`, `INFERENCE_API_KEY` | Advanced OpenAI-compatible endpoint; authorized by `INFERENCE_API_KEY` alone |',
  )
  return rows.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Full registry table (docs/providers.md)
// ---------------------------------------------------------------------------

/** Credential cell: the primary env var plus any extras, or an em dash. */
function credentialCell(config: ProviderConfig): string {
  const primary = config.credentials.envVar
  if (primary === undefined) return '—'
  const extras = (config.credentials.extra ?? []).map((e) => `\`${e.envVar}\``)
  return [`\`${primary}\``, ...extras].join(' + ')
}

/** Protocol cell: the wire protocol, naming the dispatch map where one applies. */
function protocolCell(config: ProviderConfig): string {
  return config.protocolMap === undefined
    ? config.protocol
    : `${config.protocol} (\`${config.protocolMap}\`)`
}

/** "1 model" / "N models" — the singular is reachable (Atria AI has one). */
function modelCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'model' : 'models'}`
}

/** Catalog cell: the source, plus the checked-in size for a static catalog. */
function catalogCell(config: ProviderConfig): string {
  const catalog = config.catalog
  switch (catalog.source) {
    case 'live':
      return 'live'
    case 'none':
      return 'none'
    case 'inline':
      return `inline (${modelCountLabel(Object.keys(catalog.models).length)})`
    case 'static': {
      const count = modelCountLabel(
        Object.keys(MODEL_CATALOGS[catalog.modelsRef]).length,
      )
      // FID-2026-1005-009: evidence classes render into the registry table
      // (reported-unverified prints as such — never dressed up as a fact).
      const ev = catalog.evidence
      return ev === undefined
        ? `static (${count})`
        : `static (${count}; evidence: ${ev.class}${ev.verified ? ` ${ev.verified}` : ''})`
    }
  }
}

/**
 * Full registry table — one row per `PROVIDER_REGISTRY` entry, ordered exactly
 * as the picker orders them. Every cell renders from `ProviderConfig` alone
 * (plus `MODEL_CATALOGS` for the static model count), so a new registry entry
 * appears here on the next `generate:provider-docs` run with no hand edit
 * (FID-2026-1005-004).
 */
export function renderRegistryTable(): string {
  const rows: string[] = [
    '| Provider | ID | Kind | Credential | API root | Protocol | Catalog |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const config of orderedProviders()) {
    rows.push(
      `| ${config.label} | \`${config.id}\` | ${config.kind} | ` +
        `${credentialCell(config)} | \`${config.baseUrl}\` | ` +
        `${protocolCell(config)} | ${catalogCell(config)} |`,
    )
  }
  return rows.join('\n') + '\n'
}
