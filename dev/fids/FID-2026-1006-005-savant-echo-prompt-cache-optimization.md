# FID: Savant/ECHO prompt-cache optimization — reconcile an external research plan with the shipped cache stack

**Filename:** `FID-2026-1006-005-savant-echo-prompt-cache-optimization.md`
**ID:** FID-2026-1006-005
**Severity:** medium
**Status:** fixed
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

**Phase 1 (steps 5-6) landed 2026-10-07** — the model-facing tool payload is
canonical at its single assembly seam behind a real rollback flag, and
`normalizeForJson`/`stableHash` are order-canonical, so `toolsHash` moves only
when the tool set really changes. See Loop 4 for the measured before/after.

**Steps 3, 4, 7 and 9 landed 2026-10-07 under the operator ruling** (verbatim:
"approve, grant automation level 3"): the split cache-control seam is now one
spelling over one provider set behind one clearer, the cache-breakpoint TTL is
routed from the run's enforcement mode (Hybrid `5m` / FID-bound `1h`), the Phase-2
coverage audit ran and produced a measured locator finding, and both proposed ECHO
amendments are now law in `ECHO.md`. Steps 8, 10 and 11 remain open — two on a live
endpoint and billing, one on the locator gap the audit measured.

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
3. **DONE (2026-10-07).** Audited Phase 2 coverage: every destructive-truncation
   path in the runtime was enumerated and, per path, MEASURED for recoverability
   (probe: `dev/scratchpad/active/step3-truncation-audit.ts`, gitignored). Outcome
   — a finding, not parity. Every model-facing destructive path drops the payload
   and names no location, in three different marker vocabularies. Measured: a
   60,000-char string returns a 500-char quoted preview with `fullOutput` set to
   the fixed string `'[See cache-debug snapshot / rerun the tool for full
   output]'` — a placeholder naming two possibilities, and cache-debug is off;
   a 3,000-item array returns 2,000 `keptItems` (27,000 chars omitted) and no
   locator; `simplifyReadFileResults` emits `{path, contentOmittedForLength:
   true}` and `simplifyTerminalCommandResults` emits `stdoutOmittedForLength:
   true`, neither carrying a count or a pointer; Layer 4 reactive compact drops
   the middle band beyond the first 10% while preserving first message, last 20%,
   images, preserved-state and protocol-refresh messages. The one place the raw
   bytes actually survive — `evidence/spill.ts` →
   `.savant/evidence/<runId>.jsonl`, bounded at 512 KiB per record and 8 MiB per
   file, fail-open, spliced back only for `requiresRawEvidence` agents — is
   unreachable from any of those markers. Two limits are recorded rather than
   smoothed: the object-shape branch keeps every field by PINNED intent
   (`simplify-tool-results-truncation.test.ts`: "The original object keys are
   preserved alongside the marker"), so a 60,026-char object came back at 60,727
   chars with `omittedChars: 0` alongside `reason: 'output exceeded 50000
   bytes'` — truthful about the input, contradictory-looking as a pair, left as
   pinned rather than rewritten inside this pass; and the `read_subtree` /
   `process-str-replace.ts:25` paths already name their own caps, so they are
   not gaps. The locator gap is the genuine gap and becomes step 11. No second
   spill mechanism is added.
4. **DONE (2026-10-07, commit `f0d365fa`).** Resolved the split cache-control
   seam: one spelling (`cache_control`), one provider set
   (`anthropic|openrouter|openaiCompatible`), one clearer shared by the trim path
   (`clearCacheControlInPlace`, in place) and the clone path
   (`withoutCacheControl`), and the dangling `// Cache up to the last message!`
   comment deleted with its owner named (`convertCbToModelMessages` places the
   breakpoints). RED first: a marker written by the production writer survived the
   trim (exit 1); GREEN after. P4 met by
   `packages/agent-runtime/src/util/__tests__/messages-trim-cache-control.test.ts`.
5. **DONE (this pass, 2026-10-07).** Phase 1a — the model-facing tool payload is
   canonical at its single assembly seam. Law 4 discharged: the seam is
   `run-agent-step/loop-context.ts` (`modelFacingToolSet(applyDriveDirectives(...))`),
   the one production site that both the provider call (`ctx.tools`, consumed by
   `loop-iteration.ts` → `step.ts` → `prompt-agent-stream.ts`) and
   `agentState.toolDefinitions` derive from. The second, independently ordered
   copy of the payload in `run-agent-step/cache-debug.ts` was deleted: it now
   calls the shared `tools/canonical-tool-set.ts#toToolDefinitions`, so
   `toolsHash` hashes what the provider actually received. Rollback flag
   `CANONICAL_TOOL_PAYLOAD` created in `packages/agent-runtime/src/constants.ts`
   (shipped `true`); the report's own `features.deterministic_compiler` still
   does not exist and nothing depends on it.
6. **DONE (this pass, 2026-10-07).** Phase 1b — `normalizeForJson` emits object
   keys in canonical (code-unit) order recursively, in BOTH twins
   (`packages/agent-runtime/src/util/cache-debug-serialize.ts` and
   `common/src/util/cache-debug.ts`), so `stableHash` is order-canonical and
   `toolsHash` changes only on a real payload change. Integer-like keys are
   canonical without a special case (JavaScript enumerates them numerically
   first in every insertion order).
7. **DONE (2026-10-07, commit `7901568f`).** Phase 3a — TTL control at the
   breakpoint seam, with the mode-to-TTL policy approved by the operator ruling
   ("approve, grant automation level 3"): STRICT = ECHO's FID-bound execution →
   `1h`; HYBRID → undefined, leaving today's bytes exactly as they were. The
   report assumed a mode seam that does not exist: `convertCbToModelMessages`
   receives no execution-mode input, so the policy resolves where the mode lives
   (`step.ts` → `resolveCacheBreakpointTtl(agentState.enforcementMode)`) and
   travels as `cacheBreakpointTtl` through `prompt-agent-stream.ts` into the
   conversion — grep-verified end to end. Writing the pin caught a real defect in
   step 4's clearer (a `{ type, ttl }` marker came back as a dangling `{ ttl }`),
   fixed with it. P5's live-wire observation remains the named boundary.
8. Phase 3b — evaluate the Anthropic `tool_addition`/`tool_removal` beta for
   mid-session role handoffs. Absent today; needs a live endpoint test before it
   can be claimed, and the report's own falsifier (physical node routing that does
   not share cache pools) must be tested rather than assumed away. **NOT STARTED,
   and the operator's 2026-10-07 ruling does not clear it**: the only real evidence
   is a captured wire body, so this is blocked on a live endpoint rather than on
   permission.
