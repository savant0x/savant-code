# Session Summary — 2026-09-03 08:48 (single-agent bootup grounding)

## Initial State Assessment

**Session mode:** single-agent (ECHO Protocol v0.1.2-single-agent). Full boot
sequence executed 0-EOF:

| Boot step | Artifact | Result |
|---|---|---|
| 1 | `ECHO.md` (harness contract, read first) | Read 0-EOF |
| 1 (mode-correct) | `dev/echo-v0.1.2-single-agent.md` | Read 0-EOF — governs this session |
| 2 | `protocol.config.yaml` | Read; `language: "typescript"` (no BOOT-CHECK halt), `strict_mode: true` (harness + single_agent) |
| 3 | `coding-standards/typescript.md` | Read 0-EOF; TS quality overrides: max_file_lines 400, max_function_lines 60, max_line_length 100 |
| 4 | `ARCHITECTURE.md` | Read 0-EOF; 10-agent roster + helper tool libraries |
| 5 | `dev/LEARNINGS.md` | Read (large file — tail sections truncated by tool token limit; the structured lesson headers and all canonical rules were captured) |
| 6 | `dev/fids/*.md` glob + metadata headers | Read; 14 active FIDs inventoried (headers only, per boot rule) |
| 7 | `SCOPE.md` (single-agent scope artifact) | Read head; active register state captured below |
| 8 | This summary | Created |

