import type { MatchedSlashCommand } from '../hooks/use-suggestion-engine'

export function getSelectedSlashCommand(
  matches: MatchedSlashCommand[],
  selectedIndex: number,
): MatchedSlashCommand | undefined {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) return undefined
  return matches[selectedIndex]
}
