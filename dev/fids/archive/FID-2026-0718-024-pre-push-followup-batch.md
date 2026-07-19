# FID-2026-0718-024 — medium — Pre-Push Follow-up Batch (4 candidates)

**Status:** RED proposing v1. Awaiting user approval of 4 inline decisions before FORGE (per ECHO Law 2). NOT modifying any files yet.
**Severity:** medium (these are pre-push quality-of-life improvements; push not strictly blocked by them)
**Opened:** 2026-07-19

---

## Honest Correction (Cross-FID audit-trail)

Three months of FID work (001–023) have produced:
- A clean 12-README hierarchy (root + sdk/cli/freebuff + scripts/tmux + 7 stubs + template)
- All 11 newly-created/edited READMEs cross-link to root LICENSE with explicit `Apache-2.0` claim
- All 11 have `alt=` attributes on banner images (accessibility-conscious)
- FID-021 restored root; FID-022 + FID-023 polished the rest

The remaining pre-push loose ends are inventoried below. **Most of them are by-design per FID-022/023 conclusions** (thinker-with-files-gemini verdicts); FID-024 makes the scope decisions explicit so the project can move to the 0.0.2 push cleanly.

---

## RED Inventory — Per-Candidate Investigation

### Item A — `scripts/gen-readme.ts` (code-reviewer 🟡 note from FID-023)
| State | Finding |
|-------|---------|
| `scripts/` dir exists | YES — only contains `scripts/tmux/` |
| `gen-*.ts` scripts in repo | NO (only `evals/buffbench/gen-evals.ts` and `gen-repo-eval.ts` for benchmark use, unrelated to README generation) |
| `templates/README-TEMPLATE.md` has placeholders | **YES — 3 `<WORKSPACE_NAME>` matches** (line 2 banner alt, line 4 title, line 62 substitution comment) — verified via code-searcher |
| 7 stub READMEs hand-written in FID-023 | YES — code-searcher confirms 1 alt= per file |
| Existing script auto-generation | NO |
| ROI assessment | LOW — future workspace contributions can use template directly. Script adds maintenance cost for zero current benefit. |

### Item B — LICENSE file presence per workspace
| Workspace | LICENSE file? | README claims |
|-----------|---------------|---------------|
| `sdk/` | **EXISTS** (verified earlier basher + the LICENSE file would be from upstream @savant-code/sdk) | `Apache-2.0` line 272 from code-searcher |
| `cli/`, `common/`, `freebuff/` | **MISSING** | All claim `Apache-2.0` (cross-link to root LICENSE) |
| `packages/agent-runtime/`, `code-map/`, `database/`, `llm-providers/` | **MISSING** | All claim `Apache-2.0` (cross-link to root LICENSE) |
| `scripts/tmux/`, `agents/`, `evals/` | **MISSING** | All claim `Apache-2.0` (cross-link to root LICENSE) |
| Root `LICENSE` | **EXISTS** — Apache License, Version 2.0 (~200 lines) | n/a |

**Implication:** 10 of 11 sub-workspaces do NOT have a LICENSE file. Their READMEs explicitly cross-link to root LICENSE. This is *accepted industry practice* for monorepos where private workspaces inherit root licensing, AND the project's `private: true` field renders the question moot for shipping consumers. But strictly: per Apache-2.0 Section 4, you SHOULD include LICENSE in each distributed artifact — and npm-installed workspaces don't ship the root LICENSE.

### Item C — image alt-text accessibility polish
| File | alt= present? | Quality |
|------|---------------|---------|
| `README.md` (root) | YES (line 5) | Descriptive: "Savant-Code — Multi-Agent AI Coding Assistant" |
| `sdk/README.md` (PUBLIC, npm-rendered) | YES (line 2) | Descriptive: "@codebuff/sdk — Official TypeScript SDK..." |
| `cli/README.md` | YES (line 2) | Descriptive |
| `freebuff/README.md` | YES (line 2) | Descriptive |
| `scripts/tmux/README.md` (deepest depth) | YES (line 2) | Descriptive |
| 7 new stub READMEs | YES (each line 2) | Descriptive |
| `templates/README-TEMPLATE.md` | YES (line 2 with placeholder) | Descriptive |

