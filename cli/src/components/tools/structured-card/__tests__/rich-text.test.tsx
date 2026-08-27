import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  initializeThemeStore,
  useThemeStore,
} from '../../../../hooks/use-theme'
import { mockOpentuiReactForStaticRender } from '../../__tests__/helpers/mock-opentui-react-static'
import { ErrorCard } from '../ErrorCard'
import { ListCard } from '../ListCard'
import { RecordCard } from '../RecordCard'
import { RichTextValue, isRichTextCandidate } from '../rich-text'
import { SuccessCard } from '../SuccessCard'

import type { ChatTheme } from '../../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme

function markupOf(node: React.ReactNode): string {
  return renderToStaticMarkup(<>{node}</>)
}

describe('isRichTextCandidate gate (FID-2026-0824-029)', () => {
  test('plain scalars and inline-only markers do NOT qualify', () => {
    expect(isRichTextCandidate('exit 0')).toBe(false)
    expect(isRichTextCandidate('a-b')).toBe(false)
    expect(isRichTextCandidate('snake_case')).toBe(false)
    expect(isRichTextCandidate('`inline` tick')).toBe(false)
    expect(isRichTextCandidate('*bold* inline only')).toBe(false)
    expect(isRichTextCandidate('')).toBe(false)
  })

  test('newlines, fences, and line-starting block syntax qualify', () => {
    expect(isRichTextCandidate('line one\nline two')).toBe(true)
    expect(isRichTextCandidate('```text\nCONFIRMED x\n```')).toBe(true)
    expect(isRichTextCandidate('# Heading')).toBe(true)
    expect(isRichTextCandidate('- bullet')).toBe(true)
    expect(isRichTextCandidate('* star bullet')).toBe(true)
    expect(isRichTextCandidate('+ plus bullet')).toBe(true)
    expect(isRichTextCandidate('> quoted')).toBe(true)
    expect(isRichTextCandidate('1. ordered')).toBe(true)
    expect(isRichTextCandidate('  - indented bullet')).toBe(true)
    expect(isRichTextCandidate('prose\n- trailing list')).toBe(true)
  })
})

describe('RichTextValue dual-branch rendering (FID-2026-0824-029)', () => {
  test('non-candidates render the exact legacy fallback', () => {
    const markup = markupOf(
      <RichTextValue
        value="plain scalar"
        theme={theme}
        fallback={<text>plain scalar</text>}
      />,
    )
    expect(markup).toContain('plain scalar')
  })

  test('rich candidates render through the markdown formatter', () => {
    const markup = markupOf(
      <RichTextValue
        value={'# Verdict\n- alpha finding\n- beta finding'}
        theme={theme}
        fallback={<text>legacy</text>}
      />,
    )
    expect(markup).toContain('Verdict')
    expect(markup).toContain('alpha finding')
    expect(markup).toContain('beta finding')
    expect(markup).not.toContain('legacy')
  })

  test('non-string values always take the fallback', () => {
    const markup = markupOf(
      <RichTextValue value={42} theme={theme} fallback={<text>num</text>} />,
    )
    expect(markup).toContain('num')
  })
})

describe('card-level rich routing (FID-2026-0824-029)', () => {
  test('RecordCard multi-line bulleted field renders structure', () => {
    const markup = markupOf(
      <RecordCard
        value={{
          findings: '- CONFIRMED a.ts:1\n- REFUTED b.ts:2',
          note: 'plain',
        }}
        theme={theme}
      />,
    )
    expect(markup).toContain('findings')
    expect(markup).toContain('CONFIRMED a.ts:1')
    expect(markup).toContain('REFUTED b.ts:2')
    expect(markup).toContain('note')
  })

  test('SuccessCard markdown message renders structured', () => {
    const markup = markupOf(
      <SuccessCard
        value={{ message: '# Done\nall checks green' }}
        theme={theme}
      />,
    )
    expect(markup).toContain('Done')
    expect(markup).toContain('all checks green')
  })

  test('ErrorCard multi-line errorMessage renders structured', () => {
    const markup = markupOf(
      <ErrorCard
        value={{ errorMessage: 'boom\n- detail one' }}
        theme={theme}
      />,
    )
    expect(markup).toContain('boom')
    expect(markup).toContain('detail one')
  })

  test('ListCard multi-line scalar item renders structured', () => {
    const markup = markupOf(<ListCard value={['alpha\nbeta']} theme={theme} />)
    expect(markup).toContain('1 items')
    expect(markup).toContain('alpha')
  })

  test('plain scalars keep legacy rendering end-to-end', () => {
    const markup = markupOf(
      <RecordCard value={{ status: 'ok-code' }} theme={theme} />,
    )
    expect(markup).toContain('status')
    expect(markup).toContain('ok-code')
  })
})
