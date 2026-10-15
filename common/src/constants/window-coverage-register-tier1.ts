/**
 * Tier 1 first-party window coverage entries (FID-2026-1012-026).
 *
 * Static catalogs use the dated models.dev rows as their fallback source;
 * Venice publishes runtime windows and DeepInfra publishes ids only.
 */
export const TIER1_WINDOW_COVERAGE_ENTRIES = [
  [
    'anthropic',
    {
      disposition: 'table-section',
      note: 'Static 17-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'google',
    {
      disposition: 'table-section',
      note: 'Static 18-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; public OpenAI-compatible list measured HTTP 404.',
    },
  ],
  [
    'xai',
    {
      disposition: 'table-section',
      note: 'Static 7-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'deepseek',
    {
      disposition: 'table-section',
      note: 'Static 3-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'groq',
    {
      disposition: 'table-section',
      note: 'Static 9-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'cohere',
    {
      disposition: 'table-section',
      note: 'Static 13-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'togetherai',
    {
      disposition: 'table-section',
      note: 'Static 29-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'cerebras',
    {
      disposition: 'table-section',
      note: 'Static 2-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 403.',
    },
  ],
  [
    'deepinfra',
    {
      disposition: 'table-section',
      note: 'Public live ids-only catalog measured HTTP 200; 177 rows in the 2026-10-12 sweep and no window fields, with 70 curated models.dev fallback rows.',
    },
  ],
  [
    'perplexity',
    {
      disposition: 'table-section',
      note: 'Static 3-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; public model list measured HTTP 404.',
    },
  ],
  [
    'alibaba',
    {
      disposition: 'table-section',
      note: 'Static 40-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'moonshotai',
    {
      disposition: 'table-section',
      note: 'Static 4-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'zai',
    {
      disposition: 'table-section',
      note: 'Static 14-model coding catalog curated from the models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'minimax',
    {
      disposition: 'table-section',
      note: 'Static 7-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'meta',
    {
      disposition: 'table-section',
      note: 'Static 6-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'fireworks-ai',
    {
      disposition: 'table-section',
      note: 'Static 22-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'baseten',
    {
      disposition: 'table-section',
      note: 'Static 24-model catalog from models.dev snapshot fetched 2026-10-14; key-gated catalog surface measured HTTP 401.',
    },
  ],
  [
    'venice',
    {
      disposition: 'runtime-published',
      note: 'Public live catalog measured HTTP 200 with 130 rows and context_length on every row in the 2026-10-12 sweep.',
    },
  ],
] as const
