/**
 * FID-2026-1017-005 — native-render pins for the boot free-options panel.
 *
 * The static-markup suite renders through react-dom, which treats `box` and
 * `text` as custom elements and accepts any child. OpenTUI's reconciler does
 * not: a bare string child of a `box` throws "Text must be created inside of
 * a text node", the transcript boundary catches it and the boot panel is
 * replaced by the "session is still active" fallback plus the block's raw
 * JSON. These pins mount the panel on the real reconciler so that class of
 * defect fails here instead of at boot.
 */
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { waitForNativeFrame } from './native-render-frame'
import { initializeThemeStore } from '../../hooks/use-theme'
import { ErrorBoundary } from '../error-boundary'
import { FreeOptionsPanel } from '../free-options-panel'

import type { FreeOptionsContentBlock } from '../../types/chat'
import type { FreeOptionsBootSnapshot } from '../../utils/free-options-boot'
import type { FreeOptionsReport } from '../../utils/free-options-types'

initializeThemeStore()

const MARKDOWN_PATH = 'C:/Users/test/.savant-code/free-options.md'

const REPORT: FreeOptionsReport = {
  fetchedAt: '2026-10-17T09:00:00.000Z',
  stale: false,
  catalogSource: 'cache',
  configuredProviders: ['OpenRouter'],
  wiredFree: [
    {
      providerId: 'openrouter',
      label: 'OpenRouter',
      models: ['z-ai/glm-5.3-flash'],
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
  localFree: [
    { id: 'ollama', label: 'Ollama', setupCommand: '/provider ollama' },
  ],
  discoveryOffers: [
    {
      title: 'Vercel tokens',
      category: 'API providers',
      deadlineLabel: 'no advertised deadline',
      providerLabels: ['Vercel AI Gateway'],
      url: 'https://freetokens.custats.info/offers/vercel.html',
    },
  ],
  discoveryOffersEndingSoon: 0,
}

const SNAPSHOT: FreeOptionsBootSnapshot = {
  report: REPORT,
  source: 'cache',
  ageMs: 3 * 3600_000,
  artifact: {
    ok: true,
    path: MARKDOWN_PATH,
    generatedAt: '2026-10-17T09:00:00.000Z',
  },
}

const BLOCK: FreeOptionsContentBlock = {
  type: 'free-options',
  id: 'free-options-native-1',
  snapshot: SNAPSHOT,
  discovery: null,
  markdownPath: MARKDOWN_PATH,
}

async function renderPanel(
  block: FreeOptionsContentBlock,
): Promise<{ frame: string; fallback: string }> {
  const setup = await createTestRenderer({
    width: 100,
    height: 40,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(
      <ErrorBoundary fallback={<text>PANEL FAILED</text>}>
        <FreeOptionsPanel block={block} />
      </ErrorBoundary>,
    )
    const frame = await waitForNativeFrame(
      setup,
      (value) =>
        value.includes('PANEL FAILED') ||
        value.includes('session is still active') ||
        value.includes('Free options'),
    )
    return { frame, fallback: 'PANEL FAILED' }
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}

test('collapsed boot panel mounts on the native reconciler without the fallback', async () => {
  const { frame, fallback } = await renderPanel(BLOCK)
  expect(frame).not.toContain(fallback)
  // The transcript boundary's fallback prints the block as raw JSON.
  expect(frame).not.toContain('session is still active')
  expect(frame).not.toContain('{"type":"free-options"')
  expect(frame).toContain('Free options')
  expect(frame).toContain('free-options.md')
}, 30_000)

test('expanded boot panel renders every lane natively, never raw JSON', async () => {
  const { frame, fallback } = await renderPanel({
    ...BLOCK,
    isCollapsed: false,
  })
  expect(frame).not.toContain(fallback)
  expect(frame).not.toContain('{"type":"free-options"')
  expect(frame).toContain('z-ai/glm-5.3-flash')
  expect(frame).toContain('llama-4-scout')
  expect(frame).toContain('Vercel tokens')
}, 30_000)
