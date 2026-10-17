/**
 * FID-2026-1017-005 — durable probe for the boot free-options surface.
 *
 * Proves, against real files in a temp directory and a fake clock:
 *  - the shared view carries every lane and offer;
 *  - the artifact header verifies at its own path, rejects an edited body and
 *    rejects a copy at another path;
 *  - the boot resolver shows a ≤12 h cache with its age, refreshes an older
 *    one, and labels a failed refresh STALE instead of current.
 *
 * Exit 0 when every assertion holds; exit 1 with the failed assertion.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  renderFreeOptionsArtifact,
  verifyFreeOptionsArtifact,
} from '../../cli/src/utils/free-options-artifact'
import {
  bootFreshnessLabel,
  resolveBootFreeOptions,
} from '../../cli/src/utils/free-options-boot'
import { buildFreeOptionsView } from '../../cli/src/utils/free-options-view'

import type { FreeOptionsReport } from '../../cli/src/utils/free-options-types'

const NOW = Date.parse('2026-10-17T12:00:00.000Z')
const failures: string[] = []

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS ${name}`)
  } else {
    failures.push(name)
    console.log(`FAIL ${name}`)
  }
}

function reportAt(fetchedAt: string | null): FreeOptionsReport {
  return {
    fetchedAt,
    stale: false,
    catalogSource: fetchedAt ? 'cache' : 'none',
    configuredProviders: ['OpenRouter'],
    wiredFree: [
      {
        providerId: 'openrouter',
        label: 'OpenRouter',
        models: ['z-ai/glm-5.3-flash', 'z-ai/glm-5.3'],
      },
    ],
    notWired: [
      {
        providerId: 'groq',
        label: 'Groq',
        models: ['llama-4-scout'],
        setupCommand: '/provider groq',
      },
    ],
    localFree: [],
    discoveryOffers: [
      {
        title: 'Vercel tokens',
        category: 'API providers',
        deadlineLabel: 'advertised deadline 2026-10-31',
        providerLabels: ['Vercel AI Gateway'],
        url: 'https://freetokens.custats.info/offers/vercel.html',
      },
    ],
    discoveryOffersEndingSoon: 0,
  }
}

function verified(path: string) {
  return { ok: true, path }
}

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-free-probe-'))
  try {
    const report = reportAt('2026-10-17T09:00:00.000Z')
    const markdownPath = path.join(dir, 'free-options.md')
    const view = buildFreeOptionsView(report, {
      markdownPath,
      generatedAt: '2026-10-17T12:00:00.000Z',
    })

    check(
      'view carries every wired/not-wired model id',
      view.header.counts.wiredModels === 2 &&
        view.header.counts.notWiredModels === 1 &&
        view.wired[0]?.models.includes('z-ai/glm-5.3') === true &&
        view.notWired[0]?.models.includes('llama-4-scout') === true,
    )
    check(
      'view carries the offer row',
      view.header.counts.offers === 1 &&
        view.offers[0]?.rows[0]?.title === 'Vercel tokens',
    )

    const artifact = renderFreeOptionsArtifact(view)
    fs.writeFileSync(markdownPath, artifact.text)
    const ok = verifyFreeOptionsArtifact({ report, path: markdownPath })
    check('artifact verifies at its resolved path', ok.ok === true)
    check(
      'artifact header names the path and both timestamps',
      artifact.text.includes(`path: ${markdownPath}`) &&
        artifact.text.includes('fetchedAt: 2026-10-17T09:00:00.000Z') &&
        artifact.text.includes('generatedAt: 2026-10-17T12:00:00.000Z'),
    )

    // Same path as the header claims, so the hash check (not the path check)
    // is what rejects it.
    fs.writeFileSync(markdownPath, artifact.text.replace('Groq', 'Evil'))
    check(
      'an edited body fails the generation hash',
      verifyFreeOptionsArtifact({ report, path: markdownPath }).reason ===
        'generation-mismatch',
    )

    const copy = path.join(dir, 'copy.md')
    fs.writeFileSync(copy, artifact.text)
    check(
      'a copy at another path is rejected',
      verifyFreeOptionsArtifact({ report, path: copy }).reason ===
        'path-mismatch',
    )

    // Freshness matrix with a fake clock; the refresh is injected.
    const fresh = reportAt(new Date(NOW - 3 * 3600_000).toISOString())
    let refreshCalls = 0
    const cached = await resolveBootFreeOptions({
      now: () => NOW,
      readCached: () => fresh,
      refresh: async () => {
        refreshCalls += 1
        return fresh
      },
      verify: () => verified(markdownPath),
    })
    check(
      'a 3h cache posts as fresh with its age and no fetch',
      cached.source === 'cache' &&
        refreshCalls === 0 &&
        bootFreshnessLabel(cached) === 'fresh · cached 3h ago',
    )

    const aged = reportAt(new Date(NOW - 13 * 3600_000).toISOString())
    const refreshed = reportAt(new Date(NOW - 60_000).toISOString())
    refreshed.catalogSource = 'network'
    const refreshedSnapshot = await resolveBootFreeOptions({
      now: () => NOW,
      readCached: () => aged,
      refresh: async () => refreshed,
      verify: () => verified(markdownPath),
    })
    check(
      'a 13h cache refreshes and is labelled refreshed',
      refreshedSnapshot.source === 'refresh' &&
        bootFreshnessLabel(refreshedSnapshot) === 'refreshed just now',
    )

    const stale = await resolveBootFreeOptions({
      now: () => NOW,
      readCached: () => aged,
      refresh: async () => {
        throw new Error('offline')
      },
      verify: () => verified(markdownPath),
    })
    check(
      'a failed refresh is STALE, never fresh',
      stale.source === 'stale-cache' &&
        bootFreshnessLabel(stale).startsWith('STALE'),
    )

    const missing = verifyFreeOptionsArtifact({
      report,
      path: path.join(dir, 'absent.md'),
    })
    check('a missing file reports missing', missing.reason === 'missing')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed`)
    process.exit(1)
  }
  console.log('\nPASS — boot freshness, one view and artifact identity held')
}

await main()