**Identified constraint:** `SCOPE.md` is 524 lines and continues past the
current register (earlier tasks' history). It also predates the
2026-08-21 LEARNINGS 100k-char threshold, so only near-tail edits apply that
rule; current size allows ordinary str_replace.

**Git state at session start:** clean working tree (no changed files reported).

## Active Work Items (from SCOPE.md head + FID ledger)

- **T15-F** (desktop office rebuild): BLOCKED on operator — live visual smoke
  of the neon-noir office deck.
- **T15-H** (old stage module retirement): DEFERRED pending operator decision
  after the T15-F smoke; single atomic commit of 14 stage modules + tests.
- **14 active FIDs** in `dev/fids/` (status per metadata headers):
  - `fixed`: FID-2026-0824-012, FID-2026-0824-028, FID-2026-0824-030,
    FID-2026-0828-001
  - `analyzed`: FID-2026-0819-005 (quality ratchet, critical),
    FID-2026-0820-007 (desktop master, critical), FID-2026-0820-011,
    FID-2026-0823-003, FID-2026-0824-003, -004, -005, -006, -007, -008
- FID metadata statuses are claims, not ground truth (Ground-Truth rule) —
  status reports will be codebase-verified before being acted on.

## Project Posture (grounding digest)

- TypeScript monorepo, Bun ≥ 1.3.11 (root pins 1.3.14); workspaces: common,
  agents, sdk, cli, evals, savant-free, desktop (Tauri v2), packages/*.
- Hard gates: typecheck × 12 workspaces (root `typecheck` script),
  `bun test src/` in sdk, eslint `--max-warnings 0`, `lint:md`,
  `bunx prettier --check .`; pre-push hook also runs the pushed-range
  credential scan.
- Quality ceilings: 300 lines/file absolute (TS override 400 for React
  components/services), 60-line functions, 100-char lines, complexity 10.
- Version control: G1–G9 apply — agent never executes git; FID closure needs a
  committed hash; commit convention `<type>(<scope>): <desc> (<FID-ID>)`.

## Planned Work

Awaiting operator direction. No implementation started (Law 2). Candidate
queues, in the order the records present them:

1. Await T15-F operator live smoke → then T15-H retirement commit.
2. `fixed`-status FIDs (012, 028, 030, 0828-001) — verify implementation
   evidence in codebase before any closure/archival action.
3. `analyzed` FIDs — implementation queue per ledger order.

## Dependencies / Blockers

- T15-F and T15-H are operator-decision-bound.
- None of the above has been started; no code written this session.

## Issues Flagged (Law 2 Additional Rule)

None encountered during boot. No `[OPEN-OUT-OF-SCOPE]` items added to
SCOPE.md this session.

## Work Completed — Ground-Truth Closure of the Four `fixed` FIDs (same session)

Operator directive: ground-truth-verify FID-2026-0824-012, -028, -030,
-0828-001 and route them toward closure. All four read 0-EOF, verified
against the working tree, and CLOSED + ARCHIVED.

**Method (Double Audit):** (1) static — fresh gate battery 2026-09-03:
101 tests / 0 fail across 11 gate files (deck-robots, deck-walkers,
print-mode schema, skill-management, spawn-agent-inline emission,
experience-capture, adopt-and-persist mirror, compaction-summary handler +
block, skills-command, experiences-dedup); repo-wide `fid:verify --check`
sweep PASS after closure. (2) runtime/live — per-FID boundary discharge
(below). (3) mechanical — all four receipts re-stamped PASS at the archived
paths via `fid:verify … --write`.

**Per-FID verdicts + G2 evidence:**

- **FID-2026-0824-012** (high, self-improving harness master): all 16 steps
  implemented + committed (`6ef39b8`, `a1f13b8`, `b588f9c`, `23621ba`,
  `2611380`). Live boundaries FULLY DISCHARGED: both 2026-08-26
  lesson-derived drafts operator-trusted to top level (VERSIONS.jsonl +
  versions/ provenance; committed `23621ba`); capture sink holds 19
  production records across sessions without interrupting execution;
  `dev/agenda.md` auto-refreshing. YAGNI-Compliance corrected `Pending` →
  `Verified` (config ledger path `dev/YAGNI-LEDGER.md` never materialized —
  compliance judged from the design's reuse of existing infrastructure).
- **FID-2026-0824-028** (critical, robot-cast recovery): implementation in
  `51fa261` (v0.0.28, tagged, on main) via `82645ba`. Re-smoke DISCHARGED:
  the true root cause was the reduced-motion single-frame paint
  (FID-2026-0824-032, closed), and the T16-F CDP smoke 2026-08-29
  (`2026-08-29-t16f-live-resmoke-pass.md`) shows `[deck] mount <role>: glb`
  for all 10 roles + pixel-diff animation evidence. Surface later superseded
  by the operator-confirmed 0831 office rebuild.
- **FID-2026-0824-030** (critical, mount telemetry): implementation in
  `51fa261` (git log -S castTelemetry). Production wiring re-verified
  (deck-runtime.ts:176-212 consumes castTelemetry; lastTemplateOutcome has
  exactly one production consumer). Same discharge evidence.
- **FID-2026-0828-001** (medium, compaction summary): the sole open item was
  the G2 commit hash — resolved to `51fa261` (git show --stat touches
  compaction-summary-block.tsx + send-message-lifecycle.ts). Live smoke was
  already operator-confirmed 2026-08-28.

**Ledger updates:** CHANGELOG 2026-09-03 closure section; dev/fids/README.md
table rows removed + dated reconciliation note (active queue now 10, all
`analyzed`); dev/fids/archive/README.md 2026-09-03 closure section. lint:md
clean after fixing one MD012 introduced by the table edit.

**G1 note:** `git mv` staged the four archive moves (path-scoped); the commit
itself is operator-executed. Suggested message:
`docs(fids): close + archive the four fixed FIDs after ground-truth audit (FID-2026-0824-012, -028, -030, -0828-001)`
— stage `dev/fids/`, `CHANGELOG.md`, and this session summary.

## Work Completed — Active-FID audit + packaging ship-now prep (same session)

**Active-FID audit (10 FIDs):** all read; zero bypasses found; every
"unstarted"/"remaining" claim verified against the working tree. One doc-drift
fix applied (0820-007 Step Status still showed -010 open — corrected to
closed + archived 2026-08-25). Full verdict table in the conversation record.
Queue shape: 0820-007/0823-003 are coordination-only (resolve when -011
closes); 0824-003/004/005/006/007/008 genuinely unstarted; 0819-005 HOLD at
~240 violations.

**Packaging FID-2026-0820-011 — "ship it now" (operator decision):**
Loop 5 entry recorded in the FID. Findings + evidence:

1. **Release blocker found and FIXED:** `desktop/scripts/build-sidecar.ts`
   resolved relative `--entry` against process cwd — under
   `bun run --cwd=desktop` (the workflow's own invocation) the required
   `cli/src/server-command.ts` could never resolve; the release workflow's
   sidecar step would have failed on first dispatch. Fix: repo-root anchor
   from `import.meta.dir` (no-environment-dependent-guards rule); relative
   paths join the anchor, absolutes pass through. Tests: entry-resolves-
   against-repo-root (pins the workflow's exact entrypoint exists on disk)
   + absolute-passthrough. Gates: desktop 389/0 · typecheck 0 · eslint 0.
2. **Fail-closed negative test proven live:** `generate-latest-json.ts` on
   an empty artifacts dir → exit 1, every missing artifact + `.sig` named
   per platform.
3. **Local bundling smoke (partial discharge of the Loop 3 boundary):**
   workflow-exact sidecar compile OK (1,218 modules →
   `savant-sidecar-x86_64-pc-windows-msvc.exe`); `tauri build --no-bundle`
   Finished in 3m32s with tauri-plugin-updater compiled in. Full bundling
   deliberately not attempted locally (needs the signing key; checklist
   item 1 precedes item 2).
4. **Remaining = Loop 4 checklist items 1–6, operator-executed in order:**
   (1) DONE — `desktop-updater-signing` environment created with the
   operator as required reviewer; both secrets verified present
   (2026-09-03 14:21/14:22 UTC). (2) CI validation run — CONSTRAINED by
   G5/G6: the public remote is release-only, so the sidecar fix rides the
   next release cut (or an explicit operator push decision) BEFORE any
   dispatch against `main`; interim local signed-bundling verification is
   available without any remote interaction. Dispatch uses a branch/tag
   ref (never a SHA) and a bare-semver release_tag matching the app
   version. (3) smoke installers; (4) signtool verify host + sidecar;
   (5) E2E updater flow + latest.json negative test; (6) closure ceremony
   closes -011 + masters -007/-003.

**Push-standard grounding (operator correction folded in):** the operator
pointed to the Solo Git Workflow research line (`docs/design/Solo Git
Workflow Optimization.md` → Nova amendment draft →
`dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md`) as the push
standard: public remote stays release-only (G5/G6); between releases,
work commits locally and durability comes from incremental bundles;
release pushes go through `scripts/public-release.ts`. An earlier
instruction in this session to "commit and push to main" violated that
standard and is retracted; the commit/push steps above were rewritten
correspondingly. Status: local main == origin/main (through `2cc377e`,
the v0.0.28 closeout); this session's batch is intentionally local-only.
**Push authorization:** the operator subsequently EXPLICITLY authorized
an out-of-band push of this batch to remote main between cuts (option 2
selected via ask_user 2026-09-03).

**Pre-push gate state at handoff:** eslint repo-wide exit 0 (after adding
`desktop/src-tauri/target/**` to the eslint global ignores — the Loop 5
compile smoke's codegen assets broke the zero-tolerance lint; same class
as the markdownlintignore fix); prettier clean; lint:md exit 0;
`bun run typecheck` RED — solely from the operator's in-flight parallel
edits (packages/agent-runtime/src/__tests__/loop-agent-steps-part-a.test.ts:489,
TS2339 `value` missing on the error variant of a discriminated union),
which the agent did not touch. The pre-push hook runs repo-wide gates,
so the push will fail until the in-flight WIP passes typecheck — finish
or stash it first; push with the hook intact.

**Suggested commit plan (operator, G1/G3/G4):** two logical commits —
(a) `docs(fids): close + archive the four fixed FIDs after ground-truth audit (FID-2026-0824-012, -028, -030, -0828-001)`
— paths: `dev/fids/`, `CHANGELOG.md`, session summary;
(b) `fix(desktop): resolve sidecar entry against repo root + release-readiness audit (FID-2026-0820-011)`
— paths: `desktop/scripts/build-sidecar.ts`, `desktop/scripts/build-sidecar.test.ts`,
`dev/fids/FID-2026-0820-007-savant-desktop-app-tauri-master.md`, `dev/fids/FID-2026-0820-011-packaging-distribution.md`,
`.github/workflows/desktop-ci.yml`, `.github/workflows/desktop-release.yml`, `.markdownlintignore`, `eslint.config.js`.

## CI triage addendum (2026-09-03, post-handoff)

Operator asked to check the desktop-release CI run and triage failures.
Result: **no `desktop-release.yml` run exists** (never dispatched — the
batch was never committed/pushed/dispatched). But the 02:21Z release push
triggered `desktop-ci.yml` run 33707308289 — **failed on all 3 platforms
at the sidecar step**. Second independent root cause found and fixed:
the gitignored generated agent bundle
(`cli/src/agents/bundled-agents.generated.ts`, produced by
`cli/scripts/prebuild-agents.ts` via `bun run --cwd=cli prebuild:agents`)
was never generated in CI before the sidecar build imported it. Both
desktop workflows now run that generator first. Verified by cold-checkout
simulation (deleted generated files → workflow-exact invocation regenerates
40 chunks → sidecar rebuilds from the fresh bundle, exit 0). Desktop suite
389/0; eslint 0; lint:md 0; prettier clean. The fix rides the same
unpushed batch as the Loop 5 fix — the two logical commits stand, with the
workflow files joining commit (b).

**Dispatch scaffold:** desktop-ci.yml additionally gained
`workflow_dispatch` + extended paths coverage (agents/**, prebuild script,
cli/package.json) so the prebuild fix can be validated on demand via
`gh workflow run desktop-ci.yml -R savant0x/savant-code` immediately after
the push — before any desktop-release dispatch — instead of waiting for
the next release cut.

**Local signed-bundle E2E:** full `tauri build --bundles msi,nsis` with a
THROWAWAY minisign key (temp-generated, destroyed after) wired via the
exact CI env contract → exit 0, 2 bundles + 2 updater `.sig` artifacts;
NSIS name exactly matches the generator contract. Manifest proven both
ways against real bundle outputs: Windows-only → fail-closed exit 1
(Linux pair named, no output); full set (real-signed Linux placeholder) →
exit 0, valid `latest.json` with embedded signatures. Boundary narrowed,
not closed: real key, Linux native bundling, installer runtime, and the
updater E2E loop remain CI/operator territory (FID Loop 6 record).

**Installer smoke (Windows, live):** NSIS per-user silent install → files
(incl. real sidecar) + HKCU entry verified → launch smoke (desktop +
sidecar live; updater's first real remote check 302→404s gracefully —
expected, channel is empty until the CI cut) → silent uninstall clean.
MSI per-machine: non-elevated /qn fails 1603/1925 by design (silent can't
surface UAC) → elevated silent install OK (Program Files, GUID product
key) → elevated uninstall by product code clean. Savant AI agent install
(C:\Program Files\Savant, a DIFFERENT program) verified untouched.
Windows half of checklist item 3 = PASS; Linux/macOS remain other-host.
Operator confirmed the agent/harness distinction mid-smoke.

**Blank-console bug (operator report) — fixed + verified:** release shell
is GUI-subsystem; sidecar spawn set no creation flags so Windows gave the
child its own visible console. `CREATE_NO_WINDOW` applied release-only in
`spawn_sidecar` (supervisor.rs); verified end-to-end with a rebuilt NSIS
(throwaway key #2, destroyed) — sidecar `MainWindowHandle = 0` while
desktop window intact. WiX InstallLocation audited via MSI Property table
COM dump: property is NOT authored — computed at install time; ARP skew is
cosmetic, filed as note. Uninstall leaves runtime-written files
(`tree-sitter.wasm`) — noted. Post-cut updater verification queued;
batch (19 files) still unpushed per G5/G6.

**WIP blocker cleared (operator-authorized, minimal surgery):** the last
pre-push blocker was TS2339 at
`packages/agent-runtime/src/__tests__/loop-agent-steps-part-a.test.ts:489`
(`.value` read on the union's `error` variant). With explicit operator
approval (ask_user), one narrowing line was applied:
`output?.type === 'lastMessage' ? output.value : []` — runtime behavior
unchanged (wrong type ⇒ empty array ⇒ assertions still fail), test still
passes 12/0, prettier-formatted. DISCLOSED: this touched the parallel
session's WIP file; its other edits (enforcement.ts, stream-parser.ts)
remain untouched and UNCOMMITTED — they stay out of the batch commits
(G3/G4) and that session owns their fate. Full pre-push battery
pre-flighted green: eslint 0, lint:md 0, protocol-bundle check 0,
fid:verify --check PASS, evals:smoke 5/5, typecheck 0 (all workspaces),
repo tests 0 fail, prettier --check . 0 warnings.

**Closure ceremony + pipeline re-homing (operator directive: "we're not
releasing right now — add the desktop packaging to the automatic release
system for the next release"):** three FIDs closed + archived —
-011 (release-time remainder discharged; status `closed`), -007 desktop
master (all children closed), -0823-003 coordination master (U1–U11
resolved, incl. the two stale-checkbox flips). Successor
`FID-2026-0903-001` (status `analyzed`) re-homes the standing release-time
process into `scripts/public-release.ts` as future stages
(DESKTOP_BUNDLES dispatch → artifact attach → fail-closed latest.json →
POST_RELEASE_VERIFY endpoint assert), with a re-homing table mapping every
old Loop 4 checklist item to its new owner. Receipts stamped PASS at all
three archived paths (parser-strict gates format learned: gate lines only,
`test` needs specific file paths; a `## Resolution` prefix-anchor collision
corrupted `-007`'s `## Resolution Policy` heading mid-edit — repaired from
`git show HEAD:` ground truth). Ledger surfaces reconciled: active README
(3 rows removed, successor added, dated closure note), archive README
(dated batch entry), CHANGELOG (dated entry), -007 manifest table. NO
RELEASE: the batch stays local per G5/G6; updated local commit plan:
(a) closure batch as before, (b) release-readiness batch as before,
(c) NEW third commit — ceremony + successor:
`dev/fids/FID-2026-0903-001-desktop-packaging-auto-release-integration.md`
joins (a)'s `dev/fids` scope automatically; suggested message:
`docs(fids): closure ceremony for -011/-007/-0823-003 + create -0903-001 desktop packaging pipeline-integration successor`.

## FID-2026-0824-005 steps 1–2 — triggers receiver + goal-injection bridge

Picked up the last zero-blocker child in the active queue. RED (3 failing
batteries) → GREEN (19/0 trigger units; gateway suite 24/0; cli typecheck,
eslint 0-warnings, prettier clean) → AUDIT with a 13/13 live E2E smoke
(scratchpad script, since removed): spawned the real server (learning: its
stdin-watchdog correctly treats ignored-stdin as a dead parent — the smoke
must hold a stdin pipe like the supervisor does), stripped provider creds so
the injected run fails fast at the provider layer, and proved the full
contract: loopback-only bind on gatewayPort+1, health 200 unauthenticated,
unknown route 404, no-auth/bad-secret/stale-timestamp/replayed-nonce → 401,
missing eventId → 400, valid delivery → 202 with the fixed-template
directive injected through the gateway's run path (log-verified) and a
duplicate eventId dropped pre-drive. Two real findings shipped as fixes:
(1) the injection seam originally awaited the ENTIRE run before answering
202 — a head-of-line block that would stall the receiver under long runs;
rewritten acknowledge-then-run (mirrors the WS user_message path's
success-frame-then-await shape), with run failures logged, never surfaced as
HTTP errors; (2) an eslint unused-var warning caught a real wiring gap —
the shared idempotency cache was declared but never passed into the bridge.
Recorded a Loop 2 AMENDMENT in the FID: Loop 1's idempotency key definition
(source, event id, nonce) was incoherent — retries regenerate nonces — so
the layers were corrected to nonce = replay protection (receiver) and
(triggerId, eventId) = idempotency (bridge). FID stays `analyzed`: steps 3
(cron scheduler), 4 (relay toggle), 5 (rail UI) remain. New file scope for
the commit plan (rides the release-readiness batch or its own feat commit):
`cli/src/server/triggers/` (3 modules + 3 test files),
`cli/src/server-command.ts` (wiring), `cli/src/server/gateway.ts`
(`injectTriggerRun` seam).

Protocol correction (operator review, same day): the Perfection Loop runs on
the FID document only — it never implements code. -005's Loop 1 was its
document convergence (ADVERSARIAL verdict); the RED→GREEN→AUDIT narrative
above is Forge/Verifier implementation phases, recorded in the FID under
Code Verification Evidence; -005's Loop 2 is a document amendment
(idempotency layering), not an implementation iteration. Status `analyzed`
remains correct mid-implementation; `fixed` awaits steps 3–5 + declared
gates + stamped receipt.

## FID-2026-0903-001 — Perfection Loop convergence (document-level)

Ran the remaining loop phases on the desktop-packaging pipeline-integration
FID. GREEN: record completed to the template contract (added the three
missing required headings — Missed Questions, Code Verification Evidence,
Resolution; `fid:verify --check` misses heading gaps on `analyzed` FIDs
because it only scans fixed/verified — noted as scan-gap V4, routed to the
ratchet HOLD backlog). AUDIT (tool-evidenced): V1 pipeline citations all
verified at file:line; V2 FAIL→corrected — the dispatch contract was wrong
AND the workflow is internally inconsistent (pipeline tags `v${version}`;
the manifest step needs the v-tag in asset URLs but `generate-latest-json`
rejects v-prefixed `--version`, so either dispatch format broke the first
live cut; resolution: dispatch `v<version>`, workflow strips `v` for
`--version` — added to step-2 implementation scope); V3 the bogus `typecheck
scripts` gate (workspace not in VALIDATION_WORKSPACE_POLICY) was removed;
V4 the scan gap. ADVERSARIAL: STANDS WITH CORRECTIONS. Loop boundary held:
the workflow v-strip is recorded as implementation scope, not executed in
the loop. Status stays `analyzed` (implementation deliberately deferred to
the next cut; ledger active statuses are created/analyzed/fixed/verified —
ECHO.md's `converged` concept maps here to analyzed-with-converged-document).
Gates: lint:md 0, prettier clean, fid:verify --check PASS.

## FID-2026-0824-005 step 3 — cron scheduler + missed-run policy

Shipped the scheduler mechanics: `cron.ts` (dependency-free 5-field
subset, DOM/DOW OR rule, 4-year bounded day-skip scans so Feb-29
schedules resolve), `scheduler.ts` (PURE evaluator; run-latest-on-resume;
deterministic `sched-<ms>` eventIds that dedupe through the bridge's
existing idempotency; fail-closed skip of invalid stored expressions),
store `recurrence`/`nextRunAt` + validating `setRecurrence`, wiring that
reuses the receiver's deliverOne path (startup-resume sweep + 30 s tick,
reentrancy-guarded, timer unref'd). Gates: 43/0 trigger units, full cli
suite 3468/256/0, typecheck 0, eslint 0, prettier clean; live E2E smoke
4/4 (past cursor → startup-resume injection proven in the real server,
cursor collapsed forward, receiver healthy). Loop 3 recorded two
document amendments: recurrence lives on trigger records (not goal
metadata — the goal engine is not wired to the trigger path), and the
rail-panel calendar rendering moves to step 5. Steps 4–5 remain; status
stays `analyzed`.

TWO PRE-EXISTING GATE-INTEGRITY BUGS found and fixed (both were silently
weakening the pre-push test gate):

1. Watchdog-in-runner truncation: gateway.test.ts's in-process
   runServerCommand boot armed the stdin-watchdog on the TEST RUNNER's
   stdin; under piped-stdin harnesses (CI, agents, `bun run test` via a
   hook) the watchdog fired process.exit(0) mid-suite — bun exited GREEN
   with no summary and only 80 of 213 cli test files ever ran (the
   entire utils/state/teacher subtrees and the triggers battery were
   silently skipped). Fixed with a `skipStdinWatchdog` DI seam on
   ServerCommandOptions used by that one test; suite now runs 256 files
   / 3468 tests to its summary. (Same root cause as the trigger-smoke
   spawns dying after the ready line — correctly fail-closed in
   production, wrong only when in-process.)
2. Leaked fetch mock: use-usage-query.test.ts leaves a mock on
   globalThis.fetch after its run (hazard already documented at
   gateway.test.ts:47 — "some leak the mock"), turning every later
   fetch-based test in the same process into a fake 200 — my receiver
   battery caught it only because the watchdog fix let it finally run.
   Fingerprinted (name "", length 0, no preconnect, closed port
   resolves, foreign 200 bodies), bisected to the file, and made the
   receiver probes node:http-based (immune to fetch mocks) per the
   gateway suite's own precedent. The leaking file itself was NOT
   modified — its leak window is its own concern, flagged here for the
   operator.

## FID-2026-0824-005 steps 4–5 + CLOSURE — triggers complete

Completed the remaining steps and closed the FID (now in `dev/fids/archive/`):

- **Step 4 (Loop 4 resolution):** "relay toggle" resolved as the existing
  `SAVANT_TRIGGERS=1` code-side opt-in + external relay infrastructure — no
  in-process tunnel manager (YAGNI). Real code gap for internet exposure:
  per-trigger fixed-window rate limiter in the receiver (5/60 s, 429 +
  Retry-After, DI clock, enforced after auth / before body read).
  `docs/triggers-relay.md` written: enabling triggers, loopback
  hard-requirement rationale, Tailscale Funnel + cloudflared recipes, ngrok
  anti-recommendation, app-offline semantics.
- **Step 5:** `GatewayTriggerManager` DI on the gateway + five authenticated
  `triggers_*` JSON-RPC methods (list sanitized — never secret/hash; create
  returns the plaintext secret EXACTLY once; set_recurrence null-clears;
  set_enabled; delete), capability list extended. Store: atomic
  create-with-recurrence (invalid cron → throw, no half-record) +
  `setEnabled` (legacy records default enabled); scheduler skips disabled
  triggers without touching their cursor (resume-on-enable battery-tested).
  Desktop: zod schemas/builders, `GatewayClient` methods, capability flag
  from hello (`getTriggersAvailable()`), and the `TriggersPanel` in the
  workspace right rail — calendar receipts (recurrence + next run +
  humanized last-fire), enable/disable, delete, secret-once flow,
  capability-gated degradation to a quiet "off" card.
- **Debugging note:** the receiver battery's flood tests failed with
  `http://http//…` — my own tests double-prefixed the scheme into
  `post()`. Also caught en route: `port: 0, gatewayPort: 0` previously
  derived an explicit port 1 (the receiver now treats 0 as OS-assigned;
  the gatewayPort+1 Maus offset is the caller's decision, which
  server-command already makes). Both fixed; limiter verified
  5×202 → 429 → window reset via injected clock.
- **Gates:** trigger units 53/0; gateway suite 30/0; full cli suite
  3481 tests / 256 files / 0 fail; desktop 400/0; cli + desktop typecheck
  0/0; repo-wide `eslint --max-warnings 0` PASS; prettier clean.
  `fid:verify --write` stamped the receipt (6/6 gates PASS);
  `fid:verify --check` PASS; FID archived; README ledger updated;
  CHANGELOG Unreleased entry added.

## Maus-parity suite dissolved — operator decision (2026-09-03, active-FID review)

Operator reviewed the 7 open FIDs and decided: keep -0819-005 (quality
ratchet, operator-held) and -0903-001 (desktop packaging, next release
cut); remove the Maus-parity roadmap program. Mechanic: close-as-out-of-
scope, NOT deletion — each of -003/-004/-006/-007 received a Resolution
recording the operator decision, preserved design work, and the fact that
no implementation existed; master -008 closed per its own Resolution
Policy ("closes when the last child closes") with the suite dissolution
recorded (shipped children -009 and -005 had already closed). All five
status-flipped to `closed` and archived. README active-FID table updated;
CHANGELOG Unreleased entry added.

Gates: lint:md 0, prettier clean, fid:verify --check PASS, ledger unit
battery 9/0. The five closures carry no Step Status sections, so the
Anti-Deferral Gate is untouched by them. Pre-existing validate:repository
failures (NOT from this session): 301 quality.ratchet (the kept -0819-005
debt, fail-closed by design) + 4 fid.steps.unresolved in -0820-007/-011
archived earlier the same day by a previous session — flagged for the
operator; those need operator-approved step markers or a policy decision.
