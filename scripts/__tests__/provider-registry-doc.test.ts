/**
 * FID-2026-1005-004 — the docs/providers.md registry table is generated.
 *
 * Pins four properties:
 * 1. `renderRegistryTable()` emits exactly one row per `PROVIDER_REGISTRY`
 *    entry, in picker order, carrying that entry's label and routing prefix.
 * 2. The checked-in table between the markers is byte-identical to what the
 *    generator would write — so a hand edit, or a registry entry that lands
 *    without a regeneration, fails HERE rather than shipping silently.
 * 3. The singular is rendered for a one-model catalog (Atria AI has one).
 * 4. Every registry dimension (kind, credential env var(s), API root,
 *    protocol + dispatch-map name, catalog source + model count) is rendered
 *    from the registry value — a byte-exact comparison to the generator alone
 *    cannot catch a generator that maps a field incorrectly.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'bun:test'

import { MODEL_CATALOGS } from '@savant-code/common/providers/model-catalogs'

import { renderRegistryTable } from '../generate-provider-reference'
import { orderedProviders } from '../provider-tables'

const ROOT = resolve(import.meta.dir, '..', '..')
const DOC = resolve(ROOT, 'docs', 'providers.md')
const START = '<!-- GENERATED:registry-table-start -->'
const END = '<!-- GENERATED:registry-table-end -->'

/**
 * The committed table, sliced exactly as the generator's `renderBetween`
 * writes it: the start marker, one newline, the rendered rows, then the end
 * marker.
 */
function committedTable(): string {
  const content = readFileSync(DOC, 'utf8')
  const start = content.indexOf(START)
  const end = content.indexOf(END)
  expect(start, 'registry-table start marker').toBeGreaterThan(-1)
  expect(end, 'registry-table end marker').toBeGreaterThan(start)
  return content.slice(start + START.length + 1, end)
}

/** The full table line for one registry entry, or undefined when absent. */
function rowFor(table: string, label: string, id: string): string | undefined {
  const rowStart = `| ${label} | \`${id}\` |`
  return table.split('\n').find((line) => line.startsWith(rowStart))
}

describe('renderRegistryTable (FID-2026-1005-004)', () => {
  it('emits header + delimiter + exactly one row per registry entry', () => {
    const rows = renderRegistryTable().trimEnd().split('\n')
    expect(rows).toHaveLength(2 + orderedProviders().length)
    expect(rows[0]).toBe(
      '| Provider | ID | Kind | Credential | API root | Protocol | Catalog |',
    )
    expect(rows[1]).toBe('| --- | --- | --- | --- | --- | --- | --- |')
  })

  it('carries every provider label + routing prefix exactly once', () => {
    const table = renderRegistryTable()
    for (const config of orderedProviders()) {
      const rowStart = `| ${config.label} | \`${config.id}\` |`
      const occurrences = table.split(rowStart).length - 1
      expect(occurrences, `${config.id} row`).toBe(1)
    }
  })

  it('renders the singular for a one-model catalog and the plural otherwise', () => {
    const table = renderRegistryTable()
    // Atria AI is the one-model catalog; the singular must not read "1 models".
    expect(table).toContain('static (1 model)')
    expect(table).not.toContain('static (1 models)')
    // A multi-model catalog keeps the plural.
    expect(table).toContain('static (10 models)')
  })

  it('carries every registry dimension per row (kind, credential, API root, protocol, catalog)', () => {
    const table = renderRegistryTable()
    for (const config of orderedProviders()) {
      const row = rowFor(table, config.label, config.id)
      expect(row, `${config.id} row exists`).toBeDefined()

      // Kind — the cell between the id and credential cells.
      expect(row).toContain(`| ${config.kind} |`)

      // Credential — primary env var plus any extras, or an em dash for a
      // keyless local runtime (Ollama).
      if (config.credentials.envVar) {
        expect(row).toContain(`\`${config.credentials.envVar}\``)
        for (const extra of config.credentials.extra ?? []) {
          expect(row).toContain(`\`${extra.envVar}\``)
        }
      } else {
        expect(row).toContain('| — |')
      }

      // API root.
      expect(row).toContain(`\`${config.baseUrl}\``)

      // Protocol, naming the dispatch map where one applies.
      expect(row).toContain(config.protocol)
      if (config.protocolMap) {
        expect(row).toContain(`\`${config.protocolMap}\``)
      }

      // Catalog source, with the checked-in size for static/inline catalogs.
      const catalog = config.catalog
      switch (catalog.source) {
        case 'live':
          expect(row).toContain('| live |')
          break
        case 'none':
          expect(row).toContain('| none |')
          break
        case 'inline':
          expect(row).toContain(
            `inline (${Object.keys(catalog.models).length} model`,
          )
          break
        case 'static': {
          const count = Object.keys(MODEL_CATALOGS[catalog.modelsRef]).length
          expect(row).toContain(`static (${count} model`)
          break
        }
      }
    }
  })

  it('the committed docs/providers.md table is in sync with the registry', () => {
    expect(committedTable()).toBe(renderRegistryTable())
  })
})
