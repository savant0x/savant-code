# Session summary — 2026-09-19 22:15 — FID-2026-0919-030 (the hook surface tells the truth)

**Directive (verbatim):** "Audit the other hook events (PreToolUse, SessionStart,
SessionEnd) for the same observability gap SubagentStop had" — continued under
"resume w/ automation level 3", in the same session as the closure of
FID-2026-0919-029.

**Automation level:** 3.

## Part 1 — closure of FID-2026-0919-029 (same session, earlier directive)

Operator directive: "Close and archive FID-2026-0919-029 with its archive index
entry, leaving the commit to me." Content edits (status → `closed`, Resolution
restructured to the closure format) landed **before** the re-stamp, and the
fingerprint was written into the other four records **only after** it was stamped
— the anti-churn order FID-028 established, which is why this closure produced no
stale citation. Record now at
`dev/fids/archive/FID-2026-0919-029-boundary-outcome-and-enumeration.md`, receipt
re-stamped LIVE at the archived path: **7/7 gates**, fingerprint
`sha256:fb6eabb5dbb1a7747702db2953ef2b93c05e26598bb8051d3fbf2d60f806a5e5` (the
verification-time stamp `sha256:2aaa9de8…` is cited nowhere as current).

## Part 2 — the audit

The directive named three events; the honest version of the question is "is
`SubagentStop` the only event whose payload cannot support the decision its name
implies?", so the audit mapped **every** `buildHookInput` call site (9 sites, 7
modules) and asked two questions of each: can a consumer decide what the event
promises, and does the event fire at all?

### A — `PreToolUse` could not identify the acting agent

It is the **only** event that can block a tool, and `docs/design/hook-system.md`
describes it as composing with the EHEL gate — which gates **per agent** (each of
the 10 roster roles has a restricted tool surface). Both sites sent `session_id` +
`cwd` + `tool_name` + `tool_input`. Consequences with evidence:

- "deny `write_file` unless the caller is `forge`" — no field to test.
- Main vs child — unknowable: a subagent's tool call carries the **child's**
  `runId` as `session_id`, so the operator sees an unknown session per child with
  nothing naming it. The child's agent type is exactly what its template resolves
  to (`ctx.params.agentTemplate.id`, already read three lines below in
  `createProvenanceGate`).

Fixed at both sites (`subagent_type`), plus a census pin: every `PreToolUse` site
in the runtime must pass the identity, so a third site cannot be added without it.

### B — `SessionStart`/`SessionEnd` were outcome-blind

