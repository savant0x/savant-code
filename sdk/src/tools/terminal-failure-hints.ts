/** Advisory only: preserve failed outcomes and never replay an unavailable command. */
export function terminalFailureHint(params: {
  exitCode: number | null
  stdout: string
  stderr: string
  windows: boolean
}): string | undefined {
  if (params.exitCode === 0 || params.exitCode === null) return undefined
  const text = `${params.stderr}\n${params.stdout}`
  const missing = text.match(
    /(?:^|\n)[^\n]*?\b([a-zA-Z0-9_.-]+): command not found\b/,
  )
  if (missing)
    return `This Bash installation does not provide "${missing[1]}". Choose an available executable (for code search, use rg) or invoke PowerShell explicitly on Windows. The command was not replayed.`
  if (params.windows && /FIND: Parameter format not correct/i.test(text)) {
    return 'Windows FIND received incompatible arguments. Use rg for file or text searches instead of assuming GNU find is installed. The command was not replayed.'
  }
  return undefined
}
