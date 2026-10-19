# Parallel acceptance readiness — FID-2026-1017-012

## Trigger

Operator instruction: "do all of it w/echo compliance", covering the four
readiness items presented after the graph-refresh repair.

## Delivered

1. **Root-guard hardening.** `resolveGitTopLevel` retries the
   `git rev-parse --show-toplevel` call once only when the process could not run
   (`status: null`). A reported different root and any non-zero status still
   fail closed. `safeHostRoot` is exported with an optional runner so the
   behaviour is pinned without spawning. Five cases are covered: matching root,
   transient retry, two spawn failures, different root, non-zero status.
2. **A–Z instrument corrections.** §2 now requires an empty baseline (the merge
   gate counts untracked files) and documents the force-add needed because
   `/dev` is gitignored; §5.2 expects the tool-schema refusal that actually
   fires; §5.4 notes the mixed-separator `record.path`; §5.17c accepts the
   dispose recovery warning when `removed` is true; §9 restores the stashed
   blueprint afterwards.
3. **Lint gate unblocked.** `.markdownlintignore` exempts
   `dev/test-prompts/*-yt-script.md`, a paste-ready draft of the same class the
   config already exempts, so `bun run lint:md` exits 0 and the pre-push hook
   can run.
4. **Lane prepped.** `savant/FID-2026-1017-008` deleted (was `3d24daf9`,
   contained in main, so nothing is lost); the untracked blueprint stashed with
   SHA-256 `bf6075224adee1f51f82d601e0145082dd3ae2f8057f8f081f370b35ac9a91a9`,
   restored with `git stash pop` after the run.

## Verification

- `fid:verify --write` → 5/5 gates exit 0: agent-runtime typecheck, tool suite
  7/7, provision suite 5/5, real-git lane probe, quality.
- `bun x eslint . --max-warnings 0` → exit 0.
- `bun run lint:md` → exit 0.
- `bun run validate:repository` → PASS.

Implementation commit: `4f989510`.

## State for the re-run

- Working tree clean; one stash holding the blueprint.
- `git worktree list` shows only the primary checkout; no lane directories.
- `fid_worktree create` for FID-2026-1017-008 will now be able to provision
  from the current `main`, because the stale branch is gone.

## Remaining, not claimed

The operator-driven A–Z re-run has not happened. FID-2026-1017-008 stays
`converged` and claims no acceptance until that run is clean; closure follows
the run's evidence.
