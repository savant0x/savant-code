# Session summary — 2026-09-19 21:55 — FID-2026-0919-029 (boundary observability and enumeration)

**Directives (verbatim):** "Give the SubagentStop hook an outcome payload so
operator hooks can tell a finished child from a failed one" and "Extend the
field-partition gate to SessionState and FileContext so their boundary-critical
fields are enumerated too" — continued under "resume w/ automation level 3".

**Automation level:** 3.

## What was done

Two boundary gaps, both about *what is knowable at a boundary*, both closed by
enumerating the boundary rather than patching an instance of it.

### A — `SubagentStop` outcome payload

`SubagentStart`/`SubagentStop` fired with type, session and cwd only. Three
genuinely different endings — the loop returned usable output, the loop returned
the error form, and the loop threw — produced byte-identical hook payloads. The
fired event is the seam `protocol.config.yaml` automation is meant to act on, so
"finished" and "crashed" being indistinguishable is not cosmetic.

The contract already had the fields (`tool_result`, `error_message` — the same
ones `PostToolUse`/`PostToolUseFailure` use); `executeSubagent`, the single funnel
both spawn paths share, never set them. `hooks/subagent-outcome.ts` now builds the
payload and every terminal branch sets it, including the `catch` (which reports
the cause and still rethrows). The default before any branch is the truthful
"unknown ⇒ failed".

| Outcome | Payload |
|---|---|
| Loop returned output | `status: 'completed'`, `outputType`, `runId`, `creditsUsed` |
| Loop returned `{type:'error'}` | `status: 'failed'`, `errorMessage` = the output's message |
| Loop threw | `status: 'failed'`, `outputType: null`, `errorMessage` = the cause |
| no branch set it | `status: 'failed'`, `error_message: 'Subagent finished without a result'` |

Deliberately **identity and shape, never content**: hook commands receive this as
JSON on stdin, so a child's transcript would be unbounded and a content-leak path.
`SubagentStart` is pinned to stay outcome-free so the pair carries meaning.

### B — `SessionState` / `ProjectFileContext` partitions

FID-2026-0919-028 made `AgentState` self-enforcing at the spawn boundary and
recorded this extension for itself. Both types have a boundary:

| Type | Boundary | Partition |
|---|---|---|
| `SessionState` | snapshot (`cloneSessionState`) | **2 keys** — `mainAgentState` deep-copied, `fileContext` shared by reference (reason: ~230ms per snapshot avoided on the render thread) |
| `ProjectFileContext` | run start (two writer modules) | **16 keys** — 10 refreshed (write-site citations), 6 carried (a reason each) |

`common/src/types/session-boundary-fields.ts` classifies every key once with
`AssertNever` gates for exhaustiveness and disjointness, mirroring FID-028's
pattern. The piece FID-028 could not have: pins driven off the shipped lists, and
a **writer census** over the two modules that actually assign `fileContext.*` —
because a boundary can drift by gaining a writer without gaining a type key.

`gitChanges` is now *declared* as carried: captured at session init
(`sdk/src/run-state/initial-state.ts:121`) and **not** refreshed on resume. That
is a real behaviour with a real consequence; the record removes the "nobody
noticed" state, not the behaviour (changing it would change what the protocol's
grounding evidence means, so it needs its own decision).

## Evidence

**A — negative leg.** Removing the single `toolResult: outcome` argument from the
`SubagentStop` call site flips **3** of 7 pins red (the three boundary pins; the
builder pins correctly stay green because they do not depend on the call site).
Source restored (`grep -c "toolResult: outcome"` → 1).

**B — negative legs, all restored.**

```text
probeUnclassifiedField?: string injected into SessionState
  → common/src/types/session-boundary-fields.ts(155,15): error TS2344:
    Type 'string' does not satisfy the constraint 'never'.
probeUnclassifiedField?: string injected into ProjectFileContext
  → common/src/types/session-boundary-fields.ts(163,15): error TS2344: … 'never'.
fileContext.probeUnclassifiedField = 'x' added to a run-start writer
  → census pin classifies it 'unclassified'
```

**Probe negative legs** (`scripts/handoff-transport-check.ts`, now three
boundaries, 299 lines):

