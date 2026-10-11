# FID: Release-readiness repair and artifact acceptance

**Filename:** `FID-2026-1010-004-release-readiness-repair.md`
**ID:** FID-2026-1010-004
**Severity:** high
**Status:** analyzed
**Created:** 2026-10-10 21:48
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator request: "make a repair fid to fix all issues you found so we're ready
for release". This FID owns all eight findings from the release-readiness audit
and the unproven artifact-acceptance boundaries. It defines minimal repairs,
regression evidence, and a fail-closed release decision. Creating this document
is not implementation, convergence, commit authorization, or proof of readiness.

Source audit: `dev/session-summaries/2026-10-10-release-readiness-audit.md`.
Retained outputs: `dev/scratchpad/active/release-readiness-2026-10-10/`.
The existing T184 scope item is extended rather than creating a duplicate task.

## Environment

- **OS:** Windows, Git Bash; other supported platforms require native runners.
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14.
- **Tool Versions:** npm 10.9.2; Node 24.21.0 used for SDK import probes.
- **Commit/State:** main at observed short HEAD `10877c77`, dirty working tree.
  Product version 0.0.35. Preserve existing edits and unrelated open work.

## Detailed Description

### Problem

The working tree compiles, but repository release gates and the committed tree
fail. A Windows cancellation failure disappeared on rerun without a repair.
Build and package dry runs do not prove consumer installation or native startup.

### Expected Behavior

All repository gates pass against the same reviewed release candidate. Both SDK
module formats, declarations, WASM, and vendored ripgrep work through installed
consumer interfaces. Both CLI aliases start the intended candidate and reach a
usable terminal interface. Supported-platform evidence and committed-tree proof
are required before declaring release-ready. No assertion, policy ceiling, or
security check is weakened to obtain a pass.

### Root Cause

- R1: **corrected by measurement — the audit's first reading was wrong.** The
  README callout *prose* already matched the CHANGELOG byte-for-byte; the
  working copy's *line endings* did not. Measured: `README.md` on disk carried
  `1094` CRLF pairs while `git show HEAD:README.md` carried `0`, and
  `.gitattributes` declares `*.md text eol=lf`. `findReleaseCalloutBlock`
  splits on `\n`, so the comparison reported drift for text that was already
  correct. The version NUMBER was never the problem.
- R2: The embedded protocol bundle was not regenerated after grounding changes.
- R3: The HUD preview accumulated authored JSX above the 300-line ceiling.
- R4: The quality baseline retained an exemption for a deleted generated logo.
- R5: The telemetry proposal contains a 232-column paragraph. The existing
  `draftFor` renderer in `scripts/telemetry-feedback.ts` concatenates the same
  paragraph without line breaks, so a document-only fix would recur.
- R6: Sidebar polish FID lacks required code-verification evidence; its receipt
  is not a substitute for live verification. Icon-program quality failure is
  the same R3/R4 failure, not an independent product defect.
- R7: Committed TokenHarbor test expectations still include a removed model;
  corrected working-tree expectations have not established release-tree proof.
- R8: Windows tree cancellation failed at the parent-PID assertion. Cause is
  not established. `killProcessGroup` uses a five-second synchronous taskkill
  timeout and falls back to direct child termination on failure; Windows
  liveness checks inspect only the shell. These are investigation leads, not
  a proven diagnosis. Do not guess a timeout adjustment as the fix.

### Evidence

Exact prior command output, not fresh repair results:

```text
version: FAIL (1 drift(s))
- README.md: 0.0.35 (expected 0.0.35) — release-callout body
STALE: common/src/constants/protocol-bundle.generated.ts
quality: FAIL (2 quality violation(s))
- cli/scripts/hud-preview-components.tsx: 340 lines exceeds absolute maximum 300
- cli/src/constants/savant-logo.ts: stale dataConstantExemptions entry
[ fid.structure.heading ] FID-2026-1010-003: missing Code Verification Evidence
common/src/__tests__/model-config.test.ts(44,7): TS2322, tokenharbor/th-orchestra
sdk/src/__tests__/run-terminal-command.test.ts:217: parent PID still alive
Initial SDK full suite: 675 pass / 1 skip / 1 fail
Isolated cancellation suite: 7 pass / 0 fail
Full SDK rerun: 676 pass / 1 skip / 0 fail
Working-tree typecheck: exit 0
```

