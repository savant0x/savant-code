/**
 * Marker-based prompt isolation (FID-2026-1006-002 WP12).
 *
 * The marker format is asserted literally once, so that the contract a
 * comparison depends on cannot drift silently; every other case is driven
 * through `blockMarkers`.
 */

import { describe, expect, it } from 'bun:test'

import {
  BLOCK_MARKER_PREFIX,
  blockMarkers,
  hasPromptBlock,
  stripPromptBlock,
  stripPromptBlocks,
} from '../src/prompt-isolation'

const { open, close } = blockMarkers('demo')

/** Join lines exactly as a prompt is written, so fixtures read literally. */
function prompt(...lines: string[]): string {
  return lines.join('\n')
}

const withBlock = prompt('intro', '', open, 'BLOCK BODY', close, '', 'outro')

describe('marker contract', () => {
  it('uses the documented literal marker format', () => {
    expect(BLOCK_MARKER_PREFIX).toBe('<!-- savant:block:')
    expect(blockMarkers('demo')).toEqual({
      open: '<!-- savant:block:demo -->',
      close: '<!-- /savant:block:demo -->',
    })
  })

  it('rejects a name that could forge or truncate a marker', () => {
    expect(() => blockMarkers('')).toThrow(/must be a non-empty token/)
    expect(() => blockMarkers('two words')).toThrow(/must be a non-empty token/)
    expect(() => blockMarkers('a-->b')).toThrow(/must be a non-empty token/)
    expect(() => blockMarkers('a\nb')).toThrow(/must be a non-empty token/)
  })
})

describe('hasPromptBlock', () => {
  it('reports a complete, well-ordered block', () => {
    expect(hasPromptBlock(withBlock, 'demo')).toBe(true)
  })

  it('reports an absent, half-present or inverted block as absent', () => {
    expect(hasPromptBlock('plain prompt', 'demo')).toBe(false)
    expect(hasPromptBlock(prompt('intro', open, 'body'), 'demo')).toBe(false)
    expect(hasPromptBlock(prompt('intro', '', close), 'demo')).toBe(false)
    expect(hasPromptBlock(prompt(close, '', open), 'demo')).toBe(false)
  })
})

describe('stripPromptBlock', () => {
  it('removes the block, both markers and the blank seam', () => {
    const stripped = stripPromptBlock(withBlock, 'demo')

    expect(stripped).toBe(prompt('intro', '', 'outro'))
    expect(stripped).not.toContain('BLOCK BODY')
    expect(stripped).not.toContain(BLOCK_MARKER_PREFIX)
  })

  it('leaves exactly one blank line where the block sat between paragraphs', () => {
    const between = prompt('A', '', open, 'X', close, '', 'B')

    expect(stripPromptBlock(between, 'demo')).toBe(prompt('A', '', 'B'))
    expect(stripPromptBlock(between, 'demo')).not.toContain('\n\n\n')
  })

  it('takes a head block’s separator with it', () => {
    expect(stripPromptBlock(prompt(open, 'X', close, '', 'B'), 'demo')).toBe(
      'B',
    )
  })

  it('takes a tail block’s separator with it', () => {
    expect(stripPromptBlock(prompt('A', '', open, 'X', close), 'demo')).toBe(
      'A',
    )
  })

  it('handles a prompt that is nothing but the block', () => {
    expect(stripPromptBlock(prompt(open, 'X', close), 'demo')).toBe('')
  })

  it('accepts an indented marker line', () => {
    const indented = prompt('A', `  ${open}  `, 'X', close, 'B')

    expect(stripPromptBlock(indented, 'demo')).toBe(prompt('A', 'B'))
  })

  it('throws when the block is absent', () => {
    expect(() => stripPromptBlock('plain prompt', 'demo')).toThrow(/is absent/)
    expect(() => stripPromptBlock(prompt('A', close), 'demo')).toThrow(
      /is absent/,
    )
    // A marker embedded in prose is not a boundary — it is an error.
    expect(() => stripPromptBlock(`before ${open} after`, 'demo')).toThrow(
      /is absent/,
    )
  })

  it('throws when the open marker has no close marker', () => {
    expect(() => stripPromptBlock(prompt('A', open, 'X'), 'demo')).toThrow(
      /unterminated/,
    )
  })

  it('throws when the close marker precedes the open marker', () => {
    expect(() => stripPromptBlock(prompt(close, 'X', open), 'demo')).toThrow(
      /malformed/,
    )
  })

  it('does not touch a sibling name that shares the prefix', () => {
    // `alpha` is a textual prefix of `alpha-beta`, so a matcher that is not
    // whole-line equality would strip the wrong block (or both).
    const alpha = blockMarkers('alpha')
    const alphaBeta = blockMarkers('alpha-beta')
    const two = prompt(
      'head',
      alpha.open,
      'A body',
      alpha.close,
      alphaBeta.open,
      'AB body',
      alphaBeta.close,
      'tail',
    )

    const onlyAlpha = stripPromptBlock(two, 'alpha')
    expect(onlyAlpha).not.toContain('A body')
    expect(onlyAlpha).toContain('AB body')
    expect(stripPromptBlocks(two, ['alpha', 'alpha-beta'])).toBe(
      prompt('head', 'tail'),
    )
  })

  it('strips a duplicated block one at a time', () => {
    const duplicated = prompt('A', open, 'X', close, open, 'Y', close, 'B')

    const once = stripPromptBlock(duplicated, 'demo')
    expect(hasPromptBlock(once, 'demo')).toBe(true)
    expect(stripPromptBlock(once, 'demo')).toBe(prompt('A', 'B'))
  })

  it('throws on a second strip of the same name (idempotence is explicit)', () => {
    const once = stripPromptBlock(withBlock, 'demo')

    expect(() => stripPromptBlock(once, 'demo')).toThrow(/is absent/)
  })
})

describe('stripPromptBlocks', () => {
  it('strips every named block', () => {
    const alpha = blockMarkers('alpha')
    const beta = blockMarkers('beta')
    const multi = prompt(
      'head',
      '',
      alpha.open,
      'A body',
      alpha.close,
      beta.open,
      'B body',
      beta.close,
      '',
      'tail',
    )

    const stripped = stripPromptBlocks(multi, ['alpha', 'beta'])
    expect(stripped).toBe(prompt('head', '', 'tail'))
    expect(stripped).not.toContain('A body')
    expect(stripped).not.toContain('B body')
  })

  it('is a no-op for an empty name list', () => {
    expect(stripPromptBlocks(withBlock, [])).toBe(withBlock)
  })

  it('throws for a name that is not present, like the single-block form', () => {
    expect(() => stripPromptBlocks(withBlock, ['demo', 'missing'])).toThrow(
      /is absent/,
    )
  })
})
