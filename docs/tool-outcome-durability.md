# Tool outcome durability

FID-2026-1006-002 WP3 (T149 idea 3). The question this study answers is narrow
and load-bearing: **when is a tool call's outcome known, and what may be
inferred from a partial record of the call?**

## Outcome durability is not entry materialization

These two things are routinely conflated, and the conflation is where lost work
comes from.

| | What it means | Who owns it |
|---|---|---|
| **Entry materialization** | The run's transcript entry for the tool call exists (the call was dispatched, and something — a chunk, a trace event, a ledger row — was written). | The executor's dispatch path. |
| **Outcome durability** | The *model-visible result* of the call exists: the tool result has been emitted and pushed onto the run's result arrays, so a later reader of the run can know what the tool did. | The result lifecycle (`runSuccessLifecycle` / `runRejectionLifecycle`). |

An entry can be materialized while the outcome is still unknown. That is the
normal state of a running tool: the call was recorded at dispatch, the handler
is still in flight, and no outcome exists yet. Treating the entry as proof of
the outcome is how a resumed or repeated run concludes that a tool "already
ran" when it never finished.

## `outcome_ready` staging

The lifecycle therefore records an explicit, two-state model
(`packages/agent-runtime/src/tools/tool-executor/tool-outcome-state.ts`):

- `dispatching` — no recorded outcome. This is also what an unknown tool call
  id reports, because "no record" is the only honest answer; the model never
  throws and never guesses.
- `outcome_ready` — the outcome is materialized. The state is written in
  **both** lifecycle branches, because a rejection is a settled outcome too: the
  call produced an error result the run can act on, and pretending it is still
  pending would invite a second dispatch.

Staging means the state is written at exactly one point per branch — after the
result chunk and result-array pushes on the success path, after the error chunk
on the rejection path — rather than being derived later from a weaker signal.

### Why `outcome_ready` is not redispatchable

`isRedispatchable('outcome_ready') === false`. Dispatching a call whose outcome
is already recorded would execute a tool the run already has an answer for: at
best duplicate work, at worst a second write to a file whose first write was
already committed. Only `dispatching` is redispatchable, and that is precisely
because nothing is known about it yet.

Note the asymmetry this creates, which is deliberate: an unknown id is
`dispatching` and therefore *technically* redispatchable. Nothing in Savant
dispatches a tool call twice (there is no redispatch path, and tool call ids are
unique per call), so the predicate documents the rule for the first consumer
that needs it rather than closing a live hole. What it does close today is the
opposite error: a lifecycle that has settled can never be read as pending.

## Invocation memos

A memo makes a repeated question cheap by returning the first answer. Two
shapes look similar and are not:

- **Memo keyed on the tool call** (its id, or the id plus the input hash) is
  safe: the same call has exactly one outcome by construction, so returning the
  recorded outcome for a repeated read is the truth, and it is what makes
  `outcome_ready` useful — a reader can ask repeatedly without re-running
  anything.
- **Memo keyed on the intent** (a tool name, a path, a command string) is not
  safe: two different calls can express the same intent and legitimately have
  different outcomes (the file changed in between; the command succeeded the
  second time). A memo there converts "this was asked before" into "this
  already succeeded", which is exactly the false completion this work package
  exists to prevent.

## The invariant

> **Auxiliary progress never proves completion.**

Activity indicators, evidence spill, EHEL post-tool tracking, ZTAP write
receipts, lifecycle hooks, credit accounting: every one of these is auxiliary.
They are worth doing, they are not worth concluding from. The only signal that
proves a call completed is its outcome having been materialized onto the run's
result surface — which is why the state is written there and nowhere else, and
why the success path marks the outcome *before* the auxiliary work below it
runs (a failed receipt must not un-settle a result the model can already see).

## Scope

**A persistent staging store is out of scope of this FID.** This work package
adds the state model, the one invariant above, and the writes that make the
state live. Staging outcomes durably across a process restart (a table, a replay
log, recovery on boot) is a follow-on FID if the operator wants it; the in-process
store here dies with the process and is documented as doing so.
