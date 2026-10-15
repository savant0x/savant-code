# FID-2026-0808-003 — Final Audit Request

**Date:** 2026-08-08
**Status:** AWAITING AUDIT
**Blocking:** FID-2026-0808-001 and FID-2026-0808-002 approvals remain suspended until this
audit grants fresh sign-off.

---

## What changed since the previous audit state

1. **Pinned runtime activated.** Bun `1.3.14` installed out-of-band at
   `C:\Users\spenc\.bun-1.3.14\bin\bun.exe` via the official `install.ps1` with
   `-Version 1.3.14 -NoPathUpdate -NoCompletions -NoRegisterInstallation`. The previous
   `1.3.11` runtime is untouched. The release contract still fails closed on any runtime that is
   not exactly `1.3.14` (`scripts/public-release.ts:299` `validateToolVersions`).

2. **Worktree fingerprint contract narrowed and made path-explicit.**
   - Before: hashed ALL tracked + ignored content (including a 7.9 GB `resources/` dir and
     `node_modules`); the `test` gate legitimately creates gitignored `cli/debug/output.txt`
     (`cli/src/utils/logger.ts:180`), so the diagnostic could never pass and failed with a
     generic message.
   - After: `fingerprintWorktree` (`scripts/public-release.ts:2052`) hashes tracked files and
     porcelain status of untracked non-ignored paths; ignored-path deltas are recorded as
     `ignoredChanges` evidence (`ignoredPathDelta`, `:2109`) instead of blocking; failures now
     list the exact changed paths (bounded to 50, `runDiagnostic` `:2168`).
   - The concurrency protection proved itself: a concurrent process created an untracked
     research doc during a diagnostic run and the run was rejected with the precise path.

3. **Two latent bugs found and fixed (ADVERSARIAL findings).** Double-escaped regexes shipped by
   the previous session: `\\b` in the old process-tree probe and `\\d` in
   `acquireReleaseLock`'s owner `startedAt` validation (`scripts/public-release.ts:1486`). Both
   matched literal backslashes — the probe never detected survivors and stale-lock recovery
   could never succeed. Fixed; byte-level scan confirms no other double-escaped regexes.

4. **Windows descendant cleanup upgraded and independently proven.**
   `enumerateProcessTree` (`:693`) walks the Win32 process table (`processTableRows`, `:653`);
   `terminateOwnedProcessTree` (`:726`) kills the owned tree with `taskkill /T /F` and verifies
   every enumerated owned PID is gone; stragglers are killed only when a fresh table read
   confirms they are still parented inside the owned tree (`killableOwnedSurvivors`, `:767`),
   so a PID reused by an unrelated process is never terminated. Proven by
   `scripts/process-tree.integration.test.ts` (real 3-descendant tree, 2.6 s, all PIDs verified
   gone).

5. **New seam exports + tests.** `acquireReleaseLock`, `buildDiagnosticReceipt`,
   `fingerprintWorktree`, `changedWorktreePaths`, `ignoredPathDelta`, `enumerateProcessTree`,
   `terminateOwnedProcessTree` are exported for testing. Unit suite: `32 pass / 0 fail`.

## Final observable evidence

Command run (read-only, no mutation):

```text
bun run release:public:diagnose   # under Bun 1.3.14, PATH leading to the 1.3.14 bin
→ Diagnostic gates passed. Evidence: C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.21-diagnostic.json
```

Receipt highlights (schema `release-receipt/v2`):

```json
{
  "evidenceFinalized": true,
  "failedStage": null,
  "evidenceHeadSha": "7cb6184439a45fb781985d2d5acf4c22941c78e9",
  "gateManifestHash": "02178ed5b0332e699cfa6b5851f01e351bf6084e217ed9b320a9bc48b97619cb",
  "ignoredChanges": { "added": [], "removed": [] },
  "gateAttempts": [
    { "label": "build:sdk", "failureClass": "success", "durationMs": 8539 },
    { "label": "typecheck", "failureClass": "success", "durationMs": 39670 },
    { "label": "test", "failureClass": "success", "durationMs": 55185 },
    { "label": "eslint", "failureClass": "success", "durationMs": 12226 },
    { "label": "markdownlint", "failureClass": "success", "durationMs": 3884 },
    { "label": "prettier", "failureClass": "success", "durationMs": 16508 },
    { "label": "npm-pack:@savant-code/sdk", "failureClass": "success", "durationMs": 15245 },
    { "label": "npm-pack:savant-code", "failureClass": "success", "durationMs": 861 }
  ]
}
```

Complete redacted transcripts: `C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.21-evidence\*.log`
(hashes in the receipt).

Static gates (all exit 0): `bun run typecheck` (all workspaces), eslint `--max-warnings 0` on the
three scripts, `bun run lint:md`, `bunx prettier --check .`, `git diff --check`.

Runtime: `NODE_ENV=test bun test scripts/public-release.test.ts` → `32 pass / 0 fail`; Windows
integration `NODE_ENV=test bun test scripts/process-tree.integration.test.ts` → `1 pass / 0 fail`.

## Audit targets (please verify independently)

1. The original contradiction (`37 fail / 9 errors` under the release subprocess vs. exit 0) is
   now classified: the full canonical manifest passes under the pinned runtime. Confirm the
   receipt/transcripts support this and that no public mutation occurred (no tag, push, GitHub
   release, npm publish).
2. The tracked-state fingerprint + `ignoredChanges` contract matches FID edge case 7, and the
   fail-closed behavior on tracked changes is preserved.
3. The stale-lock recovery, owner-token fencing, and process-tree termination satisfy FID edge
   cases 21–24 without risking unrelated processes.
4. No-mutation boundary of `--diagnose` (manifest contains only build/typecheck/test/lint/format/
   `npm pack --dry-run`).
5. Whether FID-001/002 approvals may be restored.

## Notes

- `dev/nova/specs/echo-v0.1.2-single-agent.md` was moved to `dev/echo-v0.1.2-single-agent.md`
  during the session (working-tree change, no commit). It does not affect gate evidence but will
  be committed by any future automation-mode release unless restored.
- `docs/design/Savant Ecosystem Project Research.md` (untracked, concurrent deep-research
  artifact) was exempted in `.markdownlintignore` per the repo's dated-artifact precedent.