R5 evidence: `markdown.log` reports MD013 at
`dev/telemetry/proposals/law15-dominance.md:10`, expected 120, actual 232.
The audit-created SCOPE blank-line defect was repaired and checked; retain its
passing document checks but do not count it as an outstanding product repair.

## Impact Assessment

### Affected Components

- R1: `README.md`, `CHANGELOG.md`, existing version synchronization helpers.
- R2: `common/src/constants/protocol-bundle.generated.ts`, existing generator.
- R3: `cli/scripts/hud-preview-components.tsx`; reuse neighboring preview
  modules where appropriate, or extract `cli/scripts/hud-preview-section.tsx`.
- R4: `dev/quality-baseline.json`; exemption and obsolete tracked-logo entry.
- R5: `dev/telemetry/proposals/law15-dominance.md`,
  `scripts/telemetry-feedback.ts`, `scripts/__tests__/telemetry-feedback.test.ts`.
- R6: `dev/fids/FID-2026-1010-003-sidebar-operator-polish-pass.md` and
  `dev/fids/FID-2026-1009-004-cli-icon-integration-program.md` live receipts.
- R7: `common/src/__tests__/model-config.test.ts` and existing TokenHarbor FID.
- R8: `sdk/src/tools/run-terminal-command.ts`,
  `sdk/src/tools/child-process-registry.ts`, existing cancellation fixture/tests.
- Acceptance: existing SDK verification consumers, CLI launcher/build/smoke
  tooling, root validation contract, and release pre-audit tooling.
- Durable records: this FID, SCOPE, CHANGELOG, and session summaries.

### Risk Level

- High: release candidate is not reproducible from committed HEAD, and process
  cancellation can leave descendants running. Documentation fixes are low risk;
  cancellation is behavior-sensitive and requires a converged design.
- Preserve HUD visuals, keyboard/mouse folding, public SDK exports, environment
  isolation, POSIX group termination, timeout semantics, and terminal cleanup.
- No new dependency, new quality exemption, version bump, credential access,
  protocol-policy relaxation, or production-sidebar redesign is proposed.

## Proposed Solution

### Approach

Use existing sources of truth and verification infrastructure. Read each target
0-EOF before editing. Repairs follow plan convergence; unresolved R8 design
prevents claiming whole-plan convergence. The operator's request authorizes this
repair FID; it does not authorize committing or publishing. A behavior-preserving
preview split is not approval for a new HUD design or production integration.

### Steps

1. **R1/R2 — synchronize truthful generated/document surfaces.** Copy the
   current release section into the README callout using existing conventions;
   regenerate the protocol bundle with `bun run generate:protocol-bundle`.
   Keep 0.0.35 unless the operator separately chooses a version bump. Run
   version and bundle checks after final grounding/document changes.
2. **R3/R4 — restore quality without exceptions.** Extract a cohesive preview
   section from the 340-line component, preserving existing exports and all
   render/fold behavior. Check every resulting authored TS/TSX file is at most
   300 lines. Remove the stale logo exemption and historical deleted-file entry
   directly from the baseline; do not restore unused logo code or raise caps.
3. **R5 — repair Markdown and prevent recurrence.** Wrap the proposal paragraph
   without changing its meaning. Repair `draftFor` to emit semantically
   identical wrapped Markdown and extend
   `scripts/__tests__/telemetry-feedback.test.ts` to assert generated draft
   lines respect 120 columns. Verify idempotent rewriting and stale-draft
   removal remain intact. Do not disable MD013.
4. **R6 — repair evidence honestly.** Add the required Code Verification
   Evidence section to the sidebar FID after verifying referenced source,
   call sites, and declared tests. Restamp that FID and the icon-program FID
   after quality is repaired. Never invent a fingerprint or reuse an old pass.
5. **R7 — repair the releasable tree.** Review the already-corrected working-tree
   expected roster against the checked-in catalog; retain exact-list coverage
   and dead-ID removal. Prepare a path-scoped staging plan including required
   source, tests, generated assets, and evidence. An authorized commit must
   contain the complete candidate; then rerun `bun run verify:clean`. Do not
   restore `th-orchestra`, widen away the error, or test a synthetic tree while
   describing it as committed HEAD.
