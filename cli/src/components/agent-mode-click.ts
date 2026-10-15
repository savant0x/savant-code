import type { AgentMode } from '../utils/constants'

export type AgentModeClickAction =
  | { type: 'closeActive' }
  | { type: 'selectMode'; mode: AgentMode }
  | { type: 'toggleMode'; mode: AgentMode }

/**
 * Decide what high-level action a click on a segment should perform.
 * Extracted for unit testing and clarity.
 */
export const resolveAgentModeClick = (
  currentMode: AgentMode,
  clickedId: string,
  hasOnSelectMode: boolean,
): AgentModeClickAction => {
  if (clickedId.startsWith('active-')) return { type: 'closeActive' }
  const target = clickedId as AgentMode
  if (hasOnSelectMode) {
    return { type: 'selectMode', mode: target }
  }
  return { type: 'toggleMode', mode: target }
}
