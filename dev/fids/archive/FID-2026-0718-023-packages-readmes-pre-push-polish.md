# FID-2026-0718-023 — medium — Internal Workspace README Audit + Polish (packages/* + others)

**Status:** RED proposing v1. Awaiting user approval of 4 inline decisions before FORGE (per ECHO Law 2). NOT modifying any internal workspace READMEs yet.
**Severity:** medium (internal workspaces ship in monorepo only — not directly npm-published except sdk; quality is contributor-experience not consumer-facing)
**Opened:** 2026-07-19

---

## Honest Correction (Cross-FID)

FID-2026-0718-022 explicitly deferred internal workspace README work to FID-023 per Decision E ("DEFER to FID-023 (focused audit first to see what exists)"). FID-023 picks up that hand-off. FID-022 POLISHED the 3 public-facing READMEs (sdk, cli, savant-free); FID-023 applies the same pattern at scale to internal workspaces.

---

## Problem (RED — verified)

User feedback (2026-07-19): *"Open FID-023 for packages/agent-runtime + packages/code-map + packages/database + packages/llm-providers (and any other internal workspace) README.md audit + polish — batch follow-up after FID-022 closes."*

Verified via:
- 11 workspace dirs exist (agents, cli, common, evals, savant-free, packages/agent-runtime + code-map + database + llm-providers, scripts/tmux, sdk)
- 4 README.md files exist (cli=84L, savant-free=41L, scripts/tmux=340L, sdk=267L)
- 7 README.md files MISSING entirely (agents, common, evals, packages/agent-runtime, packages/code-map, packages/database, packages/llm-providers)
- Substitution audit on existing 4: all CLEAN (0 hits for SavantClient/@savant-code/SAVANT_FREE_MODE/SAVANT_CODE_API_KEY)
- Only `sdk/` is PUBLIC (`private: false`); all others are PRIVATE — meaning only `sdk/README.md` ships to npm registry. Other READMEs are contributor-facing only.

---

## RED Inventory — Per Workspace

### Existing READMEs (4 — POLISH scope)

| Workspace | Lines | Public/Private | Quality | Gap |
|-----------|-------|----------------|---------|-----|
| `sdk/README.md` | 267 | **PUBLIC** | CLEAN substance (Installation / Prerequisites / Usage / API Reference / License) + 0.0.2-clean | NONE (FID-022 already handles; defer from FID-023) |
| `cli/README.md` | 84 | PRIVATE | Internal dev README (Installation / Development / Testing / Build / Run / Features) | Banner image + Quick Start cross-link to root + ECHO mention |
| `savant-free/README.md` | 41 | PRIVATE | Already polished + cross-link + tagline | Features matrix + ECHO mention + project structure fix |
| `scripts/tmux/README.md` | 340 | PRIVATE | Substantial — tmux test scripts documentation | Banner image + ECHO mention + cross-link parity |

### Missing READMEs (7 — CREATE or SKIP scope)

| Workspace | Description (from package.json) | Public-facing? | npm-published? |
|-----------|----------------------------------|----------------|----------------|
| `agents/` | Public agent definitions shipped with the CLI | Indirect (CLI consumes) | NO (private) |
| `common/` | Shared types, tool definitions, utilities | Internal | NO (private) |
| `evals/` | Buffbench benchmark runner + public eval fixtures | Internal | NO (private) |
| `packages/agent-runtime/` | Agent loop, tool executor, LLM API integration | Internal | NO (private) |
| `packages/code-map/` | tree-sitter code indexing, language detection | Internal | NO (private) |
| `packages/database/` | Database abstraction layer | Internal | NO (private) |
| `packages/llm-providers/` | Public LLM provider shims | Mixed (shims are public, package is private) | NO (private) |

---

## Cross-FID Dependencies

| Dependency | Direction | Status |
|------------|-----------|--------|
| FID-021 archived (root README) | FID-023 cross-links to root via `../README.md` | ✅ AVAILABLE |
| FID-022 RED opened (sdk/cli/savant-free) | FID-023 lifts FID-022's cli + savant-free polish scope | ⚠️ FID-022 not yet FORGED |
| FID-017 workspace pkg namespace (`@savant-code/*`) | FID-023 must use `@savant-code/*` not `@savant-code/*` | ✅ ASSUMED |
| FID-015 cross-FID correction on `symmetric` | N/A (different domain) | ✅ N/A |

---