6. **R8 — diagnose and harden cancellation.** Reproduce under repeated full SDK
   execution and representative concurrent process load. Record taskkill result,
   duration, shell/parent/grandchild liveness and registry cleanup using test
   diagnostics without command text or secrets. Distinguish process-ownership
   races, tool timeout/failure, and PID-reuse measurement before selecting a
   solution. Extend existing lifecycle helpers with injected process seams
   rather than module mocks. Preserve ownership so an early shell exit cannot
   turn cancellation into a direct-parent-only kill; handle failure truthfully.
   Review and converge the measured repair design before source changes.
7. **A1 — prove SDK consumer acceptance.** Build fresh dist and run existing
   `sdk/scripts/verify.ts --skip-build` consumers (CJS/ESM imports, declarations,
   ripgrep and tree-sitter). Also install the locally packed SDK into isolated
   in-project consumers and prove `SavantCodeClient`, both module formats,
   CJS/ESM TypeScript token extraction, declarations and executable vendor
   resolution. Keep consumer checks unchanged; existing skipLibCheck consumer
   scripts do not replace the full strict source typecheck.
8. **A2 — prove CLI artifact acceptance.** Identify exact build target, version,
   binary path and checksum from existing build tooling. On each supported
   native runner, build/retrieve the reviewed candidate, run version/help and
   `cli/scripts/smoke-binary.ts`, then exercise input, fold/navigation and
   clean exit interactively in tmux where supported. Install the local CLI
   wrapper package in an isolated project and exercise both `savant-code` and
   `sc` against that exact candidate, not an older downloaded release. Inspect
   launcher resolution before running any path that might fetch remote assets.
9. **A3 — complete release gates and authority accounting.** Frozen-lockfile
   install, full typecheck/root tests, lint, quality, generated checks, hygiene,
   repository validation and formatting must all pass after final edits.
   Run package dry runs from `sdk/` and `cli/release/`, not root. Repeat the
   clean committed-tree gate after any candidate changes. Inspect release
   pre-audit side effects before requesting fetch/remote permission. Account
   explicitly for native runner availability, live-provider budget/credentials,
   and the operator-owned Savant-free disposition; none becomes a silent pass.
10. **Records and final decision.** Record exact commands, cwd, exit codes,
    elapsed time, artifacts/checksums and raw logs. Stamp this FID only when
    its declared gates actually pass. Close/archive only after authorized
    committed implementation and all required acceptance evidence; otherwise
    keep it active with the specific blocker and issue a not-ready verdict.

### Verification

- Existing targeted test artifacts are declared below. Any additional regression
  discovered during R5/R8 design must first be added by exact repo-relative path
  to both this verification contract and the gate list; no promised test is
  treated as covered by a prose-only commitment.
- R8 must pass at least 20 consecutive isolated runs and five consecutive full
  SDK runs with no retries masking failures, plus concurrent-load reproduction.
  Assert shell, parent, detached grandchild and registry cleanup; preserve
  existing bounded deadlines. Include normal completion, abort, timeout,
  already-exited processes, taskkill failure and POSIX escalation in the
  converged design. Repeat success is supporting evidence, not proof of cause.
- Root `bun run typecheck` and `bun run test` must both pass after repairs;
  individually passing workspaces cannot replace a failed root chain.
- Run `bun x eslint . --max-warnings 0`, `bun run lint:md`,
  `bun x prettier --check .`, `bun run quality:report`,
  `bun run validate:repository`, `bun run hygiene:check`,
  `bun run version:check`, and both generated-reference check commands.
- Run `bun install --frozen-lockfile` only after inspecting the prepare hook;
  it writes repository hook configuration and vendors binaries. Do not imply
  the earlier audit established this gate. Obtain any additional required
  Git/config authorization before executing it.
- Run `bun run fid:verify <affected-fid-path> --write` for the two repaired
  evidence records, and this FID only after implementation verification.
- `validate:repository` is a final aggregate command, never a declared probe
  here: it live-reruns FID gates and would recursively verify itself.
- Declared gates below prove local implementation; native, installed-package,
  repeated-run and committed-tree acceptance are additional mandatory criteria,
  not claimed as fulfilled by the machine receipt.

## Repair Execution Status (2026-10-10)

Implemented and gate-verified in this pass, unless marked otherwise. No claim
below rests on an unevidenced assertion; every exit code is from a real run.

