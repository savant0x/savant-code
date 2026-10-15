# FID: Every discarded payload needs a durable record and a locator it can prove — no silent tool-output loss

**Filename:** `FID-2026-1007-004-lossless-tool-output-retention-and-verified-locators.md`
**ID:** FID-2026-1007-004
**Severity:** high
**Status:** closed
**Created:** 2026-10-07 16:05
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Savant discards model-facing payloads in five places and, in every one of them,
tells the model that the bytes are available somewhere it cannot reach. The
sentinel case is `truncateToolOutputValue`, whose marker carries
`fullOutput: '[See cache-debug snapshot / rerun the tool for full output]'` — a
fixed string naming two *possibilities*, neither of them a location, while the
cache-debug feature it names is disabled by default. The other four
(`simplifyVerboseToolResults`, `simplifyReadFileResults`,
`simplifyTerminalCommandResults`, and the trim pass in
`trimMessagesToFitTokenLimit`) are worse in kind: the first three drop the payload
with no locator at all (`contentOmittedForLength: true`, `stdoutOmittedForLength:
true`), and the trim pass deletes **whole messages** — tool results and conversation
turns alike — collapsing each run ofdeletions into a single `Previous message(s) omitted due to length` placeholder, with
**no inventory row and no list of what it took**. Reach matters here and was measured
rather than assumed: `getMessagesSubset` — the trim pass's only production caller — is
called from `find-files/request-files-prompt.ts:196` and `:269`, so this loss is
confined to the find-files request path, not the main loop. Its *mechanism* is the
worst of the five; its *blast radius* is the narrowest.

The repository already owns the store that could answer all four: the evidence spill
at `.savant/evidence/<runId>.jsonl`, written at the tool-result boundary before any
compaction layer runs. But it is unreachable from every one of those markers, its
read side is gated behind `requiresRawEvidence` (Verifier and Adversary only), its
splice only fires on a `[compacted]` sentinel that the trim pass never produces, it
silently refuses past two ceilings (512 KiB per record, 8 MiB per file), and it
persists raw tool output **unredacted**. So "the full output is retained" is true in
the narrowest possible sense and false in every sense a reader would mean.

This record is the design for a single retention contract:
**no path may discard bytes it has not durably stored, and no marker may claim a
location it cannot compute.** When retention fails, the payload is not dropped.
**Steps 1-2 of 7 landed 2026-10-07** (`e9322b38`): the retention seam returns a
handle or a named refusal, and its verdict travels from the tool-result boundary to
the synchronous transforms. **That was infrastructure, not repair** — nothing consumed
the verdict, so no discard behaviour had changed and the marker still lied. **Steps 3-7
landed the same day**, in the implementation commit named under `### Implementation
Evidence`: the four transforms now refuse to drop a payload they cannot prove was
stored, one `omitted` marker replaces the three spellings and names the handle that
authorises the drop, the trim pass writes the ledger row the other layers write, the
store resolves for whoever holds the handle, credentials are redacted before they
reach disk, and the shard ceilings are reported instead of swallowed.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint (repo-pinned), prettier (repo-pinned)
- **Commit/State:** HEAD `2e31aea9`; working tree clean apart from three parked
  untracked inputs this record does not touch
- **Measured with:** `dev/scratchpad/active/step3-truncation-audit.ts` (gitignored
  probe; drove the SHIPPED functions, not a mirror) plus the reads cited below

## Detailed Description

### Problem

**(1) Four of five destructive paths name no location at all.** Measured on the
shipped functions:

| path | input | what the model receives | locator |
| --- | --- | --- | --- |
| `truncateToolOutputValue` (string) | 60,000 chars | 500-char quoted preview, `omittedChars: 59500` | `fullOutput` — a fixed placeholder string |
| `truncateToolOutputValue` (array) | 3,000 items | `keptItems: 2,000`, 27,000 chars omitted | none |
| `simplifyReadFileResults` | a 40,000-char file | `{ path, contentOmittedForLength: true }` | none — every byte gone |
| `simplifyTerminalCommandResults` | a large stdout | `stdoutOmittedForLength: true` | none — the oldest five are kept whole, the rest lose stdout/stderr |
| `trimMessagesToFitTokenLimit` | an over-budget history | whole messages replaced by ONE `replacementMessage` | none — and no inventory row |

**(2) The trim pass deletes the most per event and is the only destructive path with
no ledger entry — but its reach is narrow, and this record corrects its own first
draft on that point.** `appendCompactionInventory` is called from
`context-tokens-compaction.ts`, `loop/reactive-compact.ts` and
`spawn-agent-inline-pruner-outcome.ts`. It is **not** called from
`util/messages/trimming.ts`, so the one path that deletes whole conversation turns
writes nothing anywhere about what it deleted. Layers 2, 3 and 4 all write rows
(`layer: 'micro' | 'auto' | 'reactive'`, `removedMessages`, `tokensSaved`, half-open
`regions`, and bounded `items` with `toolCallId`/`byteSize`); the trim pass writes
none, because it predates the inventory and was never revisited.

**Correction, made in this record's own AUDIT phase.** The first draft of this
section called the trim pass "the largest loss" without having measured how far it
reaches — it was enumerated from the module instead of from the call graph. Measured:
`getMessagesSubset` has exactly one production caller
(`find-files/request-files-prompt.ts`, at `:196` and `:269`), and
`trimMessagesToFitTokenLimit` is called only by `getMessagesSubset` and three test
files. So the trim pass runs on the **find-files request path**, not on the main loop
and not in the compactor. The defect is real and the missing ledger is real; the
reach is narrower than claimed, and the claim is corrected here rather than left to
inflate the severity.