9. **DONE (2026-10-07).** Both proposed ECHO amendments were submitted to the
   operator and approved (ruling: "approve, grant automation level 3"), then
   landed in `ECHO.md`: **`#### Law 1 Amendment — Spill-File Authorization`** in
   the Laws 1-4 section authorizes offloading a bulk system output to a local spill
   file behind an explicit marker, names its boundaries (the marker substitutes for
   the spilled payload only; the spill file is itself read 0-EOF once it is acted on
   rather than cited; every other file still requires Law 1) and records that the
   spill is append-only and fail-open at
   `packages/agent-runtime/src/evidence/spill.ts`; **`#### Tool-Array Serialization
   is Deterministic`** in the Separation of Duties section requires the model-facing
   tool array to keep ONE canonical form at ONE seam behind `CANONICAL_TOOL_PAYLOAD`
   and requires mid-session tool restriction to happen by phase-specific
   activation/deactivation rather than by reconstructing the core registry array.
   The embedded bundle was regenerated and both gates exit 0:
   `bun run generate:protocol-bundle:check` and
   `bun run scripts/lint-md-check.ts`.
10. Measure: use the existing `debug/cache-debug/` snapshots and the
    `token-telemetry` prefix-stability comparisons to measure `systemHash` /
    `toolsHash` stability and cache read/token ratios before and after, against
    the report's own Approval Point 3 (>75% hit ratio on multi-turn FID loops).
    Live provider billing measurement is a named boundary, not a claim. **NOT
    STARTED and not startable in this environment**: `debug/cache-debug/` does not
    exist, no committed artifact carries a hash pair, and
    `CACHE_DEBUG_FULL_LOGGING` is `false` — measured in Loop 4, not assumed. The
    instrument-level before/after already ran there on a corpus this pass
    generated; the hit-ratio claim needs live traffic and live billing.
