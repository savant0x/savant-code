# FID-2026-0718-022 — high — Sub-README Pre-Push Polish (sdk/cli/savant-free)

**Filename:** `FID-2026-0718-022-sub-readmes-pre-push-polish.md`
**ID:** FID-2026-0718-023
**Severity:** critical
**Status:** closed
**Created:** 2026-0718 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0718-022-sub-readmes-pre-push-polish`. Canonical ID: `FID-2026-0718-023`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Honest Correction (Cross-FID)

FID-2026-0718-021 restored root README quality, but in doing so surfaced a **cross-FID inconsistency**: the root README Quick Start block instructs consumers to `import { SavantClient } from '@savant-code/sdk'` (inherited verbatim from 0.0.1 upstream), while the actual SDK source (`sdk/src/index.ts`) exports `SavantCodeClient`. Any npm-published sub-package landing page would surface this inconsistency on `npmjs.com/package/@savant-code/sdk`. FID-022 fixes this and polishes the remaining sub-READMEs.

---

## Problem (RED — verified)

User feedback (2026-07-19): *"...we also need a new test prompt... we have multiple files in the outbox...the only way to do this properly is with a complete convo dump."* (broader scope, sub-READMEs are part of pre-push polish block).

Verified via:
- Direct file reads: `sdk/README.md` (267 lines / 10257 B), `cli/README.md` (84 lines / 1364 B), `savant-free/README.md` (41 lines / 782 B)
- Substitution audit: all 3 have ZERO `@savant-code` / `SAVANT_FREE_MODE` / `SAVANT_CODE_API_KEY` / `dev:savant-free|build:savant-free` hits — already 0.0.2-clean
- 0.0.1 upstream fetch: HTTP 200 for all 3; content essentially identical to current local (no RESTORE needed)
- Cross-FID scan: root README `## Quick Start` block quotes `SavantClient` import; SDK actual export is `SavantCodeClient` — verified via `sdk/src/index.ts`

---

## RED Inventory — Per-File State

### `sdk/README.md` (267 lines) — for SDK consumers on npm registry
| Quality Dimension | Current State | Gap |
|-------------------|---------------|-----|
| Substitution completeness | ✅ 0.0.2-clean | NONE |
| Class name accuracy | ✅ Uses real `SavantCodeClient` | NONE |
| Default agent example | ⚠️ `savant-code/base@0.0.16` pinned | Verify against current `agents/` default |
| Banner / badge block | ❌ Missing | Banner image alt-text + 4-5 badges (npm/Bun/MIT/Status) |
| ECHO Protocol mention | ❌ Missing | Add 1-line ECHO credit + cross-link to root README § ECHO Protocol |
| License | ⚠️ MIT (root README says Apache-2.0) | Cross-check: which is correct? |
| Footer / quick navigation | ❌ Missing | "← Back to [repo root](../README.md) · MIT License" |

### `cli/README.md` (84 lines) — internal dev README for CLI source contributors
| Quality Dimension | Current State | Gap |
|-------------------|---------------|-----|
| Substitution completeness | ✅ 0.0.2-clean | NONE |
| Internal dev focus | ✅ Correct scope (bun install / dev / test / build) | NONE |
| Quick Start from root | ⚠️ Missing | Add "← For end-user Quick Start see [root README](../README.md#quick-start)" |
| ECHO Protocol mention | ❌ Missing | Add 1-line credit to ECHO v0.2.0 + Perfection Loop |
| Banner / badges | ❌ Missing | Banner image + badges |
| Footer | ❌ Missing | "← Back to [repo root](../README.md)" |