**(3) The store that could answer all of it is unreachable, gated, ceilinged and
unredacted.**

- **Unreachable:** no marker carries the `toolCallId` the store is keyed by. The
  truncation functions receive only the VALUE; the identity exists one frame up on
  the message (`ToolMessage.toolCallId`, `savant-code-message.ts:49`).
- **Gated on the read side:** `loadRawEvidenceForSpawn` returns `undefined`
  immediately unless `agentTemplate.requiresRawEvidence === true`
  (`evidence/spawn-evidence.ts:39`), and only `agents/verifier/verifier.ts:29` and
  `agents/adversary/adversary.ts:40` set it. The main loop — the agent that
  actually wants its own truncated grep back — cannot read the store.
- **Splice shape mismatch:** `spliceRawEvidence` only restores a message whose
  content is a `[compacted]` sentinel (`evidence/splice.ts:14-25`). The trim pass
  never writes that sentinel; it replaces the whole message.
- **Ceilinged, silently:** `recordEvidence` returns `false` with no report when
  `projectRoot` is empty (`spill.ts:69`), when the record exceeds 512 KiB
  (`spill.ts:70`), or when the file exceeds 8 MiB (`spill.ts:74`); the only caller
  discards that boolean — `void recordEvidence({...})`
  (`tools/tool-executor/result-lifecycle.ts:74`). A full store is indistinguishable
  from a working one.
- **Unredacted:** the record persists `raw: JSON.stringify(output)` verbatim
  (`spill.ts:86`) with no redaction pass, while the repository already owns a
  redactor (`redactSecrets`, `semantic-summary-upgrade.ts:47`) used for stored
  summaries. The directory is gitignored (`.gitignore:88` → `.savant/`), which
  bounds the blast radius but does not make it a non-surface.

**(4) The object branch's marker is truthful about its input and contradictory as a
pair.** A 60,026-char object returned 60,727 chars with `reason: 'output exceeded
50000 bytes'` alongside `omittedChars: 0`, because that branch deliberately keeps
every field. It is recorded here, not changed: the behaviour is pinned by an existing
test ("The original object keys are preserved alongside the marker").

### Expected Behavior

One contract, applied to every path that replaces or deletes model-facing bytes:

1. **Retain before drop.** A transform may discard a payload only after the original
   is durably stored, and only on the strength of a handle it received back — not a
   hope about a sibling write.
2. **Never claim a location that cannot be computed.** A marker carries a locator
   only when one exists; otherwise it says explicitly that the bytes were not
   retained, and why.
3. **A refusal is not a loss.** If storage fails (no project root, record too large,
   store full, IO error), the transform **keeps the payload in context** and the
   marker records the refusal reason. Token pressure is a cost; silent loss is a
   defect.
4. **Every deletion is ledgered.** The trim pass writes the same inventory row the
   compaction layers write, naming the dropped `toolCallId`s and byte sizes.
5. **Retrieval is for the agent that needs it**, not for two audit roles: the handle
   a marker carries must be resolvable from the tool-output path.

### Root Cause

- **The truncation pre-pass was designed as a token-budget device, not as a
  retention contract.** Its comment says the marker names a location that "retains
  the pre-truncation value on disk" — that is true only when cache-debug is enabled,
  and cache-debug is a debugging feature, not a store. The retention half was
  written as a pointer string before any store existed to point at.
- **Two stores grew independently, so no seam enforces the contract.** The spill
  (tool results, at the boundary) and the compaction inventory (compaction events)
  each own half of "what did we take"; neither owns "was it stored first". Each
  dropping path therefore invents its own honesty level, which is why there are
  three spellings of the same omission.
- **`fail-open` is right for capture and wrong for replacement.** The spill's
  contract — "a spill failure must never affect tool execution" — was written when
  nothing depended on the spill. The moment a drop depends on a successful store,
  fail-open becomes fail-silent, and the unbounded `void` at the call site hides it.
- **The read gates were scoped by role, not by need.** `requiresRawEvidence` exists
  so a verifier's transcript can be reconstructed; it was never meant to define who
  may recover their own truncated output, but it is the only switch there is.

### Evidence

The placeholder string, verbatim from the shipped module:

```text
packages/agent-runtime/src/util/simplify-tool-results.ts:119
      fullOutput: '[See cache-debug snapshot / rerun the tool for full output]',
```

The two other vocabularies, in the same module:

```text
util/simplify-tool-results.ts:143  export function simplifyReadFileResults(
util/simplify-tool-results.ts:159  export function simplifyTerminalCommandResults(params: {
util/simplify-tool-results.ts:177          stdoutOmittedForLength: true,
```

The trim pass replacing whole messages, and the sentinel the splice expects instead:

```text
util/messages/trimming.ts:58   const replacementMessage = userMessage(
util/messages/trimming.ts:147  const placeholder = 'deleted'
evidence/splice.ts:14          function isCompactedSentinel(content: unknown): boolean {
evidence/splice.ts:17            if (p.value === '[compacted]') return true
```

The store's silent refusals and the caller that discards the verdict:

```text
evidence/spill.ts:69   if (!params.projectRoot) return false
evidence/spill.ts:70   if (params.raw.length > EVIDENCE_MAX_RECORD_BYTES) return false
evidence/spill.ts:74     if (st.size > EVIDENCE_MAX_FILE_BYTES) return false
tools/tool-executor/result-lifecycle.ts:74  void recordEvidence({
```

