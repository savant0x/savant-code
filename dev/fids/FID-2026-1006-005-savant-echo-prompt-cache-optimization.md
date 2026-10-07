# FID: Savant/ECHO prompt-cache optimization — reconcile an external research plan with the shipped cache stack

**Filename:** `FID-2026-1006-005-savant-echo-prompt-cache-optimization.md`
**ID:** FID-2026-1006-005
**Severity:** medium
**Status:** converged
**Created:** 2026-10-06 23:05
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

An externally sourced research report, `docs/design/Savant_ECHO Cache Optimization
Research.md` (324 lines, untracked at intake), proposes a three-phase program to
raise prefix-cache reuse in this harness: (1) a deterministic prompt compiler with
canonical tool serialization, (2) a spill-file pruner replacing destructive
truncation, and (3) provider cache breakpoints with TTL routing and mid-session
tool-mutation directives. Reconciling that plan against the shipped tree changes
it materially rather than invalidating it. Phases 2 and 3 are substantially
already implemented — `evidence/spill.ts` keeps a per-run append-only JSONL spill,
`util/simplify-tool-results.ts` truncates deterministically, and
`common/src/util/messages/cache-control.ts` already tags `cache_control:
{ type: 'ephemeral' }` per provider. Three things are genuinely missing or wrong:
there is **no provider cache-breakpoint TTL** (only `ephemeral`), the Anthropic
`tool_addition`/`tool_removal` beta directives are **not implemented anywhere**, and
the existing cache-bust detector cannot distinguish the exact fracture class this
program targets — `stableHash(toolDefinitions)` hashes
`JSON.stringify(normalizeForJson(...))`, and `normalizeForJson` rebuilds objects
with `Object.fromEntries(Object.entries(...))`, preserving **insertion order**
rather than canonicalizing it, so a reordered-but-identical tool set changes
`toolsHash` exactly as a real tool change does. The Phase-1 premise itself is
confirmed (key order changes the serialized bytes) and its stated rollback flag
does not exist in the codebase. Independent adjudication of the cache-control seam
found it split across two incompatible spellings and two different provider sets,
with a comment describing re-tagging behaviour that was never implemented. This
record also folds in the T154 gate defect: the same document was the sole cause of
`bun run lint:md` exiting 1 (108 MD013 + 1 MD001), now fixed in-pass by an
operator-ruled `.markdownlintignore` exemption plus a new `scripts/lint-md-check.ts`
probe that finally makes the markdown gate declarable in a FID.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint, markdownlint-cli 0.49.1, prettier (repo-pinned)
- **Commit/State:** HEAD `43f436b0`; working tree carries this session's Law 15 change
  set (FID-2026-1006-004) plus the untracked research document under study

## Detailed Description

### Problem

Three separate defects meet in one document, and only the first is visible from
the gate output.

**(A) The repository markdown gate was red because of one untracked research
report.** `bun run lint:md` (`markdownlint .`) exited 1 on exactly one file:
`docs/design/Savant_ECHO Cache Optimization Research.md`, contributing 108
`MD013/line-length` violations plus one `MD001/heading-increment` violation
(`####` directly under a `##` at line 243). Every other file in the repository was
clean, so a single pre-existing, never-committed artifact owned the whole gate.

**(B) The plan's Phase 2 premise is stale, and its retention claim is weak.**
The report states that "Savant's existing handling of large tool outputs relies on
the underlying LLM provider's context window, risking out-of-memory errors or
massive uncached processing bills", and asks for a `SpillFilePruner` writing to
`dev/spill/` with a "deterministic recovery marker". The deterministic truncation
half already ships under a different name (`util/simplify-tool-results.ts`, FID-2026-0806-003
P2c) alongside a per-run evidence spill (`evidence/spill.ts`, FID-2026-0824-026).
The *retention* half is weaker than the report assumes and than a first reading of
the code suggests: the truncation marker's `fullOutput` field is a fixed
placeholder string, not a locator, and it is only meaningful when cache-debug is
enabled. So Phase 2 is an audit whose outcome is not yet known — it is not parity,
and implementing it as written would duplicate shipped behaviour.