## Missed Questions (Q1-Q14, all source-cited)

### Q1. Should FID-023 CREATE the 7 missing READMEs, or LEAVE them missing + polish only existing 4?
**A:** 🎯 **DECISION A** — design choice. Options:
  - Option A (CREATE_ALL_7): Generate minimal-but-useful READMEs for missing workspaces (~30-40 min extrapolated). Pros: complete documentation parity; contributor onboarding is easier. Cons: scope expansion; quality may be inconsistent with existing READMEs.
  - Option B (POLISH_ONLY): Touch only the 4 existing READMEs. Pros: tight scope. Cons: contributors working on missing-workspace packages have no in-package orientation; agents/common/etc. have no use-case description.
  - Option C (CREATE_MINIMAL_STUBS): Create the 7 missing with 5-7 line stub (Purpose + Quick Start + cross-link to root). Pros: consistency baseline with public READMEs (which all have cross-link to root); minimum viable orthogonality.

### Q2. Should the existing 4 READMEs get the FID-022 treatment (banner + badges + ECHO mention + cross-link)?
**A:** ✅ YES for `cli/README.md`, `savant-free/README.md`, `scripts/tmux/README.md`. NO for `sdk/README.md` (FID-022 has scope). The FID-022 pattern (banner width=650, 5 badges, ECHO 1-paragraph mention, cross-link footer) extends easily to internal READMEs.

### Q3. Should missing READMEs include description, key features, and usage examples?
**A:** ⚠️ DECISION A — depends on scope chosen. RECOMMENDATION: for `agents/`, `common/`, `evals/`, `packages/agent-runtime/` (used by CLI runtime), include short Purpose + Quick Start. For database/code-map/llm-providers (more specialized), include purpose + cross-link to ECHO.md / root.

### Q4. Should `scripts/tmux/README.md` (340 lines) get the FID-022 polish?
**A:** ✅ YES — current README is `[tmux TUI Testing Scripts]` header with Quick Start + send-keys sections + Features table. Adding banner + ECHO mention + cross-link footer is the FID-022 pattern applied. Task: ~10 min.

### Q5. Should the existing `scripts/tmux/README.md` skip the banner (since it's dev tooling, not end-user)?
**A:** ⚠️ **DECISION D** — recommend YES for `scripts/tmux` because it's contributor-facing only (private workspace). Banner is okay but lower priority.

### Q6. Will creating 7 new READMEs ship to npm publish?
**A:** ✅ NO — all 7 missing-workspace READMEs target PRIVATE packages; they're in-repo contributor guides, not consumer-facing. Only `sdk/README.md` ships to npm (per basher ground truth: only sdk has `private: false`).

### Q7. Are any of the missing-README workspaces actively consumed by external users (via npm or otherwise)?
**A:** ✅ NO — all 7 missing-workspace packages are PRIVATE; they're internal implementation details of the SDK + CLI runtime. External users interact through the SDK CLI surface, not directly with these packages.

### Q8. Should FID-023 include any accuracy audit on existing content (e.g., fix typos, outdated code references)?
**A:** ⚠️ VERIFY — basher ground truth didn't include content audit. RECOMMENDATION: spot-check existing 4 READMEs for stale references (e.g., `bun run dev:savant-free` in any README would be invalid post-FID-021). No hits expected (substitution audit confirmed CLEAN); minor polish ok.

### Q9. Should FID-023 touch `LICENSE` files in each internal workspace?
**A:** ❌ OUT of scope — FID-024 is the LICENSE audit FID (mentioned in FID-022 Q7). Each internal workspace LICENSE is up to the owner decision on MIT vs Apache-2.0.

### Q10. Should FID-023 update CHANGELOG.md at the end?
**A:** ✅ YES — standard FID close-out practice (per FID-021 + FID-022 pattern). Top entry = FID-2026-0718-023 with Resolution description.

### Q11. Should `evals/README.md` include reference to Buffbench benchmark?
**A:** ⚠️ TARGETED — if `evals/` README exists, it should reference the Buffbench benchmark suite (the workspace IS the benchmark runner per root README Repo Map table). Decision A scope determines if this is auto-included.

### Q12. Are any `@savant-code/*` references still hidden in workspace README drafts?
**A:** ✅ NO — greenfield drafts can use `@savant-code/*` exclusively per FID-017 Option C.

