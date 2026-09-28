import { describe, expect, test } from 'bun:test'

import { parseCleanApisModelsForTest } from '../openrouter-models/cleanapis'

/**
 * Catalog contract pins for the Clean APIs (cleanapis.com) live catalog.
 *
 * No network access — the parser seam is exercised directly.
 *
 * **Shape provenance: MEASURED 2026-09-27** against the authenticated
 * `GET /v1/models` (HTTP 200, 33 models). Earlier drafts of this file said the
 * field names were *inferred* from the published site because only a keyless
 * 401 was available; that gap is closed. Confirmed from the real payload:
 *
 * - ids are **BARE** — `"muse-spark-1.1"`, no `openai/` vendor segment;
 * - `context_length` AND `context_window` are both served, equal at 1000000;
 * - there is **no** top-level `max_completion_tokens` / `max_tokens`;
 * - `top_provider` sits at the TOP level, with
 *   `max_completion_tokens: null` on **all 33** models;
 * - `architecture.modality` / `.tokenizer` / `.instruct_type` are one level
 *   **deeper** than `openrouter.ts` reads them — the drift that left
 *   `topProvider` and `modality` unpopulated until FID-2026-0927-005's
 *   remediation;
 * - `pricing.prompt` / `.completion` are decimal **strings** (`"0.000001817"`).
 *
 * The gateway-spelling legs are retained even though `context_window` is now
 * confirmed present: a vendor-side rename must still degrade to "no window
 * shown" rather than a hard parse failure.
 */
