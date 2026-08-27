import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  initializeThemeStore,
  useThemeStore,
} from '../../../../hooks/use-theme'
import { mockOpentuiReactForStaticRender } from '../../__tests__/helpers/mock-opentui-react-static'
import { ReceiptCollapse } from '../collapse'
import { ErrorCard } from '../ErrorCard'
import { ListCard } from '../ListCard'
import { RecordCard } from '../RecordCard'
import { StructuredCard } from '../StructuredCard'
import { SuccessCard } from '../SuccessCard'

import type { ChatTheme } from '../../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme

function markupOf(node: React.ReactNode): string {
  return renderToStaticMarkup(<>{node}</>)
}

describe('SuccessCard (FID-2026-0822-014)', () => {
  test('renders ✓ glyph, bold message, and scalar extras as rows', () => {
    const markup = markupOf(
      <SuccessCard
        value={{ message: 'scanned', harvested: 3 }}
        theme={theme}
      />,
    )
    expect(markup).toContain('✓')
    expect(markup).toContain('scanned')
    expect(markup).toContain('harvested')
    expect(markup).toContain('3')
  })

  test('non-object payload renders nothing', () => {
    expect(markupOf(<SuccessCard value="x" theme={theme} />)).toBe('')
  })
})

describe('ErrorCard (FID-2026-0822-014)', () => {
  test('renders ✗ glyph with prominent errorMessage plus extras', () => {
    const markup = markupOf(
      <ErrorCard value={{ errorMessage: 'boom', code: 7 }} theme={theme} />,
    )
    expect(markup).toContain('✗')
    expect(markup).toContain('boom')
    expect(markup).toContain('code')
    expect(markup).toContain('7')
  })

  test('scalar error payload still gets the accent treatment', () => {
    const markup = markupOf(<ErrorCard value="plain failure" theme={theme} />)
    expect(markup).toContain('plain failure')
  })
})

describe('ListCard (FID-2026-0822-014)', () => {
  test('renders a count chip and one row per item', () => {
    const markup = markupOf(
      <ListCard value={['alpha.ts', 'beta.ts']} theme={theme} />,
    )
    expect(markup).toContain('2 items')
    expect(markup).toContain('alpha.ts')
    expect(markup).toContain('beta.ts')
  })

  test('object items render as mini key-value records', () => {
    const markup = markupOf(
      <ListCard value={[{ file: 'a.ts' }]} theme={theme} />,
    )
    expect(markup).toContain('file')
    expect(markup).toContain('a.ts')
  })

  test('more than 8 items receipt-collapse behind an expand toggle', () => {
    const items = Array.from({ length: 12 }, (_, i) => `item-${i}`)
    const markup = markupOf(<ListCard value={items} theme={theme} />)
    expect(markup).toContain('12 items')
    expect(markup).toContain('[4 more — expand]')
    expect(markup).not.toContain('item-11')
  })

  test('small lists do not collapse', () => {
    const markup = markupOf(<ListCard value={['a', 'b']} theme={theme} />)
    expect(markup).not.toContain('expand]')
  })
})

describe('RecordCard (FID-2026-0822-014)', () => {
  test('renders two-column key-value pairs', () => {
    const markup = markupOf(
      <RecordCard value={{ ledger: 'dev/YAGNI.md' }} theme={theme} />,
    )
    expect(markup).toContain('ledger')
    expect(markup).toContain('dev/YAGNI.md')
  })

  test('nested objects indent under border lines instead of dash markers', () => {
    const markup = markupOf(
      <RecordCard value={{ outer: { inner: 1 } }} theme={theme} />,
    )
    expect(markup).toContain('outer')
    expect(markup).toContain('inner')
    expect(markup).toContain('1')
    expect(markup).not.toContain('- ')
  })

  test('nesting beyond depth 3 collapses to a muted count row', () => {
    const deep = { l1: { l2: { l3: { l4: { secret: 'deeptext' } } } } }
    const markup = markupOf(<RecordCard value={deep} theme={theme} />)
    expect(markup).toContain('l4')
    expect(markup).toContain('nested')
    expect(markup).not.toContain('deeptext')
  })

  test('scalar payloads degrade to bold primary content', () => {
    const markup = markupOf(<RecordCard value="just text" theme={theme} />)
    expect(markup).toContain('just text')
  })
})

describe('ReceiptCollapse (FID-2026-0822-014)', () => {
  test('at or below threshold renders every row with no toggle', () => {
    const rows = Array.from({ length: 8 }, (_, i) => (
      <text key={i}>{`row-${i}`}</text>
    ))
    const markup = markupOf(<ReceiptCollapse items={rows} theme={theme} />)
    expect(markup).toContain('row-7')
    expect(markup).not.toContain('expand]')
    expect(markup).not.toContain('row-8')
  })
})

describe('StructuredCard dispatcher (FID-2026-0822-014)', () => {
  test('routes serialized parts to the matching card', () => {
    const markup = markupOf(
      <StructuredCard
        parts={[{ type: 'json', value: { message: 'routed' } }]}
        theme={theme}
      />,
    )
    expect(markup).toContain('routed')
  })

  test('empty payloads render nothing at all', () => {
    expect(
      markupOf(
        <StructuredCard
          parts={[{ type: 'json', value: null }]}
          theme={theme}
        />,
      ),
    ).toBe('')
    expect(markupOf(<StructuredCard parts={[]} theme={theme} />)).toBe('')
  })

  test('multi-part results render as list rows', () => {
    const markup = markupOf(
      <StructuredCard
        parts={[
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ]}
        theme={theme}
      />,
    )
    expect(markup).toContain('2 items')
    expect(markup).toContain('first')
    expect(markup).toContain('second')
  })
})