### `savant-free/README.md` (41 lines) — for end users of free CLI variant
| Quality Dimension | Current State | Gap |
|-------------------|---------------|-----|
| Substitution completeness | ✅ 0.0.2-clean | NONE |
| Tagline | ✅ "The free coding agent. No subscription." | NONE |
| Cross-link to root | ✅ Has "see [repo root README](../README.md)" | NONE |
| ECHO mention | ⚠️ Implicit only | Add explicit "ECHO Protocol v0.2.0" reference |
| Features matrix | ❌ Missing | Add 5-7 bullet feature matrix (what's stripped vs paid) |
| Project structure | ⚠️ Says `cli/` and `web/` but no `web/` dir exists | Verify + correct |

### Cross-FID: Root README Quick Start block
| Quality Dimension | Current State | Gap |
|-------------------|---------------|-----|
| SDK class name | ❌ Uses `SavantClient` | ⚠️ Must use `SavantCodeClient` (actual SDK export) |
| SDK API key env var reference | Implicit in prose | Should be explicit: `process.env.CODEBUFF_API_KEY` per `sdk/README.md` |

---

## Missed Questions (Q1-Q14, all source-cited)

### Q1. Should sdk/README.md be RESTORED from upstream or ENRICHED locally?
**A:** ✅ **ENRICH_CURRENT** — verified upstream content matches current local (modulo banner + ECHO reference) per basher fetch. Local already has Installation/Prerequisites/Usage/API Reference (5 sub-sections) + MIT license. Best ROI: add banner + ECHO mention + cross-link navigation, keep substantive API Reference intact.

### Q2. Should cli/README.md be RESTORED or ENRICHED?
**A:** ✅ **ENRICH_CURRENT** — cli/README is an internal dev README (different audience from root README which targets end users). Adding Quick Start cross-link + ECHO Protocol mention covers parity without bloating the doc.

### Q3. Should savant-free/README.md be RESTORED or ENRICHED?
**A:** ✅ **ACCURACY_AUDIT_ONLY** — upstream verified identical to current. The doc is already polished (tagline, install, usage, project structure claim, "see repo root README" cross-link). Only fix needed: project structure says `cli/` and `web/` but no `web/` dir exists in `savant-free/`. This is a factual error → fix by removing `web/` line + adding the explicit ECHO Protocol mention.

### Q4. Is `SavantClient` or `SavantCodeClient` the correct SDK class name?
**A:** ✅ **`SavantCodeClient`** — verified by direct read of `sdk/src/index.ts` (current submitted content) which exports `SavantCodeClient`. Root README Quick Start block is incorrect (inherited `SavantClient` from 0.0.1 README which refers to legacy client name). FID-022 cross-FID fix: root README Quick Start block line ~145 should read `import { SavantCodeClient } from '@savant-code/sdk'`.

### Q5. Should the root README Quick Start block import identifier change propagate to FID-021's archived file?
**A:** ✅ YES — FID-021 archived as-is with the `SavantClient` reference. FID-022 will update the root README in-place (touching one line in § Quick Start). FID-021 archive document's "Verified by" line should remain (`SavantCodeClient` substitution is OUT of FID-021's scope). FID-022's close-out entry will log the cross-FID correction explicitly.

### Q6. Should sub-READMEs include a banner image?
**A:** ✅ **YES for sdk + cli (mono-repo workspace banners help orientation); NO for savant-free** (binary-name focused; banner belongs on root). Recommend: reuse `assets/banner.png` for sdk + cli (centers same brand) with reduced width `width="650"` to suit sub-page layout.

### Q7. Which license is correct for the SDK — MIT or Apache-2.0?
**A:** ⚠️ **MISMATCH REQUIRES OWNER DECISION** — Source of truth: `sdk/package.json` `license` field. Basher ground truth: `license: MIT`. Root README says `License: Apache 2.0`. Both sub-READMEs say `MIT`. The SDK source LICENSE file needs to be inspected (or fixed). FID-022 SCOPE if LICENSE file === MIT → update root README to `MIT`; if LICENSE === Apache-2.0 → update sub-READMEs to match. **Owner decision required.**

### Q8. What is the actual default agent ID for the SDK `client.run({ agent: ... })` example?
**A:** ⚠️ **VERIFY** — sdk/README shows `savant-code/base@0.0.16` (pinned version). Verify against current `agents/base2/base2.ts` — the current default agent is `base2` per `agents/base2/`. FID-022 should update sdk/README example to use current stable + version-pinned pattern.

### Q9. Should the "1,131 consumer imports" claim from FID-017 propagate to sub-READMEs?
**A:** ✅ NO — root README-only context (pre-rebrand safety checkpoint is a top-level project statement; sub-READMEs shouldn't duplicate the framework-specific rationale). Sub-READMEs get a single "0.0.2 pre-rebrand safety checkpoint" note linking to root.

### Q10. Should FID-022 add a new "Validation" / "Build" section to sdk/README?
**A:** ✅ NO — sdk/README has no Validation section because SDK consumers don't run `bun run build:sdk` (that's a maintainer workflow). SDK consumers only need the public API.

### Q11. Should savant-free/README mention `npm install -g savant-free` if `savant-free` package doesn't exist on npm yet (package list shows it's a workspace dir but no published binary)?
**A:** ⚠️ **OWNER DECISION** — Verify: `npm view savant-free` would confirm. If not yet published, savant-free/README should say `Coming soon: npm install -g savant-free`. This is a status-of-launch question that only the owner can answer.

### Q12. Will sub-README polish affect npm publish?
**A:** ✅ YES indirectly — `npm publish` reads `README.md` adjacent to `index.cjs/mjs/d.ts` (set in `package.json` `files` field). When sdk is published, npm renders sdk/README.md as the package landing page. Same for savant-free. cli/README isn't published directly (CLI source repo, not npm-published as @savant-code/cli).

