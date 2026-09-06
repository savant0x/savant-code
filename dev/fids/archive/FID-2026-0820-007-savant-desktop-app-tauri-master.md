# FID: Savant Desktop App — Master Architecture (Tauri v2)

**Filename:** `FID-2026-0820-007-savant-desktop-app-tauri-master.md`
**ID:** FID-2026-0820-007
**Severity:** critical
**Status:** closed
**Created:** 2026-08-20 19:04

---

## Summary

Master architecture FID for the Savant-Code native desktop application, rebuilt on the operator-confirmed
Tauri v2 blueprint with NO terminal emulation. This supersedes the deleted Electron-based suite
(FID-2026-0820-001..006), which contradicted the operator's explicit no-terminal requirement.
Four child FIDs track the implementable phases.

## Environment

- **OS:** Windows 10+, macOS 10.15+, Linux (AppImage/deb/rpm via Tauri bundler)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned); Rust (Tauri host only)
- **Shell:** Tauri v2 (OS WebView: WebView2 / WKWebView / WebKitGTK)
- **Backend:** Bun single-file executable (`bun build --compile`) sidecar
- **Bridge:** JSON-RPC over localhost WebSocket (ephemeral port + bearer token)
- **Commit/State:** main @ v0.0.26 (working tree — NOTE, Loop 1 RED: the canonical design doc and this
  five-FID suite are untracked working-tree artifacts; see Resolution Policy Commit Gate)

## Detailed Description

### Problem

Savant-Code operates exclusively as a terminal TUI. A graphical desktop chat app is required. The operator
explicitly requires NO terminal interface: no PTY, no xterm.js, no shell emulation — verification output
renders as structured transcript blocks.

### Expected Behavior

- Tauri v2 shell (Rust supervisor) spawns a Bun-compiled agent-runtime sidecar
- React 19 chat UI with structured event streaming (token deltas, tool cards, diffs, ECHO phase transitions)
- Localhost WebSocket bridge authenticated with a high-entropy bearer token; no PTY anywhere
- Native diff viewers, inline approval cards (Law 2), Auto Drive dashboard
- Distribution via Tauri bundler with signed installers and consent-gated auto-update

### Root Cause

Two conflicting deep-research outputs existed; the operator selected the Tauri v2 no-terminal blueprint as
canonical. The prior Electron suite was deleted by operator decision on 2026-08-20.

### Evidence

- Canonical design doc: `docs/design/Savant Desktop App Architecture.md` (Tauri v2 blueprint, operator-confirmed)
- Operator decision (2026-08-20): no terminal interface; Tauri plan is the correct v2 plan
- Prior art: Hermes Desktop, OpenHands, AionUI (see design doc)

## Impact Assessment

### Affected Components

- New `desktop/` workspace (Tauri Rust host + React renderer)
- `cli/` — headless server mode for the WebSocket gateway (distinct from the existing `--print` and
  `--auto` headless modes; child FID-008 owns the entrypoint detail)
- `packages/agent-runtime/` — session state serialization for the bridge
- Repo gates — typecheck gate extends ×11 → ×12 (the `type_check` gate in `protocol.config.yaml` chains
  11 workspaces; the root `package.json` `typecheck` script matches — corrected from the stale "×4 → ×5"
  claim during Loop 1 RED); 300-line absolute ceiling applies to all new desktop TSX files with no exemptions
- New dependency/toolchain surface: Tailwind CSS v4 + CSS build tooling (declared in child FID-010 but
  absent from every `package.json` today) and the Rust stable toolchain + Tauri v2 CLI (brand-new CI
  stage — verified 2026-08-20: the only CI workflow, `.github/workflows/build-release-binaries.yml`, is
  pure Bun; grep for cargo/rust/tauri returns zero matches); React 19 + Zustand 5 are already available in
  the repo

### Risk Level

- [x] Critical: New product surface, security-sensitive IPC, code signing authority, new Rust toolchain

## Proposed Solution

### Approach

Adopt the canonical blueprint: Tauri v2 + Bun sidecar + localhost WebSocket + structured events, no terminal
emulation.

### Steps

1. Phase 1: Desktop Session Gateway — Bun WebSocket JSON-RPC server + headless CLI mode (child FID-2026-0820-008)
2. Phase 2: Tauri Shell — Rust supervisor, sidecar lifecycle, security (child FID-2026-0820-009)
3. Phase 3: Chat UI — React 19, structured tool cards, diff viewer, governance visualization (child FID-2026-0820-010)
4. Phase 4: Packaging & Distribution — tauri build, externalBin signing, updater (child FID-2026-0820-011)

