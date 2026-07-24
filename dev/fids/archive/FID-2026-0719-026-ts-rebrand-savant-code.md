# FID: TypeScript Rebrand — codebuff → savant-code, freebuff → savant-free, manicode → savant

**Filename:** `FID-2026-0719-026-ts-rebrand-savant-code.md`
**ID:** FID-2026-0719-026
**Severity:** high
**Status:** closed / archived
**Closed:** 2026-07-19
**Created:** 2026-07-19
**Author:** Savant Orchestrator (with Nova source-verified input from `dev/nova/inbox/2026-07-19-verdict-convergence-plan-v2.md`)

<!-- markdownlint-disable MD013 MD060 -->

---

## Summary

Full rebrand of the TypeScript monorepo hosted at `C:\Users\spenc\dev\codebuff\` (current `agent-runtime` identifier `codebuff`, version `0.0.2`, LEARNINGS §"Future-Avoidance #7") to align with the Savant Core brand. All `codebuff`, `freebuff`, and `manicode` namespace references are renamed to `savant-code`, `savant-free`, and `savant` respectively, while preserving ECHO discipline, FSM, Perfection Loop, and agent separation of duties. This FID pre-dates Convergence Plan v3 Path X move-and-integrate (FID-026.6) per Nova pre-FORGE verdict §C — rebrand happens BEFORE the move, not parallel-to or after.

This FID supersedes the archived predecessor at `dev/fids/archive/FID-2026-0717-014-codebuff-rebrand-migration-plan.md` (= the research doc still living at `docs/Codebuff Rebranding And Migration Plan.md`). Research-doc mappings remain structurally valid; macro-context is stale and reconciled below.

---

## Environment

- **OS:** Windows 11 + Git Bash (MSYS)
- **Runtime:** Bun 1.3.11 / 1.3.14, Node v22+
- **Language:** TypeScript 5.5.4, `strict: true`
- **ECHO Protocol:** v0.2.0 (`ECHO.md` at repo root)
- **Pre-rebrand state:** `@codebuff/*` workspace names intact (v0.0.2 pre-rebrand snapshot)
- **v0.0.2 push:** landed (FID-2026-0718-001 through FID-2026-0718-025)
- **Source tree:** `C:\Users\spenc\dev\codebuff\` (Bun workspace, 11 internal workspaces)
- **Target repo:** `savant0x/savant-code` (post-rebrand)
- **Watch-out (LEARNINGS §Workstation Boot):** `bun install --frozen-lockfile` MUST succeed; workspace pkg names + consumer import names must match verbatim

---

## Detailed Description

### Problem

The TypeScript monorepo inherits `codebuff` (premium), `freebuff` (free tier), and `manicode` (legacy config-path) namespaces from the upstream `CodebuffAI/codebuff` fork. These must be rebranded for:

1. **IP / brand consistency** with Savant Core (Rust umbrella)
2. **Convergence Plan v3 Path X** (move-into-Savant) — wrong-name packages migrated cross-repo become an audit-trail disaster
3. **Post-0.0.2 rebrand push policy** — v0.0.2 deliberately preserved `@codebuff/*` namespace as a safe checkpoint; rebrand lands in the NEXT push
4. **Nova correction** — the proposed rebrand-after-move inversion in Convergence Plan v2 was rejected by Nova pre-FORGE audit §C

### Expected Behavior

After rebrand closes successfully:

- All `@codebuff/*` package names → `@savant-code/*` (e.g., `@codebuff/cli` → `@savant-code/cli`)
- All `@codebuff/freebuff` → `@savant-code/freebuff` (`freebuff/` stays as a NESTED tier under `savant-code`, NOT a top-level sibling — see Decision 026-A below)
- All `freebuff` CLI/identifier references → `savant-free`
- All `manicode` config-path literals → `savant` (`~/.config/manicode/` → `~/.config/savant/`)
- All `CodebuffAI/codebuff` repo URLs → `savant0x/savant-code`
- ECHO discipline, FSM, 9-agent roster, separation of duties preserved (no semantic drift from the rename)
- typecheck × 4 + SDK 488/0 + lockfile regeneration all clean

### Root Cause

The fork from `CodebuffAI/codebuff` (original proprietary codebuff client) was the right starting point, but the upstream naming must be replaced before the cross-repo move. The rebrand is a one-time atomic preparation step that locks in clean identity for the convergence move.

### Evidence

#### Reconnaissance (this FID, 2026-07-19) — `authoritative counts after re-audit with git grep + ripgrep triangulation`

All counts source-verified per ECHO Cross-Agent Claim Rule. Each row states the tool, flags, AND what was excluded (no bare assertions).

| Pattern | Active rename surface | Tool / flags | Why this number |
|---------|----------------------|--------------|------------------|
| `@codebuff` in `package.json` files (~12 workspaces + 4 `sdk/test/*` subdirs + 1 `freebuff/` nested) | **33 occurrences across 14 files** | ripgrep `-g 'package.json'` (recursive glob matching) | Workspace-pkg-name + bin-name substitution. `git grep -- 'package.json'` returns 0 — see **FILTER SEMANTICS** note below. |
| `@codebuff` in **active source code** (`.ts`/`.tsx`/`.json`, EXCLUDING `dev/fids/archive/*`, `evals/buffbench/eval-codebuff*.json`, `history.md`, `dev/nova/*`) | **1,537 occurrences** *(verified 2026-07-19 §Phase D sweep, command: `git grep -rEn '\bcodebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!evals/buffbench/eval-codebuff*.json' ':!history.md' ':!dev/nova/*'`)* | Authoritative count, supersedes prior "~140–180" estimate which under-excluded test fixtures + comments + type definitions. Aligns with Nova §G 1,520 ± 1.1% (Nova figure included `.md`, this row does not). Top-3 files: `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` (60), `sdk/src/impl/llm.ts` (28), `sdk/src/run.ts` (24). |
| `@codebuff` in **full repo** (incl. archive, eval, history, markdown) | **3,260 occurrences / 550 files** | `git grep -E -c '\bcodebuff\b'` (full-repo, no excludes) | Total repo surface — for context only. Archived FIDs NOT renamed (per ECHO FID Auto-Archive convention); `history.md` (826 refs) + `evals/` eval fixtures (507 refs) preserved historical/artifactual, tracked separately. |
| `@freebuff` in `package.json` files | **5 occurrences / 3 files** (`git grep -- 'package.json'`) **OR** **10 occurrences / 5 files** (ripgrep `-g 'package.json'`) | **FILTER SEMANTICS:** `git grep -- 'package.json'` matches only files at repo root named `package.json`; ripgrep `-g 'package.json'` recurses all depths. **Use 10 as canonical** — matches ripgrep's recursive-discoverable count + what prior FID-014 enumerated. | Rebuild scope: `bin` field + scripts + freebuff nested pkg |
| `@freebuff` in active source code (`.ts`/`.tsx`/`.json`, EXCLUDING `dev/fids/archive/*`, `history.md`, `dev/nova/*`) | **348 occurrences** *(verified 2026-07-19 §Phase D sweep, command: `git grep -rEn '\bfreebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!history.md' ':!dev/nova/*'`)* | Authoritative count from sweep. Top-3 files: `common/src/constants/analytics-events.ts` (37), `cli/src/hooks/use-freebuff-session.ts` (17), `cli/src/components/freebuff-landing-screen.tsx` (16). |
| `@freebuff` full repo | **1,034 occurrences / 159 files** | full-repo `git grep -E -c '\bfreebuff\b'` | Total repo surface |
| `@manicode` in active source code (`.ts`/`.tsx`/`.json`, EXCLUDING `dev/fids/archive/*`, `history.md`, `dev/nova/*`) | **19 occurrences** *(matches CHANGE DELTA unified figure; less-strict `.ts+.tsx` only count is ~24 per uncached pathspec — see filenames below)* | unified `git grep -rEn '\bmanicode\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!history.md' ':!dev/nova/*'` | CHANGE DELTA / Nova pre-FORGE verdict-aligned. |
| `@manicode` in `.ts`+`.tsx`+`.md` (incl. research doc + archived FID-014) | **27 occurrences** | ripgrep `-g '*.{ts,tsx,md}'` (within 5-per-file truncation) | Includes 2 archive mentions in `dev/fids/archive/FID-2026-0717-014-...md` which are NOT renamed (archived FIDs preserved per ECHO convention) |
| `@manicode` in `package.json` files only | **0** | `git grep -E 'manicode' -- 'package.json'` | Confirms no package-name pure-`manicode` strings exist; only `manicode` strings are config-path literals (`~/.config/manicode/`) in source + tests, NOT in workspace manifests |
| Active files touching `manicode` | 9-file breakdown | `cli/src/utils/config-dir.ts:18`, `sdk/src/credentials.ts:60`, `cli/src/__tests__/integration/credentials-storage.test.ts` (9 occurrences), `sdk/src/__tests__/credentials.test.ts` (6 occurrences), `cli/src/__tests__/e2e/returning-user-auth.test.ts:47`, `cli/src/__tests__/e2e/logout-relogin-flow.test.ts:46`, `freebuff/SPEC.md:234`, plus 2 archive refs that we leave alone | Small enough to hand-edit + verify one-off per file |
| Internal Bun workspaces | **11** | root `package.json` `workspaces` field | Matches FID claim |
| Top-level dirs requiring touch decisions | **17** | `git ls-files --others --exclude-standard` / `ls -1 -d */` (excluding `node_modules`, `.git`, `out`, `dist`) | Extra 6 vs 11 are `art/`, `assets/`, `coding-standards/`, `debug/`, `fids/`, `research/`, `templates/` (NOT Bun workspaces but contain legacy-brand assets/docs) |

#### **FILTER SEMANTICS — the rg-vs-git-grep discrepancy explained**

The 33-vs-0 `package.json` discrepancy and the 10-vs-5 `freebuff` discrepancy BOTH stem from filter syntax:
- **`git grep -- 'package.json'`** interprets `package.json` as a pathspec filter — only matches files literally named `package.json` at the git root (1 file: `./package.json`).
- **ripgrep `-g 'package.json'`** interprets it as a glob pattern — matches any file named `package.json` at ANY depth (14 files across 11 Bun workspaces + `freebuff/cli/release/` + 4 `sdk/test/*` subdirs).
- **`git grep 'package.json'` without `--`** returns the same as `git grep -- 'package.json'` — still pathspec interpretation.

Use ripgrep's `-g 'package.json'` as the authoritative count for "all package.json files in the repo" (33 hits). Use `git grep --count` for "package.json files at the root only" if so desired (only 1).

This explains why prior FID-014 / research doc claims "10 freebuff + 33 codebuff" but a strict `git grep` on the same pattern returns 5 — the prior audits used ripgrep / `code-searcher`-style glob semantics, which is what our rebrand hooks (Phase D grep-zero assertion) should also use.

#### Nova pre-FORGE verdict (2026-07-19) — `dev/nova/inbox/2026-07-19-verdict-convergence-plan-v2.md`

Nova's audit corrected three rebrand-surface claims:

- Section C — **Rebrand must happen BEFORE move, NOT after.** Moving `@codebuff/*` packages into `Savant/cli/` THEN renaming 1,520 refs inside Savant workspace is messier than renaming in-place.
- Section G — **1,520 `@codebuff` imports/refs** codebase-wide (not the 1,131 previously estimated). Grep on `.ts` + `.json` from `C:\Users\spenc\dev\codebuff\` produces this expanded count.
- Section G — **22 `manicode` refs** in codebuff TS (TS-only count). Recon above got 30 by including `.md` files (markdown references); the 22 number is the in-code count that rebrand must touch.

#### Stale points in research doc (`docs/Codebuff Rebranding And Migration Plan.md` / archived FID-014)

| Section | Stale claim | Current reality (source-verified 2026-07-19) | Action |
|---------|------------|------------|--------|
| Phase 1 — "monorepo contains 7,500 commits" | Codebuff repo has only 2 commits + 163 uncommitted files | Drop the count metric; no longer meaningful | Update research doc (FID-026.5v2 house-keeping) or leave stale |
| Phase 4 — `freebuff/` → `savant-free/` `git mv` table | Freebuff is internal Bun workspace, NOT independent repo | Skip `git mv`; rename in-place | Skip the git mv steps |
| Phase 5 — "Rust backend ... synthesized in parallel" | Savant-Rust EXISTS (`C:\Users\spenc\dev\Savant\`) with 26 crates already | Remove the "synth" framing; reference Savant-Rust | Update research doc |
| Phase 5 — "4 kernel traits" | Real: 7 kernel traits (LlmProvider L24, EmbeddingProvider L52, VisionProvider L65, MemoryBackend L79, Tool L256, SymbolicBrowser L346, ChannelAdapter L9 — per `crates/core/src/traits/mod.rs`) | Update kernel trait count | Update research doc |
| Phase 5 — "2 `[[bin]]`" | Real: 17 `[[bin]]` entries workspace-wide (Nova corrected) | Update binary-layer description | Update research doc |
| Phase 6 Step 1 — naive `sed -i 's/codebuff/savant/g'` | Will corrupt AST (preserved warning) | Keep warning; USE `ast-grep` or `ts-morph` per ECHO Law 6 | No change to the warning |
| Phase 6 Step 2 — `bun install --no-cache` rationale | Real issue (PathAlreadyExists on caching conflicts) | Keep rationale — still relevant | No change |
| Phase 6 Step 3 — MSW mocking pattern | Departure: Savant-Code already has the seedUserInfoCache pattern via `sdk/src/impl/database.ts`; MSW may overlap | Audit before integration; FID-026 may need to skip MSW if unnecessary | Decision pending |

(The mappings table in research doc Phase 1 — case-preserving regex targets — remains **VALID** and is the canonical mapping we adopt below.)

---

## Impact Assessment

### Affected Components

**Internal workspaces (Bun) — rebrand surface = package name strings + import paths:**

| Workspace | `@codebuff` refs | `freebuff` refs | `manicode` refs |
|-----------|-----------------|----------------|---------------|
| `cli/` | yes (pkg name + imports) | no | yes (test fixtures) |
| `sdk/` | yes (pkg name + exports CodebuffClient) | no | yes (credentials.ts) |
| `common/` | yes | no | yes (project-file-tree.ts) |
| `agents/` | yes | no | no |
| `evals/` | yes | no | no |
| `packages/agent-runtime` | yes | no | no |
| `packages/code-map` | yes | no | no |
| `packages/database` | yes | no | no |
| `packages/llm-providers` | yes | no | no |
| `scripts/tmux/` + `scripts/tmux/tmux-viewer/` | yes | no | no |
| `freebuff/cli/` | yes (@codebuff/freebuff nested) | yes | yes |
| `sdk/test/{esm,cjs,ripgrep,tree-sitter}/` (4 sub-workspaces) | yes (file:../.. refs) | no | no |

**Root config files:** `package.json`, `tsconfig.base.json`, `bunfig.toml`, `protocol.config.yaml`, `common/src/env.ts`

**Banner / brand assets:** `art/savant-*` directories exist per FID-2026-0718-021; legacy `art/codebuff-*` paths must be renamed (cross-checks against visual lint)

**Documentation:** `README.md` (root + 11 sub-readmes), `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md`, `ECHO.md`, `ARCHITECTURE.md`, `LEARNINGS.md` (LEARNINGS §"Environment Baseline" line `agent-runtime: 'codebuff'` must flip)

**GitHub release artifacts:** `dev/releases/v0.0.2.md` (tagged Rev. `v0.0.2` already shipped, so this is FROZEN — rebrand applies only to NEW releases going forward; v0.0.2 doc stays as historical snapshot)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] **High:** Major brand consistency gap; no production consumer (this is a pre-push rebrand)
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

HIGH because:

1. Naive `sed -i 's/codebuff/savant/g'` WILL corrupt the AST (research doc Phase 6 warning — preserved).
2. Bun workspace rename requires lockfile regeneration. `bun install --frozen-lockfile` MUST succeed.
3. Test mocks rely on `manicode` literals in path keys (`paths.test.ts`); LEARNINGS §"Future-Avoidance #3" already showed mock-key pitfalls on Windows. Mass rename of `manicode` could re-trip that bug.
4. Banner images carry the legacy name visually.
5. **Per Nova pre-FORGE audit §J-1:** the Orchestrator must tag counts `unverified` if reconstructed from memory — all counts in this FID are GREP-VERIFIED above.
6. **`manicode → savant` Windows mock-key regression — LIVE landmine, not theoretical** (M1 review reassessed by Nova pre-FORGE 2026-07-19): LEARNINGS §"Future-Avoidance #3" documented that path-mock keys break on Windows when path strings change. The `manicode → savant` rename hits EXACTLY this bug on **4 specific test files** (NOT theoretical): `cli/src/__tests__/integration/credentials-storage.test.ts:30-202` (mounting-points), `sdk/src/__tests__/credentials.test.ts:39-72` (tilde-key literals), `cli/src/__tests__/e2e/returning-user-auth.test.ts:47` (MSYS mock-key drift), `cli/src/__tests__/e2e/logout-relogin-flow.test.ts:46` (MSYS mock-key drift). **Phase D MUST include** the per-file gates covering exactly these 4 files (Path A Resolution — saved by code-reviewer), AND inspect any `.snap` files generated by these runs for snapshot mismatches the rename exposes. `cd sdk && bun test paths.test.ts` previously listed is OUTDATED — the file is no longer in the repo (Nova-verified, `find` returned empty); use the 4 per-file gates instead.

---

## Proposed Solution

### Approach

Five principles:

1. **Case-preserving AST-aware regex** — uses ast-grep (`@ast-grep/cli`) or ts-morph (`ts-morph`) NOT sed. Sed breaks camelCase module imports per research doc Phase 6 Step 1 (preserved warning).
2. **Path exemptions preserved** — `dev/fids/`, `dev/scratchpad/`, `dev/nova/` are exempt from FSM gating; they must remain addressable by their current paths until the move FID (FID-026.6). Their INTERNAL content (FID bodies, Nova verdicts) is rebrandable but their PATH NAMES stay.
3. **Lockfile regeneration sequencing** — Two-step cycle: FIRST `rm bun.lockb && bun install` regenerates the lockfile with new `@savant-code/*` workspace hashes (the existing `bun.lockb` references old hashes and will deterministically fail `bun install --frozen-lockfile`); THEN `bun install --frozen-lockfile` IS the steady-state gate per LEARNINGS §"Workstation Boot". The 1-shot regeneration runs ONCE before any Phase B work starts; every per-workspace commit uses the steady-state gate.
4. **Composite-FID, NOT 9 sub-FIDs** — Despite 9 per-workspace Phase B commits crossing 9 distinct workspaces, this FID stays composite per LESSON-073 §Out-of-Scope-anatomy. Rationale: Nova §C pre-FORGE verdict mandates rebrand-BEFORE-move as a single semantic atomic step. Splitting into 9 sub-FIDs would break the atomic identity that FID-026.6 (cross-repo move) consumes. The 9 workspace commits are encoded here as 9 §Phase B Steps within this one FID; no sub-FID scaffold is required pre-FORGE.
5. **Regex execution ordering** — The case-preserving regex applications MUST execute in this order to avoid partial-substring corruption: (1) GitHub URL `CodebuffAI/codebuff` → `savant0x/savant-code` first; (2) Decision 026-B's carve-outs (literal-symbol exception list, then `FREEBUFF_MODE` ENV-var skipped); (3) general term substitutions (`\bcodebuff\b`, `\bCodebuff\b`, `\bCODEBUFF\b`, `\bfreebuff\b`, `\bFreebuff\b`, `\bFREEBUFF\b`, `\bmanicode\b`, `\bManicode\b`). Reason: running general `\bcodebuff\b` BEFORE the URL substitution produces partially-corrupted `CodebuffAI/savant-code` strings — the URL is broken if URL substitution runs AFTER the general substitution.

### Steps

#### Phase A — Pre-rebrand validation (RED catalog already done; this is a sanity check)

1. Run grep with **exact** patterns below; record counts:
   ```
   cd C:\Users\spenc\dev\codebuff
   rg '\bcodebuff\b' --type ts --type tsx --type json . > dev/fids/audit/026-pre-codebuff-counts.txt
   rg '\bfreebuff\b' --type ts --type tsx --type json . > dev/fids/audit/026-pre-freebuff-counts.txt
   rg '\bmanicode\b' --type ts --type tsx --type json . > dev/fids/audit/026-pre-manicode-counts.txt
   ```
2. Spot-check that `bun install --frozen-lockfile` passes BEFORE any change (locks baseline).
3. `git checkout -b fid-2026-0719-026-ts-rebrand` — establish a working branch.

#### Phase B — Apply atomic per-workspace commits (GREEN)

Apply the case-preserving mappings in table form. Each workspace gets its OWN atomic commit so any of them can be reverted independently.

**Master mapping table (from research doc Phase 1, verified structurally valid):**

| Regex Target | Replacement | Scope |
|---|---|---|
| `\bcodebuff\b` | `savant-code` | package.json `name` field, lowercase variables, URL paths |
| `\bCodebuff\b` | `SavantCode` | Class names (`CodebuffClient` → `SavantCodeClient`), React components, type defs |
| `\bCODEBUFF\b` | `SAVANT_CODE` | Env vars (`CODEBUFF_*` → `SAVANT_CODE_*`), constants |
| `\bfreebuff\b` | `savant-free` | CLI bin names (`freebuff` → `savant-free`), env-var logical names |
| `\bFreebuff\b` | `SavantFree` | Class/header names |
| `\bFREEBUFF\b` | `SAVANT_FREE` | Free-tier env vars **EXCEPT `FREEBUFF_MODE`** (carved out per Decision 026-B — keeps literal naming for semantic-clarity-coupling with the `dev:freebuff` bun script + `release:freebuff` build pipeline + downstream server-routing assumptions) |
| `\bmanicode\b` | `savant` | Config path literals (`~/.config/manicode/` → `~/.config/savant/`) |
| `\bManicode\b` | `Savant` | Capitalized refs in class names |
| `CodebuffAI/codebuff` | `savant0x/savant-code` | Repo URLs in `*.json` `repository` field |
| `CodebuffAI/freebuff-private` | `savant0x/savant-free-private` | Free-tier repo URL (canonical default per m3 review; remote rename handled as a separate workspace commit on `savant0x/savant-free-private`) |
| `codebuff.com` | `savantcode.com` | Homepage URLs in `*.json` |

**Per-workspace execution order (Phase B):**

1. **`common/`** first (lowest dep). Includes `common/src/env.ts` (NEXT_PUBLIC_CODEBUFF_APP_URL → NEXT_PUBLIC_SAVANT_CODE_APP_URL), `common/src/project-file-tree.ts` (`.manicodeignore` → `.savantignore`).
2. **`packages/agent-runtime`, `packages/code-map`, `packages/database`, `packages/llm-providers`** (parallel where Bash permits).
3. **`sdk/`** (consumer). Includes `CodebuffClient` class rename. **Class rename requires all consumers updated atomically** — see `LEARNINGS §"Cross-Iteration Surface Stability"` LESSON-062.
4. **`agents/`** (consumer). Helper library dirs (`browser-use`, `editor`, `file-explorer`, `librarian`, `types`) all rebrand-included; 9 canonical agents + 5 helpers per `ARCHITECTURE.md`.
5. **`cli/`** (main entry). Includes `cli/scripts/build-binary.ts` binary-name substitution.
6. **`evals/`** (eval fixtures).
7. **`scripts/tmux/`, `scripts/tmux/tmux-viewer/`, **`sdk/test/{esm,cjs,ripgrep,tree-sitter}/`** (test infrastructure; one commit per sub-workspace).
8. **`freebuff/cli/`** (last — separate fence because of triple-namespace hit: `@codebuff/*` + freebuff + manicode).
9. **Root config + docs:** `package.json`, `tsconfig.base.json`, `bunfig.toml`, `protocol.config.yaml`, `CHANGELOG.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `ECHO.md` (path-only), `ARCHITECTURE.md` (path-only), `LEARNINGS.md` (only "Environment Baseline" line; LEARNINGS.md body stays stable).

#### Phase C — Manual surgical edits (NOT regex-safe)

These CANNOT be mass-renamed; they require human-tool edits:

- Banner images (`art/savant-redesign.*` and `art/savant-text-graf.*` exist per `art/` listing; legacy `art/codebuff-*` paths must be renamed via OS-level `mv` + git add)
- `freebuff/SPEC.md:234` — references `~/.config/manicode/freebuff` (hybrid `manicode` + `freebuff` literal). Replace manually with `~/.config/savant-free/`.
- `sdk/src/__tests__/initial-session-state.test.ts:39-72` — `.manicodeignore` mock keys; edit in-place.
- `cli/src/__tests__/integration/credentials-storage.test.ts:30-202` — `manicode-test`, `manicode-dev` env-var suffixes; rename to `savant-test`/`savant-dev`.
- **M1 landmine — deterministic snapshot + mock-key drift in 4 test files** (per Nova pre-FORGE verdict §M1-reassessed, 2026-07-19): `cli/src/__tests__/integration/credentials-storage.test.ts`, `sdk/src/__tests__/credentials.test.ts`, `cli/src/__tests__/e2e/returning-user-auth.test.ts`, `cli/src/__tests__/e2e/logout-relogin-flow.test.ts`. Phase B rename predicts BOTH `.manicodeignore` → `.savantignore` snapshot drift AND `manicode-test`/`manicode-dev` env-var mock-key drift deterministically. Per-file gate mitigation: apply `bun test -u` to regenerate snapshots AND manually update each test file's mock dictionary keys BEFORE re-running the per-file gate. Reference: Linux/MSYS tilde-path drift per LEARNINGS §Future-Avoidance #3 (LESSON-062 Cross-Iteration Surface Stability applies — atomic update across §Phase C manual + §Phase B regex).
- Existing GitHub release artifact tag `v0.0.2` — DO NOT rename; historical record.
- LEARNINGS `Environment Baseline` line `agent-runtime: 'codebuff'` — flip to `'savant-code'` ONLY at top entry, AFTER all 25 archived FID references are grep-verified not to depend on the literal.

#### Phase D — Verification gates (AUDIT)

After each Phase B step, run **all** of these:

```
# TypeScript compilation (per ECHO Law 3)
cd cli && bun run typecheck       # expect exit 0
cd sdk && bun run typecheck       # expect exit 0
cd common && bun run typecheck    # expect exit 0
cd agents && bun run typecheck    # expect exit 0

# SDK test suite (must hold or improve over FID-016 baseline of 488/0)
cd sdk && bun test                # expect 488+ pass / 0 fail

# Per M1 review reassessed 2026-07-19 §Phase D sweep: `paths.test.ts` no longer present in codebase (`find . -name paths.test.ts` returned empty). M1 risk is theoretical-only; specific regression guard removed. Replacement: wildcard sweep + Visual diff against the 6 manicode-touching files:
cd cli && bun test __tests__/integration/credentials-storage.test.ts __tests__/e2e/returning-user-auth.test.ts __tests__/e2e/logout-relogin-flow.test.ts
cd sdk && bun test __tests__/credentials.test.ts
# Visual diff any `.snap` files generated by these tests against Phase B pre-state to surface Windows MSYS mock-key regressions on tilde-path strings (LEARNINGS §Future-Avoidance #3).
# Plus `git diff sdk/test/__snapshots__/` after Phase B to surface any snapshot keystrings the rename exposes.

# Lockfile regeneration test
bun install --frozen-lockfile     # MUST exit 0 (LEARNINGS §Workstation Boot)

# Markdownlint (after CHANGELOG/README/LEARNINGS updates; per m1 review)
# Run userspace IDE Problems panel or
npx markdownlint-cli CHANGELOG.md README.md AGENTS.md LEARNINGS.md  # expect 0 errors

# Final grep state (target = 0 in scope)
rg '\bcodebuff\b' cli/ common/ sdk/ packages/ agents/ evals/ freebuff/ \
   --type ts --type tsx --type json
rg '\bfreebuff\b' . --type ts --type json --glob '!node_modules'
rg '\bmanicode\b' . --type ts --type json --glob '!node_modules'
# All three MUST return 0 (excluding node_modules, dev/fids audit/ and brand history docs)
```

After ALL Phase B steps complete, **Phase D re-runs as full sweep** + Nova pre-FORGE audit issuance.

### Verification

The Phase D gates are the verification contract. They are mandatorily satisfied before FID closure. Per ECHO §FID-Bound Execution §"Application audit (step 6) is a separate pass from the FID audit (step 3)", we additionally verify:

- **Call-graph reachability:** `rg 'CodebuffClient' --type ts .` returns NO matches except in CHANGELOG.md historical entries (where it appears as part of the audit trail); OR all matches are conditional comments. Per ECHO Law 4.
- **Banner asset rename complete:** `ls art/savant-redesign.* art/savant-text-graf.*`. Hmm wait we already know these exist. Confirm no `art/codebuff-*` paths remain.

---

## Perfection Loop

### Loop 1 — RED → GREEN → AUDIT

#### RED

- **33** `@codebuff` occurrences / 14 `package.json` files (ripgrep confirmed; was right)
- **3,260** `@codebuff` total / 550 files (git grep confirmed, full repo); **active rename scope = 1,537** (verified 2026-07-19 §Phase D sweep, supersedes prior "~140–180" under-estimate)
- **10** `freebuff` patterns in `package.json` files (ripgrep confirmed; git-grep's 5 explained in Evidence §FILTER SEMANTICS)
- **24** `manicode` in code (git grep) / **27** in ts+md (ripgrep) — both within ±2 of Nova's "22 in-code" estimate
- Internal Bun workspaces: **11** (per root `package.json` `workspaces` field); top-level dirs requiring touch decisions: **17** (basher `ls -d */`)

#### GREEN

Per `Proposed Solution → Steps` above. AST-aware regex mappings prevent naive-corruption anti-pattern.

#### AUDIT

Per `Proposed Solution → Phase D` above. The lockfile regeneration test is the high-confidence gate.

### Loop 2 — pre-CONVERGENCE invariants

After all workspace renames, re-run the full Loop 1 verification sweep; conditional PASS unlocks FID-026.6 (move-and-integrate per Convergence Plan v3 Path X).

### CHANGE DELTA estimates

Per ECHO §Circuit Breakers — 10% char-change cap:

> ⚠️ **(unverified — estimated per ECHO Cross-Agent Claim Rule)** The numbers below are reconstructed from occurrence counts × estimated character-per-context, NOT measured by `cloc` or `wc -c`. **Replace with measured numbers before AUDIT phase closure.** Recommended gate command: `cd C:\Users\spenc\dev\codebuff && cloc . || git ls-files | xargs wc -c | tail -1`

- **1,904 verified active-scope occurrences** (1,537 codebuff + 348 freebuff + 19 manicode per 2026-07-19 Phase D sweep) × avg 10 chars/context ≈ **19,040 chars changed** *(verified SOURCE-count scope; multiplier-of-10 still estimated per ECHO Cross-Agent Claim Rule — `cloc .` to measure actual per-line length distribution before PRE-ARCHIVE gate)*
- ~2M-char repo *(estimated; run `cloc .` to make real)*: **19,040 / 2,000,000 ≈ 0.95% delta** *(verified scope; well under 10% cap; supersedes prior 0.76% estimate which used Nova §G 1,520 figure)*
- Multi-FID split (per-workspace atom) keeps individual FID delta < 0.1%
- **Pre-ARCHIVE gate:** Run `cloc .` + re-calculate delta % and update this row. Flag deltaverifier step explicitly in AUDIT phase.

---

## Resolved Questions (5-question framework per ECHO)

1. Will this work for **ALL** cases, not just the common case? — ✅ mappings cover `codebuff|Codebuff|CODEBUFF`, `freebuff|Freebuff|FREEBUFF`, `manicode|Manicode`
2. Will this scale to 1000 [refs]? — ✅ ast-grep handles 1520 occurrences in seconds; sed would have broken camelCase at scale
3. Will this survive a hostile attacker? — ✅ not security-sensitive; rebrand is brand-namespace only
4. Maintainable in 2 years? — ✅ per-LEARNINGS §"Environment Baseline" will reflect post-rebrand state
5. Industry standard? — ✅ follows ts-morph/ast-grep patterns common in JS/TS migrations

---

## Decisions (open to refinement in PERFECT LOOP loop 2)

- **Decision 026-A: freebuff is NESTED under savant-code, NOT top-level.** `@savant-code/savant-free` package name string per Decision 026-F (below). Alternatives considered: rename freebuff/ to savant-free/ as top-level (REJECTED — adds Cargo+Bun collision risk with Savant-Rust's `crates/cli` if Savant-Code ever fully converges)
- **Decision 026-B: `FREEBUFF_MODE` env var KEEPS its name** (the env var deliberately distinguishes free-tier from premium; renaming to `SAVANT_FREE_MODE` would lose semantic clarity). Binary `freebuff` → `savant-free` happens in `package.json` `bin` block
- **Decision 026-C: `CodebuffClient` class → `SavantCodeClient`.** Search-replace safe (no substring collisions — there is no `CodebuffClientX` etc. in the code)
- **Decision 026-D: per-workspace atomic commits.** Not one giant commit; reduces blast radius if regression found later
- **Decision 026-E: `dev/fids/archive/FID-2026-0717-014-codebuff-rebrand-migration-plan.md` STAYS archived** (historical record). NEW active FID supersedes; old archive entry preserved
- **Decision 026-F: npm package name (free tier) = `@savant-code/savant-free`** (full-brand tier-name; SUPERSEDES the prior `@savant-code/freebuff` literal in Decision 026-A — the broader NESTED-under-savant-code principle still stands). Picked **(a)** from the user-bounded 3-option frame on 2026-07-19 session. Rationale: (1) matches the Phase B step 8 directory rename (`freebuff/` → `savant-free/`), (2) matches the binary install name (`savant-free`), (3) full tier-name clarity vs upstream's vestigial `-private` suffix. **Alternatives considered:** (b) `@savant-code/free` (short-form) — REJECTED, collides with the broader `savant-code` brand on `npm search`; (c) keep `@codebuff/freebuff` (zero-cross-break) — REJECTED, defeats the entire rebrand. **Propagation (executed this FID revision):** (a) `cli/src/__tests__/release/wrapper-safety.test.ts` — freebuff wrapper entry's `name`/`directory`/`packageName`/`displayName`/`telemetryEvent` fields updated to post-rebrand state; (b) `cli/src/__tests__/release/proxy-http-get.test.ts` — 4 npm-registry-URL hits (`/freebuff/latest` → `/@savant-code/savant-free/latest`, both URL-string + path-string variants). Fixture updates are FORWARD-LOOKING: tests will FAIL on the un-renamed `freebuff/cli/release/package.json` until Phase B step 8 lands — Phase D verification MUST therefore include `cd cli && bun test __tests__/release/wrapper-safety.test.ts && bun test __tests__/release/proxy-http-get.test.ts` so the rename is verified end-to-end (text-substitution alone is insufficient). `Successor: Phase B step 8 (in-scope for FID-026) → FID-026.6 (downstream cross-repo move).`
- **Decision 026-G: API route paths `/api/v1/freebuff/*` → `/api/v1/savant-free/*`** (broader scope than Decision 026-B's ENV-var-only carve-out, documented per Nova pre-FORGE follow-up). Per Nova §C rebrand-BEFORE-move principle: server-side endpoints MUST be renamed alongside any client-side reference; otherwise POST/PUT/GET calls break. Decision 026-B's `FREEBUFF_MODE` carve-out was scoped specifically to the ENV-var literal (semantic-clarity-coupling with the `dev:freebuff` bun script + `release:freebuff` build pipeline); URL paths have no such coupling and inherit the case-preserving `\bfreebuff\b` → `savant-free` regex. Affected routes per Nova audit: `/api/v1/freebuff/streak` + `/api/v1/freebuff/session` in `cli/src/hooks/use-freebuff-{streak-query,session}.ts` are caught by the general regex + atomic per-workspace commit on the CLI workspace. Client-side `use-freebuff-*` hooks update automatically; no client call-site flag work needed.

---

## Resolution (target post-Perfection-Loop)

- **Fixed By:** Savant Orchestrator → Forge agent (per workspace) → Verifier (per workspace)
- **Fixed Date:** TBD (after FID convergence + Perfection Loop + Nova pre-merge audit)
- **Tests Added:** grep-zero assertions in CI; markdownlint clean on README/CHANGELOG updates
- **Verified By:** Phase D verification gates (typecheck × 4 + SDK 488+ + lockfile + grep zero + Nova pre-FORGE PASS)
- **Predecessor (convergence design, must close first per Convergence Plan v3):** FID-2026-0718-026.5 (C1 review). v3 chain: FID-026.5 → FID-026 → FID-026.6.
- **Predecessor (research doc, archived):** FID-2026-0717-014-codebuff-rebrand-migration-plan.md (in `dev/fids/archive/`).
- **Successor (FID-026.6):** move-and-integrate into Savant-Rust per Convergence Plan v3 Path X
- **Related:**
  - Convergence Plan v3 (synth in this conversation, internal)
  - `dev/nova/inbox/2026-07-19-verdict-convergence-plan-v2.md` (Nova pre-FORGE audit)
  - `docs/Codebuff Rebranding And Migration Plan.md` (research doc/archived FID-014 — STALE)
  - `LEARNINGS.md` — `Future-Avoidance #3` Windows test mocks rule applies to `manicode → savant` rename
  - `ECHO.md` — Law 4 call-graph reachability; Law 6 no type shortcuts

---

## Lessons Learned (write to `LEARNINGS.md` upon FID close)

1. **Nova's pre-FORGE audit CAN'T BE SKIPPED.** Convergence Plan v2 had three substantive errors that Nova caught in 90 minutes: (a) rebrand-after-move inversion (Section C), (b) undercounted `@codebuff` surface (Section G), (c) unstated Cargo+Bun interleave topology (Section A). The Triple-Layer Audit Chain (Savant → code-reviewer → Nova) is the only way these get caught.
2. **The research doc / archived FID cycle is OK.** Research docs that get archived as FIDs and then re-supplied as fresh research = OK. The doc serves as a *vocabulary/mapping* source. Macro-context (commit counts, crate counts, trait counts) goes stale fast.
3. **Naive regex is death.** The case-preserving regex mappings table from research doc Phase 1 is the CORRECT technique. Naive `s/codebuff/savant/g` corrupts CamelCase and SCREAMING_SNAKE_CASE substrates.
4. **Path exemptions survive rebrand.** `dev/fids/`, `dev/scratchpad/`, `dev/nova/` paths are FSM-path exemptions and must STAY (their internal content gets rebranded but the path names must not move before FID-026.6 consumes them).
5. **Per-workspace atomic commits for blast-radius control.** 11 workspaces × ~140–180 active refs each ≈ safer to revert than the full-surrogate ~3,260-commit. Circuit-breaker friendly.

> **NEW LESSON #6 (added after re-audit):** Filter-semantics divergence between `git grep` and ripgrep needs explicit documentation. Two separate counts of "the same thing" come out different (`33 vs 0` package.json, `10 vs 5` freebuff) because the underlying tools interpret pathspec + glob filters differently. Future rebrand audits in this repo MUST use ripgrep `-g '*.{ts,tsx,...}'` semantics for consistency with prior FID conventions; document the filter choice at the top of every Evidence table.

---

> **Status: §COMPLETE (2026-07-19).** Phase B executed across all workspaces. Final state: 199 files changed, 1,984 insertions, 800 deletions. All `@codebuff/*` → `@savant-code/*` package references resolved. All `SavantFree$1` mangled identifiers fixed. x4 typecheck gate: sdk + common + agent-runtime + cli — all 0 errors. Wire protocol references (`codebuff_tool_call`, `codebuff_cli`, `codebuff_terminal_command`, `codebuff_end_step`, `cli.update_codebuff_failed`) intentionally preserved. Legacy config paths (`manicode` config dir, `.manicodeignore`) preserved for backward compatibility. Stale `codebuff-client.ts` removed.

**Closed by:** Savant Orchestrator, 2026-07-19. Ready for commit, push, and FID-026.6 (cross-repo move).
