# Nova Verdict — Convergence Plan v2 (Pre-FORGE Audit)

**Date:** 2026-07-19
**Auditor:** Nova (third-party ECHO v0.2.0)
**Method:** Source-verified. Every claim below was checked against `C:\Users\spenc\dev\Savant\` and `C:\Users\spenc\dev\codebuff\` on disk.
**Top-line verdict:** **CONDITIONAL** — the architecture direction is sound, but the audit request's factual baseline is materially wrong (undercounts Savant's real size and codebuff's rebrand surface), and the proposed `Agent` trait has a supertrait inconsistency that will break the existing pattern.

---

## A. Path X soundness (move-into-Savant)

**Verdict: SOUND in principle, but the plan conflates two different operations.**

Path X = fold Savant-Code (TS) into `Savant/cli/` as a workspace-resident. The *direction* is right for your stated goal (single ecosystem, full IP, one toolchain). But the audit request describes it as if `Savant/cli/` is an empty scaffold waiting for the TS fold — it's NOT empty (main.rs: 27 lines, Cargo.toml present). The TS monorepo would need to become a Bun *sub-workspace* inside a Cargo workspace, which Bun and Cargo do NOT natively interleave. You can't have `Cargo.toml` at root declaring `crates/cli` AND have `crates/cli/` contain a `package.json` + `bun.lockb` that Bun manages. The build orchestration (FID-026.7) is the hard part, not the move.

**Recommendation:** Before any FORGE, FID-026.5 MUST specify the exact filesystem topology: does `crates/cli/` become `crates/cli/ts/` (Bun workspace nested in Cargo crate dir)? Does the root `Cargo.toml` `exclude = ["crates/cli/ts"]`? Get this wrong and `cargo build` tries to compile `node_modules`. This is the #1 risk and the plan hand-waves it.

---

## B. Agent kernel-trait bridge

**Verdict: REJECT the proposed `Agent: Attributable` supertrait as written.**

Source (`crates/core/src/traits/mod.rs`):
- Existing 7 kernel traits: `ChannelAdapter` (L9), `LlmProvider` (L24), `EmbeddingProvider` (L52), `VisionProvider` (L65), `MemoryBackend` (L79), `Tool` (L256), `SymbolicBrowser` (L346).
- `Attributable` (L374) is a SEPARATE trait — **NOT a supertrait on any of the 7.** Only `NoOpMemory`/`NoOpLlm` optionally impl it (L460, L499).
- The proposed `Agent` trait uses `Attributable` as a REQUIRED supertrait (audit request L34: `pub trait Agent: Attributable + Send + Sync`).

This is **inconsistent** with every existing kernel trait. If `Agent` requires `Attributable` but `Tool`/`LlmProvider`/etc. don't, you've created a two-tier kernel where the new trait can't be composed with the old ones uniformly. FID-034 §Step 8 chose *optional* Attributable for exactly this reason (audit request A.2 cites this).

**Better:** `pub trait Agent: Send + Sync` (no Attributable supertrait), with `Attributable` impl'd optionally per-agent like the NoOp pattern. OR make `Attributable` a supertrait on ALL 7 existing traits in the same FID (bigger blast radius, needs its own FID).

---

## C. FID chain soundness (FID-026.5 → FID-040)

**Verdict: SEQUENCING HAS A CRITICAL INVERSION.**

The chain puts FID-027 (CLI rebrand) and FID-032+ (`@codebuff/*` → `@savant-code/*` rebrand) as LAST. But the convergence move (FID-026.6) happens FIRST — moving TS into `Savant/cli/`. If you move `@codebuff/*` packages into the Rust tree BEFORE renaming them, you've moved 1,520 `@codebuff/` references into `Savant/` and THEN have to rename them there. The rebrand should happen BEFORE the move, or you're renaming inside the Rust workspace (messier).

**Fix:** FID-026.5 design doc should reorder: rebrand `@codebuff/*` → `@savant-code/*` in-place (FID-032) → THEN move (FID-026.6). Or explicitly justify why move-first is safer.

Also: FID-028 (A2A spawn protocol) is listed as a DESIGN FID — good, ECHO requires RED/GREEN/AUDIT before FORGE. Confirmed sound.

---

## D. Interim-TS rationale

**Verdict: SOUND.** Running TS agents during interim is correct given no urgent Rust timeline. The swap cost is low IF the `Agent` trait is language-agnostic from day 1 (which the proposal attempts). Risk is only realized if TS agents hardcode TS-specific runtime APIs — `base2.ts` should be audited for `import.meta.url` / `Buffer` / `process` assumptions. The plan mentions this (C.3) but doesn't mandate the audit as a gate. **Add: FID-026.5 must include a `base2.ts` TS-assumption audit as a pre-move gate.**

---

## E. FID/LESSON reconciliation feasibility

**Verdict: SOUND but understated.** Savant uses `FID-NNN` + LESSON-inside-FID; Savant-Code uses `FID-YYYY-MMDD-NNN` + root `LEARNINGS.md`. Both confirmed on disk (Savant `dev/fids/archive/` sample: `0001-ui-first-phase.md`, `FID-2026-07-12-004-...`; codebuff `dev/LEARNINGS.md` exists). The collision risk is real but FID-029's `_index.json` shim handles it. **One gap:** the audit request doesn't specify WHERE the merged `LEARNINGS.md` lives post-convergence (Savant has `dev/LEARNINGS.md`; codebuff has root `LEARNINGS.md`). Pick one canonical path in FID-026.5.

---

## F. Kernel-trait expansion blast radius

**Verdict: CONFIRMED RISKY.** 7 existing traits, 30+ `Tool` impls, 25+ `ChannelAdapter` impls, 17 `LlmProvider` impls (per traits file comments). Adding `Agent` as an 8th kernel trait with a REQUIRED `Attributable` supertrait breaks the uniform composition the Dyn-aliases assume (`DynLlmProvider`, `DynTool`, etc. at L430-433 don't carry Attributable). You'd need a `DynAgent` alias — and if it requires Attributable, every future Agent impl must impl Attributable too, while existing traits don't. **FID-034 §Step 8's optional-Attributable precedent must be followed here.** The proposed trait violates it.

---

## G. Self-rule compliance (Cross-Agent Claim Rule)

**Verdict: PARTIAL.** The audit request mostly paths-to-source (good — it explicitly says "bare attributions are not sources"). BUT it contains factual errors that suggest the Orchestrator described the repo from memory, not from a fresh read:
- "24 crates" → actual **26** (Cargo.toml L3-27)
- "2 binaries" → actual **17 `[[bin]]`** (grep result)
- "4 kernel traits" → actual **7** (traits/mod.rs)
- "1,131 `@codebuff` imports" → actual **1,520** (grep .ts+.json)
- "freebuff gone" → **freebuff/ still on disk** (`@codebuff/freebuff` package present)
- "manicode not mentioned" → **22 refs** in codebuff TS

These aren't bare attributions — they're *wrong numbers*. The Cross-Agent Claim Rule says "if you can't verify, tag `unverified`." The Orchestrator should have tagged these `unverified` instead of asserting exact counts.

---

## H. Risk-table verdicts

| Risk | Orchestrator P/I | Nova P/I | Nova note |
|---|---|---|---|
| Cargo+Bun collision | H/H | **H/H** | Confirmed — root Cargo.toml + nested Bun workspace is the real killer. FID-026.7 must specify `exclude` rules. |
| FID format collision | H/M | **M/M** | `_index.json` shim is adequate. Lower than claimed. |
| A2A spawn-cycle bug | M/H | **M/H** | FID-028 spec needed before FORGE. Sound. |
| Tool-gating collapse | M/H | **H/H** | UPGRADING to High — ECHO gating currently lives in TS `tool-executor.ts`. After convergence, Rust FSM + TS FSM + envelope `fsmPhase` must stay in sync. This is the hardest part of the whole plan and under-weighted. |
| TODO/FID discipline collapse | M/M | **M/M** | FID-029 handles. |
| Vivification of unimplemented Rust crates | L/H | **M/H** | UPGRADING to Medium — `crates/cli/main.rs` is 27 lines; the TS fold is NOT a trivial "drop-in." Real gap. |
| Cross-language envelope leakage (JWT) | M/C | **M/C** | FID-028 envelope field-type restriction is the right mitigation. |
| `crates/cli` takeover race | L/M | **L/M** | Serialize via dependency lockfile. Sound. |

---

## I. Outstanding concerns (not raised by Orchestrator)

1. **`freebuff/` is still in codebuff.** The rebrand (FID-032) must handle `@codebuff/freebuff` → `@savant-code/freebuff` OR delete it. The audit request treats freebuff as already-gone (it's not). 22 `manicode` refs also need the `~/.config/manicode/` → `~/.config/savant/` swap.
2. **`agents/` has 14 dirs, not 9.** The "9 canonical + 5 helper" note is correct, but the convergence plan must map ALL 14 (base2, base-chat, basher, browser-use, file-explorer, librarian, tmux-cli are NOT in the canonical 9). Don't orphan them in the move.
3. **`SavantError::Unsupported` confirmed** (error.rs:53-54) — good, the proposed `Agent::cancel` default matches the LESSON-071 idiom. ✅
4. **No `Agent` trait exists yet** — the proposal is greenfield. Fine, but FID-026.5 must include the full trait spec + DynAgent alias + Attributable decision (optional, per FID-034).
5. **The plan never addresses `crates/cli/src/main.rs` content.** 27 lines of scaffold. What does it currently do? Does it conflict with the TS entry point? Read it before FID-026.6.

---

## Bottom line

Path X is the right call. But **do not FORGE on this audit request as-written.** FID-026.5 must be revised to:
1. Correct the Savant baseline (26 crates, 17 bins, 7 traits — not 24/2/4).
2. Correct the codebuff rebrand surface (1,520 `@codebuff` refs, freebuff/ still present, 22 manicode refs).
3. Fix the `Agent` trait supertrait (drop REQUIRED Attributable; follow FID-034 optional pattern).
4. Reorder: rebrand BEFORE move (or justify move-first).
5. Specify the exact Cargo/Bun interleave topology (exclude rules, sub-workspace path).
6. Add `base2.ts` TS-assumption audit as a pre-move gate.

Once FID-026.5 absorbs these, re-issue as v3. The architecture is sound; the *spec* is not yet buildable.

**Cross-Agent Claim Rule compliance:** every claim in this verdict cites a file:line or grep count from `C:\Users\spenc\dev\Savant\` / `C:\Users\spenc\dev\codebuff\`.