**(C) The one instrument that could measure the program's central claim is blind
to it.** The report's thesis is that prompt-prefix stability determines cache
reuse. The repository already snapshots, per model call, a `systemHash` and a
`toolsHash` alongside the raw provider body (`util/cache-debug.ts`), and those
hashes have a live consumer: `util/token-telemetry.ts` compares consecutive pairs
for prefix-stability monitoring — precisely the measurement path this program
needs. But `stableHash` is `sha256(JSON.stringify(normalizeForJson(value)))` and
`normalizeForJson` maps objects through `Object.fromEntries(Object.entries(...))`,
preserving key order instead of canonicalizing it. A tool set re-serialized in a
different order therefore produces a different `toolsHash`, so the detector reports
"the tool set changed" for a semantically identical payload, and the fracture class
this program exists to remove cannot be told apart from a real tool change.

A fourth defect surfaced only under independent adjudication (Loop 2): the
cache-control seam is **split**. The trim path deletes one spelling of the marker
against one provider set, while the only production writer sets a different
spelling against a different provider set, and a comment describes re-tagging that
the function does not perform.

### Expected Behavior

The markdown gate exits 0 with the exemption recorded, justified, and narrow
enough that the gate still catches real violations. The cache program is
re-scoped against ground truth before implementation: Phase 2 becomes a coverage
audit that may well produce a finding, Phase 1 gains a canonical serialization
step whose detector can actually distinguish reorder-fracture from a real change,
and Phase 3 splits into what exists (`cache_control` placement) and what does not
(TTL control, `tool_addition`/`tool_removal`). The cache-control spelling and
provider-set mismatch is resolved before any TTL or breakpoint work is specified
on top of it. No ECHO law is amended before the operator approves the amendment,
and no phase is implemented before its stated precondition is independently
verified.

### Root Cause

- **(A)** The document is an operator-pasted research artifact carrying long cited
  prose. `lint:md` scans the whole tree including untracked files, so an artifact
  that was never part of the shipped documentation still owned a repository gate.
- **(B)** The report was authored against a snapshot that predates FID-2026-0806-003
  and FID-2026-0824-026. Its authors could not see the shipped equivalents, and
  nothing in the repository maps an external program's proposals onto existing
  seams. The retention weakness is separate: the marker was designed as an
  operator hint, not as a durable locator.
- **(C)** `normalizeForJson` was written to make values *serializable*
  (`Uint8Array` → `{ type, byteLength }`, `URL` → string), not *canonical*.
  Order-preservation was incidental to that purpose and stays invisible until a
  consumer needs order-insensitivity — which is exactly what a cache-fracture
  detector needs.
- **(D)** Two cache-control spellings (`cache_control` in provider options,
  `cacheControl` in the openai-compatible metadata translation) coexist across
  layers. Each call site picked the spelling its own consumer needed and the trim
  path was never reconciled with the writer, so its deletion is largely dead and
  its provider list is misaligned.

### Evidence

The gate defect, before the fix (exit 1, one file):

```text
$ bun run lint:md
docs/design/Savant_ECHO Cache Optimization Research.md:5:121 error MD013/line-length
  Line length [Expected: 120; Actual: 696]
...
docs/design/Savant_ECHO Cache Optimization Research.md:243 error MD001/heading-increment
  Heading levels should only increment by one level at a time [Expected: h3; Actual: h4]
108 x MD013/line-length, 1 x MD001/heading-increment, 0 violations in any other file
```

After the exemption, with a negative leg proving the gate is still load-bearing
(a planted root-level file with a 199-character wrappable prose line, then removed):

```text
$ bun run lint:md           # after the .markdownlintignore entry
LINTMD_EXIT=0
$ bun run lint:md           # with zzz-negative-leg.md planted
GATE_EXIT=1
zzz-negative-leg.md:3:121 error MD013/line-length Line length [Expected: 120; Actual: 199]
$ bun run lint:md           # after removal
LINTMD_EXIT=0
```

