import { describe, expect, test } from 'bun:test'

import { minimaxModels } from '../constants/model-config'
import {
  canSavantFreeModelSpawnGeminiThinker,
  DEFAULT_SAVANT_FREE_MODEL_ID,
  FALLBACK_SAVANT_FREE_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  SAVANT_FREE_DATA_COLLECTION_WARNING,
  SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  SAVANT_FREE_ENABLE_MIMO_MODELS_IN_UI,
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_HY3_ATLAS_MODEL_ID,
  SAVANT_FREE_HY3_MODEL_ID,
  SAVANT_FREE_HY3_OPENROUTER_FREE_MODEL_ID,
  SAVANT_FREE_HY3_OPENROUTER_PAID_MODEL_ID,
  SAVANT_FREE_KIMI_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_IDS,
  SAVANT_FREE_MIMO_V25_MODEL_ID,
  SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
  SAVANT_FREE_MODELS,
  SAVANT_FREE_WEB_GOD_ONLY_MODELS,
  SAVANT_FREE_WEB_MODELS,
  SUPPORTED_SAVANT_FREE_MODELS,
  getSavantFreeDeploymentAvailabilityLabel,
  getSavantFreeWebModel,
  getSavantFreeModelsForAccessTier,
  getRecommendedSavantFreeModelId,
  isSavantFreeDeploymentHours,
  isSavantFreeTracedModelId,
  isSavantFreeModelId,
  isSavantFreeModelAllowedForAccessTier,
  isSavantFreePremiumModelId,
  isSavantFreeWebGodOnlyModelId,
  isSavantFreeWebModelId,
  isSavantFreeWebPremiumModelId,
  isSupportedSavantFreeModelId,
  resolveSavantFreeWebModel,
  resolveSavantFreeModelForAccessTier,
} from '../constants/savant-free-models'

import type { SavantFreeModel } from '../constants/savant-free-models'

const MINIMAX_M3_MODEL_ID = minimaxModels.minimaxM3

