<!-- markdownlint-disable MD013 -->

# Nova Pre-Push Audit Request — FID-2026-0808-001 Public Release Pipeline

**Date:** 2026-08-08
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FID:** `FID-2026-0808-001-reversible-public-release-pipeline.md`
**Priority:** Critical — required independent sign-off before any commit, push, GitHub release, or npm publication
**Review type:** Post-implementation, pre-push safety audit
**Reply to:** `dev/nova/inbox/` using the matching filename with `-response` substituted for `-request`

---

## Review Boundary

This is a read-only audit request. Do not modify source files, the FID, the CHANGELOG, package metadata, Git state, user settings, GitHub, npm, or any release artifact. Do not run the real release command, create a tag, push a branch or tag, create a GitHub release, publish to npm, or alter credentials.

The requested sign-off is a gate for the operator's later release decision. A Nova **PASS** means only that the reviewed implementation is safe to consider for an operator-approved release run; it is not authorization to execute that run automatically.

The current repository is still in active development. The working tree contains unrelated in-progress changes, `gh` is unavailable on this workstation, and no public release mutation was executed while implementing this FID. The FID must remain `implemented` and unarchived until the operator performs a separate approved release execution and the resulting public artifacts are independently verified.

---

## Required Reading

Read each item from 0–EOF where applicable, then verify the claims against the current working tree rather than relying on this request's summary:

1. `dev/fids/FID-2026-0808-001-reversible-public-release-pipeline.md`
2. `scripts/public-release.ts`
3. `scripts/public-release.test.ts`
4. `docs/public-release.md`
5. `package.json`
6. `CHANGELOG.md`
7. `VERSION`
8. `sdk/package.json`
9. `cli/release/package.json`
10. `savant-free/package.json`
11. `cli/scripts/build-binary.ts`
12. `cli/src/pre-init/load-dev-env.ts`
13. `cli/src/utils/settings.ts`
14. `sdk/scripts/publish.ts`
15. `dev/fids/README.md`
16. `ECHO-single-agent.md`
17. `dev/nova/README.md`

Use fresh source evidence with exact `path:line` citations. If a claim cannot be reproduced, mark it `NEEDS-REVIEW` instead of inferring success.

---

## Operator Safety Invariants to Verify

### 1. Public scope is exact

Confirm that the implementation can target only:

- `@savant-code/sdk` from `sdk/`
- `savant-code` from `cli/release/`

Confirm that `savant-free` is excluded from the release plan and cannot be published as a side effect. Check that the expected public repository is `savant0x/savant-code` and that the verified remote policy cannot silently redirect a push through a configured push URL.

### 2. Preview mode is mutation-free

Verify that `release:public:preview` and the corresponding `--preview` path do not:

- change process or persisted settings;
- create commits, tags, or release receipts in tracked source;
- invoke `git push`, `gh release`, or `npm publish`;
- contact GitHub or npm in a way that mutates state.

Confirm that missing tools or credentials in preview mode are reported as validation results, not treated as consent or silently ignored.

### 3. Mutation mode requires explicit consent

Verify that normal mutation mode refuses noninteractive execution and requires one explicit confirmation after the preflight checks. The confirmation must identify the exact version, `HEAD`/commit, branch, tag, verified repository/remote, GitHub release target, and both npm package targets.

Confirm that a failed, empty, or unexpected confirmation cannot proceed.

### 4. Settings and environment restoration is reliable

Verify that the workflow snapshots only the necessary non-secret routing/settings state, applies the OpenRouter/free public profile, and restores the original state in a `finally`/cleanup path after success or failure at every post-snapshot stage.

Confirm that API keys, GitHub tokens, npm tokens, and other credentials are never copied into the profile, receipt, logs, CHANGELOG, or public artifacts. Check that restoration failures are surfaced as a non-zero failure requiring operator attention.

### 5. Version and changelog gates are strict

Verify that the workflow requires aligned version metadata, the current version is `0.0.21`, and the current `CHANGELOG.md` section is present exactly once and is reverse-chronological. Confirm that the extracted release body corresponds to the intended current-version section and cannot silently fall back to an unrelated version.

Check that FID-2026-0808-001's bookkeeping is honest: implementation is recorded, but public release execution is not claimed as complete.

### 6. Resume behavior is safe

Review partial-release receipts and resume behavior. Confirm that resume:

