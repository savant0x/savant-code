# Session Summary: 2026-10-15 13:39

**Session ID:** 2026-10-15-reproducible-clean-linux-build
**Duration:** 2026-10-15 13:39 — 2026-10-15 15:29
**Status:** active

---

## Initial State

### Environment

- **OS:** Windows host; target environment is a clean Linux machine
- **Language/Runtime:** TypeScript monorepo; Bun `1.3.14`
- **Branch:** `main`, tracking `origin/main`
- **Last Commit:** `7b19c81f` — `docs(fids): archive completed class lanes (FID-2026-1012-022)`

### Known Issues

- The repository has a dependency lockfile and root Bun version declarations;
  `.bun-version` is present at `1.3.14` and is also read by repository validation
  and release tooling.
- No root Dockerfile or Docker context policy exists.
- The bundle-backup utility contains a workstation-specific default destination.
- The current scope register described normal pushes to `main` as release-only;
  the operator clarified that normal pushes may be made when explicitly requested.
- The repository contains pre-existing staged and untracked work. This pass must
  use path-scoped staging and must not absorb those changes.
- The aggregate test run exposed a Windows sandbox-workspace cleanup race; the
  cleanup path now retries removal after child-process shutdown.
- The first authorized push was refused by the preserved credential scan because
  historical provider documentation used an environment-variable placeholder in
  a bearer-header example. The scanner now recognizes that placeholder form.

### Dependencies

- `bun.lock` is tracked and the root scripts provide `bun run ci` and
  `bun run test`.
- `.env.example` is tracked and `.env.*` is ignored except for the template.
- `.githooks/pre-push` remains required for attribution scanning and verification.

---

## Planned Work

1. [implemented] Confirmed `.bun-version` at `1.3.14`; added the Dockerfile and
   Docker ignore rules.
2. [implemented] Documented clean-Linux setup, build, test, local run, and Docker
   run commands.
3. [implemented] Removed the active workstation path default and machine-specific
   active examples.
4. [implemented] Repaired and verified the sandbox cleanup race found by the
   aggregate test gate.
5. [implemented] Verified repository state, lockfile install contract, build,
   workspace tests, Docker build/run, path scans, and pre-push hook preservation.
6. [implemented] Created commits `9d55f7ae` and `914597e5`; push
   `main` to `origin/main` after the pre-push gates pass.

---

## Work Completed

### Task 1: Reproducible clean-Linux project workflow

- **Status:** implemented; remote push pending pre-push gates
- **FIDs Created:** None; the change is infrastructure/documentation work without a new API.
- **Changes Made:** Added the reproducibility files and documentation, removed
  active workstation-specific paths, and hardened sandbox workspace cleanup.
- **Verification:** `bun run ci`, `bun run typecheck`, ESLint, Markdownlint,
  Prettier, repository validation, protocol-bundle check, FID receipt check,
  governance smoke, all workspace test commands, Docker build, and container
  CLI version run passed. The aggregate `bun run test` invocation is not captured
  by the shell runner because it terminates the long-lived child before returning
  an exit code; each constituent workspace test command passed independently.

---

## Issues Discovered

### Issue 1: Runtime pin consistency

- **Severity:** medium
- **FID:** None
- **Status:** resolved by the existing `.bun-version` plus the pinned Docker base image; `bun --version` reported `1.3.14`

### Issue 2: Workstation-specific bundle destination

- **Severity:** medium
- **FID:** None
- **Status:** resolved by `.git-bundles` plus `SAVANT_BUNDLE_DIR` override; targeted bundle tests pass

### Issue 3: Sandbox workspace cleanup race

- **Severity:** medium
- **FID:** None
- **Status:** resolved by retrying temporary workspace removal after child exit; targeted and full workspace tests pass

### Issue 4: Credential-scan placeholder false positive

- **Severity:** medium
- **FID:** None
- **Status:** resolved by distinguishing uppercase environment-variable
  placeholders from bearer token values; the focused credential-scan suite passes

---

## Validation Results

- [implemented] `bun run ci`: PASS
- [blocked] `bun run test`: the aggregate shell invocation is terminated by the
  command runner before it returns; all workspace test commands pass independently
- [implemented] `bun run typecheck`: PASS
- [implemented] `bun x eslint . --max-warnings 0`: PASS
- [implemented] `bun run lint:md`: PASS
- [implemented] `bun x prettier --check .`: PASS
- [implemented] `bun run validate:repository`: PASS
- [implemented] `docker build --tag savant-code:local .`: PASS
- [implemented] `docker run --rm savant-code:local bun run --cwd=cli src/index.tsx --version`: PASS (`0.0.36`)
- [implemented] `bun test scripts/public-release-credential-scan.test.ts`: PASS (3 tests)

---

## Final State

### Code Changes

- **Files Modified:** 14 committed files
- **Lines Added:** 306
- **Lines Removed:** 38
- **Net Change:** +268

### Git Status

- **Branch:** `main`
- **Uncommitted Changes:** yes; pre-existing work plus this session's changes
- **New Commits:** `9d55f7ae` — `chore(reproducibility): add clean Linux
  build workflow`; `914597e5` — `docs(session): record reproducibility verification`

---

## Open Questions

- Remote branch-protection settings are not controlled by repository files. Normal
  `git push origin main` remains subject to the remote service's own policy.

---

## Next Session

### Priority Tasks

1. [implemented] Reproducibility implementation and local commit.
2. [blocked] Remote push is waiting on the pre-push hook's remaining gates after
   its credential false positive was corrected.

### Blockers

- The aggregate root test invocation is blocked by the shell runner terminating
  the long-lived child process before it returns an exit code. The constituent
  workspace test commands provide the recorded test evidence. The first push
  attempt also exposed and then received a fix for the historical placeholder
  false positive in the credential scan.

### Notes for Next Agent

- Keep `.githooks/pre-push` intact. It remains the attribution and verification
  boundary for pushes.
- Stage only the paths belonging to this reproducibility pass.
