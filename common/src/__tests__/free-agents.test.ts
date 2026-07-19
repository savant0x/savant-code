import { describe, expect, test } from 'bun:test'

import { GEMINI_3_1_FLASH_LITE_MODEL_ID } from '../constants/gemini'

import {
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_GEMINI_PRO_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_HY3_ATLAS_MODEL_ID,
  FREEBUFF_HY3_MODEL_ID,
  FREEBUFF_KIMI_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  FREEBUFF_MIMO_V25_PRO_MODEL_ID,
} from '../constants/savant-free-models'
import { minimaxModels } from '../constants/model-config'
import { FREEBUFF_GEMINI_THINKER_AGENT_ID } from '../constants/savant-free-gemini-thinker'
import {
  FREEBUFF_DESKTOP_THREAD_AGENT_ID,
  getFreebuffRootAgentIdForModel,
  isFreebuffGeminiThinkerAgent,
  isFreebuffRootAgent,
  isFreeModeAllowedAgentModel,
  shouldUseLocalTokenCountForFreebuffDeepseekFlash,
} from '../constants/free-agents'

const MINIMAX_M3_MODEL_ID = minimaxModels.minimaxM3
// Removed model: support was dropped entirely (client + server).
const LEGACY_MINIMAX_M2_7_MODEL_ID = 'minimax/minimax-m2.7'

