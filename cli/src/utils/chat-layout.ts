/**
 * Width ownership for the chat transcript.
 *
 * `availableWidth` is the separator width supplied by useChatUI. The helpers in
 * this module account for structural insets exactly once so leaf renderers can
 * consume the resulting content width without magic deductions.
 */

export const CHAT_SCROLLBOX_PADDING_LEFT = 1
export const CHAT_SCROLLBOX_PADDING_RIGHT = 2
export const MESSAGE_SIDE_GUTTER = 1
export const ROOT_MESSAGE_PREFIX_WIDTH = 2
export const AGENT_MESSAGE_PREFIX_WIDTH = 2
/** Border plus left/right padding owned by each expanded agent card. */
export const AGENT_BRANCH_HORIZONTAL_INSET = 4
export const PLAN_BOX_HORIZONTAL_INSET = 4

interface MessageContentWidthOptions {
  availableWidth: number
  prefixWidth?: number
  nestedIndent?: number
}

export function getMessageContentWidth({
  availableWidth,
  prefixWidth = 0,
  nestedIndent = 0,
}: MessageContentWidthOptions): number {
  const structuralInset =
    CHAT_SCROLLBOX_PADDING_LEFT +
    CHAT_SCROLLBOX_PADDING_RIGHT +
    MESSAGE_SIDE_GUTTER * 2 +
    prefixWidth +
    nestedIndent

  return Math.max(1, Math.floor(availableWidth) - structuralInset)
}

export function getChildContentWidth(
  parentContentWidth: number,
  structuralIndent: number,
): number {
  return Math.max(1, Math.floor(parentContentWidth) - structuralIndent)
}
