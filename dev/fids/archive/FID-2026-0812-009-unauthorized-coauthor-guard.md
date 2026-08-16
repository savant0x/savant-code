# FID: Unauthorized Co-author Commit Guard

**Filename:** `FID-2026-0812-009-unauthorized-coauthor-guard.md`
**ID:** FID-2026-0812-009
**Severity:** medium
**Status:** closed
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified

---

## Summary

A prior commit accidentally included
`Co-authored-by: CommandCodeBot <noreply@commandcode.ai>`, causing GitHub to
 display a competing CLI coding agent as a repository contributor. The repository
history was rewritten and pushed to remove the existing attribution. A local
`commit-msg` hook is required to prevent that exact unauthorized identity from
being reintroduced in future commits.

## Environment

- **OS:** Windows workstation using Git Bash; hook must remain POSIX-shell compatible
- **Language/Runtime:** Bash hook; Git commit-msg lifecycle
- **Tool Versions:** Git with `core.hooksPath=.githooks`; Bun 1.3.14 repository
- **Commit/State:** Rewritten `main` at
  `7f867ea05f29b2924cd0cf160405b93259b3bdeb`

## Detailed Description

### Problem

GitHub parses `Co-authored-by` trailers as contributor attribution. The exact
unauthorized trailer was previously present in two reachable commits and can be
reintroduced by an agent, editor, or manually generated commit message.

### Expected Behavior

A commit containing a case-insensitive `Co-authored-by` trailer naming
`CommandCodeBot` or the `commandcode.ai` domain is rejected before Git creates
the commit. Ordinary commit messages, commits without co-author trailers, and
unrelated legitimate co-authors remain allowed.

### Root Cause

The repository had a pre-push hook but no commit-message policy hook. A pre-push
check is too late for preventing local creation of an unwanted attribution and
does not provide immediate feedback at commit time.

### Evidence

```text
Historical exact trailer removed from two commits:
Co-authored-by: CommandCodeBot <noreply@commandcode.ai>

Current local HEAD and origin/main: 7f867ea05f29b2924cd0cf160405b93259b3bdeb
Current reachable exact-trailer count: 0
```

## Impact Assessment

### Affected Components

- `.githooks/commit-msg`
- `package.json` hook wiring via existing `prepare` script
- `CONTRIBUTING.md` hook documentation

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Add a POSIX-compatible `.githooks/commit-msg` hook using the commit message file
supplied by Git. It rejects only trailer lines that match `CommandCodeBot` or
`commandcode.ai`, case-insensitively, and prints a remediation message. Keep the
existing `prepare` hook-path wiring. Document that hooks are local safeguards and
can be bypassed with `--no-verify`; no remote server-side enforcement is claimed.

### Steps

1. Add `.githooks/commit-msg` with an anchored, case-insensitive deny rule.
2. Document the hook and its bypass boundary in `CONTRIBUTING.md`.
3. Test blocked exact/variant trailers, allowed ordinary messages, and hook wiring.
4. Run formatting, shell smoke tests, FID ledger, and an independent implementation
   review.

### Verification

- Invoke the hook against temporary messages containing the exact trailer and a
  case variant; both must exit non-zero.
- Invoke it against an ordinary message and an unrelated co-author; both must exit
  zero.
- Confirm `git config --get core.hooksPath` resolves to `.githooks`.
- Confirm reachable Git history still contains zero blocked trailers.

## Perfection Loop

### Loop 1 — RED

- **RED:** Existing `.githooks/pre-push` and root `prepare` wiring were found; no
  `.githooks/commit-msg` existed. The historical attribution was confirmed removed
  from current `main`.
- **GREEN:** Added executable `.githooks/commit-msg:1-27`, using an anchored
  case-insensitive trailer check for `CommandCodeBot` or `commandcode.ai`.
  Documented the local guard boundary in `CONTRIBUTING.md:56-61`.
- **AUDIT:** `bash -n .githooks/commit-msg` passed. Six smoke assertions passed:
  ordinary message accepted, exact trailer rejected, case variant rejected,
  unrelated co-author accepted, blocked domain rejected, and missing message-file
  rejected with exit 2. `core.hooksPath=.githooks`, `git diff --check`, and
  reachable-history blocked-trailer scan all passed. Prettier passed for
  `CONTRIBUTING.md` and this FID; the FID ledger test passed 5/5.
