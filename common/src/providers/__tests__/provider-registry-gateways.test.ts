import { describe, expect, test } from 'bun:test'

import { PROVIDER_REGISTRY } from '../registry'

/**
 * Gateway full-entry pins (FID-2026-0914-001 file split —
 * provider-registry.test.ts sat at the 300-line cap).
 *
 * hcnsec + tokenbom pins moved verbatim from provider-registry.test.ts;
 * infron + unorouter pins are new (FID-2026-0914-001). Literals come from
 * the vendors' documented contracts + this FID's live probes.
 */
describe('gateway registry entries (full-entry pins)', () => {
  test('hcnsec + tokenbom entries match the audited contracts (FID-2026-0913-001)', () => {
    expect(PROVIDER_REGISTRY.hcnsec).toEqual({
      id: 'hcnsec',
      label: 'HCNSec',
      kind: 'gateway',
      credentials: {
        envVar: 'HCNSEC_API_KEY',
        missingKeyMessage:
          'HCNSec API key not set. Set HCNSEC_API_KEY environment variable or run /provider hcnsec.',
      },
      baseUrl: 'https://api.hcnsec.cn/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'hcnsec' },
      setupAvailable: true,
      domain: 'hcnsec.cn',
      order: 4,
    })
    expect(PROVIDER_REGISTRY.tokenbom).toEqual({
      id: 'tokenbom',
      label: 'TokenBom',
      kind: 'gateway',
      credentials: {
        envVar: 'TOKENBOM_API_KEY',
        missingKeyMessage:
          'TokenBom API key not set. Set TOKENBOM_API_KEY environment variable or run /provider tokenbom.',
      },
      baseUrl: 'https://tokenbom.com/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'tokenbom' },
      setupAvailable: true,
      domain: 'tokenbom.com',
      order: 4,
    })
  })

  test('infron + unorouter entries match the documented contracts (FID-2026-0914-001)', () => {
    // Infron: docs quickstart pins the INFERENCE host llm.onerouter.pro/v1;
    // api.infron.ai is the catalog host only. Static curated allowlist per
    // the operator rulings (4 free + 5 top coding, chat-only).
    expect(PROVIDER_REGISTRY.infron).toEqual({
      id: 'infron',
      label: 'Infron',
      kind: 'gateway',
      credentials: {
        envVar: 'INFRON_API_KEY',
        missingKeyMessage:
          'Infron API key not set. Set INFRON_API_KEY environment variable or run /provider infron.',
      },
      baseUrl: 'https://llm.onerouter.pro/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'infron' },
      setupAvailable: true,
      domain: 'infron.ai',
      order: 4,
    })
    // UnoRouter: docs quickstart BASE_URL = https://api.unorouter.com/v1.
    // QuantumNous New API reseller class — curated allowlist + personal-use
    // provenance (Trust Provenance in the FID).
    expect(PROVIDER_REGISTRY.unorouter).toEqual({
      id: 'unorouter',
      label: 'UnoRouter',
      kind: 'gateway',
      credentials: {
        envVar: 'UNOROUTER_API_KEY',
        missingKeyMessage:
          'UnoRouter API key not set. Set UNOROUTER_API_KEY environment variable or run /provider unorouter.',
      },
      baseUrl: 'https://api.unorouter.com/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'unorouter' },
      setupAvailable: true,
      domain: 'unorouter.com',
      order: 4,
    })
  })

  test('bazaarlink entry matches the audited contract (FID-2026-0915-006)', () => {
    // Vendor quickstart pins api.bazaarlink.ai/v1; STATIC one-model
    // allowlist per the operator "Qwen free only" ruling + identity
    // gauntlet T51-C (deepseek channels substituted, auto:free excluded).
    expect(PROVIDER_REGISTRY.bazaarlink).toEqual({
      id: 'bazaarlink',
      label: 'BazaarLink',
      kind: 'gateway',
      credentials: {
        envVar: 'BAZAARLINK_API_KEY',
        missingKeyMessage:
          'BazaarLink API key not set. Set BAZAARLINK_API_KEY environment variable or run /provider bazaarlink.',
      },
      baseUrl: 'https://api.bazaarlink.ai/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'bazaarlink' },
      setupAvailable: true,
      domain: 'bazaarlink.ai',
      order: 4,
    })
  })
})