```text
run-start writer added for a carried field (gitChanges)
  → FAIL — gitChanges did not cross its boundary cleanly            (exit 1)
cloneSessionState copies fileContext instead of sharing it
  → FAIL — fileContext did not cross its boundary cleanly           (exit 1)
```

**Corrections found by running things, not by reading:**

1. The first hook pin called `buildSubagentOutcome` directly — it would have
   passed against the *broken* code, because the defect was the call site.
   Rewritten to drive `handleSpawnAgents` and capture the fired payload.
2. The first harness captured **no** hooks at all. A throwaway probe compared
   against the repo's existing spawn tests and found the fixture was wrong (a
   `fileContext` missing the shape `validateAndGetAgentTemplate` requires) rather
   than the assertion being wrong; the pins now use the shared `mockFileContext`.
3. `HookInputData` is exported from `hooks/types.ts`, not `hooks/engine.ts` — an
   import that looked right and only the compiler contradicted.
4. Splitting the runtime pins by *writer* (empty-override
   `applyOverridesToSessionState` for the project-input half, a real
   `resolveSessionState` call for the run-option half) proved all 10 refreshed
   fields without needing a tree-sitter fixture.
5. The extended probe landed at 317 lines, then 307, against the 300-line
   ceiling; reduced to 299 by removing a redundant double-print and inlining a
   formatting helper — not by compressing comments.

## Gates

```text
typecheck (12 workspaces)                 exit 0
bun run test                              exit 0, 0 fail (7567 pass — 15 new pins)
eslint . --max-warnings 0                 exit 0
lint:md                                   exit 0
prettier --check .                        PASS
quality:report                            PASS (1498 baselined files)
validate:repository                       PASS
scope-register-check                      PASS (0 issues)
scope-guard-check                         PASS (0 issues)
fid:verify --check                        PASS
handoff-transport-check (3 boundaries)    exit 0
fid:verify <FID-029> --write              receipt 7/7 LIVE
```

## Closure

Operator directive: "Close and archive FID-2026-0919-029 with its archive index
entry, leaving the commit to me." All content edits (status → `closed`, Resolution
restructured to the closure format) landed *before* the re-stamp, and the
fingerprint was cited in the other records *only after* it was stamped — the
anti-churn order FID-2026-0919-028 established, which is why this closure produced
no stale citation. The record now lives at
`dev/fids/archive/FID-2026-0919-029-boundary-outcome-and-enumeration.md` with its
receipt re-stamped LIVE at the archived path: **7/7 gates**, fingerprint
`sha256:fb6eabb5dbb1a7747702db2953ef2b93c05e26598bb8051d3fbf2d60f806a5e5`
(verified 2026-09-19T21:57:33.375Z). The commit SHA is pending operator git
execution (G2 withheld); the per-file verification was
`sha256:2aaa9de8413081e3aadbd61cfd5be1a1f6c53b2e071a7152717b73cf06734b45`
(2026-09-19T21:53:11.135Z), superseded by the closure edit and cited nowhere as
current.

## Records updated

- `dev/fids/FID-2026-0919-029-boundary-outcome-and-enumeration.md` — new record,
  status `verified`, receipt 7/7 LIVE.
- `SCOPE.md` — new `## Task 79` section with items T79-A…T79-H.
- `CHANGELOG.md` — new 0.0.33 entry at the top.
- `dev/fids/README.md` — the active queue is **one record** again (FID-029); the
  2026-09-19 archived pair is described below it.
- `scripts/handoff-transport-check.ts` — extended from one boundary to three.
- New: `packages/agent-runtime/src/hooks/subagent-outcome.ts`,
  `common/src/types/session-boundary-fields.ts`,
  `packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts`,
  `sdk/src/__tests__/session-boundary-transport.test.ts`.

## Next steps

1. Operator closure + archival of FID-2026-0919-029 (and the commit — G2 is
   withheld, so nothing is committed; 5 new files + 8 modified paths are staged
   in the working tree).
2. Open decision, recorded not silently taken: whether a resumed session should
   refresh `gitChanges` (currently carried by declaration).
3. Unchanged from earlier: the vendor-side B.AI top-up (re-run
   `dev/scratchpad/active/bai-chain-proof.ts` afterwards as the acceptance test).
