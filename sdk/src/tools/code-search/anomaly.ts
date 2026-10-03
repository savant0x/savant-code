/**
 * @module tools/code-search/anomaly
 *
 * FID-2026-1002-001 steps 3-4: run-outcome classification for the code
 * search close path. Absence-shaped evidence must be provably produced by a
 * successful run — `rg` exit semantics are the ground truth
 * (0 = matches existed, 1 = no matches, 2+ = error), so:
 *
 * - exit 0 with zero collected matches is SELF-CONTRADICTORY (the old bug
 *   rendered it as a clean "Found 0 matches") → hard anomaly;
 * - dropped event lines that explain a zero (or rg's "no matches" verdict)
 *   make the absence untrustworthy → hard anomaly;
 * - a non-0/1 exit (or a signal death) is an error → hard anomaly carrying
 *   stderr and the drop count;
 * - drops alongside collected matches → normal settle with a visible
 *   warning (partial results, never a silent loss);
 * - exit 1 + zero collected + zero drops → the one honest clean no-match.
 */

/** Bounded stderr excerpt carried by anomaly messages. */
function stderrExcerpt(stderrBuf: string): string {
  const trimmed = stderrBuf.trim()
  if (!trimmed) return ''
  return trimmed.length > 500 ? trimmed.slice(0, 500) + '…' : trimmed
}

function dropNotice(dropped: number, firstDroppedLine: string | null): string {
  return (
    `${dropped} event line(s) failed to parse` +
    (firstDroppedLine ? ` (first: ${firstDroppedLine})` : '')
  )
}

export type CodeSearchOutcome =
  /** Normal settle; `message` is appended to the exit-code line when set. */
  | { kind: 'clean'; message: string }
  /** Normal settle WITH a visible partial-results warning. */
  | { kind: 'warning'; message: string }
  /** Hard anomaly: settle through the error channel, never as a no-match. */
  | { kind: 'anomaly'; errorMessage: string; emptyResultText: string }

export function classifyCodeSearchOutcome(params: {
  code: number | null
  collected: number
  dropped: number
  firstDroppedLine: string | null
  stderrBuf: string
}): CodeSearchOutcome {
  const { code, collected, dropped, firstDroppedLine, stderrBuf } = params
  const stderr = stderrExcerpt(stderrBuf)
  const stderrSuffix = stderr ? ` stderr: ${stderr}` : ''

  // ripgrep only exits 0 when matches existed — zero collected is the
  // self-contradiction this FID exists to end.
  if (code === 0 && collected === 0) {
    return {
      kind: 'anomaly',
      errorMessage:
        `Code search anomaly: ripgrep exited 0 (matches existed) but 0 matches ` +
        `were collected — a "Found 0 matches" result would be a false no-match.` +
        (dropped > 0 ? ` ${dropNotice(dropped, firstDroppedLine)}.` : '') +
        stderrSuffix,
      emptyResultText:
        'No match list: the search run did not complete cleanly (see the error).',
    }
  }
  // rg's "no matches" verdict is not trustworthy when lines were dropped —
  // the dropped lines could have been the matches.
  if (collected === 0 && dropped > 0) {
    return {
      kind: 'anomaly',
      errorMessage:
        `Code search anomaly: no matches were collected and ` +
        `${dropNotice(dropped, firstDroppedLine)} — the no-match result is ` +
        `not trustworthy.${stderrSuffix}`,
      emptyResultText:
        'No match list: the search run did not complete cleanly (see the error).',
    }
  }
  if (code !== null && code !== 0 && code !== 1) {
    return {
      kind: 'anomaly',
      errorMessage:
        `Code search failed: ripgrep exited ${code}.` +
        (dropped > 0 ? ` ${dropNotice(dropped, firstDroppedLine)}.` : '') +
        stderrSuffix,
      emptyResultText: 'No match list: the search run failed (see the error).',
    }
  }
  if (code === null) {
    return {
      kind: 'anomaly',
      errorMessage:
        'Code search anomaly: the ripgrep process was terminated by a signal ' +
        'before an exit code was reported.' +
        (dropped > 0 ? ` ${dropNotice(dropped, firstDroppedLine)}.` : '') +
        stderrSuffix,
      emptyResultText:
        'No match list: the search run did not complete cleanly (see the error).',
    }
  }
  if (dropped > 0) {
    return {
      kind: 'warning',
      message: `${dropNotice(dropped, firstDroppedLine)} — results may be incomplete.`,
    }
  }
  return { kind: 'clean', message: '' }
}