The Phase-1 premise, independently reproduced rather than taken on the report's
word (the report's own Handoff Prompt demands exactly this before any code):

```text
insertion-order A: {"b":1,"a":2,"c":3}
insertion-order B: {"a":2,"b":1,"c":3}
byte-identical: false
sorted-identical: true {"a":2,"b":1,"c":3}
```

The detector blind spot (`packages/agent-runtime/src/util/cache-debug-serialize.ts`):

```ts
export function normalizeForJson(value) {
  ...
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeForJson(entryValue)]),
  )
}
export function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(normalizeForJson(value))).digest('hex').slice(0, 8)
}
```

`Object.entries` iterates in insertion order and `Object.fromEntries` writes in
that same order, so the hash input is order-sensitive by construction. Precision
limit, carried from the independent audit: `Object.entries` and `JSON.stringify`
both emit integer-like keys first in ascending numeric order regardless of
insertion, so a reorder moves the hash only for non-integer-like string keys —
which is true of every tool-schema key, so the conclusion holds for this payload.

The split cache-control seam — the trim path
(`packages/agent-runtime/src/util/messages/trimming.ts:178-185`):

```ts
// Remove cache_control from all messages
for (const message of messagesSubset) {
  for (const provider of ['anthropic', 'openrouter', 'savant-code'] as const) {
    delete message.providerOptions?.[provider]?.cacheControl
  }
}
```

versus the only production writer
(`common/src/util/messages/cache-control.ts:19-25`):

```ts
for (const provider of ['anthropic', 'openrouter', 'openaiCompatible'] as const) {
  wrapper.providerOptions[provider].cache_control = { type: 'ephemeral' }
}
```

Two mismatches, both verified by a repo-wide grep restricted to non-test
production code: the deletion removes camelCase `cacheControl` while the writer
sets snake_case `cache_control` (camelCase appears in production code
exactly once, at `trimming.ts:185`, and is written nowhere in this repository);
and the provider sets differ — `savant-code` is deleted but never written,
`openaiCompatible` is written but never deleted. The comment immediately after the
deletion loop claims behaviour that does not exist:

```text
// Cache up to the last message!
const lastMessage = messagesSubset[messagesSubset.length - 1]
if (!lastMessage) { logger.debug(..., 'No last message found in messagesSubset!') }
```

`getMessagesSubset` returns `messagesSubset` unchanged; `lastMessage` feeds only a
log branch, so nothing is re-tagged. This is therefore NOT the "strips every
breakpoint" cache flush a first reading suggests — the deletion is largely dead
against the real marker. The defect it does evidence is a split seam: two
spellings, two provider sets, and a comment describing unimplemented behaviour.

What already ships (so Phase 2 is an audit, not a build):

```text
packages/agent-runtime/src/evidence/spill.ts             append-only per-run JSONL, fail-open by contract
packages/agent-runtime/src/util/simplify-tool-results.ts  deterministic truncation (50,000 B / 2,000 lines)
packages/agent-runtime/src/context-compactor.ts           4-layer compaction incl. reactive emergency truncate
```

The retention claim, corrected (audit finding). `simplify-tool-results.ts:119`
sets the marker's `fullOutput` to the fixed string
`'[See cache-debug snapshot / rerun the tool for full output]'` — a placeholder
naming two possibilities, not a locator; retention depends on cache-debug being
enabled, and it lives under `debug/`, which is gitignored. So "retains the full
value on disk behind a `truncated` marker" is not accurate, and Phase 2's coverage
question is genuinely open.

What is genuinely absent. Both tokens below appear in the research document only in
escaped form ("tool\_addition", "features.deterministic\_compiler"), which is why a
naive literal search over the tree returns nothing even before this record existed:

```text
tool_addition / tool_removal directives        -> not implemented in code, tests, or config
provider cache-breakpoint TTL                  -> only { type: 'ephemeral' } exists
deterministic-compiler rollback flag           -> does not exist (the report's `features.deterministic_compiler`)
```

Unrelated `ttl`/`1h` hits do exist elsewhere (a connectors endpoint input schema,
an elapsed-time formatter, a message `timeToLive` field); none of them is a
provider cache-breakpoint TTL, which is the actual gap.

## Impact Assessment

### Affected Components

- `docs/design/Savant_ECHO Cache Optimization Research.md` (the source artifact)
- `.markdownlintignore` (exemption entry)
- `scripts/lint-md-check.ts` (new probe expressing the markdown gate)
- `packages/agent-runtime/src/util/cache-debug-serialize.ts` (`normalizeForJson`, `stableHash`)
- `packages/agent-runtime/src/util/cache-debug.ts` (`systemHash` / `toolsHash` snapshots)
- `packages/agent-runtime/src/util/token-telemetry.ts` (live consumer of the hash pair)
- `packages/agent-runtime/src/util/messages/trimming.ts` (split breakpoint deletion)
- `common/src/util/messages/cache-control.ts` (breakpoint writer; TTL addition point)
- `packages/agent-runtime/src/run-agent-step/loop-context.ts` (tool envelope assembly)
- `packages/agent-runtime/src/evidence/spill.ts`, `util/simplify-tool-results.ts` (Phase 2, shipped)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Treat the report as a claim set to be adjudicated against the tree, not a
specification to be executed. Ship the gate fix immediately because it is
operator-ruled and reversible. Re-scope the three phases: Phase 2 becomes coverage
verification of shipped behaviour and is expected to produce a finding about the
marker's non-locating `fullOutput` value; Phase 1 becomes canonical serialization
at the single assembly seam **plus** a canonical detector, since without the
detector the change cannot be measured; Phase 3 splits into the shipped placement
work and the genuinely absent TTL and tool-mutation pieces. The split
cache-control seam is resolved first, because every later phase writes or deletes
those markers. The report's proposed ECHO amendments stay unapproved until the
operator rules on them, and the rollback flag the report names must actually be
created before any phase claims to be reversible.

### Steps

1. **DONE (this pass).** Land the gate fix under the operator's T154 ruling: a
   justified `.markdownlintignore` entry for the report, plus
   `scripts/lint-md-check.ts`, an independently runnable probe expressing
   `lint:md` so the markdown gate can finally be a declared FID gate. Verified
   exit 0 with a negative leg proving the gate still fails on real violations.
2. **DONE (this pass).** Independently reproduce the Phase-1 premise (byte order
   changes the serialized string) rather than accepting the report's word, and
   record that the report's stated rollback flag `features.deterministic_compiler`
   does not exist in this codebase.
3. Audit Phase 2 coverage: enumerate every destructive-truncation path in the
   runtime and determine, per path, whether the full value is actually
   recoverable. Expect a finding, not parity — the tool-output marker's
   `fullOutput` is a placeholder and retention is conditional on cache-debug. Any
   genuine gap becomes a step here; no second spill mechanism is to be added.
4. Resolve the split cache-control seam: settle on one spelling and one provider
   set across `trimming.ts` and `cache-control.ts`, and either implement or delete
   the dangling `// Cache up to the last message!` comment. This is a
   prerequisite for steps 6-8, not a cleanup.
5. Phase 1a — make the model-facing tool payload canonical at its single assembly
   seam (Law 4: locate the one production assembly site first, then sort there),
   behind a rollback flag that must actually be created.
6. Phase 1b — make `normalizeForJson`/`stableHash` canonical (sort object keys
   recursively) so `toolsHash` changes only on a real payload change. Measurement
   prerequisite for steps 7-9, not cosmetics.
7. Phase 3a — add TTL control at the breakpoint seam, with the mode-to-TTL policy
   (the report proposes 5m for Hybrid, 1h for FID-bound) recorded as an operator
   decision before implementation, since it changes spend.
8. Phase 3b — evaluate the Anthropic `tool_addition`/`tool_removal` beta for
   mid-session role handoffs. Absent today; needs a live endpoint test before it
   can be claimed, and the report's own falsifier (physical node routing that does
   not share cache pools) must be tested rather than assumed away.