### Q13. Will FID-023 FORGE overlap with FID-022's later FORGE phase?
**A:** ⚠️ **BLOCKER CONSIDERATION** — FID-022 hasn't FORGED yet (awaiting user approval). If user approves FID-023 first and FORGEs it, FID-022 will need to coordinate cross-FID. **RECOMMENDATION: FID-022 FORGEs first, then FID-023 (sequential dependency to avoid index-shifted line number conflicts in root README cross-FID SavantClient fix).** This is a sequencing constraint surfaced honestly.

### Q14. Is there an existing README template (e.g., `templates/README-TEMPLATE.md`, `templates/SESSION-SUMMARY.md`)?
**A:** ✅ YES — `templates/` directory has SESSION-SUMMARY + FID-TEMPLATE, but no README-TEMPLATE. FID-023 can introduce `templates/README-TEMPLATE.md` (OpenTUI standard pattern: banner + badges + Title + 1-line description + Installation + Usage + Features + ECHO + License + Footer). Decision E pending.

---

## GREEN Plan — 5 Steps (~35 min if Option C; ~75 min if Option A)

### Step 1 (~10 min) — Polish existing 3 internal READMEs (cli, savant-free, scripts/tmux)
Apply FID-022 pattern. Reuse `assets/banner.png` (reduced width 650px). Add badge block (5 badges: workspace-type / Bun-ts-tested / License / ECHO v0.2.0 / Status). Add ECHO Protocol 1-paragraph mention (cross-link to root + ECHO.md). Footer cross-link to `../README.md`. **EXCLUDE sdk/README.md** (FID-022 scope).

### Step 2 (~10-30 min depending on Decision A) — Create missing READMEs (7)
Draft minimal README for each of the 7 missing workspaces. If Option A (CREATE_ALL_7): ~30 min (4-5 min per README). If Option C (CREATE_MINIMAL_STUBS): ~10 min (~1.5 min per README, ~7-10 lines each).

### Step 3 (~5 min) — README template (if Decision C approved)
Create `templates/README-TEMPLATE.md` with the standard structure for future workspace contributions.

### Step 4 (~5 min) — Markdownlint baseline check
Verify no new MD0xx issues on the 3 polished + 7 new READMEs (via user IDE Problems panel re-paste or `bunx markdownlint` if available).

### Step 5 (~5 min) — AUDIT Verification Gate
Run 6-item check (defined below).

**Total estimated time:**
- Option A (full): ~75 min
- Option B (polish only): ~20 min
- Option C (stubs): ~35 min

---

## AUDIT Verification Gate (6 items)

1. **Existing 3 polished READMEs have banner + ECHO mention + cross-link footer** — verify by reading first 5 lines and last 5 lines of each
2. **All 11 workspaces have either a current README OR a documented stub decision** — verify via `find {agents,cli,...} -name 'README.md'`
3. **NO stale `@savant-code` / `SAVANT_FREE_MODE` / `SAVANT_CODE_API_KEY` / `dev:savant-free`/`build:savant-free` references in any of the 4-11 READMEs** — grep audit
4. **NO `SavantClient` references** (cross-FID consistency with FID-022 Decision D) — grep `SavantClient` across all README.md; should be 0
5. **All `../README.md` cross-link targets actually exist** — verify relative paths resolve to root
6. **CHANGELOG.md top entry = FID-2026-0718-023** — verify `head CHANGELOG.md`

---

## 4 Inline Decisions for User Approval

### Decision A — Missing-README scope
**🎯 THE BIG ONE:**
- **Option A (CREATE_ALL_7):** Generate substantive READMEs (~30 min) — pros: contributor onboarding parity; cons: scope expansion
- **Option B (POLISH_ONLY):** Skip creation entirely (~0 min) — pros: tight scope; cons: contributors to agents/common/etc. have no in-package orientation
- **✅ Option C (Recommended):** CREATE_MINIMAL_STUBS — 7 stub READMEs at ~10 lines each (~10 min) — pros: parallel with FID-022 pattern; minimum viable; cons: developer may want more depth later

### Decision B — Sequential ordering with FID-022
- **✅ Option A (Recommended):** WAIT FOR FID-022 FORGE first, then FID-023 — avoids cross-FID line shifts in root README
- Option B (PARALLEL): Risk that FID-022's later root README update shifts line numbers and breaks FID-023's cross-link referendas

### Decision C — Template at templates/README-TEMPLATE.md
- **✅ Option A (Recommended):** ADD template — future workspace contributions follow the established pattern
- Option B (SKIP): Reuse the same content from FID-022 / FID-023 docs without abstracted template

