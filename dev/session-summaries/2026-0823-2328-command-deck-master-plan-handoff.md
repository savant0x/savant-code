# Session Handoff — Command-Deck Master Plan Takeover (2026-08-23 ~23:28 EDT)

> **Read this first if you are a fresh session taking over the Savant desktop
> command deck (FID-2026-0822-012).** This document captures the full session
> arc that just closed and everything needed to start P1 without re-deriving
> any context.

## Part 1 — Session Arc (what just happened)

### 1.1 Recorder relay-guard saga (three live probe cycles)

| Probe | Time (UTC) | Finding |
|---|---|---|
| A | 02:04 | CREATE-shape write SUCCEEDED on disk (`processFileBlock: Created new file`) via an SDK-absolutized path — yet the -008 relay guard falsely relayed a stall. Root cause layer 1: raw `startsWith('dev/fids/')` misses `C:\…\dev\fids\x.md`. |
| B | 02:31–02:32 | Guard rev 1 (canonicalize + repo-root scoping) was falsified LIVE post-restart: the child's absolutized write succeeded again but rev 1's `canonicalizePath('.')` scope baked in the launch-dependent cwd. The freshly-loaded guard still missed it. Ladder fired + exhausted honestly. |
| C | 02:48 | Rev 2 (cwd-independent matching) CONFIRMED first-hand: absolutized CREATE write relayed normally — no stall, no retry needed. |

- **Probe A** found the defect; **Probe B** falsified the first fix after
  static gates accepted it; **Probe C** confirmed the second fix first-hand.
  Static checks were wrong twice; only live probes settled it.
- Full record: `dev/fids/archive/FID-2026-0823-014-recorder-relay-guard-path-form-mismatch.md`
  (closed + archived this session, CHANGELOG entry prepended).

### 1.2 FIDs closed this session

- **FID-2026-0823-012** — corrective retry ladder
  (`RECORDER_STALL_RETRY_LIMIT = 1` + `buildRecorderRetryPrompt` in
  `recorder-stall-check.ts`; bounded loop in `spawn-agents.ts`). Proven live:
  stall → corrective-suffixed retry on a fresh state → exhaustion relayed
  honestly. Closed + archived.
- **FID-2026-0823-014** — relay-guard path-form mismatch (rev 2 final).
  Closed + archived. Lessons Learned filled in-record.

### 1.3 Behavioral finding (still open, honestly recorded)

UPDATE-shape Recorder spawns still read-then-stop even with corrective
suffixes (bounded ~26K contexts, both attempts +3, no write). CREATE-shape
writes succeed every time. **Prefer CREATE contracts for Recorder work until
a write-first UPDATE design or handleSteps-level enforcement lands.**
Recorded in FID-2026-0823-011 (status `fixed`, behavioral boundary open).

### 1.4 Desktop suite perfection-loop pass

Operator trigger executed across master + all open children:

- **Ground truth:** `-009` and `-0822-014` had silently moved to CLOSED +
  archived — the master manifest was stale (listed both as `fixed`).
- **Master FID-2026-0820-007:** Loop 5 entry added — manifest rows synced,
  Step Status synced, readiness verdict recorded, Code Verification Evidence
  supersession note appended. Master STAYS `analyzed` until all children close.
- **-010:** Loop 4 ground-truth refresh entry (`desktop/src` matches Loop 3;
  Steps 4–7 genuinely open). Now the program critical path.
- **-011:** Loop 2 gate-status entry + **operator decisions folded** (see 1.5)
  + minisign escrow procedure documented in-record. GREEN blocker LIFTED for
  Windows/Linux scope.
- **-012:** Loop 3 prerequisite-satisfaction entry — ALL hard prereqs now met.
- **AUDIT:** batched Verifier (6 PASS; 1 honesty FAIL discharged by actually
  calling ask_user then rewording; deep-tree spot-check converted
  NEEDS-REVIEW to PASS). **ADVERSARIAL:** STANDS — one omission (master `-011`
  rows stale vs the same-pass gate lift) synced back per Manifest Sync.

### 1.5 Operator signing decisions (-011, ~23:08 EDT ask_user)

