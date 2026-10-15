import { includesMatch } from '../string'
import { Node } from './types'

import type { TagOpenNode, TagSchema } from './types'

/**
 * Owns the tag stack and schema validation for the Saxy parser, and
 * emits tagopen/tagclose events through the given emitter.
 */
export class TagProcessor {
  readonly stack: string[]

  constructor(
    private readonly schema: TagSchema | null,
    private readonly emit: (event: string, data: unknown) => void,
  ) {
    this.stack = []
  }

  /**
   * Check whether a tag is allowed by the schema at the given stack depth.
   *
   * A negative parent index means the tag is a top-level tag.
   *
   * @param name Tag name to validate.
   * @param parentIndex Index of the parent tag in the tag stack (-1 for top-level).
   * @return true if the tag is allowed (or no schema is configured).
   */
  private isSchemaValid(name: string, parentIndex: number): boolean {
    if (!this.schema) {
      return true
    }

    if (parentIndex < 0) {
      return Boolean(this.schema[name])
    }

    const parentTag = this.stack[parentIndex]
    return (
      Boolean(this.schema[parentTag]) &&
      includesMatch(this.schema[parentTag], name)
    )
  }

  /**
   * Handle the opening of a tag in the text stream.
   *
   * Push the tag into the opened tag stack and emit the
   * corresponding event on the event emitter.
   *
   * @param node Information about the opened tag.
   */
  handleTagOpening(node: TagOpenNode) {
    const { name } = node

    // Convert to text if the tag is not allowed by the schema
    if (!this.isSchemaValid(name, this.stack.length - 1)) {
      this.emit(Node.text, { contents: node.rawTag })
      return
    }

    if (!node.isSelfClosing) {
      this.stack.push(node.name)
    }

    this.emit(Node.tagOpen, node)

    if (node.isSelfClosing) {
      this.emit(Node.tagClose, {
        name: node.name,
        rawTag: '',
      })
    }
  }

  /**
   * Handle a closing tag (`</name>`) found at the current cursor position.
   *
   * @param input The input string.
   * @param chunkPos Position of the '/' after the opening angle bracket.
   * @param tagClose Position of the closing '>'.
   * @return The new cursor position (past the closing '>').
   */
  handleTagClosing(input: string, chunkPos: number, tagClose: number): number {
    const tagName = input.slice(chunkPos + 1, tagClose)
    const stackedTagName = this.stack[this.stack.length - 1]

    // Convert closing tag to text if it doesn't match schema validation
    if (!this.isSchemaValid(tagName, this.stack.length - 2)) {
      const rawTag = input.slice(chunkPos - 1, tagClose + 1)
      this.emit(Node.text, { contents: rawTag })
      return tagClose + 1
    }

    if (tagName === stackedTagName) {
      this.stack.pop()
    }

    // Only emit if the tag matches what we expect (or if there is no schema)
    if (!this.schema || stackedTagName === tagName) {
      this.emit(Node.tagClose, {
        name: tagName,
        rawTag: input.slice(chunkPos - 1, tagClose + 1),
      })
    } else {
      // Emit as text if the tag doesn't match
      const rawTag = input.slice(chunkPos - 1, tagClose + 1)
      this.emit(Node.text, { contents: rawTag })
    }

    return tagClose + 1
  }

  /**
   * Handle an opening tag (`<name ...>`) found at the current cursor position.
   *
   * @param input The input string.
   * @param chunkPos Position of the tag name after the opening angle bracket.
   * @param tagClose Position of the closing '>'.
   * @return The new cursor position (past the closing '>').
   */
  handleTagOpeningAt(
    input: string,
    chunkPos: number,
    tagClose: number,
  ): number {
    // Check if the tag is self-closing
    const isSelfClosing = input[tagClose - 1] === '/'
    const realTagClose = isSelfClosing ? tagClose - 1 : tagClose

    // Extract the tag name and attributes
    const whitespace = input.slice(chunkPos).search(/\s/)

    // Get the raw tag text for potential text node conversion
    const rawTag = input.slice(chunkPos - 1, tagClose + 1)

    if (whitespace === -1 || whitespace >= tagClose - chunkPos) {
      // Tag without any attribute
      this.handleTagOpening({
        name: input.slice(chunkPos, realTagClose),
        attrs: '',
        isSelfClosing,
        rawTag,
      })
    } else if (whitespace === 0) {
      // Invalid tag starting with whitespace - emit as text
      this.emit(Node.text, { contents: rawTag })
    } else {
      // Tag with attributes
      this.handleTagOpening({
        name: input.slice(chunkPos, chunkPos + whitespace),
        attrs: input.slice(chunkPos + whitespace, realTagClose),
        isSelfClosing,
        rawTag,
      })
    }

    return tagClose + 1
  }
}
