# Session Summary: 2026-10-15 13:39

**Session ID:** 2026-10-15-reproducible-clean-linux-build
**Duration:** 2026-10-15 13:39 — 2026-10-15 15:29
**Status:** complete

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
6. [implemented] Created commits `9d55f7ae`, `914597e5`, `6f78a176`, and
   `0d744a78`; pushed `main` to `origin/main` after the pre-push gates passed.

---

## Work Completed

### Task 1: Reproducible clean-Linux project workflow

- **Status:** implemented; pushed to `origin/main`
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
- [implemented] `bun run test`: the required pre-push test gate passed; the
  aggregate shell invocation does not return output through this shell runner,
  while all workspace test commands pass independently
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
- **Uncommitted Changes:** yes; pre-existing work only
- **New Commits:** `9d55f7ae` — `chore(reproducibility): add clean Linux
  build workflow`; `914597e5` — `docs(session): record reproducibility
  verification`; `6f78a176` — `fix(release): allow documented credential
  placeholders`; `0d744a78` — `docs(session): fix verification summary
  formatting`
- **Remote:** `origin/main` matches `HEAD` at `0d744a78`

---

## Open Questions

- Remote branch-protection settings are not controlled by repository files. Normal
  `git push origin main` remains subject to the remote service's own policy.

---

## Next Session

### Priority Tasks

1. [implemented] Reproducibility implementation and local commit.
2. [implemented] Pre-push credential, quality, typecheck, and test gates passed;
   `main` is synchronized with `origin/main`.

### Blockers

- None for this reproducibility pass. The shell runner does not return the
  aggregate test process's output directly, but the required pre-push test gate
  completed successfully and the constituent workspace test commands passed.

### Notes for Next Agent

- Keep `.githooks/pre-push` intact. It remains the attribution and verification
  boundary for pushes.
- Stage only the paths belonging to this reproducibility pass.
