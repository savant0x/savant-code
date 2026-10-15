import { expect, test } from 'bun:test'

import { validateDesignAuthoringInput } from '../index'

test('design authoring requires an explicit activate field', () => {
  const result = validateDesignAuthoringInput({
    schemaVersion: '1',
    id: 'example-system',
    displayName: 'Example',
    description: 'Example design system.',
    scope: 'project',
    targets: ['terminal'],
    colors: { primary: '#123456' },
    typography: { body: { fontFamily: 'Inter, sans-serif' } },
    spacing: { sm: '8px' },
    radius: { sm: '4px' },
    components: {},
    accessibility: {},
  })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe('INTERACTIVE_INPUT_REQUIRED')
})

test('design authoring retains supplied provenance metadata', () => {
  const result = validateDesignAuthoringInput({
    schemaVersion: '1',
    id: 'cloned-system',
    displayName: 'Cloned',
    description: 'Cloned design system.',
    scope: 'user',
    targets: ['terminal', 'react'],
    colors: { primary: '#123456' },
    typography: { body: { fontFamily: 'Inter, sans-serif' } },
    spacing: { sm: '8px' },
    radius: { sm: '4px' },
    components: {},
    accessibility: {},
    activate: false,
    provenance: {
      sourceRepository: 'example/source',
      sourceRevision: 'abc123',
      sourcePath: 'preset/example.design.md',
      license: 'MIT',
    },
  })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.resource.provenance.sourceRepository).toBe('example/source')
    expect(result.resource.provenance.sourcePath).toBe(
      'preset/example.design.md',
    )
    expect(result.source).toContain('fontFamily')
  }
})
