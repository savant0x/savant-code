import { describe, expect, it } from 'bun:test'

// FID-2026-0819-005 Loop 220: the loopAgentSteps-driven suites (caching
// prefix, parent-tools filtering) moved verbatim to
// prompt-caching-subagents-tools.test.ts; their harness was duplicated
// there and pruned here as dead code (only the schema test below remains).

describe('Prompt Caching for Subagents with inheritParentSystemPrompt', () => {
  it('should validate that agents with inheritParentSystemPrompt cannot have custom systemPrompt', () => {
    const {
      DynamicAgentTemplateSchema,
    } = require('@savant-code/common/types/dynamic-agent-template')

    // Valid: inheritParentSystemPrompt with empty systemPrompt
    const validAgent = {
      id: 'valid-agent',
      displayName: 'Valid',
      model: 'anthropic/claude-sonnet-4',
      inheritParentSystemPrompt: true,
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    const validResult = DynamicAgentTemplateSchema.safeParse(validAgent)
    expect(validResult.success).toBe(true)

    // Invalid: inheritParentSystemPrompt with custom systemPrompt
    const invalidAgent = {
      id: 'invalid-agent',
      displayName: 'Invalid',
      model: 'anthropic/claude-sonnet-4',
      inheritParentSystemPrompt: true,
      systemPrompt: 'Custom system prompt',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    const invalidResult = DynamicAgentTemplateSchema.safeParse(invalidAgent)
    expect(invalidResult.success).toBe(false)
    if (!invalidResult.success) {
      expect(invalidResult.error.message).toContain(
        'Cannot specify both systemPrompt and inheritParentSystemPrompt',
      )
    }
  })
})