The read gate, and the two agents that pass it:

```text
evidence/spawn-evidence.ts:39  if (params.agentTemplate.requiresRawEvidence !== true) return undefined
agents/verifier/verifier.ts:29       requiresRawEvidence: true,
agents/adversary/adversary.ts:40     requiresRawEvidence: true,
```

The inventory callers — note the absent fourth:

```text
run-agent-step/context-tokens-compaction.ts   ← appendCompactionInventory
run-agent-step/loop/reactive-compact.ts      ← appendCompactionInventory
tools/handlers/tool/spawn-agent-inline-pruner-outcome.ts ← appendCompactionInventory
util/messages/trimming.ts                    ← (none)
```

Measured, through the production code path, on the unmodified tree:

```text
[string]   input 60,000 chars → keptChars 502, omittedChars 59,500, locator = placeholder
[array]    input 3,000 items  → keptItems 2,000, omittedChars 27,000, no locator
[object]   input 60,026 chars → returned 60,727 chars, keptChars 60,026, omittedChars 0
[terminal] input 60,000-char stdout → stdoutOmittedForLength: true, no locator
[read]     input 40,000-char content → { path, contentOmittedForLength: true }
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/util/simplify-tool-results.ts` (all four transforms)
- `packages/agent-runtime/src/util/messages/trimming.ts` (the trim pass + drop loop)
- `packages/agent-runtime/src/evidence/spill.ts` (caps, refusals, redaction)
- `packages/agent-runtime/src/evidence/inventory.ts` (the ledger the trim pass never writes)
- `packages/agent-runtime/src/evidence/spawn-evidence.ts` (the read gate)
- `packages/agent-runtime/src/evidence/splice.ts` (the sentinel-shaped restore)
- `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts` (the `void` call site)
- `packages/agent-runtime/src/context-compactor/*` (the layers that already ledger)
- any consumer that reads `truncated` / `contentOmittedForLength` /
  `stdoutOmittedForLength` (measured: none reads `fullOutput`)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

**Why high, and why not critical.** The loss is silent, affects the agent's own
evidence, and the recovery route the marker advertises does not exist — so a wrong
conclusion drawn from a truncated view is unattributable after the fact. It is not
critical because the spill does hold raw tool results today (the truth is
unreachable, not absent), and because a `[REDACTED]`-free store in a gitignored
directory is a bounded exposure rather than an active breach.

## Proposed Solution

### Approach

Introduce the missing seam instead of patching four call sites: **one retention
function on the store that already exists**, whose handle is the only thing that
authorises a drop. This is deliberately not a second spill mechanism — it is the
existing `.savant/evidence/` line, given a return value, a refusal vocabulary, and a
policy about who may read it.

The load-bearing decision is **where** retention runs. Truncation is synchronous and
sits inside `trimMessagesToFitTokenLimit` / `convertCbToModelMessages` chains, so
making the transforms async would be a large blast radius for a correctness fix. But
the tool-result boundary is **already async** and runs **before** any compaction
layer can see the result. So retention happens there, its verified outcome travels on
the tool message, and every sync transform downstream reads that field:

- retained with a handle → the transform may drop, and the marker carries
  `{ file, toolCallId, sha256, bytes }`;
- retention refused (typed reason) → the transform **must not drop**, and the marker
  states the reason;
- no retention field at all (a message from a path with no boundary, e.g. a
  hand-built fixture) → treated as "cannot prove", so it does not drop.

The second load-bearing decision is the **cap policy**. Today the store silently
refuses past 512 KiB/record and 8 MiB/file. Under this contract a refusal means the
payload stays in context — which is the correct trade (a bigger prompt, not a lost
finding) but it means the ceilings need a real answer rather than a shrug: a
rotation or per-record spill shard so that a long run does not hit a wall, and, if a
wall is still hit, one loud, ledgered, model-visible refusal instead of a `false`
nobody reads.

### Steps

1. **DONE (2026-10-07, commit `e9322b38`).** Add the retention seam to the existing
   store. `retainOriginal({ projectRoot,
   runId, agentId, toolCallId, toolName, raw })` returns a discriminated result:
   `{ retained: true, handle: { file, toolCallId, sha256, bytes } }` or
   `{ retained: false, reason: 'no-project-root' | 'no-tool-call-id' |
   'record-too-large' | 'store-full' | 'io-error' }`. It reuses `evidenceFilePath`,
   `sha256Hex` and the append-only JSONL format, so the spill's existing readers keep
   working, and `recordEvidence` is now the boolean view over it (Law 13) rather than
   a second implementation.
2. **DONE (2026-10-07, commit `e9322b38`) — via the record's own stated fallback.**
   The boundary calls the seam and stores the verdict in an in-process registry keyed
   by `toolCallId` (`evidence/retention-registry.ts`), rather than adding a field to
   the tool message. The fallback was chosen over the primary because the primary
   would put a non-schema field on a message that travels to the provider, while the
   registry is sufficient for the stated reason (one process, ordered) and carries
   verdicts instead of payloads. Two consequences are recorded: the reset is wired
   into the workspace preload as FID-2026-1007-002's audit requires, and a resumed
   run that never hit the boundary has no handle — which reads as "cannot prove" and
   therefore keeps the payload.
