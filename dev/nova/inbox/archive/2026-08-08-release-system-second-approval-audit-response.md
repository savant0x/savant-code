# Nova Audit Response — Release System Second Approval

**Date:** 2026-08-08
**Request:** `dev/nova/outbox/2026-08-08-release-system-second-approval-audit-request.md`
**Scope:** Cumulative public release system — FID-2026-0808-001/002/003 approvals plus the
post-003 additions (round-3 residuals, pinned-Bun self-bootstrap, pre-push credential scan,
CLI release command flow).
**Verdict:** PASS
**Pre-push sign-off:** GRANTED

---

## Executive Finding

The cumulative release system is sound and its new surfaces preserve the audited guarantees.
The pre-push credential scan correctly models the leak threat (per-commit pushed-range
scanning catches secrets that a net-tip-vs-tip diff would miss), the pinned-Bun bootstrap is
PATH-local, version-gated, and manifest-hash-neutral, and the CLI release flow is spawn-only —
it cannot reimplement or weaken the engine's fail-closed transaction. Fresh read-only
diagnostic evidence at the exact audited HEAD (`7cb6184`) passes all 8 gates. No public
mutation occurred during this audit period. Prior approvals are extended to the cumulative
state with three documented operational caveats.

---

## Audit Target 1 — Pre-push credential scan threat model

| Claim | Verdict | Evidence | Finding |
|-------|---------|----------|---------|
| Secret committed earlier, pushed later (clean worktree) is caught | PASS | `scripts/pre-push-scan.ts:78` `pushedRangeCommits` enumerates `remote..local` per-commit; `:133` `materializePushedContent` reads blob content via `git show` from the **commits**, never the worktree | Materializes exactly what the remote would receive |
| Secret committed **and reverted** inside the range is caught | PASS | `:78` per-commit `rev-list` (oldest-first), `:102` `commitChangedFiles` — a per-commit scan, not a net diff | Blob still lands in remote history; scan sees commit A's blob |
| Root commits scanned | PASS | `:102` uses `diff-tree -m --root -r` | `--root` enumerates the no-parent commit's full tree (regression-tested) |
| Merge commits handled | PASS | `:102` `-m` diffs both parents; results deduped via `Set` | No double-count, no miss |
| Deletion pushes never block | PASS | `:187` skips refs whose `localSha` matches `/^0{40,64}$/i` | `git push --delete` pushes zero content |
| Malformed stdin fails closed | PASS | `:35` `parsePrePushRefs` throws on any non-empty malformed line (strict 4-field + 40/64-hex shas) | Git format change or tampering cannot disable the scan |
| Missing `bun` fails closed | PASS | `.githooks/pre-push` — `command -v bun` failure exits 1 with guidance | Replaces the previous fail-open `exit 0` |
| Cross-repo `core.hooksPath` scans the pushed repo | PASS | `.githooks/pre-push` — script path resolved via `HOOK_DIR` (absolute), `PUSH_ROOT="$(pwd)"` preserved for the scan cwd | Real bug found + fixed by real-git e2e |
| Over-cap blobs bounded, not opaque failures | PASS | `:133` size pre-check via `git cat-file -s`; `>2MB` counted `oversized`, surfaced in the pass message | Consistent with the `scanStagedCredentials` cap (`scripts/public-release.ts:1624`) |
| Real-git end-to-end | PASS | `scripts/pre-push-scan.test.ts` — 13 tests incl. root-commit, committed-and-reverted, deletion, oversized; external e2e: clean push passes, `ghp_` secret push refused | 39/39 across 3 reruns during development |

**Caveat (non-blocking):** the 2MB cap means a credential embedded inside a >2MB blob is
reported as oversized, not content-scanned. This is a documented, bounded limitation shared
with the release-gate scanner; operators should keep secrets out of large binary blobs.

---

## Audit Target 2 — Pinned-Bun bootstrap integrity