- macOS: **DEFERRED** — v1 targets Windows + Linux only.
- Windows: Azure Artifact Signing **NOT ELIGIBLE** → unsigned locally-built
  v1 artifacts with the documented SmartScreen bypass ("More info → Run
  anyway" macro); production signing re-opens when Azure eligibility changes
  or an OV certificate is purchased (jsign fallback hook per tauri#9578).
- Minisign escrow: **documented NOW** in-record (generation / password-
  manager + encrypted offline backup / recovery validation / rotation bridge
  release / loss-without-backup path).

## Part 2 — COMMAND-DECK TAKEOVER STATE (start here)

### 2.1 The record

`dev/fids/FID-2026-0822-012-holographic-command-deck.md` — status
`analyzed`, planning fully converged (Loop 1 RED 15 issues / GREEN all
folded / AUDIT PASS with one remediation / ADVERSARIAL UPHELD / concurrent-
session reconciliation folded; Loop 2 = U7 fixture substrate landed).

### 2.2 Prerequisites — ALL SATISFIED

| Prereq | State |
|---|---|
| -008 gateway | CLOSED + archived (live real-sidecar E2E 4/4) |
| -009 shell | CLOSED + archived (verified against archive header this pass) |
| -010 renderer foundation | LANDED + audited (token pipeline + transport/thread core; gates 54/0 incl. live real-sidecar E2E 4/4) |

### 2.3 Entry point: P1 — Scene shell

Three.js stage mounted in a DeckView toggle (Deck/Chat switch in the center
canvas), Void + grid, camera controls, plus `deckTokens.generated.ts` + a
drift test asserting the generated subset (incl. `inlineCodeFg` #22d3ee)
matches resolver output.

Then P2 role-walkers → P3 stations → P4 state layer → P5 completeness →
P6 polish/perf/fixtures/smoke (see the FID's Steps section).

### 2.4 Substrate already landed

`desktop/src/floor/__fixtures__/tier-1/` (five recorded sequences over the
EXISTING PrintModeEvent union), `tier-2/` (three SYNTHETIC-PENDING-FID-008
drafts), `__tests__/fixtures.test.ts` (8 pass / 0 fail incl. the zod-literal
drive-by fix in `common/src/types/print-mode.ts`).

**PATH DECISION (Loop 2 audit):** floor modules ADOPT `desktop/src/floor/`
explicitly — never silently diverge to `desktop/src/renderer/`.

### 2.5 Dependencies due at implementation GREEN

`three` + THREE-CustomShaderMaterial (CSM injection pattern) +
`zustand ^5.0.8` (exact cli pin) enter `desktop/package.json` per the
dependency-declaration rule. Pixi.js STRUCK; Immer intentionally not adopted.

### 2.6 The Amendment Gate (G1–G4) — non-negotiable

- AMENDMENT-FREE elements render on today's PrintModeEvent family: walkers,
  stations, sparks, packet pulses, reasoning bursts, interim-transition_phase
  auras.
- AMENDMENT-GATED elements (approval docking, compaction ripple, objective
  pylons, revision glyphs) render ONLY after the -008 PrintModeEvent
  amendment adds their events.
- G2: the interim aura pairing rule EXPIRES when a dedicated phase event
  lands. G3: Tier-2 fixtures carry syntheticPendingFid008 markers and make
  no coverage claims. G4: grep floor/adapter sources for ZERO references to
  SessionState/goal/compaction/approval symbols.

### 2.7 Casting, robustness, assets

- Walkers cast from spawn-event `agentType`/`displayName` against the
  canonical 10-role roster; unknown → generic silhouette. Zero invented
  characters.
- Robustness gates: ResizeObserver resize, DPR clamp [1,2], Tauri
  scale-factor listener, webglcontextlost/restored ticker recreation,
  idempotent dispose (strict-mode double-mount safe), single-window deck v1,
  debug HUD counters.
- Assets: every .glb CC0/MIT sourced (Quaternius/Khronos per research doc),
  Draco/meshopt mandatory.
- Pre-GREEN contract gate: repo-wide PrintModeEvent producer/consumer
  blast-radius grep pasted into the GREEN record before ANY family edit.

### 2.8 Canonical docs

- `docs/design/Savant Visual Workspace Architecture.md` (blueprint)
- `docs/design/Cyberpunk Holographic WebGL Research.md` (renderer research)

### 2.9 Ceilings & quality

300-line/file + 50-line/function absolute; quality scanner owns `desktop/`
from birth; eslint --max-warnings 0; prettier clean. Production smoke stays
NEEDS-REVIEW until rendered in the real Tauri webview (test-renderer-is-not-
a-proxy lesson).

### 2.10 Sequencing note

-010 Steps 4–7 is the sibling critical path; deck P1 can proceed in parallel
(substrate self-contained). Master closes only when ALL children close.

## Part 3 — Session gotchas for the fresh session

1. **Path guards must never depend on launch environment.** Match
   path-intrinsic structure; `canonicalizePath('.')` at module load is a
   trap (this session's rev-1 lesson, now canonical rule
   `no-environment-dependent-guards` in dev/LEARNINGS.md).
2. **EHEL Law-3 tracker credits only in-session commands whose names contain
   lint/typecheck/test** — prettier alone does not clear it; use
   `bunx markdownlint <file>` or `bun x eslint <file>` via
   run_readonly_command.
3. **The markdownlint CLI shim intermittently degrades to usage-output-with-
   exit-0** — treat as unverified; use an API-level probe
   (`import { lint } from 'markdownlint/sync'`) or full lint:md.
4. **Editing a `fixed` FID invalidates its receipt fingerprint.** Stamp
   order: finalize ALL content → compute sha256 over content-minus-receipt
   (scratchpad probe importing
   `@savant-code/agent-runtime/echo/fid-verification-gates`) → single write
   with the real hash embedded. If --check still mismatches, re-run
   `bun run fid:verify <fid> --write` on the live file.
5. **Bun loads the module graph at process start** — runtime fixes are
   restart-gated; verify provenance behaviorally before trusting a fix is
   live.
6. `dev/fids/**`, `dev/nova/**`, `dev/scratchpad/**` are exempt-path writable
   in any FSM phase; everything else needs green/self_correct.
7. Repo-wide lint:md currently exits 1 on PRE-EXISTING findings only
   (`dev/build-orders/`, `docs/design/`, `OpenMausBot-main/`) — zero
   `dev/fids/*` findings; do not chase those inside this program.
8. messageCount deltas from child-run Start/End records classify subagent
   runs mechanically (+3 read pair + text under UPDATE shape; write pair +
   text under successful CREATE shape); extract Start/End records from
   debug/cli.jsonl before attributing stalls to gates.

## Part 4 — Verification state at handoff

- All four amended desktop-suite records prettier-clean.
- Repo-wide `fid:verify --check` PASS.
- Focused suites last green: agent-runtime recorder-stall-check +
  spawn-agents-recorder-stall 21 pass / 0 fail; desktop battery 54/0 (Loop 3
  record); fixtures suite 8/0 (Loop 2 record).
- Working tree uncommitted per release-only-commits convention — the next
  release sweep carries it.