import type { RunLogEvent } from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-005: Auto Drive Run Log — the deferred presentation surface.
 *
 * Every ladder event is appended to the master FID's `## Run Log` section. The
 * operator reviews the log after the run (via `/export`), never mid-run; the
 * anti-deferral ledger remains the mechanical backstop. Event frames are
 * mechanical (written by the router, not the model); model-authored rationale
 * is recorded as attributed text in `rationale`.
 */

export const RUN_LOG_HEADING = '## Run Log'

export function formatRunLogEvent(event: RunLogEvent): string {
  const ts = new Date(event.timestamp).toISOString()
  const evidence =
    event.evidenceRefs.length > 0 ? ` — ${event.evidenceRefs.join(', ')}` : ''
  return `- ${ts} | rung ${event.rung} | ${event.fid} | ${event.decision} | ${event.rationale}${evidence}`
}

/**
 * Append a Run Log event to FID markdown content. Creates the `## Run Log`
 * section at the end when absent, otherwise appends under the existing heading
 * (before any trailing content that is not part of the section).
 */
export function appendRunLogEvent(content: string, event: RunLogEvent): string {
  const line = formatRunLogEvent(event)
  if (content.includes(RUN_LOG_HEADING)) {
    // Insert the new line immediately after the heading's first newline.
    return content.replace(
      new RegExp(`(${RUN_LOG_HEADING}[\\r\\n]+)`),
      `$1${line}\n`,
    )
  }
  return `${content.trimEnd()}\n\n${RUN_LOG_HEADING}\n\n${line}\n`
}

const GREEN_HEADING = '### GREEN'

/**
 * FID-2026-0818-005 rung 5: record a documented-default decision in the FID's
 * GREEN section. A spec gap is resolved with the most-robust default — a
 * *decision*, not a deferral — so the step stays implemented (`[x]`) and the
 * anti-deferral gate passes. The decision carries the issue, the chosen
 * default, and the rationale; the operator's confirmation contract (child 002)
 * pre-authorizes these defaults.
 */
export function appendDocumentedDefault(
  content: string,
  decision: { issue: string; chosenDefault: string; rationale: string },
): string {
  const block =
    `\n\n#### Documented default (rung 5)\n\n` +
    `- **Issue:** ${decision.issue}\n` +
    `- **Decision:** ${decision.chosenDefault}\n` +
    `- **Rationale:** ${decision.rationale}\n`
  if (content.includes(GREEN_HEADING)) {
    // Append the decision block immediately after the GREEN heading's first
    // paragraph, before any following `### `/`## ` section.
    const headingIndex = content.indexOf(GREEN_HEADING)
    const afterHeading = content.slice(headingIndex + GREEN_HEADING.length)
    const nextSection = afterHeading.search(/\n(?:###|##) /)
    if (nextSection === -1) {
      return `${content.trimEnd()}${block}`
    }
    const insertAt = headingIndex + GREEN_HEADING.length + nextSection
    return content.slice(0, insertAt) + block + '\n' + content.slice(insertAt)
  }
  return `${content.trimEnd()}\n\n${GREEN_HEADING}${block}`
}
