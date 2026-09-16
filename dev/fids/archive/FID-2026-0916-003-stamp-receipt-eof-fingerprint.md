# FID: stampReceipt EOF edge stamps receipts that validate as stale (fingerprint identity gap)

**Filename:** `FID-2026-0916-003-stamp-receipt-eof-fingerprint.md`
**ID:** FID-2026-0916-003
**Severity:** medium
**Status:** closed
**Created:** 2026-09-16 19:05
**YAGNI-Compliance:** Verified

---

## Summary

When a FID's `## Verification Gates` section runs to EOF (no heading after
it), `fid:verify --write` stamps a receipt whose fingerprint never matches
what the validator recomputes — every such receipt reads as stale
(fail-closed). The stamp and the fingerprint disagree on the document's
trailing-newline shape. Template-shaped FIDs never hit this edge, but
`stampReceipt`/`computeFidFingerprint` are now load-bearing (Task 58 made
the receipt contract mandatory for every closure), so the latent defect in
the freshness mechanism must be closed.

## Environment

- OS: Windows (bash); Bun ≥ 1.3.11
- Affected: `packages/agent-runtime/src/echo/fid-verification-gates.ts`
  (`computeFidFingerprint`), `scripts/fid-receipt-stamp.ts`
  (`stampReceipt` EOF branches), `scripts/fid-verify.ts` (pre-stamp hash)

## Detailed Description

### Problem

