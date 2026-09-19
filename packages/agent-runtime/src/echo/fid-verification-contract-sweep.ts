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
 * This sweep makes the contract machine-checkable with a deliberately
 * NARROW, deterministic promise pattern:
 *
 *   /\bnew\s+(?:runtime\s+)?test\b/i
 *
 * Each matched line must name a repo-relative `*.test.ts(x)` path (the
 * same shape the gates parser consumes) that ALSO appears among the
 * caller's declared `gate: test` args. Anything the pattern misses remains
 * covered by the manual double-audit checklist (single-agent protocol,
 * method 2) — the sweep is a floor, not a proof.
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

/** The narrow promise pattern: "new test" / "new runtime test". */
const PROMISE_LINE = /\bnew\s+(?:runtime\s+)?test\b/i

/** A repo-relative test path appearing in a promise line. */
const TEST_PATH = /[\w./\\-]+\.test\.(?:ts|tsx)/

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
  const section = sectionBetween(content, /^### Verification\s*$/m, /^## /m)
  if (section === undefined) return { errors: [], warnings: [] }

  const promises: { line: string; path: string | undefined }[] = []
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim()
    if (!PROMISE_LINE.test(line)) continue
    const rawPath = line.match(TEST_PATH)?.[0]
    promises.push({ line, path: rawPath?.replaceAll('\\', '/') })
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
