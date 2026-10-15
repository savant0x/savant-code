/**
 * Heading-choice anti-evasion scan for FID step status (FID-2026-1001-003
 * step 7). Extracted from `fid-validator.ts` to satisfy the 300-line
 * quality cap; `validateFidStepStatus` remains the single entry point.
 *
 * The section-scoped parse is defeatable by heading choice: a closure-
 * claiming FID can park its step inventory under any other heading. This
 * module scans the WHOLE document for numbered unchecked step checkboxes
 * outside the `## Step Status` section, unless the document carries a
 * standalone `implementation_started: false` declaration.
 */

/** Standalone line only — a prose mention of the string is not a declaration. */
const IMPLEMENTATION_ASSERTION_PATTERN =
  /^\s*implementation_started:\s*false\s*$/m

/** Numbered step lines only: `- [ ] 1. …` / `- [ ] **Step 1** — …`. */
const NUMBERED_STEP_LINE_PATTERN =
  /^\s*-\s*\[([ xX])\]\s*(?:\*\*)?(?:Step\s+)?\d+/

const OPERATOR_APPROVAL_PATTERN = /operator-approved\s+\d{4}-\d{2}-\d{2}/

/**
 * Fenced code blocks are QUOTATION, not plan claims — a spec document
 * showing the step grammar inside a ``` fence (e.g. FID-2026-0817-005,
 * this gate's own author record) must not trip the scan. Strip them before
 * scanning. (Hiding live plan boxes inside a fence hides them from
 * rendering too, so this is not an evasion route.)
 */
function stripFencedBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '')
}

/**
 * Find unresolved (unchecked, unapproved) numbered step boxes OUTSIDE the
 * `## Step Status` section. `sectionMatch` is the matched section (its line
 * range is removed so a line is never reported twice); pass `undefined` when
 * the document has no such section. Returns one error per unique offending
 * line.
 */ export function findUnresolvedOutsideSectionSteps(
  content: string,
  sectionMatch: RegExpMatchArray | null,
  statusWord: string,
): string[] {
  // The assertion is checked on the FENCE-STRIPPED document too: a
  // declaration only inside a code fence is quotation, not declaration —
  // the same laundering shape the standalone-line rule closes.
  if (!IMPLEMENTATION_ASSERTION_PATTERN.test(stripFencedBlocks(content))) {
    // Remove the section from the RAW content first (its match offsets are
    // raw-based), THEN strip fences — stripping shifts offsets, so the
    // order matters.
    let outside = content
    if (sectionMatch) {
      const start = sectionMatch.index ?? 0
      outside =
        outside.slice(0, start) + outside.slice(start + sectionMatch[0].length)
    }
    outside = stripFencedBlocks(outside)
    const seen = new Set<string>()
    const errors: string[] = []
    for (const line of outside.split('\n')) {
      const numbered = line.match(NUMBERED_STEP_LINE_PATTERN)
      if (!numbered) continue
      const checked = numbered[1] === 'x' || numbered[1] === 'X'
      if (checked) continue
      const step = line.trim()
      if (seen.has(step)) continue
      seen.add(step)
      if (!OPERATOR_APPROVAL_PATTERN.test(step)) {
        errors.push(
          `step "${step}" is unresolved outside ## Step Status (no ` +
            'operator-approved marker) — a converged FID must either carry ' +
            '`implementation_started: false` or present it to the operator ' +
            `before the ${statusWord} transition`,
        )
      }
    }
    return errors
  }
  return []
}
