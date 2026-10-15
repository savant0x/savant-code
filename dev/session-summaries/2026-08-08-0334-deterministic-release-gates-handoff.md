<!-- markdownlint-disable MD013 -->

# Session Summary: 2026-08-08 03:34

**Session ID:** 2026-08-08-0334-deterministic-release-gates-handoff
**Duration:** Start time not captured — 2026-08-08 03:34 -0400
**Status:** completed-with-open-blockers

---

## Initial State

### Environment

- **OS:** Windows development workstation (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; npm; Git
- **Branch:** `main`
- **Last commit:** `7cb6184439a45fb781985d2d5acf4c22941c78e9`
- **Observed runtime:** Bun `1.3.11`, npm `10.9.2`
- **Pinned release contract:** Bun `1.3.14`, npm `10.x`
- **Public release target:** `0.0.21`

### Known Issues

- FID-2026-0808-003 was created to remediate contradictory release-gate observations and insufficient receipt evidence.
- The previous release receipt was generic and lacked structured command attempts, transcript references, failure classes, and evidence integrity.
- Public release execution remains intentionally blocked. No live push or publication was attempted in this session.

### Dependencies

- `scripts/public-release.ts` is the release transaction runner.
- `scripts/public-release.test.ts` contains the focused release-contract tests.
- `docs/public-release.md` documents the supported release and diagnostic commands.
- `package.json` exposes `release:public:diagnose`.
- `ECHO.md`, `protocol.config.yaml`, `ARCHITECTURE.md`, TypeScript standards, and `dev/LEARNINGS.md` were read before implementation work.

---

## Planned Work

1. [x] Re-read the governing ECHO contract and inspect the current FID, runner, tests, package scripts, and release documentation.
2. [x] Complete RED → GREEN → AUDIT → ADVERSARIAL convergence against the actual implementation.
3. [x] Implement structured gate diagnostics, transcript handling, receipt/resume checks, timeout classification, lock fencing, and diagnostic worktree protection.
4. [x] Add focused regression coverage and run formatting, lint, typecheck, and tests.
5. [x] Write this handoff for the next session.
6. [ ] Obtain fresh independent/Nova audit after the remaining process-cleanup boundary is resolved.
7. [ ] Do not run public release mutation until the pinned Bun/runtime and audit blockers are resolved.

---

## Work Completed

### Task 1: Deterministic gate evidence

- **Status:** implemented; pending final AUDIT/ADVERSARIAL closure
- **FID:** `FID-2026-0808-003`
- **Changes made:**
  - `scripts/public-release.ts`
    - Added structured command result classification: success, exit, signal, spawn-error, timeout, evidence-error, and malformed.
    - Added file-backed stdout/stderr capture for gate commands.
    - Added secret-redacted external transcripts with SHA-256 hashes and atomic temporary-file replacement.
    - Added bounded receipt summaries while preserving complete transcript paths/hashes outside the repository.
    - Added receipt schema `release-receipt/v2` and current-HEAD/manifest/runtime binding.
    - Added resume rejection for missing, tampered, incomplete, or mismatched transcript evidence.
    - Added explicit `transcriptFinalized` gating so evidence failure cannot authorize a successful gate.
    - Added timeout classification and Windows `taskkill /T /F` cleanup with root-process probing; cleanup failures are retained as structured evidence instead of replacing the original timeout.
    - Added process ownership locks with PID, host, timestamp, version, mode, receipt/transcript paths, and random owner-token fencing.
    - Added recursive worktree fingerprinting for tracked, ignored, directory, missing, and symlink entries.
    - Added read-only diagnostic failure receipt persistence so diagnostic exceptions are recorded rather than silently losing evidence.
  - `package.json`
    - Added `release:public:diagnose`.
  - `docs/public-release.md`
    - Documented the diagnostic command, receipt v2, transcript behavior, runtime prerequisites, and no-auto-retry policy.

### Task 2: Focused regression coverage

- **Status:** completed for pure/contract-level coverage; entrypoint/process-tree integration remains open
- **File:** `scripts/public-release.test.ts`
- **Coverage added/retained:**
  - Changelog extraction and reverse-chronological validation.
  - Version alignment and public package ordering.
  - Automation opt-in and env-only GitHub token handling.
  - Token-safe Git extraheader construction.
  - GitHub REST status/error handling.
  - npm not-found classification.
  - Exit/signal/spawn/timeout/malformed result classification.
  - Fail-closed credential-shaped redaction.
  - Pinned Bun/npm compatibility contract.
  - Deterministic gate manifest hashing.
  - Receipt redaction.
  - Explicit evidence HEAD binding.
  - Transcript hash mismatch and missing-transcript resume rejection.
  - Automation commit/recovery behavior.
  - Local settings/environment restoration after simulated failure.
  - No public mutation was invoked by the test suite.

---

## Perfection Loop Summary

| Loop | Target | RED | GREEN | AUDIT | ADVERSARIAL / Delta |
|------|--------|-----|-------|-------|---------------------|
| 1 | FID-2026-0808-003 release-gate evidence | Contradictory test observations; generic receipt; no structured transcript | Universal structured gate layer, no automatic retry, atomic evidence, lock and resume policy | Initial review found missing transcript/HEAD/lock/diagnostic safeguards | Self-corrected: transcript-finalization gating, diagnostic failure receipts, ignored/symlink fingerprinting, owner-token lock fencing, timeout evidence retention |
| 2 | Final safety pass | Timeout cleanup and lock/PID reuse concerns | Added cleanup classification/probing, owner metadata validation, owner-token fencing, transcript tamper tests | 24 focused tests and static checks pass | **NEEDS-REVIEW:** Windows descendant cleanup is not independently proven; real diagnostic/lock/process integration tests remain absent. Do not close FID yet. |

### Missed questions resolved

- A later passing retry must not erase a prior failing gate; all attempts remain evidence and no automatic retry is allowed.
- A receipt with a missing or tampered transcript is never resumable.
- A transcript redaction/persistence failure is an evidence failure, not a successful gate.
- Diagnostic failures must still produce a sanitized failure receipt when possible.
- Ignored directories and symlinks must not crash worktree fingerprinting.
- A stale lock may only be recovered after owner metadata, process liveness, and owner-token checks.
- The release process must remain fail-closed when the runtime does not meet the pinned Bun contract.

---

## Validation Results

- [x] `NODE_ENV=test bun test scripts/public-release.test.ts`: **PASS — 24 tests, 0 failures**.
- [x] `bunx prettier --write` on changed source/docs: **PASS — exit 0**.
- [x] `bun x eslint scripts/public-release.ts scripts/public-release.test.ts --max-warnings 0`: **PASS — exit 0**.
- [x] `bun run typecheck`: **PASS — exit 0**.
- [x] `git diff --check`: **PASS — exit 0**.
- [x] Conflict-marker scan over changed files: **PASS — 0 files**.
- [ ] `bun run release:public:diagnose`: **NOT RUN**. It requires Bun `1.3.14`; this workstation currently reports Bun `1.3.11`. No release or diagnostic mutation was attempted.
- [ ] Full public release transaction: **NOT RUN by deliberate decision**.

### Runtime evidence

```text
Bun: 1.3.11
npm: 10.9.2
Pinned Bun contract: 1.3.14
```

The Bun mismatch is a release/toolchain blocker, not a reason to weaken the contract.

---

## Issues Discovered / Remaining Blockers

### Issue 1: Windows descendant cleanup needs independent proof

- **Severity:** critical
- **FID:** FID-2026-0808-003
- **Status:** open / NEEDS-REVIEW
- **Evidence:** the implementation invokes `taskkill /PID /T /F` and probes the root PID, but no independent integration test proves that every owned descendant has exited before lock release. The next session must either add a tested process-tree/Job Object strategy or explicitly revise the FID contract to the strongest verifiable platform behavior.

### Issue 2: Release/diagnostic integration coverage is incomplete

- **Severity:** high
- **FID:** FID-2026-0808-003
- **Status:** open / NEEDS-REVIEW
- **Evidence:** the focused suite covers pure contract and receipt/resume behavior, but does not execute the real diagnostic entrypoint, lock contention/recovery, timeout cleanup, failed diagnostic receipt path, or no-mutation boundary end-to-end.

### Issue 3: Pinned Bun runtime is not installed

- **Severity:** critical for release execution
- **FID:** FID-2026-0808-003
- **Status:** open / environmental blocker
- **Evidence:** observed Bun `1.3.11`; project requires Bun `1.3.14`. Upgrade/activate the pinned runtime before running the diagnostic or release gates. Do not alter the project contract solely to accommodate this workstation.

### Issue 4: FID bookkeeping is intentionally unfinished

- **Severity:** critical
- **FID:** FID-2026-0808-003
- **Status:** remains `analyzed`
- **Evidence:** the FID still has pending AUDIT/ADVERSARIAL/Resolution fields. It must not be marked closed or archived tonight.

---

## Final State

### Code Changes

- **Files modified:** 4 tracked files plus 1 new FID:
  - `scripts/public-release.ts`
  - `scripts/public-release.test.ts`
  - `package.json`
  - `docs/public-release.md`
  - `dev/fids/FID-2026-0808-003-deterministic-release-gates-and-failure-recovery.md`
- **Diff evidence at handoff:** `1,012 insertions, 42 deletions` across the 4 tracked implementation/docs files. The FID is untracked/new and excluded from that diff stat.
- **No merge conflicts:** changed-file conflict-marker scan returned `0`.
- **No new commit:** current `HEAD` remains `7cb6184439a45fb781985d2d5acf4c22941c78e9`.

### Git Status at handoff

```text
 M docs/public-release.md
 M package.json
 M scripts/public-release.test.ts
 M scripts/public-release.ts
?? dev/fids/FID-2026-0808-003-deterministic-release-gates-and-failure-recovery.md
```

This is an intentional working state. Do not reset or discard it without reviewing the FID and diff first.

### Public mutation boundary

No commands were run that created a tag, pushed to GitHub, created a GitHub release, published npm packages, committed changes, or changed durable personal settings through the release workflow. The existing receipt at `/tmp/savant-public-release-0.0.21.json` was inspected only; no diagnostic receipt was created because the diagnostic entrypoint was not run.

---

## Open Questions for Tomorrow

1. Should Windows cleanup be upgraded to a Job Object/explicit descendant enumeration, or should the FID state the narrower verified guarantee around `taskkill` plus root-process probing?
2. What is the project-approved way to activate Bun `1.3.14` on this workstation without changing package contracts?
3. Should integration tests spawn a fixture child process, or should the runner expose dependency-injected process/lock seams to avoid OS-dependent tests?
4. Should diagnostic evidence use a temporary isolated worktree to guarantee no ignored/generated artifact mutation, rather than hashing the current worktree?
5. Does Nova require the real diagnostic command to run after the Bun upgrade before granting final sign-off?

---

## Lessons Learned

- Stop at the circuit breaker instead of repeatedly retrying a critical release gate without new evidence.
- A green unit suite is not proof of an untested process-tree or public-mutation boundary; label those claims NEEDS-REVIEW.
- Preserve the original timeout and transcript even when cleanup fails; replacing it with a generic spawn error destroys the most useful evidence.
- Receipt integrity is part of release safety: transcript path, finalization state, and content hash must agree before resume.
- PID liveness alone is not enough for lock recovery; validate owner identity and fence cleanup with an owner token.
- Directory and symlink entries need explicit fingerprint semantics; treating every ignored path as a regular file is unsafe.
- The release workflow is intentionally not live tonight. The safest outcome is to resume from this documented state tomorrow.

---

## Next Session

### Priority Tasks

1. [ ] Read this handoff and `dev/fids/FID-2026-0808-003-deterministic-release-gates-and-failure-recovery.md` before touching code.
2. [ ] Upgrade/activate Bun `1.3.14`, then rerun the focused tests and static gates.
3. [ ] Resolve the Windows descendant-cleanup contract with an independently testable strategy.
4. [ ] Add or design integration seams/tests for diagnostic failure receipts, lock contention/recovery, timeout cleanup, symlink fingerprinting, and the no-mutation boundary.
5. [ ] Run the read-only diagnostic command only after the above review: `bun run release:public:diagnose`.
6. [ ] Re-run independent AUDIT and ADVERSARIAL reviews, update FID-003 with exact citations, and obtain Nova sign-off.
7. [ ] Only after fresh approval and all gates pass, decide separately whether to resume the public release.

### Blockers

- Bun `1.3.14` is not active; current runtime is `1.3.11`.
- Windows descendant cleanup is not independently proven.
- Real release/diagnostic integration coverage is incomplete.
- FID-003 must remain open; parent release approvals remain suspended.

### Notes for Next Agent

- Do **not** run `bun run release:public`, `bun run release:public:resume`, `gh`, `git push`, `git tag`, `gh release`, `npm publish`, or any equivalent public mutation as the first action.
- Do **not** discard the five current working-tree files. They contain the implementation and the complete FID handoff context.
- The existing `/tmp/savant-public-release-0.0.21.json` is legacy/previous evidence and is not a substitute for a fresh diagnostic receipt.
- The absence of `/tmp/savant-public-release-0.0.21-diagnostic.json` is expected because diagnostic mode was intentionally not run under the mismatched Bun runtime.
- Keep the public release fail-closed. Good stopping point; continue with evidence, not urgency.