describe('savant-free model availability', () => {
  test('defaults to MiniMax M3, falls back to DeepSeek V4 Flash for new clients', () => {
    expect(DEFAULT_SAVANT_FREE_MODEL_ID).toBe(MINIMAX_M3_MODEL_ID)
    expect(FALLBACK_SAVANT_FREE_MODEL_ID).toBe(
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
  })

  test('DeepSeek Pro carries the data-collection warning so users see it before picking', () => {
    const deepseek = SAVANT_FREE_MODELS.find(
      (m) => m.id === SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
    )
    expect((deepseek as { warning?: string } | undefined)?.warning).toBe(
      'Collects data for training',
    )
  })

  test('DeepSeek Flash carries the data-collection warning so users see it before picking', () => {
    const deepseek = SAVANT_FREE_MODELS.find(
      (m) => m.id === SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect((deepseek as { warning?: string } | undefined)?.warning).toBe(
      'Collects data for training',
    )
  })

  test('only the DeepSeek family is trace-stored in free mode; M3 has no warning', () => {
    const m3 = SAVANT_FREE_MODELS.find((m) => m.id === MINIMAX_M3_MODEL_ID)
    expect((m3 as { warning?: string } | undefined)?.warning).toBeUndefined()
    // The DeepSeek family discloses data collection and IS stored.
    expect(
      isSavantFreeTracedModelId(SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(true)
    expect(
      isSavantFreeTracedModelId(SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe(true)
    // Everything else (incl. M3 on Fireworks) is NOT stored.
    expect(isSavantFreeTracedModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(isSavantFreeTracedModelId(SAVANT_FREE_KIMI_MODEL_ID)).toBe(false)
    expect(isSavantFreeTracedModelId(SAVANT_FREE_MIMO_V25_MODEL_ID)).toBe(false)
    expect(isSavantFreeTracedModelId(null)).toBe(false)
  })

  test('trace storage is one source of truth with the data-collection warning', () => {
    // A model is traced in free mode iff it shows the data-collection caveat.
    const models: readonly SavantFreeModel[] = SUPPORTED_SAVANT_FREE_MODELS
    for (const model of models) {
      expect(isSavantFreeTracedModelId(model.id)).toBe(
        model.warning === SAVANT_FREE_DATA_COLLECTION_WARNING,
      )
    }
  })

  test('DeepSeek V4 Flash is selectable and non-premium', () => {
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(isSavantFreeModelId(SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID)).toBe(
      true,
    )
    expect(
      isSavantFreePremiumModelId(SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe(false)
  })

  test('MiMo models remain supported and follow the UI rollout flag', () => {
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
    )
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_MIMO_V25_MODEL_ID,
    )

    if (SAVANT_FREE_ENABLE_MIMO_MODELS_IN_UI) {
      expect(SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
        SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      )
      expect(SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
        SAVANT_FREE_MIMO_V25_MODEL_ID,
      )
    } else {
      expect(SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
        SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      )
      expect(SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
        SAVANT_FREE_MIMO_V25_MODEL_ID,
      )
    }

    expect(isSavantFreePremiumModelId(SAVANT_FREE_MIMO_V25_PRO_MODEL_ID)).toBe(
      true,
    )
    expect(isSavantFreePremiumModelId(SAVANT_FREE_MIMO_V25_MODEL_ID)).toBe(
      false,
    )
  })

  test('Kimi K2.7 Code is offered in pickers and server-supported for full mode', () => {
    expect(SAVANT_FREE_KIMI_MODEL_ID).toBe('moonshotai/kimi-k2.7-code')
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_KIMI_MODEL_ID,
    )
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_KIMI_MODEL_ID,
    )
    expect(getSavantFreeModelsForAccessTier('full').map((m) => m.id)).toContain(
      SAVANT_FREE_KIMI_MODEL_ID,
    )
    expect(isSavantFreeModelId(SAVANT_FREE_KIMI_MODEL_ID)).toBe(true)
    expect(isSupportedSavantFreeModelId(SAVANT_FREE_KIMI_MODEL_ID)).toBe(true)
    expect(isSavantFreePremiumModelId(SAVANT_FREE_KIMI_MODEL_ID)).toBe(true)
    expect(
      isSavantFreeModelAllowedForAccessTier(SAVANT_FREE_KIMI_MODEL_ID, 'full'),
    ).toBe(true)
    expect(
      resolveSavantFreeModelForAccessTier(SAVANT_FREE_KIMI_MODEL_ID, 'full'),
    ).toBe(SAVANT_FREE_KIMI_MODEL_ID)
    // Retired K2.6 is no longer a savant-free model; stale saved selections must
    // fall back rather than be admitted.
    expect(isSupportedSavantFreeModelId('moonshotai/kimi-k2.6')).toBe(false)
    expect(
      isSavantFreeModelAllowedForAccessTier('moonshotai/kimi-k2.6', 'full'),
    ).toBe(false)
    expect(
      resolveSavantFreeModelForAccessTier('moonshotai/kimi-k2.6', 'full'),
    ).not.toBe('moonshotai/kimi-k2.6')
  })

  test('HY3 OpenRouter trial is available only as a SavantFree Web premium model for now', () => {
    expect(SAVANT_FREE_HY3_MODEL_ID).toBe(
      SAVANT_FREE_HY3_OPENROUTER_FREE_MODEL_ID,
    )
    expect(SAVANT_FREE_HY3_OPENROUTER_PAID_MODEL_ID).toBe(
      SAVANT_FREE_HY3_ATLAS_MODEL_ID,
    )
    expect(SAVANT_FREE_WEB_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_HY3_MODEL_ID,
    )
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      SAVANT_FREE_HY3_MODEL_ID,
    )
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      SAVANT_FREE_HY3_MODEL_ID,
    )

    expect(isSavantFreeWebModelId(SAVANT_FREE_HY3_MODEL_ID)).toBe(true)
    expect(isSavantFreeWebPremiumModelId(SAVANT_FREE_HY3_MODEL_ID)).toBe(true)
    expect(isSavantFreePremiumModelId(SAVANT_FREE_HY3_MODEL_ID)).toBe(false)
    expect(isSavantFreeModelId(SAVANT_FREE_HY3_MODEL_ID)).toBe(false)
    expect(isSupportedSavantFreeModelId(SAVANT_FREE_HY3_MODEL_ID)).toBe(false)
    expect(resolveSavantFreeWebModel(SAVANT_FREE_HY3_MODEL_ID)).toBe(
      SAVANT_FREE_HY3_MODEL_ID,
    )
    expect(getSavantFreeWebModel(SAVANT_FREE_HY3_MODEL_ID).displayName).toBe(
      'HY3',
    )
    expect(getSavantFreeWebModel(SAVANT_FREE_HY3_MODEL_ID).tagline).toBe(
      'Trialing its performance',
    )
  })

  test('HY3 Atlas is a god-only SavantFree Web premium model', () => {
    expect(SAVANT_FREE_WEB_GOD_ONLY_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_HY3_ATLAS_MODEL_ID,
    )
    expect(SAVANT_FREE_WEB_MODELS.map((model) => model.id)).not.toContain(
      SAVANT_FREE_HY3_ATLAS_MODEL_ID,
    )
    expect(isSavantFreeWebModelId(SAVANT_FREE_HY3_ATLAS_MODEL_ID)).toBe(false)
    expect(
      isSavantFreeWebModelId(SAVANT_FREE_HY3_ATLAS_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(true)
    expect(isSavantFreeWebGodOnlyModelId(SAVANT_FREE_HY3_ATLAS_MODEL_ID)).toBe(
      true,
    )
    expect(isSavantFreeWebPremiumModelId(SAVANT_FREE_HY3_ATLAS_MODEL_ID)).toBe(
      true,
    )
    expect(resolveSavantFreeWebModel(SAVANT_FREE_HY3_ATLAS_MODEL_ID)).toBe(
      FALLBACK_SAVANT_FREE_MODEL_ID,
    )
    expect(
      resolveSavantFreeWebModel(SAVANT_FREE_HY3_ATLAS_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(SAVANT_FREE_HY3_ATLAS_MODEL_ID)
    expect(
      getSavantFreeWebModel(SAVANT_FREE_HY3_ATLAS_MODEL_ID).displayName,
    ).toBe('HY3 Atlas')
  })

  test('KAT Coder Pro V2 is fully retired from SavantFree Web and Cloud', () => {
    const retiredKatModelId = 'kwaipilot/kat-coder-pro-v2'
    expect(SAVANT_FREE_WEB_MODELS.map((model) => model.id)).not.toContain(
      retiredKatModelId,
    )
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      retiredKatModelId,
    )
    expect(isSavantFreeWebModelId(retiredKatModelId)).toBe(false)
    expect(isSavantFreeWebPremiumModelId(retiredKatModelId)).toBe(false)
    expect(resolveSavantFreeWebModel(retiredKatModelId)).toBe(
      FALLBACK_SAVANT_FREE_MODEL_ID,
    )
  })

  test('MiniMax M2.7 support is fully removed', () => {
    const legacyMinimaxM27 = 'minimax/minimax-m2.7'
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      legacyMinimaxM27,
    )
    expect(isSavantFreeModelId(legacyMinimaxM27)).toBe(false)
    expect(isSupportedSavantFreeModelId(legacyMinimaxM27)).toBe(false)
    expect(
      isSavantFreeModelAllowedForAccessTier(legacyMinimaxM27, 'full'),
    ).toBe(false)
    // Old clients with a saved M2.7 selection resolve to the fallback model.
    expect(resolveSavantFreeModelForAccessTier(legacyMinimaxM27, 'full')).toBe(
      FALLBACK_SAVANT_FREE_MODEL_ID,
    )
  })

  test('MiniMax M3 is a selectable unlimited model, last in the unlimited section', () => {
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      MINIMAX_M3_MODEL_ID,
    )
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      MINIMAX_M3_MODEL_ID,
    )
    expect(getSavantFreeModelsForAccessTier('full').map((m) => m.id)).toContain(
      MINIMAX_M3_MODEL_ID,
    )
    expect(isSavantFreeModelId(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(isSupportedSavantFreeModelId(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(isSavantFreePremiumModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(
      isSavantFreeModelAllowedForAccessTier(MINIMAX_M3_MODEL_ID, 'full'),
    ).toBe(true)
    // MiniMax M3 is the recommended default, so it leads the picker list.
    expect(SAVANT_FREE_MODELS[0]!.id).toBe(MINIMAX_M3_MODEL_ID)
  })

  test('limited access exposes DeepSeek V4 Flash and non-Pro MiMo 2.5', () => {
    expect(LIMITED_SAVANT_FREE_MODEL_ID).toBe(
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(LIMITED_SAVANT_FREE_MODEL_IDS).toEqual([
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      SAVANT_FREE_MIMO_V25_MODEL_ID,
    ])
    expect(
      getSavantFreeModelsForAccessTier('limited').map((m) => m.id),
    ).toEqual([
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      SAVANT_FREE_MIMO_V25_MODEL_ID,
    ])
    expect(
      isSavantFreeModelAllowedForAccessTier(
        SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
        'limited',
      ),
    ).toBe(true)
    expect(
      isSavantFreeModelAllowedForAccessTier(MINIMAX_M3_MODEL_ID, 'limited'),
    ).toBe(false)
    expect(
      isSavantFreeModelAllowedForAccessTier(
        SAVANT_FREE_MIMO_V25_MODEL_ID,
        'limited',
      ),
    ).toBe(true)
    expect(
      isSavantFreeModelAllowedForAccessTier(
        SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
        'limited',
      ),
    ).toBe(false)
    expect(
      resolveSavantFreeModelForAccessTier(
        SAVANT_FREE_MIMO_V25_MODEL_ID,
        'limited',
      ),
    ).toBe(SAVANT_FREE_MIMO_V25_MODEL_ID)
    expect(
      resolveSavantFreeModelForAccessTier(MINIMAX_M3_MODEL_ID, 'limited'),
    ).toBe(SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID)
  })

  test('recommends an unlimited, in-tier model for the picker hero', () => {
    // Full access → MiniMax M3 (the unlimited default), so the one-Enter
    // start never burns a premium session.
    expect(getRecommendedSavantFreeModelId('full')).toBe(MINIMAX_M3_MODEL_ID)
    expect(getRecommendedSavantFreeModelId(undefined)).toBe(MINIMAX_M3_MODEL_ID)
    expect(
      isSavantFreePremiumModelId(getRecommendedSavantFreeModelId('full')),
    ).toBe(false)
    // Limited access → DeepSeek V4 Flash, which is in the limited model set.
    expect(getRecommendedSavantFreeModelId('limited')).toBe(
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(
      getSavantFreeModelsForAccessTier('limited').some(
        (m) => m.id === getRecommendedSavantFreeModelId('limited'),
      ),
    ).toBe(true)
  })

  test('full-access savant-free models can spawn the gemini-thinker subagent', () => {
    // Full-access models (non-limited, non-fastest) get the thinker.
    expect(
      canSavantFreeModelSpawnGeminiThinker(SAVANT_FREE_KIMI_MODEL_ID),
    ).toBe(true)
    expect(
      canSavantFreeModelSpawnGeminiThinker(
        SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      canSavantFreeModelSpawnGeminiThinker(SAVANT_FREE_MIMO_V25_PRO_MODEL_ID),
    ).toBe(true)
    expect(canSavantFreeModelSpawnGeminiThinker(MINIMAX_M3_MODEL_ID)).toBe(true)

    // Limited-tier models (DeepSeek V4 Flash, MiMo 2.5) skip it.
    expect(
      canSavantFreeModelSpawnGeminiThinker(
        SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      ),
    ).toBe(false)
    expect(
      canSavantFreeModelSpawnGeminiThinker(SAVANT_FREE_MIMO_V25_MODEL_ID),
    ).toBe(false)
  })

  test('does not support GLM 5.1 for savant-free sessions', () => {
    const glm = 'z-ai/glm-5.1'
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(glm)
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      glm,
    )
    expect(isSavantFreeModelId(glm)).toBe(false)
    expect(isSupportedSavantFreeModelId(glm)).toBe(false)
  })

  test('surfaces referral-gated GLM 5.2 only in the Web and Cloud picker', () => {
    expect(SAVANT_FREE_WEB_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_GLM_V52_MODEL_ID,
    )
    expect(SUPPORTED_SAVANT_FREE_MODELS.map((model) => model.id)).toContain(
      SAVANT_FREE_GLM_V52_MODEL_ID,
    )
    expect(SAVANT_FREE_MODELS.map((model) => model.id)).not.toContain(
      SAVANT_FREE_GLM_V52_MODEL_ID,
    )
    expect(isSavantFreeWebPremiumModelId(SAVANT_FREE_GLM_V52_MODEL_ID)).toBe(
      false,
    )
  })

  test('formats the close time in the user local timezone while deployment is open', () => {
    expect(
      getSavantFreeDeploymentAvailabilityLabel(
        new Date('2026-01-05T18:00:00Z'),
        {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
        },
      ),
    ).toBe('until 5:00 PM')
  })

  test('formats the next open time in the user local timezone while deployment is closed', () => {
    expect(
      getSavantFreeDeploymentAvailabilityLabel(
        new Date('2026-01-05T12:00:00Z'),
        {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
        },
      ),
    ).toBe('opens 6:00 AM')
  })

  test('includes the weekday when the next opening is on a later local day', () => {
    expect(
      getSavantFreeDeploymentAvailabilityLabel(
        new Date('2026-01-11T03:00:00Z'),
        {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
        },
      ),
    ).toBe('opens Sun 6:00 AM')
  })

  test('tracks deployment hours correctly across the open and close boundaries', () => {
    expect(isSavantFreeDeploymentHours(new Date('2026-01-05T13:59:00Z'))).toBe(
      false,
    )
    expect(isSavantFreeDeploymentHours(new Date('2026-01-05T14:00:00Z'))).toBe(
      true,
    )
    expect(isSavantFreeDeploymentHours(new Date('2026-01-06T00:59:00Z'))).toBe(
      true,
    )
    expect(isSavantFreeDeploymentHours(new Date('2026-01-06T01:00:00Z'))).toBe(
      false,
    )
    expect(isSavantFreeDeploymentHours(new Date('2026-01-10T20:00:00Z'))).toBe(
      true,
    )
  })
})
