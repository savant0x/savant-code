import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../../hooks/use-theme'
import {
  createSidebarFocusController,
  isSidebarActivateKey,
  isSidebarFocusCycleKey,
  nextFocusIndex,
} from '../../../right-sidebar-focus'
import { SidebarSection } from '../../primitives/sidebar-section'
import { FidCard } from '../fid-card'
import { FidList } from '../fid-list'

initializeThemeStore()

describe('sidebar startup collapse defaults', () => {
  test('SidebarSection starts folded by default', () => {
    const markup = renderToStaticMarkup(
      <SidebarSection title="Session">
        <text>Session details</text>
      </SidebarSection>,
    )

    expect(markup).toContain('▶')
    expect(markup).toContain('Session')
    expect(markup).not.toContain('Session details')
  })

  test('SidebarSection preserves explicit expanded opt-in', () => {
    const markup = renderToStaticMarkup(
      <SidebarSection title="Session" defaultExpanded>
        <text>Session details</text>
      </SidebarSection>,
    )

    expect(markup).toContain('▼')
    expect(markup).toContain('Session details')
  })

  test('FidCard starts folded by default', () => {
    const markup = renderToStaticMarkup(
      <FidCard
        id="FID-2026-0801-001"
        status="analyzed"
        severity="medium"
        summary="The full FID summary should remain hidden on startup."
      />,
    )

    expect(markup).toContain('▶')
    expect(markup).toContain('FID-2026-0801-001')
    expect(markup).not.toContain('The full FID summary')
  })

  test('FidCard preserves explicit expanded opt-in', () => {
    const markup = renderToStaticMarkup(
      <FidCard
        id="FID-2026-0801-001"
        status="analyzed"
        severity="medium"
        summary="The full FID summary is visible when explicitly requested."
        expanded
      />,
    )

    expect(markup).toContain('▼')
    expect(markup).toContain('The full FID summary is visible')
  })

  test('FidList keeps all cards folded on initial render', () => {
    const markup = renderToStaticMarkup(
      <FidList
        fids={[
          {
            id: 'FID-2026-0801-001',
            status: 'analyzed',
            severity: 'medium',
            summary: 'First FID full summary',
          },
          {
            id: 'FID-2026-0801-002',
            status: 'created',
            severity: 'low',
            summary: 'Second FID full summary',
          },
        ]}
      />,
    )

    expect(markup.match(/▶/g)).toHaveLength(2)
    expect(markup).not.toContain('First FID full summary')
    expect(markup).not.toContain('Second FID full summary')
  })
})

describe('sidebar focus cycle (FID-2026-1005-002)', () => {
  test('nextFocusIndex wraps to the unfocused state after the last control', () => {
    expect(nextFocusIndex(-1, 0)).toBe(-1)
    expect(nextFocusIndex(-1, 3)).toBe(0)
    expect(nextFocusIndex(0, 3)).toBe(1)
    expect(nextFocusIndex(2, 3)).toBe(-1)
    expect(nextFocusIndex(-5, 3)).toBe(0)
  })

  test('activation keys are Enter/Space in both spellings', () => {
    expect(isSidebarActivateKey({ name: 'return' })).toBe(true)
    expect(isSidebarActivateKey({ name: 'enter' })).toBe(true)
    expect(isSidebarActivateKey({ name: 'space' })).toBe(true)
    expect(isSidebarActivateKey({ name: 'escape' })).toBe(false)
    expect(isSidebarActivateKey({ name: 'g' })).toBe(false)
  })

  test('the cycle shortcut is plain F6; legacy and modified keys pass through', () => {
    const plain = { ctrl: false, meta: false, option: false, name: 'f6' }
    expect(isSidebarFocusCycleKey(plain)).toBe(true)
    for (const modifier of ['ctrl', 'meta', 'option', 'shift'])
      expect(isSidebarFocusCycleKey({ ...plain, [modifier]: true })).toBe(false)
    expect(
      isSidebarFocusCycleKey({
        ctrl: true,
        meta: false,
        option: false,
        name: 'g',
      }),
    ).toBe(false)
    expect(
      isSidebarFocusCycleKey({
        ctrl: false,
        meta: false,
        option: false,
        name: 'g',
      }),
    ).toBe(false)
    expect(
      isSidebarFocusCycleKey({
        ctrl: true,
        meta: true,
        option: false,
        name: 'g',
      }),
    ).toBe(false)
    expect(
      isSidebarFocusCycleKey({
        ctrl: true,
        meta: false,
        option: true,
        name: 'g',
      }),
    ).toBe(false)
    expect(
      isSidebarFocusCycleKey({
        ctrl: true,
        meta: false,
        option: false,
        name: 'b',
      }),
    ).toBe(false)
  })

  test('the controller cycles registered handles in order and rests unfocused', () => {
    const controller = createSidebarFocusController()
    const focused: string[] = []
    const blurs: string[] = []
    const registerControl = (name: string) =>
      controller.register({
        focus: () => focused.push(name),
        blur: () => blurs.push(name),
      })
    registerControl('B')
    registerControl('A')

    // Registration order is the cycle order; nothing focused yet.
    controller.focusNext()
    controller.focusNext()
    expect(focused).toEqual(['B', 'A'])
    expect(blurs).toEqual(['B'])

    // Advancing past the last control rests unfocused.
    controller.focusNext()
    expect(focused).toEqual(['B', 'A'])
    expect(blurs).toEqual(['B', 'A'])

    // Restarting after the rest state begins at the first handle again.
    controller.focusNext()
    expect(focused).toEqual(['B', 'A', 'B'])
  })

  test('unregistering the focused control empties the cycle position', () => {
    const controller = createSidebarFocusController()
    const focused: string[] = []
    const unregister = controller.register({
      focus: () => focused.push('x'),
      blur: () => {},
    })
    controller.focusNext()
    expect(focused).toEqual(['x'])

    unregister()
    // A cycle with no handles is a no-op instead of throwing or refocusing
    // the unmounted control.
    controller.focusNext()
    expect(focused).toEqual(['x'])
  })
})