| Step | Status | Evidence |
| --- | --- | --- |
| R1 README callout | implemented | `version:check` exit 0 — comparison made line-ending-agnostic (`withoutCarriageReturns`) |
| R2 protocol bundle | implemented | `generate:protocol-bundle` updated 1 file; `:check` exit 0 |
| R3 preview ceiling | implemented | `hud-preview-components.tsx` 339→224 lines; new `hud-preview-section.tsx` 141; preview suite passes |
| R4 stale exemption | implemented | `quality:report` exit 0 (1502 baselined, 0 violations) |
| R5 telemetry wrap | implemented | `draftFor` pre-wraps; new pin passes; `lint:md` exit 0 repo-wide |
| R6 FID evidence | withdrawn | The sidebar FIDs were later operator-declined; their earlier receipts remain historical, not product acceptance |
| R7 committed tree | **in progress** | Local commits are authorized; a coherent, verified release-candidate commit remains outstanding |
| R8 cancellation | **blocked** | 20/20 isolated runs passed, but two full SDK runs reproduced a live parent process after the cancellation deadline; cause and repair unresolved |
| A1 SDK consumers | implemented | CJS/ESM imports + both `test:types` + tree-sitter + ripgrep all exit 0 |
| A2 native CLI | **blocked** | Needs native runners + artifact authority |
| A3 local gates | **partial** | typecheck exit 0; `validate:repository` PASS; quality/lint:md/eslint exit 0; prettier green after the operator-authorized formatting in D8; `fid:verify --write` 23/23 exit 0, receipt stamped |

### Discovered during repair (all fixed this pass unless marked)

- **D1 — FID-2026-1010-003 declared no gates.** Its gate block and receipt sat
  inside a fenced `markdown` example copied from the template, so
  `parseVerificationGates` saw zero declarations and the placeholder
  `sha256:<machine-generated>` receipt was never machine-written. Un-fenced,
  evidence section added, receipt stamped against live output. A note inside
  the region is itself parsed as a malformed gate, so the explanation moved
  into `### Code Verification Evidence`.
- **D2 — ephemeral scratch paths cannot be gate targets.** The declared `probe
  dev/scratchpad/active/probe-logo-geometry.tsx` failed the allowlist; the path
  is gitignored. Gate dropped rather than faked.
- **D3 — two verified FID gates were red on stale pins.**
  `right-sidebar-single-home.test.tsx` and `right-sidebar-phase-color.test.tsx`
  asserted the label `ECHO · …`, which FID-2026-1008-006 renamed to `Phase · …`
  in `agent-status.tsx:93,165`. The color/label invariants were unchanged; the
  pins were. Updated to the shipped label, and the activity-model assertion
  updated to the fact that actually renders (measured with
  `dev/scratchpad/active/probe-sidebar-phase.tsx`). FID-2026-1009-007 restamped
  8/8 and FID-2026-1009-004 restamped 8/8.
- **D4 — shipped SDK consumer fixtures failed their own types.** Both
  `sdk/test/{cjs,esm}-compatibility/test-types.ts` passed `apiKey`, removed from
  `SavantCodeClientOptions` when the backend surface was retired
  (FID-2026-0929-005, commit `06220bc6`). `test:types` failed `TS2353` in both.
  Fixtures updated to a current option; both now exit 0.
- **D5 — FID-2026-1010-005 tracked only in the queue.** `validate:repository`
  reported `scope.unregistered-item`; registered in SCOPE.md.
- **D6 — R8 is a real flake, not a one-off.** Isolated suite: 19/20 pass, then
  0/25 failures in a second loop; full SDK: 5/5 pass. Failing run took 12.5s
  against the suite's own 5s post-kill deadline. Cause NOT established.
- **D7 — the R1 fix pushed `scripts/version-docs.ts` past 300 lines** (308),
  caught by `quality:report`. Extracted to `scripts/version-callouts.ts`.
  Grep-verified zero external importers of the moved helpers.
