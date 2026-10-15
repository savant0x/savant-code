import { describe, expect, test } from 'bun:test'

import {
  designSystemThemeOverrides,
  getDefaultDesignSystemResource,
} from '../index'

describe('design-system theme adapter', () => {
  test('maps the native dark contract and preserves semantic accents', () => {
    const overrides = designSystemThemeOverrides(
      getDefaultDesignSystemResource(),
      'dark',
    )

    expect(overrides).toMatchObject({
      background: '#050508',
      secondary: '#18faf9',
      syntaxKeyword: '#ffb000',
      markdown: {
        inlineCodeFg: '#22d3ee',
        listBulletFg: '#39ff14',
      },
    })
  })

  test('uses explicit non-violet fallbacks when semantic keys are missing', () => {
    const resource = getDefaultDesignSystemResource()
    const colors = { ...resource.tokens.colors }
    delete colors.syntaxKeyword
    delete colors.inlineCodeFg
    delete colors.listBulletFg
    resource.tokens = { ...resource.tokens, colors }

    const overrides = designSystemThemeOverrides(resource, 'dark')

    expect(overrides.syntaxKeyword).toBe('#ffb000')
    expect(overrides.markdown).toMatchObject({
      inlineCodeFg: '#22d3ee',
      listBulletFg: '#39ff14',
    })
    expect(
      JSON.stringify(overrides).match(/#(?:a78bfa|c084fc|7c3aed)/i),
    ).toBeNull()
  })

  test('does not clobber a light theme when a resource has no light variant', () => {
    const overrides = designSystemThemeOverrides(
      getDefaultDesignSystemResource(),
      'light',
    )

    expect(overrides).toEqual({})
  })

  test('uses only explicitly provided colors from a partial light variant', () => {
    const resource = getDefaultDesignSystemResource()
    resource.tokens.extensions = {
      ...resource.tokens.extensions,
      colorsByMode: {
        light: {
          primary: '#0891b2',
          background: '#ffffff',
        },
      },
    }

    const overrides = designSystemThemeOverrides(resource, 'light')

    expect(overrides.primary).toBe('#0891b2')
    expect(overrides.background).toBe('#ffffff')
    expect(overrides.surface).toBeUndefined()
    expect(overrides.markdown).toBeUndefined()
  })
})