### Verification

- Each child FID carries its own verification section
- Master closes only when all children reach closed with audit evidence
- Integration: WebSocket bridge E2E tests. Desktop E2E driver matrix (corrected Loop 2, 2026-08-21, per
  Tauri v2 docs): `tauri-driver` (WebDriver) covers Windows + Linux only; WKWebView has no WebDriver, so
  macOS E2E uses WebdriverIO's `@wdio/tauri-service` embedded driver; Playwright applies only via CDP
  attach to WebView2 (Windows). Three-platform coverage therefore targets WebdriverIO, not raw
  `tauri-driver` alone.

## Child FID Manifest

> Statuses reconciled through 2026-08-26 against each child's own header,
> the active ledger, and the archive directory.

| Child FID | Title | Phase | Status |
|-----------|-------|-------|--------|
| FID-2026-0820-008 | Desktop Session Gateway (WebSocket) | Phase 1 | closed (+ archived 2026-08-23) |
| FID-2026-0820-009 | Tauri Shell + Sidecar Supervisor | Phase 2 | closed (+ archived; verified against archive header, Loop 5) |
| FID-2026-0820-010 | Chat UI (Structured, No Terminal) | Phase 3 | closed (+ archived 2026-08-25; Auto Drive dashboard, graph, and halt lifecycle verified) |
| FID-2026-0820-011 | Packaging & Distribution | Phase 4 | closed (+ archived 2026-09-03: release-time remainder executed locally — signed-bundle E2E, Windows installer smoke, console + CI-prebuild fixes; standing process re-homed to successor FID-2026-0903-001) |
| FID-2026-0822-012 | Holographic Command Deck (Visual Workspace) | Phase 5 | closed (+ archived 2026-08-26 via operator waiver of the webview re-smoke boundary; all seven declared gates live PASS at closure) |
| FID-2026-0822-014 | Structured Output Cards | Phase 3 | closed (+ archived; verified against archive header, Loop 5) |
| FID-2026-0824-009 | Workspace Regions | Phase 3 | closed (+ archived 2026-08-25) |

## Resolution

CLOSED 2026-09-03: every child closed (-008 session gateway, -009 Tauri
shell, -010 chat UI, -011 packaging — the latter with its release-time
remainder executed locally and the standing process re-homed to successor
FID-2026-0903-001). The desktop app is built, runs, smoke-proven (T16-F
deck smokes; 2026-09-03 installer + launch + uninstall cycles), and its
distribution path is contract-proven (signed bundles, fail-closed updater
manifest, environment-scoped signing). Integration tests: real-sidecar
gateway E2E green in CI contract; full three-platform driver matrix rides
the successor FID's first pipeline cut. Deferred scope (macOS
entitlements/notarization, Azure Artifact Signing) is explicitly re-homed,
not lost.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/scripts/build-sidecar.test.ts

### Verification Receipt

- fingerprint: sha256:6d0fda871ec7ddabe7e9f5ba9a3a026f66d618211d2324179df43a2c3f17485a
- verified: 2026-09-03T16:44:01.364Z
- typecheck desktop: exit 0
- test desktop/scripts/build-sidecar.test.ts: exit 0

## Resolution Policy

- A child FID may not close until its implementation evidence is independently audited (Verifier + Adversary)
- The master FID may not close until all child FIDs are closed
- Discovery FIDs created mid-implementation are appended to this manifest
- Superseded record: FID-2026-0820-001..006 (Electron suite) were deleted by operator decision on 2026-08-20
  before any implementation; numbers 001-006 are retired for this date and must not be reused
- **Commit Gate (Loop 1):** no child FID may enter GREEN until (a) `docs/design/Savant Desktop App
  Architecture.md` is committed to main and (b) the five suite FIDs (007-011) are committed to `dev/fids/`
  (operator-authorized commit; Verifier-checkable via `git ls-files`)
- **Manifest Sync (Loop 1):** corrections surfaced in a child FID's planning loop (numbering, entrypoint/bin
  names, dependency declarations, gate counts, phase scope) must be folded back into this manifest and
  recorded in the master's Perfection Loop section before that child may close
