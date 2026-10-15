import { describe, expect, test } from 'bun:test'

import { minimaxModels } from '../constants/model-config'
import {
  canSavantFreeModelSpawnGeminiThinker,
  FALLBACK_SAVANT_FREE_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_KIMI_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_IDS,
  SAVANT_FREE_MIMO_V25_MODEL_ID,
  SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
  SAVANT_FREE_MODELS,
  SAVANT_FREE_WEB_MODELS,
  SUPPORTED_SAVANT_FREE_MODELS,
  getSavantFreeDeploymentAvailabilityLabel,
  getSavantFreeModelsForAccessTier,
  getRecommendedSavantFreeModelId,
  isSavantFreeDeploymentHours,
  isSavantFreeModelId,
  isSavantFreeModelAllowedForAccessTier,
  isSavantFreePremiumModelId,
  isSavantFreeWebModelId,
  isSavantFreeWebPremiumModelId,
  isSupportedSavantFreeModelId,
  resolveSavantFreeWebModel,
  resolveSavantFreeModelForAccessTier,
} from '../constants/savant-free-models'

const MINIMAX_M3_MODEL_ID = minimaxModels.minimaxM3

// FID-2026-0819-005 Loop 292: access-tier, retirement, recommendation, and deployment-hours suites moved verbatim from savant-free-models.test.ts.
describe('savant-free model availability', () => {
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