### Decision D — Banner inclusion for internal READMEs
- **✅ Option A (Recommended):** ADD banner to all internal READMEs (including scripts/tmux) — maintains visual hierarchy even if not consumer-facing
- Option B (SKIP banner for internal): Less visual consistency; save the 4-line banner block on contributor-only docs

---

## 5-Question Compliance (ECHO Law 15)

| # | Question | Answer |
|---|----------|--------|
| 1 | Work for ALL cases? | ✅ Yes — 11 workspaces handled (4 polish + 7 create or leave) |
| 2 | Scale to 1000 agents? | ✅ Yes — static content, no runtime impact |
| 3 | Survive hostile attacker? | ✅ Yes — no security-sensitive content |
| 4 | 2-year maintainability? | ⚠️ Partial — internal READMEs drift faster than public; need re-audit per release cycle |
| 5 | Industry standard? | ✅ Yes — monorepo with per-package READMEs is standard OSS pattern |

---

## ECHO Compliance Checklist (Laws 1-15)

- **Law 1** (Read 0-EOF): ✅ PASS — basher ground-truth on all 11 workspace dirs + package.json files
- **Law 2** (Present Before Act): ✅ PASS — this FID IS the present state, awaiting approval
- **Law 3** (Verify Before Proceed): ✅ PASS — 14 missed questions + 6-item AUDIT gate
- **Law 4** (Verify Call-Graph Reachability): N/A — no production code changes
- **Law 5** (no pseudo-code): ✅ PASS — concrete remediation
- **Law 6** (no type safety shortcuts): ✅ PASS — no TypeScript code
- **Law 7** (search before create): ✅ PASS — basher demonstrated existence/non-existence pattern
- **Law 8** (log intent): Will write session summary after FORGE
- **Law 9** (production-grade docs): ✅ PASS — internal READMEs are contributor-grade, not consumer-grade
- **Law 10** (update tracking): ✅ PASS — this FID IS the tracking artifact
- **Law 11** (follow discovered patterns): ✅ PASS — pattern from FID-022 lifted directly
- **Law 12** (no sensitive data): ✅ PASS — public/internal-only content
- **Law 13** (utility-first, universal logic): ✅ PASS — single template across workspaces
- **Law 14** (all error paths handled): ✅ PASS — Decision B addresses FID-022 ordering dependency risk
- **Law 15** (build stays clean): N/A — READMEs have no build impact
- **Cross-Agent Claim Rule**: ✅ PASS — FID-023 explicitly continues cross-FID work from FID-022 (Decision E in FID-022 deferred to FID-023)

---

## Scope Boundary

| IN scope (FID-023) | OUT of scope (separate FIDs) |
|---------------------|------------------------------|
| Polish existing 3 internal READMEs (cli/savant-free/scripts/tmux) | sdk/README.md (FID-022 already handles) |
| Create 7 missing READMEs (agents/common/evals/packages/agent-runtime/code-map/database/llm-providers) | LICENSE file audit per workspace (FID-024) |
| README template at templates/README-TEMPLATE.md (Decision C) | Image alt-text improvements (FID-025) |
| Substitution grep across all 11 workspaces | ECHO.md / ARCHITECTURE.md updates (already handled in FID-015) |
| Cross-link integrity check (`../README.md` resolvable from each workspace) | |

---

## Recommended Sequencing Per Decision B

**RECOMMENDED:** Approve FID-022 first → FID-022 FORGE first → FID-023 FORGE second.

Reason: FID-022's Decision D (root README `SavantClient`→`SavantCodeClient` fix) shifts root README line numbers; if FID-023 cross-links reference BEFORE that fix happens, the cross-link anchor positions get re-indexed. Sequential execution avoids cross-FID timing issues.

---

## Iteration History

| Version | Status | Notes |
|---------|--------|-------|
| **v1** | **RED proposing** | 11 workspace inventory complete (4 exist + 7 missing); substitution-need audit (existing 4 all CLEAN); exposure audit (only sdk is PUBLIC); 14 missed questions; 5-step GREEN plan; 6-item AUDIT gate; 4 inline decisions pending user approval; sequencing constraint with FID-022 documented |

---

## Status

**AWAITING USER APPROVAL** of 4 Inline Decisions (C/A/A/A recommended) **+ ping-back:** FID-022 should FORGE first per Decision B.
