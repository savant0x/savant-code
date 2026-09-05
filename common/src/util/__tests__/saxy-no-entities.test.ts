// Saxy XML Parser — shouldParseEntities = false behavior.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { Saxy } from '../saxy'
import { processXML } from './saxy-harness'

describe('Saxy XML Parser - shouldParseEntities = false', () => {
  it('should not parse HTML entities in text content when shouldParseEntities is false', () => {
    const xml = '<tag>Text with &amp; &lt; entities</tag>'
    const events = processXML(xml, undefined, false)

    expect(events).toEqual([
      {
        type: 'tagopen',
        data: {
          name: 'tag',
          attrs: '',
          isSelfClosing: false,
          rawTag: '<tag>',
        },
      },
      {
        type: 'text',
        data: { contents: 'Text with &amp; &lt; entities' },
      },
      {
        type: 'tagclose',
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
      },
    ])
  })

  it('should not parse HTML entities split across chunks when shouldParseEntities is false', () => {
    const parser = new Saxy(undefined, false)
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    parser.write('<tag>Text with &am')
    parser.write('p; and &l')
    parser.write('t; entities</tag>')
    parser.end()

    expect(events).toEqual([
      {
        type: 'tagopen',
        data: {
          name: 'tag',
          attrs: '',
          isSelfClosing: false,
          rawTag: '<tag>',
        },
      },
      {
        type: 'text',
        data: { contents: 'Text with &am' },
      },
      {
        type: 'text',
        data: { contents: 'p; and &l' },
      },
      {
        type: 'text',
        data: { contents: 't; entities' },
      },
      {
        type: 'tagclose',
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
      },
    ])
    expect(
      events
        .filter((e) => e.type === 'text')
        .map((e) => e.data.contents)
        .join(''),
    ).toEqual('Text with &amp; and &lt; entities')
  })

  it('should handle text nodes correctly in _final when shouldParseEntities is false', () => {
    const parser = new Saxy(undefined, false)
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    // Write text that would normally be parsed if shouldParseEntities was true
    parser.write('Final text with &amp; &lt; entities')
    parser.end() // _final will be called here

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Final text with &amp; &lt; entities' },
      },
    ])
  })
})
