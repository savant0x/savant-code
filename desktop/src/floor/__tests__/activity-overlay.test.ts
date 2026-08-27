import { describe, expect, test } from 'bun:test'

import { applyFloorEvents, createFloorState } from '../adapter/floor-adapter'
import { activityRows, createActivityOverlay } from '../stage/activity-overlay'

import type { FloorState } from '../adapter/floor-adapter'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-0822-012 asset pass — the overlay's data layer is PURE
// (FloorState → rows, tested against real folded events); the DOM half is
// smoke-tested through a stub Document (same narrowing-cast pattern as the
// perf-hud suite).

function fold(...events: PrintModeEvent[]): FloorState {
  return applyFloorEvents(createFloorState(), events)
}

const START: PrintModeEvent = { type: 'start', messageHistoryLength: 0 }

interface StubElement {
  className: string
  textContent: string
  style: Record<string, string>
  appendChild: (child: unknown) => void
  remove: () => void
  removed: boolean
}

function stubDoc(): {
  doc: Document
  created: StubElement[]
  appended: unknown[]
  container: HTMLElement
} {
  const created: StubElement[] = []
  const doc = {
    getElementById: () => null,
    createElement: () => {
      const el: StubElement = {
        className: '',
        textContent: '',
        style: {},
        appendChild: () => {},
        remove: () => {
          el.removed = true
        },
        removed: false,
      }
      created.push(el)
      return el
    },
    head: { appendChild: () => {} },
  } as unknown as Document & {
    createElement: () => StubElement
  }
  const appended: unknown[] = []
  const container = {
    appendChild: (child: unknown) => {
      appended.push(child)
    },
  } as unknown as HTMLElement
  return { doc, created, appended, container }
}

describe('activity overlay rows (asset pass)', () => {
  test('an untouched floor yields no rows', () => {
    expect(activityRows(createFloorState())).toEqual([])
  })

  test('start seats the savant orchestrating row', () => {
    const rows = activityRows(fold(START))
    expect(rows).toEqual([{ role: 'SAVANT', detail: 'orchestrating' }])
  })

  test('an active walker reports idle at pad, then its in-flight tool', () => {
    const state = fold(
      START,
      {
        type: 'subagent_start',
        agentId: 'a1',
        agentType: 'detective',
        displayName: 'Detective',
        onlyChild: false,
      },
      {
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'code_search',
        input: {},
        agentId: 'a1',
      },
    )
    expect(activityRows(state)).toEqual([
      { role: 'SAVANT', detail: 'orchestrating' },
      { role: 'DETECTIVE', detail: 'code_search → CARTOGRAPHY TABLE' },
    ])
  })

  test('dissolved walkers drop out of the overlay', () => {
    const state = fold(
      START,
      {
        type: 'subagent_start',
        agentId: 'a1',
        agentType: 'detective',
        displayName: 'Detective',
        onlyChild: false,
      },
      {
        type: 'subagent_finish',
        agentId: 'a1',
        agentType: 'detective',
        displayName: 'Detective',
        onlyChild: false,
      },
    )
    expect(activityRows(state)).toEqual([
      { role: 'SAVANT', detail: 'orchestrating' },
    ])
  })

  test('unknown roles fall back to the display name — never invented', () => {
    const state = fold(START, {
      type: 'subagent_start',
      agentId: 'x1',
      agentType: 'mystery',
      displayName: 'Helper',
      onlyChild: false,
    })
    expect(activityRows(state)).toEqual([
      { role: 'SAVANT', detail: 'orchestrating' },
      { role: 'HELPER', detail: 'idle at pad' },
    ])
  })
})

describe('activity overlay panel (asset pass)', () => {
  test('mounts once, renders phase + cast + rows, and disposes idempotently', () => {
    const { doc, created, appended, container } = stubDoc()
    const overlay = createActivityOverlay(doc, container)
    // style + panel el + phase line + cast line + body line.
    expect(created).toHaveLength(5)
    expect(appended).toHaveLength(1)
    const state = fold(START)
    overlay.update(state, { mounted: 10, total: 10 })
    const panel = created[1]
    const phaseLine = created[2]
    const castLine = created[3]
    const bodyLine = created[4]
    expect(phaseLine.textContent).toBe('DECK ACTIVITY · IDLE')
    expect(castLine.textContent).toBe('CAST 10/10 mounted')
    expect(bodyLine.textContent).toBe('SAVANT · orchestrating')
    // Same-state update: cached, no DOM writes.
    phaseLine.textContent = 'UNCHANGED'
    overlay.update(state, { mounted: 10, total: 10 })
    expect(phaseLine.textContent).toBe('UNCHANGED')
    // Dispose removes the panel and is idempotent.
    overlay.dispose()
    overlay.dispose()
    expect(panel.removed).toBe(true)
  })

  test('the CAST line carries the compacted template outcome (FID-2026-0824-030)', () => {
    const { doc, created, container } = stubDoc()
    const overlay = createActivityOverlay(doc, container)
    // created order: style(0) panel(1) phase(2) cast(3) body(4).
    const castLine = created[3]
    const state = fold(START)
    overlay.update(state, {
      mounted: 9,
      total: 10,
      template: 'failed to load — mounting fallback silhouettes',
    })
    expect(castLine.textContent).toBe('CAST 9/10 mounted · failed to load')
    // A clean outcome renders verbatim; the changed key busts the content
    // cache so this DOM write actually happens.
    overlay.update(state, {
      mounted: 10,
      total: 10,
      template: 'loaded (8 clips)',
    })
    expect(castLine.textContent).toBe('CAST 10/10 mounted · loaded (8 clips)')
    overlay.dispose()
  })
})