9. Submit the report's two proposed ECHO amendments (Law 1 spill-file
   authorization; deterministic tool-array serialization) to the operator as
   explicit approval items. No code may depend on an unapproved amendment.
10. Measure: use the existing `debug/cache-debug/` snapshots and the
    `token-telemetry` prefix-stability comparisons to measure `systemHash` /
    `toolsHash` stability and cache read/token ratios before and after, against
    the report's own Approval Point 3 (>75% hit ratio on multi-turn FID loops).
    Live provider billing measurement is a named boundary, not a claim.

### Verification

- **P1** `bun run scripts/lint-md-check.ts` exits 0, and the gate is proven
  load-bearing by the planted-file negative leg (before removal and after).
- **P2** Two tool sets differing only in key insertion order serialize to
  byte-identical payloads through the production assembly seam. RED first: today
  they do not.
- **P3** `stableHash` of a reordered tool set equals the original; `stableHash` of
  a genuinely changed tool set differs. RED first: today both differ.
- **P4** The cache-control seam is single-spelled and its provider sets agree
  across writer and trim; a test asserts that a written marker is the marker the
  trim path acts on (RED first: today the trim deletes a spelling nothing writes).
- **P5** Once a TTL is specified, it appears on the emitted breakpoint payload for
  the mode it is bound to. Requires a live endpoint to observe the wire payload —
  a named boundary.