| Claim | Verdict | Evidence | Finding |
|-------|---------|----------|---------|
| PATH mutation limited to prepending the verified pinned bin dir | PASS | `scripts/public-release.ts:326` `pinnedBunCandidates` (version-pinned `~/.bun-1.3.14/bin` first, then `~/.bun/bin`); `:340` `resolvePinnedBun` version-verifies each candidate; `:362` `ensurePinnedBunOnPath` prepends only the matching bin dir to `process.env.PATH` | No shell profile or persistent env mutation; scoped to the process |
| Version gate exactly `1.3.14` | PASS | `:307` `validateToolVersions` fails closed on any `bun` ≠ `1.3.14`; `:118` `REQUIRED_BUN_VERSION` | Gate manifest rejected otherwise |
| No recursion / masked version errors | PASS | `:362` is a single-shot probe (PATH → pinned candidates → fail closed with install guidance); it never re-invokes the release script | Proven: plain-PATH run (npm shim `1.3.11`) passed the diagnostic under self-resolved 1.3.14 |
| Gate manifest hash / resume unaffected by the prepend | PASS | `:381` `buildGateManifest` hashes the spec **command strings** (`'bun'`) + `bunVersion`/`npmVersion` strings, not resolved paths | Prepend changes resolution, not the manifest identity; resume recomputes the identical manifest |
| Wired before lock acquisition in both entry points | PASS | `:2596` (diagnostic) and `:2658` (release) call `ensurePinnedBunOnPath` before `acquireReleaseLock` at `:2598`/`:2661` | Bootstrap failure never leaves a stale lock |
| Tests | PASS | `scripts/public-release.test.ts` — candidate order, missing-install, effective-runtime (PATH restored in `finally`) | 3 tests, all green |

---

## Audit Target 3 — CLI release flow preserves engine guarantees

| Claim | Verdict | Evidence | Finding |
|-------|---------|----------|---------|
| Spawn-only; no reimplementation | PASS | `cli/src/commands/release/release-runner.ts` `spawnReleaseScript` spawns `bun <scriptPath> [flags]` with cwd = repo root, filtered env, streamed chunks | All logic remains in `scripts/public-release.ts` (incl. pinned-Bun bootstrap) |
| `preview`/`diagnose`/`status` non-mutating | PASS | `releaseScriptFlags` maps preview→`--preview`, diagnose→`--diagnose`; `status` returns `getReleaseStatus` **without spawning**; only `go`/`resume` pass no/`--resume` flags to the engine | The engine's own mutation boundaries are unchanged |
| Exit codes 0/1/2 | PASS | `release-command.ts` `runStandaloneRelease` — 0 success, 1 release failure/spawn error (try/catch), 2 usage; verified live: `release nonsense`→2, `release status`→0 | Mirrors `headless-run.ts` conventions |
| Prompt-hijack fall-through | PASS | `cli/src/index.tsx:291` — dispatch only when op is absent (bare `release`→usage) or a known operation; unknown first-word `release …` falls through to the normal prompt path | Verified live: `echo "release the docs" | savant-code --print` no longer prints release usage |
| Streaming into chat is non-destructive | PASS | `release-command.ts` uses `buildBashHistoryMessages` + throttled block repaint by `toolCallId`; final JSON via `createRunTerminalToolResult` | Matches the `/bash` direct-mode pattern |
| Free/paid parity | PASS | `cli/src/data/slash-commands.ts` + `cli/src/commands/command-registry.ts` both add `release` to the free-build removal sets | Gating-parity tests green in the 2929-suite run |
| Tests | PASS | `cli/src/__tests__/release-runner.test.ts` — 7 tests (normalize, flags, root walk, spawn+stream, exit propagation, status with receipts) | 14/14 across 2 reruns |

---

## Audit Target 4 — Cumulative mutation boundary