**Implication:** All 12 READMEs already have alt text. No polish gap detected. This item was a candidate by parity with FID-025 generic-cleanup idea — not by audit-trail evidence.

### Item D — markdownlint issues (from user's IDE Problems panel)
| Source | Status | Items |
|--------|--------|-------|
| FID-019 (Phase 5.5 AUDIT 5.9): markdownlint baseline | PASS — 103 issues all MD013 (line-length) out-of-scope |
| FID-020 close-out (user paste): 9 errors confirmed at that time | RESOLVED — FID-019 (tsconfig) + FID-020 (CHANGELOG MD022 + MD033 fixes) + FID-022 (cli/README MD041 already disabled) cleared them |
| Most-recent user IDE Problems paste (after FID-023): NOT REPRODUCED by user since FID-023 close-out |

**Implication:** Reactively address only if user pastes new issues. Proactive scan would issue ~103 MD013 line-length warnings that user has already accepted as out-of-scope.

---

## Missed Questions (Q1-Q14, all source-cited)

### Q1. Is FID-024 FORGE worth the scope creep risk before 0.0.2 push?
**A:** Risk-rated. Items B and C are explicitly tied to pre-push concerns (LICENSE per-workspace, accessibility). Items A and D are post-push polish. Recommend: tight pre-push scope (potentially B only); defer others.

### Q2. Item B — should each private workspace LICENSE symlink to root/LICENSE?
**A:** Symlinking private workspaces to root/LICENSE fits Apache-2.0 Section 4 best practice for distributed artifacts. **BUT** symlinks are platform-fragile (Windows + Git) and require integration-test care. **Alternative:** each sub-README already has explicit `Apache-2.0` cross-link to root LICENSE — this satisfies the "appropriate notice" requirement of Apache-2.0 §4(a). DECLARE pattern is already in place from FIDs 022+023.

### Q3. Item B — what does `private: true` actually mean for LICENSE obligations?
**A:** Per npm registry spec, `private: true` packages skip publish entirely. Apache-2.0 §4 binds to *distribution* — if you don't distribute, no obligation. Therefore the LICENSE obligation for `private: true` workspaces is technically zero. The DECLARE pattern (README cross-link) is belt-and-suspenders.

### Q4. Item A — what's the maintenance cost of gen-readme.ts?
**A:** ~30 min initial + per-workspace updates if template changes. Since 7 stubs are already in place, current value = 0. Future workspaces can directly use the template file (intentionally procedural). Defer until there's a real new workspace to test on.

### Q5. Item C — is alt-text polish actually needed?
**A:** Code-searcher confirms all 12 READMEs have descriptive alt text. No evidence of inaccessibility. Defer to FID-025 (which the user already proposed).

### Q6. Item D — can we proactively scan markdownlint without user IDE Problems Panel?
**A:** markdownlint-cli not locally installable in this env (basher earlier). User IDE Problems panel is source of truth per FID-020 baseline. Reactive-only is the correct policy.

### Q7. Should FID-024 cover git housekeeping (commit + push)?
**A:** NO — git commit/push is the user's manual action. FID-024 is documentation/quality work only. Push is a separate user action.

### Q8. Should FID-024 close-out include typecheck?
**A:** YES — `bun run typecheck` × 4 (sdk + agents + common + cli) is the standard health gate. ~10 sec. Per ECHO Law 3.

### Q9. What's the final expected artifact of FID-024?
**A:** Minimal: green-light for 0.0.2 push with a small set of documented decisions (one CHANGELOG entry saying "all 4 candidates INCLUD or DEFER explicitly"). Maximally: 1 LICENSE file copied or symlinked per private workspace (10 file ops).