- **P6** `tool_addition`/`tool_removal` directives appear on the wire for a role
  handoff, proven against a captured provider body — not by inspection. Also
  requires a live endpoint.
- **P7** `bun run quality:report` PASS.

Scope of the declared gates: they cover what this pass actually changed — the
markdown gate fix and its probe. Steps 4-9 add their own test gates at
implementation time; a `converged` record is pre-implementation, so that battery
is declared then rather than now. The probe re-enters `lint:md`, never
`validate:repository`, so it is not the C3 recursion the template warns about —
and it must never be extended to run `validate:repository`.

## Verification Gates

- gate: probe scripts/lint-md-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ae29f663f7b44b0bf65a61987e522c5f4e1d37fc20a0f7c8fc8aaeebb931eb67
- verified: 2026-10-07T03:18:42.039Z
- probe scripts/lint-md-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the gate defect was reproduced on HEAD (exit 1, one file, 108 MD013 +
  1 MD001) and shown to be owned entirely by an untracked artifact. Independently
  re-measuring the report's central premise confirmed its mechanics but exposed
  three defects in the report as a specification: Phase 2's premise is stale, its
  retention claim is weaker than assumed, and the report's Phase-1 rollback flag
  does not exist. A fourth defect was found that the report never mentions:
  `stableHash` preserves key order, so the one production cache-bust detector
  cannot distinguish a reorder from a real change. The report's Phase 3 splits into
  shipped placement work and genuinely absent TTL/tool-mutation pieces.
- **GREEN:** the gate fix landed (operator-ruled exemption + the new probe), the
  measurement prerequisite was promoted to a first-class step, Phase 2 was
  re-scoped from build to audit, and the ECHO amendments were moved behind an
  operator-approval step rather than assumed.
- **AUDIT:** the negative leg was itself corrected twice before it proved anything.
  Two earlier planted-violation attempts returned exit 0: the first because this
  shell has no `seq`, the second because `MD013` does not report a line it cannot
  wrap (`'x'.repeat(200)` is a single token). Only the wrappable-prose leg (199
  characters with spaces) produced the expected `exit 1` naming the planted file.
  This also explains the original evidence: the document's 24 base64 figure
  definitions run to 3,210 characters yet were never among the 108 violations.
- **ADVERSARIAL:** the independent audit in Loop 2 overturned this record's own
  central hazard claim. See below.
- **CHANGE DELTA:** new document (n/a).

### Missed Questions

1. **Is the exemption too broad?** Yes by construction — ignoring a file skips
   *every* markdownlint rule, not just MD013. The entry therefore also silences one
   real MD001 heading-increment defect (`####` under `##` at line 243). Answer:
   recorded as an accepted limit with the rule named, rather than fixed blind
   inside another session's untracked file, and re-evaluation with the per-file
   header route is written into the ignore entry itself.
2. **Does the markdown gate actually scan everything, or is the exemption hiding
   a vacuous green?** Answered by measurement, not assumption: a planted root-level
   markdown file with a wrappable 199-character line makes the gate exit 1 and
   names it. The gate scans untracked files at any depth.
3. **Why did the base64 lines never fail MD013?** Because MD013 skips lines it
   cannot wrap, which is also why the first two negative legs were invalid. This
   corrected the exemption's justification, whose original wording claimed
   unsatisfiability on false grounds.
4. **What is `lint:md`'s status in the FID contract?** It has no allowlisted gate
   kind (`typecheck`/`test`/`probe`/`quality` only), so a record about the
   markdown gate could not declare it — the missing piece that made T154
   un-FID-able. Answer: `scripts/lint-md-check.ts`, the probe route the template
   documents, so this is fixed permanently rather than per-record.
5. **Are there two cache-control spellings, and does the trim path actually flush
   the cache?** This question was not asked when the record was drafted, and the
   draft asserted a flush. The audit forced it: camelCase `cacheControl` is deleted
   by the trim while production writes snake_case `cache_control`, the provider
   sets differ, and the re-tag the comment promises is unimplemented. The answer
   inverted the finding from "strips every breakpoint" to "split seam, largely dead
   deletion, misleading comment".
