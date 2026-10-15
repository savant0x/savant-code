<!-- markdownlint-disable MD013 -->

# Session Handoff: Public Release Complete

**Session ID:** 2026-08-08-1500-public-release-complete-handoff
**Date:** 2026-08-08
**Status:** completed; release verified; ready for next session

---

## Executive Summary

The Savant Code public release workflow completed successfully end-to-end for
`v0.0.21`. The CLI package was published, the GitHub tag/release was created,
and the release transaction restored the operator's personal settings and
runtime state. The SDK was intentionally excluded from publication because it
is not yet part of the public npm release.

The final release cleanup was committed and pushed as:

```text
06db643 fix(release): finalize successful receipt state
```

The repository is currently clean and synchronized with `origin/main`.

---

## Verified Final State

### Git

- **Branch:** `main`
- **HEAD:** `06db643ae2fbb935d36865989225f35319baea5e`
- **Remote:** `origin/main` points to the same commit
- **Worktree:** clean
- **Last commit:** `fix(release): finalize successful receipt state`

### Public release

- **Version:** `0.0.21`
- **Git tag:** `v0.0.21`
- **GitHub release:** created and verified
- **npm CLI:** `savant-code@0.0.21` published and verified
- **SDK:** `@savant-code/sdk` intentionally not published
- **Release scope:** CLI-only via `SAVANT_CODE_RELEASE_PACKAGES=savant-code`

### Release receipt

Authoritative receipt:

```text
C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.21.json
```

Verified receipt properties:

- `schemaVersion`: `release-receipt/v2`
- `restored`: `true`
- `failedStage`: absent/cleared
- `POST_RELEASE_VERIFY`: completed
- Completed stages include authentication, automation commit, preflight,
  public profile, gates/package dry runs, tag, Git push, GitHub release, npm
  CLI publication, and post-release verification.

The original npm propagation failure was later resolved through the explicit
resume flow. The stale failure text was removed from the final receipt, and
future successful resumes now clear `failedStage` before writing the terminal
receipt.

### Operator settings

The release's temporary public profile was removed successfully. The personal
setup was restored and verified as:

- **Mode:** `HYBRID`
- **Model:** `tokenharbor/deepseek-v4-flash:free`
- **Direct provider:** `opencode-go`

No personal credentials or settings should be reset as part of starting the
next session.

---

## Work Completed This Session

- Confirmed the full release succeeded after resolving the test-environment
  issue that caused production-profile tests to use the real config directory.
- Verified the CLI-only npm scope behaved correctly; the SDK remained
  unpublished as intended.
- Cleared stale `failedStage` metadata from the successful release receipt.
- Added regression coverage for successful receipt finalization.
- Updated `docs/public-release.md` to document scoped CLI-only releases,
  prerequisites, and the next-release checklist.
- Removed stale release test/build evidence from the OS temp directory while
  preserving the authoritative `0.0.21` receipt, diagnostic receipt, and
  evidence directory.
- Pushed the cleanup commit through the pre-push credential scan and hard lint
  gates.

---

## Validation Evidence

All relevant validation completed successfully:

- Release contract tests: **47 pass / 0 fail**
- Full CLI suite: **2,929 pass / 0 fail; 18 skipped**
- Typechecks: pass
- ESLint with zero warnings: pass
- Markdownlint: pass
- Prettier and `git diff --check`: pass
- Pre-push credential scan: pass
- Final local/remote synchronization: pass

The release diagnostic and transaction evidence remain outside the repository
under the operating-system temp directory by design.

---

## Important Files

- `scripts/public-release.ts` — release transaction, gates, receipt, resume,
  redaction, and package-scope behavior
- `scripts/public-release.test.ts` — release contract and receipt tests
- `docs/public-release.md` — operator-facing CLI release flow and safety rules
- `package.json` — release commands, including `release:public:diagnose`
- `dev/fids/FID-2026-0808-003-deterministic-release-gates-and-failure-recovery.md`
  — deterministic release-gate FID and audit evidence
- `dev/session-summaries/2026-08-08-1345-deterministic-release-gates-converged.md`
  — historical diagnostic convergence summary
- `dev/session-summaries/2026-08-08-0334-deterministic-release-gates-handoff.md`
  — earlier historical handoff; its blocked status predates the completed
  release and should not be treated as current state

---

## Next Session: Safe Starting Procedure

1. Read this handoff first.
2. Confirm the repository is clean and `main` matches `origin/main`.
3. Do not rerun `release:public`, `release:public:resume`, `git push`, `git
   tag`, `gh release`, or `npm publish` unless a new release is explicitly
   approved.
4. For the next release, update `VERSION`, package versions, and the matching
   top `CHANGELOG.md` entry before running gates.
5. Run the read-only diagnostic first:

   ```bash
   bun run release:public:diagnose
   ```

6. For the currently supported CLI-only publication flow:

   ```bash
   SAVANT_CODE_RELEASE_PACKAGES=savant-code \
   SAVANT_CODE_RELEASE_AUTOMATION=1 \
   bun run release:public
   ```

7. Review the receipt and diagnostic evidence before any resume or public
   mutation. Never bypass the pre-push credential scan except for a deliberate,
   documented emergency.

The default package scope still supports the SDK + CLI release contract, but
SDK publication should remain deferred until the operator explicitly decides
that the SDK is ready for npm.

---

## No Current Blockers

There are no known release blockers for the completed `v0.0.21` publication.
The next release is a separate approval decision and must not be inferred from
this completed release.

The only normal next-release preparation items are version/changelog updates,
read-only diagnostic validation, and an explicit decision about whether the SDK
should remain excluded.