`SessionEnd` fires from a `finally` with identity only — the `SubagentStop` defect
one boundary up. The outcome is now computed on every path (return, error-form
return, thrown) and reported; `SessionStart` stays outcome-free. Both lifecycles
now share **one** builder (`hooks/run-outcome.ts`; `subagent-outcome.ts` re-exports
for FID-029's citations) — two implementations of the same boundary binding is how
FID-027's governance leak started.

### C — 5 of 12 declared events never fired, silently

```text
PreToolUse 2 files   PostToolUse 2   PostToolUseFailure 3
SessionStart 1       SessionEnd 1    SubagentStart 1    SubagentStop 1
PreCompact 0         PostCompact 0   Stop 0             Interrupt 0
Notification 0
```

`HOOK_EVENTS` is the parse-time vocabulary, so all five validated and loaded, and
`docs/design/hook-system.md` presented all five as active. A hook declared for one
was **silently inert** — no parse error, no warning. Now the sets are data
(`FIRED_HOOK_EVENTS` / `NEVER_FIRED_HOOK_EVENTS` with a reason each), compile-time
gated for exhaustiveness and disjointness, verified against the runtime source by
`scripts/hook-events-check.ts`, which also fails if this repo's own
`protocol.config.yaml` declares an inert hook. The doc's Events table gained a
**Fires today?** column.

**The blockers are the finding, not a restatement:** `Stop`/`Interrupt` are
documented as the same thing with no boundary between them (and a cancellation is
already actionable — it reports as a FAILED outcome on `SessionEnd`/`SubagentStop`);
`Notification` has no trigger, payload or consumer defined anywhere; the compaction
pair needs an attempt-vs-effect ruling because the pruner can complete having
compacted nothing, and firing "around compaction" without a predicate would emit an
event that lies. Implementing them is the next FID and needs the operator's ruling
— stated as a Missed Question, not left silent.

## Evidence

**Negative legs (all sources restored):**

```text
LEG 1  remove `subagentType` from the native PreToolUse site
       → 3 pins red (main agent, subagent, no-new-bypass census)
LEG 2  remove `toolResult: outcome` from the SessionEnd call site
       → 3 pins red (completed, error-form, thrown)
LEG 3  append a firing site for an inert event (Notification)
       → 2 pins red (census set-equality, inert-has-no-site)
       → hook-events probe FAIL, exit 1 (exit 0 once restored)
```

**Caught by running things, not by reading:**

1. The repo's own hygiene gate flagged the phrase "not implemented" inside the
   inert-event reasons (`hygiene.production-placeholder`) → reworded to "no firing
   site", which is the more accurate statement anyway. The gate caught what I had
   already read past.
2. Generalizing the outcome builder changed the "no result" message, which broke
   **FID-2026-0919-029's pinned contract** — a closed record's evidence must stay
   literally true. Fixed by parameterizing the subject (`'Subagent'`/`'Session'`)
   rather than editing the closed record. Both focused suites were green while the
   full chain was red; only the chain caught it, because the pin lives in another
   file.
3. The first census regex missed the ternary site
   (`event: failed ? 'PostToolUseFailure' : 'PostToolUse'`) and under-reported
   `PostToolUse`; rewritten as a line scan, reporting distinct FILES — a count that
   silently under-reports is the kind of number a reader trusts.
4. The FID's own title tripped `MD013` at 130 chars → split into a heading plus
   subtitle.

## Gates

```text
typecheck (12 workspaces)                 exit 0
bun run test                              exit 0, 0 fail (7577 pass — 10 new pins)
eslint . --max-warnings 0                 exit 0
lint:md                                   exit 0
prettier --check .                        PASS
quality:report                            PASS (1498 baselined files)
validate:repository                       PASS
hygiene:check                             PASS
scope-register-check / scope-guard-check  PASS (0 issues)
fid:verify --check                        PASS
handoff-transport-check (3 boundaries)    exit 0
hook-events-check                         exit 0
fid:verify <FID-030> --write              receipt 5/5 LIVE
```

## Closure

Operator directive: "Close and archive FID-2026-0919-030 with its archive index
entry, leaving the commit to me." Content edits (status → `closed`, Resolution
restructured to the closure format) landed *before* the re-stamp, and the
fingerprint was cited in the other records *only after* it was stamped — the
anti-churn order that made this the second consecutive closure with no stale
citation. The record now lives at
`dev/fids/archive/FID-2026-0919-030-hook-surface-truth.md` with its receipt
re-stamped LIVE at the archived path: **5/5 gates**, fingerprint
`sha256:724b6c62725d0af23b4a64a104782ea81b08db22295ac5368fef888e24339092`
(verified 2026-09-19T22:20:12.450Z). The verification-time stamp
`sha256:29eeeccdb0bb79675941854e227ec1ea70fec1586844e72dc9788744babb9dbb`
(2026-09-19T22:14:56.566Z) is superseded by the closure edit and is cited nowhere
as current. Commit SHA pending operator git execution (G2 withheld).

## Records updated

- `dev/fids/FID-2026-0919-030-hook-surface-truth.md` — new record, `verified`,
  receipt 5/5 LIVE.
- `dev/fids/archive/FID-2026-0919-029-…md` — closed + archived, receipt re-stamped.
- `SCOPE.md` — new `## Task 80` (T80-A…T80-E); Task 79 heading + T79-I closure item.
- `CHANGELOG.md` — two 0.0.33 entries (FID-030 verified; FID-029 closed + archived).
- `dev/fids/README.md` + `dev/fids/archive/README.md` — ledger and archive index.
- `docs/design/hook-system.md` — Events table now states what fires today; the
  payload-field table documents `subagent_type` on tool events and the outcome
  fields on the lifecycle events.
- New: `packages/agent-runtime/src/hooks/run-outcome.ts`,
  `packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts`,
  `scripts/hook-events-check.ts`.

## Next steps

1. Operator closure + archival of FID-2026-0919-030, and the commit (G2 withheld —
   nothing committed; the working tree holds the whole session's changes).
2. The next FID, needing an operator ruling: implement the five inert events (or
   rule them out of the vocabulary) — `Stop` vs `Interrupt`, and the compaction
   predicate.
3. Open decision recorded, not silently taken: whether a resumed session should
   refresh `gitChanges` (currently carried by declaration, FID-029).
4. Unchanged: the vendor-side B.AI top-up (re-run
   `dev/scratchpad/active/bai-chain-proof.ts` afterwards as the acceptance test).