11. **Open — the locator gap step 3 measured.** Give the omission marker ONE
    honest, locatable vocabulary that names the retention that actually exists —
    the per-run evidence spill record keyed by `toolCallId`
    (`.savant/evidence/<runId>.jsonl`) — instead of a placeholder naming two
    possibilities, and unify the three spellings (`truncated.fullOutput`,
    `contentOmittedForLength`, `stdoutOmittedForLength`) behind it. The marker
    function receives only the VALUE today, so this is a wiring change (the
    `toolCallId` lives on the message in `util/messages/trimming.ts`), not a
    string change, and it re-keys a contract pinned across the whole verbose tool
    set — which is why it is specified here as its own step rather than folded
    into step 3's audit. **No second spill mechanism is introduced**: the fix
    points at the spill that ships. Two invariants for whoever lands it: a marker
    must never claim a location the caller cannot compute, and a record above
    either spill cap must say so rather than silently returning `false`.

### Verification

- **P1** `bun run scripts/lint-md-check.ts` exits 0, and the gate is proven
  load-bearing by the planted-file negative leg (before removal and after).
- **P2** MET. Two tool sets differing only in key insertion order serialize to
  byte-identical payloads through the production assembly seam
  (`toToolDefinitions(modelFacingToolSet(x))` — the seam code itself, not a
  mirror). RED proven first on the unmodified tree: the same comparison returned
  `false` (see Loop 4).
- **P3** MET. `stableHash` of a reordered tool set equals the original
  (recursively, including nested schema keys); `stableHash` of a genuinely changed
  tool set — description edit or a dropped tool — still differs, so the detector
  is order-blind, not change-blind. RED proven first on the unmodified tree: both
  reorder cases produced different hashes (see Loop 4).
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

**P8** MET for the audit half. Step 3's coverage claim is a measurement, not a
reading: `dev/scratchpad/active/step3-truncation-audit.ts` drove the SHIPPED
truncation functions over five payload shapes, and every number in step 3 is that
probe's output. The locator gap it found stays open as step 11 rather than being
reported as parity.

**P9** MET. Both operator-approved amendments are in `ECHO.md`, and the embedded
bundle that ships them is in sync: `bun run generate:protocol-bundle:check` exit 0
and `bun run scripts/protocol-bundle-check.ts` exit 0, with `bun run
scripts/lint-md-check.ts` exit 0 over the edited document.

Scope of the declared gates: they cover what this pass actually changed — the
cache-control seam, the TTL route, the tool payload, the markdown gate fix, the
landed amendments and their bundle. Steps 8, 10 and 11 declare their own gates
when they land; the record stays active until then. The probe re-enters
`lint:md`, never `validate:repository`, so it is not the C3 recursion the template
warns about — and it must never be extended to run `validate:repository`.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: test packages/agent-runtime/src/__tests__/tool-payload-canonical.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/messages-trim-cache-control.test.ts
- gate: probe scripts/lint-md-check.ts
- gate: probe scripts/protocol-bundle-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b045153acd4871beb35b8039d3a0433f66e2d2f7df6a470e3d7fb3b0f3450a2b
- verified: 2026-10-07T17:23:48.741Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- test packages/agent-runtime/src/__tests__/tool-payload-canonical.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/messages-trim-cache-control.test.ts: exit 0
- probe scripts/lint-md-check.ts: exit 0
- probe scripts/protocol-bundle-check.ts: exit 0
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
8. **Is there really a "single assembly seam" for the model-facing tool payload?**
   The step-5 wording assumed it. Law 4 was discharged at implementation and the
   answer was *no*: `loop-context.ts` recorded `toolDefinitions` while
   `run-agent-step/cache-debug.ts` rebuilt its own copy from the same `ToolSet`.
   The seam is the point where `effectiveTools` is finalized; both derivations now
   go through one function, and the second copy is deleted rather than sorted in
   parallel.
9. **Was there any snapshot corpus to measure from?** No, and the step was written
   as though there was. `debug/cache-debug/` does not exist, no committed file
   carries a hash pair, and `CACHE_DEBUG_FULL_LOGGING` is `false`. The measurement
   was therefore run against a corpus this pass generated with the production
   writer, and reported as such — an instrument measurement, not a live cache-hit
   ratio.
10. **Does canonicalizing the hash input cost a cache?** Yes, once. Every recorded
    `toolsHash` changes at rollout (`de7cf68e` → `005c1a82` on the fixture) because
    the serialized bytes change. Stated so the one-time prefix invalidation is not
    later misread as a regression the monitor should have caught.

### Implementation Evidence (REQUIRED for `closed`)

