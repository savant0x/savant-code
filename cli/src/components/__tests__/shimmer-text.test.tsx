import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'

initializeThemeStore()

describe('ShimmerText host modes', () => {
  test('keeps the legacy inline fragment host by default', () => {
    const markup = renderToStaticMarkup(
      <ShimmerText text="thinking" primaryColor="#18faf9" />,
    )

    expect(markup).not.toMatch(/^<text>/)
    expect(markup.match(/<span /g)).toHaveLength(8)
    expect(markup).toContain('>t</span>')
    expect(markup).toContain('>g</span>')
  })

  test('wraps shimmer spans in text when hosted inside a box', () => {
    const markup = renderToStaticMarkup(
      <ShimmerText text="thinking" primaryColor="#18faf9" host="box" />,
    )

    expect(markup).toMatch(/^<text><span /)
    expect(markup.match(/<span /g)).toHaveLength(8)
    expect(markup).toContain('>t</span>')
    expect(markup).toContain('>g</span>')
  })
})