- **Dependency declarations (Loop 1):** every child must declare its `package.json`/toolchain additions in
  its Environment section before GREEN; gate-count claims are re-verified against `protocol.config.yaml` at
  each child GREEN
- **Signing prerequisites gate (Loop 2):** child FID-011 may not enter GREEN until (a) Apple Developer ID
  enrollment status and (b) Azure Artifact Signing eligibility (US/Canada identity + paid Azure
  subscription) are confirmed by the operator — or a revised distribution strategy is recorded in FID-011.
  Enrollment/validation lead times are days-to-weeks; these are day-0 checks, not Phase 4 errands
- **External-fact citation (Loop 2):** toolchain-behavior claims adopted at any child GREEN (bundler
  sidecar-signing behavior, target-triple naming, updater signature format) must carry dated source
  citations; unverifiable vendor behavior stays tagged unverified per the Cross-Agent Claim Rule

## Perfection Loop

### Loop 1 — Planning

- **RED:** PASS 2026-08-20 — 7 issues cataloged (ISSUE-001..007: 1 critical, 3 medium, 3 low) with
  file:line evidence. Critical (ISSUE-001): the cited design doc AND all five suite FIDs are untracked in
  git, violating the suite's own commit-before-cite rule. Medium: stale typecheck gate count (×4 vs the
  real ×11), `dev/fids/README.md` ledger claims an empty active queue while 6 active FIDs sit on disk,
  child FID-008 ignores the existing `--print`/`--auto` headless modes and uses bin name `savant` instead
  of `savant-code`. Low: `SCOPE.md:1344` references the deleted 001..006 in present tense, child FID-011
  root cause overstates ("no packaging pipeline" — the CLI release pipeline exists), Tailwind v4 is
  declared in child FID-010 but absent from every `package.json`.
- **GREEN:** PASS 2026-08-20 — corrections applied to this master: gate count corrected to ×11 → ×12,
  dependency/toolchain surface declared, Commit Gate + Manifest Sync + dependency-declaration rules added
  to Resolution Policy, commit/state caveat recorded. Child-loop mandates (folded back via Manifest Sync,
  not edited here): FID-008 must fix the bin name (`savant-code`) and relate the gateway entrypoint to the
  existing `--print`/`--auto` headless modes; FID-011 must scope its root cause to desktop packaging.
  Routed to operator hygiene (outside master scope): `dev/fids/README.md:8` active-queue ledger refresh,
  `SCOPE.md:1344` present-tense fix for the deleted 001..006, and the stale "9-workspace" comment at
  `protocol.config.yaml:21`.
- **AUDIT:** PASS 2026-08-20 — Verifier double-audit of the GREEN edit: 6 PASS checks (gate count ×11→×12
  matches `protocol.config.yaml` evidence; Commit Gate operator-satisfiable and `git ls-files`-checkable;
  Environment caveat records untracked state; dependency bullet matches evidence; child-loop mandates via
  Manifest Sync with minimal-change discipline; status sequencing honest) + 1 FAIL: the GREEN entry lacked
  the operator-hygiene routing line for ISSUE-003/ISSUE-004 + the stale `protocol.config.yaml:21` comment.
  Remediated in SELF-CORRECT (routing line added, verified on disk via grep at the GREEN entry); the
  Verifier's NEEDS-REVIEW on the Rust/CI sub-claim was resolved with tool evidence (only CI workflow is
  `build-release-binaries.yml`, pure Bun; zero cargo/rust/tauri matches).
- **ADVERSARIAL:** CLEAN 2026-08-20 — NOTE: the Adversary agent was unavailable (3 consecutive harness
  failures: `Invalid prompt: The messages must be a ModelMessage[]` — an agent-definition bug, escalated
  per the oscillation circuit breaker, not retried). Substituted tool-mediated adversarial verification
  (read-only commands, not self-reporting): routing line names all three hygiene items (GREEN entry);
  CI rust-absence re-verified (grep exit 1 over `.github/workflows/`); `type_check` chains 11 unique
  workspaces (grep evidence); Tailwind absent from all checked `package.json` files (grep exit 1) while
  React 19 (`cli/package.json:49`) and Zustand 5 (`cli/package.json:62`) are present; all three Resolution
  Policy gates present; all 7 RED issues have dispositions; status sequencing honest. One ADJUSTED: the
  `CHANGE DELTA: N/A` field is honest for a planning FID — the loop entries themselves record this loop's
  document edits. Recorder note: the final COMPLETE edit was applied directly by the Orchestrator after the
  Recorder agent hit the same harness failure (SoD fallback per the LEARNINGS 2026-07-25 precedent,
  recorded here for audit).