3. **DONE (2026-10-07).** The four transforms refuse to drop what was not retained.
   One shared marker shape replaces the three spellings:
   `omitted: { reason, originalChars, keptChars, omittedChars, preview,
   retained: { file, toolCallId, sha256, bytes } | { ok: false, why } }`, implemented
   as `OmissionRetention` in `util/simplify-tool-results.ts` with `ok: true` added to
   the retained branch so the union discriminates. `fullOutput` is deleted (measured:
   no consumer reads it). **One correction, made against this record's own plan:** the
   plan said one marker replaces all three spellings, but two of the three booleans
   are load-bearing — `contentOmittedForLength` and `stdoutOmittedForLength` are
   members of the `read_files` and `run_terminal_command` output zod unions, and
   `util/messages/history.ts` type-guards on the first. They stay as the boolean VIEW
   of the marker (Law 13: one truth, two shapes); deleting them would have widened a
   correctness fix into the tool-output schemas. A third decision is stated in the
   module contract: the OBJECT branch attaches its marker without a handle, because it
   preserves every field — attaching a marker there discards nothing — while every
   branch that REPLACES bytes with a marker requires the handle.
4. **DONE (2026-10-07).** `trimMessagesToFitTokenLimit` writes one
   `appendCompactionInventory` row (`layer: 'trim'`, added to `CompactionLayer`)
   naming the dropped `toolCallId`s and byte sizes, via the `diffRemovedSpans` helper
   the other layers already use. The diff is taken over the SIMPLIFIED pre-drop array,
   not over the caller's original history: this pass also REPLACES messages (the
   verbose/terminal pre-pass builds new message objects), so a reference-identity diff
   against the original array would have counted every replaced-but-kept message as
   removed. The simplified array is index-aligned with the caller's, so the recorded
   `regions` are still coordinates of the history the caller handed in. The run
   context is threaded from the find-files handler through `requestRelevantFiles` →
   `getRelevantFiles` → `getMessagesSubset`, and the wiring (not merely the unit) is
   pinned from the real entry point.
5. **DONE (2026-10-07).** Three parts, each pinned. `resolveRetainedPayload(handle)`
   in `evidence/spill.ts` resolves a handle with NO role gate, fail-closed: bytes that
   no longer match the handle's `sha256` are not returned at all. The
   `loadRawEvidenceForSpawn` gate is now scoped by NEED rather than role — an audit
   role keeps the full union of the run chain (the bulk splice, unchanged), while any
   other agent gets exactly the records its own inherited history names as omitted,
   and an agent with nothing omitted still does no IO. And `spliceRawEvidence`
   recognises the `omitted` marker, not only the `[compacted]` sentinel, so a stored
   original can be restored over the marker that took its place. **Boundary, stated
   rather than implied:** the root agent inside its own turn still has no first-class
   retrieval call — the marker names an absolute `file` and the `toolCallId`, and step
   3 guarantees the alternative to a locator is keeping the bytes, so nothing is lost;
   a dedicated model-facing retrieval tool is a separate surface and is not in this
   record.
6. **DONE (2026-10-07) — the decision is: redact before writing.** `redactSecrets` was
   promoted to the canonical utility tier (`common/src/util/redact.ts`, Law 13) and the
   spill applies it inside `retainOriginal` before hashing or appending, so the STORED
   form is the redacted form and `sha256`/`byteSize` describe what is on disk — a handle
   always verifies against it. The record and the handle carry `redacted: true` when it
   changed anything, and the module contract states the consequence: a payload whose
   secret was redacted is not recoverable in its original form BY DESIGN. The
   alternative — keep the store unredacted and declare it — was rejected: this is the
   widest persistence surface a run has, and `.savant/` being gitignored bounds the
   exposure without removing it. Note the direction of the trade: redaction removes
   bytes from the STORE, never from the model's context, so it cannot re-introduce the
   loss this record exists to stop.
7. **DONE (2026-10-07).** The store rotates: a shard at `EVIDENCE_MAX_FILE_BYTES` is
   closed and the next record opens `<runId>.part-N.jsonl`, with shard 1 keeping the
   canonical name so every existing reader is untouched, and
   `EVIDENCE_MAX_SHARDS = 64` making `store-full` a stated ceiling (512 MiB per run)
   rather than the ordinary outcome of a long run. The ceilings are overridable per
   call (`maxRecordBytes`/`maxShardBytes`/`maxShards`), which is also what finally made
   `store-full` pinnable — the record previously listed it as the one refusal with no
   pin "because producing it honestly needs an 8 MiB fixture". Reporting is at the
   boundary: a refusal that means a CEILING was hit (`record-too-large`, `store-full`,
   `io-error`) now logs, where the boundary used to discard the verdict outright; the
   structural refusals (`no-project-root`, `no-tool-call-id`) stay silent, so a rootless
   run does not warn on every tool result.

### Verification

The contract is testable as one property, and that is how it will be pinned:

> For every payload the transforms would discard: **either** the original bytes are
> recoverable from the handle the marker carries, **or** the payload was not
> discarded and the marker names the refusal.

Planned coverage, per path, RED first (the current tree must fail these before any
edit):

- a payload that is retained and dropped — handle resolves, round-trip bytes match
  `sha256`;
- a payload whose retention is refused (no project root; over the record cap; a full
  store) — payload still present in the message, marker names the reason;
- the trim pass — a dropped tool result's `toolCallId` appears in the inventory row;
- the object branch — the marker no longer reports a byte-cap truncation when
  `omittedChars` is 0;
- a negative leg proving the store is still doing its original job: an audit-role
  spawn still splices pre-compaction originals over `[compacted]` sentinels.

