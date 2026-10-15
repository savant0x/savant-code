/** Wrap generated Markdown with indented continuations and stable byte output. */
export function wrapLearningMarkdown(lines: readonly string[]): string {
  return (
    lines
      .flatMap((line) => {
        const wrapped: string[] = []
        let remaining = line
        while (remaining.length > 120) {
          const at = remaining.lastIndexOf(' ', 120)
          if (at < 1 || !remaining.slice(0, at).trim()) break
          wrapped.push(remaining.slice(0, at))
          remaining = `  ${remaining.slice(at + 1)}`
        }
        wrapped.push(remaining)
        return wrapped
      })
      .join('\n')
      .trimEnd() + '\n'
  )
}