- **CHANGE DELTA:** N/A — planning FID (document edits are recorded in the loop entries above)

### Loop 2 — Operator-Review Fold-In

- **Trigger:** 2026-08-21 operator-requested review of the converged plan (independent external research
  + adversarial critique). Master-level corrections: the Verification E2E bullet corrected to the real
  Tauri v2 driver matrix; Signing prerequisites gate + External-fact citation rules added to Resolution
  Policy.
- **Folded into children via Manifest Sync (never silently here):** FID-008 — frozen handshake contract
  (hello/version + reserved error codes), env-only token delivery (argv rejected: process-listing
  exposure), Origin/Host allowlist validation on the WS upgrade, session model frozen
  (single-session-per-sidecar v1), approval-flow semantics, reconnect rescoped to session-restore reuse.
  FID-009 — CI integration checklist, externalBin Rust-triple rename via `TAURI_ENV_TARGET_TRIPLE`,
  env-only token injection, WebView origin registry. FID-010 — renderer-side token handling (Tauri IPC
  only, never localStorage/query strings) + E2E matrix cross-reference. FID-011 — `signCommand` path for
  Azure Artifact Signing, entitlements-via-config requirement (tauri#11992: the bundler signs sidecars
  without custom entitlements unless configured), updater minisign specifics (pubkey inline, signature =
  .sig contents, .env not read), day-0 signing eligibility gate, externalBin rename cross-reference.
- **CHANGE DELTA:** master edits limited to the Verification bullet, two Resolution Policy rules, and this
  loop entry; all child scope changes live in the child files.

### Loop 3 — Program-Wide Perfection-Loop Pass (2026-08-21)

- **Trigger:** operator command "run the perfection loop on all open FIDs".
- **RED:** ground-truth refresh, tool-verified 2026-08-21: the Commit Gate is
  CLEARED — `git ls-files` confirms `docs/design/Savant Desktop App
  Architecture.md` and FID-2026-0820-007..013 are all tracked in HEAD (swept
  into the v0.0.27 release commit). The `type_check` chain remains ×11; the
  sole CI workflow still has zero cargo/rust/tauri matches; `Bun.serve`
  remains test-only; Tailwind remains absent from every `package.json`;
  React 19 (`cli/package.json:49`), Zustand 5 (`cli/package.json:62`), and
  zod ^4.2.1 (`cli/package.json:61`) reconfirmed. NEW findings:
  (1) HIGH missed-reuse — `packages/design-systems` already exports a
  react-targeted token pipeline (`designSystemThemeOverrides`,
  `resolveActiveDesignSystem`, `selectDesignSystem`, `contrastRatio`, zod
  canonical schemas) and `cli/package.json:35` already depends on it, yet no
  desktop FID referenced the package while FID-010 planned hand-porting
  tokens (Law 7/13); (2) MEDIUM — the design doc prescribes "CSS+Tailwind"
  but Tailwind is undeclared anywhere (dependency-declaration rule applies).
- **GREEN:** Manifest Sync executed 2026-08-21: design-systems consumption +
  Tailwind strike routed to FID-010 (its Loop 1 records both plan changes);
  the relay design constraint routed to FID-008; relay residuals routed to
  new FID-2026-0821-004. No new gate machinery: the existing
  dependency-declaration rule covers the Tailwind strike and any future
  virtualization-library adoption, and one expectation is recorded — the
  `desktop/` workspace enters the quality scanner's owned roots at creation,
  so its files are ≤300 lines from birth (FID-2026-0819-005 ceiling).
  Missed-questions pass: 2 questions, both documentation-only.
- **AUDIT:** PASS 2026-08-21 — the Verifier audited all ten items PASS
  (item 7 = FID-013 PASS-with-note: a static trace is not closure; the
  actual live-test result must be recorded before any status flip).
  Binding follow-throughs: record the live-test result, disk-resolve the
  load-bearing citations, re-paste `git ls-files` — all executed below.
