# Nova Verdict — A-Z Test v3 Findings + FID-011/012

**Date:** 2026-07-18
**Re:** `outbox/2026-0718-az-test-v3-findings-verified.md`
**Auditor:** Nova (external ECHO v0.2.0)
**Method:** Ran `bun test` myself (Finding A). Grepped `write-file.ts` myself (Finding D). Read both FID v1 docs. Source-verified, not trusted report.

---

## VERDICT: Orchestrator's cross-verification CONFIRMED. Both real findings valid. FID-011 + FID-012 v1 ready for approval.

### Finding A — Stale agent refs in free-agents.test.ts ✅ REAL (I ran it)
```
$ cd common && bun test src/__tests__/free-agents.test.ts
8 pass | 2 fail | 136 expect() calls
```
- 2 failures: `code-reviewer-lite` tests. Agent deleted in FID-006 (consolidated → verifier).
- FID-011 plan (delete 2 stale tests, ~40 lines) is correct per ECHO Law 13 (dead-code tests target dead code). ✅
- Five-Q all YES. Missed-Q5 honestly scopes out the `/help` phrasing issue. ✅

### Finding D — GREEN-phase path-traversal not contained ✅ REAL (I grepped)
- `grep` for `path.resolve|realpathSync|path.normalize|normalizePosix` in `write-file.ts` → **0 matches**. No containment at handler. ✅
- From earlier read (tool-executor.ts:344-366): gate normalizes ONLY for exempt-check, passes `rawPath` UNRESOLVED to handler. GREEN write to `../../../etc/passwd` → `/etc/passwd`, no containment. ✅
- FID-012 fix (`resolveAndContain` in NEW `common/src/util/paths.ts`, wired into gate + write-file.ts + str-replace.ts) is sound, defense-in-depth correct. ✅

### Findings B, C, E — Correctly NOT defects
- B (idle→green rejected): `VALID_TRANSITIONS` confirms. Test wording imprecise. ✅
- C (dev override + sequentialthinking): tool-executor.ts:384 confirms `!isDevOverride`. Test spec stale. ✅
- E (tmux on Windows): environment limitation. Source-verify only path. ✅
- Orchestrator correctly gave these NO FIDs.

### FID-011 — APPROVED for AUDIT+Forge (pending your sign-off)
- Perfection Loop converged. Five-Q YES. Correct scope (delete, not update). Clean rollback.

### FID-012 — APPROVED for AUDIT+Forge (pending your sign-off)
- 8 missed Qs answered, 35/35 Five-Q YES. Q3/Q4 symlink honestly declined as future-FID (no over-promise). Q8 tweak (containment even on exempt-with-`..`) shows adversarial thinking. ~138 lines, 5 files, well-scoped.

---

## ONE FLAG (severity context)

FID-012 marked "medium" — fair for CURRENT human-driven CLI (GREEN requires FID auth). But once Savant-Core spawns Savant-Code autonomously (your agent-economy vision), a GREEN-phase agent writing outside project root = real attack surface. **Recommend bumping to HIGH in the autonomous-deployment context.** Not blocking for now.

---

## ECHO COMPLIANCE OF THIS EXCHANGE

- **Law 1 (Read 0-EOF):** ✅ Read both FID docs fully (220 + 378 lines). Read tool-executor.ts earlier.
- **Law 3 (Verify Before Proceed):** ✅ Ran `bun test` myself (2 fail confirmed). Grepped write-file.ts myself (0 matches confirmed).
- **Law 4 (Call-Graph Reachability):** ✅ FID-012 includes call-graph greps as acceptance criteria (resolveAndContain at 3+ sites).
- **Cross-Agent Claim Rule:** ✅ Orchestrator independently verified Savant's claims. I independently verified the Orchestrator's. Three layers.
- **Honest Assessment:** ✅ Orchestrator's caveats (symlink, no-tmux) preserved. I added the autonomous-deployment severity note.

---

**Nova — both findings real, both FIDs correctly composed. Awaiting your approval to let the Orchestrator enter AUDIT + Forge.**
