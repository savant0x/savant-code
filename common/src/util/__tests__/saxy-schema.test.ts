// Saxy XML Parser — schema validation with text conversion.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { processXML } from './saxy-harness'

describe('Saxy XML Parser - Schema Validation with Text Conversion', () => {
  it('should convert invalid top-level tags to text nodes', () => {
    const schema = { root: ['child'] }
    const xml = '<invalid>content</invalid>'
    const events = processXML(xml, schema)

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: '<invalid>' },
      },
      {
        type: 'text',
        data: { contents: 'content' },
      },
      {
        type: 'text',
        data: { contents: '</invalid>' },
      },
    ])
  })

  it('should convert invalid nested tags to text nodes', () => {
    const schema = { root: ['child'] }
    const xml = '<other><invalid>content</invalid></other>'
    const events = processXML(xml, schema)

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: '<other>' },
      },
      {
        type: 'text',
        data: { contents: '<invalid>' },
      },

      {
        type: 'text',
        data: { contents: 'content' },
      },
      {
        type: 'text',
        data: { contents: '</invalid>' },
      },
      {
        type: 'text',
        data: { contents: '</other>' },
      },
    ])
  })

  it('should handle valid nested tags according to schema', () => {
    const schema = { root: ['child'] }
    const xml = '<root><child>content</child></root>'
    const events = processXML(xml, schema)

    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'root',
          rawTag: '<root>',
        },
        type: 'tagopen',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'child',
          rawTag: '<child>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'content',
        },
        type: 'text',
      },
      {
        data: {
          name: 'child',
          rawTag: '</child>',
        },
        type: 'tagclose',
      },
      {
        data: {
          name: 'root',
          rawTag: '</root>',
        },
        type: 'tagclose',
      },
    ])
  })

  it('should convert closing tags to text when parent is invalid', () => {
    const schema = { root: ['child'] }
    const xml = '<root><invalid>content</invalid><child/></root>'
    const events = processXML(xml, schema)

    expect(events[1]).toEqual({
      type: 'text',
      data: { contents: '<invalid>' },
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

  it('should handle tags starting with whitespace as text', () => {
    const schema = { root: ['child'] }
    const xml = '<root>< invalid>content</invalid></root>'
    const events = processXML(xml, schema)

    expect(events[1]).toEqual({
      type: 'text',
      data: { contents: '< invalid>content' },
    })
    expect(events[2]).toEqual({
      type: 'text',
      data: { contents: '</invalid>' },
    })
  })
})