- **ADVERSARIAL:** The deny rule is intentionally limited to the known unauthorized
  identity/domain and does not reject unrelated legitimate co-authors.
  Documentation states that local hooks can be bypassed with `--no-verify`; CI or
  server-side enforcement remains a separate future boundary.
- **CHANGE DELTA:** Minimal implementation: one hook, one documentation paragraph,
  and one FID.

### Missed Questions

1. **Should all co-authors be rejected?** → No. Only the identified unauthorized
   identity/domain is blocked to avoid harming legitimate collaboration.
2. **Does the hook provide repository-wide enforcement?** → No. It is a local guard;
   bypasses and commits created elsewhere require a server-side/CI policy if stronger
   enforcement is needed.
3. **Will the hook alter existing commits?** → No. It only validates the message file
   before a new commit is created.

### Code Verification Evidence

- [x] `.githooks/commit-msg:1-27` exists and is executable (`755`)
- [x] Implementation matches the Proposed Solution; the deny rule is anchored to
      `Co-authored-by` trailers and matches `CommandCodeBot` / `commandcode.ai`
      case-insensitively
- [x] Blocked and allowed-message smoke tests pass: `SMOKE_PASS=6 SMOKE_FAIL=0`
- [x] Hook path remains wired through `package.json:45` `prepare`; runtime check
      returned `core.hooksPath=.githooks`
- [x] Current reachable history has zero blocked trailers
- [x] `bash -n .githooks/commit-msg`, `git diff --check`, Prettier, and
      `bun test scripts/fid-ledger.test.ts` pass (5/5)

### Loop 2 — Independent audit and self-correction

- **RED:** Review focus was limited to false positives, Windows Git Bash portability,
  hook-path wiring, and the explicit `--no-verify` boundary.
- **GREEN:** Added a readable-file requirement at `.githooks/commit-msg:15` after
  review identified a possible fail-open path for unreadable message files. The hook
  otherwise uses POSIX Bash already established by `.githooks/pre-push`, avoids
  runtime/package dependencies, and allows unrelated co-authors.
- **AUDIT:** First independent review identified and closed the unreadable-file
  fail-open issue. Final post-correction review PASS confirmed status-aware grep
  handling, Windows Git Bash portability, narrow deny scope, and conservative
  documentation. Direct smoke evidence is recorded above.
- **ADVERSARIAL:** A local hook cannot stop commits created in another clone or
  bypassed with `--no-verify`; the implementation makes that limitation explicit
  rather than overstating protection.
- **CHANGE DELTA:** No further implementation change.

### Loop 3 — Final convergence

- **RED:** No unresolved implementation risk identified for the requested local guard.
- **GREEN:** Hook, documentation, and verification evidence are complete.
- **AUDIT:** Final post-correction review PASS confirmed the implementation is ready
  for archival.
- **ADVERSARIAL:** The exact prohibited identity/domain is covered without imposing a
  blanket co-author ban; local bypass and remote-enforcement limits are documented.
- **CHANGE DELTA:** No further change.

## Resolution

- **Closed Date:** 2026-08-13
- **Fix Description:** Added `.githooks/commit-msg` to reject unauthorized
  CommandCodeBot/commandcode.ai co-author trailers, fail closed when Git supplies
  no readable message file, and documented the local enforcement boundary.
- **Tests Added:** No — deterministic shell smoke tests are sufficient for this
  small hook; six assertions passed.
- **Verification Evidence:** `bash -n` pass; hook smoke `6/0`;
  `core.hooksPath=.githooks`; reachable-history scan zero; `git diff --check` pass;
  Prettier pass; FID ledger `5 pass / 0 fail`; final independent review PASS.
- **Archived:** Yes — moved to `dev/fids/archive/` on 2026-08-13.

## Lessons Learned

A contributor attribution trailer is part of the Git commit identity surface, not
merely prose. Validate sensitive attribution at commit creation time, and treat
local hooks as defense-in-depth rather than a substitute for CI or server-side
policy.
