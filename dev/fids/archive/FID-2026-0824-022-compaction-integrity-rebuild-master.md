# FID: Compaction System Integrity Rebuild — Master Architecture

**Filename:** `FID-2026-0824-022-compaction-integrity-rebuild-master.md`
**ID:** FID-2026-0824-022
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 18:11
**YAGNI-Compliance:** Pending

---

## Summary

Master for rebuilding the compaction system's integrity per the operator's
2026-08-24 directives ("plan the full rebuild… run perfection loop on everything";
"system visible w/ a component and a summary like hermes does, using the traffic
light design system for all of it — highly visible when firing"). Evidence base:
`FID-2026-0824-020` (subagents inherit compacted history) and
`FID-2026-0824-021` (drop-list digest + invisible layers), grounded against five
working-tree files read 0-EOF and `resources/hermes-agent/trajectory_compressor.py`
(read 0-EOF). The four-layer architecture (SNIPE/MICRO/AUTO/REACTIVE) is RETAINED;
this rebuild changes what compaction PRESERVES, REVEALS, and HANDS TO SUBAGENTS.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4,
  OpenTUI + React (CLI TUI)
- **Tool Versions:** packages/agent-runtime @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Binding Amendments (Operator Directives, 2026-08-24)

| # | Directive | Binding position |
|---|---|---|
| V1 | "Visible w/ a component and a summary like hermes does… traffic light design system for ALL of it. HIGHLY visible when firing" | Every compaction layer renders through the `TrafficLightPanel` chrome (`CompactionSignal` lineage). In-flight firing shows a glowing in-stream panel (TerminalCommandDisplay class), never log-only. All phases render: micro 'compacted', warning, compacting, blocked, pruned, ineffective |
| V2 | Summary visible to the user | The pruner's produced summary + removed-region inventory are displayed in an expandable panel (collapsed by default, one keystroke to open) — hermes' transparency analog |
| P1 | No silent data-class loss | The drop-list digest is REPLACED by a preservation contract: read-class tool results retain structured digests (path/shape/head-tail slices); nothing vanishes without a ledger record |
| P2 | hermes algorithm disciplines | Protected head turns + last-N tail; compress only until under trigger (minimal surgery, remainder verbatim); never split tool_call/tool_response pairs |
| P3 | Evidence survives inheritance | Shared evidence spill (`.savant/evidence/<runId>.jsonl`) written at the tool-result boundary; `requiresRawEvidence` agents (verifier/adversary) splice raw records at spawn — resolves -020 |
| P4 | Ledger + notice + metrics | Removed-region inventory persisted AND user-renderable; model-facing notice injected post-replacement; per-event metrics recorded |
| M1 | Model rule | Any summarization model continues via `withParentModel` inheritance (existing B-08 fallback pattern untouched) — no new hardcoded slugs |
| Q1 | Quality ceilings | All modules respect `max_file_lines` 300 / `max_function_lines` 50 |

## Suite Manifest

| Child | Scope | Hard gate | Status / Receipt |
|---|---|---|---|
| `-023` | Visibility & transparency layer (V1/V2): all-phase rendering, in-flight glow, expandable summary viewer, un-suppress pruner stream into the panel | every phase state has a rendered fixture test | `closed` · sha256:4f3ad082… |
| `-024` | Preservation contract & digest schema (P1/D1): resultDigest per tool class replaces drop-list | digest round-trip fixtures per tool class | `closed` · sha256:fef329e5… |
| `-025` | Minimal-surgery algorithm (P2): protected head/tail, accumulate-until-target budgeting, pair-boundary snapping | no pair split under fuzzed histories; savings met or full-region fallback | `closed` · sha256:cce77973… |
| `-026` | Evidence spill & subagent splice (P3/-020 resolution) | compact-then-spawn fixture proves Verifier sees raw bytes | `closed` · sha256:cde6df3d… |
| `-027` | Removed-content ledger, metrics, model notice (P4) | ledger round-trip; notice present after replacement | `closed` · sha256:bc5b3566… |

## Impact Assessment

### Affected Components

- `agents/context-pruner/*`, `packages/agent-runtime/src/context-compactor/*`
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts`, evidence spill (new)
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`, spawn-agent-utils.ts
- `cli/src/components/compaction-signal.tsx` + chat-store compaction slice

### Risk Level

- [ ] Critical: —
- [x] High: silent evidence destruction + invisible firing degrade the
      double-audit guarantee and operator trust across every long session
- [ ] Medium / Low

## Resolution Policy

- ALL FIVE children are IMPLEMENTED at `fixed` with stamped receipts
  (`fid:verify --check` green each) as of 2026-08-24; closure (→ `closed` +
  archive) awaits the carried live smokes (TUI phase rendering, /compact run,
  verifier raw-citation probe). Master still closes when the last child closes.
- Sequence: `-023` FIRST (operator emphasis on visibility) → `-024` → `-025` →
  `-026` → `-027`. `-026` may proceed in parallel with `-025` once `-024`'s
  schema lands; `-027` consumes `-024` digests + `-025` regions.
- Config surface is ADDITIVE under `compression:`; existing off-switches
  (`microCompact`, `enabled`) keep semantics; defaults documented at GREEN.
- Every child declares Verification Gates and stamps receipts per
  FID-2026-0823-009 at fixed/verified flips.

## Perfection Loop

### Loop 1 — RED

- **RED:** Completed across -020/-021 Loop 1 passes (five runtime files +
  `compaction-signal.tsx` + hermes compressor read 0-EOF, citations in those
  records): drop-list digest destroys read-class data; micro-compact renders
  null in CompactionSignal; pruner streaming suppressed; summary content shown
  to nobody; subagents inherit lossy history.
- **GREEN:** Amendments V1–Q1 folded from operator directives; suite authored.
- **AUDIT:** Batched suite Verifier (2026-08-24): FAIL ×1 — Impact Assessment
  absent → discharged same session (compact section inserted between Suite
  Manifest and Resolution Policy); cross-refs / amendment propagation V1–Q1 /
  citations / status honesty all PASS.
- **ADVERSARIAL:** STANDS (2026-08-24): FAIL discharged on disk re-audit;
  omission sweep clean across all eight records (statuses / attribution / gate
  shapes / config disjointness); suite cleared to flip.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Rewrite the pruner as LLM summarization instead? → No — keep deterministic
   core (cheap, auditable) but bind it to the preservation contract; optional
   LLM fold becomes an additive phase behind config (M1 model rule applies).
2. Does V1 visibility risk transcript noise? → In-flight glow + collapsed-by-
   default expanders mirror TerminalCommandDisplay precedent; noise bounded by
   design, not by silence.
3. Migration for mid-session upgrades? → Spill/ledger are append-only new
   channels; old sessions unaffected; no history migration needed.

### Code Verification Evidence

All five children implemented 2026-08-24 and receipt-stamped (`fid:verify
--check` green each); fingerprints recorded in the Suite Manifest Status
column. Master-level gates re-run green post-sync (typecheck packages/agent-
runtime + cli exit 0). Carried boundaries live at child level (live smokes).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck cli

### Verification Receipt

- fingerprint: sha256:5c75033f73b3e4e796a495422a4259e7ad5bfd0667ec095242e6b55529af6593
- verified: 2026-08-25T01:27:36.603Z
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Coordination master — all five children implemented,
  receipt-stamped (`--check` green each), batched Verifier+Adversary closure
  audit PASS; children closed via operator live-smoke WAIVER directive
  (never claimed passed).
- **Tests Added:** Yes — per child (see child Verification Gates).
- **Verification Evidence:** child receipts 4f3ad082 (-023) · fef329e5 (-024) ·
  cce77973 (-025) · cde6df3d (-026) · bc5b3566 (-027); master-level typechecks
  packages/agent-runtime + cli exit 0.

## Lessons Learned

(pending — captured at closure)