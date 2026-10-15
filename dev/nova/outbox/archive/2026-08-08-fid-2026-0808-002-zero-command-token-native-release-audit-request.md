<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0808-002 Zero-Command Token-Native Release Automation

**Date:** 2026-08-08
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/FID-2026-0808-002-zero-command-token-native-release.md`
**Parent FID:** `dev/fids/FID-2026-0808-001-reversible-public-release-pipeline.md`
**Review type:** Post-implementation AUDIT + ADVERSARIAL safety review
**Priority:** Critical — sign-off required before any public mutation
**Reply to:** `dev/nova/inbox/2026-08-08-fid-2026-0808-002-zero-command-token-native-release-audit-response.md`

---

## Boundary

This is a strictly read-only audit. Do not edit source, FIDs, CHANGELOG, package metadata,
Git state, settings, GitHub, npm, credentials, or release artifacts. Do not enable or run
`SAVANT_CODE_RELEASE_AUTOMATION=1`. Do not run the real release command, create commits or
tags, push branches or tags, call mutating GitHub endpoints, create a GitHub release, or
publish packages.

The implementation is intentionally not authorized for public execution until Nova returns
an explicit sign-off. If a required external check is unavailable, mark it `NEEDS-REVIEW`;
do not infer a PASS.

---

## Implementation Under Review

Review these files together:

- `scripts/public-release.ts`
- `scripts/public-release.test.ts`
- `docs/public-release.md`
- `dev/fids/FID-2026-0808-002-zero-command-token-native-release.md`

The intended contract is:

- Automation is opt-in only through `SAVANT_CODE_RELEASE_AUTOMATION=1`.
- GitHub authentication uses `GITHUB_TOKEN`, falling back to `GH_TOKEN`.
- Automation uses GitHub REST directly and does not require the `gh` executable.
- Git push uses a process-only extraheader; the token must not appear in argv, URLs,
  tracked files, logs, or receipts.
- Automation stages and commits all tracked and untracked worktree changes by explicit
  operator policy, after local state is snapshotted and before tagging/pushing.
- Manual mode remains interactive and retains its stricter clean-worktree/`gh` behavior.
- Preview mode remains mutation-free.
- Local settings and release-profile environment are restored through the production
  `finally` path.
- Resume is bound to the current release mode and HEAD; a crash after commit creation but
  before receipt persistence may recover only an exact single release commit with the
  expected parent, clean worktree, and expected subject.

---

## Fresh Verification Evidence

The implementation pass reports:

- Focused suite: **16 tests / 52 assertions / 0 failures**.
- Bun build of `scripts/public-release.ts`: exit 0.
- ESLint on changed implementation/tests: exit 0 with `--max-warnings 0`.
- Prettier on changed implementation/tests/docs/FID: exit 0.
- Markdownlint on changed docs/FID: exit 0.
- `git diff --check`: exit 0.
- Read-only `bun run release:public:preview`: exit 0.
- Preview extracted exactly: `## v0.0.21 — 2026-08-06`.
- No public release, push, tag, GitHub release, npm publication, or real automation run
  was executed during implementation validation.

Please independently reproduce or inspect these claims. The focused tests use temporary
Git fixtures and mocked fetch implementations; they do not contact GitHub or npm.

---

## Required Source-Cited Checks

Provide exact `path:line` evidence for every verdict.

### 1. Automation and transport

- Does the automation flag opt in explicitly and leave manual mode unchanged?
- Does automation avoid all runtime `gh` dependencies for auth, GitHub release lookup,
  creation, tag dereferencing, and post-release verification?
- Is the GitHub token read only from `GITHUB_TOKEN`/`GH_TOKEN` and absent from command
  argv, URLs, receipts, logs, and tracked files?
- Does the Git extraheader configuration avoid leaking the raw token while still allowing
  noninteractive push?

### 2. Worktree and commit policy

- Does automation intentionally include all tracked and untracked changes?
- Is local state snapshotted before profile mutation and before the automation commit?
- Is the generated commit prevented from being pushed until all local gates pass?
- Is an empty worktree rejected rather than silently creating an unintended commit?
- Is the recorded file list accurate for additions, deletions, and renames?

### 3. Resume and crash recovery

- Does resume reject a wrong version, wrong mode, un-restored receipt, invalid SHA,
  duplicate stage, or unknown stage?
- Does resume fail closed when HEAD changes unexpectedly?
- Does the narrow commit-recovery path accept only the expected single release commit and
  recompute release preflight against the recovered HEAD?
- Can a partial GitHub/npm failure resume without duplicating already-completed stages?

### 4. API and failure handling

- Does the REST adapter use the required headers, timeout, explicit status allowlists, and
  sanitized errors?
- Are 401/403/429/5xx, malformed JSON, and timeout failures fail-closed?
- Is only an explicit allowed 404 treated as absence?
- Does release creation use the exact extracted current CHANGELOG section?

### 5. Restoration and preview

- Does the production transaction restore settings and environment on success and failure,
  including failures after the automation commit?
- Does preview avoid staging, committing, tag creation, push, mutating API calls, npm
  publication, and durable settings mutation?
- Are receipt writes non-secret and safe after failures?

### 6. Tests and documentation

- Do the tests substantively cover the claims listed in the FID rather than only helper
  functions?
- Are the documentation and FID accurate about what is tested versus merely implemented?
- Is the FID correctly left AUDIT/ADVERSARIAL-pending until this response?

---

## Required Response

Reply using this exact structure:

```markdown
# Nova Audit Response — FID-2026-0808-002

**Date:** YYYY-MM-DD
**FID:** FID-2026-0808-002
**Verdict:** PASS | FAIL | PASS WITH BLOCKERS | NEEDS-REVIEW
**Pre-push sign-off:** GRANTED | WITHHELD

## Findings

| Severity | Finding | Evidence (`path:line`) | Verdict |
|---|---|---|---|
| ... | ... | ... | ... |

Write `None found` if no critical/high findings remain.

## Verification Summary

State the independently verified tests, build/lint checks, preview result, and any checks
that could not be performed.

## Mutation Boundary Confirmation

Confirm whether any commit, tag, push, GitHub release, npm publication, credential
mutation, settings mutation, or automation-mode release occurred during the audit.
Expected: none observed.

## Final Sign-Off

State exactly one:

- `PRE-PUSH SIGN-OFF: GRANTED — FID-2026-0808-002 is safe for operator-approved execution.`
- `PRE-PUSH SIGN-OFF: WITHHELD — corrective work is required before any push or publication.`
```

*Audit request written for FID-2026-0808-002. No public mutation performed.*
