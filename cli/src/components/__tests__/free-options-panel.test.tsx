/**
 * FID-2026-1017-005 — the boot free-options panel.
 *
 * Collapsed by default: one header with freshness, counts and the resolved
 * path, and none of the 146 model ids / 223 offer rows mounted. Expanded:
 * a coding-focused preview; the artifact retains the complete discovery set.
 */
import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

import type { FreeOptionsContentBlock } from '../../types/chat'
import type { FreeOptionsBootSnapshot } from '../../utils/free-options-boot'
import type { FreeOptionsReport } from '../../utils/free-options-types'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const { FreeOptionsPanel } = await import('../free-options-panel')
const { SingleBlock } = await import('../blocks/single-block')
const { defaultPalette } = await import('../../utils/markdown-palette')

const MARKDOWN_PATH = 'C:/Users/test/.savant-code/free-options.md'
const NOW_MS = Date.parse('2026-10-17T12:00:00Z')

const OFFERS = [
  {
    title: 'Vercel tokens',
    category: 'API providers',
    deadlineLabel: 'advertised deadline 2026-10-31',
    providerLabels: ['Vercel AI Gateway'],
    url: 'https://freetokens.custats.info/offers/vercel.html',
  },
  {
    title: 'Student pack',
    category: 'Student',
    deadlineLabel: 'no advertised deadline',
    providerLabels: [],
    url: 'https://freetokens.custats.info/offers/student.html',
  },
  {
    title: 'Startup credits',
    category: 'Startup programs',
    deadlineLabel: 'advertised deadline 2026-11-05',
    providerLabels: [],
    url: 'https://freetokens.custats.info/offers/startup.html',
  },
]

const REPORT: FreeOptionsReport = {
  fetchedAt: '2026-10-17T09:00:00.000Z',
  stale: false,
  catalogSource: 'cache',
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
    {
      providerId: 'cerebras',
      label: 'Cerebras',
      models: ['qwen-3-coder'],
      setupCommand: '/provider cerebras',
    },
  ],
  localFree: [
    { id: 'ollama', label: 'Ollama', setupCommand: '/provider ollama' },
  ],
  discoveryOffers: OFFERS,
  discoveryOffersEndingSoon: 1,
}

const SNAPSHOT: FreeOptionsBootSnapshot = {
  report: REPORT,
  source: 'cache',
  ageMs: 3 * 3600_000,
  artifact: {
    ok: true,
    path: MARKDOWN_PATH,
    generatedAt: '2026-10-17T09:00:00.000Z',
    generationId: 'sha256:abc',
  },
}

const BLOCK: FreeOptionsContentBlock = {
  type: 'free-options',
  id: 'free-options-1',
  snapshot: SNAPSHOT,
  discovery: { newCount: 2, changedCount: 1 },
  markdownPath: MARKDOWN_PATH,
}

describe('FreeOptionsPanel (FID-2026-1017-005)', () => {
  test('renders collapsed by default with freshness, counts and the absolute path', () => {
    const markup = renderToStaticMarkup(
      <FreeOptionsPanel block={BLOCK} nowMs={NOW_MS} />,
    )
    expect(markup).toContain('Free options — fresh · cached 3h ago')
    expect(markup).toContain('▾ expand')
    expect(markup).toContain('2 text candidate(s) on 1 wired')
    expect(markup).toContain('1 relevant offer(s)')
    expect(markup).toContain('2 offer row(s) filtered')
    expect(markup).toContain(MARKDOWN_PATH)
    expect(markup).toContain('export ok')
    expect(markup).toContain('Discovery: 2 new / 1 changed')
    // The complete payload is NOT mounted while folded.
    expect(markup).not.toContain('z-ai/glm-5.3-flash')
    expect(markup).not.toContain('llama-4-scout')
    expect(markup).not.toContain('Vercel tokens')
  })

  test('expanded renders coding candidates and excludes unrelated offers', () => {
    const markup = renderToStaticMarkup(
      <FreeOptionsPanel
        block={{ ...BLOCK, isCollapsed: false }}
        nowMs={NOW_MS}
      />,
    )
    expect(markup).toContain('▴ collapse')
    expect(markup).toContain('z-ai/glm-5.3-flash')
    expect(markup).toContain('z-ai/glm-5.3')
    expect(markup).toContain('llama-4-scout')
    expect(markup).toContain('qwen-3-coder')
    expect(markup).toContain('/provider groq')
    expect(markup).toContain('Ollama')
    expect(markup).toContain('Vercel tokens')
    expect(markup).not.toContain('Student pack')
    expect(markup).not.toContain('Startup credits')
    expect(markup).toContain('advertised deadline 2026-10-31')
    expect(markup).toContain('known: Vercel AI Gateway')
  })

  test('a stale snapshot says STALE and carries the refresh failure', () => {
    const markup = renderToStaticMarkup(
      <FreeOptionsPanel
        block={{
          ...BLOCK,
          snapshot: {
            ...SNAPSHOT,
            source: 'stale-cache',
            ageMs: 14 * 3600_000,
            refreshError: 'offline',
          },
          isCollapsed: false,
        }}
      />,
    )
    expect(markup).toContain('STALE · 14h old · refresh failed')
    expect(markup).toContain('Refresh note: offline')
  })

  test('missing artifact and a failed export are visible, never implied ok', () => {
    const missing = renderToStaticMarkup(
      <FreeOptionsPanel
        block={{
          ...BLOCK,
          snapshot: {
            ...SNAPSHOT,
            artifact: { ok: false, path: MARKDOWN_PATH, reason: 'missing' },
          },
        }}
      />,
    )
    expect(missing).toContain('export missing')
    const failed = renderToStaticMarkup(
      <FreeOptionsPanel
        block={{
          ...BLOCK,
          snapshot: {
            ...SNAPSHOT,
            report: {
              ...REPORT,
              exportStatus: {
                path: MARKDOWN_PATH,
                ok: false,
                generatedAt: '2026-10-17T09:00:00.000Z',
                generationId: 'sha256:abc',
                error: 'EACCES',
              },
            },
          },
        }}
      />,
    )
    expect(failed).toContain('export failed: EACCES')
    expect(failed).toContain(MARKDOWN_PATH)
  })

  test('SingleBlock dispatches the free-options block to the panel', () => {
    const markup = renderToStaticMarkup(
      <SingleBlock
        block={BLOCK}
        idx={1}
        messageId="boot"
        isLoading={false}
        isComplete={true}
        isUser={false}
        textColor="#ffffff"
        availableWidth={80}
        markdownPalette={defaultPalette}
        onToggleCollapsed={() => {}}
        onBuildFast={() => {}}
        onBuildMax={() => {}}
        onBuildLite={() => {}}
      />,
    )
    expect(markup).toContain('Free options — fresh · cached 3h ago')
    expect(markup).not.toContain('z-ai/glm-5.3-flash')
  })
})
