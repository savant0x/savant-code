/**
 * This is a modified version of the Saxy library that emits text nodes immediately
 */
export { Saxy } from './saxy/stream'
export { parseAttrs } from './saxy/parse'
export type {
  CDATANode,
  CommentNode,
  NextFunction,
  ProcessingInstructionNode,
  TextNode,
} from './saxy/types'
export type {
  SaxyEventArgs,
  SaxyEventNames,
  SaxyEvents,
  TagCloseNode,
  TagOpenNode,
  TagSchema,
} from './saxy/types'