> Not closable: the program is not complete — steps 8, 10 and 11 remain. Steps
> 1-7 and 9 are implemented, verified, and committed (`ba4dee65`, `f0d365fa`,
> `7901568f`, plus this pass's amendment commit); the operator's 2026-10-07 ruling
> cleared the approval points this record was waiting on, so what remains is work
> (step 11) and environment (steps 8 and 10), not permission.

- [ ] **Commit SHA:** partial — `ba4dee65` (Phase 1), `f0d365fa` (step 4),
      `7901568f` (step 7), plus this pass's commit for steps 3 and 9; the record
      stays active until steps 8, 10 and 11 land
- [x] **File:line ranges:** see Loop 4 and the Code Verification Evidence block
- [x] **Gate output:** both declared typechecks, both declared tests
      (`tool-payload-canonical.test.ts`,
      `messages-trim-cache-control.test.ts`), the lint-md probe, the
      protocol-bundle probe, and quality all exit 0 at the stamped receipt
- [x] **Reproducibility:** `grep -n 'Savant_ECHO Cache Optimization Research' .markdownlintignore`
      and      `bun run dev/scratchpad/active/cache-prefix-stability-measure.ts`
      (gitignored harness; reproduces the Loop 4 before/after table) and
      `bun run dev/scratchpad/active/step3-truncation-audit.ts` (gitignored probe;
      reproduces every number in step 3)
- [ ] **Step statuses:** steps 1-9 `implemented`/verified except 8, 10 and 11 —
      step 8 (`tool_addition`/`tool_removal`) `blocked` on a live endpoint, step 10
      (the live hit-ratio measurement) `blocked` on a live endpoint and provider
      billing, and step 11 (the locator gap step 3 measured) `open`. No step is
      waiting on an operator decision: the 2026-10-07 ruling cleared the approval
      points this record was held at.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (steps 1-2 and 5-6)
- [x] Typecheck/tests/lint pass with pasted tool output (`typecheck
      packages/agent-runtime`, `typecheck common`, the new
      `tool-payload-canonical.test.ts`, the `lint-md-check.ts` probe, quality —
      all exit 0 at the stamped receipt; `bun run --cwd=packages/agent-runtime
      test` 1861 pass / 0 fail, `--cwd=common` 813 pass / 0 fail, `--cwd=sdk`
      664 pass / 0 fail, and the root `test` chain exit 0)
- [x] Production call-graph evidence is present for new or repaired wiring. The
      seam is `loop-context.ts` → `tools/canonical-tool-set.ts`; the provider leg
      is `ctx.tools` → `loop-iteration.ts:43` → `llm-step-phase.ts:50` →
      `step.ts:121` → `prompt-agent-stream.ts` (`tools: ToolSet`), and the
      recorded leg is `initialAgentState.toolDefinitions` (`loop-context.ts`),
      with the cache-debug snapshot reading through the same derivation
      (`run-agent-step/cache-debug.ts`). No second assembly site remains.
- [x] FID status reflects the actual implementation state (`fixed`: Phase 1 is
      built and verified; the rest of the program is not built and stays blocked)

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

### Loop 4 — Phase 1a/1b implementation (steps 5-6), 2026-10-07

- **RED (measured on the unmodified tree, before any edit in this pass):** a
  harness drove the PRODUCTION path — `createCacheDebugSnapshot` →
  `loadCacheDebugSnapshotHashPair` → `CacheHitRateMonitor.onPrefixStability` —
  over three fixture pairs: two tool sets differing only in key insertion order,
  two differing only in nested schema-key order, and one genuinely changed
  (description edited). Result: `toolsHash` changed in 2/2 reorder-only cases and
  the live consumer raised the prefix-stability warning in both, indistinguishable
  from the genuine change. The seam comparison
  (`JSON.stringify(derivedPayload(a)) === JSON.stringify(derivedPayload(b))`)
  returned `false` for both reorder-only cases.
- **GREEN (measured after the change, same harness, same fixtures):** 0/2
  reorder-only cases move `toolsHash`, 0 warnings; the genuine change still moves
  the hash and still warns (1/1) — the detector lost its false positives, not its
  teeth. The seam payloads are byte-identical for the reorder-only tool-set case.
- **AUDIT:** the Loop 4 numbers were produced by the same script run twice against
  the real modules, not by two hand-written expectations. `stableHash` of the
  ordered fixture moved `de7cf68e` → `005c1a82`: canonicalizing the hash input
  changes every recorded `toolsHash` exactly once, at rollout, which is the
  expected one-time prefix change and worth knowing before it appears in a diff.
  Suite covers: agent-runtime 1861 pass / 0 fail (was 1852, +9 new tests), common
  813 pass / 0 fail, sdk 664 pass / 0 fail, root `test` chain exit 0 — reordering
  the model-facing tool set broke no request-body or prompt assertion in the tree.
- **ADVERSARIAL (limits stated, not papered over):**
  1. **The measured corpus did not exist.** `debug/cache-debug/` is absent, no
     committed artifact contains a `systemHash`/`toolsHash` pair,
     `CACHE_DEBUG_FULL_LOGGING` is `false`, and the `scripts/compare-cache-debug.ts`
     referenced by `constants.ts` was never written. So "measure from the existing
     snapshots" had no corpus to read: this pass GENERATED one with the production
     writer into a temp projectRoot. The numbers above are therefore a controlled
     before/after of the instrument, not a measurement of cached-token ratios on a
     real multi-turn run — those remain step 10 and still need live traffic.
  2. **Nested schema-key order is canonicalized at the HASH layer only.** The seam
     sorts tool NAMES; keys inside a tool's `inputSchema` are hashed canonically
     (step 6) but are not rewritten in the model-facing bytes. That is the right
     boundary — schemas come from the deterministic Zod→JSON-Schema conversion, and
     at this seam `inputSchema` is frequently a Zod instance that must not be
     key-sorted — but it is a real asymmetry and the harness row records it
     (`payloadIdentical` false for that case).
  3. **The reorder this fixes is not a known live incident.** No evidence was
     produced that production assembly actually reorders tools today; the defect is
     that the instrument could not tell reorder from change, and the payload had no
     canonical form. Step 5's practical value is the guarantee, not an observed
     outage.
- **CHANGE DELTA:** Phase 1 rows of Steps, Verification P2/P3, the gates block,
  Loop 4, the two Evidence blocks, Missed Questions 8-10 and Resolution. Steps 3,
  4 and 7-10 are untouched.

### Loop 5 — steps 4 and 7 under the operator's ruling (2026-10-07)

- **RED:** the operator's ruling ("approve, grant automation level 3") cleared
  the two approval points this record was gated on, so steps 4 and 7 were
  actioned. Step 4's RED was measured first on the unmodified tree: a marker
  written by `withCacheControl` survived `getMessagesSubset` untouched
  (`{ type: 'ephemeral' }` where `undefined` was expected), which is the split
  seam reproducing as a test failure rather than as a reading.
- **GREEN:** one provider set and one clearer (`clearCacheControlInPlace` / the
  clone path / the writer all read the same list); the trim path calls the shared
  clearer instead of deleting a spelling nothing writes; the dangling comment is
  gone with its owner named. Then the TTL: the policy resolves in `step.ts` from
  the run's own enforcement axis and travels the stream-params chain into the
  conversion, HYBRID emitting no `ttl` key at all so an existing request body is
  unchanged by the step.
- **AUDIT:** the pins are the audit here, and they found something: the TTL case
  exposed that the new clearer deleted only the marker's `type` key, returning a
  `{ type: 'ephemeral', ttl: '1h' }` marker as a dangling `{ ttl: '1h' }` — a
  partially-cleared breakpoint that still reaches the provider. Fixed, then
  re-pinned. Live battery this pass: typecheck common / packages/agent-runtime /
  sdk / cli exit 0; the pin file 5 pass / 0 fail; common 813 pass / 4 skip / 0
  fail; packages/agent-runtime 1873 pass / 0 fail (was 1868);
  `module-state: PASS`; `scope-register PASS`; `validate:repository` PASS.
- **ADVERSARIAL:** two limits are stated rather than smoothed. (1) P5 is still
  unproven: that the 1h TTL reaches the wire can only be observed on a live
  endpoint, so what is verified here is that the resolved value reaches the
  marker the request body is built from. (2) The three auxiliary call sites that
  pass `includeCacheControl` for structured prompts do not yet thread the TTL, so
  those requests keep the provider default — a smaller surface than the main
  loop, named here rather than implied to be covered.
- **CHANGE DELTA:** two seams settled, one defect found by the pin that was
  written to guard the first, and the record's step statuses.

### Loop 6 — steps 3 and 9 under the same ruling (2026-10-07)

- **RED:** the two remaining landable steps were both audits, not builds, so the
  RED phase is the measurement that preceded any conclusion. Step 3's premise ("the
  marker's `fullOutput` is a placeholder") was re-tested against the shipped
  functions instead of re-read: a 60,000-char string, a 3,000-item array, a
  3,000-line string, an over-cap object and a nested search-shape object. Step 9's
  premise was that the report's two amendments do not exist in `ECHO.md` — they did
  not.
- **GREEN:** the amendments landed in `ECHO.md` and the embedded bundle was
  regenerated. Step 3's audit closed with the finding written down INSTEAD of the
  parity the report assumed, and the one genuine gap it found became step 11 with
  its invariants stated, rather than a silent note.
- **AUDIT:** the audit numbers are the probe's output, and the amendment landing is
  checked by gates rather than by reading: `generate:protocol-bundle:check` exit 0,
  `scripts/protocol-bundle-check.ts` exit 0, `scripts/lint-md-check.ts` exit 0,
  `prettier --check ECHO.md` exit 0, and the condensation validator inside the
  generator (`validateCondensedCopies`) still anchors every condensed line to its
  `ECHO.md` source, so adding two subsections did not drift the copies that ship in
  prompts.
- **ADVERSARIAL (limits stated, not smoothed):** three are recorded rather than
  argued away. (1) Step 3's audit found that the object-shape branch reports
  `omittedChars: 0` alongside a byte-cap reason — but that branch's field-preserving
  behaviour is PINNED by an existing test, so it is recorded as a
  contradictory-looking truthful pair rather than rewritten inside an audit step; a
  reviewer who disagrees with the pin has the test to argue with. (2) The step-3
  probe lives in the gitignored scratchpad, so its numbers are reproducible but not
  committed evidence — the FID carries the numbers and the probe's path. (3) The
  `tool_addition`/`tool_removal` half of step 8 and the whole of step 10 remain
  unobservable here; the amendments landing does not move either.
- **CHANGE DELTA:** two steps closed, one new step opened from a measured finding,
  one amendment pair added to `ECHO.md`.

## Resolution

- **Closed Date:** not closed
- **Fix Description:** partial — the T154 markdown-gate defect is fixed in-pass
  (`.markdownlintignore` entry + `scripts/lint-md-check.ts`), Phase 1 is built
  (canonical model-facing tool payload behind `CANONICAL_TOOL_PAYLOAD`, with
  `normalizeForJson` / `stableHash` order-canonical in both twins so `toolsHash`
  moves only on a real payload change), **step 4** unified the split
  cache-control seam to one spelling, one provider set and one clearer, **step 7**
  routes the operator-approved mode-to-TTL policy from
  `agentState.enforcementMode` to the breakpoint bytes, **step 3** audited
  Phase-2 coverage and produced a measured locator finding, and **step 9** landed
  both operator-approved ECHO amendments in `ECHO.md` with the embedded bundle
  regenerated. Steps 8, 10 and 11 remain: the Anthropic tool-mutation betas (the
  live-wire half is a named environmental boundary), the live-billing
  measurement (same boundary), and the locator gap step 3 measured.
- **Tests Added:** Yes — `packages/agent-runtime/src/__tests__/tool-payload-canonical.test.ts`
  (9 tests): canonical seam ordering, byte-identical payloads across insertion
  orders, recursive `stableHash` order-insensitivity, a still-detects-real-change
  negative leg, and two snapshot-level cases through
  `createCacheDebugSnapshot` → `loadCacheDebugSnapshotHashPair` →
  `CacheHitRateMonitor.onPrefixStability`.
- **Verification Evidence:** `bun run lint:md` exit 0 (was exit 1 with 108 MD013 +
  1 MD001), `scripts/lint-md-check.ts` exit 0 with a negative leg proving the gate
  still reports a planted wrappable violation; `typecheck packages/agent-runtime`
  and `typecheck common` exit 0; the new test 9 pass / 0 fail; agent-runtime 1861
  pass / 0 fail (was 1852); common 813 / 0; sdk 664 / 0; root `test` chain exit 0;
  prettier/eslint clean on all touched files. Before/after harness numbers are in
  Loop 4: 2/2 spurious `toolsHash` fractures and warnings removed, the genuine
  change still detected. Steps 3, 4, 7 and 9 are now done (2026-10-07); steps 8,
  10 and 11 are open, the first two on a live endpoint and provider billing, the
  third on the locator gap step 3 measured.
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