- **D8 — the working tree is being edited by a concurrent session, and it moved
  DURING this verification.** `bun x prettier --check .` passed at audit time
  (retained log: "All matched files use Prettier code style!") and fails now on
  sidebar files this pass never touched, and the failing set GREW while the
  pass ran — observed mtimes: `right-sidebar.tsx` 22:21,
  `agent-status.tsx` 22:27, `right-sidebar-format.ts` 22:43,
  `right-sidebar-sections.tsx` 22:44 then 22:53,
  `__tests__/sidebar-rail-navigation.test.tsx` 22:54 (a file that did not exist
  in the earlier set, measured at 22:56). Four files became five mid-pass. The
  diffs are whitespace/indentation ONLY (inspected on copies; no semantic
  change) and the files now carry another workstream's in-progress
  feature code (`toolDisplayName`, `formatToolHistoryEvent`,
  `resolveActiveAgentDisplay`), i.e. FID-2026-1010-005. **Not formatted here
  deliberately:** they are outside this record's registered write surface and
  are live work-in-progress of a concurrent session, so normalizing them would
  be an unapproved write into someone else's active surface. `bun x prettier
  --write` on exactly those files clears the gate.
  **Resolved 2026-10-10 (operator-authorized).** The operator was asked how to
  handle the out-of-surface files and directed the formatting; the same ruling
  authorized the D9 timeout ceiling. Every file was formatted only after
  proving each delta whitespace-only on copies, with a write guard that would
  have aborted on any non-whitespace change. `bun x prettier --check .` →
  exit 0 repo-wide. The blocker was never a technical one: it was the missing
  authority to write into another workstream's live surface, and that authority
  was granted explicitly rather than assumed.
  Consequence for this record's honesty: the green results below describe the
  tree as measured; because it was still being written during the run, those
  results are not a frozen-candidate proof. That is itself a release blocker —
  a releasable tree must be quiescent and attributable to one candidate.

### D9 — the quality-report suite was failing on a clock, not an assertion

`scripts/quality-report.test.ts` was **unmodified against HEAD**, so this was
not a defect this pass introduced. Each case calls `collectQualityIssues`,
which re-walks every source root; measured at 1.7–10.3s per case against bun's
5s default per-test timeout. Under load two *different* cases failed (10.3s,
9.0s); on a quiet rerun a third failed (6.3s). **No assertion failed in any
run** — only the clock. Repaired by making the ceiling explicit rather than
inheriting a default sized for unit tests: `SCAN_TIMEOUT_MS = 30_000`, applied
through a `scanTest` helper that forwards to `it`. Every assertion is
byte-identical; nothing was skipped, weakened or suppressed. Standalone rerun:
10 pass / 0 fail, slowest case 3.1s.

### D10 — Windows cancellation passes in isolation but fails in the full SDK suite

On 2026-10-11, `bun --no-env-file test src/__tests__/run-terminal-command.test.ts`
passed 20 consecutive invocations (7 tests per invocation). The full command
`bun --no-env-file test src/` failed twice: 604 passed, 1 skipped, 1 failed.
The failing test was `terminal command process diagnostics > cancels a detached
Windows grandchild with its terminal-tool tree`; the assertion at
`sdk/src/__tests__/run-terminal-command.test.ts:217` expected `parentPid` to be
gone, but `process.kill(parentPid, 0)` still succeeded after the 5s deadline.
One run reported 6,980ms for the test. The taskkill result and duration were not
captured, so the cause remains unconfirmed and no process-kill change is
converged. The focused suite passed again after the full-suite failure. This
confirms a load-sensitive leak, not its cause.

### D11 — operator cancelled the sidebar and icon work

On 2026-10-11 the operator cancelled all sidebar FIDs and FID-2026-1009-004
because the TUI cannot use SVGs. R6's sidebar-receipt repair is withdrawn as
product work; its previous gate evidence remains historical. This release
readiness FID remains open for its independent R7/R8/A2 acceptance gates.

### Stamp result

`bun scripts/fid-verify.ts dev/fids/FID-2026-1010-004-release-readiness-repair.md --write`
returned **23/23 gates exit 0, `STAMP-EXIT=0`**, receipt stamped with
fingerprint `sha256:23ac4c64…`. The two gates red at the previous attempt —
`test scripts/quality-report.test.ts` (D9) and `probe scripts/prettier-check.ts`
(D8) — are both green. Status stays `analyzed` by this record's own ruling:
R7, R8 and A2 remain open, so the record is stamped-but-active, not closed.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/__tests__/model-config.test.ts
- gate: test cli/scripts/hud-preview.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-cache.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-format.test.ts
- gate: test sdk/src/__tests__/run-terminal-command.test.ts
- gate: test sdk/src/__tests__/run-state-child-process.test.ts
- gate: test scripts/__tests__/telemetry-feedback.test.ts
- gate: test scripts/quality-report.test.ts
- gate: test scripts/version-docs-drift.test.ts
- gate: probe scripts/version-check.ts
- gate: probe scripts/protocol-bundle-check.ts
- gate: probe scripts/provider-reference-check.ts
- gate: probe scripts/scope-register-check.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/sdk-build-check.ts
- gate: probe scripts/cli-bundle-resolution-check.ts
- gate: probe scripts/eslint-check.ts
- gate: probe scripts/lint-md-check.ts
- gate: probe scripts/prettier-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:23ac4c641b80dae2158dc9866dad8744a81a1507c7b1ef45d04eb96f4b4bf7bd
- verified: 2026-10-11T03:36:36.258Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/__tests__/model-config.test.ts: exit 0
- test cli/scripts/hud-preview.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-cache.test.tsx: exit 0
- test cli/src/components/__tests__/right-sidebar-format.test.ts: exit 0
- test sdk/src/__tests__/run-terminal-command.test.ts: exit 0
- test sdk/src/__tests__/run-state-child-process.test.ts: exit 0
- test scripts/__tests__/telemetry-feedback.test.ts: exit 0
- test scripts/quality-report.test.ts: exit 0
- test scripts/version-docs-drift.test.ts: exit 0
- probe scripts/version-check.ts: exit 0
- probe scripts/protocol-bundle-check.ts: exit 0
- probe scripts/provider-reference-check.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/sdk-build-check.ts: exit 0
- probe scripts/cli-bundle-resolution-check.ts: exit 0
- probe scripts/eslint-check.ts: exit 0
- probe scripts/lint-md-check.ts: exit 0
- probe scripts/prettier-check.ts: exit 0
- quality: exit 0

## Gate Authority Boundaries

**Amended 2026-10-11:** a verification receipt *is* now present at analyzed
status (see below). It covers the 23 declared gates only — every one exit 0 —
and is not evidence of release readiness or of the blocked steps. Per Step 10,
stamping requires only that the declared gates pass; closure additionally
requires authorized committed implementation and the acceptance evidence that
R7, R8 and A2 still lack. Do not declare
`verify-clean`, release pre-audit or native-build probes whose execution would
implicitly cross authorization boundaries during repository validation.

## Perfection Loop

### Loop 1 — RED

- **RED:** Eight recorded findings and acceptance gaps mapped to R1–R8/A1–A3.
- **GREEN:** Repair proposal above; no production implementation performed.
- **AUDIT:** Existing quality, version/bundle probes, preview tests, SDK consumer
  scripts and cancellation lifecycle inspected. Prior output is explicitly
  labeled prior evidence. Exact-path gate existence and document checks must
  pass before delivering this plan.
- **ADVERSARIAL:** A green working tree can hide a broken HEAD; repeated green
  cancellation tests can hide a race; dry-run packaging can hide missing runtime
  assets; a native boot escape sequence cannot prove usable interactive input.
  Acceptance explicitly requires the stronger proof in each case.
- **CHANGE DELTA:** Initial document; no prior FID revision to compare.

### Missed Questions

1. **Does the audit probe's missing SavantClient require a product repair?**
   No. `sdk/src/client.ts:8` exports `SavantCodeClient`. Corrected ESM/CJS probes
   passed. Test the real public export; do not create a compatibility alias for
   an audit typo.
2. **Does the root npm package dry run prove SDK contents?** No. Correct SDK
   dry run reported 23 entries; CLI wrapper reported 81. Installed consumer
   acceptance remains mandatory, and root dry-run output is not SDK evidence.
3. **Does requesting a repair FID approve all irreversible actions?** No.
   No commit, tag, push, publish, deploy, credential use, live spending, or
   platform-release artifact operation is approved by this planning request.
4. **Can the Windows root cause be filled from the passing rerun?** No.
   Diagnosis and failure-path design remain necessary before convergence.
5. **Can Savant-free and pending provider gates disappear from the verdict?**
   No. Existing T122 and provider-account rulings remain binding; request the
   operator's release-target/disposition decision and any funded access needed.
6. **Is this a performance project?** No speedup is claimed. Cancellation timing
   is measured to diagnose bounded cleanup correctness, not as a benchmark win.

### Implementation Evidence (REQUIRED for closed)

Implementation has not started. No commit SHA, implementation line ranges,
passing repair receipt, or release artifact evidence exists for this FID.
Each numbered step is planned, not implemented. Steps 5, 8 and 9 have explicit
operator/platform boundaries; those boundaries cannot be erased by local passes.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (R1–R6, A1, A3; R7/R8/A2 blocked as tabled above)
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state — **not yet**: the
      record stays `analyzed` because R8 is unresolved, so it must not be
      stamped `verified`

Citations for the changed code:

- `scripts/version-callouts.ts:47-49` — `withoutCarriageReturns`, the R1 fix;
  consumed at `:76` (sync) and by `collectDocVersionDrift` in
  `scripts/version-docs.ts`. Zero external importers of the moved helpers
  (grep over `*.ts`/`*.tsx`).
- `cli/scripts/hud-preview-section.tsx:26-141` — `HUD_MARKS` + `PreviewSection`,
  re-exported from `cli/scripts/hud-preview-components.tsx:17-18` so
  `hud-preview.tsx` and `hud-preview-marks.tsx` needed no edit.
- `scripts/telemetry-feedback.ts` — `draftFor` emits the review paragraph
  pre-wrapped; pinned by
  `scripts/__tests__/telemetry-feedback.test.ts` (5 pass).
- `sdk/test/{cjs,esm}-compatibility/test-types.ts` — stale `apiKey` replaced;
  both `test:types` exit 0.

Fresh gate output (this pass): `typecheck` exit 0; `validate:repository` PASS;
`quality:report` exit 0 (1502 baselined); `lint:md` exit 0; eslint exit 0;
prettier exit 0 on every changed/new file; FID-2026-1010-003 8/8,
FID-2026-1009-007 8/8, FID-2026-1009-004 8/8 stamped.

### Loop 2 — Independent audit and self-correction

Required before convergence: adversarial review of each repair against its
acceptance criterion, especially ownership-safe Windows cleanup and generator
recurrence. Resolve measured findings without weakening checks. Record actual
revision deltas; do not fabricate an independent-agent review.

### Loop 3 — Final convergence

Not reached. R8 diagnosis/design and any new regression gate declarations must
be completed first. `analyzed` is intentional; it cannot be promoted solely
because the Markdown or structural validator passes.

## Resolution

- **Closed Date:** Not closed — R8 (cancellation flake), R7 (authorized commit),
  A2 (native artifacts) and the external gates remain open.
- **Fix Description:** R1–R6, A1 and A3 repaired in the working tree: the
  release-callout comparison is line-ending-agnostic with a CRLF regression pin;
  the protocol bundle is regenerated; the HUD preview is split under the
  ceiling; the deleted-logo quality exemption is gone; the telemetry draft is
  pre-wrapped in its renderer with a pin; FID-2026-1010-003 regained real gate
  declarations and a machine-stamped receipt; three stale-pin/FID-contract
  defects found during the pass were repaired; the SDK consumer fixtures were
  realigned with their own published types.
- **Tests Added:** Yes — a CRLF callout-drift pin in
  `scripts/version-docs-drift.test.ts`, and a 120-column draft pin in
  `scripts/__tests__/telemetry-feedback.test.ts`.
- **Verification Evidence:** `bun run typecheck` exit 0;
  `bun run validate:repository` = `validation: PASS`; `quality:report` exit 0;
  `lint:md` exit 0; eslint/prettier exit 0; drift suite 8/8; telemetry 5/5;
  sidebar single-home + phase-color pass; SDK consumer CJS/ESM imports,
  declarations, tree-sitter and ripgrep all exit 0; and the FID's own declared
  gate set — `fid:verify --write` — **23/23 exit 0**, receipt stamped
  (fingerprint `sha256:23ac4c64…`, stamped 2026-10-11T03:36:36Z).
- **Archived:** Not archived; the record stays `analyzed` until R8 converges.
  Stamped and active is the honest state: the declared gates prove the local
  implementation, and they prove nothing about the three open blockers.

## Lessons Learned

Release readiness belongs to a specific committed candidate and its installed
artifacts, not an accumulation of unrelated green commands. Retain every initial
failure, establish causes, and distinguish implementation receipts from platform
or external acceptance. Never substitute version-number parity for release-note
content parity, or a successful rerun for a cancellation repair.
