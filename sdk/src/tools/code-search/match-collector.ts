import { parseRipgrepLine } from './schema'

/**
 * Accumulates ripgrep JSON event lines into grouped, limited output state.
 * Shared by the streaming parser (early-stop on the output limits) and the
 * close-flush (post-exit remainder). Extracted from code-search/executor.ts.
 *
 * FID-2026-1002-001 step 2: the collector ACCOUNTS for every event line it
 * cannot parse (`droppedEventLines` + `firstDroppedLine`) — the primary
 * silent-loss defect was dropping unparseable lines with no counter, no
 * notice, and no effect on the settled result. Protocol events (`begin`/
 * `end`/`summary`) are noise, NOT drops.
 */
export class RipgrepMatchCollector {
  fileGroups = new Map<string, string[]>()
  fileMatchCounts = new Map<string, number>()
  filesLimitedByMaxResults = new Set<string>()
  matchesGlobal = 0
  estimatedOutputLen = 0
  killedForLimit = false
  droppedEventLines = 0
  firstDroppedLine: string | null = null

  constructor(
    private readonly maxResults: number,
    private readonly globalMaxResults: number,
    private readonly maxOutputStringLength: number,
  ) {}

  /**
   * Parse + append one event line. Returns 'limit-hit' when the streaming
   * limits were crossed (caller kills ripgrep + settles the limited output).
   * 'flush' mode applies the post-exit inclusion rules (per-file AND global
   * caps), 'stream' mode the early-stop rules.
   */
  addEventLine(line: string, mode: 'stream' | 'flush'): 'ok' | 'limit-hit' {
    const parsed = parseRipgrepLine(line)
    if (parsed.kind === 'unparseable') {
      // FID-2026-1002-001 step 2: a dropped event line is ACCOUNTED, never
      // silent. Bounded so a hostile line cannot balloon the result.
      this.droppedEventLines++
      if (this.firstDroppedLine === null) {
        this.firstDroppedLine =
          line.length > 200 ? line.slice(0, 200) + '…' : line
      }
      return 'ok'
    }
    if (parsed.kind === 'protocol') {
      return 'ok'
    }
    const evt = parsed.event

    // Process both match and context events
    if (evt.type !== 'match' && evt.type !== 'context') {
      return 'ok'
    }
    const filePath = evt.data.path.text
    const lineNumber = evt.data.line_number ?? 0
    const rawText = evt.data.lines.text
    const lineText = rawText.replace(/\r?\n$/, '')

    // Format as ripgrep output: filename:line_number:content
    const formattedLine = `${filePath}:${lineNumber}:${lineText}`

    // Group by file
    if (!this.fileGroups.has(filePath)) {
      this.fileGroups.set(filePath, [])
      this.fileMatchCounts.set(filePath, 0)
    }
    const fileLines = this.fileGroups.get(filePath)!
    const fileMatchCount = this.fileMatchCounts.get(filePath)!

    // Only count matches toward limits, not context lines
    const isMatch = evt.type === 'match'

    if (mode === 'stream') {
      // Check if we should include this line
      // For matches: only if we haven't hit the per-file limit
      // For context: always include (they don't count toward limit)
      const shouldInclude = !isMatch || fileMatchCount < this.maxResults
      if (isMatch && !shouldInclude) {
        this.filesLimitedByMaxResults.add(filePath)
      }

      if (!shouldInclude) {
        return 'ok'
      }

      // Add the line to output
      fileLines.push(formattedLine)
      this.estimatedOutputLen += formattedLine.length + 1

      // Only increment match counters for actual matches
      if (isMatch) {
        this.fileMatchCounts.set(filePath, fileMatchCount + 1)
        this.matchesGlobal++

        // Check global limit or output size limit
        if (
          this.matchesGlobal >= this.globalMaxResults ||
          this.estimatedOutputLen >= this.maxOutputStringLength
        ) {
          this.killedForLimit = true
          return 'limit-hit'
        }
      }
      return 'ok'
    }

    // Flush mode: post-exit inclusion rules (per-file AND global caps)
    const shouldInclude =
      !isMatch ||
      (fileMatchCount < this.maxResults &&
        this.matchesGlobal < this.globalMaxResults)
    if (
      isMatch &&
      fileMatchCount >= this.maxResults &&
      this.matchesGlobal < this.globalMaxResults
    ) {
      this.filesLimitedByMaxResults.add(filePath)
    }

    if (shouldInclude) {
      fileLines.push(formattedLine)

      // Only increment match counter for actual matches
      if (isMatch) {
        this.fileMatchCounts.set(filePath, fileMatchCount + 1)
        this.matchesGlobal++
      }
    }
    return 'ok'
  }

  /**
   * FID-2026-1002-001: flush a post-exit remainder (possibly multiple
   * complete lines). A partial trailing line may legitimately fail to parse
   * — it is ACCOUNTED as a drop, never silent.
   */
  flushRemainder(remainder: string): void {
    if (!remainder) return
    const maybeMany = remainder.endsWith('\n') ? remainder : remainder + '\n'
    for (const ln of maybeMany.split('\n')) {
      if (!ln) continue
      try {
        this.addEventLine(ln, 'flush')
      } catch {
        // Probe outcome: a partial trailing JSON line may legitimately fail
        // to parse — the streamed events above are authoritative.
      }
    }
  }
}