6. **Is the report's advantage claim testable here?** Not without live provider
   billing. The report's own falsifier — routing to physically distinct nodes that
   do not share cache pools — remains untested, and is a named boundary rather
   than an assumption.
7. **Should the report be committed?** Out of this record's decision: it is
   untracked, and the exemption is written to be re-evaluated with the per-file
   header route if it is committed and becomes governed documentation.

### Implementation Evidence (REQUIRED for `closed`)

> Not closable: the program steps are planned and preconditioned, not built.
> Steps 1-2 are complete; steps 3-10 are unstarted, several behind operator
> approval points.

- [ ] **Commit SHA:** none (G2 withheld; the gate fix is uncommitted)
- [ ] **File:line ranges:** see Loop 3 for the landed lines
- [ ] **Gate output:** probe + quality stamped at first verify
- [ ] **Reproducibility:** `grep -n 'Savant_ECHO Cache Optimization Research' .markdownlintignore`
- [ ] **Step statuses:** steps 1-2 `implemented`; steps 3-10 `blocked` on operator
      approval points (TTL policy, ECHO amendments, live endpoint tests)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (steps 1-2 only)
- [x] Typecheck/tests/lint pass with pasted tool output (probe + quality gates)
- [ ] Production call-graph evidence is present for new or repaired wiring (the
      assembly seam of step 5 is not yet located — Law 4 applies at implementation)
- [x] FID status reflects the actual implementation state (`converged`: the plan is
      grounded and independently adjudicated, the gate fix is landed, the program
      is not built)

### Loop 2 — Independent audit and self-correction

- **RED:** an independent read-only audit adjudicated the record's eight code-level
  claims against the tree. It PASSED four and FAILED or weakened four.
- **GREEN (corrections applied):**
  1. **Claim 3 FAILED outright and inverted.** The record asserted that the trim
     path "deletes every `cache_control` marker", quoting the comment
     `// Cache up to the last message!` as evidence — the quoted comment was part of
     the error, since `getMessagesSubset` returns its input unchanged and the
     comment describes re-tagging nobody implemented. The real defect is the split
     seam: camelCase `cacheControl` deleted (`trimming.ts:185`) against snake_case
     `cache_control` written (`cache-control.ts:25`), with `savant-code` deleted but
     never written and `openaiCompatible` written but never deleted. Step 8 was
     replaced by step 4 (resolve the seam first) and P4 re-derived to test the
     writer/deleter agreement rather than a flush that the code does not perform.
  2. **Claim 8 weakened.** `fullOutput` is the fixed placeholder
     `'[See cache-debug snapshot / rerun the tool for full output]'`, not a locator,
     and retention depends on cache-debug being enabled under a gitignored `debug/`.
     Step 3 now expects a finding instead of asserting coverage parity.
  3. **Claims 4/5/6 re-worded.** "No TTL value exists anywhere" was literally false
     (an unrelated connectors `ttl` input and `'1h'` duration labels exist), so it is
     now "no provider cache-breakpoint TTL". The "zero matches" evidence lines were
     self-refuting once this record contained the tokens and escape-blind to the
     source document, which writes them escaped; the substance (no implementation
     exists) is retained with that caveat stated.
  4. **Claim 1 precision limit added.** Integer-like keys sort numerically
     regardless of insertion, so reordering moves the hash only for
     non-integer-like string keys — true of every tool-schema key, so the
     conclusion survives.
  5. **Claim 2 strengthened.** The hash pair has a live consumer —
     `token-telemetry.ts` compares consecutive pairs for prefix-stability
     monitoring — which is the measurement path this program needs.
- **AUDIT:** the correction above was verified against the tree directly, not taken
  on the auditor's word: `grep -rn 'cacheControl'` restricted to non-test production
  code returns exactly one line (`trimming.ts:185`), while
  `cache-control.ts:19-25` writes `cache_control` over
  `anthropic|openrouter|openaiCompatible`. `getMessagesSubset` was read 0-EOF and
  returns `messagesSubset` unchanged. All three code blocks in the Evidence section
  are quoted from the current files.
- **ADVERSARIAL:** the surviving risk is that the record's remaining claims rest on
  the same kind of reading that produced the failed one. Mitigation: every claim in
  Evidence now cites `path:line`, the two absolute claims were narrowed to what was
  actually measured, and the claims that could not be tested here (P5, P6, live
  billing) are named as boundaries rather than asserted.
