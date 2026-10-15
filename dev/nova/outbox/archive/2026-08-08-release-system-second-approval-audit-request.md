# Release System — Second Approval Audit Request

**Date:** 2026-08-08
**Status:** AWAITING AUDIT
**Blocking:** Requests a fresh, second-approval sign-off for the cumulative public
release system as it stands after FID-2026-0808-003 (the last audited state). The
previous audit granted pre-push sign-off for the deterministic gates; this request
covers everything added since, so a release may proceed under a fully re-audited
surface.

---

## What changed since the last audited state (FID-2026-0808-003)

1. **Round-3 review residuals closed.**
   - Modern OpenAI project keys (`sk-proj-`) added to the credential redaction and
     scan patterns in `redactSecretText` (`scripts/public-release.ts:263`) — previously
     a false-negative for a daily secret scanner.
   - Unreadable/torn release receipts now **fail closed**: `assertNoUnrestoredPriorRelease`
     (`scripts/public-release.ts:769`) throws on JSON parse failures instead of skipping,
     and cross-version receipt scanning is keyed by `repositoryKey` (legacy receipts without
     the key still count; foreign-repo receipts are isolated).
   - `repositoryKey` is stamped on diagnostic receipts (`buildDiagnosticReceipt`,
     `scripts/public-release.ts:700`) for consistency with release receipts.

2. **Pinned Bun self-bootstrap (new, removes the last daily-friction item).**
   - `pinnedBunCandidates` (`scripts/public-release.ts:326`), `resolvePinnedBun` (`:340`),
     and `ensurePinnedBunOnPath` (`:362`) probe `~/.bun-1.3.14/bin/bun(.exe)` then
     `~/.bun/bin/bun(.exe)`, version-verify each, and prepend the matching bin directory
     to `process.env.PATH` only when the PATH `bun` is not exactly `1.3.14`.
   - Wired into both entry points (`main()` and `runDiagnostic()`) **before** lock
     acquisition; fails closed with install guidance when no `1.3.14` is reachable.
   - Proven: the diagnostic passes with the plain shell PATH (the npm shim `bun` is
     `1.3.11`; all 8 gates still ran under the self-resolved `1.3.14`).

3. **Pre-push credential scan (new surface — never audited before).**
   - `scripts/pre-push-scan.ts` reads the hook stdin ref lines, enumerates the **pushed
     commit range per-commit** (`pushedRangeCommits` `:78`), materializes the exact pushed
     content into a temp mirror (`materializePushedContent` `:133`), and runs the F-A
     `scanStagedCredentials` scanner. Design guarantees:
     - Catches secrets committed **and reverted** inside the range (per-commit scan, not a
       net tip-vs-tip diff) — the blob still lands in remote history.
     - Root commits enumerated via `diff-tree --root` (`commitChangedFiles` `:102`); merge
       commits handled via `-m`; deletion refs (all-zero local sha) skipped, so
       `git push --delete` is never blocked.
     - Strict stdin parsing (`parsePrePushRefs` `:35`): any non-empty malformed ref line
       aborts the scan (fail-closed — a git format change or tampering cannot disable it).
     - Blobs are size-checked up front (`git cat-file -s`); over-2MB blobs are counted as
       oversized rather than failing the push opaquely.
   - `.githooks/pre-push` runs the scan **plus** the existing eslint/markdownlint/prettier
     gates. The scan path resolves via `HOOK_DIR` (absolute) while cwd stays in the pushed
     repository — a cross-repo `core.hooksPath` setup scans the right repo (a real bug found
     and fixed by end-to-end git testing). Missing `bun` now **fails closed** (was `exit 0`).
   - Real-git end-to-end proof: fresh bare remote + local clone → clean push passes the
     scan; a pushed `ghp_`-shaped secret is refused with the file listed.

4. **CLI release command flow (new surface — never audited before).**
   - `cli/src/commands/release/release-runner.ts` + `release-command.ts` expose the release
     operations as a `/release` slash command (interactive TUI, output streamed into the
     chat) and a standalone `savant-code release <op>` subcommand (any shell, exit codes
     0/1/2). Operations: `preview`, `diagnose`, `go`, `resume`, `status`.
   - The CLI **spawns** the canonical `scripts/public-release.ts` engine (never reimplements
     it), inheriting the pinned-Bun self-bootstrap and the cwd-relative gate behavior. The
     engine's mutation boundaries are unchanged: only `go`/`resume` can mutate; `preview`,
     `diagnose`, and `status` are read-only.
   - Wiring: `cli/src/commands/defs/misc.ts:182`, `cli/src/data/slash-commands.ts` (menu +
     free-build removal), `cli/src/commands/command-registry.ts` (parity set), `cli/src/cli-args.ts`
     (help), `cli/src/index.tsx` (dispatch before the headless branch; unknown first-word
     `release …` prompts fall through to the normal prompt path rather than being hijacked).
   - `status` reads `VERSION`, git position/tag, and the newest receipt + diagnostic evidence
     from the OS temp directory.

