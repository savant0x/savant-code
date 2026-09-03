<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Sign-off Request — FULL v0.0.28 Release (entire v0.0.27 → 0.0.28 delta)

**Date:** 2026-09-02
**Requested by:** Orchestrator (single-agent ECHO v0.1.2 session, operator directive "release ready audit")
**Supersedes:** the earlier same-day request scoped to the audit session only — this document covers the **whole release delta** as the operator directed ("this signoff request is prob 1/100th of the work that has been done since the last version — the changelog alone tells you that").
**Requested review:** a full independent implementation + record-honesty audit of everything shipped between `v0.0.27` (2026-08-21, commit `3c3d7d2`) and the 0.0.28 release tree, then a release verdict.

---

## 1. The size of what is being signed off (measured, not asserted)

| Dimension | v0.0.27 → 0.0.28 delta |
|---|---|
| Commits on main | **30** (plus the uncommitted 0.0.28 working-tree delta the operator directed be completed) |
| Tracked diff | **650 files changed, 80,195 insertions, 1,810 deletions** (425 files / **+40,599** in TS/TSX alone) |
| New TS/TSX modules added untracked by the final sessions | 36 files (deck office, mini-chat island, traffic lights, status panels, gateway client/protocol, hooks, tests) |
| CHANGELOG entries in the window | **64 dated sections** (2026-08-21 … 2026-09-02) |
| FIDs closed + archived in the window | **35 closures**; distinct FIDs referenced: **71**; archive now holds 291 records |
| Master programs landed | **Compaction integrity rebuild** (-0824-022 master + 5 children) · **Eval system rebuild v3** (-0824-013 master + 6 children) · **Desktop program** (-0820-009 shell, -0820-010 chat UI + Auto Drive dashboard, -0824-009 workspace regions) · **Command deck** (-0822-012 → 0824-011 driver → 0828-002/0829-001 → 0831-001/002 rebuild) · **Desktop CLI parity** (FID-0901-006, 36 passes) |
| Enforcement-layer changes | Laws 1/4 universal hard blocks (-0823-007), EHEL harness growth, protocol bundle regenerated |

This is closer to a minor-version rewrite than a patch. The sign-off requested here is
therefore a **release-scale audit**, not a spot check.

---

## 2. What the release contains (by program, with closure evidence)

### 2.1 Compaction integrity rebuild — master FID-2026-0824-022 + children -023…-027
Closed 2026-08-24 with live smokes waived by operator directive (recorded per-FID). Delivered:
visibility/transparency layer, preservation contract + digest schema, minimal-surgery
algorithm, evidence spill + `requiresRawEvidence` splice, removed-content ledger + metrics +
model notice. Post-closure sweep folded back every silently-deferred item (CHANGELOG 08-24).
Follow-on fix FID-2026-0828-001 made `/compact` actually emit the summary (the streamed-buffer
capture was provably dead code for the programmatic pruner; recovery from
`<historical_memory>` implemented) — **live-confirmed by the operator 2026-08-28**.

### 2.2 Eval system rebuild v3 — master FID-2026-0824-013 + children -014…-019
Closed 2026-08-25: FSM alignment + trajectory assertions, sandbox hardening, skill-efficacy
engine, governance corpus + bounded autorater + Tier-1 pre-push smoke, self-improvement
erosion regression guard, capability ingestion + Tier-3 release pipeline.
**Current metrics (run fresh 2026-09-02): Benchmark v2 = 9/9 PASS (0 errors, 0 timeouts);
Tier-1 governance smoke = 5/5 PASS.** Report: `evals/v2/reports/report.md`.

### 2.3 Desktop program (Tauri v2)
- **-0820-009** shell + Rust sidecar supervisor (spawn/backoff/watchdog), closed + archived;
  real-sidecar E2E 4/4 green recorded in-file.
- **-0820-010** structured no-terminal chat + Auto Drive dashboard + Emergency Halt, closed
  + archived 2026-08-25.
- **-0824-009** workspace regions + scoped FID events, closed + archived 2026-08-25.
- **FID-2026-0901-001** sidecar env forwarding + SDK client init (`fixed` → archived
  2026-09-02): the boot crash-loop and chat-send failure fix; discharged by the operator's
  live use of the app across 09-01…09-02.

### 2.4 Command deck (3D) — the four-generation arc
-0822-012 (holographic deck master, closed by operator waiver 08-25 with 7/7 gates live PASS)
→ -0824-011 (live gateway event driver, 3/3 gates) → -0828-002 (emissive/palette defect fix)
+ -0829-001 (six activity layers + lane-alignment) → **-0831-001/-002 R3F neon-noir office
rebuild** (robot cast with role accents + rims, walk-to-station on live tool calls,
obstacle-aware routing, beacons, speech bubbles, day/night, follow-cam). All closed +
archived 2026-09-02 with re-stamped live gate receipts; visual acceptance discharged by the
operator across five native sessions (the waiver rationale is in each Loop record).

### 2.5 Desktop CLI-parity program — FID-2026-0901-006 (36 passes, P19–P36)
Timestamps under messages, model display + real model-resolved context window, markdown
bubbles with traffic lights, "Savant roster" rename, followups/tooltips, FID-queue boot sync
(`connectOnce` — panel 0 → 27 open, verified live over CDP on a fresh boot), deck mini-chat
island, scratchpad auto-management (hygiene guard + README contract), composer auto-grow,
dev-gated logging. Archived 2026-09-02; gates in-file per pass.