- **ADVERSARIAL:** UPHELD 2026-08-21 — the Adversary disk-resolved every
  load-bearing citation (11 CONFIRMED, 2 ADJUSTED: the cumulative
  `toolResults` array lives inside `execute-tool-calls.ts` ~:100-117, not
  the nonexistent `run-programmatic-step.ts`; `native.ts:222-235` FSM gate
  EMITS an error chunk and is never a silent edge) and adjudicated the
  clean live basher test: guard PASSED ⇒ second-hop loss (FID-013 stays
  `fixed`; FID-2026-0821-004 gains candidate D4). Commit-Gate-CLEARED
  confirmed on the re-pasted `git ls-files` output (all seven suite FIDs
  plus `docs/design/Savant Desktop App Architecture.md` tracked).
- **CHANGE DELTA:** this loop entry + missed questions 5-6; child-manifest
  status advances recorded after the AUDIT/ADVERSARIAL verdicts land.

### Loop 4 — Child-Status Reconciliation (2026-08-23, queue-to-zero unit U9)

- **Trigger:** master FID-2026-0823-003 unit U9 — reconcile this record
  with its now-landed children before the supersession/closure pass (U10).
- **Manifest Sync:** child statuses refreshed from disk (each verified
  against its own header + Resolution/Step Status this day): -008
  `closed`+archived; -009 `fixed` (all 8 steps [x]; GUI live smoke is the
  only remaining boundary); -010 `analyzed` (Loop 3 chat-thread foundation
  audited; Steps 4–7 open); -011 `analyzed` (day-0 signing gate holds).
  Discovery FIDs appended per the Resolution Policy: -012 (deck; fixtures
  substrate landed at `desktop/src/floor/`, P1–P6 gated on this chain) and
  -014 (structured output cards; `fixed`).
- **Step Status sync:** -008 flips to implemented+closed; -009 annotated
  implemented-pending-closure; -010 annotated partially-implemented;
  integration bullet annotated with the live real-sidecar E2E evidence
  (4/4) while full three-platform driver-matrix coverage stays open.
- **MASTER STATUS:** STAYS `analyzed` — the master may not close until all
  children close (Resolution Policy), and -009/-010/-011/-012 remain active.
- **CHANGE DELTA:** manifest table + Step Status annotations + this entry +
  CVE refresh + Resolution note.

### Loop 5 — Child-Status Reconciliation II (2026-08-23 ~23:00 EDT)

- **Trigger:** operator command "run the perfection loop on the master and
  all children" (post-restart session).
- **Manifest Sync (disk-verified):** -009 and -0822-014 are BOTH `closed` +
  archived since the Loop 4 reconciliation — archive headers checked
  directly (`**Status:** closed` in both archived files); neither remains
  in `dev/fids/`. Manifest table rows + Step Status row updated this entry.
- **Remaining open children:** -010 (`analyzed`; chat-thread foundation
  landed, Steps 4–7 open), -011 (`analyzed`; signing gate LIFTED ~23:10 EDT
  via operator decisions — macOS deferred, Windows unsigned-local v1,
  escrow documented; Windows/Linux scope GREEN-eligible), -012 (`analyzed`;
  **hard prerequisites now SATISFIED** — gateway closed, shell closed,
  renderer foundation landed; P1–P6 unblocked for implementation).
- **Manifest Sync addendum (~23:14 EDT):** -011's own Loop 2 addendum lifted
  its signing gate minutes after this loop pass opened — folded back here
  per the Manifest Sync rule.
- **Readiness verdict (operator question "am I safe to begin?"): YES —
  immediate implementation front is -010 Steps 4–7; -012 P1 is unblocked;
  -011 awaits operator signing decisions only.**
- **MASTER STATUS:** STAYS `analyzed` — three children remain active.
- **CHANGE DELTA:** manifest rows ×2, reconciliation-note date line,
  Step Status row ×1, this entry.

### Missed Questions

> Surfaced during the Loop 1 GREEN pass; each answered with the most robust
> default derivable from code inspection and folded back into this master.

1. Which typecheck gate count applies once the desktop workspace lands?
   Decision: the `type_check` chain extends ×11 → ×12, re-verified against
   `protocol.config.yaml` at every child GREEN (Manifest Sync rule).
2. May children cite the design doc before it is committed? Decision: no —
   the Commit Gate requires the doc and the five suite FIDs committed to
   main (Verifier-checkable via `git ls-files`) before any child GREEN.
3. Where do corrections surfaced in a child's planning loop get recorded?
   Decision: folded back into this master via Manifest Sync and recorded in
   this Perfection Loop section — never by silently editing child scope.