describe('cleanapis live catalog parser', () => {
  test('prefixes bare upstream ids for picker routing', () => {
    // The vendor publishes BARE ids (no `openai/` vendor segment), so the
    // internal `cleanapis/` prefix is added here and removed again on the wire
    // by the registry's `idTransform: 'strip'`.
    const models = parseCleanApisModelsForTest({
      data: [{ id: 'gpt-5.6-luna' }, { id: 'claude-fable-5' }],
    })
    expect(models.map((m) => m.id)).toEqual([
      'cleanapis/claude-fable-5',
      'cleanapis/gpt-5.6-luna',
    ])
    expect(models.every((m) => m.provider === 'cleanapis')).toBe(true)
  })

  test('already-prefixed ids stay single-prefixed (one strip yields the wire id)', () => {
    // Load-bearing: `strip` removes exactly ONE segment. If the parser doubled
    // the prefix, the wire id after one strip would still carry `cleanapis/`
    // and route nowhere. Same guard as the vercel/orcarouter precedent.
    const models = parseCleanApisModelsForTest({
      data: [{ id: 'cleanapis/router' }],
    })
    expect(models.map((m) => m.id)).toEqual(['cleanapis/cleanapis/router'])
    expect('cleanapis/cleanapis/router'.slice('cleanapis/'.length)).toBe(
      'cleanapis/router',
    )
  })

  test('maps the OpenAI-standard window fields', () => {
    const models = parseCleanApisModelsForTest({
      data: [
        {
          id: 'gpt-5.6-luna',
          name: 'GPT-5.6 Luna',
          description: 'OpenAI efficient model.',
          context_length: 1050000,
          max_completion_tokens: 65536,
          created: '2026-01-15',
        },
      ],
    })
    const model = models[0]
    expect(model?.name).toBe('GPT-5.6 Luna')
    expect(model?.description).toBe('OpenAI efficient model.')
    expect(model?.contextLength).toBe(1050000)
    expect(model?.maxCompletionTokens).toBe(65536)
    expect(model?.created).toBe('2026-01-15')
  })

  test('falls back to the gateway window spelling', () => {
    // Gateway-style catalogs publish `context_window`/`max_tokens` instead
    // (the vercel drift). Accepting both means a field-name change vendor-side
    // degrades to "no window shown" rather than a hard parse failure.
    const models = parseCleanApisModelsForTest({
      data: [{ id: 'gpt-5.6-luna', context_window: 1050000, max_tokens: 4096 }],
    })
    expect(models[0]?.contextLength).toBe(1050000)
    expect(models[0]?.maxCompletionTokens).toBe(4096)
  })

  test('the standard spelling wins when both are present', () => {
    // Guards an accidental future swap: the documented-first field must stay
    // first, not merely "one of them".
    const models = parseCleanApisModelsForTest({
      data: [
        {
          id: 'x',
          context_length: 111,
          context_window: 999,
          max_completion_tokens: 22,
          max_tokens: 88,
        },
      ],
    })
    expect(models[0]?.contextLength).toBe(111)
    expect(models[0]?.maxCompletionTokens).toBe(22)
  })

  test('drops id-less rows and tolerates missing optional fields', () => {
    const models = parseCleanApisModelsForTest({
      data: [{ id: '' }, { id: 42 }, {}, { id: 'gpt-5.6-luna' }],
    })
    expect(models.map((m) => m.id)).toEqual(['cleanapis/gpt-5.6-luna'])
    const model = models[0]
    expect(model?.name).toBe('gpt-5.6-luna')
    expect(model?.description).toBeUndefined()
    expect(model?.contextLength).toBeUndefined()
    expect(model?.maxCompletionTokens).toBeUndefined()
    expect(model?.created).toBeUndefined()
  })

  test('rejects non-finite numbers rather than rendering NaN in the picker', () => {
    const models = parseCleanApisModelsForTest({
      data: [{ id: 'gpt-5.6-luna', context_length: 0 / 0 }],
    })
    expect(models[0]?.contextLength).toBeUndefined()
  })

  test('empty/missing data yields an empty catalog (degrade, not throw)', () => {
    // The keyless case: no CLEANAPIS_API_KEY must degrade to an empty list so
    // the picker still works and free-text `/model cleanapis/<id>` still routes.
    expect(parseCleanApisModelsForTest({})).toEqual([])
    expect(parseCleanApisModelsForTest({ data: [] })).toEqual([])
  })

  // ---- FID-2026-0927-005 remediation: nested-shape mapping -------------
  // Every fixture below is a REAL slice of the live payload (HTTP 200,
  // 2026-09-27, 33 models). The pre-remediation parser read only top-level
  // names, so these four fields populated 0/33 and `model-info.ts:67-68` — the
  // only production consumer of the capability-shaped fields — rendered no
  // modalities line for any cleanapis model.

  const REAL_MUSE_SPARK = {
    id: 'muse-spark-1.1',
    object: 'model',
    created: 1787211373,
    owned_by: 'Clean APIs',
    name: 'Muse Spark 1.1',
    description:
      'Meta Muse Spark series. Fast and capable with strong reasoning scores.',
    context_length: 1000000,
    architecture: {
      modality: 'text+image->text',
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      tokenizer: 'Other',
      instruct_type: null,
    },
    pricing: {
      prompt: '0.000001817',
      completion: '0.000001817',
      request: '0',
      image: '0',
    },
    top_provider: {
      context_length: 1000000,
      max_completion_tokens: null,
      is_moderated: false,
    },
    type: 'chat',
    context_window: 1000000,
  } as const

  test('maps the real nested architecture.* fields', () => {
    // `architecture.*` is the actual drift: one level deeper than the flat
    // `modality`/`tokenizer`/`instruct_type` that `openrouter.ts` reads. Before
    // the remediation all three were `undefined` on 33/33 models.
    const model = parseCleanApisModelsForTest({ data: [REAL_MUSE_SPARK] })[0]
    expect(model?.modality).toBe('text+image->text')
    expect(model?.tokenizer).toBe('Other')
    // `instruct_type` is `null` in the real payload — absent, not empty-string.
    expect(model?.instructType).toBeUndefined()
  })

  test('maps the real top-level top_provider', () => {
    const model = parseCleanApisModelsForTest({ data: [REAL_MUSE_SPARK] })[0]
    expect(model?.topProvider).toEqual({
      contextLength: 1000000,
      maxCompletionTokens: undefined,
      isModerated: false,
    })
  })

  test('a null nested max_completion_tokens is omitted, never fabricated', () => {
    // The vendor publishes NO max-output: `top_provider.max_completion_tokens`
    // is `null` on all 33 models. The negative leg matters because the
    // pre-remediation fix I first recommended — routing that nested value into
    // the top-level `maxCompletionTokens` — would have made a number appear
    // that the catalog does not carry.
    const model = parseCleanApisModelsForTest({ data: [REAL_MUSE_SPARK] })[0]
    expect(model?.maxCompletionTokens).toBeUndefined()
    expect(model?.topProvider?.maxCompletionTokens).toBeUndefined()
  })

  test('coerces the real string pricing to a number', () => {
    // `pricing.prompt` is the STRING "0.000001817", matching OpenRouter's wire
    // shape and its `Number(prompt)` coercion. NaN would render literally.
    const model = parseCleanApisModelsForTest({ data: [REAL_MUSE_SPARK] })[0]
    expect(model?.promptPricePerToken).toBe(0.000001817)
    expect(model?.completionPricePerToken).toBe(0.000001817)
  })

  test('a non-numeric price degrades to undefined, not NaN', () => {
    const model = parseCleanApisModelsForTest({
      data: [{ id: 'x', pricing: { prompt: 'not-a-number', completion: '' } }],
    })[0]
    expect(model?.promptPricePerToken).toBeUndefined()
    expect(model?.completionPricePerToken).toBeUndefined()
  })

  test('a model with no architecture/top_provider/pricing still parses', () => {
    // All three nested objects are optional: a catalog revision that drops them
    // must degrade to "less detail shown", never to a dropped model.
    const model = parseCleanApisModelsForTest({
      data: [{ id: 'bare', name: 'Bare' }],
    })[0]
    expect(model?.id).toBe('cleanapis/bare')
    expect(model?.modality).toBeUndefined()
    expect(model?.tokenizer).toBeUndefined()
    expect(model?.topProvider).toBeUndefined()
    expect(model?.promptPricePerToken).toBeUndefined()
  })
})
