let thinkingIdCounter = 0
const generateThinkingId = (): string => {
  thinkingIdCounter++
  return `thinking-${thinkingIdCounter}`
}

/**
 * Test isolation: restarts the thinking-id sequence — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetThinkingIdCounter(): void {
  thinkingIdCounter = 0
}

export { generateThinkingId }
