# Nova Audit Request — FID-023 Internal Workspace READMe Close-Out

**Date:** 2026-07-19
**From:** Savant Orchestrator
**Re:** FID-2026-0718-023 — 9-file README batch: scripts/tmux polish + 7 new stub READMEs + templates/README-TEMPLATE.md
**Priority:** medium (internal workspaces ship in monorepo only — all are `private: true` per package.json; contributor-experience not consumer-facing)

---

## 8 Claims to verify (source-true via direct file read)

1. **scripts/tmux/README.md (340 → 348 lines, polished)** — verify first 8 lines have banner + cross-link note; verify last 5 lines have `## License` (Apache-2.0) + `<sub>...</sub>` footer
2. **7 new stub READMEs CREATED** at `agents/README.md`, `common/README.md`, `evals/README.md`, `packages/agent-runtime/README.md`, `packages/code-map/README.md`, `packages/database/README.md`, `packages/llm-providers/README.md` — verify file existence + non-trivial content
3. **`templates/README-TEMPLATE.md` has procedural placeholder substitutions** — verify 4 placeholder variables (`<WORKSPACE_NAME>`, `<WORKSPACE_TAGLINE>`, `<WORKSPACE_DIR>`) + bottom comment block with banner width guidance (850 root / 650 sub-internal / drop ECHO badge for dev-tooling)
4. **Cross-link depth correctness** — 1-level READMEs (agents, common, evals, scripts/tmux at depth 2) use `../` for plain files but `../../` for scripts/tmux (depth 2); 2-level READMEs (packages/X) use `../../` for root assets + LICENSE + ECHO
5. **License consistency Apache-2.0** — verify all 8 modified + 1 template files reference Apache-2.0 (template has placeholders; actuals all claim it)
6. **Banner image references** — verify `assets/banner.png` is present in all 8 modified, with correct depth prefix (`../` for 1-level, `../../` for 2-level packages); all width=650 (sub-page compactness vs root 850)
7. **Substitution completeness** — verify 0 hits for `SavantClient`/`SAVANT_FREE_MODE`/`SAVANT_CODE_API_KEY`/`dev:savant-free` in the 8 modified files. (Templates may legitimately contain reference patterns; the unmodified SDK + CLI + savant-free + root README are unchanged from FID-022 state.)
8. **ECHO Protocol mention** — verify all 7 new stubs include ECHO badge + footer attribution; scripts/tmux deliberately excluded per thinker-with-files-gemini verdict (headless CI infra is outside ECHO scope)

---

## 2 Critical bugs caught + fixed (cross-FID audit-trail)

### Bug 1: cross-link depth wrong in 4 packages/X/README.md

Initial FORGE wrote `../README.md`/`../ECHO.md`/`../LICENSE` for all 4 `packages/X/` files (depth 2). The `../` paths would have resolved to `packages/README.md` / `packages/ECHO.md` / `packages/LICENSE` (don't exist). Code-reviewer caught this. Fixed: replaced `../X` → `../../X` in 4 files (also `../assets/banner.png` → `../../assets/banner.png`).

### Bug 2: evals/README.md badge URL typo

Initial FORGE wrote `%230000.md` (missing trailing "00") in ECHO badge URL. Code-reviewer caught this. Fixed: `%23000000`.

---

## Source-truth receipts

### Auditor-verified facts

- **scripts/tmux**: Has banner prepend + License + Footer append (Option A per thinker verdict), no ECHO badge
- **agents/README.md** has 9-agent enumeration matching ECHO.md actual content
- **common/README.md** references ECHO Law 13 (Utility-First, Universal Logic) — verified correct
- **evals/README.md** references 4 benchmark profiles (savant-code-hard / manifold / plane / saleor) verified against `evals/*.json` filenames
- **packages/agent-runtime/README.md** documents FSM, AgentState, transition_phase — verified against `packages/agent-runtime/src/` source
- **packages/code-map/README.md** documents tree-sitter WASM + AST structural queries — verified against package.json deps
- **packages/database/README.md** documents Postgres + Drizzle + 2 export surfaces (root + `./service`) — verified against package.json
- **packages/llm-providers/README.md** documents `@ai-sdk/provider` + OpenAI-compatible surface — verified against package.json
- **templates/README-TEMPLATE.md** has 4 placeholder variables + bottom comment block

### Code-reviewer verdict evolution

| Snapshot | Verdict | Trigger |
|---|---|---|
| Initial | NEEDS_FIXES | 🔴 4 packages/X files had `../X` cross-link depth bug (would resolve to wrong dir); 🔴 evals badge URL had `%230000.md` typo |
| Post-fix | (running) | Both bug classes fixed via 14 str_replace operations; corrected AUDIT 5/5 PASS |

---

## AUDIT gate status (post-fix, per orchestrator's corrected re-verification)

| Gate | Status | Evidence |
|------|--------|----------|
| 1. File existence + content correctness | PASS | 9 files exist + non-trivial |
| 2. Prefix depth (1-level vs 2-level) | PASS | agents/common/evals `../` ✓; packages/X `../../` ✓; scripts/tmux `../../` ✓ |
| 3. Cross-link resolution (EXACT prefix tested) | PASS | README.md/LICENSE/ECHO.md/assets/banner.png resolve at each file's correct depth |
| 4. Substitution completeness | PASS | 0 hits for SavantClient/@savant-code/SAVANT_FREE_MODE/SAVANT_CODE_API_KEY across 8 modified |
| 5. License + banner | PASS | Apache-2.0 in all 8 modified; banner image width=650 in all 8 |

---

## Nova-specific verification (third-layer audit)

Please verify:

1. The 7 stub `## Purpose` sections are UNIQUE to each workspace (not copy-paste of root README Repo Map table rows)
2. The template at templates/README-TEMPLATE.md is procedurally usable (i.e., someone could follow it to create a new workspace README without consulting other docs)
3. Per-workspace cross-link depth is correctly handled (no broken `../X` paths that resolve to the wrong file)
4. Banner image width 650 is sane for sub-page layouts (vs root 850)
5. The decision to OMIT ECHO badge block from scripts/tmux (headless CI tooling) is correct per thinker-with-files-gemini verdict

Counter-claim any over-statements. Demand source-truth receipts.

---

## Deliverable expected from Nova

- **Verdict per claim** (1-8 above): PASS / NEUTRAL / FAIL with line-precise evidence
- **Overall verdict:** PASS / CONDITIONAL / FAIL
- **Required follow-ups if CONDITIONAL**

Savant is awaiting your third-layer sign-off before FID-023 closes to COMPLETE.

**ECHO Law 3 (Verify Before Proceed) + Cross-Agent Claim Rule apply.**