`buildReceipt(content, …)` hashes `content` (pre-stamp, receipt-less).
The validator recomputes the hash over the stamped document with the
receipt span removed (via `receiptSpan`). For the *mid-document* insert
path the two views are byte-identical (FID-2026-0907-010 fixed that).
For the **EOF path** (`stampReceipt`'s `next === -1` branches) they are
not:

- Pre-stamp hashed view ends: `…- gate: quality` + `\n`
- Post-stamp, `stampReceipt` returns
  `content.trimEnd() + '\n\n' + receipt + '\n'`. Removing the exact
  receipt span (heading + body, no trailing separator) leaves
  `…- gate: quality` + `\n\n` — one extra `\n` versus the pre-stamp view.

sha256 of the two views differs → `parseVerificationReceipt` freshness
check fails on a receipt that was just stamped. Observed live during
Task 58's negative-leg e2e fixture (documented in the session summary
`2026-09-16-1700` as a benign pre-existing edge; this FID promotes it to
a defect because the mechanism is now on every closure's critical path).

### Expected Behavior

A receipt stamped by `fid:verify --write` on a gates-runs-to-EOF document
validates as fresh, exactly like a mid-document stamped receipt.

### Root Cause

`stampReceipt`'s EOF branches normalize the document tail with
`trimEnd()` and reinsert `\n\n` separators, while the pre-stamp hash and
the post-stamp receipt-span removal make no tail normalization. The two
sides of the identity disagree on trailing-newline handling.

### Evidence

Task 58 negative-leg session log (2026-09-16): the throwaway fixture —
a stamped `fixed` FID whose gates section ran to EOF — failed `--check`
with `stale receipt` as one of the errors immediately after
`fid:verify --write` reported the stamp. Re-stamping did not clear it;
the identity cannot hold for that document shape.

```text
stampReceipt EOF path: content.trimEnd() + '\n\n' + receipt + '\n'
receiptSpan removal:   heading + body only → trailing '\n\n' remains
pre-stamp hash view:   trailing '\n' (single)
→ sha256 mismatch → receipt reads stale
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/fid-verification-gates.ts`
  (`computeFidFingerprint` — the single fingerprint authority)
- `scripts/fid-receipt-stamp.ts` (EOF stamp branches — unchanged by the
  fix; the defect is in the hash-side asymmetry)
- `scripts/fid-verify.ts` (`buildReceipt` — unchanged; hashes pre-stamp
  content)

### Risk Level

- [x] Medium: Freshness mechanism gives false staleness on one document
  shape; fail-closed (never accepts a bad receipt), template-shaped FIDs
  unaffected, no user-facing runtime impact.

## Proposed Solution

### Approach

Tail-normalize inside `computeFidFingerprint` (the single hashing
authority — Law 13: one universal function, both sides of the identity
flow through it): after computing the receipt-stripped (or receipt-less)
fenced view, replace a trailing run of `\n` with exactly one `\n` before
hashing. Both hash call sites (pre-stamp receipt-less document, post-stamp
span-removed document) then agree on every shape; the insert-path identity
(FID-2026-0907-010) and the mid-document path are unaffected because they
already produce single-`\n` tails. Freshness is preserved: any content
edit still changes the hash; only the trailing-newline count becomes
insignificant, which is exactly the property the stamp operation itself
destroys and cannot restore.

### Steps

1. RED: pin in
   `packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts`
   — replay `stampReceipt`'s EOF branch over a gates-to-EOF document and
   assert `computeFidFingerprint(stamped) === computeFidFingerprint(pre)`.
   Observe fail.
2. GREEN: implement the tail normalization in `computeFidFingerprint`
   (one `replace(/\n+$/, '\n')` on the hashed view), with the
   FID-2026-0916-003 rationale comment.
3. Add an EOF-path mirror pin alongside the existing insert-path pin
   (same style: replayed stamp branch, no self-referential hashing) and a
   pin that trailing-whitespace content edits still invalidate freshness
   (replace the final gate line's text — hash must change).
4. Re-run: contract suite + executor suites (`fid-verify.test.ts`,
   `fid-gates.test.ts`, tripwire) + typecheck ×4 + LIVE e2e (stamped
   gates-to-EOF fixture validates via `--check`; destroyed after).

### Verification

- `bun test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts`
  (new pins green, zero regressions)
- `bun test scripts/__tests__/fid-verify.test.ts scripts/__tests__/fid-gates.test.ts`
  + tripwire suite
- typecheck: agent-runtime, scripts (via suites), cli, common, sdk
- LIVE: `fid:verify --write` + `--check` on a scratchpad gates-to-EOF
  fixture (positive leg), fixture destroyed afterward

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: test scripts/__tests__/fid-gates.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-receipt-tripwire.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e4713b00c356ab13609d044b9395c40118862ecdbaaaeec5fc221c286e0f271d
- verified: 2026-09-16T18:33:17.864Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-verification-gates.test.ts: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- test scripts/__tests__/fid-gates.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-receipt-tripwire.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Authoring pass: approach reviewed against the three stamp branches
(`existing`/`gates`+`next`/`gates`+EOF) and both hash call sites.
Tail normalization chosen over alternatives: (a) changing `stampReceipt`
EOF branches to not trim — rejected, the stamp output shape is consumed
by humans and the re-stamp path; (b) normalizing in `buildReceipt` only —
rejected, the validator-side post-removal view would still carry the
extra `\n`. One change point covers both sides. RED observed: the new
EOF-identity pin failed against the unfixed implementation (25 pass / 1
fail in the main suite pre-split; 5 pass / 1 fail in the fingerprint
module post-split); the freshness pin (content edits still invalidate)
passed throughout.

### Loop 2 — Independent audit and self-correction

Self-caught during the pin authoring pass: the first str_replace edit
severed the adjacent insert-path pin and the THREE_GATES fixture (restored
immediately, suite re-run 23/0 before proceeding). The ceiling was hit
again — the contract test file grew to 315 lines with the new pins, so the
fingerprint describe was split move-only into
`fid-verification-gates-fingerprint.test.ts` (114 lines) with the original
suite restored to 266 lines (FID-2026-0913-002 discipline). RED was
observed after the split (5/1 in the new module), so the observation is
valid against the split shape.

### Loop 3 — Final convergence

LIVE e2e both legs on the real chain: `fid:verify` (no --write) printed a
receipt for the gates-to-EOF fixture; `fid:verify --write` stamped it
(`[PASS] typecheck cli`, `[PASS] quality`); `fid:verify --check` — single
file AND repo-wide — accepted the EOF-stamped receipt as fresh (the exact
shape that failed before the fix). Fixture destroyed; `--check` still
PASS. Note: `bun run fid:verify <path>` without `--write` does not stamp —
the Task 58 session used `--write` for its stamping legs; recorded here so
the usage is unambiguous.

### Missed Questions

- MQ1: Does tail-normalization weaken freshness? No — content edits
  (including edits to the final line's text) still change the hash; only
  the newline *count* at EOF becomes insignificant, matching the
  stamp's own normalization.
- MQ2: Do archived receipts re-validate? Archived `closed` FIDs are not
  in the `--check` sweep (`activeFidFiles` reads `dev/fids/` only) and
  `validateFidVerification`'s freshness check is section-conditional on
  `fixed|verified` — no retroactive impact on the 304 closed records.

## Resolution

### Implementation Evidence (REQUIRED for `closed`)

- **Fix:** `computeFidFingerprint`
  (`packages/agent-runtime/src/echo/fid-verification-gates.ts`) — the
  hashed view is tail-normalized to exactly one trailing newline on BOTH
  paths (receipt-less and receipt-span-removed) via a local
  `normalizeTail` helper with the FID-2026-0916-003 rationale comment.
  `stampReceipt` and `buildReceipt` are unchanged, per the Approach.
- **Tests:** new module
  `packages/agent-runtime/src/echo/__tests__/fid-verification-gates-fingerprint.test.ts`
  (114 lines) — the four pre-existing fingerprint pins moved verbatim
  (ceiling split, the source file was 291 lines) + the two
  FID-2026-0916-003 pins: EOF stamp-path identity, and freshness
  preserved on final-line content edits. Main contract suite restored to
  266 lines.
- **Commit:** (hash recorded post-commit)

### Code Verification Evidence

- Contract suites: fingerprint module **6 pass / 0 fail**, main contract
  suite **23 pass / 0 fail**, tripwire **5 pass / 0 fail** (34 total).
- Executor suites: fid-verify + fid-gates + vocab **35 pass / 0 fail**.
- typecheck ×4 (agent-runtime, common, cli, sdk) exit 0.
- `quality:report` PASS (1498 files); all touched files under the 300
  ceiling (286 / 114 / 266).
- LIVE e2e (Loop 3): gates-to-EOF fixture stamped via real
  `fid:verify --write` (`[PASS] typecheck cli`, `[PASS] quality`);
  `fid:verify --check` accepted the receipt — single-file AND repo-wide;
  fixture destroyed, `--check` PASS after cleanup.
- RED evidence (Loop 1): EOF pin failed against the unfixed
  implementation; freshness pin passed throughout.