Scope of the declared gates: eleven, one per behaviour that would go red if the
contract regressed, chosen for what they would CATCH rather than for what they prove.
`retention.test.ts` and `retention-hardening.test.ts` are the seam (a handle or a named
refusal; redaction, rotation, and the now-pinned `store-full`), and
`simplify-tool-results-omission.test.ts` drives the four SHIPPED transforms through
both legs of the property, the first leg resolving a real handle out of a real store.
`messages-trim-inventory.test.ts` proves the trim ledger at the unit, and
`request-files-prompt.test.ts` proves it again from the REAL find-files entry point —
because this repository's own lesson (FID-2026-1006-003) is that a wired module whose
wiring is only typechecked is not wired. `spawn-evidence.test.ts` and
`evidence-splice.test.ts` are the step-5 pair, and the latter still carries the
negative leg that the store does its ORIGINAL job: an audit-role spawn still splices
pre-compaction originals over `[compacted]` sentinels. `messages-trim.test.ts` is the
suite that was passing because of the defect (see Loop 3). `module-state-check` is
FID-2026-1007-002's audit — it confirms the registry this work drives is enumerated and
wired rather than merely claimed. `typecheck` and `quality` are the two repo-wide gates
the change could plausibly break.

## Verification Gates

- gate: test packages/agent-runtime/src/evidence/__tests__/retention.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/retention-hardening.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/simplify-tool-results-omission.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/messages-trim-inventory.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/messages-trim.test.ts
- gate: test packages/agent-runtime/src/find-files/__tests__/request-files-prompt.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/evidence-splice.test.ts
- gate: probe scripts/module-state-check.ts
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:f28729c2885c8320eaf9b912c2b737a8be013168f7a5690a70bba91e7e3aebcb
- verified: 2026-10-07T19:29:45.892Z
- test packages/agent-runtime/src/evidence/__tests__/retention.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/retention-hardening.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/simplify-tool-results-omission.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/messages-trim-inventory.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/messages-trim.test.ts: exit 0
- test packages/agent-runtime/src/find-files/__tests__/request-files-prompt.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/evidence-splice.test.ts: exit 0
- probe scripts/module-state-check.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED (enumerated, not inferred):** every model-facing path that replaces or
  deletes bytes was listed from the tree rather than from the bug report, and each
  was driven through the SHIPPED functions with
  `dev/scratchpad/active/step3-truncation-audit.ts`: five payload shapes across five
  paths. The enumeration found two things the report did not: the trim pass deletes
  whole messages and writes **no** inventory row (the only destructive path with no
  ledger entry, and the largest loss of the five), and the read side of the one store
  that could answer all of it is gated behind `requiresRawEvidence`, so the main loop
  cannot recover its own output even when it IS stored.
- **GREEN:** one retention seam on the existing store with a handle-or-refusal
  result; retention decided at the already-async tool-result boundary and carried to
  the sync transforms; one marker shape; the trim pass ledgered; the store readable
  by the owning agent; the ceilings reported and sharded; the Law 12 decision stated
  and pinned.
- **AUDIT:** every claim above cites `path:line` and was read in this pass, and the
  measured numbers come from the shipped modules rather than from a re-reading. The
  absence claims are stated as absence-of-evidence with the exact search: no
  consumer reads `fullOutput` (a repo-wide grep returns the definition alone), and
  `appendCompactionInventory` has exactly three callers, none of them the trim pass.
  This phase also **caught the record's own error**: the trim pass was described as
  "the largest loss" from the module's contents without a call-graph check, and the
  measurement (`getMessagesSubset` → `find-files/request-files-prompt.ts:196`, `:269`)
  narrows it to the find-files request path. The text was corrected rather than the
  claim defended, and the corrected reach is what the GREEN steps are scoped to.
- **ADVERSARIAL:** the strongest objection is that this converts a bounded token
  risk into an unbounded one — "do not drop what you could not store" means a run
  with no project root and a 400 KiB tool result keeps 400 KiB in context. That is
  the intended trade and it is bounded on purpose: the refusal is reported, the
  ceilings are sharded so the common case does not hit them, and the alternative
  (drop silently) is the defect being fixed. It is named here so the review argues
  with the trade rather than discovering it.
- **CHANGE DELTA:** new document (n/a).

### Missed Questions

1. **Is this a second spill mechanism?** No, and the distinction is load-bearing.
   FID-2026-1006-005 step 3 forbade *adding* a second store; this record adds no
   store. It gives the existing one a return value, a refusal vocabulary and a
   reader, which is the opposite of duplicating it.
2. **Why not just make the transforms async and await the store inline?** Because
   they sit inside synchronous message-assembly chains
   (`trimMessagesToFitTokenLimit` → `getMessagesSubset` → the provider conversion) and
   the async boundary already exists one layer up, ordered BEFORE them. Threading
   identity through a sync chain is the smaller, more reviewable change.
3. **What if the retention field cannot travel on the tool message?** Then an
   in-process registry keyed by `toolCallId` — sufficient because the boundary and
   the consuming transforms run in one process, in order. Step 2 states this as the
   fallback rather than discovering it at implementation time.
4. **Does the store keep growing forever?** Today it stops at 8 MiB and goes silent;
   after this record it shards or rotates, and if it still refuses, that refusal is
   visible. "Grows" is strictly better than "lies".
5. **Is the store a credential surface?** Yes — it persists raw tool output, which
   can contain anything a tool printed, and it currently redacts nothing. `.savant/`
   is gitignored (`.gitignore:88`), which bounds the exposure but does not remove it.
   Step 6 makes this a decision with a pin instead of an unexamined default.
