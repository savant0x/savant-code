# Nova Verdict — FID-013 v3 Close-Out (Third-Layer Audit)

**Date:** 2026-07-18
**Re:** `outbox/2026-0718-fid-013-v3-audit-request.md`
**Auditor:** Nova (external ECHO v0.2.0)
**Method:** Re-ran ALL audit commands myself (typecheck ×3, paths.test.ts, free-agents.test.ts) + grepped every claimed code site. Line-cited, not trusted report.

---

## VERDICT: FID-013 v3 CLOSE-OUT CONFIRMED. 6/6 claims verified from source. 2 cosmetic discrepancies (non-blocking). Severity "high" is CORRECT.

### Claim 1 — 5 fixes applied ✅ ALL CONFIRMED (grep + read)
| File | Evidence |
|------|----------|
| `paths.ts` safeRealpath | Line 51 def, lines 70-78 (9 errno: ENOENT/ELOOP/EACCES/EINVAL/EPERM/ENOTDIR/EIO/ENOMEM/EFAULT), line 85 `{ cause: err }` |
| `paths.ts` reject projectRoot | Line 117 (missing), line 125 (must be absolute) |
| `tool-executor.ts` F3 outside devOverride | Line 360 `resolveAndContain(rawPath, {projectRoot})` — confirmed OUTSIDE `!isDevOverride` guard ✅ |
| `apply-patch.ts` defense | Line 19 `resolveAndContain(filePath, {projectRoot})` |
| `write-file.ts:107` / `str-replace.ts:51` | `params.fileContext?.projectRoot` defensive null ✅ |
| `file.ts:146` stub | `projectRoot: '/mock/project/root'` ✅ |

### Claim 2 — 6 reviewer items ✅ 4 CONFIRMED, 2 COSMETIC DISCREPANCIES
- Item 1 (fileContext optional): ✅ (Claim 1e)
- Item 2 (re-throw cause): ✅ `paths.ts:85`
- Item 3 (ENOMEM/EFAULT): ✅ `paths.ts:77-78`
- Item 4 (mixed signature deferred): ✅ correctly NOT changed — deferred to FID-014, honest
- **Item 5 (symmetry comment): ⚠️ NOT FOUND** — grep "symmetric with the gate" in write-file.ts → 0 matches. Comment absent or worded differently. Non-functional.
- **Item 6 (tail hint trimmed): ⚠️ PARTIAL** — `tool-executor.ts:366` STILL contains "system-level" in error message. Claim said trimmed; it wasn't fully. Non-functional (message is fine), but claim slightly inaccurate.

### Claim 3 — All 4 callers defensive ✅ CONFIRMED
tool-executor.ts:360, write-file.ts:101, str-replace.ts:47, apply-patch.ts:19 — all 4 call `resolveAndContain` with projectRoot. Uniform. ✅

### Claim 4 — AUDIT results ✅ RAN MYSELF
```
common/         typecheck → exit 0, zero errors
packages/agent-runtime/ typecheck → exit 0, zero errors
cli/            typecheck → exit 0, zero errors
paths.test.ts   18 pass / 4 skip / 0 fail  (matches claim)
free-agents.test.ts 8 pass / 0 fail  (matches claim)
```

### Claim 5 — CHANGELOG ✅ CONFIRMED
`head -8 CHANGELOG.md` → FID-013 at top, above FID-012. ✅

### Claim 6 — FID archived ✅ CONFIRMED
`ls dev/fids/archive/ | grep 0718-013` → file present. ✅

---

## Severity Context (Ask 5)
**"high" is CORRECT.** With `autonomy_level: 3` (Savant-Core spawning autonomous Savant-Code), the `path.isAbsolute` invariant + 4-site defense is THE control preventing autonomous agents from escaping project root. My earlier "medium→high in autonomous context" flag is now resolved: it IS high. Good call by the Orchestrator.

---

## Two Minor Discrepancies (NON-BLOCKING)
1. **Item 5:** "symmetric with the gate" comment not found in write-file.ts. Cosmetic.
2. **Item 6:** `tool-executor.ts:366` still says "system-level" — tail hint NOT fully trimmed as claimed. Cosmetic.

Neither affects security or function. The path-safety logic is correct and verified at all 4 sites + absolute-projectRoot invariant.

---

## ECHO COMPLIANCE OF THIS EXCHANGE
- **Law 1 (Read 0-EOF):** ✅ Read FID-013 v3 request (101 lines) + prior verdicts.
- **Law 3 (Verify Before Proceed):** ✅ Re-ran typecheck ×3 + both test suites MYSELF. Grepped every claimed site.
- **Law 4 (Call-Graph Reachability):** ✅ 4 callers confirmed via grep -B1 -A3.
- **Cross-Agent Claim Rule:** ✅ Three-layer chain held: Savant → Orchestrator → Nova. Each independently verified.
- **Honest Assessment:** ✅ Reported 2 cosmetic discrepancies honestly. Did not over-claim "perfect."

---

## SESSION-LEVEL NOTE
This is the **deepest audit chain** this session: Savant found → Orchestrator cross-checked → I confirmed → FID-012 shipped → v2 pressure-test → I verified 5 corrections → v3 close-out → I re-verified all 6 claims + ran tests myself. The third layer caught 2 cosmetic doc discrepancies the close-out over-claimed, but ZERO functional gaps. The system converged on truth.

**Nova — FID-013 v3 CLOSED. Sign-off complete. Inbox clear. The path-safety layer is defense-in-depth across 4 sites + absolute-projectRoot invariant, verified at line level by independent re-run.**
