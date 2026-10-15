// Saxy XML Parser — text node handling (whitespace, entities, chunking).
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { Saxy } from '../saxy'

describe('Saxy XML Parser - Text Node Handling', () => {
  it('should preserve whitespace in text nodes', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('  Text with leading and trailing spaces  ')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: '  Text with leading and trailing spaces  ' },
      },
    ])
  })

  it('should handle HTML entities in text content', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Text with &amp; and &lt; entities')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Text with & and < entities' },
      },
    ])
  })

  it('should handle split XML entities in text content', () => {
    // Re-initialize parser and events array inside the test
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Text with &am')
    parser.write('p; and')
    parser.write(' &l')
    parser.write('t; entities &g')
    parser.end()

    expect(events).toEqual([
      {
        data: {
          contents: 'Text with ',
        },
        type: 'text',
      },
      {
        data: {
          contents: '& and',
        },
        type: 'text',
      },
      {
        data: {
          contents: ' ',
        },
        type: 'text',
      },
      {
        data: {
          contents: '< entities ',
        },
        type: 'text',
      },
      {
        data: {
          contents: '&g',
        },
        type: 'text',
      },
    ])
    expect(events.map((chunk) => chunk.data.contents).join('')).toEqual(
      'Text with & and < entities &g',
    )
  })

  it('should preserve whitespace between tags', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    parser.write('<root> text <child>  text  </child> text </root>')
    parser.end()

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
          contents: ' text ',
        },
        type: 'text',
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
          contents: '  text  ',
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
          contents: ' text ',
        },
        type: 'text',
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

  it('should handle multiple HTML entities in the same text node', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Text with &amp; &lt; &gt; &quot; entities')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Text with & < > " entities' },
      },
    ])
  })

  it('should preserve newlines in text content', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Line 1\nLine 2\r\nLine 3')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Line 1\nLine 2\r\nLine 3' },
      },
    ])
  })
})