### Q13. Will FID-022 fix the root README `SavantCodeClient` vs `SavantClient` inconsistency?
**A:** ✅ YES — this is Decision D. The root README Quick Start block line currently shows `SavantClient`; FID-022 will fix to `SavantCodeClient`. This is the most important cross-FID fix because it directly affects how SDK consumers write their first line of code.

### Q14. Should FID-022 also touch `packages/agent-runtime/README.md` / `packages/code-map/README.md` / `packages/database/README.md` / `packages/llm-providers/README.md`?
**A:** ⚠️ **VERIFY EXISTENCE** — basher audit not yet done for these workspaces. Decision E pending: include in FID-022 OR defer to FID-023. If they exist, check if they're substantive (similar to sdk/README) or minimal. Recommend: include substantive ones in FID-022 batch; defer minimal/missing to FID-023.

---

## GREEN Plan — 6 Steps (~50 min total)

### Step 1 (~10 min) — Cross-FID consistency: Root README `SavantClient` → `SavantCodeClient`
Update root README § Quick Start step 4: replace `import { SavantClient } from '@savant-code/sdk'` with `import { SavantCodeClient } from '@savant-code/sdk'` AND `const client = new SavantClient({ ... })` with `const client = new SavantCodeClient({ ... })` AND `client.run({ ... })` stays the same. Then verify by reading the file.

### Step 2 (~10 min) — `sdk/README.md` ENRICH_CURRENT
Add banner image (`<img src="../assets/banner.png" alt="..." width="650" />`) above title; add badge block (5 badges: npm version, TypeScript SDK, Bun tested, MIT License, ECHO Protocol v0.2.0); add ECHO Protocol paragraph at end (1-2 sentences with cross-link to root); add footer cross-link "← Back to [repo root](../README.md) · MIT License". Verify against intended audience (SDK consumers).

### Step 3 (~10 min) — `cli/README.md` ENRITH_CURRENT
Add banner + badge block similar to sdk/README; add Quick Start block referencing root README § Quick Start; add ECHO Protocol § 1-line credit + cross-link. Footer with cross-link.

### Step 4 (~10 min) — `savant-free/README.md` ACCURACY_AUDIT_ONLY
Fix project structure: remove `web/` line (verified no `savant-free/web/` dir exists) or replace with actual structure (verified via `ls savant-free/`); add Features matrix (5-7 bullets describing what savant-free does); add ECHO Protocol mention. **MAY also need: if `npm install -g savant-free` isn't published yet, either keep as-is OR add "Coming soon" badge (Decision E).**

### Step 5 (~5 min) — Verify `packages/*` README state
Run basher audit: `find packages -name 'README.md' | xargs wc -l` to identify any workspace README that exists; flag for FID-022 inclusion OR defer to FID-023.

### Step 6 (~5 min) — AUDIT Verification Gate
- 6.1: All 3 sub-READMEs + root README have `markdownlint` issue count = 0 (or only out-of-scope MD013 warnings) — verified via user IDE Problems panel re-paste
- 6.2: `grep -rn 'SavantClient' README.md sdk/README.md cli/README.md savant-free/README.md` returns 0 hits (no stale SavantClient anywhere)
- 6.3: All substitutions remain clean (`@savant-code` / `SAVANT_FREE_MODE` / `SAVANT_CODE_API_KEY` / `dev:savant-free|build:savant-free` = 0 hits each)
- 6.4: All ECHO Protocol cross-links resolve to valid anchor (`#echo-protocol` etc.)
- 6.5: Cross-link targets exist (e.g., `../README.md` is a valid relative path from sdk/, cli/, savant-free/)

---

## 5 Inline Decisions for User Approval

### Decision A — sdk/README.md remediation strategy
- **✅ Option B (Recommended):** ENRICH_CURRENT — keep substantive API Reference, add banner + badges + ECHO mention + cross-link
- Option A (RESTORE_0_0_1): No ROI gain (upstream verified ≈ current)
- Option C (ACCURACY_ONLY): Insufficient — adds banner + ECHO citation anyway

### Decision B — cli/README.md remediation strategy
- **✅ Option A (Recommended):** ENRICH_CURRENT — add Quick Start cross-link + ECHO mention + banner
- Option B (MINIMAL): Skip polish — internal dev README not user-facing
- Option C (RESTORE_0_0_1): No ROI gain (upstream verified ≈ current)

### Decision C — savant-free/README.md remediation strategy
- **✅ Option B (Recommended ENRICH_CURRENT subset):** Fix project structure (`web/` line) + add Features matrix + ECHO mention
- Option A (KEEP_AS_IS): False economy — `web/` directory claim is a factual error
- Option C (RESTORE_0_0_1): No ROI gain (upstream verified ≈ current)

### Decision D — Cross-FID fix: Root README SavantClient → SavantCodeClient
- **✅ Option A (Recommended):** APPLY FIX in FID-022 (critical: affects SDK consumer first-encounter code)
- Option B (DEFER to FID-023): Acceptable but opens a new FID for trivial 2-line change; inefficient
- Option C (DO NOTHING): Risk that consumers get wrong class name on first try; ECHO Law 14 violation