6. **Does the ledger need the payload or just the identity?** Identity: `toolCallId`,
   `toolName`, `byteSize`. The inventory's existing `items` cap (`MAX_INVENTORY_ITEMS
   = 64`) already encodes the intent — a bounded ledger, with the payload living in
   the store keyed by the id.
7. **What about payloads that never had a tool boundary?** They cannot be retained by
   this seam, so they are not dropped. That is the conservative direction and it is
   the reason the contract is phrased as "refuse to drop" rather than "must retain".
8. **How far does each destructive path actually reach?** Measured, because the first
   draft did not ask and paid for it: the four `simplify-tool-results.ts` transforms
   are called from `util/messages/trimming.ts` (`simplifyTerminalCommandResults` at
   `:40`, `simplifyVerboseToolResults` at `:107`), which is reached only from the
   find-files request path — the same narrow surface as the trim pass itself. So none
   of the five paths is on the main loop's hot path today. The severity rests on the
   fact that a wrong conclusion drawn from a silently truncated view is
   unattributable afterwards, not on how often the truncation fires in a session.
9. **Why is the object branch left alone?** Because its field-preserving behaviour is
   pinned by an existing test, and an audit step is not the place to overturn a pin.
   What this record fixes there is only the marker's honesty: no byte-cap reason
   alongside `omittedChars: 0`.

### Implementation Evidence (REQUIRED for `closed`)

> COMPLETE. All seven steps are implemented and gated; the SHAs below are the
> steps 1-2 seam and the commit that consumes it.

- [x] **Commit SHA:** `49c7bab4` (the ceiling splits the quality gate required — the
      tree the stamped receipt was taken against) and `eb2ee0f3` (steps 3-7), on top
      of `e9322b38` (steps 1-2)
- [x] **File:line ranges:** `evidence/spill.ts` (`retainOriginal` with the redaction
      and shard policy), `evidence/spill-contract.ts` (the record shape, the caps,
      the shard paths, `RetentionHandle` / `RetentionRefusal`), `evidence/spill-read.ts`
      (`loadEvidenceRecords`, `resolveRetainedPayload`), `evidence/omission.ts` (the
      shared marker readers), `evidence/retention-registry.ts` (`rememberRetention` /
      `lookupRetention` / `resetRetentionRegistry`), `evidence/splice.ts`
      (`isRestorableLoss`), `evidence/spawn-evidence.ts` (the need-based gate),
      `evidence/inventory.ts` (`CompactionLayer`, `InventoryContext`),
      `util/omission-marker.ts` (`OmissionMarker`, `retentionProof`),
      `util/simplify-tool-results.ts` (the four transforms),
      `util/messages/trimming.ts` (`ledgerTrimPass`),
      `tools/tool-executor/evidence-capture.ts` (the boundary's capture and the
      ceiling report), `tools/tool-executor/result-lifecycle.ts` (the call site),
      `find-files/request-files-prompt.ts` (`evidenceContext`),
      `find-files/request-files-training.ts` (the training picker),
      `tools/handlers/tool/find-files.ts` (the wiring), `common/util/redact.ts` (the
      canonical redactor), `test/setup-test-isolation.ts` (the reset wiring)
- [x] **Gate output:** all eleven declared gates exit 0 at the stamped receipt
- [x] **Reproducibility:** `bun test src/util/__tests__/simplify-tool-results-omission.test.ts`
      fails on the parent of the implementation commit and passes on it;
      `bun scripts/module-state-check.ts` names the registry (183 of 188 wired); the
      original RED measurement is reproducible via
      `bun run dev/scratchpad/active/step3-truncation-audit.ts`
- [x] **Step statuses:** steps 1-2 `implemented`/verified (`e9322b38`); **steps 3, 4,
      5, 6 and 7 `implemented`/verified** (`eb2ee0f3`)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified by read in this pass)
- [x] Implementation matches the Proposed Solution, with two deviations stated against
      it rather than silently taken: the `ok: true` discriminant on the marker's
      retained branch, and the two schema-bound booleans that stay as the marker's
      boolean view (both in `### Steps` step 3 and Loop 3's AUDIT)
- [x] Typecheck/tests/lint pass, with the counts and exit codes pasted in Loop 3 and
      in the Resolution's Verification Evidence
- [x] Production call-graph evidence is present for the claims made:
      `recordEvidence` ← `tools/tool-executor/result-lifecycle.ts:74`;
      `loadRawEvidenceForSpawn` ← `spawn-agent-inline.ts`,
      `spawn-agents-child-run.ts`; `spliceRawEvidence` ← `spawn-child-state.ts`;
      `appendCompactionInventory` ← the three callers named in the Evidence block
- [x] FID status reflects the actual implementation state (`fixed`: steps 1-2 are in
      the codebase and gated; steps 3-7 are not written, and the record says so
      rather than implying the defect is cured)

### Loop 2 — steps 1 and 2 implemented (2026-10-07)

- **RED:** the pin was written before the seam existed and failed on the unmodified
  tree with `Cannot find module '../retention-registry' from
  src/evidence/__tests__/retention.test.ts` (exit 1, 0 pass / 1 fail / 1 error). The
  RED is therefore the real absence of the contract, not a rewritten expectation.
- **GREEN:** `retainOriginal` returns a handle or a named refusal; `recordEvidence`
  becomes the boolean view over the same primitive rather than a second
  implementation (Law 13); the tool-result boundary records the verdict through an
  in-process registry; the registry's reset is wired into the workspace preload.
