import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { waitForNativeFrame } from './native-render-frame'
import { initializeThemeStore } from '../../hooks/use-theme'
import {
  CATALOG,
  CTX,
  offerRow,
} from '../../utils/__tests__/free-options-test-fixtures'
import { buildFreeOptionsReport } from '../../utils/free-options'
import { FreeOptionsPanel } from '../free-options-panel'

initializeThemeStore()

test('native boot preview filters specialist/expired rows and bounds both lists', async () => {
  const nowMs = Date.parse('2026-10-17T12:00:00Z')
  const models = [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `text-coder-${index}`,
      providerId: 'openrouter',
      context_length: 131072,
    })),
    {
      id: 'whisper-large-v3',
      providerId: 'openrouter',
      context_length: 131072,
    },
  ]
  const report = {
    ...buildFreeOptionsReport(
      { ...CATALOG, models, totalModels: models.length },
      { ...CTX, nowMs },
    ),
    discoveryOffers: [
      ...Array.from({ length: 8 }, (_, index) =>
        offerRow({
          title: `API credit ${index}`,
          url: `https://example.test/${index}`,
        }),
      ),
      offerRow({
        title: 'Student grant',
        category: 'Student',
        url: 'https://example.test/student',
      }),
      offerRow({
        title: 'Expired campaign',
        deadlineMs: nowMs - 1,
        url: 'https://example.test/expired',
      }),
    ],
  }
  const setup = await createTestRenderer({
    width: 160,
    height: 100,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(
      <FreeOptionsPanel
        nowMs={nowMs}
        block={{
          type: 'free-options',
          discovery: null,
          id: 'filtered-boot',
          isCollapsed: false,
          markdownPath: '/tmp/free-options.md',
          snapshot: {
            report,
            source: 'cache',
            ageMs: 0,
            artifact: { ok: true, path: '/tmp/free-options.md' },
          },
        }}
      />,
    )
    const frame = await waitForNativeFrame(setup, (value) =>
      value.includes('API credit 4'),
    )
    expect(frame).toContain('8 text candidate(s) on 1 wired')
    expect(frame).toContain('text-coder-4')
    expect(frame).not.toContain('text-coder-5')
    expect(frame).not.toContain('whisper-large-v3')
    expect(frame).not.toContain('Student grant')
    expect(frame).not.toContain('Expired campaign')
    expect(frame).not.toContain('API credit 5')
    expect(frame).toContain('3 more model(s), 3 more offer(s)')
    expect(frame).toContain('lack verified text/tool metadata')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 30000)