describe('free mode agent model allowlist', () => {
  test('maps supported savant-free models to concrete root agents', () => {
    expect(getFreebuffRootAgentIdForModel(FREEBUFF_KIMI_MODEL_ID)).toBe(
      'base2-free-kimi',
    )
    expect(
      getFreebuffRootAgentIdForModel(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe('base2-free-deepseek')
    expect(
      getFreebuffRootAgentIdForModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe('base2-free-deepseek-flash')
    expect(getFreebuffRootAgentIdForModel(FREEBUFF_MIMO_V25_PRO_MODEL_ID)).toBe(
      'base2-free-mimo-pro',
    )
    expect(getFreebuffRootAgentIdForModel(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(
      'base2-free-mimo',
    )
    expect(getFreebuffRootAgentIdForModel(MINIMAX_M3_MODEL_ID)).toBe(
      'base2-free-minimax-m3',
    )
  })

  test('allows each savant-free root agent only with its configured model', () => {
    expect(isFreeModeAllowedAgentModel('base2-free', MINIMAX_M3_MODEL_ID)).toBe(
      true,
    )
    expect(
      isFreeModeAllowedAgentModel('base2-free', LEGACY_MINIMAX_M2_7_MODEL_ID),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free',
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('base2-free', FREEBUFF_KIMI_MODEL_ID),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('base2-free-kimi', FREEBUFF_KIMI_MODEL_ID),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-deepseek',
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-deepseek-flash',
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-mimo-pro',
        FREEBUFF_MIMO_V25_PRO_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-mimo',
        FREEBUFF_MIMO_V25_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-mimo',
        FREEBUFF_MIMO_V25_PRO_MODEL_ID,
      ),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-mimo',
        `${FREEBUFF_MIMO_V25_MODEL_ID}-20260527`,
      ),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel('base2-free-minimax-m3', MINIMAX_M3_MODEL_ID),
    ).toBe(true)
    expect(
      isFreeModeAllowedAgentModel(
        'base2-free-minimax-m3',
        LEGACY_MINIMAX_M2_7_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('allows the SavantFree Desktop root agent with every desktop model', () => {
    // The desktop runs ONE root id across all its picker models (model chosen
    // per tab), so each desktop-pickable model must be allowed for it.
    for (const model of [
      MINIMAX_M3_MODEL_ID,
      FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      FREEBUFF_KIMI_MODEL_ID,
      FREEBUFF_MIMO_V25_PRO_MODEL_ID,
      FREEBUFF_MIMO_V25_MODEL_ID,
      FREEBUFF_GLM_V52_MODEL_ID,
    ]) {
      expect(
        isFreeModeAllowedAgentModel(FREEBUFF_DESKTOP_THREAD_AGENT_ID, model),
      ).toBe(true)
    }
    // It's a recognized free-mode root (so its subagents pass the hierarchy gate
    // and the "You are Savant" marker gate applies to it).
    expect(isFreebuffRootAgent(FREEBUFF_DESKTOP_THREAD_AGENT_ID)).toBe(true)
    // A non-free premium model (e.g. raw Claude) stays disallowed even for it.
    expect(
      isFreeModeAllowedAgentModel(
        FREEBUFF_DESKTOP_THREAD_AGENT_ID,
        'anthropic/claude-sonnet-4.5',
      ),
    ).toBe(false)
    // Publisher-spoof safe.
    expect(
      isFreeModeAllowedAgentModel(
        `other/${FREEBUFF_DESKTOP_THREAD_AGENT_ID}@0.0.1`,
        MINIMAX_M3_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('allows generic subagents with any free model', () => {
    const freeModels = [
      MINIMAX_M3_MODEL_ID,
      FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      FREEBUFF_KIMI_MODEL_ID,
      FREEBUFF_MIMO_V25_PRO_MODEL_ID,
      FREEBUFF_MIMO_V25_MODEL_ID,
      FREEBUFF_GLM_V52_MODEL_ID,
      FREEBUFF_HY3_MODEL_ID,
      FREEBUFF_HY3_ATLAS_MODEL_ID,
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
        isFreeModeAllowedAgentModel(
          agentId,
          'anthropic/claude-sonnet-4.5',
        ),
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
      isFreeModeAllowedAgentModel(
        'other/basher@0.0.1',
        MINIMAX_M3_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('allows Gemini Pro for the thinker subagent but not the savant-free root', () => {
    expect(
      isFreeModeAllowedAgentModel('base2-free', FREEBUFF_GEMINI_PRO_MODEL_ID),
    ).toBe(false)
    expect(
      isFreeModeAllowedAgentModel(
        FREEBUFF_GEMINI_THINKER_AGENT_ID,
        FREEBUFF_GEMINI_PRO_MODEL_ID,
      ),
    ).toBe(true)
  })

  test('recognizes the Gemini thinker agent in free mode', () => {
    expect(isFreebuffGeminiThinkerAgent(FREEBUFF_GEMINI_THINKER_AGENT_ID)).toBe(
      true,
    )
    expect(
      isFreebuffGeminiThinkerAgent(
        `savant-code/${FREEBUFF_GEMINI_THINKER_AGENT_ID}@0.0.1`,
      ),
    ).toBe(true)
    expect(
      isFreebuffGeminiThinkerAgent(
        `other/${FREEBUFF_GEMINI_THINKER_AGENT_ID}@0.0.1`,
      ),
    ).toBe(false)
  })

  test('uses local token count only for the DeepSeek Flash savant-free root', () => {
    expect(
      shouldUseLocalTokenCountForFreebuffDeepseekFlash({
        agentId: 'base2-free-deepseek-flash',
        model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(true)
    expect(
      shouldUseLocalTokenCountForFreebuffDeepseekFlash({
        agentId: 'savant-code/base2-free-deepseek-flash@0.0.1',
        model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(true)
    expect(
      shouldUseLocalTokenCountForFreebuffDeepseekFlash({
        agentId: 'base2-free-deepseek',
        model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(false)
    expect(
      shouldUseLocalTokenCountForFreebuffDeepseekFlash({
        agentId: 'base2-free-deepseek-flash',
        model: FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      }),
    ).toBe(false)
    expect(
      shouldUseLocalTokenCountForFreebuffDeepseekFlash({
        agentId: 'other/base2-free-deepseek-flash@0.0.1',
        model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      }),
    ).toBe(false)
  })
})
