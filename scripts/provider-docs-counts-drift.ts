/**
 * Docs-count recompute gate + fact-evidence baseline diff
 * (FID-2026-1005-009, converged design decisions 2 and 3).
 *
 * One script, two checks (the `audit-gate-env-parity.ts` probe route — an
 * independently runnable check exiting 0 clean / 1 naming the issues):
 *
 * 1. **Roster-count recompute.** Every `static <N>-model` claim in the
 *    hand-maintained provider prose must attribute to a provider whose
 *    static catalog size equals N (derived from `MODEL_CATALOGS`, the one
 *    truth — Law 13). The mapping is bounded to this claim class; the
 *    generated surfaces are already byte-gated by
 *    `generate:provider-docs:check` and are not re-checked here.
 * 2. **Changed-fact rule.** Facts derived from the registry are diffed
 *    against the last generated baseline — the checked-in
 *    `docs/providers.md` registry table. A numeric fact that is new or
 *    changed without an `evidence` record fails, naming the fact and its
 *    old → new values. A missing/unparseable baseline grandfathers
 *    (honest default: none evidenced yet, never "all evidenced").
 *
 * Only derivable counts enter the mapping — an underivable prose number is
 * either sourced via `evidence` or deleted (converged decision 3).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { changedFactsNeedingEvidence } from '@savant-code/common/providers/fact-evidence'
import { MODEL_CATALOGS } from '@savant-code/common/providers/model-catalogs'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { registryFactRecords } from '@savant-code/common/providers/validate'

import type { FactRecord } from '@savant-code/common/providers/fact-evidence'

const ROOT = resolve(import.meta.dir, '..')

/** The generated registry table — the "last generated baseline" source. */
const GENERATED_REGISTRY_TABLE = 'docs/providers.md'

/**
 * Hand-maintained surfaces carrying the roster-claim class, plus the
 * `TABLE_NOTES` source (its strings render verbatim into the README
 * tables). Word numbers are normalized (the Atria "one-model" claim).
 */
const CLAIM_SOURCES: readonly string[] = [
  'docs/features.md',
  'docs/installation.md',
  'README.md',
  'README.zh-CN.md',
  'cli/release/README.md',
  'scripts/provider-tables.ts',
]

const CLAIM_PATTERN = /static ([a-z0-9]+)-model/g

/** Bounded word→number normalization for the claim token. */
const WORD_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
}

function normalizeClaim(token: string): number | undefined {
  const asNumber = Number(token)
  if (Number.isInteger(asNumber)) return asNumber
  return WORD_NUMBERS[token.toLowerCase()]
}

/**
 * Parse the generated registry table into baseline fact records: one
 * `.catalog.model-count` per row (static or inline cell). Returns
 * undefined when the table is absent/unparseable — the bootstrap
 * grandfather rule.
 */
export function parseCatalogBaseline(table: string): FactRecord[] | undefined {
  const facts: FactRecord[] = []
  for (const line of table.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|')
    // | Provider | ID | Kind | Credential | API root | Protocol | Catalog |
    // split('|') yields 9 cells with the catalog cell at index 7.
    if (cells.length < 8) continue
    const id = cells[2]?.trim().replace(/^`|`$/g, '') ?? ''
    const catalog = cells[7]?.trim() ?? ''
    // The count may be followed by an evidence suffix
    // (`static (27 models; evidence: …)`) — match to the word boundary.
    const match = /^(?:static|inline) \((\d+) models?\b/.exec(catalog)
    if (match === null || id === '') continue
    facts.push({ key: `${id}.catalog.model-count`, value: Number(match[1]) })
  }
  return facts.length > 0 ? facts : undefined
}

/**
 * Attribute a claim line to a registry entry: the entry whose label or id
 * occurs closest BEFORE the claim (the twin-of-Atria line names two
 * providers; the claim belongs to the one introducing it).
 *
 * Both matches use a hyphen-excluding boundary: "OpenAI-compatible" is the
 * wire-protocol adjective, not the `openai` provider — without the exclusion
 * every gateway line attributes to openai (the measured mis-attribution).
 */
function boundaryMatch(text: string, needle: string): number {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?<![a-zA-Z])${escaped}(?![-a-zA-Z])`).exec(text)
  return match?.index ?? -1
}

function attributeClaim(line: string, claimIndex: number): string | undefined {
  let best: { id: string; at: number } | undefined
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    // A non-match (-1) must not erase a real position via Math.min.
    const positions = [
      boundaryMatch(line, config.label),
      boundaryMatch(line, config.id),
    ].filter((at) => at !== -1)
    const first =
      positions.length > 0 ? Math.min(...positions) : Number.POSITIVE_INFINITY
    if (first < claimIndex && (best === undefined || first > best.at)) {
      best = { id: config.id, at: first }
    }
  }
  return best?.id
}

/**
 * The roster-count recompute. `read` returns undefined for an unreadable
 * file (the check runs over whatever exists). Issues name the claim site,
 * the claimed number, and the derived truth.
 */
export function checkRosterClaims(
  read: (file: string) => string | undefined,
): string[] {
  const issues: string[] = []
  for (const file of CLAIM_SOURCES) {
    const content = read(file)
    if (content === undefined) continue
    for (const [lineIdx, line] of content.split('\n').entries()) {
      CLAIM_PATTERN.lastIndex = 0
      for (
        let m = CLAIM_PATTERN.exec(line);
        m !== null;
        m = CLAIM_PATTERN.exec(line)
      ) {
        const claimed = normalizeClaim(m[1])
        if (claimed === undefined) continue
        const id = attributeClaim(line, m.index)
        if (id === undefined) {
          issues.push(
            `${file}:${lineIdx + 1} — roster claim '${m[0]}' attributes to no ` +
              `registry provider (label must precede the claim)`,
          )
          continue
        }
        const catalog = Object.values(PROVIDER_REGISTRY).find(
          (provider) => provider.id === id,
        )?.catalog
        if (catalog === undefined || catalog.source !== 'static') {
          issues.push(
            `${file}:${lineIdx + 1} — roster claim '${m[0]}' about '${id}', ` +
              `which has no static catalog to derive it from`,
          )
          continue
        }
        const derived = Object.keys(MODEL_CATALOGS[catalog.modelsRef]).length
        if (derived !== claimed) {
          issues.push(
            `${file}:${lineIdx + 1} — roster claim '${m[0]}' drifts: claimed ` +
              `${claimed}, registry derives ${derived} (${id} catalog)`,
          )
        }
      }
    }
  }
  return issues
}

/**
 * The changed-fact rule against the checked-in generated baseline.
 * A missing baseline file grandfathers (bootstrap rule).
 */
export function checkFactDrift(
  read: (file: string) => string | undefined,
): string[] {
  const baseline = parseCatalogBaseline(read(GENERATED_REGISTRY_TABLE) ?? '')
  return changedFactsNeedingEvidence(
    registryFactRecords(PROVIDER_REGISTRY),
    baseline,
  )
}

function main(): void {
  const read = (file: string): string | undefined => {
    try {
      return readFileSync(resolve(ROOT, file), 'utf8')
    } catch {
      return undefined
    }
  }
  const issues = [...checkRosterClaims(read), ...checkFactDrift(read)]
  if (issues.length > 0) {
    for (const issue of issues) console.error(`ISSUE: ${issue}`)
    console.error(
      `Provider docs counts drift from the registry (${issues.length} issue(s)).`,
    )
    process.exit(1)
  }
  console.log(
    'Provider docs counts match the registry; no unevidenced fact drift.',
  )
}

// Guarded so the checks stay importable by the declared gate suite.
if (import.meta.main) main()
