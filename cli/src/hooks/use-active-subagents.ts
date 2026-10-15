import { useCallback } from 'react'

/**
 * Manages the active-subagents stack: keeps the React store slice and the
 * external ref in lockstep whenever a subagent starts or finishes. Extracted
 * from use-send-message.ts (FID-2026-0805-003).
 */
export const useActiveSubagents = (
  activeSubagentsRef: React.MutableRefObject<Set<string>>,
  setActiveSubagents: (updater: (prev: Set<string>) => Set<string>) => void,
): {
  addActiveSubagent: (subagentId: string) => void
  removeActiveSubagent: (subagentId: string) => void
} => {
  const updateActiveSubagents = useCallback(
    (mutate: (next: Set<string>) => void) => {
      setActiveSubagents((prev) => {
        const next = new Set(prev)
        mutate(next)
        activeSubagentsRef.current = next
        return next
      })
    },
    [setActiveSubagents, activeSubagentsRef],
  )

  const addActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.add(subagentId))
    },
    [updateActiveSubagents],
  )

  const removeActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.delete(subagentId))
    },
    [updateActiveSubagents],
  )

  return { addActiveSubagent, removeActiveSubagent }
}