## Observable evidence

Command run (read-only, no mutation), current HEAD `7cb6184439a45fb781985d2d5acf4c22941c78e9`
and current (dirty) working tree — the exact state the audit is asked to approve:

```text
bun run release:public:diagnose
→ Diagnostic gates passed. Evidence: C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.21-diagnostic.json
```

Receipt highlights (schema `release-receipt/v2`):

```json
{
  "evidenceFinalized": true,
  "failedStage": null,
  "evidenceHeadSha": "7cb6184439a45fb781985d2d5acf4c22941c78e9",
  "gateAttempts": [
    { "label": "build:sdk", "failureClass": "success" },
    { "label": "typecheck", "failureClass": "success" },
    { "label": "test", "failureClass": "success" },
    { "label": "eslint", "failureClass": "success" },
    { "label": "markdownlint", "failureClass": "success" },
    { "label": "prettier", "failureClass": "success" },
    { "label": "npm-pack:@savant-code/sdk", "failureClass": "success" },
    { "label": "npm-pack:savant-code", "failureClass": "success" }
  ]
}
```

Complete redacted transcripts: `C:\Users\spenc\AppData\Local\Temp\savant-public-release-0.0.21-evidence\*.log`
(hashes in the receipt).

Unit suites (no reruns needed for the audit; all ran clean with reruns during development):

```text
NODE_ENV=test bun test scripts/public-release.test.ts scripts/pre-push-scan.test.ts
→ 57 pass / 0 fail

NODE_ENV=production bun test src/__tests__/release-runner.test.ts   (cli)
→ 7 pass / 0 fail

Full CLI suite: 2929 pass / 0 fail / 18 skip  (includes the free/paid command gating-parity tests)
```

Static gates (all exit 0): `bun run typecheck` (all workspaces), eslint
`--max-warnings 0` on all changed scripts + CLI files, `bun run lint:md`,
`bunx prettier --check .` (formatted), `git diff --check`.

## Audit targets (please verify independently)

1. **Pre-push scan threat model.** Confirm a secret committed in an earlier commit and
   pushed later (clean working tree) is caught; a secret committed and reverted inside the
   pushed range is caught; root commits are scanned; deletion pushes never block; malformed
   stdin and missing `bun` fail closed; the hook scans the pushed repository, not the hook's
   own repo, under a cross-repo `core.hooksPath`.
2. **Pinned-Bun bootstrap integrity.** Confirm PATH mutation is limited to prepending the
   verified pinned bin directory, the version gate is exactly `1.3.14`, no recursion or
   masked version errors are possible, and the gate manifest hash/resume validation is
   unaffected by the prepend.
3. **CLI release flow preserves the engine's guarantees.** Confirm the CLI only spawns
   `scripts/public-release.ts` (no reimplementation), `preview`/`diagnose`/`status` remain
   non-mutating through the CLI surface, exit codes are 0/1/2, and prompt-hijack fall-through
   does not disable the release command.
4. **Cumulative mutation boundary.** Confirm no tag, push, GitHub release, npm publish, or
   credential mutation occurred during this audit period, and that the fresh diagnostic
   evidence is bound to the current HEAD + tracked worktree state.
5. **Whether prior approvals (FID-2026-0808-001/002/003) may be considered extended to the
   cumulative state** for operator-approved release execution.

## Notes

- The working tree is intentionally dirty: all items above are uncommitted changes plus
  untracked new files (`scripts/pre-push-scan.ts`, `scripts/pre-push-scan.test.ts`,
  `scripts/process-tree.integration.test.ts`, `cli/src/commands/release/`,
  `cli/src/__tests__/release-runner.test.ts`). An automation-mode release would sweep them
  into the release commit — that is the operator's call, not a script mutation.
- `dev/nova/specs/echo-v0.1.2-single-agent.md` moved to `dev/echo-v0.1.2-single-agent.md`
  (uncommitted working-tree change, noted in the FID-003 request).
- Untracked research artifacts (`docs/design/Savant Ecosystem Project Research.md`, the
  `dev/nova/outbox/2026-08-09-*` docs) are exempted in `.markdownlintignore` per the repo's
  dated-artifact precedent and do not affect gate evidence.
- `@savant-code/sdk` has never been published to npm (registry 404 as of this audit); the
  next `go` release would be its first publication — explicitly staged by the SDK-first
  package order in the gate manifest.
