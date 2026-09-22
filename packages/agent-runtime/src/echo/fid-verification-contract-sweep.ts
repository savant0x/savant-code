/**
 * @module echo/fid-verification-contract-sweep
 *
 * FID-2026-0918-006: the `### Verification` section (under Proposed
 * Solution) is a CONTRACT — it names the test artifacts that must exist
 * before `verified` status is earned — but nothing mechanical checked it:
 * `fid:verify` executes only the declared `## Verification Gates`. In
 * FID-2026-0918-004 a FID reached `verified` with a promised runtime test
 * never written; only the Adversary caught it — a role absent in
 * single-agent operation.
 *
 * This sweep makes the contract machine-checkable with a deterministic
 * promise rule, WIDENED by FID-2026-0919-021 (operator ruling on T70). The
 * original rule was `\bnew\s+(?:runtime\s+)?test\b` scoped to the
 * `### Verification` section — and auditing FID-2026-0918-007 against its
 * own contract showed BOTH limits let a real gap through: the record says
 * "New/updated `<path>`" (which the wording never matched) and the two
 * uncovered suites are named in its Steps and `### Implementation Evidence`
 * sections (which the section scope never read), so the sweep reported
 * 0 errors / 0 warnings over two ungated test artifacts.
 *
 * The widened rule keeps the narrow intent — only lines that PROMISE an
 * artifact — while closing both holes:
 *
 *   - a promise is any line, in any section, that names a REPO-RELATIVE
 *     `*.test.ts(x)` path AND carries a novelty marker (`new`, `added`) on
 *     that same line, in either order. `\bnew\b` matches the "New" of
 *     "New/updated" because `/` is a word boundary;
 *   - a bare filename (`ripgrep.test.ts`) is a mention, not a commitment —
 *     the path must carry a directory separator to be checked;
 *   - the original `new (runtime )?test` shape still reports a promise that
 *     names NO path at all — but only inside the sections whose prose
 *     PROMISES an artifact (`### Verification`,
 *     `### Implementation Evidence`). Whole-document scanning made that
 *     branch fire on ordinary narrative ("a document whose two new test
 *     suites were covered by no declared gate"), which is a descriptive
 *     sentence, not a commitment to produce a file.
 *
 * Anything the rule misses remains covered by the manual double-audit
 * checklist (single-agent protocol, method 2) — the sweep is a floor, not a
 * proof.
 *
 * Two tiers (grandfathering): a document WITH a verification receipt is
 * held to the contract (errors); a document WITHOUT one (converged /
 * analyzed / pre-stamp docs and archived records) only warns — the plan
 * has not been through the stamp ceremony yet, so a gap is information,
 * not a violation. The validator surface (`validateFidVerification`) only
 * sees receipt-bearing documents, so it enforces the error tier; the
 * warning tier is API-visible (tests, tooling).
 */

import {
  receiptSpan,
  sectionBetween,
  withoutFencedBlocks,
} from './fid-verification-gates-locators'

export type ContractSweepResult = {
  /** Hard failures: promise uncovered on a receipt-bearing document. */
  errors: string[]
  /** Grandfathered promise gaps on a document without a receipt. */
  warnings: string[]
}

/** The original promise shape: "new test" / "new runtime test". Kept so a
 * promise that names NO path is still reported (the widened rule below can
 * only judge lines that name one). */
const NAMED_PROMISE_LINE = /\bnew\s+(?:runtime\s+)?tests?\b/i

/** Novelty markers that make a line a promise when it names a test path. */
const NOVELTY_MARKER = /\b(?:new|added)\b/i

/** A REPO-RELATIVE test path in a promise line — the directory separator is
 * required, so a bare filename mention commits to nothing. */
const TEST_PATH = /[\w./-]*\/[\w-]+\.test\.(?:ts|tsx)/

/** Sections whose prose promises an artifact. Only here is a promise that
 * names no path judged: elsewhere the same words are narration
 * (FID-2026-0919-021 Loop 2 audit finding). */
const PROMISE_SECTIONS: readonly RegExp[] = [
  /^### Verification\s*$/m,
  /^### Implementation Evidence.*$/m,
]

/**
 * Sweep the `### Verification` prose contract. `declaredTestGates` is the
 * list of `- gate: test <arg>` args already parsed by the caller (passed
 * in rather than re-parsed so this module never imports the gates parser —
 * one dependency direction, no cycle).
 */
export function collectContractViolations(
  content: string,
  declaredTestGates: readonly string[],
): ContractSweepResult {
  // FID-2026-0919-021: scan the WHOLE document (fence-stripped, receipt
  // removed) rather than the `### Verification` section alone — the section
  // scope was half of the FID-2026-0918-007 gap. Fenced examples stay
  // documentation, and the receipt's `- test <path>: exit 0` lines carry no
  // novelty marker, so neither can invent a promise.
  const stripped = withoutFencedBlocks(content)
  const span = receiptSpan(stripped)
  const scannable =
    span === undefined
      ? stripped
      : stripped.slice(0, span.start) + stripped.slice(span.start + span.length)

  // Promise-bearing lines that name no path: collected from the sections
  // whose prose is a commitment, so narrative elsewhere cannot trigger them.
  const pathlessPromises = new Set<string>()
  for (const start of PROMISE_SECTIONS) {
    // Terminate at the next same-or-higher heading: `## ` alone would run
    // the section past its sibling `### ` subsections and swallow the
    // surrounding prose (FID-2026-0919-021 Loop 2 audit finding c).
    const body = sectionBetween(content, start, /^(?:##|###) /m)
    if (body === undefined) continue
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim()
      if (line && NAMED_PROMISE_LINE.test(line)) pathlessPromises.add(line)
    }
  }

  const promises: { line: string; path: string | undefined }[] = []
  for (const rawLine of scannable.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const rawPath = line.match(TEST_PATH)?.[0]
    if (rawPath !== undefined) {
      if (!NOVELTY_MARKER.test(line)) continue
      promises.push({ line, path: rawPath.replaceAll('\\', '/') })
      continue
    }
    // No path on the line: a promise only where a promise is expected.
    if (pathlessPromises.has(line)) promises.push({ line, path: undefined })
  }
  if (promises.length === 0) return { errors: [], warnings: [] }

  const declared = new Set(declaredTestGates)
  const uncovered = promises.filter(
    (promise) => promise.path === undefined || !declared.has(promise.path),
  )
  if (uncovered.length === 0) return { errors: [], warnings: [] }

  const messages = uncovered.map((promise) =>
    promise.path === undefined
      ? `verification-contract gap: promised test artifact names no path — "${promise.line}" (name the repo-relative *.test.ts path it must produce; FID-2026-0918-006)`
      : `verification-contract gap: promised test artifact "${promise.path}" is not covered by a declared '- gate: test <path>' (FID-2026-0918-006)`,
  )

  // Grandfather tier: no receipt in the fence-stripped view means the
  // document has not been stamped in this shape — report, don't fail.
  const hasReceipt = receiptSpan(withoutFencedBlocks(content)) !== undefined
  return hasReceipt
    ? { errors: messages, warnings: [] }
    : { errors: [], warnings: messages }
}
