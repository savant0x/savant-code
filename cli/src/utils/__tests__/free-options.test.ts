/**
 * FID-2026-0928-012 — free-options discovery pins.
 *
 * BYOK context: there is no Savant backend or credit balance. "Free" means
 * free tiers/models of gateways the user wires with their own keys; the
 * wired/not-wired split comes from the user's own key store ∪ env (the same
 * truth applyPersistedProviderApiKeys consumes). The custats catalog
 * (keyless, agent-facing, LIVE-probed 2026-09-28) supplies which models are
 * free right now, partitioned by providerId.
 *
 * FID-2026-1017-005 moved every surface onto `buildFreeOptionsView`; these
 * pins assert the view, the artifact header and the resolved command path.
 * The boot freshness matrix lives in free-options-boot.test.ts and the
 * artifact identity in free-options-view.test.ts.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import './free-options-routing.test'

import {
  buildFreeOptionsReport,
  buildFreeOptionsView,
  freeOptionsPaths,
  isCacheFresh,
  readCachedFreeOptionsReport,
  renderCommandOutput,
  renderFreeOptionsMarkdown,
} from '../free-options'
import { CATALOG, CTX } from './free-options-test-fixtures'

const MARKDOWN_PATH = '/tmp/savant-free-test/free-options.md'
const GENERATED_AT = '2026-09-28T12:00:00.000Z'

function viewOf(report: ReturnType<typeof buildFreeOptionsReport>) {
  return buildFreeOptionsView(report, {
    markdownPath: MARKDOWN_PATH,
    generatedAt: GENERATED_AT,
  })
}

describe('FID-2026-0928-012: cache TTL', () => {
  test('fresh cache (written 1h ago) passes the 24h TTL', () => {
    const cache = { fetchedAt: new Date(CTX.nowMs - 3600_000).toISOString() }
    expect(isCacheFresh(cache.fetchedAt, CTX.nowMs)).toBe(true)
  })

  test('cache older than 24h fails; unparseable/absent fails closed', () => {
    expect(
      isCacheFresh(
        new Date(CTX.nowMs - 25 * 3600_000).toISOString(),
        CTX.nowMs,
      ),
    ).toBe(false)
    expect(isCacheFresh('', CTX.nowMs)).toBe(false)
    expect(isCacheFresh('not-a-date', CTX.nowMs)).toBe(false)
  })
})

describe('FID-2026-0928-012: report builder (the BYOK split)', () => {
  const report = buildFreeOptionsReport(CATALOG, CTX)

  test('wired-free lanes come from providers whose env var is set', () => {
    expect(report.wiredFree.map((l) => l.providerId)).toEqual(['openrouter'])
    expect(report.wiredFree[0]?.models).toContain('z-ai/glm-5.3-flash')
  })

  test('not-wired lanes carry the exact onboarding command', () => {
    const ids = report.notWired.map((l) => l.providerId).sort()
    expect(ids).toEqual(['cerebras', 'google', 'groq'])
    const groq = report.notWired.find((l) => l.providerId === 'groq')
    expect(groq?.setupCommand).toBe('/provider groq')
    expect(groq?.models).toContain('llama-4-scout')
  })

  test('local free lanes surface with no key requirement', () => {
    expect(report.localFree.map((l) => l.id)).toEqual(['ollama'])
  })

  test('report stamps its data freshness', () => {
    expect(report.fetchedAt).toBe('2026-09-28T01:00:13.744Z')
    expect(report.stale).toBe(false)
  })

  test('empty catalog still yields local lanes and empty lists (never throws)', () => {
    const empty = buildFreeOptionsReport(
      {
        fetchedAt: CATALOG.fetchedAt,
        totalModels: 0,
        models: [],
        newModelIds: [],
        archivedModels: [],
      },
      CTX,
    )
    expect(empty.wiredFree).toEqual([])
    expect(empty.notWired).toEqual([])
    expect(empty.localFree.length).toBe(1)
  })
})

describe('FID-2026-1017-005: shared view and artifact', () => {
  const report = buildFreeOptionsReport(CATALOG, CTX)
  const view = viewOf(report)

  test('counts come from the same lanes the sections carry', () => {
    expect(view.header.counts.wiredProviders).toBe(view.wired.length)
    expect(view.header.counts.wiredModels).toBe(
      view.wired.reduce((n, lane) => n + lane.models.length, 0),
    )
    expect(view.header.counts.notWiredProviders).toBe(view.notWired.length)
    expect(view.header.counts.notWiredModels).toBe(
      view.notWired.reduce((n, lane) => n + lane.models.length, 0),
    )
  })

  test('the markdown lists every not-wired model id, not just a count', () => {
    const md = renderFreeOptionsMarkdown(view)
    expect(md).toContain('`llama-4-scout`')
    expect(md).toContain('`qwen-3-coder`')
    expect(md).toContain('`gemma-3-it`')
  })

  test('the artifact header carries the resolved path, both timestamps and a hash', () => {
    const md = renderFreeOptionsMarkdown(view)
    expect(md).toContain('<!-- savant-free-options')
    expect(md).toContain(`path: ${MARKDOWN_PATH}`)
    expect(md).toContain(`generatedAt: ${GENERATED_AT}`)
    expect(md).toContain('fetchedAt: 2026-09-28T01:00:13.744Z')
    expect(md).toMatch(/generationId: sha256:[0-9a-f]{64}/)
  })

  test('renders the reference with the canonical structure', () => {
    const md = renderFreeOptionsMarkdown(view)
    expect(md).toContain('# Free options right now')
    expect(md).toContain(
      '## Wired — advertised free models; account access unverified',
    )
    expect(md).toContain('OpenRouter')
    expect(md).toContain('## Free tiers you have NOT wired')
    expect(md).toContain('/provider groq')
    expect(md).toContain('## Local & free')
    expect(md).toContain('Ollama')
  })

  test('stale data is labeled in the document, never silently served', () => {
    const stale = viewOf({ ...report, stale: true })
    expect(renderFreeOptionsMarkdown(stale)).toContain('STALE')
  })

  test('free-listing caveat follows evidence class while account access stays unverified', () => {
    expect(report.catalogEvidence?.source).toContain('free_models.json')
    const reported = viewOf({
      ...report,
      catalogEvidence: {
        class: 'reported-unverified' as const,
        source: 'operator report',
      },
    })
    expect(renderFreeOptionsMarkdown(reported)).toContain(
      'reported free models; listing unverified; account access unverified',
    )
    expect(reported.quotaFootnote).toContain('do not verify your account quota')
    const exhausted = viewOf({
      ...report,
      quotaReading: {
        state: 'exhausted' as const,
        source: 'authenticated-usage-api' as const,
      },
    })
    expect(exhausted.quotaFootnote).toContain('quota observed exhausted')
  })
})

describe('FID-2026-0928-012: /provider free command output', () => {
  const report = buildFreeOptionsReport(CATALOG, CTX)

  test('names wired lanes, onboarding commands and the resolved file path', () => {
    const joined = renderCommandOutput(report, MARKDOWN_PATH).join('\n')
    expect(joined).toMatch(/free models/i)
    expect(joined).toContain('/provider groq')
    expect(joined).toContain(MARKDOWN_PATH)
    // The unsupported read-outside-root claim is gone (FID-2026-1017-005).
    expect(joined).not.toMatch(/ask the agent/i)
  })

  test('offline with no cache: plain statement, local lanes still listed', () => {
    const joined = renderCommandOutput(
      buildFreeOptionsReport(null, CTX),
      MARKDOWN_PATH,
    ).join('\n')
    expect(joined).toMatch(/couldn't fetch|no cached/i)
    expect(joined).toContain('Ollama')
  })

  test('a failed export is reported, not swallowed', () => {
    const failed = {
      ...report,
      exportStatus: {
        path: MARKDOWN_PATH,
        ok: false,
        generatedAt: GENERATED_AT,
        generationId: 'sha256:deadbeef',
        error: 'EACCES',
      },
    }
    const joined = renderCommandOutput(failed, MARKDOWN_PATH).join('\n')
    expect(joined).toContain('⚠ Export failed: EACCES')
    expect(joined).toContain('the file may be missing')
  })

  test('a successful export prints its generation identity', () => {
    const exported = {
      ...report,
      exportStatus: {
        path: MARKDOWN_PATH,
        ok: true,
        generatedAt: GENERATED_AT,
        generationId: 'sha256:abc',
      },
    }
    const joined = renderCommandOutput(exported, MARKDOWN_PATH).join('\n')
    expect(joined).toContain('Export ok')
    expect(joined).toContain('sha256:abc')
  })
})

describe('FID-2026-1001-002: cached reader', () => {
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-free-announce-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })

  afterEach(() => {
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('null when no cache exists (never fetches)', () => {
    expect(readCachedFreeOptionsReport()).toBeNull()
  })

  test('builds the BYOK split from a fresh seeded cache', () => {
    const fresh = { ...CATALOG, fetchedAt: new Date().toISOString() }
    fs.writeFileSync(freeOptionsPaths().cache, JSON.stringify(fresh))
    const report = readCachedFreeOptionsReport()
    expect(report?.stale).toBe(false)
    expect(report?.catalogSource).toBe('cache')
    expect(report?.localFree.map((lane) => lane.id)).toContain('ollama')
    expect(report?.fetchedAt).toBe(fresh.fetchedAt)
  })

  test('a cached copy older than 24h is flagged stale', () => {
    const staleCopy = {
      ...CATALOG,
      fetchedAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
    }
    fs.writeFileSync(freeOptionsPaths().cache, JSON.stringify(staleCopy))
    expect(readCachedFreeOptionsReport()?.stale).toBe(true)
  })

  test('corrupt cache JSON is fail-silent (null)', () => {
    fs.writeFileSync(freeOptionsPaths().cache, '{not-json')
    expect(readCachedFreeOptionsReport()).toBeNull()
  })
})
