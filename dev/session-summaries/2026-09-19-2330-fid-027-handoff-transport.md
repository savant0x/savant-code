# Session summary — 2026-09-19 23:30 — FID-2026-0919-027 (inter-agent handoff transport)

**Directive (verbatim):** "now, we get serious. I want to review the information
flow through the system, see if there are any logic issues, anything that agent B
needs from agent A, but it doesnt properly transport. think about inter-agent
communications/hands offs. We need to ensure all the info/packages flow
flawlessly through the entire system."

**Automation level:** 3 — every finding was decidable from the code and fixable
mechanically; no operator ruling was requested or needed.

## What was reviewed

The spawn boundary, both directions, in this order:

1. **Parent → child construction** — `createAgentState` (the only child-state
   constructor in the runtime; one hit for `parentId: <value>`).
2. **The propagation contract** — `SubagentPropagationSnapshot` +
   `executeSubagent`'s two validations.
3. **Child → parent return** — `loopAgentSteps`'s `output`,
   `getAgentOutput`'s three output modes, the relay in `handleSpawnAgents`
   (`safeToJSONValue(output)` + the recorder stall guard) and in
   `handleSpawnAgentInline`.
4. **Evidence transport** — the FID-2026-0824-026 spill/splice pair, at every
   spawn site.
5. **Verdicts** — the ZTAP binding on both spawn paths.

## Findings and what was done

| # | Finding | Fix |
|---|---|---|
| 1 | `enforcementMode` not transported → strict runs hybrid in every child (`all_15` → `core_4`) | `inheritRunGovernance` at the construction point |
| 2 | `designContract` not transported → no design gate on any child write (Forge is always a child) | same |
| 3 | `protocolSource` not transported → embedded installs re-resolve `local`; grounding identity diverges | same |
| 4 | `provenanceMode` not transported → child defaults to `record`; a divergent ZTAP session is possible | same |
| 5 | Raw evidence: batch path required a ROOT parent, inline path never loaded | one loader, union over the run chain, both sites |
| 6 | `context-pruner` batch-spawnable → succeeded, billed, changed nothing | rejected at both seams, reason names the mechanism |
| 7 | Inline relay dropped `structured_output` artifacts | relay real output except for harness-owned inline agents |
| 8 | Two implementations of the verdict-receipt binding (batch had its own copy) | both route through `applyVerdictReceipts` |

Not findings (checked, then documented as designed): `maxContextLength` and
`digestCaps` are re-stamped for every run by `createLoopContext`;
`groundingCheckpoint` is deliberately not inherited because children are exempt
from the boot gate.

## Evidence

- **RED → GREEN, live:** `dev/scratchpad/active/handoff-transport-audit.ts`.
  RED: 6 fields missing, `all_15 → core_4`, `off → record`, grounding identity
  `f6915b9e → c56d305b` DIVERGED. GREEN: 0 missing, `all_15 → all_15`,
  `off → off`, identity MATCH.
- **Negative leg:** reverting the inheritance spread in `spawn-child-state.ts`
  (source restored immediately) made the promoted probe exit 1 naming
  `enforcementMode, designContract, protocolSource, provenanceMode` — so the
  probe is not vacuous.
- **Receipt:** 6/6 gates LIVE, fingerprint `sha256:c705a855…` — the closure
  re-stamp at the archived path (all content edits landed before it; see the
  Closure section below).

## Gates

```text
typecheck (12 workspaces)                exit 0
bun run test                             exit 0, 0 fail (7545 pass)
agent-runtime package run                1462 pass / 0 fail
eslint --max-warnings 0                  exit 0
lint:md                                  exit 0
prettier --check .                       PASS
quality:report                           PASS (1498 baselined files)
validate:repository                      PASS
fid:verify --check                       PASS
scope-register-check / scope-guard-check  PASS
handoff-transport-check                  PASS (exit 0)
```

## Files

**New:** `spawn-child-state.ts` (createAgentState moved verbatim +
`inheritRunGovernance`), `evidence/spawn-evidence.ts`,
`spawn-inline-only.ts`, `scripts/handoff-transport-check.ts`,
`src/__tests__/spawn-handoff-transport.test.ts`,
`src/evidence/__tests__/spawn-evidence.test.ts`.

**Changed:** `spawn-agent-utils.ts` (snapshot + re-export; 297 → 180 lines),
`execute-subagent.ts` (snapshot type + both validations),
`spawn-agents-child-run.ts` (loader, inline-only rejection, shared verdict
binding; 298 → 286 without breaching the ceiling), `spawn-agent-inline.ts`
(loader + relay), `spawn-agents.ts`, `tool-executor/spawn-validation.ts`,
`subagent-propagation-contract.test.ts`.

## Discipline notes

1. **Ceiling pressure is real in this boundary.** Adding the loader and the
   rejection pushed `spawn-agents-child-run.ts` to 309 lines against the
   300-line ceiling. The fix was the *better* change — routing the batch path's
   hand-rolled ZTAP verdict block through `applyVerdictReceipts`, the authority
   the inline path already used — not a compressed comment.
2. **The probe caught my own false finding.** Its first verdict line counted
   `maxContextLength`/`digestCaps` as missing. Reading `createLoopContext`
   proved they are re-stamped per run, so they are now listed as designed
   absences *with the reason* rather than reported as defects.
3. **Reachability stated, not implied.** The inline and nested paths are fixed
   and pinned, but the shipped harness only inline-spawns the context-pruner
   (which does not declare `requiresRawEvidence`), so those two fixes are live
   for authored/future callers. The FID records exactly that instead of
   claiming production impact.

## Closure

Closed + archived 2026-09-19 on operator directive ("Close and archive
FID-2026-0919-027 and FID-2026-0919-028 with their archive index entries,
leaving the commit to me"). Status `verified` → `closed`; the Resolution was
restructured to the closure format (Closed Date / Fix Description / Tests Added /
Verification Evidence / Archived) and the receipt re-stamped LIVE at the archived
path — 6/6 gates, fingerprint `sha256:c705a855…`, byte-consistent with the final
content. Archive index entry added; `dev/fids/README.md`, `CHANGELOG.md` and
SCOPE Task 77 carry the closure. The mechanism behind the defect was closed by
FID-2026-0919-028 in the same pass. Commit SHA pending operator git execution
(G2 withheld).

## Next steps

1. Operator commit (nothing committed; G2 withheld by the standing "leave the
   commit to me").
3. Follow-up candidates recorded in the FID's Missed Questions: the vestigial
   `AgentState.subagents` field, a `SubagentStop` hook payload with an outcome,
   and a derived required-field list so the *next* added `AgentState` field
   cannot be silently dropped at the spawn boundary.