4. What happens to the retired Electron numbers 001-006? Decision: retired
   for 2026-08-20 and never reused on that date.
5. With the Commit Gate cleared (2026-08-21), is any new gate machinery
   needed before child implementation begins? Decision: no — the existing
   dependency-declaration rule covers new dependencies (Tailwind strike,
   any virtualization library); one expectation recorded: `desktop/` enters
   the quality scanner's owned roots at creation, so its files are ≤300
   lines from birth (2026-08-21 program pass).
6. Where do the 2026-08-21 program-pass corrections get recorded? Decision:
   Manifest Sync — design-systems reuse + Tailwind strike to FID-010, the
   shared-history design constraint to FID-008, and the execute-tool-calls
   relay residuals to new FID-2026-0821-004.

### Code Verification Evidence

Planning-stage record — status `analyzed`: the plan is loop-converged and no
implementation exists yet (Ground-Truth convention: a converged planning FID
stays `analyzed` until its phase is implemented — 2026-08-16 lesson).

- Codebase facts the plan rests on (Loop 1, tool-verified 2026-08-20): the
  `type_check` gate chains 11 workspaces in `protocol.config.yaml`; the only
  CI workflow (`.github/workflows/build-release-binaries.yml`) is pure Bun
  with zero cargo/rust/tauri matches; React 19 (`cli/package.json:49`) and
  Zustand 5 (`cli/package.json:62`) are present; Tailwind CSS v4 is absent
  from every checked `package.json` and must be declared before FID-010 GREEN.
- Reachability: no `desktop/` workspace exists in the working tree; the Step
  Status checklist is intentionally unchecked until each child FID closes
  with independent audit evidence.
- Gate output: none applicable to a planning FID — typecheck/test/lint
  evidence becomes mandatory at each child's implementation AUDIT per the
  Verification section.
- 2026-08-23 Loop 4 reconciliation (U9): the `desktop/` workspace NOW EXISTS
  and all four phase children have landed implementation substrate — -008
  gateway closed/archived (live real-sidecar E2E 4/4), -009 shell supervisor
  at `fixed`, -010 renderer foundation at Steps 4–7, -011 code-side pending
the day-0 signing gate. Master status stays `analyzed`; closure follows
  the last child closure per the Resolution Policy. (Loop 5 supersession
  note: -009 has since closed + archived — see Loop 5.)

## Lessons Learned

- Two deep-research runs produced contradictory architectures; only one was committed to the repo. The
  uncommitted one became phantom evidence in a FID suite. Rule: a research doc must be committed to
  `docs/design/` before FIDs may cite it.
- The Electron suite pre-decided three operator-deferred axes (shell, bridge, terminal). The terminal
  decision was the pivotal one: with no terminal, the Electron WebGL rationale evaporates and Tauri wins.
- A lesson without an enforcement point is decorative: commit-before-cite existed as prose while the
  entire suite shipped untracked. Rules must become checkable gates (`git ls-files`) in the master's
  Resolution Policy, not narrative postmortems.

## Step Status

- [x] FID-2026-0820-008 (Session Gateway) implemented — closed + archived
      2026-08-23 (`savant-code server` shipped)
- [x] FID-2026-0820-009 (Tauri Shell) implemented — CLOSED + archived
      (archive header verified `closed`, Loop 5 disk check)
- [x] FID-2026-0820-010 (Chat UI) implemented — CLOSED + archived 2026-08-25
      (corrected 2026-09-03 from a stale "Steps 4–7 open" claim; the manifest
      table above and the archive directory are ground truth)
- [x] FID-2026-0820-011 (Packaging) implemented — CLOSED 2026-09-03:
      release-time remainder executed locally (signed-bundle E2E, Windows
      installer smoke both flavors, console fix, CI prebuild fix + dispatch
      scaffold); standing release-time process re-homed into the automatic
      release pipeline via successor FID-2026-0903-001
- [ ] Integration tests passing — deferred::operator-approved 2026-09-06:
      real-sidecar gateway E2E 4/4 green at -008 closure; the full
      three-platform driver-matrix scope moves with the master's own
      Phase-4 planning into the current desktop workspace (verified in the
      tree 2026-09-06; see FID-2026-0903-001 for the packaging chain)
- [x] All child FIDs audited and closed — -008/-009/-010 archived earlier;
      -011 closed 2026-09-03; deferred macOS/Azure scope re-homed to
      FID-2026-0903-001
