// Saxy XML Parser — chunked writes: entities and text split across chunks.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { Saxy } from '../saxy'

describe('Saxy XML Parser - Chunked Writes', () => {
  it('should handle split XML entities across chunks', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write the XML in chunks that split the &amp; entity
    parser.write('<tag>before &a')
    parser.write('mp; after</tag>')
    parser.end()

    // The entity should be properly decoded and the text events should
    // reconstruct the original text correctly
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'tag',
          rawTag: '<tag>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'before ',
        },
        type: 'text',
      },
      {
        data: {
          contents: '& after',
        },
        type: 'text',
      },
      {
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
        type: 'tagclose',
      },
    ])

    // The text content should be properly reconstructed
    const textContent = events
      .filter((e) => e.type === 'text')
      .map((e) => e.data.contents)
      .join('')
    expect(textContent).toBe('before & after')
  })

  it('should handle multiple split entities in sequence', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))

    // Write chunks that split multiple entities
    parser.write('Text with &am')
    parser.write('p; and &l')
    parser.write('t; symbols')
    parser.end()

    // The entities should be properly decoded and combined
    expect(events.map((e) => e.data.contents).join('')).toBe(
      'Text with & and < symbols',
    )
  })

  it('should handle literal ampersand split across chunks', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => {
      events.push({ type: 'text', data })
    })
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write chunks that split a literal & character
    parser.write('<tag>before &')
    parser.write(' after</tag>')
    parser.end()

    // The & should be treated as literal text and stay with its surrounding content
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'tag',
          rawTag: '<tag>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'before ',
        },
        type: 'text',
      },
      {
        data: {
          contents: '& after',
        },
        type: 'text',
      },
      {
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
        type: 'tagclose',
      },
    ])

    // The text content should be properly reconstructed
    const textContent = events
      .filter((e) => e.type === 'text')
      .map((e) => e.data.contents)
      .join('')
    expect(textContent).toBe('before & after')
  })

  it('should not treat standalone ampersand as pending entity', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => {
      events.push({ type: 'text', data })
    })

    // Write chunks that split a standalone & character
    parser.write('Text with &')
    parser.write(' more text')
    parser.end()

    expect(events).toEqual([
      { type: 'text', data: { contents: 'Text with ' } },
      { type: 'text', data: { contents: '& more text' } },
    ])
    // The text content should be properly reconstructed
    const textContent = events
      .filter((e) => e.type === 'text')
      .map((e) => e.data.contents)
      .join('')
    expect(textContent).toBe('Text with & more text')
  })

  it('should handle text split across chunks without entities or tags', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write text split across chunks with no entities or tags
    parser.write('<tag>Some text')
    parser.write(' continued</tag>')
    parser.end()

    // The text content should be emitted in two chunks due to the new immediate emission behavior
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'tag',
          rawTag: '<tag>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'Some text',
        },
        type: 'text',
      },
      {
        data: {
          contents: ' continued',
        },
        type: 'text',
      },
      {
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
        type: 'tagclose',
      },
    ])

    // The text content should still be properly reconstructible
    const textContent = events
      .filter((e) => e.type === 'text')
      .map((e) => e.data.contents)
      .join('')
    expect(textContent).toBe('Some text continued')
  })

  it('should output closing tag as text if not matching', async () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write text split across chunks with no entities or tags
    parser.write('<tag></invalid></tag>')
    parser.end()

    // The text content should be emitted in two chunks due to the new immediate emission behavior
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'tag',
          rawTag: '<tag>',
        },
        type: 'tagopen',
      },
      {
        data: {
          name: 'invalid',
          rawTag: '</invalid>',
        },
        type: 'tagclose',
      },
      {
        data: {
          name: 'tag',
          rawTag: '</tag>',
        },
        type: 'tagclose',
      },
    ])

    // The text content should still be properly reconstructible
    const textContent = events
      .filter((e) => e.type === 'text')
      .map((e) => e.data.contents)
      .join('')
    expect(textContent).toBe('')
  })
})
