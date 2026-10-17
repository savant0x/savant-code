/**
 * FID-2026-1017-005 — one view, one artifact identity.
 *
 * The panel, the markdown export and `/provider free` derive from the same
 * view. The artifact carries its resolved path, both timestamps and a body
 * hash; the reader checks the path and `fetchedAt` against the live report and
 * re-hashes the body, so another config directory's copy cannot pass.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  buildFreeOptionsReport,
  persistFreeOptionsArtifact,
} from '../free-options'
import {
  renderFreeOptionsArtifact,
  verifyFreeOptionsArtifact,
} from '../free-options-artifact'
import { renderCommandOutput } from '../free-options-render'
import { buildFreeOptionsView } from '../free-options-view'
import { CATALOG, CTX, offerRow } from './free-options-test-fixtures'

import type { FreeOfferRow } from '../free-options-types'

const GENERATED_AT = '2026-09-28T12:00:00.000Z'
const MARKDOWN_FILE = 'free-options.md'

function fixtureReport(offers: FreeOfferRow[] = []) {
  return {
    ...buildFreeOptionsReport(CATALOG, CTX),
    discoveryOffers: offers,
    discoveryOffersEndingSoon: 0,
  }
}

function artifactAt(dir: string, offers: FreeOfferRow[] = []) {
  const markdownPath = path.join(dir, MARKDOWN_FILE)
  const report = fixtureReport(offers)
  const view = buildFreeOptionsView(report, {
    markdownPath,
    generatedAt: GENERATED_AT,
  })
  const artifact = renderFreeOptionsArtifact(view)
  return { report, view, artifact, markdownPath }
}

describe('FID-2026-1017-005: shared view', () => {
  test('every offer is grouped in the view, not capped', () => {
    const offers = Array.from({ length: 14 }, (_, i) =>
      offerRow({
        title: `Offer ${String(i + 1).padStart(2, '0')}`,
        category: i < 10 ? 'Coding' : 'Startup programs',
      }),
    )
    const view = buildFreeOptionsView(fixtureReport(offers), {
      markdownPath: '/tmp/free-options.md',
      generatedAt: GENERATED_AT,
    })
    expect(view.header.counts.offers).toBe(14)
    expect(view.offers.flatMap((group) => group.rows)).toHaveLength(14)
    expect(view.offers[0]?.category).toBe('Coding')
    expect(view.offers[0]?.rows).toHaveLength(10)
  })

  test('the command view keeps its bound but names the resolved path', () => {
    const offers = Array.from({ length: 14 }, (_, i) =>
      offerRow({
        title: `Offer ${String(i + 1).padStart(2, '0')}`,
        providerLabels: ['Vercel AI Gateway'],
      }),
    )
    const markdownPath = '/tmp/savant-free-test/free-options.md'
    const joined = renderCommandOutput(
      fixtureReport(offers),
      markdownPath,
    ).join('\n')
    expect(joined).toContain('(14 of 14):')
    expect(joined).toContain('- Offer 10 —')
    expect(joined).not.toContain('- Offer 11 —')
    expect(joined).toContain(
      `… and 4 more — the full list is in ${markdownPath}`,
    )
    expect(joined).not.toMatch(/ask the agent/i)
  })
})

describe('FID-2026-1017-005: artifact identity', () => {
  let dir = ''

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-free-artifact-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('a freshly written artifact verifies at its exact path', () => {
    const { report, artifact, markdownPath } = artifactAt(dir)
    fs.writeFileSync(markdownPath, artifact.text)
    const check = verifyFreeOptionsArtifact({ report, path: markdownPath })
    expect(check.ok).toBe(true)
    expect(check.generationId).toBe(artifact.generationId)
    expect(check.generatedAt).toBe(GENERATED_AT)
  })

  test('an edited body fails the generation hash', () => {
    const { report, artifact, markdownPath } = artifactAt(dir)
    fs.writeFileSync(markdownPath, artifact.text.replace('Ollama', 'Evil'))
    expect(verifyFreeOptionsArtifact({ report, path: markdownPath })).toEqual({
      ok: false,
      path: markdownPath,
      reason: 'generation-mismatch',
    })
  })

  test('a copy at another path fails even when its body is intact', () => {
    const { report, artifact, markdownPath } = artifactAt(dir)
    const copy = path.join(dir, 'free-options-copy.md')
    fs.writeFileSync(copy, artifact.text)
    expect(verifyFreeOptionsArtifact({ report, path: copy })).toEqual({
      ok: false,
      path: copy,
      reason: 'path-mismatch',
    })
    void markdownPath
  })

  test('a different catalog vintage fails on fetchedAt', () => {
    const { artifact, markdownPath } = artifactAt(dir)
    fs.writeFileSync(markdownPath, artifact.text)
    const other = {
      ...fixtureReport(),
      fetchedAt: '2026-09-27T01:00:00.000Z',
    }
    expect(
      verifyFreeOptionsArtifact({ report: other, path: markdownPath }).reason,
    ).toBe('fetchedAt-mismatch')
  })

  test('a missing file reports missing, not unreadable', () => {
    const { report, markdownPath } = artifactAt(dir)
    expect(verifyFreeOptionsArtifact({ report, path: markdownPath })).toEqual({
      ok: false,
      path: markdownPath,
      reason: 'missing',
    })
  })

  test('the writer records ok plus the generation it actually wrote', () => {
    const report = fixtureReport()
    const markdownPath = path.join(dir, MARKDOWN_FILE)
    const status = persistFreeOptionsArtifact(
      report,
      markdownPath,
      GENERATED_AT,
    )
    expect(status.ok).toBe(true)
    expect(status.path).toBe(markdownPath)
    expect(status.generationId).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(
      verifyFreeOptionsArtifact({ report, path: markdownPath }).ok,
    ).toBe(true)
  })

  test('a failed write is returned, never thrown or swallowed', () => {
    const report = fixtureReport()
    // The markdown path is a directory, so the atomic rename cannot land.
    const markdownPath = path.join(dir, 'not-a-file')
    fs.mkdirSync(markdownPath)
    const status = persistFreeOptionsArtifact(
      report,
      markdownPath,
      GENERATED_AT,
    )
    expect(status.ok).toBe(false)
    expect(status.error?.length).toBeGreaterThan(0)
    expect(status.path).toBe(markdownPath)
  })
})
