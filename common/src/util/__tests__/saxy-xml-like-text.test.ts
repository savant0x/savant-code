// Saxy XML Parser — text that looks like XML tags but is not.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { Saxy } from '../saxy'

describe('Saxy XML Parser - XML-like text', () => {
  it('should handle text that looks like invalid XML tags', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    parser.write(
      'This is < not a tag> and < another not a tag> but <valid>this is</valid>',
    )
    parser.end()

    expect(events).toEqual([
      {
        data: {
          contents: 'This is < not a tag> and < another not a tag> but ',
        },
        type: 'text',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'valid',
          rawTag: '<valid>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'this is',
        },
        type: 'text',
      },
      { data: { name: 'valid', rawTag: '</valid>' }, type: 'tagclose' },
    ])
  })

  it('should handle text with angle brackets but no valid tag names', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Math expressions: 2 < 3 and 5 > 4')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Math expressions: 2 < 3 and 5 > 4' },
      },
    ])
  })

  it('should correctly parse mixed valid and invalid XML-like content', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    parser.write(
      'Text with < brackets> and <valid-tag>real XML</valid-tag> mixed together',
    )
    parser.end()

    expect(events).toEqual([
      {
        data: {
          contents: 'Text with < brackets> and ',
        },
        type: 'text',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'valid-tag',
          rawTag: '<valid-tag>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'real XML',
        },
        type: 'text',
      },
      {
        data: {
          name: 'valid-tag',
          rawTag: '</valid-tag>',
        },
        type: 'tagclose',
      },
      {
        data: {
          contents: ' mixed together',
        },
        type: 'text',
      },
    ])
  })

  it('should handle edge cases with special characters after <', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    parser.write('Text with <1>, <@invalid>, and <!not-a-tag>')
    parser.end()

    expect(events).toEqual([
      {
        type: 'text',
        data: { contents: 'Text with <1>, <@invalid>, and <!not-a-tag>' },
      },
    ])
  })
})
