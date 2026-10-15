import { describe, expect, test } from 'bun:test'

import { normalizeDesignSystemSource, parseDesignSystemSource } from '../index'

describe('design-system parser', () => {
  test('normalizes frontmatter resources with stable hashes and font metadata', () => {
    const source = `---\nname: Demo System\ndescription: A demo\ncolors:\n  primary: '#18faf9'\ntypography:\n  body:\n    fontFamily: Inter, system-ui, sans-serif\nspacing:\n  sm: 8px\nrounded:\n  md: 8px\ncomponents:\n  button:\n    backgroundColor: '{colors.primary}'\n---\n\n# Demo\n`
    const resource = normalizeDesignSystemSource({
      sourceContent: source,
      sourcePath: 'library/demo.design.md',
    })

    expect(resource.id).toBe('demo-system')
    expect(resource.sourceContentHash).toHaveLength(64)
    expect(resource.normalizedContentHash).toHaveLength(64)
    expect(resource.fonts[0]?.family).toBe('Inter')
    expect(resource.tokens.colors.primary).toBe('#18faf9')
  })

  test('validates plain Markdown signals and derives an id from the file path', () => {
    const result = parseDesignSystemSource({
      sourceContent: '# Tesla\n\nUse #3E6AE1 and 8px spacing.',
      sourcePath: 'library/tesla.design.md',
    })

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'MISSING_TYPOGRAPHY',
    )
  })

  test('rejects executable payload markers', () => {
    const result = parseDesignSystemSource({
      sourceContent: `---\ncolors:\n  primary: '#fff'\ntypography:\n  body:\n    fontFamily: Inter\nspacing:\n  sm: 8px\n---\n<script>alert(1)</script>`,
      sourcePath: 'library/unsafe.design.md',
    })

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'UNSAFE_CONTENT',
    )
  })
})
