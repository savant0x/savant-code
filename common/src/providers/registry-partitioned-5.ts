/**
 * Tier 1 first-party provider entries (FID-2026-1012-026), partition five,
 * plus later standalone additions (the marsai entry, FID-2026-1016-004).
 */
import type { ProviderConfig } from './types'

export const PROVIDER_REGISTRY_PARTITION_5 = {
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'gateway',
    credentials: { envVar: 'PERPLEXITY_API_KEY' },
    baseUrl: 'https://api.perplexity.ai',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'perplexity' },
    setupAvailable: true,
    domain: 'perplexity.ai',
    order: 4,
  },
  alibaba: {
    id: 'alibaba',
    label: 'Alibaba Cloud',
    kind: 'gateway',
    credentials: { envVar: 'DASHSCOPE_API_KEY' },
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'alibaba' },
    setupAvailable: true,
    domain: 'aliyun.com',
    order: 4,
  },
  moonshotai: {
    id: 'moonshotai',
    label: 'Moonshot AI',
    kind: 'gateway',
    credentials: { envVar: 'MOONSHOT_API_KEY' },
    baseUrl: 'https://api.moonshot.ai/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'moonshotai' },
    setupAvailable: true,
    domain: 'moonshot.ai',
    order: 4,
  },
  zai: {
    id: 'zai',
    label: 'Z.AI',
    kind: 'gateway',
    credentials: { envVar: 'ZHIPU_API_KEY' },
    baseUrl: 'https://api.z.ai/api/paas/v4',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'zai' },
    setupAvailable: true,
    domain: 'z.ai',
    order: 4,
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    kind: 'gateway',
    credentials: { envVar: 'MINIMAX_API_KEY' },
    baseUrl: 'https://api.minimax.io/anthropic',
    protocol: 'anthropic',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'minimax' },
    setupAvailable: true,
    domain: 'minimax.io',
    order: 4,
  },
  meta: {
    id: 'meta',
    label: 'Meta Llama API',
    kind: 'gateway',
    credentials: { envVar: 'META_MODEL_API_KEY' },
    baseUrl: 'https://api.llama.com/llama',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'meta' },
    setupAvailable: true,
    domain: 'llama.com',
    order: 4,
  },
  'fireworks-ai': {
    id: 'fireworks-ai',
    label: 'Fireworks AI',
    kind: 'gateway',
    credentials: { envVar: 'FIREWORKS_API_KEY' },
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'fireworks-ai' },
    setupAvailable: true,
    domain: 'fireworks.ai',
    order: 4,
  },
  baseten: {
    id: 'baseten',
    label: 'Baseten',
    kind: 'gateway',
    credentials: { envVar: 'BASETEN_API_KEY' },
    baseUrl: 'https://inference.baseten.co/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'static', modelsRef: 'baseten' },
    setupAvailable: true,
    domain: 'baseten.co',
    order: 4,
  },
  venice: {
    id: 'venice',
    label: 'Venice AI',
    kind: 'gateway',
    credentials: { envVar: 'VENICE_API_KEY' },
    baseUrl: 'https://api.venice.ai/api/v1',
    protocol: 'openai',
    idTransform: 'strip',
    catalog: { source: 'live', url: 'https://api.venice.ai/api/v1/models' },
    setupAvailable: true,
    domain: 'venice.ai',
    order: 4,
  },
  // Operator-supplied provider (FID-2026-1016-004): the endpoint is given
  // in session; the model roster is the 14-id free tier from the operator
  // dashboard census 2026-10-16 (console-verified — the figure is only
  // visible behind the operator's account). The live /v1/models probe is
  // blocked from this network (DNS hijack + TLS reset — DoH records
  // 104.21.63.63 / 172.67.143.237), so the checked-in set is the source of
  // truth. `idTransform: 'keep'` — `marsai/` is part of the real vendor
  // slug (the openrouter precedent; every dashboard Model ID is shown
  // pre-prefixed), so the full routing id goes to the vendor unchanged.
  marsai: {
    id: 'marsai',
    label: 'MarsAI',
    kind: 'gateway',
    credentials: {
      envVar: 'MARSAI_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'MarsAI API key not set. Set MARSAI_API_KEY environment variable or run /provider marsai.',
    },
    baseUrl: 'https://marsai.click/v1',
    protocol: 'openai',
    idTransform: 'keep',
    catalog: {
      source: 'static',
      modelsRef: 'marsai',
      evidence: {
        class: 'console-verified',
        source:
          'Operator dashboard Models page census — 14 free-tier ids, every Model ID showing the marsai/ slug; 24/29 models operational. Pasted in session 2026-10-16.',
        verified: '2026-10-16',
        witness: 'operator dashboard paste, session 2026-10-16',
      },
    },
    setupAvailable: true,
    domain: 'marsai.click',
    order: 4,
  },
} as const satisfies Record<string, ProviderConfig>