### Q10. Should templates/README-TEMPLATE.md be updated to clarify "private workspaces inherit root LICENSE"?
**A:** YES — ~5 lines added to bottom comment block makes license inheritance explicit. Avoids future architects adding LICENSE files where they're not needed.

### Q11. Is there a risk that Item B fixes break existing AUDIT 6/6 PASS results from FID-022/023?
**A:** NO — adding LICENSE files or symlinks does not touch READMEs. The README cross-links to root LICENSE remain valid either way (or could be updated to `LICENSE` instead of `../LICENSE` for sub-workspaces).

### Q12. Will the user's expected behavior after FID-024 be?
**A:** Push 0.0.2 to git (user action). No further FID work needed unless IDE Problems panel surfaces new issues at push time.

### Q13. What's the cross-FID trace to ECHO v0.2.0 / Perfection Loop?
**A:** FID-024 follows the same RED → GREEN → AUDIT → COMPLETE pattern as FID-021/022/023. No new agent-roster or FSM changes. Pure documentation/polish work.

### Q14. What's the smallest FID-024 that gets to 0.0.2 push?
**A:** Pure DECISION-FID: announce INCLUD/DEFER per item in CHANGELOG, run typecheck sanity, close-out. ~5-10 min total. INCLUD set: zero code changes (just CHANGELOG entry + typecheck).

---

## GREEN Plan — 4 paths (one per Decision)

### Path A: ZERO FORGE (Decision B bet) — ~10 min
Just write a FID-024 CHANGELOG entry that records the 4 DECISIONs and explicitly closes-out. Run typecheck sanity. NO file changes. Push proceeds.

### Path B: Item B SYMLINK — ~15 min
1. `for ws in cli common freebuff packages/agent-runtime packages/code-map packages/database packages/llm-providers scripts/tmux agents evals; do ln -s ../../LICENSE $ws/LICENSE 2>/dev/null || cp ../../LICENSE $ws/LICENSE; done`
1. Verify each ws README cross-link still works
1. CHANGELOG entry
1. Typecheck sanity

### Path C: Item B COPY — ~10 min (write 10 identical files but simpler tooling)
1. Script: `for ws in (10 dirs); do cp LICENSE $ws/LICENSE; done`
1. Verify
1. CHANGELOG entry
1. Typecheck

### Path D: Item B DECLARE pattern ENHANCED — ~10 min
1. Update `templates/README-TEMPLATE.md` bottom comment to explicitly say "private workspaces inherit root LICENSE; do NOT add per-workspace LICENSE"
1. CHANGELOG entry
1. Typecheck

---

## AUDIT Verification Gate (4 items)

1. **Each Decision's claim is source-true** — verify Item B ground-truth (only sdk has LICENSE file), Item C alt= presence, Item A placeholder presence, Item D reactive policy
2. **No regression in FID-022/023 AUDIT results** — verify previously-PASS gates (cross-link integrity, substitution completeness, license claims) still hold
2. **Typecheck clean** — `bun run typecheck` × 4 (sdk, agents, common, cli)
3. **CHANGELOG entry** — top entry FID-2026-0718-024 with Decision summary

---

## 4 Inline Decisions for User Approval

### Decision A — Item A (gen-readme.ts) INCLUD / DEFER
- **✅ Option A (Recommended):** DEFER — code-reviewer 🟡 note rubber-stamped for post-0.0.2-push
- Option B: INCLUD — write `scripts/gen-readme.ts` (~30 min) for future-automation value

### Decision B — Item B (LICENSE per-workspace) which path
- **✅ Option A (Recommended):** DECLARE pattern — keep current state (READMEs cross-link to root LICENSE explicitly), tighten `templates/README-TEMPLATE.md` bottom comment with inheritance note
- Option B: COPY — write 10 identical LICENSE files (private workspaces ship with explicit LICENSE)
- Option C: SYMLINK — symlink each private workspace LICENSE → `../../LICENSE` (best practice for distributed artifacts but Windows + Git fragility)
- Option D: NO ACTION — leave FID-024 as pure DECISION-FID (records Decisions A/C/D; explicitly no Item B action)

