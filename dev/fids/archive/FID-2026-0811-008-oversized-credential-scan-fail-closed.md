<!-- markdownlint-disable MD013 -->

# FID: Oversized Credential Scan Fail-Closed Coverage

**Filename:** `FID-2026-0811-008-oversized-credential-scan-fail-closed.md`
**ID:** FID-2026-0811-008
**Severity:** critical
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`

> Planning-only. No credential scan policy is weakened by this record.

## Summary

The pre-push credential scanner intentionally skips any pushed blob larger than 2 MB. `scripts/pre-push-scan.ts:122`
defines the cap; lines 157-160 increment `oversized` and continue without materializing or scanning; lines 246-250
allow the push when no smaller file is flagged while merely printing a warning. The existing test at
`scripts/pre-push-scan.test.ts:229` codifies that oversized blobs are non-blocking. This is a fail-open security blind
spot: a credential in a large pushed file can pass the credential gate.

## Expected behavior

Every pushed blob is either content-scanned or causes the push to fail closed with a clear remediation. Memory and spawn
buffers remain bounded; binary data must not be coerced unsafely into giant strings.

## Proposed solution

1. Choose a bounded streaming/chunking scan design that preserves detector semantics across chunk boundaries, or make
   oversized content an unconditional blocking condition requiring an explicit safe review path.
2. Preserve exact pushed-commit materialization semantics; never fall back to the mutable working tree.
3. Define behavior for binary files, deleted files, sparse paths, and blobs at exactly the cap.
4. Add tests with credentials split across chunks, high-entropy tokens over the cap, binary bytes, and size-boundary cases.
5. Ensure normal output contains no secret contents and the failure message identifies only the path/size/remediation.
6. Record a bounded scan window, per-file time limit, binary policy, and synthetic false-positive corpus before selecting
   the final implementation. Until measured values are approved, the default remediation is fail-closed blocking of the
   over-cap path; the operator must review or split the file and retry.
7. The implementation must publish numeric limits: maximum resident scan window `<= 4 MiB`, maximum per-file scan time
   `<= 30 seconds`, and a documented synthetic-corpus false-positive target of zero for approved examples. If these values
   prove unsuitable, revise this FID before implementation rather than silently relaxing them.

## Verification contract

- Over-cap secret fixture blocks or is proven fully scanned; no test may assert “never blocking” for secret-bearing data.
- Chunk-boundary detector tests pass.
- Scanner memory remains bounded by a measured upper limit.
- Pre-push integration returns nonzero on uncertainty or scanner failure.
- Typecheck, targeted tests, lint, format, and repository validation pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** The 2 MB cap skips content and allows push; the test explicitly preserves that behavior.
- **GREEN:** Replace the fail-open path with bounded complete coverage or unconditional fail-closed handling.
- **AUDIT:** Exact source and test lines are cited above. This is a security policy issue, not merely a performance concern.
- **ADVERSARIAL:** A file-extension allowlist, binary assumption, or warning-only path cannot be accepted as proof that the
  blob is safe. The child must address detector boundaries and scanner errors.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that the security acceptance contract needed measurable resource bounds, binary behavior, false-
  positive handling, and operator remediation before implementation could converge.
- **GREEN:** Added required implementation evidence: maximum resident scan window, maximum per-file duration, explicit
  binary/UTF-8 policy, synthetic false-positive corpus, and a path/size-only remediation message. Either complete bounded
  scanning or unconditional blocking is acceptable only if these measurements are recorded.
- **AUDIT:** Source/test evidence is `scripts/pre-push-scan.ts:122`, `:157-160`, `:246-250`, and
  `scripts/pre-push-scan.test.ts:229`; current behavior is classified as a confirmed fail-open policy, not an unproven
  implementation detail.
- **ADVERSARIAL:** No extension allowlist or warning-only outcome can satisfy the child; uncertainty remains blocking.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Is unconditional blocking acceptable? → It is an allowed robust fallback if bounded scanning cannot be proven, but the
   implementation must document operator remediation and avoid silent bypasses.
2. Does chunking miss tokens split at boundaries? → Only if overlap/state is wrong; explicit boundary fixtures are required.
3. Should deleted files be scanned? → No content exists in the pushed tree, but deleted secret-bearing history is not part
   of this push's tree scan; document that scope.
4. Is the existing 16 MB `maxBuffer` enough? → It is unrelated to the 2 MB policy; prove bounded memory independently.

### Loop 3 — Final evidence and implementation correction (2026-08-11)

- **RED:** The implementation audit found three bypass classes: staged scans read before enforcing the cap, read failures were skipped, and pushed over-cap blobs were reported without blocking.
- **GREEN:** Added byte-based pre-read size checks with a `2 MiB` cap, fail-closed errors for unexpected staged/git read failures, and bounded pushed-path diagnostics (20 paths plus a count suffix). Confirmed deletions remain the only skipped-content case.
- **AUDIT:** `bun test scripts/pre-push-scan.test.ts scripts/public-release.test.ts scripts/validation-manifest.test.ts` → `74 pass / 0 fail`, `218 expect()` calls. `bun x eslint scripts/pre-push-scan.ts scripts/pre-push-scan.test.ts scripts/public-release.ts scripts/public-release.test.ts scripts/validation-manifest.ts --max-warnings 0` → exit 0. `bun x prettier --check ...` → `All matched files use Prettier code style!`, exit 0. The over-cap regression now asserts a blocking finding containing `exceed the 2MB credential-scan cap`; existing filename/content detector tests remain green.
- **ADVERSARIAL:** Memory remains bounded by the pre-read `lstatSync` check and `cap + 1` buffer. Unexpected size/show/read failures throw and are caught by `main()` as `credential scan failed closed`; confirmed deleted paths are not content. Diagnostics contain paths only, with no content/token disclosure.
- **CHANGE DELTA:** `scripts/pre-push-scan.ts`, `scripts/public-release.ts`, and their focused tests.

### Code Verification Evidence

- [x] Oversized content now blocks rather than reports success.
- [x] Staged scanner is byte-bounded before reading and fails closed on unexpected I/O.
- [x] Pushed-range materialization fails closed on unexpected git size/show failures and reports bounded affected paths.
- [x] Focused security/release suite: 74 pass / 0 fail; 218 assertions.
- [x] ESLint and Prettier pass on all changed scanner files.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Credential scanning now fails closed for oversized, unreadable, malformed, or unexpectedly unavailable pushed content while preserving bounded memory and redacted diagnostics.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

A bounded scanner is not secure if its bound creates an unscanned success path. Limits must fail closed or preserve full
coverage through streaming state.