- **AUDIT:** the gate battery is the audit, and it separates "the new thing works"
  from "nothing else moved": the new pin is 7 pass / 0 fail; the evidence directory
  is 15 pass / 0 fail, which is the proof that delegating `recordEvidence` to
  `retainOriginal` is behaviour-preserving; `packages/agent-runtime` is 1880 pass /
  0 fail across 294 files (was 1873, +7 for this pin); typecheck exits 0;
  `quality:report` PASS; eslint `--max-warnings 0` exit 0 after `--fix` and not
  before (three import/order warnings were fixed at the cause, not suppressed);
  prettier clean.
- **AUDIT (the strongest evidence, because it is mechanical):** the registry is
  module-scope state, so FID-2026-1007-002's audit owns it. `bun
  scripts/module-state-check.ts` reports **183 of 188** resettable bindings wired —
  up from 182 of 187 — which is this registry enumerated AND proven wired rather than
  claimed to be. That is the loop's own tooling auditing this record's work.
- **ADVERSARIAL (the part that matters most, stated first rather than buried):**
  **this does not fix the reported defect yet.** Nothing reads the verdict, so the
  four transforms still discard exactly what they discarded before and the marker
  still advertises a location it cannot compute. Step 2 was landed first on purpose —
  the transport has to exist and be proven before the consumers flip, because
  flipping them first would leave the find-files path keeping 400 KiB payloads with no
  store to point at — but the honest reading of this commit is infrastructure, not
  repair. Two further limits are named: the verdict travels in-process, so a resumed
  run that never hit the boundary has no handle (the safe direction, but a
  limitation); and `store-full` is the one refusal reason with no pin, because
  producing it honestly needs an 8 MiB fixture — recorded here rather than counted
  as covered.
- **CHANGE DELTA:** a new loop, the step statuses, the gate block, and the reach
  correction in the AUDIT above.

### Loop 3 — steps 3-7 implemented (2026-10-07)

- **RED:** the pins were written and run BEFORE any production edit, and the
  unmodified tree failed them — 5 failed plus 2 module-resolution errors (`Export
  named 'resolveRetainedPayload' not found …`, `Cannot find module
  '../retention-registry'`), exit 1. These were the real absences, not rewritten
  expectations, and they included `store-full`: the previous loop had recorded that
  refusal as unpinnable.
- **GREEN:** the four transforms refuse to drop without a handle; one `omitted` marker
  carries a locator or a refusal; the trim pass writes the `layer: 'trim'` row; the
  store redacts, rotates, and resolves for whoever holds the handle; the ceilings are
  reported.
- **AUDIT (mechanical, and it found something):** the gate battery separates "the new
  thing works" from "nothing else moved". `packages/agent-runtime` is **1905 pass / 0
  fail** across 297 files (was 1880 / 294); root `typecheck` exit 0; `eslint .
  --max-warnings 0` exit 0 after fixing three `import/order` warnings AT THE CAUSE;
  prettier clean; `module-state-check` PASS at 183 of 188 — unchanged, because this
  work adds no module-scope state, which is the check passing rather than a gap. Two
  deviations from this record's own plan were found and are written down in `###
  Steps` where the plan was: (a) step 3 planned to delete all three marker spellings,
  but `contentOmittedForLength` and `stdoutOmittedForLength` are members of the
  `read_files` / `run_terminal_command` output zod unions and the first is type-guarded
  in `util/messages/history.ts`, so deleting them would have widened a correctness fix
  into the tool-output schemas — they stay as the marker's boolean view (Law 13); and
  (b) the trim ledger's diff must run against the SIMPLIFIED pre-drop array, because
  this pass also REPLACES messages and a reference-identity diff against the caller's
  array would have reported every replaced-but-kept message as deleted. The quality
  gate also did its job: five files this work had grown past the 300-line absolute
  maximum were rejected, and each was split at a REAL seam (`49c7bab4`) rather than
  trimmed to fit — the write policy, the store contract, the read side, the marker
  machinery, the boundary capture and the training picker each became their own
  module, with every origin re-exporting what moved so no caller changed.
- **AUDIT (the finding that was worth the loop):** `util/__tests__/messages-trim.test.ts`
  was passing PARTLY BECAUSE OF THE DEFECT. Its terminal fixtures were bare JSON
  strings — a shape `run_terminal_command`'s output schema cannot produce — so the old
  transform threw into its `{ command: '', stdoutOmittedForLength: true }` fallback,
  collapsing a 2,018-char result to roughly 40 characters and satisfying that suite's
  own token-budget assertion. Making the transform refuse to process a shape it cannot
  faithfully represent (instead of inventing a lossy result) turned the assertion red,
  and the honest repair was to the FIXTURE: it now carries the shape the tool returns,
  it states its precondition (the boundary has retained these payloads, so the fixture
  registers the handles), and the assertion is unchanged. A test that passes because
  data was silently destroyed is not evidence.
- **ADVERSARIAL:** the strongest objection is unchanged from Loop 1 — "refuse to drop"
  is unbounded token pressure: with no verdict the trim pass can no longer make a
  find-files request fit its budget. Two things bound it. The verdict exists for every
  tool result in production, because the boundary retains before any layer sees the
  result, so `no-retention-verdict` needs BOTH an async write to lose its race and the
  find-files path to run inside that window; and the failure the contract chooses is a
  prompt that is too big, which fails loudly and cheaply, over a finding that is gone,
  which fails silently and permanently. On step 6 the objection is different and is
  answered rather than deflected: redacting at the store means the retained bytes are
  a summary, so "lossless" is not literal. That is the Law 12 decision, it is stated in
  the module contract, it is carried on the record and the handle as `redacted: true`,
  and it removes bytes only from the STORE — never from the model's context — so it
  cannot re-introduce the loss this record exists to stop.
- **CHANGE DELTA:** the Summary's status paragraph, all five Steps marked DONE with
  their deviations, the Verification scope paragraph and the gate block (5 -> 11
  gates), the Implementation Evidence, this loop, and the Resolution; the introduced
  limit from Loop 2 (`store-full` unpinned) is closed.

## Resolution

- **Closed Date:** 2026-10-07 15:35
- **Fix Description:** All seven steps implemented (`eb2ee0f3`, on top of the steps 1-2
  seam in `e9322b38`). The defect is cured at the level it was found: **no path
  discards model-facing bytes it has not provably stored, and no marker claims a
  location it cannot compute.** Concretely — the four
  `util/simplify-tool-results.ts` transforms read the boundary's verdict by
  `toolCallId` and return the payload UNTOUCHED when there is no handle, so the
  truncate/verbose/read/terminal paths can no longer take bytes nobody kept; the one
  marker they leave behind carries `retained: { file, toolCallId, sha256, bytes,
  redacted }` (a real locator) or a named refusal; `fullOutput`'s fixed placeholder is
  deleted; `trimMessagesToFitTokenLimit` writes a `layer: 'trim'` inventory row naming
  the `toolCallId`s it deleted; `resolveRetainedPayload` resolves a handle with no role
  gate, the spawn read gate is scoped by need, and `spliceRawEvidence` restores over
  omission markers as well as `[compacted]` sentinels; the store redacts credentials
  before writing and states that policy in its module contract; and the store rotates
  into shards, so its ceilings are a stated bound — reported when hit — rather than a
  silent `false` nobody reads.
- **Tests Added:** Yes — 25 new pins across six files, plus four suites updated to
  the contract they were written against. `evidence/__tests__/retention.test.ts` (7,
  from steps 1-2): the handle's `sha256` and byte count against the stored record, the
  handle resolving through `loadEvidenceRecords`, three named refusals (one proving a
  refusal writes nothing), append-not-replace across two payloads, the registry's
  round-trip and reset, and its refusal to invent an outcome for a missing identity.
  `evidence/__tests__/retention-hardening.test.ts` (9): redaction at the store with the
  handle describing the STORED form, shard rotation, the pinned `store-full`, the
  record cap measured against stored bytes, and the resolver's found / tampered /
  absent / unreadable legs. `util/__tests__/simplify-tool-results-omission.test.ts`
  (9): both legs of the property through the four shipped transforms, the first leg
  resolving a real handle out of a real store, plus `fullOutput`'s absence and the
  object branch's honest `omittedChars: 0`.
  `util/__tests__/messages-trim-inventory.test.ts` (3): the row, no row without a run
  context, and the under-budget early return by reference.
  `find-files/__tests__/request-files-prompt.test.ts` (+1): the row again, from the real
  entry point, so the wiring is exercised rather than typechecked.
  `evidence/__tests__/evidence-splice.test.ts` (+1) and
  `evidence/__tests__/spawn-evidence.test.ts` (+1): the step-5 pair, and
  `util/__tests__/simplify-tool-results-verbose.test.ts` (+1) adds the string-payload
  leg. Updated: `util/__tests__/simplify-tool-results{,-truncation,-terminal}.test.ts`
  and `util/__tests__/messages-trim.test.ts`.
- **Verification Evidence:** RED is recorded from the unmodified tree before any
  production edit — 5 failures plus 2 module-resolution errors, exit 1 (the new seams
  did not exist) — and is reproducible by running
  `bun test src/util/__tests__/simplify-tool-results-omission.test.ts` on the parent of
  the implementation commit. GREEN: `packages/agent-runtime` is **1905 pass / 0 fail**
  across 297 files, root `typecheck` exit 0, `eslint . --max-warnings 0` exit 0,
  prettier clean, `module-state-check` PASS (183 of 188 wired), and all eleven declared
  gates exit 0 at the stamped receipt.
- **Archived:** 2026-10-07 15:35 (moved to `dev/fids/archive/`)

## Lessons Learned

1. A pointer is a promise, and a promise has to be enforced by the thing that would
   break it. The marker here was honest about its intent and false in its content for
   as long as no store existed to check it against.
2. `fail-open` is a contract about capture, not about replacement. The same word is
   correct for "losing this log line must not fail the tool" and wrong for "failing to
   store this payload is fine because we are about to delete it anyway".
3. The path with no ledger was not the one assumed. Two stores grew independently —
   one for payloads, one for compaction events — so the deleting path that is
   accountable to neither went unnoticed, and it was found by enumerating the paths
   rather than by trusting the one that hurt most recently. Reach is a separate
   measurement from mechanism: the worst *mechanism* here (whole-message deletion) has
   the narrowest *blast radius* (the find-files request path), and a record that
   states the first without measuring the second overstates its own severity.
4. A read gate written for one purpose silently becomes a permission model. The flag
   that lets two audit roles reconstruct a transcript is the only switch governing who
   may recover their own output, and it was never intended to be.
5. A suite can be passing because of the defect it is named after. The heaviest
   evidence here was not a new failing test but an existing one going red: the trim
   suite's token-budget assertion was satisfied partly by the data the old transform
   silently destroyed. When a fix turns an old test red, the first question is not "how
   do I restore it" but "which of the two was lying" — repairing the fixture and
   keeping the assertion is the move that turns a decorative test into evidence, and
   rewriting the assertion to match the code is the move that hides the defect again.
