export type TextNode = {
  /** The text value */
  contents: string
}

export type CDATANode = {
  /** The CDATA contents */
  contents: string
}

export type CommentNode = {
  /** The comment contents */
  contents: string
}

export type ProcessingInstructionNode = {
  /** The instruction contents */
  contents: string
}

/** Information about an opened tag */
export type TagOpenNode = {
  /** Name of the tag that was opened. */
  name: string
  /**
   * Attributes passed to the tag, in a string representation
   * (use Saxy.parseAttributes to get an attribute-value mapping).
   */
  attrs: string
  /**
   * Whether the tag self-closes (tags of the form ``).
   * Such tags will not be followed by a closing tag.
   */
  isSelfClosing: boolean

  /**
   * The original text of the tag, including angle brackets and attributes.
   */
  rawTag: string
}

/** Information about a closed tag */
export type TagCloseNode = {
  /** Name of the tag that was closed. */
  name: string

  /**
   * The original text of the tag, including angle brackets.
   */
  rawTag: string
}

export type NextFunction = (err?: Error) => void

export interface SaxyEvents {
  finish: () => void
  error: (err: Error) => void
  text: (data: TextNode) => void
  cdata: (data: CDATANode) => void
  comment: (data: CommentNode) => void
  processinginstruction: (data: ProcessingInstructionNode) => void
  tagopen: (data: TagOpenNode) => void
  tagclose: (data: TagCloseNode) => void
}

export type SaxyEventNames = keyof SaxyEvents

export type SaxyEventArgs =
  | Error
  | TextNode
  | CDATANode
  | CommentNode
  | ProcessingInstructionNode
  | TagOpenNode
  | TagCloseNode

/**
 * Schema for defining allowed tags and their children
 */
export type TagSchema = {
  [topLevelTag: string]: (string | RegExp)[] // Allowed child tags
}

/**
 * Nodes that can be found inside an XML stream.
 */
export const Node = {
  text: 'text',
  cdata: 'cdata',
  comment: 'comment',
  processingInstruction: 'processinginstruction',
  tagOpen: 'tagopen',
  tagClose: 'tagclose',
  // markupDeclaration: 'markupDeclaration',
} as Record<string, SaxyEventNames>
