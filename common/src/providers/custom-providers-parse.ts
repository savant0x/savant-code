/**
 * Custom-provider DATA parsing (FID-2026-0913-002 split from
 * custom-providers.ts, authored FID-2026-0910-004 Steps 1-2).
 *
 * A custom provider is user-authored DATA — never code (D1: no dynamic
 * imports, bundle safety preserved; hostile-attacker answer). This module
 * owns the record shape rules and the fail-closed parser that turns raw
 * JSON (settings.json / the SavantCodeClient option) into validated
 * `CustomProviderConfig` records. It is a leaf: it depends only on the
 * registry types + org slugs, never on the merged-registry machinery, so
 * `custom-providers.ts` can re-export it without a cycle.
 */

import { ORG_PREFIXES } from './org'
import { PROVIDER_REGISTRY } from './registry'
import { parseRegistryUrl } from './validate'
import { parseCustomCatalog } from './custom-providers-catalog'

import type { CustomProviderConfig } from './types'
import type { JSONValue } from '../types/json'

/** Research BYOK env vars (cli/src/utils/research-key-store.ts services). */
const RESEARCH_KEY_ENV_VARS: ReadonlySet<string> = new Set([
  'EXA_API_KEY',
  'TAVILY_API_KEY',
  'FIRECRAWL_API_KEY',
  'SERPER_API_KEY',
])

/** D1 shape: `id` slug charset matches the agent-id rule. */
export const CUSTOM_ID_PATTERN = /^[a-z0-9-]{2,32}$/
/** D1 shape: env var names are uppercase SNAKE_CASE (not starting with a digit). */
export const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/

/**
 * Reserved custom-provider ids (D2): built-in registry ids + ORG_PREFIXES
 * org slugs. Single validation truth (Law 13) — consumed by
 * `parseCustomProviders` AND the /provider add wizard's per-step checks, so
 * the two surfaces can never drift.
 */
export function getReservedCustomProviderIds(): ReadonlySet<string> {
  return new Set<string>([
    ...Object.keys(PROVIDER_REGISTRY),
    ...ORG_PREFIXES,
    // FID-2026-0911-003: the /provider command grammar (Step 8 words +
    // 'test') — a custom id must never shadow a subcommand.
    'add',
    'edit',
    'list',
    'remove',
    'test',
  ])
}

/**
 * Claimed provider env vars (D2): built-in credentials (primary + extra) +
 * research BYOK vars. Single validation truth (Law 13) shared by the parser
 * and the wizard. The registry's entries are heterogeneous literal types (not
 * every entry carries `extra`), so credential fields are read structurally
 * via a minimal record shape instead of the literal union.
 */
export function getClaimedProviderEnvVars(): ReadonlySet<string> {
  const builtinEnvVars = Object.values(
    PROVIDER_REGISTRY as unknown as Record<
      string,
      {
        credentials: {
          envVar?: string
          extra?: ReadonlyArray<{ envVar: string }>
        }
      }
    >,
  ).flatMap((config) =>
    [
      config.credentials.envVar,
      ...(config.credentials.extra ?? []).map((extra) => extra.envVar),
    ].filter((envVar): envVar is string => typeof envVar === 'string'),
  )
  return new Set<string>([...builtinEnvVars, ...RESEARCH_KEY_ENV_VARS])
}

/** Result of parsing user-authored custom-provider JSON. Never throws. */
export type ParseCustomProvidersResult = {
  configs: CustomProviderConfig[]
  problems: string[]
}

/**
 * Parse user-authored custom-provider data (the `customProviders` array from
 * settings.json / the SavantCodeClient option) into validated
 * `CustomProviderConfig` records. Fail-closed per entry: invalid entries
 * produce human-readable problems naming the entry index; only fully valid
 * entries are returned. Unrecognized extra keys are tolerated (forward
 * compatibility). Duplicate ids/env vars across entries are rejected.
 */
