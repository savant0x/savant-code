// Saxy XML Parser — edge cases for invalid-tag conversion.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { processXML } from './saxy-harness'

describe('Saxy XML Parser - Edge Cases', () => {
  it('should handle self-closing invalid tags', () => {
    const schema = { root: ['child'] }
    const xml = '<root><invalid/></root>'
    const events = processXML(xml, schema)

    expect(events[1]).toEqual({
      type: 'text',
      data: { contents: '<invalid/>' },
    })
  })

  it('should handle nested invalid tags', () => {
    const schema = { root: ['child'] }
    const xml = '<root><invalid><alsoinvalid/></invalid></root>'
    const events = processXML(xml, schema)

    expect(events[1]).toEqual({
      type: 'text',
      data: { contents: '<invalid>' },
    })
    expect(events[2]).toEqual({
      type: 'text',
      data: { contents: '<alsoinvalid/>' },
    })
    expect(events[3]).toEqual({
      type: 'text',
      data: { contents: '</invalid>' },
    })
  })

  it('should preserve attributes in converted text nodes', () => {
    const schema = { root: ['child'] }
    const xml = '<root><invalid attr="value">content</invalid></root>'
    const events = processXML(xml, schema)

    expect(events[1]).toEqual({
      type: 'text',
      data: { contents: '<invalid attr="value">' },
    })
    expect(events[2]).toEqual({
      type: 'text',
      data: { contents: 'content' },
    })
    expect(events[3]).toEqual({
      type: 'text',
      data: { contents: '</invalid>' },
    })
  })
})
