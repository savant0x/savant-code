# FID: Asymmetric partial matchers mutate test evidence

**Filename:** `FID-2026-1013-002-asymmetric-partial-matchers-mutate-test-evidence.md`
**ID:** FID-2026-1013-002
**Severity:** medium
**Status:** closed
**Created:** 2026-10-13 12:00
**Closed:** 2026-10-13
**Commit:** 9b1d5b4deabf0168f55bb46e3085a138f2bcdffd
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022

## Summary

Bun 1.3.14's toMatchObject replaces received fields with asymmetric matcher
objects. Parsing before the assertion protects the raw tool output but leaves
the parsed evidence mutable. Three current inline calls remain. Repair them
without weakening their expectations and guard this specific pattern.

## Environment

- **OS:** Windows 11, PowerShell
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Commit/State:** main at 6b847099; unrelated worktree changes preserved

## Detailed Description

### Problem

The master already records this harness defect as unowned. A current live probe
assigns `{ a: 'x' }`, applies `toMatchObject({ a: expect.stringContaining('x') })`
and then reads `typeof received.a === 'object'`. The assertion passed while
destroying the received string. Current AST census: 195 calls, three with inline
asymmetric matcher expressions.

### Expected Behavior

Assertions preserve received evidence for later schema and equality checks.
Inline asymmetric matcher expressions never enter toMatchObject.

### Root Cause

This is the pinned runtime's matcher behavior. The SDK's earlier parse-first
workaround protected only the raw result, leaving its parsed projection exposed.
The repository has no check against reintroducing the same inline pattern.

### Evidence

- common/src/util/__tests__/analytics-dispatcher.test.ts:36
- sdk/src/__tests__/command-execution-contract.test.ts:62
- packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts:204
- Read-only census: mutating-matchers.jsonl in the continuation scratch directory.

## Impact Assessment

### Affected Components

Three assertions, the independent AST collector and repository validation.
Production analytics, command and agent behavior remain outside this repair.

### Risk Level

- [x] Medium: passing tests mutate the data they purport to verify.

## Proposed Solution

### Steps

1. Replace each affected call with toEqual(expect.objectContaining(...)), retaining
   the existing nested asymmetric expectations. Pin the received data before/after.
2. Add a TypeScript AST collector for inline asymmetric calls within toMatchObject
   arguments. Recognize bun:test expect import aliases and expect.not chains.
   Comments and assertion strings are not findings. Scan tracked and untracked
   test sources in the eight existing source roots, respecting git ignores.
3. Wire the collector into repository validation and its own standalone probe.
4. Run negative and positive controls, all three suites, affected typechecks,
   scripts typecheck, lint, quality and repository validation. Commit locally.

### Verification

The existing three suites pin received-value preservation. The new suite
scripts/__tests__/audit-mutating-matchers.test.ts pins AST detection, aliases,
negation and quoted lookalikes; it proves the collector rejects a seeded file.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: test common/src/util/__tests__/analytics-dispatcher.test.ts
- gate: test sdk/src/__tests__/command-execution-contract.test.ts
- gate: test packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts
- gate: test scripts/__tests__/audit-mutating-matchers.test.ts
- gate: probe scripts/audit-mutating-matchers.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5ab3b963d631e5371b2f224a3984012db82f8326b2acab473ad13ecc9d45cd39
- verified: 2026-10-13T16:25:20.166Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/util/__tests__/analytics-dispatcher.test.ts: exit 0
- test sdk/src/__tests__/command-execution-contract.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts: exit 0
- test scripts/__tests__/audit-mutating-matchers.test.ts: exit 0
- probe scripts/audit-mutating-matchers.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — Converged contract

- **RED:** A live Bun probe proves received-value replacement. Current-tree AST
  inspection names three inline calls, including the earlier SDK workaround.
- **GREEN:** Use the nonmutating equality/partial-object matcher composition;
  preserve each existing condition and add received-value assertions. Guard the
  exact inline pattern with one shared collector used by probe and repo gate.
- **AUDIT:** All three files read 0-EOF; their asymmetric values already express
  partial nested matching, so the replacement does not force nested exactness.
  The repository's TypeScript parser and git source census are existing seams.
- **ADVERSARIAL:** This guard covers inline matcher expressions, not arbitrary
  helper return values or dynamic aliases. State that boundary; never claim a
  complete proof of assertion purity. No Bun upgrade or production rewrite.
- **CHANGE DELTA:** Recorded before source changes under level-3 authority.

### Missed Questions

1. Is parse-first sufficient? It preserves raw data but still mutates the parsed
   value. Both should retain their original values after assertions.
2. Does equality lose partial matching? Outer objectContaining preserves the
   existing partial shape; nested matcher objects remain explicit.
3. Can a regex distinguish code from fixture strings? No; parse the AST.
4. Should all 195 partial assertions be banned? The reproduced defect needs an
   asymmetric expected value. Preserve plain-literal assertions and the exact
   covered pattern; indirect matcher flow remains an explicit audit boundary.

### Code Verification Evidence

- RED preservation pins: common 5 PASS / 1 FAIL; SDK 7 PASS / 1 FAIL;
  runtime 3 PASS / 1 FAIL. Exact failures replace properties, errorMessage and
  the message array with empty serialized matcher objects.
- GREEN: common 6 PASS, SDK 8 PASS, runtime 4 PASS, new AST suite 7 PASS;
  combined 25 PASS / 0 FAIL. Existing assertions still reject mismatches.
- Real standalone collector: PASS (0 issues); targeted ESLint and formatter exit 0.
- `scripts/validate-repository.ts` imports and calls collectMutatingMatcherIssues;
  the standalone CLI uses the same collector. Both entrypoints enforce new source.
- Full typecheck and declared receipt execution follow below. No production class
  repair or observation window is claimed by this harness change.

## Resolution

Implemented at `9b1d5b4deabf0168f55bb46e3085a138f2bcdffd` and closed 2026-10-13 once all
10 declared gates re-ran green; live verification is recorded above and in the
declared receipt. Local commits were authorized on 2026-10-13; push and release
remain operator-owned.

- **Archived:** 2026-10-13 — all 10 declared gates re-ran green on the closure tree before closure; the implementation commit is recorded in the metadata above.