### Decision E — packages/* README batch inclusion
- **✅ Option A (Recommended):** DEFER to FID-023 (focused audit first to see what exists)
- Option B (INCLUDE in FID-022): Will expand scope to ~7 files; FID-022 becomes 90+ minutes
- Option C (SKIP completely): No README work for packages/* this round

---

## 5-Question Compliance (ECHO Law 15)

| # | Question | Answer |
|---|----------|--------|
| 1 | Work for ALL cases? | ✅ Yes — 3 sub-READMEs + 1 root README cross-FID fix covers all 4 user-facing surfaces |
| 2 | Scale to 1000 agents? | ✅ Yes — static content, no runtime impact |
| 3 | Survive hostile attacker? | ✅ Yes — no security-sensitive content in sub-READMEs |
| 4 | 2-year maintainability? | ✅ Yes — accurate class names + cross-links survive post-rebrand |
| 5 | Industry standard? | ✅ Yes — multi-package repo with distinct READMEs per audience is standard OSS pattern |

---

## ECHO Compliance Checklist (Laws 1-15)

- **Law 1** (Read 0-EOF): ✅ PASS — read all 3 sub-READMEs + sdk/src/index.ts + referenced upstream
- **Law 2** (Present Before Act): ✅ PASS — this FID IS the present state, awaiting approval
- **Law 3** (Verify Before Proceed): ✅ PASS — basher grounded-truth on all 3 sub-READMEs + upstream verification
- **Law 4** (Verify Call-Graph Reachability): N/A — public READMEs, no production callers
- **Law 5** (no pseudo-code): ✅ PASS — concrete replacement / enrichment, no placeholders
- **Law 6** (no type safety shortcuts): ✅ PASS — no TypeScript code changes
- **Law 7** (search before create): ✅ PASS — fetched upstream 0.0.1 to confirm RESTORE not needed
- **Law 8** (log intent): Will write session summary after FORGE
- **Law 9** (production-grade docs): ✅ PASS — public-facing READMEs, end-user-quality
- **Law 10** (update tracking): ✅ PASS — this FID IS the tracking artifact
- **Law 11** (follow discovered patterns): ✅ PASS — follow FID-021 pattern, follow 0.0.1 layout design
- **Law 12** (no sensitive data): ✅ PASS — public content only
- **Law 13** (utility-first, universal logic): ✅ PASS — single source of truth via root README cross-links
- **Law 14** (all error paths handled): ✅ PASS — 14 missed questions with source citations; Decisions A-E cover all edge cases
- **Law 15** (build stays clean): N/A — READMEs have no build impact
- **Cross-Agent Claim Rule**: ✅ PASS — FID-022 explicitly addresses root README inconsistency surfaced by FID-021's polished state

---

## Scope Boundary

| IN scope (FID-022) | OUT of scope (separate FIDs) |
|---------------------|------------------------------|
| Root README `SavantClient` → `SavantCodeClient` cross-FID fix | LICENSE file audit (sdk may be MIT, root says Apache-2.0) — FID-024 follow-up |
| sdk/README.md ENRICH_CURRENT | `packages/agent-runtime/README.md` + other workspace READMEs — FID-023 follow-up (Decision E) |
| cli/README.md ENRICH_CURRENT | `npm install -g savant-free` publish status verification — Owner decision |
| savant-free/README.md ENRICH_CURRENT | Image alt-text improvements — FID-025 follow-up for accessibility |
| markdownlint fix where it surfaces | Banner image regeneration — separate FID |

---

## Implementation Order

1. Step 1 (~10 min) — Cross-FID fix: Root README `SavantClient` → `SavantCodeClient`
2. Step 2 (~10 min) — `sdk/README.md` ENRICH_CURRENT
3. Step 3 (~10 min) — `cli/README.md` ENRICH_CURRENT
4. Step 4 (~10 min) — `savant-free/README.md` ENRICH_CURRENT
5. Step 5 (~5 min) — Verify `packages/*` README state
6. Step 6 (~5 min) — AUDIT verification gate

**Total: ~50 minutes**

---

## Iteration History

| Version | Status | Notes |
|---------|--------|-------|
| **v1** | **RED proposing** | Sub-README inventory complete (3 files read); substitution audit confirms 0.0.2-clean state; cross-FID inconsistency (SavantClient vs SavantCodeClient) verified via sdk/src/index.ts; 14 missed questions answered with source citations; 6-step GREEN plan; 6-item AUDIT gate; 5 inline decisions pending user approval |

---

## Status

**AWAITING USER APPROVAL** of 5 Inline Decisions (B/A/A/A/A recommended).
