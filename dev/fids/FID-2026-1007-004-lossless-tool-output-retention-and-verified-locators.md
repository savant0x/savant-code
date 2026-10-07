# FID: Every discarded payload needs a durable record and a locator it can prove — no silent tool-output loss

**Filename:** `FID-2026-1007-004-lossless-tool-output-retention-and-verified-locators.md`
**ID:** FID-2026-1007-004
**Severity:** high
**Status:** fixed
**Created:** 2026-10-07 16:05
**Automation level:** 3
**YAGNI-Compliance:** Pending

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
the synchronous transforms. **That is infrastructure, not repair** — nothing consumes
the verdict yet, so no discard behaviour has changed and the marker still lies.
Steps 3-7 are unstarted, and the record states that rather than implying the defect
is cured.

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
3. **Make the four transforms refuse to drop what was not retained.** One shared
   marker shape replaces the three spellings:
   `omitted: { reason, originalChars, keptChars, omittedChars, preview,
   retained: { file, toolCallId, sha256, bytes } | { ok: false, why } }`.
   `fullOutput` is deleted (measured: no consumer reads it).
4. **Ledger the trim pass.** `trimMessagesToFitTokenLimit` writes one
   `appendCompactionInventory` row (`layer: 'trim'`, added to `CompactionLayer`)
   naming the dropped `toolCallId`s and byte sizes, via the `diffRemovedSpans`
   helper the other layers already use.
5. **Make the store readable by the agent that owns the payload.** Generalise the
   read path so a marker's handle resolves for the running agent, not only for
   `requiresRawEvidence` roles; keep the audit-roles-only *bulk* splice exactly as it
   is.
6. **Decide and pin the redaction policy (Law 12).** The store persists raw tool
   output unredacted today. Whatever is decided, it is stated in the module contract
   and pinned, and the added message-level retention from step 4 does not silently
   widen it.
7. **Report the ceilings instead of swallowing them**, and shard or rotate the store
   so a long run does not reach `store-full` in the first place.

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

Scope of the declared gates: the block below covers the part that IS implemented
(steps 1-2), which is why it is five gates rather than the whole battery — the
remaining steps declare their own when they land, and a gate naming a file that does
not exist would be a fiction. Two of the five are chosen for what they would CATCH
rather than for what they prove: `evidence-splice.test.ts` is the evidence that
delegating `recordEvidence` to `retainOriginal` preserved the store's existing
behaviour (the one regression this seam could have introduced), and the
`module-state-check` probe is FID-2026-1007-002's audit confirming the new registry is
both enumerated and wired rather than merely claimed.

## Verification Gates

- gate: test packages/agent-runtime/src/evidence/__tests__/retention.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/evidence-splice.test.ts
- gate: probe scripts/module-state-check.ts
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:e22078461fcf0e26a28e5b3b920a7860ee2fe8ae8c2196b973a82a635d45bf6b
- verified: 2026-10-07T18:23:46.622Z
- test packages/agent-runtime/src/evidence/__tests__/retention.test.ts: exit 0
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

> PARTIAL. Steps 1-2 of 7 are implemented and gated; steps 3-7 are not written, so
> this record is **not** eligible for `closed` and does not claim to be.

- [ ] **Commit SHA:** partial — `e9322b38` (steps 1-2); the record stays open until
      steps 3-7 land
- [x] **File:line ranges:** `evidence/spill.ts` (`retainOriginal`,
      `RetentionHandle`, `RetentionRefusal`), `evidence/retention-registry.ts`
      (`rememberRetention` / `lookupRetention` / `resetRetentionRegistry`),
      `tools/tool-executor/result-lifecycle.ts` (the boundary call site),
      `test/setup-test-isolation.ts` (the reset wiring)
- [x] **Gate output:** all five declared gates exit 0 at the stamped receipt
- [x] **Reproducibility:** `bun test src/evidence/__tests__/retention.test.ts` and
      `bun scripts/module-state-check.ts` both name the behaviour (183 of 188 wired),
      and the RED measurement is reproducible via
      `bun run dev/scratchpad/active/step3-truncation-audit.ts`
- [ ] **Step statuses:** steps 1-2 `implemented`/verified; **steps 3, 4, 5, 6 and 7
      `not started`**

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified by read in this pass)
- [ ] Implementation matches the Proposed Solution — no implementation yet
- [ ] Typecheck/tests/lint pass with pasted tool output — nothing to verify yet
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

## Resolution

- **Closed Date:** not closed
- **Fix Description:** **partial — steps 1-2 of 7 implemented** (`e9322b38`). The
  retention seam exists and returns a handle or a named refusal, and its verdict
  travels from the tool-result boundary to the synchronous transforms. Nothing
  consumes it yet, so **no discard behaviour has changed**: the marker still names a
  fixed placeholder, the read and terminal transforms still drop with no locator, and
  the trim pass still deletes whole messages with no inventory row. Steps 3-7 remain
  unstarted and are listed in `### Steps`.
- **Tests Added:** Yes — `packages/agent-runtime/src/evidence/__tests__/retention.test.ts`
  (7 tests): the handle's `sha256` and byte count against the stored record, the
  handle resolving through `loadEvidenceRecords`, three named refusals (one of which
  proves a refusal writes nothing), append-not-replace across two payloads, the
  registry's round-trip and reset, and its refusal to invent an outcome for a missing
  identity.
- **Verification Evidence:** RED is recorded from the unmodified tree (`Cannot find
  module '../retention-registry'`, exit 1) and reproducible for the rest through
  `dev/scratchpad/active/step3-truncation-audit.ts` (five payload shapes, five paths,
  the table in `Problem`). GREEN for steps 1-2: the declared gates all exit 0 at the
  stamped receipt, `packages/agent-runtime` is 1880 pass / 0 fail, and
  `module-state-check` reports 183 of 188 wired. **No evidence is claimed for steps
  3-7, because none of them is written.**
- **Archived:** not archived

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