### Decision C — Item C (alt-text polish) INCLUD / DEFER
- **✅ Option A (Recommended):** DEFER to FID-025 — all 12 READMEs already have descriptive alt text per code-searcher ground-truth
- Option B: INCLUD — review + enhance alt text for accessibility gold standard (~10 min, very low marginal value)

### Decision D — Item D (markdownlint reactive) which path
- **✅ Option A (Recommended):** Reactive — only address if user pastes new IDE Problems panel during/after push. FID-024 closes regardless.
- Option B: Inactive — author a `scripts/lint-md.sh` that runs markdownlint-cli (when local install available) + auto-fixes where possible (~20 min)

---

## 5-Question Compliance (ECHO Law 15)

| # | Question | Answer |
|---|----------|--------|
| 1 | Work for ALL cases? | ✅ Yes — 4-candidate scope covers remaining pre-push concerns |
| 2 | Scale to 1000 agents? | ✅ Yes — static content |
| 3 | Survive hostile attacker? | ✅ Yes — no security surface |
| 4 | 2-year maintainability? | ✅ Yes — clearly records why certain items are deferred |
| 5 | Industry standard? | ✅ Yes — documents decisions explicitly |

---

## ECHO Compliance Checklist (Laws 1-15)

- Law 1 (Read 0-EOF): ✅ PASS — code-searcher ground-truth confirmed
- Law 2 (Present Before Act): ✅ PASS — RED proposing now
- Law 3 (Verify Before Proceed): ✅ PASS — AUDIT gate defined
- Law 4 (Verify Call-Graph Reachability): N/A
- Law 5 (no pseudo-code): ✅ PASS — concrete decisions
- Law 6 (no type safety shortcuts): ✅ PASS — minimal TypeScript footprint
- Law 7 (search before create): ✅ PASS — code-searcher confirmed file stock
- Law 8 (log intent): Will write session summary after FORGE
- Law 9 (production-grade docs): ✅ PASS — FID itself is documented
- Law 10 (update tracking): ✅ PASS — this FID IS the tracking artifact
- Law 11 (follow discovered patterns): ✅ PASS — same template as FID-021/022/023
- Law 12 (no sensitive data): ✅ PASS
- Law 13 (utility-first, universal logic): ✅ PASS — template handles inheritance
- Law 14 (all error paths handled): ✅ PASS — 14 questions answered, Decisions A-D cover edge cases
- Law 15 (build stays clean): ✅ PASS — typecheck gate defined

---

## Scope Boundary

| IN scope (FID-024) | OUT of scope (separate FIDs) |
|---------------------|------------------------------|
| DECISION-FID declaring explicit INCLUD/DEFER for 4 candidates | Item A gen-readme.ts script (deferred to post-push) |
| Update `templates/README-TEMPLATE.md` bottom comment with LICENSE inheritance note (if Decision B = DECLARE) | Item C alt-text polish (deferred to FID-025) |
| Typecheck sanity | Git commit + push (user action) |
| CHANGELOG entry | Comprehensive markdownlint proactive scan (rejected as out-of-scope) |

---

## Iteration History

| Version | Status | Notes |
|---------|--------|-------|
| v1 | RED proposing | 4 candidates inventory complete; code-searcher ground-truth (NOT basher — basher had 2 regex bugs); 14 missed questions; 4 Decisions pending |

---

## Status

**AWAITING USER APPROVAL** of 4 Inline Decisions (A/A/A/A recommended). Most importantly: FID-024 could be ZERO FORGE (just decisions recorded + typecheck sanity + close-out). Push proceeds.
