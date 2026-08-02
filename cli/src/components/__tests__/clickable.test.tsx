import { describe, expect, test } from 'bun:test'
import React from 'react'

import { makeTextUnselectable } from '../clickable'

describe('makeTextUnselectable', () => {
  test('preserves array children without injecting fragments', () => {
    const children = [
      <text key="text">status</text>,
      <span key="span">detail</span>,
      'plain text',
    ]

    const normalized = makeTextUnselectable(children)

    expect(Array.isArray(normalized)).toBe(true)
    expect(normalized).toHaveLength(3)
    expect(
      (normalized as React.ReactElement[]).some(
        (child) =>
          child !== null &&
          typeof child === 'object' &&
          child.type === React.Fragment,
      ),
    ).toBe(false)
  })

  test('marks text and span hosts as non-selectable', () => {
    const normalized = makeTextUnselectable([
      <text key="text">status</text>,
      <span key="span">detail</span>,
    ]) as React.ReactElement[]

    const firstProps = normalized[0].props as { selectable?: boolean }
    const secondProps = normalized[1].props as { selectable?: boolean }
    expect(firstProps.selectable).toBe(false)
    expect(secondProps.selectable).toBe(false)
  })
})
