/**
 * FID-2026-0928-012 — free-options discovery pins (RED-first).
 *
 * BYOK context: there is no Savant backend or credit balance. "Free" means
 * free tiers/models of gateways the user wires with their own keys; the
 * wired/not-wired split comes from the user's own key store ∪ env (the same
 * truth applyPersistedProviderApiKeys consumes). The custats catalog
 * (keyless, agent-facing, LIVE-probed 2026-09-28) supplies which models are
 * free right now, partitioned by providerId.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  isCacheFresh,
  buildFreeOptionsReport,
  freeOptionsPaths,
  readCachedFreeOptionsReport,
  renderFreeOptionsAnnounce,
  renderFreeOptionsMarkdown,
  renderCommandOutput,
  type FreeCatalogEnvelope,
  type FreeOptionsContext,
} from '../free-options'

const CATALOG: FreeCatalogEnvelope = {
  fetchedAt: '2026-09-28T01:00:13.744Z',
  totalModels: 4,
  models: [
    {
      id: 'z-ai/glm-5.3-flash',
      providerId: 'openrouter',
      context_length: 1_000_000,
    },
    { id: 'llama-4-scout', providerId: 'groq', context_length: 131_072 },
    { id: 'qwen-3-coder', providerId: 'cerebras', context_length: 262_144 },
    { id: 'gemma-3-it', providerId: 'google', context_length: 1_000_000 },
  ],
  newModelIds: ['qwen-3-coder'],
  archivedModels: [],
}

const CTX: FreeOptionsContext = {
  nowMs: Date.parse('2026-09-28T12:00:00Z'),
  // User has wired openrouter (stored key) and nvidia (env var), and runs ollama locally.
  wiredEnvVars: new Set(['OPENROUTER_API_KEY', 'NVIDIA_API_KEY']),
  registryByProviderId: {
    openrouter: {
      id: 'openrouter',
      label: 'OpenRouter',
      envVar: 'OPENROUTER_API_KEY',
      setupCommand: '/provider openrouter',
    },
    groq: {
      id: 'groq',
      label: 'Groq',
      envVar: 'GROQ_API_KEY',
      setupCommand: '/provider groq',
    },
    cerebras: {
      id: 'cerebras',
      label: 'Cerebras',
      envVar: 'CEREBRAS_API_KEY',
      setupCommand: '/provider cerebras',
    },
    google: {
      id: 'google',
      label: 'Google AI Studio',
      envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
      setupCommand: '/provider google',
    },
  },
  localProviders: [
    { id: 'ollama', label: 'Ollama', setupCommand: '/provider ollama' },
  ],
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

describe('FID-2026-0928-012: agent-answerable markdown', () => {
  test('renders the reference with the canonical structure', () => {
    const md = renderFreeOptionsMarkdown(buildFreeOptionsReport(CATALOG, CTX))
    expect(md).toContain('# Free options right now')
    expect(md).toContain('fetchedAt: 2026-09-28T01:00:13.744Z')
    expect(md).toContain('## Wired — free models you can use today')
    expect(md).toContain('OpenRouter')
    expect(md).toContain('## Free tiers you have NOT wired')
    expect(md).toContain('/provider groq')
    expect(md).toContain('## Local & free')
    expect(md).toContain('Ollama')
  })

  test('stale data is labeled in the document, never silently served', () => {
    const report = { ...buildFreeOptionsReport(CATALOG, CTX), stale: true }
    const md = renderFreeOptionsMarkdown(report)
    expect(md).toContain('STALE')
  })
})

describe('FID-2026-0928-012: /provider free command output', () => {
  test('output names wired lanes, onboarding commands, and the agent file path', () => {
    const lines = renderCommandOutput(buildFreeOptionsReport(CATALOG, CTX))
    const joined = lines.join('\n')
    expect(joined).toMatch(/free models/i)
    expect(joined).toContain('/provider groq')
    expect(joined).toContain('free-options.md')
    expect(joined).toMatch(/agent/i)
  })

  test('offline with no cache: plain statement, local lanes still listed', () => {
    const lines = renderCommandOutput(buildFreeOptionsReport(null, CTX))
    const joined = lines.join('\n')
    expect(joined).toMatch(/couldn't fetch|no cached/i)
    expect(joined).toContain('Ollama')
  })
})

describe('FID-2026-1001-002: boot announce (cached reader + renderer)', () => {
  // The cached reader resolves the config dir via SAVANT_CODE_CONFIG_DIR —
  // the same isolation the command-grammar harness uses.
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
    // Local lanes are registry-deterministic; the wired/not-wired split
    // reflects the LIVE machine context (host env), so only the shape and
    // the local lane are pinned here.
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

  test('announce renderer: bounded message with the /provider free pointer', () => {
    const lines = renderFreeOptionsAnnounce(
      buildFreeOptionsReport(CATALOG, CTX),
    )
    const joined = lines.join('\n')
    expect(joined).toContain('Free AI lanes available')
    expect(joined).toContain('Wired & free')
    expect(joined).toContain('Not wired')
    expect(joined).toContain('Local & free')
    expect(joined).toContain('/provider free')
  })

  test('announce renderer: nothing to say renders no lines', () => {
    // No catalog at all.
    expect(
      renderFreeOptionsAnnounce(buildFreeOptionsReport(null, CTX)),
    ).toEqual([])
    // Catalog with no actionable lanes (every list empty).
    const empty = buildFreeOptionsReport(
      {
        fetchedAt: CATALOG.fetchedAt,
        totalModels: 0,
        models: [],
        newModelIds: [],
        archivedModels: [],
      },
      { ...CTX, localProviders: [] },
    )
    expect(renderFreeOptionsAnnounce(empty)).toEqual([])
  })
})
