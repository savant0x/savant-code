# Session summary — 2026-09-20 00:40 — FID-2026-0919-028 (spawn boundary self-enforcing)

**Directive (verbatim):** "go ahead and do the follow up about the type error
while its the topic."

**Automation level:** 3.

## What was done

FID-2026-0919-027 fixed the four governance fields the spawn boundary was
dropping, and recorded the mechanism it left behind: `createAgentState` inherited
a hand-written field list, so the **next** `AgentState` field would go missing the
same way — silently, until an audit found it. This session closed that.

`packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts` classifies
every key of `AgentState` exactly once:

| Class | Count | Meaning |
|---|---|---|
| `INHERITED_FROM_PARENT` | 13 | governance config, protocol contract, FSM position, per-run instances (shared by reference) |
| `CHILD_OWN` | 14 | built by `createAgentState` itself |
| `NOT_INHERITED_BY_DESIGN` | 27 | deliberately absent — **each with the reason it is safe** |

`createAgentState` no longer copies the inherited fields by hand: it spreads
`inheritFromParent()`, so the classification list *is* the construction behavior.
Four `AssertNever` gates make the partition exhaustive, disjoint, and
governance-complete at compile time.

## Evidence

**Negative leg (the gate is real).** Injecting `probeUnclassifiedField?: string`
into `AgentState`, then `tsc --noEmit` in `packages/agent-runtime`:

```text
src/tools/handlers/tool/spawn-child-fields.ts(195,3):
  error TS2344: Type 'string' does not satisfy the constraint 'never'.
```

Source restored immediately (`grep -c probeUnclassifiedField` → 0).

**Measured, not assumed.** Two temporary probes settled a confusing diagnostic:
`string extends keyof AgentState` → **false** (no index signature), and
`UnclassifiedAgentStateFields` post-injection → **'probeUnclassifiedField'**. So
the alias resolves correctly and TS is only *rendering* the deferred
`Exclude<keyof AgentState, …>` as `string`. The module documents that limitation
and points at the exported alias as the readable entry point instead of claiming a
message it does not produce.

**Positive leg.** `handoff-transport-check` probe green reading the authority's
own lists (13 inherited crossed, 27 by-design did not leak, 0 unclassified
answers). 7 new pins / 114 expectations in `spawn-child-fields.test.ts`.

## Gates

```text
typecheck packages/agent-runtime          exit 0
typecheck (12 workspaces)                 exit 0
bun run test                              exit 0, 0 fail (7552 pass)
eslint --max-warnings 0                   exit 0
lint:md                                   exit 0
prettier --check .                        PASS
quality:report                            PASS (1498 baselined files)
validate:repository                       PASS
fid:verify --check                        PASS
handoff-transport-check probe             PASS (exit 0)
```

Receipt: 6/6 LIVE, fingerprint `sha256:d85e2256…` — the closure re-stamp at the
archived path (all content edits landed before it; see the Closure section
below).

## Files

**New:** `spawn-child-fields.ts`, `src/__tests__/spawn-child-fields.test.ts`.

**Changed:** `spawn-child-state.ts` (inherits via the picker; governance surface
re-exported so FID-027's citations stay true), `scripts/handoff-transport-check.ts`
(sources the authority's lists), plus the records (SCOPE Task 78, CHANGELOG,
`dev/fids/README.md`, this summary).

## Discipline notes

1. **Re-measuring beat guessing.** The gate's first form produced a diagnostic
   that said `Type 'string'`; rather than accept or "fix" it by trial, two probes
   resolved what the types actually were, and the outcome is documented as a
   limitation. Shipping a comment claiming the error names the field would have
   been a false claim in the very artifact meant to prevent false confidence.
2. **Two type-design mistakes were caught by the compiler, not by review:** a
   `Pick` of optional source fields silently made the snapshot's governance keys
   optional (fixed with a `-?` mapped type), and a generic `AssertDisjoint<A, B>`
   failed at its own declaration (each gate is now written at its instantiation).
3. **The probe would have drifted within one edit** — it carried its own copies
   of the two lists. It now reads the authority and fails on an `unclassified`
   answer, which is the only version of that check worth having.

## Closure

Closed + archived 2026-09-19 on operator directive ("Close and archive
FID-2026-0919-027 and FID-2026-0919-028 with their archive index entries,
leaving the commit to me"), in the same pass as FID-2026-0919-027. Status
`verified` → `closed`; Resolution restructured to the closure format and the
receipt re-stamped LIVE at the archived path — 6/6 gates, fingerprint
`sha256:d85e2256…`, byte-consistent with the final content. Archive index entry
added; `dev/fids/README.md`, `CHANGELOG.md` and SCOPE Task 78 carry the closure.
The active FID queue is empty again. Commit SHA pending operator git execution
(G2 withheld).

## Next steps

1. Operator commit (nothing committed; G2 withheld).
2. Remaining recorded follow-up candidates (FID-2026-0919-027's and -028's Missed
   Questions): the vestigial `AgentState.subagents` field, a `SubagentStop` hook
   payload carrying an outcome, and extending the field partition to
   `SessionState`/`FileContext`.
