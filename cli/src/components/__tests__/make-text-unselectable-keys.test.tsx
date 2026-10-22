import { describe, expect, test } from 'bun:test'
import React from 'react'

import { makeTextUnselectable } from '../clickable'

/**
 * FID-2026-1022-003: `Button` and `Clickable` render
 * `makeTextUnselectable(children)`. When the caller passes several children,
 * that helper returns a NEW array, so every element in it must carry a key or
 * React reports the list as unkeyed — the warning the CLI logged between
 * `CommandPalette` and `Button`.
 *
 * The invariant is asserted here rather than through a rendered warning because
 * React only emits the warning from the development reconciler, while the CLI
 * test gate runs with `NODE_ENV=production`. A key assertion holds in both.
 *
 * Measured before the fix: a Fragment holding one child came back with
 * `key: null` (the Fragment's key is lost in the unwrap), and it landed inside
 * the returned array whenever the Fragment had a sibling.
 */
function box(label: string, key?: string): React.ReactNode {
  return (
    <box key={key}>
      <text>{label}</text>
    </box>
  )
}

function unkeyedElements(node: React.ReactNode): React.ReactElement[] {
  const out = makeTextUnselectable(node)
  const list = Array.isArray(out) ? out : [out]
  return list.filter(
    (entry): entry is React.ReactElement =>
      React.isValidElement(entry) && entry.key === null,
  )
}

describe('makeTextUnselectable — key invariant', () => {
  test('keys every element of a multi-child list', () => {
    expect(unkeyedElements([box('a'), box('b'), box('c')])).toHaveLength(0)
  })

  test('ignores conditional holes without breaking its own keys', () => {
    expect(unkeyedElements([box('a'), box('b'), false, null])).toHaveLength(0)
  })

  test('keys a nested array', () => {
    expect(
      unkeyedElements([[box('a')], [box('b')]] as unknown as React.ReactNode),
    ).toHaveLength(0)
  })

  test('keys a Fragment holding one child, alone', () => {
    expect(
      unkeyedElements([
        <>
          <box>
            <text>inside a fragment</text>
          </box>
        </>,
      ]),
    ).toHaveLength(0)
  })

  test('keys a Fragment holding one child beside a sibling', () => {
    expect(
      unkeyedElements([
        box('a'),
        <>
          <box>
            <text>inside a fragment</text>
          </box>
        </>,
      ]),
    ).toHaveLength(0)
  })

  test('keys every child of a multi-child Fragment', () => {
    expect(
      unkeyedElements([
        <>
          {box('a')}
          {box('b')}
        </>,
      ]),
    ).toHaveLength(0)
  })
})
