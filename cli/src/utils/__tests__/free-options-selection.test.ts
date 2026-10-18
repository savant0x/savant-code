import { describe, expect, test } from 'bun:test'

import { buildFreeOptionsReport, liftCatalog } from '../free-options'
import { renderFreeOptionsArtifact } from '../free-options-artifact'
import { renderFreeOptionsCopy } from '../free-options-render'
import { selectCodingFreeOptions } from '../free-options-selection'
import {
  buildFreeOptionsView,
  previewFreeOptionsView,
} from '../free-options-view'
import { CATALOG, CTX, offerRow } from './free-options-test-fixtures'

import type { FreeCatalogModel } from '../free-options-types'

const NOW = Date.parse('2026-10-17T12:00:00Z')
const model = (
  id: string,
  extra: Partial<FreeCatalogModel> = {},
): FreeCatalogModel => ({
  id,
  providerId: 'openrouter',
  context_length: 131072,
  ...extra,
})
function reportOf(models: FreeCatalogModel[]) {
  return buildFreeOptionsReport(
    { ...CATALOG, models, totalModels: models.length },
    { ...CTX, nowMs: NOW },
  )
}

describe('coding free-options selection', () => {
  test('unresolved modality and invalid dates stay unverified, never silently eligible', () => {
    const report = reportOf([
      model('vision-chat'),
      model('nvidia/super-vl:free'),
      model('bad-calendar', { expirationDate: '2027-02-31' }),
      model('nano-banana-pro-preview'),
    ])
    report.discoveryOffers = [
      offerRow({
        title: 'Unreadable expiry',
        deadlineLabel: 'advertised deadline unknown',
      }),
    ]
    const selected = selectCodingFreeOptions(report, NOW)
    expect(selected.report.wiredFree).toEqual([])
    expect(selected.report.discoveryOffers).toEqual([])
    expect(selected.selection.reasons['purpose-unverified']).toBe(2)
    expect(selected.selection.reasons['expiry-unverified']).toBe(2)
    expect(() => selectCodingFreeOptions(report, Number.NaN)).toThrow(
      'finite clock',
    )
  })
  test('rejects specialist tasks, expires rows and deduplicates provider aliases', () => {
    const report = reportOf([
      model('qwen/coder'),
      model('qwen/coder'),
      model('google/lyria-3'),
      model('nvidia/nemotron-embed-1b'),
      model('nvidia/content-safety'),
      model('nvidia/nemotron-4-reward'),
      model('whisper-large-v3'),
      model('nvidia/nemotron-parse'),
      model('m', { expirationDate: '2026-10-16' }),
      model('unknown-expiry', { expirationDate: 'unreadable' }),
    ])
    const selected = selectCodingFreeOptions(report, NOW)
    expect(selected.report.wiredFree[0]?.models).toEqual(['qwen/coder'])
    expect(selected.selection.excludedModels).toBe(9)
    expect(selected.selection.reasons.duplicate).toBe(1)
    expect(selected.selection.reasons.expired).toBe(1)
    expect(selected.selection.reasons['expiry-unverified']).toBe(1)
    expect(selected.selection.unverifiedModels).toBe(1)
    expect(report.wiredFree[0]?.models).toHaveLength(10)
    const broad = renderFreeOptionsArtifact(
      buildFreeOptionsView(report, {
        markdownPath: '/tmp/free-options.md',
        generatedAt: new Date(NOW).toISOString(),
      }),
    ).text
    expect(broad).toContain('google/lyria-3')
    expect(broad).toContain('nvidia/nemotron-parse')
  })

  test('structured text output retains vision chat; explicit lack of tools excludes', () => {
    const selected = selectCodingFreeOptions(
      reportOf([
        model('vision-chat', {
          outputModalities: ['text'],
          supportedParameters: ['tools'],
        }),
        model('audio-generator', { outputModalities: ['audio'] }),
        model('chat-no-tools', {
          outputModalities: ['text'],
          supportedParameters: ['temperature'],
        }),
        model('legacy-chat'),
      ]),
      NOW,
    )
    expect(selected.report.wiredFree[0]?.models).toEqual([
      'vision-chat',
      'legacy-chat',
    ])
    expect(selected.selection.unverifiedModels).toBe(1)
    expect(selected.selection.reasons['tools-unsupported']).toBe(1)
  })

  test('model and offer date-only deadlines remain active through the UTC day', () => {
    const report = {
      ...reportOf([model('coder', { expirationDate: '2026-10-17' })]),
      discoveryOffers: [
        offerRow({
          title: 'Coding credits',
          deadlineLabel: 'advertised deadline 2026-10-17',
        }),
      ],
    }
    expect(selectCodingFreeOptions(report, NOW).report.wiredFree).toHaveLength(
      1,
    )
    expect(
      selectCodingFreeOptions(report, NOW).report.discoveryOffers,
    ).toHaveLength(1)
    const tomorrow = Date.parse('2026-10-18T00:00:00Z')
    expect(selectCodingFreeOptions(report, tomorrow).report.wiredFree).toEqual(
      [],
    )
    expect(
      selectCodingFreeOptions(report, tomorrow).report.discoveryOffers,
    ).toEqual([])
  })

  test('offer selection removes expired, duplicate, unrelated and unsafe-link rows', () => {
    const offers = [
      offerRow({ title: 'Text API credits', url: 'https://example.test/api' }),
      offerRow({ title: 'Duplicate', url: 'https://example.test/api' }),
      offerRow({
        title: 'Expired coding',
        category: 'Coding',
        url: 'https://example.test/expired',
        deadlineMs: NOW - 1,
      }),
      offerRow({ title: 'Voice API', url: 'https://example.test/voice' }),
      offerRow({
        title: 'Startup grant',
        category: 'Startup programs',
        url: 'https://example.test/startup',
      }),
      offerRow({
        title: 'Unknown deadline',
        deadlineLabel: 'deadline unverified',
        url: 'https://example.test/unknown',
      }),
      offerRow({ title: 'Invalid link', url: 'javascript:alert(1)' }),
      offerRow({
        title: 'Soon coding',
        category: 'Coding',
        url: 'https://example.test/soon',
        deadlineMs: NOW + 3600000,
      }),
    ]
    const selected = selectCodingFreeOptions(
      { ...reportOf([]), discoveryOffers: offers },
      NOW,
    )
    expect(selected.report.discoveryOffers?.map((row) => row.title)).toEqual([
      'Text API credits',
      'Soon coding',
    ])
    expect(selected.selection.excludedOffers).toBe(6)
    expect(selected.report.discoveryOffersEndingSoon).toBe(1)
    expect(offers).toHaveLength(8)
  })

  test('provider aliases share metadata and deduplication; separate providers stay separate', () => {
    const report = reportOf([])
    report.wiredFree = [
      { providerId: 'nvidia-nim', label: 'NIM', models: ['chat'] },
      { providerId: 'nvidia', label: 'NVIDIA', models: ['chat'] },
      { providerId: 'openrouter', label: 'OpenRouter', models: ['chat'] },
    ]
    const selected = selectCodingFreeOptions(report, NOW)
    expect(selected.report.wiredFree).toHaveLength(2)
    expect(selected.selection.reasons.duplicate).toBe(1)
  })

  test('structured metadata survives the catalog/cache round trip', () => {
    const raw = {
      ...CATALOG,
      totalModels: 1,
      models: [
        {
          id: 'vision-chat',
          providerId: 'openrouter',
          architecture: { output_modalities: ['text'] },
          supported_parameters: ['tools'],
        },
      ],
    }
    const lifted = liftCatalog(raw)
    expect(lifted?.models[0].outputModalities).toEqual(['text'])
    expect(
      liftCatalog(JSON.parse(JSON.stringify(lifted)))?.models[0]
        .supportedParameters,
    ).toEqual(['tools'])
  })

  test('focused view counts selection before preview while broad artifact preserves evidence', () => {
    const report = {
      ...reportOf(Array.from({ length: 12 }, (_, i) => model(`coder-${i}`))),
      discoveryOffers: Array.from({ length: 9 }, (_, i) =>
        offerRow({
          title: `API credit ${i}`,
          url: `https://example.test/${i}`,
        }),
      ),
    }
    const meta = {
      markdownPath: '/tmp/free-options.md',
      generatedAt: new Date(NOW).toISOString(),
    }
    const focused = buildFreeOptionsView(report, {
      ...meta,
      audience: 'coding',
      nowMs: NOW,
    })
    const preview = previewFreeOptionsView(focused)
    expect(preview.header.counts.wiredModels).toBe(12)
    expect(preview.wired[0].models).toHaveLength(5)
    expect(preview.offers.flatMap((group) => group.rows)).toHaveLength(5)
    const copy = renderFreeOptionsCopy(preview)
    expect(copy).toContain('coder-4')
    expect(copy).not.toContain('coder-5')
    expect(copy).not.toContain('API credit 5')
    expect(copy).toContain('7 more model(s), 4 more offer(s)')
    expect(copy).toContain('lack verified text/tool metadata')
    const broad = renderFreeOptionsArtifact(
      buildFreeOptionsView(report, meta),
    ).text
    expect(broad).toContain('coder-11')
    expect(broad).toContain('API credit 8')
  })
})
