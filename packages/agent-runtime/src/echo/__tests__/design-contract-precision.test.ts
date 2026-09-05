import { describe, expect, test } from 'bun:test'

import { runDesignContractScanner } from '../design-contract'
import { createEnforcementState } from '../enforcement-state'

import type { DesignContract } from '@savant-code/common/types/design-system'

// FID-2026-0819-005 Loop 191: the FID-2026-0824-002 scanner-precision suites
// (word boundaries, value plausibility, prettier-collapsed literals) split
// verbatim from design-contract.test.ts (contract fixture copied verbatim so
// the file is self-contained).

describe('design contract scanner precision', () => {
  const contract: DesignContract = {
    id: 'demo',
    displayName: 'Demo',
    targets: ['react'],
    colors: { primary: '#00ff00' },
    typography: { body: { fontFamily: 'Inter, sans-serif' } },
    spacing: { sm: '8px' },
    radius: { sm: '4px' },
    components: {},
    accessibility: { requiredTokens: ['aria-label'] },
  }

  test('does not flag identifiers that merely END in a token word', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      'const turnGap = this.state.turnCount - lastRefreshTurn; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(false)
    expect(result.reason ?? '').not.toContain('dynamic-values')
  })

  test('treats custom-property references as token indirection, not dynamic values', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      "const CANONICAL_TO_VAR = { background: '--bg', border: '--border' } as const; aria-label=\"Demo\";",
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(false)
    expect(result.reason ?? '').not.toContain('dynamic-values')
  })

  // --- FID-2026-0824-025 follow-up: declaration-keyword lookbehinds --------

  test('does not flag const/let/var locals that share visual property names', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      'const gap = a.sentAt - b.sentAt; let padding = compute(); var margin = 0; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(false)
    expect(result.reason ?? '').not.toContain('dynamic-values')
  })

  test('still flags genuine gap/color declarations in object styles', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      'const style = { gap: theme.space, color: theme.accent }; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('dynamic-values NEEDS-REVIEW')
  })

  test('still flags genuine dynamic visual expressions outside object styles', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      'background: theme.primary; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('dynamic-values NEEDS-REVIEW')
  })

  // --- Post-closure amendment: prettier-collapsed single-line JSX literals --

  test('accepts prettier-collapsed single-line quoted literals as explicit mappings', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      '<text fg="#00ff00">{x}</text><box bg="#00ff00" attributes={BOLD}>{y}</box>; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(false)
    expect(result.reason ?? '').not.toContain('dynamic-values')
  })

  test('still flags quoted dynamic expressions collapsed onto one line', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/App.tsx')
    state.writtenFileContent.set(
      'src/App.tsx',
      '<text fg="theme.primary">{x}</text>; aria-label="Demo";',
    )
    const result = runDesignContractScanner({
      state,
      mode: 'strict',
      contract,
      getWrittenFileContent: (filePath) =>
        state.writtenFileContent.get(filePath),
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('dynamic-values NEEDS-REVIEW')
  })
})