- binds to the original `HEAD` commit and expected version/tag;
- verifies the tag target, including annotated-tag dereferencing;
- validates both fetch and push remote URLs;
- requires the expected restoration/precondition state;
- rechecks npm identity/access for unfinished package stages;
- never republishes an already-published package merely because a previous command failed after publication;
- never deletes a GitHub release or unpublishes npm packages automatically.

Identify any path where a changed checkout, moved tag, wrong remote, ambiguous registry response, or missing receipt could cause the workflow to publish the wrong source.

### 7. Fail-closed external checks

Audit GitHub and npm existence/access checks for ambiguous failures. Network failures, authentication failures, DNS errors, rate limits, and malformed responses must abort rather than being interpreted as “not found” or “not published.” Only explicit absence responses may permit a new release/publication.

Verify that post-release checks bind the GitHub release/tag to the expected commit and inspect the published registry package metadata and required contents, not only the local package directory.

### 8. Stage ordering and package order

Verify the intended transaction order:

```text
PREFLIGHT
→ SNAPSHOT_LOCAL_STATE
→ APPLY_PUBLIC_PROFILE
→ VERSION/CHANGELOG/GATES
→ PACKAGE_DRY_RUN
→ EXPLICIT_CONFIRMATION
→ ANNOTATED_TAG
→ GIT_PUSH
→ GITHUB_RELEASE
→ NPM_PUBLISH_SDK
→ NPM_PUBLISH_CLI
→ POST_RELEASE_VERIFY
→ RESTORE_LOCAL_STATE
→ RECEIPT
```

Confirm that the SDK publishes before the CLI, that a GitHub release is not created before the branch/tag push, and that no public mutation happens before confirmation and all required preflight checks.

### 9. Test and documentation evidence

Independently verify the focused contract tests and their scope. Confirm that tests cover profile/restoration behavior, changelog validation, target exclusion, stage ordering, resume safety, secret redaction, and preview non-mutation. Distinguish tests that use mocks/static planning from tests that prove real external behavior.

Check that `docs/public-release.md`, `package.json`, `dev/fids/README.md`, and `CHANGELOG.md` describe the implemented workflow without claiming that this release has already been pushed or published.

---

## Required Nova Response Format

Reply with a source-cited verdict using this structure:

```markdown
# Nova Audit Response — FID-2026-0808-001

**Date:** YYYY-MM-DD
**FID:** FID-2026-0808-001
**Verdict:** PASS | FAIL | PASS WITH BLOCKERS | NEEDS-REVIEW
**Pre-push sign-off:** GRANTED | WITHHELD

## Executive Finding

One concise paragraph stating whether the implementation is safe to take to an operator-approved public release run.

## Claim Audit

| Area | Verdict | Evidence (`path:line`) | Finding |
|---|---|---|---|
| Public package scope | PASS/FAIL | ... | ... |
| Preview non-mutation | PASS/FAIL | ... | ... |
| Confirmation gate | PASS/FAIL | ... | ... |
| Snapshot/restoration | PASS/FAIL | ... | ... |
| Version/changelog gates | PASS/FAIL | ... | ... |
| Resume binding | PASS/FAIL | ... | ... |
| Fail-closed external checks | PASS/FAIL | ... | ... |
| Stage/package ordering | PASS/FAIL | ... | ... |
| Published artifact verification | PASS/FAIL | ... | ... |
| FID/docs bookkeeping | PASS/FAIL | ... | ... |

## Blocking Findings

For every blocker, include severity, exact citation, observed behavior, and the minimum corrective action. If there are no blockers, write `None found`.

## Non-Blocking Findings

List residual risks or recommended follow-ups separately from release blockers.

## Mutation Boundary Confirmation

Explicitly confirm whether Nova observed any commit, tag, push, GitHub release, npm publication, credential mutation, or durable settings mutation during this audit. The expected answer for this request is **none observed**.

## Final Sign-Off

State exactly one of:

- `PRE-PUSH SIGN-OFF: GRANTED — implementation is safe to present for operator-approved release execution.`
- `PRE-PUSH SIGN-OFF: WITHHELD — corrective work is required before any push or publication.`
```

A PASS must not omit unresolved high-severity concerns. Any uncertainty about remote identity, credentials, restoration, resume binding, package scope, or external lookup semantics is a blocker or `NEEDS-REVIEW`, not an implicit pass.

---

*Request written 2026-08-08 for independent Nova sign-off before the public release pipeline is allowed to proceed.*
