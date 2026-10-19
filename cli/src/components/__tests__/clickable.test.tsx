import { describe, expect, test } from 'bun:test'
import React from 'react'

import { makeTextUnselectable } from '../clickable'

describe('makeTextUnselectable', () => {
  test('assigns stable identity to static JSX siblings cloned as an array', () => {
    const children = [<text>status</text>, <span>detail</span>]
    const normalized = makeTextUnselectable(children) as React.ReactElement[]

    expect(normalized.every((child) => child.key !== null)).toBe(true)
    expect(new Set(normalized.map((child) => child.key)).size).toBe(2)
    expect(
      (makeTextUnselectable(children) as React.ReactElement[]).map(
        (child) => child.key,
      ),
    ).toEqual(normalized.map((child) => child.key))
  })

  test('scopes repeated explicit keys in nested arrays', () => {
    const normalized = makeTextUnselectable([
      [<text key="label">first</text>],
      [<text key="label">second</text>],
    ]) as React.ReactElement[]

    expect(normalized).toHaveLength(2)
    expect(normalized[0].key).not.toBe(normalized[1].key)
  })

  test('keeps flattened fragment children distinct across sibling fragments', () => {
    const normalized = makeTextUnselectable([
      <React.Fragment key="first">
        <text>first</text>
        <span>detail</span>
      </React.Fragment>,
      <React.Fragment key="second">
        <text>second</text>
        <span>detail</span>
      </React.Fragment>,
    ]) as React.ReactElement[]

    expect(normalized).toHaveLength(4)
    expect(new Set(normalized.map((child) => child.key)).size).toBe(4)
    expect(normalized.every((child) => child.type !== React.Fragment)).toBe(
      true,
    )
  })

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