| Claim | Verdict | Evidence | Finding |
|-------|---------|----------|---------|
| No tag created during the audit period | PASS | `git tag -l 'v0.0.*'` — newest is `v0.0.9`; **no `v0.0.21` tag** exists | Current HEAD `7cb6184` is untagged |
| No push of the audited state | PASS | `git log origin/main..HEAD` = 2 local-only commits (`7cb6184` prepare v0.0.21, `bac0d53` docs); reflog shows only local commits + resets | Nothing reached the remote |
| No GitHub release / npm publish | PASS | Newest release receipt `savant-public-release-0.0.21.json` (02:55) records `completed=AUTHENTICATION,AUTOMATION_COMMIT_ALL,PREFLIGHT,AUTOMATION_APPROVAL,PUBLIC_PROFILE`, `failed=Stage command failed: bun run test`, `restored=true` — **no `NPM_PUBLISH_*` or `GITHUB_RELEASE` stage** | Prior failed automation attempt stopped at the gates; nothing published |
| Fresh evidence bound to audited state | PASS | Fresh read-only diagnostic (15:16) at HEAD `7cb6184`: `evidenceFinalized: true`, `failedStage: null`, all 8 gates `success`, tracked-state fingerprint bound | Evidence path + hashed transcripts under `%TEMP%\savant-public-release-0.0.21-evidence\` |
| `@savant-code/sdk` never published | PASS | npm registry 404 for `@savant-code/sdk` as of this audit | Confirms SDK-first publication is still first-ever |

---

## Audit Target 5 — Extension of prior approvals

**Verdict: PASS — approvals extended to the cumulative state, with conditions.**

The core transaction engine audited under FID-2026-0808-001/002/003 is unchanged in its
stage ordering, receipt/evidence contract, fail-closed resume, and SDK-first package order;
the new surfaces (bootstrap, pre-push scan, CLI flow) only add fail-closed guards and
operator conveniences. Conditions on the grant:

1. The pre-push 2MB scan cap is a **bounded, documented limitation** — keep secrets out of
   large binary blobs (Target 1 caveat).
2. `--no-verify` remains the operator's explicit escape hatch (documented in the hook and
   the scan's refuse message); its use is an operator decision, not a script defect.
3. The current working tree is intentionally dirty with all audited changes; an
   automation-mode release will sweep them into the release commit **by operator choice**
   (the script's documented policy), and the pre-push hook will scan that push.

---

## Claim Audit — residual round-3 items (already landed pre-request)

| Area | Verdict | Evidence | Finding |
|------|---------|----------|---------|
| `sk-proj-` detection | PASS | `scripts/public-release.ts:263` `redactSecretText` pattern includes `sk-proj-` (2-class gate) | Modern OpenAI project keys no longer a false-negative |
| Unreadable receipt fail-closed | PASS | `:769` `assertNoUnrestoredPriorRelease` throws on parse failure | Torn receipts cannot be silently ignored |
| `repositoryKey` on diagnostics | PASS | `:700` `buildDiagnosticReceipt` stamps `repositoryKey`; cross-version scan keys on it (`:730-747`) | Foreign-repo receipts isolated; legacy receipts still counted |

---

## Critical/High Findings

**None.**

## Minor Observations (non-blocking)

1. `savant-code release <unknown-op>` falls through to the prompt path in non-TTY mode
   (by design, Target 3); operators should expect usage output only for a **bare** `release`
   or an empty op. If scripted strictness is ever desired, `--print`-style op validation is
   the extension point.
2. The `release status` "last receipt" shows the failed 02:55 automation attempt with
   `restored=true` — a correct, recoverable state; `resume` would re-validate its evidence
   before continuing.
3. The `savant-public-release-8.8.8` / `9.9.9` temp evidence directories are leftovers from
   unit tests (bogus versions); harmless, but operators may clean them at will.

## Mutation Boundary Confirmation

**None observed.** No commits, tags, pushes, GitHub releases, npm publications, credential
mutations, or durable settings mutations occurred during this audit. The only writes were the
read-only diagnostic's evidence files under the OS temp directory.

## Final Sign-Off

**SECOND APPROVAL GRANTED — the cumulative release system (FID-2026-0808-001/002/003 +
post-003 additions) is safe for operator-approved release execution under the three stated
conditions.**

---

*Audit completed 2026-08-08 by Nova — independent third-party ECHO auditor.*
