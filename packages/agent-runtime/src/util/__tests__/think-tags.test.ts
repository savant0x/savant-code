import { describe, expect, it } from 'bun:test'

import {
  createYagniCheckStreamStripper,
  isThinkOnlyResponse,
  stripThinkTags,
  stripYagniCheckBlocks,
  stripYagniCheckBlocksFromWritePayload,
} from '../think-tags'

describe('stripThinkTags', () => {
  it('strips paired think tags', () => {
    expect(stripThinkTags('<think>plan the change</think>')).toBe('')
    expect(stripThinkTags('<think>a</think>\n\n<think>b</think>')).toBe('')
  })

  it('strips unclosed open think tags', () => {
    expect(stripThinkTags('<think>partial thought')).toBe('')
  })

  it('strips orphan close think tags', () => {
    expect(stripThinkTags('</think>')).toBe('')
    expect(stripThinkTags('</think> ')).toBe('')
    expect(stripThinkTags('  </think>\n')).toBe('')
  })

  it('preserves non-think content around tags', () => {
    expect(stripThinkTags('<think>x</think>\nI will edit the file.')).toBe(
      'I will edit the file.',
    )
    expect(stripThinkTags('</think>\nNext I will spawn the editor.')).toBe(
      'Next I will spawn the editor.',
    )
  })
})

describe('isThinkOnlyResponse', () => {
  it('is false for empty / whitespace-only responses', () => {
    expect(isThinkOnlyResponse('')).toBe(false)
    expect(isThinkOnlyResponse('   \n')).toBe(false)
  })

  it('is true for paired, unclosed, and orphan think scaffolding', () => {
    expect(isThinkOnlyResponse('<think>reasoning</think>')).toBe(true)
    expect(isThinkOnlyResponse('<think>partial')).toBe(true)
    expect(isThinkOnlyResponse('</think>')).toBe(true)
    expect(isThinkOnlyResponse('</think> ')).toBe(true)
  })

  it('is false when there is real content besides think tags', () => {
    expect(isThinkOnlyResponse('Done.')).toBe(false)
    expect(isThinkOnlyResponse('<think>x</think>\nDone.')).toBe(false)
    expect(isThinkOnlyResponse('</think>\nDone.')).toBe(false)
  })
})

describe('stripYagniCheckBlocks (FID-2026-0822-004)', () => {
  const block = `<yagni_check>
{"isSpeculative":false}
</yagni_check>`

  it('strips a paired yagni_check block', () => {
    expect(stripYagniCheckBlocks(`${block}\nconst x = 1`)).toBe('const x = 1')
  })

  it('strips multiple paired blocks', () => {
    expect(stripYagniCheckBlocks(`${block}\n${block}\ncode`)).toBe('code')
  })

  it('strips an unclosed open yagni block (truncated)', () => {
    expect(stripYagniCheckBlocks('<yagni_check>{"isSpeculative"')).toBe('')
  })

  it('strips an orphan yagni close tag', () => {
    expect(stripYagniCheckBlocks('</yagni_check>\ncode')).toBe('code')
  })

  it('preserves surrounding content', () => {
    // The block is removed; the newline after `</yagni_check>` remains, so the
    // result has an empty line where the block sat (mirrors stripThinkTags,
    // which also only removes the tag content).
    expect(stripYagniCheckBlocks(`intro\n${block}\ncode`).trim()).toBe(
      'intro\n\ncode',
    )
  })
})

describe('createYagniCheckStreamStripper (FID-2026-0822-004)', () => {
  it('strips a block split across chunks', () => {
    const s = createYagniCheckStreamStripper()
    expect(s.push('<yagni_check>{"isSpec')).toBe('')
    expect(s.push('ulative":false}\n</yagni_check>\ncode')).toBe('\ncode')
    expect(s.flush()).toBe('')
  })

  it('holds an unclosed opener until the closer arrives', () => {
    const s = createYagniCheckStreamStripper()
    expect(s.push('intro\n<yagni_check>partial')).toBe('intro\n')
    expect(s.push('more json')).toBe('')
    expect(s.push('</yagni_check>\ncode')).toBe('\ncode')
  })

  it('drops a truncated unclosed block at flush', () => {
    const s = createYagniCheckStreamStripper()
    expect(s.push('intro\n<yagni_check>partial')).toBe('intro\n')
    expect(s.flush()).toBe('')
  })

  it('strips orphan closes and preserves plain text', () => {
    const s = createYagniCheckStreamStripper()
    expect(s.push('</yagni_check>\nplain text')).toBe('\nplain text')
    expect(s.push('more text')).toBe('more text')
  })
})

describe('stripYagniCheckBlocksFromWritePayload (FID-2026-0822-004)', () => {
  const block = `<yagni_check>
{"isSpeculative":false}
</yagni_check>`

  it('strips from write_file content', () => {
    const input = { path: '/p/x.ts', content: `${block}\nconst x = 1` }
    stripYagniCheckBlocksFromWritePayload(input)
    expect(input.content).toBe('const x = 1')
  })

  it('strips from str_replace newString and replacements', () => {
    const input = {
      path: '/p/x.ts',
      newString: `${block}\nnew body`,
      replacements: [{ oldString: 'a', newString: `${block}\nreplacement` }],
    }
    stripYagniCheckBlocksFromWritePayload(input)
    expect(input.newString).toBe('new body')
    expect(input.replacements[0].newString).toBe('replacement')
  })

  it('strips from apply_patch operation.diff', () => {
    const input = {
      operation: {
        type: 'update_file',
        path: '/p/x.ts',
        diff: `${block}\n@@\n- old\n+ new`,
      },
    }
    stripYagniCheckBlocksFromWritePayload(input)
    expect(input.operation.diff).toBe('@@\n- old\n+ new')
  })

  it('leaves non-yagni payloads untouched', () => {
    const input = { path: '/p/x.ts', content: 'const x = 1' }
    stripYagniCheckBlocksFromWritePayload(input)
    expect(input.content).toBe('const x = 1')
  })
})
