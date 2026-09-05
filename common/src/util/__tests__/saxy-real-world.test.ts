// Saxy XML Parser — real-world tool-call tag examples.
// Sibling of the Loop 322 decomposition (shared harness in ./saxy-harness).

import { describe, expect, it } from 'bun:test'

import { Saxy } from '../saxy'

describe('Saxy XML Parser - Real World Examples', () => {
  it('should handle && ( &lt', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write text split across chunks with no entities or tags
    parser.write(
      '<write_file>\n<path>path/to/file</path>\n<content>testing && ( &lt;div className="flex flex-col"&gt;</content>\n</write_file>',
    )
    parser.end()

    // The text content should be emitted in two chunks due to the new immediate emission behavior
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'write_file',
          rawTag: '<write_file>',
        },
        type: 'tagopen',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'path',
          rawTag: '<path>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'path/to/file',
        },
        type: 'text',
      },
      {
        data: {
          name: 'path',
          rawTag: '</path>',
        },
        type: 'tagclose',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'content',
          rawTag: '<content>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'testing && ( <div className="flex flex-col">',
        },
        type: 'text',
      },
      {
        data: {
          name: 'content',
          rawTag: '</content>',
        },
        type: 'tagclose',
      },
      {
        data: {
          name: 'write_file',
          rawTag: '</write_file>',
        },
        type: 'tagclose',
      },
    ])
  })

  it('should handle entity at end of content', () => {
    const parser = new Saxy()
    const events: any[] = []
    parser.on('text', (data) => events.push({ type: 'text', data }))
    parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
    parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

    // Write text split across chunks with no entities or tags
    parser.write(
      `<write_file>\n<path>path/to/file</path>\n<content>some value &amp</content>\n</write_file>`,
    )
    parser.end()

    // The text content should be emitted in two chunks due to the new immediate emission behavior
    expect(events).toEqual([
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'write_file',
          rawTag: '<write_file>',
        },
        type: 'tagopen',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'path',
          rawTag: '<path>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'path/to/file',
        },
        type: 'text',
      },
      {
        data: {
          name: 'path',
          rawTag: '</path>',
        },
        type: 'tagclose',
      },
      {
        data: {
          attrs: '',
          isSelfClosing: false,
          name: 'content',
          rawTag: '<content>',
        },
        type: 'tagopen',
      },
      {
        data: {
          contents: 'some value &amp',
        },
        type: 'text',
      },
      {
        data: {
          name: 'content',
          rawTag: '</content>',
        },
        type: 'tagclose',
      },
      {
        data: {
          name: 'write_file',
          rawTag: '</write_file>',
        },
        type: 'tagclose',
      },
    ])
  })
})
