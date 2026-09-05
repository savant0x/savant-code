/**
 * This is a modified version of the Saxy library that emits text nodes immediately
 */
import { Transform } from 'node:stream'
import { StringDecoder } from 'string_decoder'

import { findIndexOutside, parseAttrs, parseEntities } from './parse'
import { TagProcessor } from './tag-processor'
import { flushTextBuffer, handleTextRun, isXMLTagStart } from './text-handler'
import { Node } from './types'

import type {
  NextFunction,
  SaxyEventNames,
  SaxyEvents,
  TagSchema,
} from './types'

/**
 * Typed event listener methods, merged onto the Saxy class.
 */
export interface Saxy {
  on<U extends SaxyEventNames>(event: U, listener: SaxyEvents[U]): this
  once<U extends SaxyEventNames>(event: U, listener: SaxyEvents[U]): this
}

/**
 * Parse an XML stream and emit events corresponding
 * to the different tokens encountered.
 */
export class Saxy extends Transform {
  // Package-private fields: the text-handler module (same directory,
  // FID-2026-0819-005 Loop 151) operates on this minimal context surface.
  _decoder: StringDecoder
  _tags: TagProcessor
  _waiting: { token: string; data: unknown } | null
  _textBuffer: string // NEW: Text buffer as class member
  _shouldParseEntities: boolean

  /**
   * Parse a string of XML attributes to a map of attribute names
   * to their values
   *
   * @param input A string of XML attributes
   * @throws If the string is malformed
   * @return A map of attribute names to their values
   */
  static parseAttrs = parseAttrs

  /**
   * Expand a piece of XML text by replacing all XML entities
   * by their canonical value. Ignore invalid and unknown
   * entities
   *
   * @param input A string of XML text
   * @return The input string, expanded
   */
  static parseEntities = parseEntities

  /**
   * Create a new parser instance.
   * @param schema Optional schema defining allowed top-level tags and their children
   */
  constructor(schema?: TagSchema, shouldParseEntities: boolean = true) {
    super({ decodeStrings: false, defaultEncoding: 'utf8' })

    this._decoder = new StringDecoder('utf8')

    // Stack of tags that were opened up until the current cursor position
    this._tags = new TagProcessor(schema || null, (event, data) =>
      this.emit(event, data),
    )

    // Not waiting initially
    this._waiting = null

    // Initialize text buffer
    this._textBuffer = ''

    this._shouldParseEntities = shouldParseEntities
  }

  /**
   * Handle a chunk of data written into the stream.
   *
   * @param chunk Chunk of data.
   * @param encoding Encoding of the string, or 'buffer'.
   * @param callback Called when the chunk has been parsed, with
   * an optional error argument.
   */
  public _write(
    chunk: Buffer | string,
    encoding: string,
    callback: NextFunction,
  ) {
    const data =
      encoding === 'buffer'
        ? this._decoder.write(chunk as Buffer)
        : (chunk as string)

    this._parseChunk(data, callback)
  }

  /**
   * Handle the end of incoming data.
   *
   * @param callback
   */
  public _final(callback: NextFunction) {
    // Make sure all data has been extracted from the decoder
    this._parseChunk(this._decoder.end(), (err?: Error) => {
      if (err) {
        callback(err)
        return
      }

      // Handle any remaining text buffer
      this._flushTextBuffer()

      // Handle unclosed nodes
      if (this._handleUnclosedNodes(callback)) {
        return
      }

      if (this._tags.stack.length !== 0) {
        // Unclosed tags are accepted silently (lenient tool-call parsing).
        return
      }

      callback()
    })
  }

  /**
   * Immediately parse a complete chunk of XML and close the stream.
   *
   * @param input Input chunk.
   */
  public parse(input: Buffer | string): this {
    this.end(input)
    return this
  }

  /**
   * Put the stream into waiting mode, which means we need more data
   * to finish parsing the current token.
   *
   * @param token Type of token that is being parsed.
   * @param data Pending data.
   */
  _wait(token: string, data: unknown) {
    this._waiting = { token, data }
  }

  /**
   * Put the stream out of waiting mode.
   *
   * @return Any data that was pending.
   */
  private _unwait() {
    if (this._waiting === null) {
      return ''
    }

    const data = this._waiting.data
    this._waiting = null
    return data
  }

  /** Emit any buffered text node (delegates to text-handler.ts,
   *  FID-2026-0819-005 Loop 151). */
  private _flushTextBuffer() {
    flushTextBuffer(this)
  }

  /**
   * Handle any node that was left unclosed at the end of the stream.
   *
   * @param callback Completion callback for error reporting.
   * @return true if the finalization is complete (callback was invoked or
   * the unclosed node was accepted silently).
   */
  private _handleUnclosedNodes(callback: NextFunction): boolean {
    if (this._waiting === null) {
      return false
    }

    switch (this._waiting.token) {
      case Node.text:
        // Text nodes are implicitly closed
        this.emit('text', { contents: this._waiting.data })
        return false
      case Node.cdata:
        callback(new Error('Unclosed CDATA section'))
        return true
      case Node.comment:
        callback(new Error('Unclosed comment'))
        return true
      case Node.processingInstruction:
        callback(new Error('Unclosed processing instruction'))
        return true
      case Node.tagOpen:
      case Node.tagClose:
        // We do not distinguish between unclosed opening or unclosed
        // closing tags — accepted silently (lenient tool-call parsing).
        return true
      default:
        return false
    }
  }

  /**
   * Parse a XML chunk.
   *
   * @private
   * @param input A string with the chunk data.
   * @param callback Called when the chunk has been parsed, with
   * an optional error argument.
   */
  private _parseChunk(input: string, callback: NextFunction) {
    // Use pending data if applicable and get out of waiting mode
    const waitingData = this._unwait()
    input = waitingData + input

    let chunkPos = 0
    const end = input.length

    while (chunkPos < end) {
      if (
        input[chunkPos] !== '<' ||
        (chunkPos + 1 < end && !isXMLTagStart(input, chunkPos + 1))
      ) {
        chunkPos = handleTextRun(this, input, chunkPos, end)
        if (chunkPos >= end) {
          break
        }
      }

      // Invariant: the cursor now points on the name of a tag,
      // after an opening angled bracket
      chunkPos += 1

      // Recognize regular tags (< ... >)
      const tagClose = findIndexOutside(
        input,
        (char: string) => char === '>',
        '"',
        chunkPos,
      )

      if (tagClose === -1) {
        this._wait(Node.tagOpen, input.slice(chunkPos - 1))
        break
      }

      // Check if the tag is a closing tag
      if (input[chunkPos] === '/') {
        chunkPos = this._tags.handleTagClosing(input, chunkPos, tagClose)
        continue
      }

      chunkPos = this._tags.handleTagOpeningAt(input, chunkPos, tagClose)
    }

    // Emit any buffered text at the end of the chunk if there's no pending entity
    this._flushTextBuffer()

    callback()
  }

  // _handleText and _isXMLTagStart moved to text-handler.ts
  // (FID-2026-0819-005 Loop 151); _parseChunk calls the extracted
  // functions directly.
}
