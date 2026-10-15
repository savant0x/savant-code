<!-- markdownlint-disable MD013 -->

# FID: Zero-Command Token-Native Public Release Automation

**Filename:** `FID-2026-0808-002-zero-command-token-native-release.md`
**ID:** FID-2026-0808-002
**Severity:** high
**Status:** closed (2026-08-09 — Nova audit PASS with pre-push sign-off GRANTED; operator-directed close)
**Created:** 2026-08-08
**YAGNI-Compliance:** Pending

---

## Summary

Amend FID-2026-0808-001 so public releases can run without the operator installing `gh`, logging in interactively, or typing release commands. The automation consumes the already-configured `GITHUB_TOKEN` or `GH_TOKEN`, uses GitHub's HTTPS API directly, performs a token-safe Git push, and supports an explicit noninteractive automation mode. Per operator decision, automation stages and commits all current repository changes before tagging and pushing.

This FID changes release transport and worktree policy only. It does not authorize execution during implementation or testing.

## Operator Decision

- **GitHub authentication:** use `GITHUB_TOKEN`, falling back to `GH_TOKEN`; never print or persist the value.
- **Dirty worktree:** in automation mode, stage and commit all tracked and untracked changes. The generated commit is the release HEAD.
- **Automation activation:** require an explicit `SAVANT_CODE_RELEASE_AUTOMATION=1` flag. Manual mode remains interactive and keeps its stricter safety posture.
- **npm authentication:** use npm's existing environment/configuration (`NODE_AUTH_TOKEN`, `NPM_TOKEN`, or configured npm credential helper) without copying credentials into release state.

## Requirements

1. Remove the runtime dependency on the `gh` executable for GitHub auth, release existence, tag verification, release creation, and post-release verification.
2. Add a GitHub REST adapter using native `fetch()` with:
   - `Authorization: Bearer <token>`;
   - `Accept: application/vnd.github+json`;
   - pinned API version header;
   - bounded request timeout;
   - fail-closed status handling;
   - no token in errors, receipts, or logs.
3. Add token-safe Git push using a temporary process-only credential configuration or Git credential helper; the token must not appear in argv, remote URLs, tracked files, or logs.
4. In automation mode, stage all changes and create one deterministic release commit before resolving/tagging release HEAD. Refuse an empty commit unless the requested version has not already been released and the policy explicitly permits it.
5. Make automation noninteractive and idempotent:
   - existing matching tag/release/package stages are verified and marked complete;
   - mismatched tag/release targets fail closed;
   - partial failure writes a receipt and can resume without duplicate publication.
6. Preserve `finally` restoration for local settings and environment.
7. Retain manual mode as the default unless the explicit automation flag is present.
8. Ensure preview mode remains mutation-free, including no commit, staging, token API call that mutates state, tag, push, release, or npm publication.

## Stage Contract

```text
PREFLIGHT
→ SNAPSHOT_LOCAL_STATE
→ AUTOMATION_COMMIT_ALL (automation only)
→ VERIFY_VERSION_AND_CHANGELOG
→ BUILD_AND_TEST
→ PACKAGE_DRY_RUN
→ AUTH_TOKEN_CHECK
→ ANNOTATED_TAG
→ TOKEN_SAFE_GIT_PUSH
→ GITHUB_RELEASE_API
→ NPM_PUBLISH_SDK
→ NPM_PUBLISH_CLI
→ POST_RELEASE_VERIFY
→ RESTORE_LOCAL_STATE
→ RECEIPT
```

## Security Invariants

- A missing token fails before public mutation.
- HTTP 401/403/429/5xx and malformed API responses fail closed; only explicit 404 means absent.
- Tokens are never passed as command-line arguments or embedded in URLs.
- GitHub API errors are sanitized before they reach `failedStage` or stdout.
- Auto-commit includes all files by operator decision, but the receipt records the exact commit and file list for auditability.
- The generated commit is not pushed until all local gates pass.
- Restoration is attempted on every path after snapshot creation, including failed commit, build, push, API, or npm stages.

## Verification

- Pure tests for automation-mode detection and stage planning.
- Mocked fetch tests for auth headers, explicit 404 absence, fail-closed 403/429 handling, and token redaction; the implementation also fail-closes 401/5xx and timeout failures through the same adapter path.
- Mocked command tests proving token absence from Git argv and logs.
- Git fixture test proving automation stages all changes and creates one release commit.
- Resume tests for matching and mismatched commit/tag/release receipts.
- Preview test proving no staging or commit occurs.
- Existing release test suite, Bun build, ESLint, Prettier, Markdownlint, and diff check.
- No real GitHub, Git push, npm publish, or settings mutation during tests.

## Resolution

### GREEN — implemented

- `scripts/public-release.ts` now supports explicit `SAVANT_CODE_RELEASE_AUTOMATION=1` mode.
- Automation consumes `GITHUB_TOKEN`, falling back to `GH_TOKEN`; the `gh` executable is not required on that path.
- GitHub authentication, release existence checks, release creation, tag dereferencing, and post-release verification use the native REST adapter with pinned headers, timeout, explicit status allowlists, and sanitized failures.
- Git push receives a process-only Git extraheader through environment configuration; the token is not passed in argv, URLs, tracked files, receipts, or logs. The receipt file list is derived from the staged NUL-delimited Git name list.
- Automation snapshots local state before the all-files commit, creates one `chore(release): prepare v<version>` commit, records its HEAD and file list, and restores settings/environment through the production `finally` wrapper.
- Manual mode remains the default interactive `gh` path; preview remains mutation-free and does not invoke automation commit or mutating API operations.

### Evidence

- `scripts/public-release.test.ts`: 17 tests, 55 assertions pass after the automation additions, mode-binding hardening, commit-recovery guard, and npm not-found regression fix.
- Coverage includes token fallback/flag detection, REST headers and fail-closed 403/429 handling, explicit 404 absence, npm 404-format detection, basic/bearer credential redaction, token-safe Git environment construction, all-files Git fixture commit, recovery of a release commit created before receipt persistence, resume validation, restoration after simulated failure, and real changelog extraction.
- Bun build, ESLint, Prettier, and focused tests are the required local gates; no real GitHub, Git push, npm publish, or release execution is performed by the implementation tests.

### AUDIT / ADVERSARIAL

Nova audit response (`dev/nova/inbox/2026-08-08-fid-2026-0808-002-zero-command-token-native-release-audit-response.md`)
2026-08-08: **PASS** — all 7 claim areas verified with file:line evidence (automation opt-in,
token-not-in-argv, extraheader security, empty-worktree rejection, finally restoration, REST
adapter, test coverage 16 tests/52 assertions). **PRE-PUSH SIGN-OFF: GRANTED.**

Closed + archived 2026-08-09 per operator direction; the second-approval sign-off also extended
FID-001/002/003 approvals to the cumulative state.
