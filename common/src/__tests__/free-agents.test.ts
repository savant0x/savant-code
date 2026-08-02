import { describe, expect, test } from 'bun:test'

import {
  SAVANT_FREE_DESKTOP_THREAD_AGENT_ID,
  getSavantFreeRootAgentIdForModel,
  isSavantFreeGeminiThinkerAgent,
  isSavantFreeRootAgent,
  isFreeModeAllowedAgentModel,
  shouldUseLocalTokenCountForSavantFreeDeepseekFlash,
} from '../constants/free-agents'
import { minimaxModels } from '../constants/model-config'
import { SAVANT_FREE_GEMINI_THINKER_AGENT_ID } from '../constants/savant-free-gemini-thinker'
import {
  SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  SAVANT_FREE_GEMINI_PRO_MODEL_ID,
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_HY3_ATLAS_MODEL_ID,
  SAVANT_FREE_HY3_MODEL_ID,
  SAVANT_FREE_KIMI_MODEL_ID,
  SAVANT_FREE_MIMO_V25_MODEL_ID,
  SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
} from '../constants/savant-free-models'

const MINIMAX_M3_MODEL_ID = minimaxModels.minimaxM3
// Removed model: support was dropped entirely (client + server).
const LEGACY_MINIMAX_M2_7_MODEL_ID = 'minimax/minimax-m2.7'