### 2.6 Enforcement, Recorder, and harness remediations
-0823-011/-012/-014 (Recorder stall + relay ladder), -0823-007 (Laws 1/4 hard blocks),
-0824-031 (Forge Law-1 deadlock), -0824-029/-031 adversarial output formatting, -0827-001
(sidebar context stall), hybrid-mode escalation retuning 20→100 lines, protocol-bundle
regeneration, model migration to `z-ai/glm-5.3-flash`, Nous `tags` fix — all closed and
archived with gate receipts (CHANGELOG entries 08-23…08-28).

### 2.7 Discord Rich Presence refinements
Enabled by default; client id **hardcoded** to the Savant application
(`preferences.ts:87`, the operator's rotated id `1539431002089328710` — Law-4 grep:
defined once, consumed only by `commands/presence.ts`); three-line activity layout;
provider-trimmed model labels; `openrouter/free` → "OpenRouter Free". Operator
live-confirmed on Discord.

---

## 3. Record-honesty repair done in this audit (mechanical, all evidence-backed)

`validate:repository` was failing with **339 issues**: 299 pre-existing quality-ratchet
backlog (paused program, see §5) and **40 FID-ledger issues from this release's own
sessions**. The 40 were repaired: standard metadata restored on four deck FIDs, required
sections (Summary / Perfection Loop / Missed Questions / Code Verification Evidence /
Resolution) written from passes already recorded in-file, two forbidden `**Author:**`
fields removed, one `sha256:machine-generated` placeholder replaced by a real stamped
receipt, one malformed receipt line replaced, three archived `-0822-013` superseded steps
given explicit `deferred::operator-approved 2026-08-23` markers, and stale receipts
re-stamped via live gate runs. Seven FIDs then closed + archived (statuses had sat at
`created`/`analyzed` while implementation records accumulated in-file). FID issues: **40 → 0**;
`bun run fid:verify --check` → **PASS**.

One code-level defect surfaced during the audit's gate runs: the CLI registry-gating P21
test was coupled to ambient `DIRECT_PROVIDER` at module-import time (failed only in
full-suite order). Fixed by asserting the pure `buildSlashCommands` builder in both
directions; no product code touched.

---

## 4. Gate evidence for the release tree (run fresh 2026-09-02)

| Gate | Result |
|---|---|
| Typecheck ×4 (sdk, common, agent-runtime, cli) + desktop | all exit 0 |
| Desktop suite | **352 pass / 0 fail** |
| Floor suite | 202 pass / 0 fail |
| CLI suite | **1362 pass / 0 fail** |
| Common suite | 658 tests, 0 fail |
| SDK suite | 493 pass / 0 fail |
| agent-runtime echo suite | 157 pass / 0 fail |
| `eslint . --max-warnings 0` | PASS (0 errors, 0 warnings) |
| `prettier --check .` | PASS |
| `lint:md` | PASS |
| `hygiene:check` | PASS (incl. the new scratchpad-clutter guard) |
| `fid:verify --check` (291 archived + 13 active FIDs) | PASS |
| **Benchmark v2** | **9/9 PASS** |
| **Tier-1 governance smoke** | **5/5 PASS** |
| `validate:repository` | FAIL — **298 issues, all `quality.ratchet`** (§5) |

---

## 5. The one failing gate, stated plainly

All 298 remaining `validate:repository` issues are `quality.ratchet` file-length violations:
287 pre-existed at `v0.0.27` HEAD (the operator-paused FID-2026-0819-005 program —
"call it good for now", 2026-08-21, "241 violations intentional / fail-closed") plus a net
+11 from the release's own growth (e.g. `office-scene.tsx` 2127 lines, `gateway.ts` 1006,
`native.ts` 895 — the deck rebuild and desktop program are structurally over the 300-line
ceiling; remediation belongs to the paused decomposition program, not to this release).
Tree-vs-HEAD delta was computed honestly: 31 new violation lines, 20 resolved, `single-block.tsx`
rebaselined 214→219 per the documented convention. **No ratchet issue was hidden, reclassified,
or claimed as fixed.** Nova is asked to rule (§7 Q3) rather than let this gate fail silently.

---

## 6. Boundaries and known incompletes (declared, never claimed)

1. Live visual acceptance for the deck was **operator-discharged** (waiver rationale per
   FID), not machine-verified; 28 CHANGELOG lines in the window carry waiver/boundary
   language.
2. FID-2026-0824-012 (self-improving harness) sits `fixed` with NEEDS-REVIEW live
   boundaries (fail-open hooks in HYBRID, `/skills trust` in real TUI, SessionEnd Scribe
   review) — still active, not archived.
3. `-0820-007` / `-0823-003` masters remain open pending the shelved packaging FID
   `-0820-011` (release-time Loop-4 checklist).
4. `bun test scripts/` repo-wide times out on this machine (pre-existing); targeted script
   suites (hygiene 6/6, gateway-client 14/14, registry-gating 6/6) pass.
5. 30 commits exist but the 0.0.28 working tree is intentionally uncommitted/unreleased
   (G1: no agent-driven git; the operator commits and pushes).

---

## 7. Requested verdicts

1. **Per-program implementation audits**: for each of §2.1–2.7, PASS/FAIL on "implemented as
   converged, recorded honestly" — with spot re-verification of gates in archived FIDs.
2. **Record repair (§3)**: is the 40→0 ledger repair Nova-acceptable (nothing asserted over
   evidence)?
3. **Ratchet debt (§5)**: release 0.0.28 with the 298-issue paused-program backlog
   documented, or block release until the ratchet resumes?
4. **Boundaries (§6)**: acceptable to ship with these declared?
5. **Overall**: PASS / FAIL for shipping 0.0.28.

— Orchestrator, ECHO v0.1.2 single-agent session, automation level 3
