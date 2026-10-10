import { describe, expect, test } from 'bun:test'

import { createReviewer } from '../verifier/verifier'

describe('FID-2026-1010-002: Verifier output contract', () => {
  const verifier = createReviewer('openrouter/free')
  const prompt = verifier.instructionsPrompt ?? ''

  test('requests concise verdicts without emitted reasoning or an uncited success shortcut', () => {
    expect(prompt).not.toContain('<think>')
    expect(prompt).not.toContain('simply say it looks good')
    expect(prompt).toContain(
      'Return only concise PASS, FAIL or NEEDS-REVIEW entries',
    )
    expect(prompt).toContain('Every PASS cites the code that makes it pass')
    expect(prompt).toContain('Every FAIL cites file:line')
    expect(prompt).toContain(
      'Never fabricate line numbers, quotes, or search results',
    )
    expect(prompt).toContain(
      'Anything you cannot verify against the visible history is NEEDS-REVIEW',
    )
  })

  test('retains the zero-tool raw-evidence auditor boundary', () => {
    expect(verifier.toolNames).toEqual([])
    expect(verifier.spawnableAgents).toEqual([])
    expect(verifier.requiresRawEvidence).toBe(true)
    expect(verifier.includeMessageHistory).toBe(true)
    expect(verifier.outputMode).toBe('last_message')
  })
})
