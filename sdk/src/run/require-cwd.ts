/**
 * LF-001 (FID-2026-1012-007) ceiling split: `requireCwd` moved verbatim out of
 * `tool-call.ts` so the tool dispatcher stays under the 300-line absolute
 * maximum after the read window landed. Zero behavior change.
 */
export function requireCwd(cwd: string | undefined, toolName: string): string {
  if (!cwd) {
    throw new Error(
      `cwd is required for the ${toolName} tool. Please provide cwd in SavantCodeClientOptions or override the ${toolName} tool.`,
    )
  }
  return cwd
}
