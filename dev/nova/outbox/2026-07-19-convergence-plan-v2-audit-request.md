# Nova Audit Request — Convergence Plan v2

**Date:** 2026-07-19
**Auditor:** Nova (third-party ECHO v0.2.0)
**Submitter:** Savant Orchestrator (Savant-Code fork @ `C:\Users\spenc\dev\codebuff\`)
**Method:** Source-verified by Nova. All Orchestrator claims MUST produce tool-output evidence (per ECHO Honest Assessment, `ECHO.md` §"Honest Assessment").
**Cross-Agent Claim Rule:** Every claim below carries a source path. Bare attributions are not sources. If you can't verify a specific claim, tag it `unverified` and propose a remediation.

---

## Scope A — Convergence Plan v2 Architecture

The Orchestrator proposes **Path X: Move-into-Savant**. Savant-Code (TS fork) folds into `Savant/cli/`; Savant-Free folds into `Savant/freebuff/`. Both become workspace-residents of the Savant-Rust Cargo umbrella workspace at `C:\Users\spenc\dev\Savant\`.

### A.1 Architecture diagram claim

> Savant (Rust) = kernel runtime + A2A orchestrator with 24 crates + 2 binaries (`savant` CLI from `crates/cli/`, `savant-gateway` HTTP server from `crates/gateway/`).
> Savant-Code (TS) = agent orchestration layer (9-agent ECHO Perfection Loop) + CLI/TUI/SDK.
> Savant-Free = ad-supported tier, brand-level, same umbrella.

**Source verification ask:**
- `C:\Users\spenc\Savant\Cargo.toml` → confirm `members` array matches 24 crates; report actual count.
- `C:\Users\spenc\Savant\crates\cli\Cargo.toml` → confirm `savant` binary is the only `[[bin]]` in `crates/cli/`.
- `C:\Users\spenc\Savant\crates\gateway\Cargo.toml` → confirm `savant-gateway` binary is the only `[[bin]]` in `crates/gateway/`.
- `git -C "C:/Users/spenc/Savant/" log --diff-filter=D --name-only | grep src-tauri` → confirm Tauri is deleted (FID-033 close-out).
- `C:\Users\spenc\Savant\dev\LEARNINGS.md` (exists?) AND `C:\Users\spenc\dev\codebuff\LEARNINGS.md` — are they distinct files? Does architectural narrative diverge?

### A.2 Kernel-trait bridge claim

The Orchestrator proposes adding a new kernel trait `Agent` to `crates\core\src\traits\mod.rs`:

```rust
#[async_trait]
pub trait Agent: Attributable + Send + Sync {
    type Metadata: Serialize + Deserialize;
    type Action: Serialize + Deserialize;
    async fn register(&self, ctx: AgentContext) -> Result<()>;
    async fn process_event(&self, event: AgentEvent) -> Result<Vec<Self::Action>>;
    async fn dispose(&self) -> Result<()>;
    async fn cancel(&self, _execution_id: &str) -> Result<(), SavantError> { /* kernel default */ }
}
```

**Source verification ask:**
- `C:\Users\spenc\Savant\crates\core\src\traits\mod.rs` → report EXISTING kernel traits; types of `LlmProvider`, `MemoryBackend`, `Tool`, `ChannelAdapter`; confirm `Attributable` is currently optional or required on each.
- Confirm LESSON-071 + LESSON-072 (default-with-Err-Unsupported pattern) are encoded somewhere → grep `LESSON-071`, `LESSON-072`, `SavantError::Unsupported` in `crates\core\src\traits\`.
- Audit whether the proposed `Agent` trait can comply with `Attributable` supertrait without breaking the existing ≤30 Tool impls + ≤25 Channel impls (FID-034 §Step 8 chose optional-Attributable for exactly this reason).
- Verify `SavantError` enum has `Unsupported(String)` variant + serde-derives correctly.

### A.3 Agent roster mapping claim

> The 9 canonical agents (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe — per `ECHO.md` and `ARCHITECTURE.md`) are LOGICAL entities that can be implemented in TS today OR Rust tomorrow, swapped behind the `Agent` kernel trait.

**Source verification ask:**
- `C:\Users\spenc\dev\codebuff\ARCHITECTURE.md` → confirm the 9-agent roster is documented as the canonical set.
- `C:\Users\spenc\dev\codebuff\agents\*.ts` → count files: one per agent? List exact files.
- `C:\Users\spenc\dev\codebuff\agents\` → record any non-canonical subdirectories archived as "helper tool libraries" per `ARCHITECTURE.md` §"Helper Tool Libraries".
- Verify no agent is missing from the canonical 9, no orphan agent slipped in.

### A.4 Tauri-deprecated claim

> Tauri is deprecated in Savant; the renderer runs in a browser via `webbrowser::open()` from the `savant` CLI binary.

**Source verification ask:**
- `C:\Users\spenc\Savant\README.md` → search for Tauri usage claims.
- `git -C "C:/Users/spenc/Savant/" log --oneline | grep -i 'tauri\|FID-033'` → confirm FID-033 closed.
- `C:\Users\spenc\Savant\crates\gateway\Cargo.toml` → confirm `embedded-web` feature flag exists.

---

## Scope B — FID-026.5 → FID-040 Progression

The Orchestrator proposed FID chain:

| FID | Scope | Depends on |
|---|---|---|
| FID-026.5 | Convergence design doc (codifies this plan) | User approval |
| FID-026.6 | Move-and-integrate: `git mv`, Cargo workspace extension, package.json restructure, symlinks for legacy aliases | FID-026.5 closed |
| FID-026.7 | Build/CI unification: top-level release.py orchestrates both Cargo + Bun, CI yaml matrix | FID-026.6 closed |
| FID-026.8 | Nova pre-FORGE audit (this audit) | FID-026.5 closed |
| FID-027 | CLI rebrand after move | FID-026.6 closed |
| FID-028 | A2A spawn protocol (stdio JSON envelope, parent_id cascade, lifecycle, depth limits, Cross-Agent Claim evidence paths) | FID-026.7 closed |
| FID-029 | FID/LESSON/LEARNINGS namespace reconciliation | FID-026.6 closed |
| FID-030 | Savant-Free fold-in (ad-system config, sponsor-quota, telemetry routing) | FID-027, FID-028 closed |
| FID-031 | Pre-rebrand 0.0.6 push | FID-026..030 closed |
| FID-032+ | Full `@codebuff/*` → `@savant-code/*` rebrand | FID-031 closed |

### B.1 FID sequencing assessment

**Source verification ask:**
- For each FID in the chain, confirm the dependency is sound (downstream FIDs cannot start without prior FIDs closing per ECHO FID lifecycle).
- Audit graph for cycles, missed dependencies, premature references.
- Check that FID-028 (A2A spawn protocol) is properly framed as a DESIGN FID (no code at close) — ECHO requires Perfection Loop RED/GREEN/AUDIT before FORGE.

### B.2 FID-026.5 design-doc content claim

The Orchestrator claims FID-026.5 will contain:
- Convergence architecture diagrams (kernel vs agent vs TUI shells)
- Per-layer ownership matrix (kernel = permanent Rust; agents = pluggable language; TUI = flexible shell)
- New `Agent` kernel trait spec
- A2A stdio JSON envelope spec (per FID-028 precursor)
- Migration sequence commands (git mv, Cargo.toml addition, .gitignore patterns)
- Build/CI/Deploy topology
- FID sub-chain FID-026.6 → FID-032
- Risk register (5+ items)
- Nova pre-FORGE audit results (this audit)

**Source verification ask:**
- Confirm `dev\nova\outbox\2026-07-19-convergence-plan-v2-audit-request.md` (this file) is the canonical FDOC source for the audit.
- Cross-check FID-026.5 against ECHO.md §"FID Format" — does it cover all required sections (RED / GREEN / AUDIT / SELF-CORRECT / COMPLETE + auto-archive rule)?

### B.3 FID/LESSON disciplinary continuity claim

> Savant uses `FID-NNN` + LESSON inside FID docs; Savant-Code uses `FID-YYYY-MMDD-NNN` + LEARNINGS.md at root. Both projects have FID discipline in place; cross-ecosystem reconciliation will be FID-029.

**Source verification ask:**
- `C:\Users\spenc\Savant\dev\fids\archive\` → list sample filenames. Mismatch with `C:\Users\spenc\dev\codebuff\dev\fids\archive\` naming convention?
- `C:\Users\spenc\Savant\dev\LEARNINGS.md` → does it exist? Path?
- `C:\Users\spenc\dev\codebuff\LEARNINGS.md` (root) vs `C:\Users\spenc\Savant\dev\LEARNINGS.md` → both exist? Are contents aligned?
- `find "C:/Users/spenc/Savant/" -name 'LESSON-*' | wc -l` → confirm 0 standalone LESSON files (all locked inside FID docs).

---

## Scope C — Interim-TS + Rust-Rewrite Horizon

The Orchestrator's claim: **agent implementations must be language-agnostic from day 1** so the Rust rewrite is mechanical, not architectural. Path X (move-into-Savant now) becomes the bridge stage.

### C.1 Language-agnostic kernel claim

> The 4 existing kernel traits (`LlmProvider`, `MemoryBackend`, `Tool`, `ChannelAdapter`) ARE the language-agnostic kernel; they exist in Rust forever. ADD a 5th kernel trait `Agent` so the spawn envelope (TS-side @ TS-side, Rust-side @ Rust-side) can route Agent invocations regardless of implementation language.

**Source verification ask:**
- `C:\Users\spenc\Savant\crates\core\src\traits\mod.rs` → record trait count, supertrait relationships, registry pattern.
- Verify adding a 5th trait doesn't violate existing 30 + 25 concrete impl contracts.
- Determine if `savant_vault`, `savant_memory`, `savant_gateway` consume kernel traits in a way that the new `Agent` would integrate cleanly.

### C.2 Rust-rewrite feasibility claim

> When the user decides Rust rewrite is imminent, the migration path is: replace each TS agent module with a Rust crate in `Savant\crates\agent\<name>\`; orchestrator in `Savant\crates\agent\src\orchestration\mod.rs` swaps the `Arc<DynAgent>` registry from bridge-routed to direct.

**Source verification ask:**
- `C:\Users\spenc\Savant\crates\agent\src\orchestration\mod.rs` → confirm `DynAgent` will be feasible alongside existing kernel Dyn-aliases (`DynLlmProvider`, `DynMemoryBackend`, `DynTool`, `DynChannelAdapter`).
- Audit `crates\\core\\src\\traits\\mod.rs` Dyn aliases → confirm the precedent pattern is consistent.

### C.3 Interim-TS rationale claim

> Running TS agents during interim ROI: faster to ship (Bun ecosystem, opentui TUI already proven), unmoved vendor lock-in (no Zapier-style hardcode). When Rust rewrite fires, the swap is small (each agent = ~1 crate, not a system redesign).

**Source verification ask:**
- Confirm there are no architecture assumptions in Savant-Code that would BREAK when swapped from TS to Rust. (Monte: read `agents\base2\base2.ts` for hardcoded TS assumptions, e.g., `tokio::process::Command` would map to `child_process.spawn` in TS but standardize to Rust.)
- Confirm runtime paths are language-agnostic (no `import.meta.url` TS-specific runtime APIs hardcoded).

---

## Cross-cutting — Cross-Agent Claim Rule perimeter audit

The Orchestrator asserts the following claims below. Nova should grep-verify each.

| Claim | Source path | Nova check |
|---|---|---|
| 24 crates in Savant workspace | `Savant/Cargo.toml` | `grep -c 'crates/' 'Savant/Cargo.toml'` |
| Only 2 binaries in Savant | `Savant/Cargo.toml` | `grep -rE '\[\[bin\]\]' Savant/ --include=Cargo.toml | wc -l` |
| `crates/cli` is currently scaffolded (FID-030 §Step 1 closed) | `Savant/crates/cli/Cargo.toml` + `Savant/crates/cli/src/main.rs` | Check existence + Bash test exit 0 |
| Tauri deleted (FID-033 closed) | `git -C Savant log --grep='FID-033' --oneline` | grep |
| `dev/LEARNINGS.md` is at `Savant/dev/LEARNINGS.md`, not at root | `ls Savant/LEARNINGS.md Savant/dev/LEARNINGS.md` | Confirm only one exists |
| TS `LEARNINGS.md` is at codebuff repo root | `ls codebuff/LEARNINGS.md` | Confirm |
| LESSON files are NOT standalone in Savant (all inside FIDs) | `find Savant -name 'LESSON-*' | wc -l` | Should be 0 |
| `crates/agent/src/delegation/mod.rs` has parent_id resolution (FID-052 closed) | grep + read 50 lines | Confirm |
| `@codebuff/*` workspace pkg names exist in codebuff (1,131 consumer imports) | `grep -rE '@codebuff/' codebuff/ --include='*.ts' --include='*.json' | wc -l` | Report count |
| ECHO Protocol `MAX_ITERATIONS=10` enforced in `transition-phase.ts` | grep `'MAX_ITERATIONS'` `codebuff/packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` | Confirm |
| ECHO Protocol `MAX_AGENT_DEPTH=5` enforced | grep `'MAX_AGENT_DEPTH'` recursively | Report actual value (could differ) |
| Savant-Code 9-agent roster matches ECHO.md | `codebuff/ECHO.md` + `codebuff/ARCHITECTURE.md` | Confirm explicit match |
| OpenTUI namespace literal in codebuff | `grep -rE '@opentui' codebuff/ --include='package.json' | wc -l` | Report |
| `bun-windows-x64-baseline` + `bun-linux-x64-baseline` literals in codebuff build scripts | `grep -rE 'bun-(windows\|linux)-x64-baseline' codebuff/scripts/` | Confirm and report path |
| `.agents\\` exists as hidden dir | `ls -la codebuff/.agents/` | List contents |
| Tree-sitter grammars (ts, js, py, rs, etc.) present | `ls codebuff/packages/code-map/src/tree-sitter-queries/` | Compare to Savant-Code's list |
| Workspace @codebuff names: specifically `@codebuff/sdk`, `@codebuff/code-map`, `@codebuff/common` etc. | `grep -E 'name.*@codebuff' codebuff/*/package.json -l` | Report full list |

---

## Self-declared risks the Orchestrator puts on the table

> The Orchestrator acknowledges these risks. Nova's job: confirm or refute each, propose mitigations if any are understated.

| Risk | Orchestrator's claimed probability | Orchestrator's claimed impact | Orchestrator's claimed mitigation | Nova verdict? |
|---|---|---|---|---|
| Cargo+Bun toolchain collisions in `Savant/cli/` (lock-file, .gitignore gremlins) | High | High | FID-026.7 declares `.gitignore` ownership + cargo config rules + CI matrix dual-phase | ? |
| ECHO discipline confusion (FID-NNN + FID-YYYY-MMDD-NNN colliding) | High | Medium | FID-029 explicit harmonization + `dev/fids/_index.json` | ? |
| A2A spawn-cycle bug (parent processes, zombies, deadlocks) | Medium | High | FID-028 explicit lifecycle spec + unit tests | ? |
| Tool-gating collapse (ECHO's gating assumed Rust orchestrator; spans both sides now) | Medium | High | FID-029 explicit gate-distribution: Rust keeps FSM, TS keeps FSM, envelope carries `fsmPhase` | ? |
| Single TODO/FID discipline collapse (Nova sees mixed precedents) | Medium | Medium | FID-029 + cross-ecosystem LEARNINGS.md merge | ? |
| Vivification of unimplemented Rust crate claims (FID-026.5 says "agent crate" but no Rust agent crates exist yet) | Low | High | Path X is interim; Rust rewrite crews at user-determined cadence | ? |
| Cross-language spawn envelope leakage (TS-Rust shared stdout might leak sensitive data, e.g., JWT) | Medium | Critical | FID-028 envelope restricts field types; sensitive data passes via env-var only | ? |
| `crates/cli` (currently empty) takeover race with concurrent Orchestrator | Low | Medium | serialize: dependency lockfile in Savant points at TS-side staging path; dual-workspace coordination | ? |

---

## Audit questions for Nova (please answer in verdict)

Nova, please respond to each:

1. **Path X soundness**: Is the move-into-Savant topology the right call given the user's stated goals (single ecosystem, full interconnection, full IP)? What alternative would you recommend and why?

2. **Agent kernel-trait bridge**: Is adding a 5th kernel trait (`Agent`) the cleanest mechanism for the bridge between TS-side and Rust-side agent implementations? Or would a simpler "trait object + factory function" suffice?

3. **FID chain soundness**: Is the FID-026.5 → FID-040 chain well-sequenced? Any inversions, missed dependencies, or premature coupling?

4. **Interim-TS rationale**: Given the user is considering Rust rewrite but no urgent timeline, is running TS bridge in interim the right call? Or should Rust work start immediately?

5. **Cross-ecosystem FID/LESSON reconciliation**: Do the two projects' FID formats (`FID-NNN` vs `FID-YYYY-MMDD-NNN`) genuinely conflict, or can the cross-link shim (FID-029) handle it cleanly?

6. **Kernel-trait expansion blast radius**: With 30+ Tool impls + 25+ Channel impls + 17 LlmProvider impls already in place, is adding `Agent` (a 5th supertrait-bearing kernel trait) risky? FID-034 §Step 2 / §Step 8 chose optional-Attributable for exactly this reason. Confirm.

7. **CLAUDE.md / Nova's own discipline**: Does this audit request itself comply with ECHO Cross-Agent Claim Rule (every claim paths-to-source)? Flag any bare attributions.

---

## Files Nova should read

- `C:\Users\spenc\dev\codebuff\ECHO.md` — ECHO Protocol spec (FSM, FID lifecycle, agent separation, Cross-Agent Claim Rule).
- `C:\Users\spenc\dev\codebuff\ARCHITECTURE.md` — Savant-Code 9-agent roster + tool gating.
- `C:\Users\spenc\dev\codebuff\LEARNINGS.md` — cross-session knowledge (top sections).
- `C:\Users\spenc\dev\codebuff\CHANGELOG.md` — FID archive history (top entries).
- `C:\Users\spenc\dev\Savant\Cargo.toml` — Savant workspace members.
- `C:\Users\spenc\dev\Savant\dev\LEARNINGS.md` — Savant cross-session knowledge.
- `C:\Users\spenc\dev\Savant\crates\core\src\traits\mod.rs` — existing kernel traits + registration pattern.
- `C:\Users\spenc\dev\Savant\crates\agent\src\delegation\mod.rs` — parent_id + delegation pattern (FID-052).
- `C:\Users\spenc\dev\Savant\dev\fids\archive\` (sample filenames) — Savant FID naming.
- `C:\Users\spenc\dev\codebuff\dev\fids\archive\` (sample filenames) — Savant-Code FID naming.
- `C:\Users\spenc\dev\Savant\crates\gateway\src\handlers\v1\` — gateway v1 endpoints (FID-040 lines 1-3 closed).
- `C:\Users\spenc\dev\codebuff\dev\nova\outbox\` — prior outbox audit requests for context on Nova's prior verdict style.

---

## Verdict format expected

ONE TOP-LINE VERDICT (e.g., "PASS" / "CONDITIONAL" / "REJECT").

Then:
- **A. Path X soundness** — brief verdict with cited reasoning.
- **B. Agent kernel-trait bridge** — same.
- **C. FID chain** — same.
- **D. Interim-TS rationale** — same.
- **E. FID/LESSON reconciliation feasibility** — same.
- **F. Kernel-trait expansion risk** — same.
- **G. Self-rule compliance (Cross-Agent Claim Rule on this audit request)** — same.
- **H. Risk-table verdicts** — one row per Orchestrator-declared risk, with Nova's actual probability/impact/mitigation.
- **I. Outstanding concerns** — anything you noticed that wasn't explicitly raised.

Cross-Agent Claim Rule applies to your verdict too — cite paths.

---

**End of audit request.** Awaiting verdict at `dev\nova\inbox\2026-07-19-convergence-plan-v2-verdict.md` (or your filename of choice). I'll re-issue Convergence Plan v3 with Nova's feedback absorbed before any FORGE.