- **CHANGE DELTA:** ~35% of the document rewritten in Loop 2 (Summary, Problem B,
  Evidence retention + cache-control blocks, steps 3/4/8, P4, Missed Question 5,
  Loop 2). Recorded honestly rather than under the 10% heuristic: the delta is
  large because the audit invalidated a load-bearing claim, and shrinking the
  recorded delta would hide exactly the correction that matters.

### Loop 3 — Final convergence

- **RED:** residual risks. (1) The program's central economic claim (up to ~85%
  reduction in repeated input cost) is unmeasured and untestable in this
  environment; it stays a hypothesis with a named falsifier. (2) Steps 5-7 stack on
  the assembly and breakpoint seams, neither of which has been read 0-EOF in this
  pass — Law 4 is owed at implementation, not discharged here. (3) The report
  itself remains untracked and excluded from markdown linting, so its one real
  MD001 defect is recorded, not repaired.
- **GREEN:** the corrections are folded in as listed in Loop 2; status is
  `converged` (Perfection Loop complete, awaiting implementation approval).
  Automation level 3 means the loop and the gate fix were actioned without asking;
  the TTL policy, the ECHO amendments, and the live endpoint work remain
  operator-gated by design.
- **AUDIT:** landed in this pass and verified in place —
  `.markdownlintignore` carries a self-justified entry for the report;
  `scripts/lint-md-check.ts` exists and exits 0; `bun run lint:md` exits 0 with the
  record present; typecheck/eslint/prettier/quality are clean on the changed files.
- **ADVERSARIAL:** the strongest remaining challenge is that a `converged` record
  with two operator-gated steps and two untested pins is not the same as a plan
  ready to execute. Accepted and stated rather than papered over: steps 3-10 stay
  `blocked`, and none of them is claimed as ready.
- **CHANGE DELTA:** see Loop 2 (~35% across Loops 1-2 combined).

## Resolution

- **Closed Date:** not closed
- **Fix Description:** partial — the T154 markdown-gate defect is fixed in-pass
  (`.markdownlintignore` entry + `scripts/lint-md-check.ts`); the cache
  optimization program is re-scoped, independently adjudicated, and preconditioned
  but not implemented.
- **Tests Added:** No (a probe was added, not a test suite)
- **Verification Evidence:** `bun run lint:md` exit 0 (was exit 1 with 108 MD013 +
  1 MD001), `scripts/lint-md-check.ts` exit 0, and a negative leg proving the gate
  still reports a planted wrappable violation. Program steps 3-10 are unstarted.
- **Archived:** not archived

## Lessons Learned

1. An untracked artifact owns a repository gate just as firmly as a tracked one.
   When the only red file is untracked and never committed, the gate is not
   measuring shipped documentation — and the fix belongs in the gate's
   configuration, not in another author's in-flight file.
2. A research report is a claim set, not a specification. Two of this program's
   three phases described work that already ships under different names; only a
   requirement-by-requirement reconciliation against the tree revealed that.
3. Verify the premise you were handed. The report's own Handoff Prompt demanded
   independent verification before implementation, and running it surfaced the
   detector blind spot the report never mentions.
4. A green gate is not evidence until you can make it red. Two planted-violation
   attempts returned exit 0 for unrelated reasons (a missing `seq`, and MD013's
   inability to report an unwrappable line); either would have been reported as
   proof the gate works.
5. A rollback flag named in a design document is not a rollback path.
   `features.deterministic_compiler` appears only in the document that proposes it,
   so a phase gated on it would have been gated on nothing.
6. When a hash detects change, its canonicalization is a correctness property.
   `stableHash` was written to make values serializable, and its order-sensitivity
   was invisible until a consumer needed order-insensitivity.
7. **Quote code, never the comment above it.** The record's load-bearing error came
   from treating a comment (`// Cache up to the last message!`) as evidence of
   behaviour: the next lines only log, and the function returns its input
   unchanged. A nearby comment is the one part of a diff that cannot fail a test.
8. **An audit that agrees with you is worth nothing.** The independent pass
   overturned the record's central hazard claim and weakened four more. The
   hand-off that made it useful was asking for PASS/FAIL per claim with
   `path:line`, not for a review.