describe('free mode agent model allowlist', () => {
  test('maps supported savant-free models to concrete root agents', () => {
    expect(getSavantFreeRootAgentIdForModel(SAVANT_FREE_KIMI_MODEL_ID)).toBe(
      'savant-free-kimi',
    )
    expect(
      getSavantFreeRootAgentIdForModel(SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe('savant-free-deepseek')
    expect(
      getSavantFreeRootAgentIdForModel(SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe('savant-free-deepseek-flash')
    expect(
      getSavantFreeRootAgentIdForModel(SAVANT_FREE_MIMO_V25_PRO_MODEL_ID),
    ).toBe('savant-free-mimo-pro')
    expect(
      getSavantFreeRootAgentIdForModel(SAVANT_FREE_MIMO_V25_MODEL_ID),
    ).toBe('savant-free-mimo')
    expect(getSavantFreeRootAgentIdForModel(MINIMAX_M3_MODEL_ID)).toBe(
      'savant-free-minimax-m3',
    )
  })

  test('allows each savant-free root agent only with its configured model', () => {
    expect(
      isFreeModeAllowedAgentModel('savant-free', MINIMAX_M3_MODEL_ID),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('savant-free', LEGACY_MINIMAX_M2_7_MODEL_ID),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free',
        SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('savant-free', SAVANT_FREE_KIMI_MODEL_ID),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-kimi',
        SAVANT_FREE_KIMI_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-deepseek',
        SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-deepseek-flash',
        SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-mimo-pro',
        SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-mimo',
        SAVANT_FREE_MIMO_V25_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-mimo',
        SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      ),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-mimo',
        `${SAVANT_FREE_MIMO_V25_MODEL_ID}-20260527`,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-minimax-m3',
        MINIMAX_M3_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free-minimax-m3',
        LEGACY_MINIMAX_M2_7_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('allows the SavantFree Desktop root agent with every desktop model', () => {
    // The desktop runs ONE root id across all its picker models (model chosen
    // per tab), so each desktop-pickable model must be allowed for it.
    for (const model of [
      MINIMAX_M3_MODEL_ID,
      SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      SAVANT_FREE_KIMI_MODEL_ID,
      SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      SAVANT_FREE_MIMO_V25_MODEL_ID,
      SAVANT_FREE_GLM_V52_MODEL_ID,
    ]) {
      expect(
        isFreeModeAllowedAgentModel(SAVANT_FREE_DESKTOP_THREAD_AGENT_ID, model),
      ).toBe(true)
    }
    // It's a recognized free-mode root (so its subagents pass the hierarchy gate
    // and the "You are Savant" marker gate applies to it).
    expect(isSavantFreeRootAgent(SAVANT_FREE_DESKTOP_THREAD_AGENT_ID)).toBe(
      true,
    )
    // A non-free premium model (e.g. raw Claude) stays disallowed even for it.
    expect(
      isFreeModeAllowedAgentModel(
        SAVANT_FREE_DESKTOP_THREAD_AGENT_ID,
        'anthropic/claude-sonnet-4.5',
      ),
    ).toBe(false)
    // Publisher-spoof safe.
    expect(
      isFreeModeAllowedAgentModel(
        `other/${SAVANT_FREE_DESKTOP_THREAD_AGENT_ID}@0.0.1`,
        MINIMAX_M3_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('allows generic subagents with any free model', () => {
    const freeModels = [
      MINIMAX_M3_MODEL_ID,
      SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      SAVANT_FREE_KIMI_MODEL_ID,
      SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
      SAVANT_FREE_MIMO_V25_MODEL_ID,
      SAVANT_FREE_GLM_V52_MODEL_ID,
      SAVANT_FREE_HY3_MODEL_ID,
      SAVANT_FREE_HY3_ATLAS_MODEL_ID,
    ]

    for (const agentId of [
      'scout',
      'file-picker-max',
      'file-lister',
      'researcher-web',
      'researcher-docs',
      'browser-use',
      'basher',
      'tmux-cli',
      'context-pruner',
    ]) {
      for (const model of freeModels) {
        expect(isFreeModeAllowedAgentModel(agentId, model)).toBe(true)
      }
      // Non-free models stay disallowed.
      expect(
        isFreeModeAllowedAgentModel(agentId, 'anthropic/claude-sonnet-4.5'),
      ).toBe(false)
    }
  })

  test('publisher-spoof safety for generic subagents', () => {
    expect(
      isFreeModeAllowedAgentModel(
        'savant-code/basher@0.0.1',
        MINIMAX_M3_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('other/basher@0.0.1', MINIMAX_M3_MODEL_ID),
    ).toBe(false)
  })

  test('allows Gemini Pro for the thinker subagent but not the savant-free root', () => {
    expect(
      isFreeModeAllowedAgentModel(
        'savant-free',
        SAVANT_FREE_GEMINI_PRO_MODEL_ID,
      ),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        SAVANT_FREE_GEMINI_THINKER_AGENT_ID,
        SAVANT_FREE_GEMINI_PRO_MODEL_ID,
      ),
    ).toBe(true)
  })

  test('recognizes the Gemini thinker agent in free mode', () => {
    expect(
      isSavantFreeGeminiThinkerAgent(SAVANT_FREE_GEMINI_THINKER_AGENT_ID),
    ).toBe(true)
    expect(
      isSavantFreeGeminiThinkerAgent(
        `savant-code/${SAVANT_FREE_GEMINI_THINKER_AGENT_ID}@0.0.1`,
      ),
    ).toBe(true)
    expect(
      isSavantFreeGeminiThinkerAgent(
        `other/${SAVANT_FREE_GEMINI_THINKER_AGENT_ID}@0.0.1`,
      ),
    ).toBe(false)
  })

  test('uses local token count only for the DeepSeek Flash savant-free root', () => {
    expect(
      shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
        agentId: 'savant-free-deepseek-flash',
        model: SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(true)
    expect(
      shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
        agentId: 'savant-code/savant-free-deepseek-flash@0.0.1',
        model: SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(true)
    expect(
      shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
        agentId: 'savant-free-deepseek',
        model: SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(false)
    expect(
      shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
        agentId: 'savant-free-deepseek-flash',
        model: SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
      }),
    ).toBe(false)
    expect(
      shouldUseLocalTokenCountForSavantFreeDeepseekFlash({
        agentId: 'other/savant-free-deepseek-flash@0.0.1',
        model: SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(false)
  })
})