export function parseCustomProviders(
  value: JSONValue | undefined,
): ParseCustomProvidersResult {
  const problems: string[] = []
  const configs: CustomProviderConfig[] = []

  if (value === undefined) {
    problems.push('customProviders: field is missing')
    return { configs, problems }
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('customProviders' in value)
  ) {
    problems.push(
      'customProviders: expected an object with a customProviders array',
    )
    return { configs, problems }
  }
  const entries: unknown = (value as { customProviders: JSONValue })
    .customProviders
  if (!Array.isArray(entries)) {
    problems.push('customProviders: expected an array of provider objects')
    return { configs, problems }
  }

  const reservedIds = getReservedCustomProviderIds()
  const claimedEnvVars = getClaimedProviderEnvVars()
  const seenIds = new Set<string>()
  const seenEnvVars = new Set<string>()

  entries.forEach((entry, index) => {
    const label = `customProviders[${index}]`
    const entryProblems: string[] = []
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      problems.push(`${label}: expected an object`)
      return
    }
    const record = entry as Record<string, unknown>

    let id: string | undefined
    const rawId = record['id']
    if (typeof rawId !== 'string' || !CUSTOM_ID_PATTERN.test(rawId)) {
      entryProblems.push(
        `${label}: id must match ${CUSTOM_ID_PATTERN.source} (got ${describe(rawId)})`,
      )
    } else if (reservedIds.has(rawId)) {
      entryProblems.push(
        `${label}: id '${rawId}' is reserved (built-in provider or org prefix) — choose a different id`,
      )
    } else if (seenIds.has(rawId)) {
      entryProblems.push(`${label}: duplicate custom provider id '${rawId}'`)
    } else {
      id = rawId
      seenIds.add(rawId)
    }

    let apiKeyEnvVar: string | undefined
    const rawEnvVar = record['apiKeyEnvVar']
    if (typeof rawEnvVar !== 'string' || !ENV_VAR_PATTERN.test(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar must be an uppercase SNAKE_CASE environment variable name (got ${describe(rawEnvVar)})`,
      )
    } else if (claimedEnvVars.has(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar '${rawEnvVar}' is already claimed by a built-in provider or research service`,
      )
    } else if (seenEnvVars.has(rawEnvVar)) {
      entryProblems.push(
        `${label}: apiKeyEnvVar '${rawEnvVar}' is used by more than one custom provider`,
      )
    } else {
      apiKeyEnvVar = rawEnvVar
      seenEnvVars.add(rawEnvVar)
    }

    let baseUrl: string | undefined
    const rawBaseUrl = record['baseUrl']
    if (
      typeof rawBaseUrl !== 'string' ||
      parseRegistryUrl(rawBaseUrl) === null
    ) {
      entryProblems.push(
        `${label}: baseUrl must be a valid http(s) URL (got ${describe(rawBaseUrl)})`,
      )
    } else {
      baseUrl = rawBaseUrl
    }

    let configLabel: string | undefined
    const rawLabel = record['label']
    if (typeof rawLabel !== 'string' || rawLabel.trim() === '') {
      entryProblems.push(`${label}: label must be a non-empty string`)
    } else {
      configLabel = rawLabel
    }

    const catalog = parseCustomCatalog(
      record['catalog'],
      label,
      typeof rawId === 'string' ? rawId : undefined,
    )
    entryProblems.push(...catalog.problems)

    // FID-2026-0911-003: optional wire protocol. Absent on legacy records
    // (undefined lifts to 'openai'); when present it must be exactly
    // 'openai' or 'anthropic' (fail-closed — anything else would dispatch
    // with the wrong request schema).
    let protocol: CustomProviderConfig['protocol']
    const rawProtocol = record['protocol']
    if (rawProtocol !== undefined && rawProtocol !== null) {
      if (rawProtocol === 'openai' || rawProtocol === 'anthropic') {
        protocol = rawProtocol
      } else {
        entryProblems.push(
          `${label}: protocol must be 'openai' or 'anthropic' (got ${describe(rawProtocol)})`,
        )
      }
    }

    problems.push(...entryProblems)
    // Partial records never reach the merged view (fail-closed).
    if (
      entryProblems.length === 0 &&
      id !== undefined &&
      apiKeyEnvVar !== undefined &&
      baseUrl !== undefined &&
      configLabel !== undefined
    ) {
      configs.push({
        id,
        label: configLabel,
        baseUrl,
        apiKeyEnvVar,
        catalog: catalog.catalog,
        ...(protocol !== undefined ? { protocol } : {}),
      })
    }
  })

  return { configs, problems }
}

/** Human-readable description of an invalid field value. */
function describe(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  return typeof value
}
