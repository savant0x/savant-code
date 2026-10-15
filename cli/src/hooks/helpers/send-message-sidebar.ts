import { useChatStore } from '../../state/chat-store'

/**
 * Builds the sidebar-wiring callbacks passed into createEventHandlerState:
 * session cost, tool usage, and the subagent stack. `onCost` receives every
 * reported cost (used by the caller to capture actualCredits for completion
 * metadata). FID-2026-0929-005 (gut the backend): the subscription-aware
 * credit accounting is deleted — there is no backend subscription to be
 * covered by, so every run's cost accrues to the local session counter.
 */
export const createSidebarEventCallbacks = (params: {
  addSessionCredits: (credits: number) => void
  onCost: (cost: number) => void
}) => {
  const { addSessionCredits, onCost } = params
  return {
    onTotalCost: (cost: number) => {
      onCost(cost)
      addSessionCredits(cost)
      // Wire sidebar: update session cost
      useChatStore.getState().updateSessionCost(cost)
    },
    onToolCall: (toolName: string) => {
      // Wire sidebar: track tool usage and history
      useChatStore.getState().addToolUsed(toolName)
      useChatStore.getState().addToolHistory(toolName)
    },
    onSubagentStart: (agentId: string, displayName: string) => {
      // Wire sidebar: add agent to stack. Store both the stable agentId
      // (used by onSubagentFinish) and the readable displayName (rendered
      // in the sidebar) so generated compact IDs don't pollute the UI.
      const current = useChatStore.getState().agentStack
      useChatStore
        .getState()
        .updateAgentStack([
          ...current,
          { id: agentId, displayName, isActive: true },
        ])
    },
    onSubagentFinish: (agentId: string) => {
      // Wire sidebar: mark agent as inactive
      const current = useChatStore.getState().agentStack
      useChatStore
        .getState()
        .updateAgentStack(
          current.map((a) =>
            a.id === agentId ? { ...a, isActive: false } : a,
          ),
        )
    },
  }
}
