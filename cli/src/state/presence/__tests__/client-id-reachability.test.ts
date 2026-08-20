import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'bun:test'

/**
 * FID-2026-0818-009 — Law-4 call-graph reachability (grep-based).
 *
 * The Discord Application Client ID is a hardcoded constant
 * (`SAVANT_DISCORD_CLIENT_ID`), not operator-mutable. A mutable id is a
 * feature-theft vector: anyone who could redirect the presence transport at a
 * third-party Discord application could claim the Savant Rich Presence asset
 * as their own. Compilation is NOT verification (Law 4) — this test greps the
 * production source and proves the constant is the ONLY id that can reach the
 * transport, mechanically, so a future regression that reintroduces a
 * configurable id fails the suite.
 */

const SRC_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

const SAVANT_CLIENT_ID = '1539431002089328710'
const REMOVED_SURFACES = [
  'loadPresenceClientId',
  'savePresenceClientId',
  'presenceClientId',
  'SAVANT_CODE_DISCORD_CLIENT_ID',
]

type SourceFile = { path: string; content: string }

function collectProductionSources(): SourceFile[] {
  const out: SourceFile[] = []
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full)
      } else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name)
      ) {
        out.push({
          path: path.relative(SRC_ROOT, full).replaceAll(path.sep, '/'),
          content: readFileSync(full, 'utf8'),
        })
      }
    }
  }
  visit(SRC_ROOT)
  return out
}

/** Every line in a file matching `pattern`, as `path:line` strings. */
function matchingLines(
  sources: SourceFile[],
  pattern: RegExp,
): Array<{ location: string; text: string }> {
  const hits: Array<{ location: string; text: string }> = []
  for (const file of sources) {
    const lines = file.content.split(/\r?\n/)
    lines.forEach((text, index) => {
      if (pattern.test(text))
        hits.push({ location: `${file.path}:${index + 1}`, text })
    })
  }
  return hits
}

describe('Discord presence client-id reachability (Law 4)', () => {
  const sources = collectProductionSources()

  it('defines the Savant client id exactly once as a compiled constant', () => {
    const definitions = matchingLines(
      sources,
      /SAVANT_DISCORD_CLIENT_ID\s*=\s*'1539431002089328710'/,
    )
    expect(definitions.map((d) => d.location)).toEqual([
      'utils/settings/preferences.ts:87',
    ])
  })

  it('contains the id literal exactly once in all production source (no fallback id)', () => {
    const literalHits = sources
      .filter((file) => file.content.includes(SAVANT_CLIENT_ID))
      .map((file) => file.path)
    expect(literalHits).toEqual(['utils/settings/preferences.ts'])
  })

  it('removes the mutable client-id surface everywhere', () => {
    for (const symbol of REMOVED_SURFACES) {
      const hits = sources.filter((file) => file.content.includes(symbol))
      expect(
        hits.map((file) => file.path),
        `"${symbol}" must be absent from production source`,
      ).toEqual([])
    }
  })

  it('boots presence from exactly one call site that passes the constant', () => {
    const bootCalls = matchingLines(sources, /bootPresence\(/).filter(
      (hit) =>
        !/function bootPresence|export function bootPresence/.test(hit.text),
    )
    expect(bootCalls.map((c) => c.location)).toEqual(['init/init-app.ts:52'])
    expect(bootCalls[0].text).toContain('SAVANT_DISCORD_CLIENT_ID')
  })

  it('passes the constant to every external getPresenceService call site', () => {
    const externalCalls = matchingLines(sources, /getPresenceService\(/).filter(
      (hit) =>
        !hit.location.startsWith('state/presence/index.ts') &&
        !/function getPresenceService|export function getPresenceService/.test(
          hit.text,
        ),
    )
    expect(externalCalls.length).toBeGreaterThan(0)
    for (const call of externalCalls) {
      expect(call.text, call.location).toMatch(
        /getPresenceService\(\s*SAVANT_DISCORD_CLIENT_ID\s*\)/,
      )
    }
  })

  it('constructs the transport only from the service id (no literal, no external input)', () => {
    const serviceConstructions = matchingLines(sources, /new PresenceService\(/)
    expect(serviceConstructions.map((c) => c.location)).toEqual([
      'state/presence/index.ts:26',
    ])

    const clientConstructions = matchingLines(sources, /new Client\(/)
    expect(clientConstructions.map((c) => c.location)).toEqual([
      'state/presence/presence-ipc.ts:43',
    ])
    // The factory receives the id as a parameter and forwards it — the only
    // value that parameter can ever hold is the compiled constant, proven by
    // the boot/getPresenceService call-site assertions above.
    expect(clientConstructions[0].text).toContain('clientId')
    expect(
      sources.find((f) => f.path === 'state/presence/presence-ipc.ts')?.content,
    ).toContain('this.createClient(this.clientId)')
  })
})
