import { describe, expect, test } from 'bun:test'

import { deriveSetupConfig } from '../derive'
import { PROVIDER_REGISTRY } from '../registry'

describe('provider setup derivation', () => {
  test('setup config derives exactly the forty-seven current setup providers', () => {
    const setup = deriveSetupConfig(PROVIDER_REGISTRY)
    expect(Object.keys(setup).sort()).toEqual([
      'aihubmix',
      'alibaba',
      'anthropic',
      'apinex',
      'apixo',
      'atria',
      'bai',
      'baseten',
      'bazaarlink',
      'cerebras',
      'chatanywhere',
      'cleanapis',
      'cloudflare',
      'codecraft',
      'cohere',
      'commandcode',
      'deepinfra',
      'deepseek',
      'fireworks-ai',
      'google',
      'groq',
      'hcnsec',
      'infron',
      'intern',
      'kiosapi',
      'marsai',
      'meta',
      'minimax',
      'mistral',
      'moonshotai',
      'nous',
      'nvidia',
      'openai',
      'openrouter',
      'orcarouter',
      'perplexity',
      'tiarina',
      'togetherai',
      'tokenbom',
      'tokenharbor',
      'tokenrouter',
      'unorouter',
      'venice',
      'vercel',
      'xai',
      'xkiro',
      'zai',
    ])
    expect(setup.openai).toEqual({
      label: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(setup.openrouter).toEqual({
      label: 'OpenRouter',
      envVar: 'OPENROUTER_API_KEY',
      baseUrl: 'https://openrouter.ai/api/v1',
    })
    expect(setup.tokenharbor).toEqual({
      label: 'TokenHarbor',
      envVar: 'TOKENHARBOR_API_KEY',
      baseUrl: 'https://tokenharbor.ai/v1',
    })
    expect(setup.nous).toEqual({
      label: 'Nous Research',
      envVar: 'NOUS_API_KEY',
      baseUrl: 'https://inference-api.nousresearch.com/v1',
    })
    expect(setup.kiosapi).toEqual({
      label: 'KiosAPI',
      envVar: 'KIOSAPI_API_KEY',
      baseUrl: 'https://kiosapi.com/v1',
    })
    expect(setup.apinex).toEqual({
      label: 'APInex',
      envVar: 'APINEX_API_KEY',
      baseUrl: 'https://api.apinex.bond/v1',
    })
    expect(setup.cleanapis).toEqual({
      label: 'Clean APIs',
      envVar: 'CLEANAPIS_API_KEY',
      baseUrl: 'https://cleanapis.com/v1',
    })
    expect(setup.chatanywhere).toEqual({
      label: 'ChatAnywhere',
      envVar: 'CHATANYWHERE_API_KEY',
      baseUrl: 'https://api.chatanywhere.tech/v1',
    })
  })
})
