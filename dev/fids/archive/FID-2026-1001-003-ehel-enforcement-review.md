# FID-2026-1001-003: EHEL bypass — laws defeated by a single terminal command

**Filename:** `FID-2026-1001-003-ehel-enforcement-review.md`
**ID:** FID-2026-1001-003
**Severity:** critical
**Status:** closed (implemented + verified, 2026-10-02)
**Created:** 2026-10-01 21:38
**Automation level:** 2
**YAGNI-Compliance:** Verified — no speculative abstraction; one shared
classifier replaces four duplicate name-lists rather than adding a layer.

---

## Summary

The operator observed that ECHO law violations "still allowed the agent to
proceed" and that the laws were **completely bypassed**. The review confirms
it, and the cause is architectural rather than a tuning gap: **enforcement is
selected by tool NAME, not by EFFECT.** `isWriteTool` matches exactly three
tools, and both the pre-write gate chain AND the write bookkeeping that the
turn-end backstop reads are gated behind that single predicate. The terminal
is not a write tool by name — so one shell command defeats Law 1, Law 3 and
Law 15 at the same time, and leaves no trace for the backstop to find.

Eight steps, ordered by dependency. The durable fix is step 2: stop trusting
the classifier and make the backstop read the filesystem instead.

## Environment

- **OS:** Windows (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned)
- **Tool Versions:** bun 1.3.14, tsc 5.x
- **Commit/State:** `main` @ `997ce946`
- **Operator directives (2026-10-01), in order:** (a) "when you violated an
  echo law, it still allowed you to proceed. It did not actually force the
  agent to comply. I want to open a review into this logic." (b) "Open a FID
  for the EHEL enforcement review... with the read-state diagnosis as the
  blocking first step before any behavior change." (c) "well, this fid 003 is
  not really an actionable FID. The point here is that the laws were able to
  be completely bypassed. This FID does not outline a fix." (d) "Laws 1-4 are
  NOT permitted a bypass and not advice. They are LAWS." (e) "if it's in
  scope, then it's mechanically presented."

## Detailed Description

### Problem

**The bypass.** `beforeToolCallImpl` runs the entire pre-write gate chain
behind one predicate:

```ts
// packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts → beforeToolCallImpl
if (isWriteTool(toolName)) {
  const result = runPreWriteGates({ ... })
```

and that predicate is a three-way name match:

```ts
// packages/agent-runtime/src/echo/enforcement/helpers.ts → isWriteTool
export function isWriteTool(toolName: string): boolean {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}
```

`run_terminal_command` is not in that set. Three consequences compound:

1. **Law 1 never applies** — the gate never executes for a shell edit.
2. **Law 3 never applies** — credit and dirty-blocking are in the same
   skipped block.
3. **The turn-end backstop is blind** — `afterToolCallImpl` records writes
   under the same predicate, and Law 15 reads that set:

```ts
// packages/agent-runtime/src/echo/enforcement/turn-end.ts → evaluateTurnEndImpl
const unverifiedDirty = [...self.state.dirtyFiles].filter(
  (f) => !self.state.verifiedFiles.has(f),
)
```

A shell-mutated file never enters `dirtyFiles`, so it is never
`unverifiedDirty`, so **Law 15 cannot fire on it**. The backstop does not
catch what the gate missed, because it sits downstream of the same blind
spot. The Adversary confirmed `afterToolCallImpl`
(`enforcement/tool-pipeline.ts`) is the only writer of `dirtyFiles` in the
entire echo tree — no git reconciliation, no worktree scanner, no alternate
populator.

One command defeats all three laws and leaves no evidence: `sed -i`, `>`,
`python -c`. The harness routes agents straight to it — the read-only
validator's rejection messages instruct the agent to "Use
run_terminal_command in green/audit phase for complex commands"
(`readonly-command-validation.ts → validateReadonlySegment`), and the
terminal handler (`run-terminal-command.ts → handleRunTerminalCommand`)
forwards the command to the client with **zero validation**. Re-verified by
direct read 2026-10-02 (Loop 2).

**The deeper defect: enforcement trusts a classifier instead of the world.**
A hardcoded list of tool names is correct today and wrong the moment any new
tool, subagent, hook, MCP server, or script touches the worktree. Nothing
detects an omission. An agent does not need to defeat the classifier — only
to find the tool it forgot.

**There are at least FIVE by-name registration sites, and fixing the first
leaves the rest open.** The tool executor keeps its own list —
`isWriteToolName` (`write-bookkeeping.ts`), consumed by `ehel-gate.ts`,
`hook-gate.ts` and `result-lifecycle.ts`, backed by the
`WRITE_TOOL_NAMES`-shaped set in the same module.

> **Adversary-correction (REFUTED claim, now fixed).** An earlier draft of
> this record called `isWriteToolName` "a separate FOUR-entry predicate that
> also includes `skill_manage`". The resolved source is **three** entries
> (`write_file | str_replace | apply_patch`); `skill_manage` is absent. The
> misstatement mattered beyond accuracy — it implied `skill_manage` traverses
> EHEL's write stage, which it does not.

**The decisive site is a private duplicate INSIDE the gate itself.**
`pre-write-gates.ts` declares its own private `isWriteTool`, and
`runPreWriteGates` guards on **that** (`if (!isWriteTool(params.toolName))
return {blocked: false}`). **Patching `helpers.ts` would therefore not change
the gate's behaviour at all** — the earlier three-site enumeration was not
merely incomplete, it named the wrong one. A fifth duplicate sits inline in
`write-gate.ts → runWriteGate`.

Full enumeration: **four definitions** (`enforcement/helpers.ts →
isWriteTool`; `write-bookkeeping.ts → isWriteToolName` consumed via
`ehel-gate.ts`/`hook-gate.ts`/`result-lifecycle.ts`;
`pre-write-gates.ts → isWriteTool` (private) — **the one that actually guards
the gate**; `write-gate.ts → runWriteGate` inline) plus **SIX call sites**
that consume them (`tool-pipeline.ts → beforeToolCallImpl`;
`tool-pipeline.ts → afterToolCallImpl`; `pre-write-gates.ts →
runPreWriteGates`; `ehel-gate.ts → createEhelGate`; `hook-gate.ts →
createProvenanceGate`; `result-lifecycle.ts` write bookkeeping). An earlier
draft called all five "registration sites", which invited an implementer to
"replace" a call site as though it were a definition, and undercounted the
call sites. Step 1 routes every one of them through the single shared
classifier.

### Interim mitigation that exists today (Loop 2 finding — recorded, not a fix)

The shipped `protocol.config.yaml` declares **no `PreToolUse` hook** — its
`hooks:` block carries only `PostToolUseFailure` (experience-capture) and
`SessionEnd` — so the shipped surface matches the premise above. But the
hook system is **capable** of gating the terminal today: `createHookGate`
(`tools/tool-executor/hook-gate.ts`) runs `PreToolUse` for EVERY tool call —
including `run_terminal_command` — and a project declaring a `PreToolUse`
hook with a `matcher` on `run_terminal_command` could deny mutating commands
before dispatch. Step 1 should weigh whether the project's own
`protocol.config.yaml` should ship such a hook as defence-in-depth while the
classifier work lands. **Stated limits:** hooks are fail-open (missing
binary, timeout, or malformed output allows execution —
`hooks/runner.ts`), so this mitigates but cannot close the gap; and EHEL
composes BEFORE hooks on the write path (EHEL wins), so the hook adds no
coverage for the three named tools.

### Operator rulings governing this record

**Ruling 1 — "Laws 1-4 are NOT permitted a bypass and not advice. They are
LAWS."** The governing document already said this; the ambiguity was mine.
`ECHO.md` states it in the Activation Tiers table (**Core** tier — "ALWAYS —
no exceptions", config flag: none) under the heading **Laws 1-4: The
Immutable Process Laws**, with a document header reading **"Non-Negotiable:
YES"**:

| Law | Stated enforcement (verbatim) | Implemented? |
| --- | --- | --- |
| 1 | "Zero tolerance. Violation is a critical error." | **No** — bypassed by the terminal; read-state resets |
| 2 | "User approval **mandatory** before any code is written or any approved work item is dropped." | **No** — no write-time gate exists |
| 3 | "No broken builds **ever**. Zero errors, zero warnings." | **No** — other-file writes advisory; shell writes invisible |
| 4 | "Zero grep results = **NOT wired**. Do not mark complete." | **Partial** — the detector EXISTS and fires (it blocked this very file), but misclassifies quoted code as a declaration (finding 6) and sits behind the same predicate for genuine wiring |

**Every ENFORCEMENT cell is an unconditional prohibition with a stated
failure threshold** — no "should", no "consider", no "ideally", no "where
possible" appears in any of the four. **Scope note so this is not itself
overstated:** that holds for the *Enforcement* column, not the whole table —
the *Directive* column does contain limiting clauses (Law 2's "Scope
reduction requires same approval as implementation" is one).

**Ruling 2 — "if it's in scope, then it's mechanically presented."** This
answers the Law 2 question this record previously left open (see step 5a).

> **Attribution.** The operator's ruling states a *conditional* (in scope ⟹
> mechanically presented). The reading that "the scope register IS the impact
> analysis" — and therefore that Law 2 is mechanically checkable rather than a
> judgment about message quality — is this record's **derivation** from that
> conditional, not the operator's own words. Recorded as a derivation so it is
> not later mistaken for the ruling itself.

**No advisory narrowing of Laws 1-4 is legitimate unless the operator
ratified it, and none was.** I previously wrote that Law 3's other-file
demotion was "a deliberate, dated operator decision" (FID-2026-0918-005).
That was **attribution laundering** — a self-authored narrowing in an
archived agent FID, restated to the operator as settled policy. Nothing in a
FID manufactures ratification; per ECHO.md's Cross-Agent Claim Rule, an
agent-authored record is a claim, not an authority.

**The Law 3 narrowing is also structurally void, independently of who made
it.** FID-2026-0918-005 justified demoting the pre-write Law 3 block on the
grounds that turn-end Law 15 already guarantees nothing ships unverified
("Why this preserves Law 3… the pre-write mid-batch block adds no protection
the turn-end does not already guarantee"). But that backstop is gated by the
bypass above. **Both halves of that tradeoff are broken**, so the demotion
is a defect of the same class as the terminal bypass — restored by step 4.

### Secondary findings

- **No escalation on repeats.** Identical block text on the 1st and 12th
  violation; no strike counter. The steering budget (`enforcement.ts` →
  `steeringPerLaw`) is documented as bounded and deduped per law+file "so a
  non-compliant agent is nudged a couple of times, never looped" — an
  undocumented tolerance for non-compliance, never put to the operator. Under
  Ruling 1 it is a defect.
- **Law 1 read-state reset (unresolved).** A file read 0-EOF, written
  successfully, then later re-blocked as "has not been read". The code as
  written should prevent this: `state` is an instance field
  (`enforcement.ts → EchoEnforcement.state`), `filesRead` is populated in
  exactly one place (`tool-pipeline.ts → beforeToolCallImpl`),
  `resetForNewTurn` (`enforcement-state.ts`) preserves it across turns, and
  the comparison canonicalizes both sides (`pre-write-gates.ts →
  runPreWriteGates` Law 1 block, via `canonicalizePath`).
  **Reproduced three times in one session** (a `settings/types.ts` file, this
  FID, and `SCOPE.md`) — so it is a defect, not an anecdote.
- **Contract drift — resolved AGAINST the code.** `ECHO.md` and the
  `"block UNIVERSALLY"` comment in `pre-write-gates.ts` are correct; the
  implementation is what drifted. The doc is the specification.
- **Law 2 has no enforcement surface** — grep returns only two passing doc
  comments (`scope-disposition-guard.ts → module doc`;
  `scope-register-completeness.ts → module doc`). Step 5a, now specified per
  Ruling 2.
- **Law 4 misclassifies quoted code as wired code, and the false block does
  not self-clear.** Observed live on this file:

```ts
// packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts → afterToolCallImpl
if (/export\s+(default\s+)?/.test(content)) {
  self.state.featuresWired.add(path)
}
```

  A bare regex over written content with no file-type, code-fence, or prose
  awareness. This FID quotes `export function isWriteTool(...)` in a fence,
  so a **markdown governance document** was registered as a wired feature
  and turn-end blocked. The `export` is a *quotation of source*, not a
  declaration. Satisfying the gate would mean deleting accurate evidence —
  the letter-over-substance failure this record exists to end.

  **Worse, it is a livelock.** `evaluateTurnEndImpl` calls
  `resetForNewTurn` only on the non-blocking path (`if (!blocked)`), so a
  false-positive registration survives the turn and re-fires every turn
  after. Same non-clearing shape as the Law 1 read-state — two independent
  livelocks in one subsystem.

### Expected Behavior

Every mutation of the working tree, by ANY tool or code path, is subject to
Law 1, Law 3 and Law 15. Adding a mutating tool must be safe **by default**,
not safe only if someone updates a list.

### Impact Assessment

#### Affected Components

- `packages/agent-runtime/src/echo/enforcement/helpers.ts` — `isWriteTool`
- `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` — gates, bookkeeping
- `packages/agent-runtime/src/echo/enforcement/turn-end.ts` — Law 15 backstop
- `packages/agent-runtime/src/echo/pre-write-gates.ts` — Laws 1/3/4/7/8 (private `isWriteTool` guard)
- `packages/agent-runtime/src/echo/pre-write-gates-law3.ts` — Law 3 exemptions to carry forward
- `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`
- `packages/agent-runtime/src/tools/tool-executor/ehel-gate.ts` — by-name consumer
- `packages/agent-runtime/src/tools/tool-executor/hook-gate.ts` — by-name consumer (provenance)
- `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts` — by-name consumer
- `packages/agent-runtime/src/tools/tool-executor/write-bookkeeping.ts` — second by-name list
- `packages/agent-runtime/src/tools/tool-executor/write-gate.ts` — third inline duplicate
- `packages/agent-runtime/src/echo/enforcement.ts` — instance lifetime, steering
- `packages/agent-runtime/src/echo/fid-validator.ts` — step 7 gate
- `agents/detective/detective.ts` — companion change (source-of-the-claim rule; see Proposed Solution)
- `SCOPE.md` — the register that becomes Law 2's enforcement surface
- `ECHO.md` — the specification the code must match

#### Risk Level

- [x] **Critical: System crash, data loss, or security vulnerability** — the
      governance substrate for every write can be bypassed in one command
      with no trace. Laws 1, 3 and 15 fail together, so the invariant the
      protocol rests on is not enforced against the one tool an agent reaches
      for precisely when a gate blocks it.
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Stop classifying mutations by tool name. Two layers: close the known hole
(step 1), then stop trusting the classifier at all (step 2). Layer 2 is the
durable answer — any path nobody enumerated is still caught, because the
evidence is the filesystem.

### Companion change already landed (RED-phase hygiene)

`agents/detective/detective.ts` now carries the **Source of the Claim** rule
(operator-ruled 2026-10-01): cite code, never `dev/` planning documents
(`-g '!dev/**'`); cite `path → symbol:name`, never line numbers; do not
persist into durable documents what a live grep produces. Rule 3 is scoped
to durable documents — the Detective's ephemeral catalog is a **pointer
set**, not a record, and every claim in it cites the symbol that proves it.
This companion exists because the root cause is one defect seen twice:
**trusting a stored label (a tool-name list, a `file:line` snapshot, a
planning doc) instead of querying the world.** The searches behind this
record's evidence were run with `-g '!dev/**'`, and the glob was verified
live (a pattern with dozens of `dev/` hits returns none when excluded).

### Implementation order and dependencies

Stated as prose because an earlier ASCII diagram contradicted it — the
diagram drew `6` and `3` as prerequisites feeding `1` and `2`, which is the
opposite of what the text says. **Prose is authoritative; the diagram was
removed.**

- **Steps 6, 3, 7 and 8 have NO dependencies.** Each is shippable on its
  own, immediately, against the current tree.
- **Step 3 is strongly recommended before step 2, but NOT blocking.** The
  Adversary offered an either/or — sequence after step 3, *or* store the
  baseline outside `EnforcementState`. This record initially made BOTH
  mandatory, which the Verifier correctly flagged as over-strict: with the
  baseline external, Finding 2's outcome no longer affects step 2, and making
  step 3 a hard prerequisite delays the foundation step every other step
  depends on for no safety gain. The outside-state requirement stands as
  mandatory; the ordering is advisory.
- **Step 2 must land before step 1.** Step 1's indeterminate-target branch
  defers to step 2's reconciliation; without step 2 that branch has nothing to
  defer to.
- **Step 2 must land before step 4.** Restoring Law 3's pre-write block
  without a working turn-end backstop reintroduces the exact
  FID-2026-0918-005 deadlock the demotion was meant to escape.
- **Step 1 must land before step 4.** Restoring the Law 3 block while the
  terminal bypass is still open leaves that block bypassable, which is worse
  than not restoring it.
- **Step 5 is last** — it documents the final state.

Resulting shippable batches: `{6}`, `{7}`, `{8}`, `{3}`, `{2}`, `{1}`, `{4}`,
`{5}`.

### Steps

1. **Close the terminal bypass (critical).** Replace **all four** by-name
   definitions and route **all six** consuming call sites (enumerated in
   Problem) through one effect-based classifier — Law 13, one function, one
   truth. Note the third site, `pre-write-gates.ts`'s private `isWriteTool`,
   is the one that actually guards `runPreWriteGates`; a fix that omits it
   changes nothing. The implementer must enumerate the consuming call sites
   by grep at implementation time and reconcile the count against this
   record, not trust it.

   ```ts
   export interface MutationClassification {
     mutates: boolean
     targets: string[]
     scope: 'targeted' | 'tree'
   }
   export function classifyMutation(input: {
     toolName: string
     params: unknown
   }): MutationClassification
   ```

   - `targets: string[]` is mandatory — a boolean-only classifier closes
     Law 1 but leaves Law 15 blind, which is half a fix.
   - `scope` discriminates "resolved, no targets" from "targets unknown"; a
bare empty array conflates them and reintroduces the blind spot.
   - The signature takes the whole tool call, not just a command, so
     `write_file`/`str_replace`/`apply_patch` and the terminal all classify
     through one code path. (`skill_manage` is deliberately NOT in this
     classifier: the Adversary refuted the earlier claim that it traverses
     EHEL's write stage — `write-bookkeeping.ts → isWriteToolName` does not
     include it.)
   - Location: `echo/enforcement/helpers.ts`, importing the shell-token list
     from `readonly-command-validation.ts` rather than duplicating it. The
     implementer must **verify that import direction is legal** and, if not,
     move the shared data to a common module — the logic must not be copied.
   - Integration: `beforeToolCallImpl` replaces its `isWriteTool` guard with
     `classifyMutation`, runs the gates when `mutates`, and stores the result
     on `EnforcementState.pendingMutation` so `afterToolCallImpl` can add
     `targets` to `filesWritten`/`dirtyFiles`.
   - `pendingMutation` MUST be cleared at the start of every tool call and
     consumed in `afterToolCallImpl` — `resetForNewTurn` deliberately
     preserves cross-turn state, so a stale entry would mis-mark files on a
     later turn.
   - **Indeterminate targets are NOT blanket tree-wide.** Marking the whole
     repo dirty reproduces exactly the FID-2026-0918-005 deadlock (Law 15
     becomes unsatisfiable). Instead: `scope: 'tree'` leaves `targets` empty
     and defers to step 2's reconciliation, which discovers the actual
     changed set. Resolvable commands (`sed -i file`, `> file`) take the
     targeted path, which also minimises the migration blast radius.
   - **Defence-in-depth while the classifier lands (Loop 2 finding):** ship
     a `PreToolUse` hook in `protocol.config.yaml` matched on
     `run_terminal_command` that denies mutating commands. It is fail-open
     and therefore a mitigations, not a fix — but it narrows the live hole
     for zero classifier risk. Operator decides whether to ship it.
2. **Make Law 15 reconcile against the worktree (fail-closed backstop).**
   **Prerequisite: the baseline does not exist today.** `EnforcementState`
   tracks only `filesRead`/`filesWritten`/`dirtyFiles`/`verifiedFiles`, so
   this step must BUILD the snapshot.

   - **git enumerates, hashing decides.** `git status --porcelain`
     enumerates candidate paths cheaply; content hashes detect change. A
     set-difference of porcelain snapshots is WRONG — a file already dirty at
     session start and modified again would be missed. The baseline is a
     `Map<path, contentHash>` and `changed = { p : baseline[p] !==
     currentHash(p) }`.
   - Capture lazily on the first `beforeToolCallImpl` call (not in the state
     constructor — IO in a state factory is Law-14-hostile, and lazy avoids
     cost for sessions that never write).
   - **The baseline MUST NOT live on `EnforcementState` (Adversary, and the
     single most important correction in this revision).** Finding 2 is an
     UNRESOLVED defect in that object's persistence — it lost `filesRead`
     three times in one session. A baseline stored there inherits the same
     failure, and it fails **OPEN and invisibly**: after a reset the
     reconciliation compares against an empty baseline, `changed` is empty,
     nothing is marked dirty, and the step reports success while enforcing
     nothing. **Step 3 must resolve Finding 2 before this step lands.** If
     step 3 concludes the state cannot be made durable, the baseline is
     stored OUTSIDE `EnforcementState` (module-scope or session-keyed
     store) — never inside the object under suspicion.
   - Algorithm at turn end: compute `changed`; `unaccounted = changed −
     dirtyFiles`; if non-empty, **merge into `dirtyFiles` and block** —
     reporting without blocking recreates the "notifies but does not compel"
     failure this record exists to end.
   - **Deleted-file livelock (Adversary finding, not previously stated).** A
     path present in the baseline but gone at turn end yields
     `baseline[p] !== undefined`, is flagged changed, is merged into
     `dirtyFiles` — and Law 15 then blocks on a file that does not exist,
     forever. Reconciliation must therefore drop baseline paths that no
     longer resolve rather than marking them dirty, and treat deletion as a
     distinct outcome from modification. This would be the THIRD livelock in
     a subsystem that already documents two.
   - **Residual hole (Adversary finding).** Paths excluded from the fallback
     walk — `.git`, `node_modules`, oversized files — mutated by the terminal
     are never detected at all. That exclusion must be stated as an accepted
     limit with its rationale, not left implicit.
   - Emit a distinct diagnostic naming the classifier gap, so an unlisted
     mutating tool is reported, not tolerated.
   - Git unavailable / not a repo: fall back to a **bounded** hash walk
     (skipping `.git`, `node_modules`, oversized files) under a time budget.
     If neither is possible, emit an explicit "cannot verify" diagnostic —
     never a silent pass.
   - Record which method was used (Law 8 — log the method, not just intent).
   - **Blast radius, corrected (Adversary).** `evaluateTurnEnd()` has exactly
     ONE production call site — `boundary-gates.ts → applyTurnEndEnforcement`
     (verified by direct grep this pass: the only other non-test hit,
     `enforcement.ts → evaluateTurnEnd`, is the method definition). A
     Detective pass reported a second reference at `loop-iteration.ts:155`,
     but qualified it as "per archived docs" — stale documentation, not a
     live call. The discrepancy was resolved in favour of the Adversary's
     traced call graph. The call site is gated on
     `ending && !currentAgentState.parentId`. So this scan runs **once per
     top-level turn end**, never per LLM step, and **subagents are excluded
     from Law 15 entirely.** The published SDK has zero runtime dependency on
     the echo module (`sdk/package.json` lists `agent-runtime` for BUILD
     tooling and `scripts/*` only), so blast radius is **CLI + agent-runtime,
     not npm consumers.** An earlier draft of this record framed step 2 as a
     per-turn cost regression on every session; that framing was wrong, and
     the real risk is the fail-open above. The overstatement is recorded
     because it hid the actual failure mode.
   - **Cost, MEASURED (not deferred).** `git status --porcelain` on this
     worktree takes **139ms** (measured this pass). Step 2's reconciliation
     is therefore budgeted at **500ms**, with the excess handled by the
     bounded-hash-walk fallback and an explicit "reconciliation degraded"
     diagnostic — never a silent pass. This is a named verification step, not
     a note: if measurement exceeds the budget, step 2 escalates to the
     operator before implementation proceeds.
3. **Fix the Law 1 read-state; blocks Law 1 hardening.** Write the
   reproduction FIRST — the test selects the branch, and writing the fix
   before the diagnosis risks hardening a defect into a permanent tax.
   - **Branch A — defect** (instance rebuilt, or read lost): if the
     enforcement instance is recreated between steps, hoist it to run/session
     scope rather than per-step; if `resetForNewTurn` is clearing state it
     claims to preserve, fix that and pin the claim with a test.
   - **Branch B — correct-by-design**: the gate is right and the *message*
     is wrong. Make the message state the actual scope so the agent knows
     whether to re-read. No behavior change.
   - Both branches need the same regression test: read → write → re-attempt
     → assert no re-block.
4. **Restore full Law 3 enforcement for code files + repeat-violation
   escalation.**
   - **Reinstate the pre-write block on other-dirty files** (see Ruling 1).
     **The three live exemptions MUST be enumerated first (Adversary
     omission — step 4 as previously written would have recreated known
     bypasses).** `pre-write-gates-law3.ts → runLaw3Gate` (the Law 3
     two-part-rule gate) carries THREE exemptions beyond the advisory, each
     deliberately built to avoid a deadlock: failure-attribution
     (`FID-2026-0927-003` F2a), the `self_correct` fallback (F2b), and
     exempt-path targets (`isExemptWritePath`). Restoring a hard block
     without enumerating and preserving these re-opens the exact bypasses the
     protocol deliberately constructed. Each must be carried forward
     deliberately, with a reason, not overwritten.
   - **Documentation files are excluded from Law 3 entirely** —
     `pre-write-gates-law3.ts` filters `classifyFileKind(f) === 'code'`, so
     docs verify via markdownlint and never through this gate
     (`FID-2026-0917-002`). **This is an ACCEPTED LIMIT, not an open hole:**
     docs are governed by `lint:md`, which is a real gate with a real failure
     mode, so coverage is not absent — it lives one layer over. Step 4's
     heading therefore says "restore full Law 3 enforcement **for code
     files**", and any widening to documentation files is an operator
     decision recorded in the SCOPE register, not a silent consequence of
     this step.
   - **Deadlock escape clause, mandatory:** the pre-write block must never
     fire on a command that *is* the verification the block is asking for.
     Without that clause this step reintroduces the exact deadlock
     FID-2026-0918-005 documented.
   - **Identification mechanism, mandatory (Adversary finding — the clause
     above is not implementable as written).** "Never fire on the
     verification command" requires a predicate, and there is none today.
     The mechanism must be the SAME one `afterToolCallImpl` already uses to
     grant credit: `detectsVerificationCommand` over
     `terminalCommandCandidates(input)`. If that predicate returns true for
     the pending command, the pre-write Law 3 block is suppressed and the
     command is allowed through to earn credit. Reusing that predicate rather
     than inventing a second one is required — Law 13 — and it guarantees
     the two paths cannot disagree about what "verification" means.
   - **Escalate after N=3** identical blocks keyed on
     `(law, tool, canonical targetPath)`, resetting on any intervening
     compliant read **or** verification (for Law 3). N=3 rather than 2
     because a legitimate multi-file batch produces a different key per file
     and never escalates.
   - **Escalation means a harder response, not a different message:** hard
     block, then turn termination on the next repeat. Message-only escalation
     IS the "notifies but does not compel" pattern.
   - The counter is tracked **separately** from `steeringPerLaw`/`steeredKeys`
     and does not consume that budget — otherwise dedupe could suppress the
     escalation itself.
   - Escalation never converts advisory to block. That is a policy change and
     belongs to this named step, not to a tuning knob.
5. **Make the code match `ECHO.md`, not the reverse.** `ECHO.md` needs no
softening; its claims are correct. Steps 1-4 make the implementation true.
   - **5a — Law 2 gate, per Ruling 2 ("if it's in scope, then it's
     mechanically presented").** The gate resolves each write target against
     `SCOPE.md`: in-scope → pass (presentation already occurred at approval);
out-of-scope → block with "no approved scope item covers this path;
     present it first." This also removes the failure mode where an agent
     emits one token of presentation and then writes freely — a proxy gate on
     message-presence would replicate the root cause of this review.
   - **Migration prerequisite, not a design note (Adversary finding).**
     Register items are currently prose; `T109` carries no machine-readable
     target pattern. With "no pattern = non-covering (fail-closed)" — the
     correct default — essentially every existing register item would block
     every write, so **the gate is unusable until `SCOPE.md` is retrofitted
     with per-item patterns.** Retrofitting the open register is therefore a
     PREREQUISITE to shipping 5a, and it is an operator-visible change to a
     governance artifact. Shipping the gate without it would block all work.
6. **Scope Law 4's wiring detector to real declarations.** Gate on file type
   and parse structure, not a raw `/export\s/` regex over arbitrary content.
   Add a regression pin: writing a markdown file containing `export` in a
   code fence must NOT register `featuresWired`. Also ensure a false
   registration cannot survive a turn (the livelock).
7. **Stop `validateFidStepStatus` being defeatable by heading choice
   (Adversary finding — the same defect class this FID documents).**
   The gate reads only the `## Step Status` section, and that section's regex
   terminates at the next `## ` heading (`fid-validator.ts →
   validateFidStepStatus`). An agent can therefore reach `converged` with
   **zero implementation** by moving its steps under any other heading —
   which is exactly what this record's Implementation Plan section does.
   **The restructure in this document was legitimate and disclosed; the same
   mechanism is also an evasion route, and it must be closed.** The gate must
   scan the whole document for unresolved implementation claims regardless of
   which heading contains them, and a `converged` FID must additionally
   carry an explicit, machine-readable `implementation_started: false`
   assertion that the gate verifies rather than infers from section
   placement.
8. **Validate agent prompt content in CI (the Detective companion's FAIL 2 —
   prose rules with no enforcement surface are this FID's root cause in
   miniature).** The Source-of-the-Claim rules in
   `agents/detective/detective.ts` are string literals: typecheck, eslint and
   prettier treat them as opaque, so nothing fails when the wording erodes —
   the exact "prose that asserts instead of enforcing" defect this record
   indicts. Add a `bun test` suite (wired into the existing pre-push gate)
   that reads the agent definition files and asserts, per rule: (a) the
   three rules exist and name their anchor phrases; (b) no agent prompt
   instructs the use of `file:line` citations; (c) no agent prompt names
   `dev/` as an evidence source for code claims. This is intentionally
   narrow — it pins the operator-ruled rules, it does not attempt to
   semantics-check prompts generally.

### Verification

- **Step 1:** `packages/agent-runtime/src/echo/__tests__/terminal-mutation-gate.test.ts`
  — mutating `run_terminal_command` is (a) Law-1 gated, (b) recorded in
  `dirtyFiles`, (c) blocked at turn end unverified; plus a negative pin that
  read-only commands (`git status`, `bun test`) still pass.
- **Step 2:** a test seeding a synthetic worktree change that never passed
  through a write tool, asserting Law 15 fires, blocks, and names the gap.
  Plus the **cost gate**: `git status --porcelain` measured on this worktree
  (baseline 139ms; budget 500ms), and a fail-open pin asserting that an EMPTY
  baseline blocks loudly rather than reporting success.
- **Step 3:** reproduction probe under `dev/scratchpad/active/` (exit 0 =
  reproduced, 1 = not).
- **Step 4:** an escalation suite (3 repeats escalate; an intervening read
  resets; the verification-escape clause does not deadlock). **Existing suites
  that assert the CURRENT advisory behavior will fail and must be updated
  deliberately, not deleted** — `pre-write-gates-law3.test.ts` (describe
  `runPreWriteGates — Law 3 two-part rule (FID-2026-0918-005)`: the two-part
  rule, "docs mixed with code never appear in the advisory set"),
  `enforcement.test.ts` (describe `EchoEnforcement — Law 3 re-arm on
  re-modification (FID-2026-0820-012)`), and
  `law3-failure-attribution.test.ts` (it `emits an advisory rather than a
  silent pass when it unblocks`). Each assertion is a record of a deliberate
  decision; reversing the decision must be visible in the diff, and the three
  exemptions must survive as named tests rather than being silently removed
  with the advisory they surrounded — `law3-failure-attribution.test.ts`
  itself says why in its header: *"Leg 2 is the one that keeps this a safety
  gate. If it ever inverts, the change has become a bypass: edit the test,
  delete the assertion, keep the gate quiet."*
- **Step 5a:** a scope-resolution suite (in-scope pass, out-of-scope block,
  no-pattern = fail-closed).
- **Step 6:** the markdown-quoting negative pin.
- **Step 7:** a test proving a `converged` FID whose steps sit under a
  non-`Step Status` heading without the implementation assertion is rejected.
- **Step 8:** a suite asserting the Detective's three source-rule anchor
  phrases exist in `agents/detective/detective.ts` and that no agent
  definition instructs `file:line` citations or `dev/` as code evidence.

> Contract rule (FID-2026-0918-006): every promised artifact names its
> repo-relative `*.test.ts(x)` path, and that path appears as a declared gate.

**All planned artifacts now exist.** The step-6, step-7 and step-8 suites
entered the declared list 2026-10-02 when their files were created; the
step-1 (terminal-bypass), step-4 (law3-escalation), step-5a (law2-scope-gate)
and deny-hook siblings entered it at closure the same day, per
FID-2026-0918-006 (a declared gate is a claim of existing evidence).
Step 3's probe is deliberately NOT a declared gate: `validate:repository`
re-runs declared gates and would recurse (FID-2026-0915-004).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/enforcement.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts
- gate: quality
- gate: test packages/agent-runtime/src/echo/__tests__/law4-wiring-scope.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/fid-validator.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law1-read-state-durability.test.ts
- gate: test agents/__tests__/detective-prompt-content-gate.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law3-escalation.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/deny-mutating-terminal.test.ts

### Verification Receipt

- fingerprint: sha256:29fd3aac615e735b9ee55eb0791c70095b8360147746f1bc666be5b86f130212
- verified: 2026-10-02T20:05:18.414Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/enforcement.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts: exit 0
- quality: exit 0
- test packages/agent-runtime/src/echo/__tests__/law4-wiring-scope.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-validator.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law1-read-state-durability.test.ts: exit 0
- test agents/__tests__/detective-prompt-content-gate.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/terminal-bypass-pipeline.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law3-escalation.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/deny-mutating-terminal.test.ts: exit 0

## Step Status

> Convergence work for THIS document, per ECHO.md's Perfection Loop. Checked
> only where each item is factually complete. The implementation steps are
> tracked separately below — Batch 1 (steps 6, 3, 7, 8) was implemented
> 2026-10-02 under operator authorization; see Implementation Plan and
> Implementation Evidence.

- [x] RED — root cause cataloged with resolved evidence; every citation
      re-resolved to a live symbol in Loop 2 (2026-10-02)
- [x] GREEN — every open decision answered with a robust default, not deferred
- [x] AUDIT — repeated Verifier passes run; every finding resolved in-document
- [x] ADVERSARIAL — two Adversary passes (Loop 1) + one operator-triggered
      full-loop pass (Loop 2, 2026-10-02); central claim CONFIRMED each time;
      corrections applied (three from Adversary 1, three from Adversary 2,
      six from Loop 2 — listed in the Loop 2 section)
- [x] Operator rulings 1 and 2 recorded as governing inputs
- [x] Step ordering, dependencies, deadlock escape and rollback stated
- [x] Verification artifacts named per step; declared gates list only
      existing files

**Presentation is deliberately NOT a Step Status checkbox.** An earlier
revision checked it in advance — a forward-looking claim asserted as complete
— and the next revision opened the box, which `validate:repository` correctly
rejected (`fid.steps.unresolved`): under a `converged` status every unchecked
`## Step Status` line is unresolved by definition. That is the gate working.
Presentation is the act that FOLLOWS convergence, so it belongs here as prose,
not as a completion claim this document makes about itself.

## Implementation Plan

> Batch 1 (steps 6, 3, 7, 8) IMPLEMENTED 2026-10-02 under explicit operator
> authorization; evidence and declared gates below. **Batch 2 AUTHORIZED
> 2026-10-02** (operator questionnaire
> `dev/scratchpad/2026-10-02-operator-ruling-requests.md`): steps 2 → 1 → 4,
> then 5/5a; `SCOPE.md` retrofit APPROVED (edit to be presented before
> writing); Law 15 cost gate parameters CONFIRMED (every turn end, 500ms
> budget, loud fail-open notice). The boxes stay here — outside
> `## Step Status` — because `converged` describes the convergence of THIS
> DOCUMENT, not implementation (`fid-validator.ts → validateFidStepStatus`,
> where `declaredClosed = status === 'converged' || status === 'closed'`).

<!-- FID-2026-1001-003 step 7: the machine-readable declaration below scoped
     to the UNCHECKED boxes in this section while they were plan items
     pending their operator-authorized batch. 2026-10-02: ALL eight steps are
     implemented and evidenced (Batch 1: 6, 3, 7, 8; Batch 2: 2, 1, 4, 5/5a
     under operator authorization Q3-C) and ALL boxes are checked, so no
     unchecked box remains in this section for the declaration to cover. -->
implementation_started: true

- [x] **Step 1** — close the terminal bypass (critical; implemented 2026-10-02
      after step 2, per the stated dependency; see Implementation Evidence)
- [x] **Step 2** — Law 15 fail-closed reconciliation against the worktree
      (implemented 2026-10-02; see Implementation Evidence)
- [x] **Step 3** — diagnose + fix the Law 1 read-state (implemented
      2026-10-02; see Implementation Evidence)
- [x] **Step 4** — restore Law 3 blocking + escalation (implemented
      2026-10-02, after steps 2 and 1 per the stated dependencies; see
      Implementation Evidence)
- [x] **Step 5 / 5a** — align code to `ECHO.md`; add the Law 2 scope gate
      (implemented 2026-10-02 after steps 2, 1 and 4; `SCOPE.md` retrofit
      presented to and approved by the operator before writing, per Q4-A;
      see Implementation Evidence)
- [x] **Step 6** — scope Law 4's wiring detector (implemented 2026-10-02;
      see Implementation Evidence)
- [x] **Step 7** — stop `validateFidStepStatus` being defeatable by heading
      choice (implemented 2026-10-02; see Implementation Evidence)
- [x] **Step 8** — CI gate validating agent prompt content (implemented
      2026-10-02; closes the Detective companion's Verifier FAIL 2; see
      Implementation Evidence)

**Rollback.** Each step reverts independently. Note that reverting an
enforcement fix re-opens a bypass, which is a governance event requiring
explicit operator approval — not something an agent does silently under
pressure.

## Implementation Evidence (Batch 1 — 2026-10-02)

Implemented under the operator's explicit authorization of steps 6, 3, 7, 8
(independent, shippable). Every claim below names its symbol; every gate ran
this session from its workspace root (T67 discipline).

### Step 6 — Law 4 wiring detector scoped (row H + livelock)

- **Diagnosis confirmed live:** `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts → afterToolCallImpl`
  registered `featuresWired` on a raw `/export\s+(default\s+)?/` probe over
  arbitrary content — a governance markdown document quoting `export` in a
  code fence registered as a wired feature, and because
  `packages/agent-runtime/src/echo/enforcement/turn-end.ts → evaluateTurnEndImpl`
  only calls `resetForNewTurn` when `!blocked`, the false entry re-blocked
  every turn (livelock) demanding a caller grep for a document.
- **Fix:** registration now requires `classifyFileKind(path) === 'code'`
  (`packages/agent-runtime/src/util/echo-compliance-core.ts → classifyFileKind`)
  AND a line-anchored export DECLARATION via the new pure predicate
  `packages/agent-runtime/src/util/echo-compliance-core.ts → hasWiringDeclaration`
  (re-exported through `packages/agent-runtime/src/util/echo-compliance.ts`).
  Backstop: `evaluateTurnEndImpl` evicts any docs-classified path from
  `featuresWired`/`featuresVerified` before Law 4 reads the ledger, on the
  blocked path too, so neither a stale false entry nor a live one can wedge
  turn end.
- **Gates:** `src/echo/__tests__/law4-wiring-scope.test.ts` 6 pass / 0 fail
  (markdown-fence negative pin; docs-path negative pin; declaration positive
  pin; string/comment negative pin; two livelock pins) ·
  `src/util/__tests__/echo-compliance.test.ts` 17 pass / 0 fail (new
  `hasWiringDeclaration` describe) · `src/echo/__tests__/law4-turn-end.test.ts`
  15 pass / 0 fail (Law 4 contract unchanged) · agent-runtime typecheck
  exit 0.

### Step 3 — Law 1 read-state durability (Branch A)

- **Diagnosis confirmed live:** `filesRead` lived only on the ephemeral
  `EchoEnforcement` instance, WeakMap-keyed by agentState object identity
  (`packages/agent-runtime/src/echo/enforcement/factory.ts → getOrCreateEnforcement`);
  a session restore replaces the object, the factory builds a fresh instance
  with an empty read set, and
  `packages/agent-runtime/src/echo/pre-write-gates.ts → runPreWriteGates`
  re-blocks Law 1 on files the session demonstrably read.
- **Fix (reproduction test written FIRST, failed pre-fix):** reads now
  additionally mirror into a durable bounded ledger on the grounding
  checkpoint — `common/src/types/session-state-records.ts → GroundingCheckpoint.readLedger`
  (Record, canonical paths → first-seen ms, cap `MAX_READ_LEDGER = 512` FIFO
  in `packages/agent-runtime/src/echo/enforcement-state.ts`), written by
  `tool-pipeline.ts → beforeToolCallImpl`; the constructor
  (`packages/agent-runtime/src/echo/enforcement.ts → EchoEnforcement`)
  hydrates `filesRead` from it when grounded. Reads hydrate; write credit
  never does — a fresh logical session still blocks (pinned).
- **Gates:** `src/echo/__tests__/law1-read-state-durability.test.ts`
  5 pass / 0 fail (two reproduction pins — Law 1 re-block and Law 15
  re-arm — plus fresh-session, dedupe, and state-shape pins) · full
  `src/echo/__tests__` 269 pass / 0 fail · agent-runtime + common typecheck
  exit 0.

### Step 7 — heading-choice anti-evasion

- **Diagnosis:** `packages/agent-runtime/src/echo/fid-validator.ts → validateFidStepStatus`
  read only the `## Step Status` section, so a `converged` FID could park its
  step inventory under any other heading — the exact mechanism this
  document's own (disclosed) restructure used.
- **Compatibility sweep first (evidence, not assumption):** real `grep` over
  `dev/fids/archive/` found numbered unchecked step boxes in exactly ONE
  archived FID — FID-2026-0817-005 (this gate's own author), which has NO
  `## Step Status` section, and `scripts/fid-ledger-steps.ts → validateFidStepLedger`
  explicitly skips section-less FIDs; Risk-Level-style prose boxes (150+
  archive files) are excluded by the numbered-line grammar. A naive
  whole-doc scan would have failed 150+ archived records.
- **Fix (dual-guard):** (1) a closure-claiming FID without a standalone
  `implementation_started: false` line may not park numbered unchecked step
  boxes outside the section; (2) the assertion is verified, not inferred —
  and it must be a STANDALONE line, because prose quotation of the string
  (this FID's own spec originally satisfied the first draft) is not a
  declaration. Anti-laundering pin added after the first draft was caught
  self-satisfying.
- **Gates:** `src/echo/__tests__/fid-validator.test.ts` 20 pass / 0 fail
  (8 new: rejection, plan-boxes shape, assertion allowance, prose-mention
  rejection, operator-approved allowance, Risk-Level exclusion, non-closure
  non-binding, dedupe) · `bun scripts/fid-ledger.ts` exit 0 over active +
  archive.

### Step 8 — agent prompt-content CI gate (Detective companion FAIL 2)

- **Fix:** `agents/__tests__/detective-prompt-content-gate.test.ts` pins the
  three Source-of-the-Claim anchor phrases and the scoped-search mechanism in
  `agents/detective/detective.ts`; asserts no agent definition instructs
  `file:line` citations outside the documented exception set (Verifier,
  Adversary, Orchestrator roster/system prompt — the FID-2026-0805-004 audit
  contract, pinned not silent); asserts `dev/` appears in evidence context
  only as the Detective's prohibition.
- **Gates:** 8 pass / 0 fail via `agents` workspace test runner.

### Step 2 — Law 15 worktree reconciliation (Batch 2, 2026-10-02)

Implemented under the operator's Batch-2 authorization (steps 2 → 1 → 4,
then 5/5a; Q3-C) with the Q5-A cost-gate ruling (every turn end, 500ms,
loud notice).

- **Fix:** `packages/agent-runtime/src/echo/enforcement/worktree-capture.ts →
  captureWorktreeBaseline` builds the durable baseline (repo-relative posix
  path → sha256) on the FIRST write-path/terminal tool call
  (`→ maybeCaptureWorktreeBaseline`, called from `tool-pipeline.ts →
  beforeToolCallImpl` — the bypass surface gets its baseline before it can
  fire; pure-read sessions never pay). Turn end,
  `packages/agent-runtime/src/echo/enforcement/worktree-reconcile.ts →
  reconcileWorktree` (wired in `turn-end.ts → evaluateTurnEndImpl`) merges
  unaccounted changes into `dirtyFiles` and blocks — merge AND block, per
  the mandate. Deletion is a distinct outcome: baseline paths that no longer
  resolve are dropped, never flagged dirty (third-livelock guard, pinned).
  The bounded walk lives in `packages/agent-runtime/src/echo/enforcement/worktree-walk.ts`.
- **Spec-letter deviation, recorded (two design corrections found by the
  suite, both strengthen the step):**
  1. The spec says "`git status --porcelain` enumerates". Porcelain is wrong
     for the BASELINE twice over: it lists only CHANGED paths (a clean-tree
     capture would build an empty baseline — and an empty captured baseline
     fails closed, wedging every later turn), and a deleted committed file
     becomes invisible (the deletion pin failed against the first draft).
     Implemented with `git ls-files -z --cached --others
     --exclude-standard` — the full inventory, .gitignore-respecting —
     which satisfies the spec's actual intent ("git enumerates cheaply,
     hashing decides; a file dirty at capture AND modified again must be
     caught" — that property IS pinned).
  2. The spec's frozen turn-zero baseline re-flags content a LATER turn
     wrote and verified (dirtyFiles is a per-turn batch; verified turn-3
     work would re-block at turn 5). The baseline therefore ADVANCES over
     `verifiedFiles` at each clean turn end (`→ advanceWorktreeBaseline`) —
     durable-semantic "already accounted for by the gates". Verified-only,
     never the whole batch: a hybrid-mode unverified terminal mutation must
     re-surface next turn, never be silently absorbed (pinned).
- **Baseline placement (the Adversary mandate):** on the durable grounding
  checkpoint (`common/src/types/session-state-records.ts →
  GroundingCheckpoint.worktreeBaseline*`), NEVER on `EnforcementState` —
  pinned by a test asserting the state object carries no `worktree*` fields.
  An empty/unavailable captured baseline fails CLOSED: every later turn
  states "cannot verify" explicitly (two pins).
- **Accepted limits (stated, per the spec):** paths under `.git`/
  `node_modules`/`resources`/build dirs and files >2MiB are never hashed
  (cost vs. risk); subagents are excluded (the reconciliation runs in
  `evaluateTurnEndImpl`, which executes once per top-level turn end).
- **Cost, measured (the named verification step):** full capture on this
  repo (610 files): ls-files 50ms + hashing 46ms ≈ 96ms; reconcile ~100ms —
  inside the 500ms budget with ~5x headroom. No escalation needed.
- **Gates:** `src/echo/__tests__/worktree-reconcile.test.ts` 14 pass / 0 fail
  (merge-and-block, dirty-at-capture-and-again, clean-tree negative,
  deletion distinctness + no-re-report, two never-silent-pass pins,
  sanctioned-write negative, baseline-placement pin, ls-files contract ×2,
  advance ×2, strict turn-end integration) · full agent-runtime 1,599 pass /
  0 fail · typecheck exit 0 · quality cap honored via the three-module split
  (reconcile 227 / capture 180 / walk 56; `tool-pipeline.ts` exactly 300).

### Step 1 — terminal bypass closed (Batch 2, 2026-10-02)

Implemented under the operator's Batch-2 authorization (Q3-C: steps
2 → 1 → 4 → 5a), after step 2 per the stated dependency.

- **Fix:** `packages/agent-runtime/src/echo/enforcement/helpers.ts →
  classifyMutation({ toolName, params })` returns `MutationClassification`
  (`mutates` / `targets` / `scope: 'targeted' | 'tree'`) exactly as
  specified. Write-path tools classify through the same code path; terminal
  commands split on safe segments (`splitSafeAnd`/`splitSafePipes`) and
  signal mutation via the shell-token lists imported from
  `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`
  (Law 13 — import direction verified legal, that module imports nothing
  from echo/), plus `IN_PLACE_EDIT_REGEX` (sed -i / perl -i / gawk inplace)
  and per-segment redirect/tee target extraction (`terminalMutationTargets`,
  diagnostic sinks `/dev/null`·`nul` excluded).
- **Integration:** `tool-pipeline.ts → beforeToolCallImpl` stashes the
  classification on `EnforcementState.pendingMutation` (cleared every call,
  consumed same call — resetForNewTurn preservation makes a stale entry a
  later-turn mis-mark), routes `mutates` calls through the SAME pre-write
  gate chain (Law 1 now iterates the classified targets in
  `pre-write-gates.ts`, blocking on any target neither read nor new), and
  `afterToolCallImpl` folds successful terminal targets into
  `filesWritten`/`dirtyFiles` and revokes verification credit — Law 15's
  predicate and step 2's reconciliation see the bypass.
- **Law 13 reconciliation of the enumerated sites (spec: "all four
  definitions, six call sites"):** `pre-write-gates.ts`'s private
  `isWriteTool`/`getTargetPath` — the site the spec called load-bearing —
  now import from `enforcement/helpers` (behavior-identical; the apply_patch
  `operation.path` branch and its FID-2026-0820-014 EC-2 rationale moved
  with the canonical function). The executor-side
  `tools/tool-executor/write-bookkeeping.ts → isWriteToolName` remains a
  deliberate exception with production call-graph evidence:
  `ehel-gate.ts` calls `enforcement.beforeToolCall` UNCONDITIONALLY (its own
  header: "This call is unconditional: development policy cannot bypass
  EHEL"), so the classifier sees every terminal command; the remaining
  `isWriteToolName` consumers (`hook-gate.ts` ZTAP signing,
  `result-lifecycle.ts` receipts, yagni payload stripping) are write-payload
  bookkeeping, not law-gate selection. Converting them to effect-based
  classification would re-route ZTAP signing onto mutating shell commands,
  a semantic change outside this step.
- **Design corrections found by the suite (recorded, strengthen the step):**
  1. `FORBIDDEN_METACHAR_REGEX` is deliberately NOT a mutation signal:
     pipes/`&&` are command STRUCTURE (the readonly validator's rejection
     surface), not worktree mutation — consuming it classified every
     `bun test | tail` as tree-wide and wedged the first draft 9/19.
  2. The turn-end scanners failed CLOSED on bypass targets (no ledger
     content): strict turn end would have wedged forever even after a green
     verification. `turn-end.ts → writtenOrDiskContent` reads ledger-first,
     disk-second so reconciliation-cleaned targets can actually settle.
  3. `worktree-capture.ts → maybeCaptureWorktreeBaseline` keyed on
     `isTerminalTool` — which means `end_turn`/`task_completed`, never a
     shell tool — so the bypass surface captured NO baseline. Fixed: capture
     now fires on `isWriteTool || classifyMutation(...).mutates`.
- **Spec-letter deviation, recorded (mirrors the accepted step-3
  substitution, Q7-A):** the spec's named artifact
  `terminal-mutation-gate.test.ts` ships as three focused suites under the
  quality cap — `src/echo/__tests__/terminal-bypass-fixtures.ts` +
  `terminal-mutation-classifier.test.ts` + `terminal-bypass-pipeline.test.ts`
  (19 pass / 0 fail): the named assertions are ALL present (mutating
  terminal is Law-1 gated, recorded in dirtyFiles, blocked at turn end
  unverified; `git status`/`bun test` negative pins).
- **Accepted limit + defence-in-depth (stated, not silent):**
  `DANGEROUS_COMMAND_REGEX` stays private to the readonly validator;
  `python -c`-style inline scripts with no resolvable target classify
  non-mutating pre-write and are caught post-hoc by step 2's reconciliation
  (merge-and-block), not pre-write. The spec's optional `PreToolUse` deny
  hook in `protocol.config.yaml` (fail-open mitigation, "operator decides")
  **SHIPPED 2026-10-02** under the operator's "complete all work" directive:
  `common/src/types/hooks.ts → HOOK_BUILTIN_ACTIONS` gained
  `deny-mutating-terminal`; `packages/agent-runtime/src/hooks/deny-mutating-terminal.ts
  → runDenyMutatingTerminal` categorically denies worktree-mutating terminal
  commands before dispatch, decided by the SAME `classifyMutation` (Law 13),
  fail-open by construction (pure sink + the engine's catch wrapper);
  non-mutating/verification commands pass untouched. Declared in
  `protocol.config.yaml` (matcher `run_terminal_command`). Suite:
  `src/hooks/__tests__/deny-mutating-terminal.test.ts` 5 pass / 0 fail.
- **Gates:** agent-runtime typecheck exit 0 · focused suites 19/19 (step-1)
  and 23/23 (pre-write-gates ×3 + pipeline after the Law-13 swap) ·
  `src/echo/__tests__/worktree-reconcile.test.ts` 14 pass (capture gap
  pins) · full agent-runtime suite 1,617 pass / 0 fail · eslint 0 warnings
  + prettier clean on all touched files · quality cap honored:
  `tool-pipeline.ts` 348→298 by extracting
  `enforcement/verification-credit.ts` (112: Law 3 outcome-aware crediting
  `creditVerificationRun` + Law 4 `creditCallGraphSearch`, verbatim bodies);
  `pre-write-gates.ts` 301→270 by the Law-13 dedupe above plus removal of a
  duplicated FID-2026-0823-007 comment block (ratchet = quality-count
  wc+1 ≤ 300).

### Step 4 — Law 3 restored + N=3 escalation (Batch 2, 2026-10-02)

Implemented under the operator's Batch-2 authorization (Q3-C), after steps
2 and 1 per the stated dependencies.

- **Restored block:** the FID-2026-0918-005 other-dirty ADVISORY branch in
  `packages/agent-runtime/src/echo/pre-write-gates-law3.ts → runLaw3Gate`
  blocks again, naming the same unverified set it warned about (docs stay
  excluded via the `classifyFileKind` split — accepted limit, FID-2026-0917-002).
  **The three live exemptions were enumerated first and are untouched:**
  failure-attribution (F2a), `self_correct` (F2b), and `isExemptWritePath`
  targets — all live in the target-dirty/exempt-path branches, and
  `law3-failure-attribution.test.ts` re-ran UNCHANGED (13 pass), which is the
  spec's "exemptions survive as named tests" requirement met.
- **Deadlock escape clause (mandatory, implemented as specified):**
  `pre-write-gates.ts` computes `detectsVerificationCommand` over
  `terminalCommandCandidates(params.input)` — the SAME predicate the credit
  path uses (Law 13; `verification-credit.ts` consumes it too) — and
  `runLaw3Gate` returns unblocked when it fires: the block never fires on its
  own cure. Write tools carry no command field, so the clause is inert for
  them.
- **N=3 escalation:** `packages/agent-runtime/src/echo/enforcement/escalation.ts`
  — strikes keyed `law|tool|canonicalTarget` on
  `EnforcementState.blockStrikes`, tracked SEPARATELY from
  `steeredKeys`/`steeringPerLaw` (advisory dedupe can never suppress it);
  recorded in `pre-write-gates.ts → runPreWriteGates` on every law-3 block.
  At N=3 the block carries an escalation notice; the NEXT repeat arms
  `EnforcementState.turnTerminationArmed` and flags the result
  `terminateTurn` — the harder response, not a different message. Reset by
  an intervening compliant read (any law) or a verification-shaped command
  (law 3) via `tool-pipeline.ts → beforeToolCallImpl →
  noteCompliantIntervening`. N=3 batch safety pinned: a different target per
  write never escalates.
- **Turn termination (mechanical, main loop only):**
  `run-agent-step/loop/boundary-gates.ts → applyLawEscalationTermination`
  (wired into `applyStepBoundaryTail` after the turn-end gate, so it
  pre-empts a Law-15 block exactly at termination) consumes the arm one-shot
  and forces `shouldEndTurn`. Subagents excluded (budget-bounded loops; they
  cannot act on a termination), mirroring `applyTurnEndEnforcement`'s blast
  radius. The blocked command itself never ran; unverified state stays
  visible. `resetForNewTurn` clears the arm as belt-and-braces — the STRIKES
  are deliberately preserved (only a compliant read/verification resets the
  ladder).
- **Deliberate suite updates (per the spec's named list):**
  `pre-write-gates-law3.test.ts` — the three other-dirty assertions flipped
  to blocks with the restoration recorded in the header; describe renamed.
  `enforcement.test.ts` — stale advisory-era comment corrected, a new
  restored-leg pin added, and the re-arm fixture FIXED: its verification call
  never passed `commandSucceeded`, so under FID-2026-0919-015 it never
  actually earned credit — the advisory leg had masked that; the restored
  block exposed it. `law3-failure-attribution.test.ts` — unchanged, passing
  (all its scenarios are target-dirty-leg).
- **Accepted limits (stated):** strikes are NOT checkpoint-durable — the
  ladder is an anti-evasion measure within a live session; a session restore
  is step-2 reconciliation territory. Escalation is wired for LAW 3 blocks
  only (this step's mandate); the mechanism is generic (the key carries the
  law) and wiring other laws is a policy extension deliberately not shipped.
  The boundary-gate wiring itself is 6 lines around the unit-tested
  `consumeTurnTermination` (typecheck-verified; no integration harness for
  `applyStepBoundaryTail` exists in the suites).
- **Gates:** agent-runtime typecheck exit 0 ·
  `law3-escalation.test.ts` 5 pass / 0 fail · updated suites green ·
  full agent-runtime suite 1,623 pass / 0 fail · eslint 0 warnings +
  prettier clean on all touched files · quality cap held:
  `tool-pipeline.ts` 299, `pre-write-gates.ts` 294, `escalation.ts` 113,
  `pre-write-gates-law3.ts` 196, `boundary-gates.ts` 281.

### Step 5 / 5a — Law 2 scope gate + SCOPE.md retrofit (Batch 2, 2026-10-02)

Implemented under the operator's Batch-2 authorization (Q3-C). **The
retrofit was PRESENTED before writing (Q4-A honored):** the proposed
per-item pattern table was shown to the operator, who approved it with two
rulings — (a) approve + add the T62-followups catalog glob after grepping
its surface, (b) governance surfaces are GATE-LEVEL exemptions, not
register items.

- **SCOPE.md retrofit:** a consolidated `## Machine-readable scope targets`
  section maps every open register item to glob patterns (materialized as a
  keyed section rather than scattered inline lines — same content, one
  parseable grammar; recorded as the materialization of the approved table).
  Items with no agent write surface (T83-E, T95-C) carry none — non-covering
  by construction. T62-followups' glob is `dev/scratchpad/active/t62*.ts`
  (grep finding recorded in the section: the "catalog" itself is
  gateway-side; the local write surface is the probe scripts — the proposed
  `t62-*` glob would have missed the actual `t62f1-*` files).
- **The gate:** `packages/agent-runtime/src/echo/pre-write-gates-law2.ts →
  runLaw2Gate` resolves EVERY mutating target — the write tool's target AND
  the classifier's terminal mutation targets (the bypass closure extends to
  scope: a `sed -i src/foo.ts` resolves exactly like a write_file) — against
  the register (`loadScopeArtifact` parses `- <item>: \`glob\`` lines;
  `globToRegExp` is a minimal pinned matcher: `**` crosses separators, `*`
  stays in one segment, everything else literal). No pattern covering →
  block with "no approved scope item covers …; present it first" (Ruling 2's
  exact remedy). Laws 1-4 carry no tier/mode branch.
- **Gate-level exemptions (operator ruling):** `dev/`, `.agents/`,
  `.githooks/` prefixes plus the root protocol artifacts (`SCOPE.md`,
  `CHANGELOG.md`, `ECHO.md`, `AGENTS.md`, `ARCHITECTURE.md`,
  `CONTRIBUTING.md`, `protocol.config.yaml`) pass without register coverage
  — mandatory protocol behavior (FID writes, session summaries, register
  updates) cannot wedge the gate.
- **Missing-register boundary (stated limit, not a silent pass):** the
  write-time gate is active only where `SCOPE.md` exists at
  `process.cwd()`. Presence and structure of the register are the REPO
  gate's contract (`validate:repository` → `scope.*` checks already enforce
  registration), so a repo without a register is governed there, not per
  write. Where the register EXISTS and does not cover, the block is
  unconditional (fail-closed, pinned).
- **Law 1 extraction:** `pre-write-gates-law1.ts` now holds the read-0-EOF
  gate verbatim (quality-cap decomposition, same Loop-303 contract as
  law3/fid/verification-credit); `pre-write-gates.ts` at 241 wc composes
  Law 1 → Law 2 → immutable-skill → Law 3 (+escalation) → YAGNI → FID →
  scope-disposition.
- **Gates:** agent-runtime typecheck exit 0 · `law2-scope-gate.test.ts`
  12 pass / 0 fail (covered pass, uncovered fail-closed block + exact
  remedy, non-covering item, no-section register, six governance exemptions,
  terminal-target resolution, missing-register inertness, parser, glob
  vocabulary ×4) · full agent-runtime suite 1,635 pass / 0 fail ·
  eslint 0 warnings + prettier clean · quality cap: `pre-write-gates.ts`
  241, `law1` 104, `law2` 131.

### Closure corrections (2026-10-02, found by repo-root receipt verification)

Three defects surfaced when the receipt gates were first run from the REPO
root (the stamp above is the first execution of this record's declared
gates — the gates section previously carried prose the parser rejected,
which is why the batch summaries' workspace-root runs were the only
evidence until now):

1. **Law 2 jurisdiction boundary** (`pre-write-gates-law2.ts`): the gate
   resolved targets against `process.cwd()` but matched ANY target —
   synthetic `/proj/...` fixture targets fail-closed the whole shared
   pipeline whenever cwd carried a register (6 repo-root suite failures).
   A target that does not resolve under cwd is outside the gate's
   jurisdiction (out-of-project writes are the G-law's surface); pinned in
   `law2-scope-gate.test.ts`. The `relative()` implementation also broke on
   win32 (`canonicalizePath` strips the drive letter) — replaced with a
   drive-stripped POSIX prefix comparison.
2. **Turn-end reconciliation targeted the capture root, not cwd**
   (`turn-end.ts`): the baseline's namespace is `worktreeBaselineRoot`
   (capture records `process.cwd()` in production, so behavior is
   identical there); reconciling a fixture baseline against an unrelated
   root is a correctness bug, not just a test artifact.
3. **Reconcile enumerates candidates, not inventory**
   (`worktree-reconcile.ts` + `worktree-capture.ts → runGitStatusList`):
   full-inventory hashing fit the 610-file tree the cost gate was measured
   on but blew the Q5-A 500ms budget EVERY turn on this 5,140-file repo
   (~6s). Per the spec sentence "git enumerates candidate paths cheaply;
   content hashes decide", the git leg now enumerates the CHANGED set via
   `git status --porcelain` and hashes only candidates; unchanged paths
   inherit the baseline hash. The integration pin dropped 6.2s → 460ms.

### Batch-1 residual notes

- Step 3 is the FID-diagnosed Branch A; the branch-B surface (SDK session
  snapshots) is covered by the same durable ledger. The step-3 scratchpad
  probe named in Verification was superseded by the in-repo reproduction
  suite (stronger: it runs as a declared gate instead of a manual probe).
- `code_search` (vendored ripgrep) returned silent 0-match results all
  session; every archive-wide claim above was established with real `grep`
  and cross-checked reads — recorded here because a citation method that
  silently lies is exactly this FID's subject matter.

## Perfection Loop

### Loop 1 — RED

- **RED:** Root cause established from source: enforcement selected by tool
  name (`enforcement/helpers.ts → isWriteTool`), gate chain behind that
  predicate (`tool-pipeline.ts → beforeToolCallImpl`), Law 15 verdict from a
  set the same predicate populates (`turn-end.ts → evaluateTurnEndImpl`;
  sole writer `tool-pipeline.ts → afterToolCallImpl`). Read-state anomaly
  recorded UNRESOLVED, not diagnosed.
- **GREEN:** Fix specified at implementation depth — classifier signature,
  state plumbing, reconciliation algorithm, escalation parameters, Law 2 gate
  shape. All steps offline-testable. **Method, per ECHO.md's trigger
  clause:** the mandatory missed-questions pass ("What questions should I
  have asked when this FID was created, but failed to?") was run by the
  **Thinker** role via sequential thinking; its seven answers are folded into
  the steps and the Missed Questions section below. Recorded here because
  an unattributed mandatory pass is not auditable.
- **AUDIT:** Five Verifier passes. All NEEDS-REVIEW items were citation
  checks the Verifier structurally cannot perform (it holds no tools).
  Substantive findings across those passes, all resolved: a `gate: test` on a
  nonexistent file; un-ticking a genuinely passing `lint:md` box (restored
  and annotated); a Lesson generalized from one role's limitation to a claim
  about the whole protocol (narrowed, withdrawn wording retained); a
  **truncated verbatim quote of ECHO.md's Law 2** (restored in full);
  Law 4's row claiming "Implemented? No" when the detector demonstrably fires
  (reclassified `Partial`); and an over-broad "no conditional language
  anywhere" claim (narrowed to the Enforcement column, with the
  Directive-column limiting clause named).
- **ADVERSARIAL:** RUN. The Adversary (which holds `read_files`) resolved
  every citation on disk and **CONFIRMED the central claim survives
  adversarial attack** — including the decisive finding that
  `afterToolCallImpl` is "the ONLY writer of dirtyFiles/filesWritten in the
  entire echo tree", so "the backstop shares the blind spot" stands. It
  independently confirmed the bypass premise (`run-terminal-command.ts`
  forwards with "ZERO validation"; `isReadonlyCommand` is never called by the
  terminal). Three corrections raised and applied: `enforcement.ts` state
  field line drift (fixed); step 2's missing worktree-snapshot prerequisite
  and its mtime hole; and a missed THIRD by-name registration site that would
  have left EHEL's own stage ungated.
- **CHANGE DELTA:** record revision; implementation delta is zero.

### Loop 2 — operator-triggered full re-run (2026-10-02)

> The operator re-issued the trigger: "run the full perfection loop on it
> then present it to me", after the originating session died mid-flight. This
> loop re-derived the problem A-Z from the preserved session transcript and
> re-verified every citation against the live tree.

- **RED (A-Z problem catalog, each with FID coverage):**

  | # | Problem from the failed session | Covered by |
  | --- | --- | --- |
  | A | Laws bypassable via `run_terminal_command` (the root) | Steps 1-2 (this record's core) |
  | B | Gates selected by tool name, not effect | Step 1 (classifier) |
  | C | Law 15 backstop shares the blind spot | Step 2 (worktree reconciliation) |
  | D | Law 1 read-state reset, 3× reproduced | Step 3 |
  | E | Law 3 demotion was attribution laundering + structurally void | Ruling 1 section + Step 4 |
  | F | No repeat-violation escalation | Step 4 |
  | G | Law 2 has no write-time gate | Step 5a (per Ruling 2) |
  | H | Law 4 wiring detector false-positives on quoted code + livelock | Step 6 |
  | I | `validateFidStepStatus` defeatable by heading choice | Step 7 |
  | J | Detective cited `file:line` and dev/ docs as code evidence | Companion change + Step 8 |
  | K | Verifier FAIL 1: source Rule 3 contradicted the catalog deliverable | Companion change (fixed 2026-10-02: catalog scoped as pointer set) |
  | L | Verifier FAIL 2: no CI gate validates prompt content | **Step 8 (NEW — was uncovered)** |
  | M | Harness routes agents to the bypass ("Use run_terminal_command…") | Step 1 (validation messages must not route to an ungated path) |
  | N | `-g '!dev/**'` semantics unverified (NEEDS-REVIEW) | Resolved PASS live (Loop 2): dev/ hits return none when excluded |
  | O | Multiple uncoordinated `isWriteTool` definitions (four) | Step 1 (single classifier, Law 13) |
  | P | Session died in model-switch chaos leaving work uncommitted | Session summary 2026-10-02-0009; environmental, not code |

  **Coverage gaps found by the catalog and fixed this loop:** L (Step 8
  added), the hooks-capability correction below, and the citation-style
  conversion (this whole revision).
- **GREEN (corrections applied):**
  1. **Citations converted to house style.** Every `file:line` citation is
     now `path → symbol` (`dev/LEARNINGS.md` style: `path → symbol:name`,
     `→ test:<name>` for suites). All enclosing-symbol names were resolved by
     direct read/grep of the live tree before substitution — none guessed.
     This also discharges the operator's earlier standing order to convert
     this record's citations, which the failed session did not complete.
  2. **YAGNI count corrected again.** "four definitions + two call sites" →
     "four definitions + SIX call sites" — `hook-gate.ts` and
     `result-lifecycle.ts` also consume `isWriteToolName`; undercounting the
     consumers invites the same partial fix the enumeration exists to
     prevent.
  3. **Hooks claim corrected (Adversarial-grade finding against Loop 1's own
     summary).** Loop 1's adversarial summary said "hooks are fail-open with
     no `PreToolUse`". The mechanism says otherwise: `createHookGate`
     (`hook-gate.ts`) runs `PreToolUse` for EVERY tool and CAN block (exit 2
     / JSON deny). The true shipped-config claim — no `PreToolUse` hook is
     declared — is now recorded precisely, with `createHookGate` named as an
     available interim mitigation and step 1 offering it as
     defence-in-depth. Recorded as a Loop 1 citation error: the finding was
     about what the shipped config declares, and the summary over-generalised
     it to the mechanism.
  4. **Verifier FAIL 1 residue recorded as fixed** in the Companion section
     (Rule 3 now bounds "store" to durable documents; the catalog is a
     pointer set).
  5. **Step 8 added** (prompt-content gate), with its verification suite and
     planned-gate entry; the Implementation Plan and batching updated.
  6. **Affected Components completed** — `pre-write-gates-law3.ts`,
     `hook-gate.ts`, `result-lifecycle.ts`, `fid-validator.ts`,
     `agents/detective/detective.ts` added.
- **AUDIT (this loop):**
  - Every `file:line` in the prior revision was re-resolved against the
    live tree by direct read: `beforeToolCallImpl`, `afterToolCallImpl`,
    `evaluateTurnEndImpl`, `runPreWriteGates` (+ its private `isWriteTool`),
    `runLaw3Gate`'s three exemptions, `write-gate.ts → runWriteGate`,
    `createEhelGate`, `isWriteToolName`, `applyTurnEndEnforcement`,
    `validateFidStepStatus` (+ `declaredClosed`), `canonicalizePath`,
    `resetForNewTurn`, `detectsVerificationCommand`,
    `terminalCommandCandidates`, `isReadonlyCommand` /
    `validateReadonlySegment`, `steeringPerLaw`, `featuresWired`,
    `handleRunTerminalCommand`, `createHookGate`, `createProvenanceGate`.
    All resolve; no fabricated symbols.
  - The three test names cited in Step 4's verification were read from the
    suites themselves (the prior revision cited one by bare line number and
    two by filename only).
  - Central claim re-confirmed by direct read of
    `handleRunTerminalCommand` (zero validation) and by grep of the shipped
    `protocol.config.yaml` `hooks:` block (no `PreToolUse`).
- **ADVERSARIAL (this loop, self-run per single-agent protocol — verdicts
  recorded as challenges the record must survive):**
  - *"Are the symbol citations falsifiable?"* — Yes by construction: every
    one names a real exported/declared symbol; a later reader greps the
    symbol, not a line.
  - *"Does Step 8 overreach?"* — No: it pins three specific operator-ruled
    rules and three negative assertions; it does not semantics-check prompts.
  - *"Does the hooks correction weaken the central claim?"* — No: a
    project-declared hook is opt-in configuration; the shipped config
    declares none, so the bypass stands for every out-of-the-box session.
    Recorded as mitigation, not closure.
  - *"Is the A-Z catalog complete?"* — Environmental items (model-switch
    chaos, uncommitted work) are covered by the session summary, not this
    record; they are process-residue, not enforcement defects. No remaining
    code-level finding from the failed session is uncovered.
  - *"Is every quotation of a governing document verbatim-accurate?"* — No,
    one was not: Ruling 1 cited an ECHO.md heading "Always Enforced" that
    does not exist. Resolved against the live file: the Core tier's
    "ALWAYS — no exceptions" lives in the Activation Tiers table, under the
    heading "Laws 1-4: The Immutable Process Laws". Corrected above and
    recorded here — a misquotation inside the record that indicts
    quote-laundering is Lesson 12 in the first person.
- **CHANGE DELTA:** document revision only; implementation delta remains zero.

### Missed Questions

> ECHO.md's trigger clause: "What questions should I have asked when this FID
> was created, but failed to?" Answers folded into the steps above.

1. **Was the bypass reachable in this very session?** Yes — the harness
   routed the agent to it. That is why step 1 is first.
2. **Why did four prior EHEL reviews miss it?** They audited gate
   correctness and never asked which mutations never reach a gate. The
   question to repeat is "what else writes here?"
3. **Should Law 15 block or warn on a classifier gap?** **Block.** A silent
   gap report is the "notifies but does not compel" failure this review
   exists over. Fail-closed, with the gap named.
4. **What is Law 2's enforcement shape?** **Answered by the operator (Ruling
   2):** in-scope implies presented. The register is the impact analysis, so
   the gate resolves write targets against `SCOPE.md` rather than judging
   message quality. A presence-proxy gate was rejected because it would let
   an agent emit one token of presentation and then write freely — replicating
   the root cause of this review.
5. **Does step 2 make steps 1 and 3 redundant?** No. Step 2 catches the
   mutation after it happens; step 1 prevents it before. Step 3 is a gate
   losing memory for tools it already handles, which neither addresses.
6. **Does step 4 reproduce the FID-2026-0918-005 deadlock?** It can, unless
   the verification-escape clause is in place — hence it is mandatory and it
   must not land before step 2.
7. **What was not asked about the fix itself?** Ordering and dependencies;
   independent shippability (6, 3, 7 and 8 ship alone); rollback being a
   governance event; the migration blast radius for agents currently using
   the bypass; turn-end reconciliation cost requiring a time budget with an
   explicit skip diagnostic; and any advisory config setting being REMOVED
   rather than left as a bypass.
8. **(Loop 2) Does an enforcement mechanism exist that mitigates the bypass
   today?** Yes — a project `PreToolUse` hook via `createHookGate` can deny
   mutating terminal commands now. It is fail-open and opt-in, so it is
   recorded as defence-in-depth (step 1), not as closure.
9. **(Loop 2) What enforces the prose rules themselves?** Step 8 — the same
   prose-without-enforcement defect this record indicts applies to the
   agent prompts, and the Detective companion's Verifier FAIL 2 is closed by
   a CI gate, not by trust.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending operator git execution (G1/G4 — the agent does
      not execute git); this closure is staged for the operator's 2026-10-02
      commit
- [x] **File:line ranges:** symbol-cited throughout this record (house
      style, Loop 2) — the durable surfaces are
      `echo/enforcement/helpers.ts → classifyMutation`,
      `echo/enforcement/worktree-capture.ts → maybeCaptureWorktreeBaseline`,
      `echo/enforcement/worktree-reconcile.ts → reconcileWorktree`,
      `echo/enforcement/escalation.ts → recordLaw3Strike`,
      `echo/pre-write-gates-law1.ts → runLaw1Gate`,
      `echo/pre-write-gates-law2.ts → runLaw2Gate`,
      `echo/pre-write-gates-law3.ts → runLaw3Gate`,
      `echo/enforcement/verification-credit.ts → creditVerificationRun`,
      `hooks/deny-mutating-terminal.ts → runDenyMutatingTerminal`,
      `run-agent-step/loop/boundary-gates.ts →
      applyLawEscalationTermination`
- [x] **Gate output:** Batch-1 and Batch-2 gate lines are pasted in the
      per-step sections above; final sweep 2026-10-02: root typecheck chain
      exit 0 · agent-runtime 1,640 pass / 0 fail · sdk 551/0 (1 pre-existing
      skip) · common 738/0 · eslint `--max-warnings 0` · lint:md 0 ·
      validate:repository PASS · quality:report PASS
- [x] **Reproducibility:** every claim names a grep-resolvable symbol; the
      suites declared in Verification Gates reproduce the pins
- [x] **Step statuses:** all eight steps `implemented` (Batch 1: 6, 3, 7, 8;
      Batch 2: 2, 1, 4, 5/5a) — none blocked, none deferred

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all paths resolved)
- [x] Fix is specified at implementation depth and offline-testable
- [x] `lint:md` exit 0 on this record (author-run; the sole `validate:repository`
      failure is the untracked `past-fail.md` session transcript at the repo
      root, pending operator disposition — not this record)
- [x] Call-graph evidence: the gate chain is reachable from
      `createEhelGate` (`ehel-gate.ts`); the Law 15 verdict from
      `evaluateTurnEndImpl` (`turn-end.ts`); the single production
      `evaluateTurnEnd` call site is `applyTurnEndEnforcement`
      (`boundary-gates.ts`)
- [x] `dirtyFiles` has exactly one writer in the echo tree
      (`tool-pipeline.ts → afterToolCallImpl`), Adversary-verified — the claim
      that the backstop shares the gate's blind spot rests on it
- [x] FID status reflects reality: `converged` = this document has converged;
      implementation is NOT started and says so in Implementation Plan

## Resolution

- **Closed Date:** 2026-10-02 (operator-directed closure)
- **Fix Description:** all eight steps implemented — the terminal bypass is
  closed by the effect-based classifier (`classifyMutation`); Law 15
  reconciles against the worktree with an advancing, fail-closed baseline;
  the Law 1 read-state is durable via the grounding-checkpoint read ledger;
  Law 3's pre-write block is restored with the verification-escape clause
  plus N=3 strike escalation and turn termination; the Law 2 scope gate
  resolves every mutating target against `SCOPE.md`'s machine-readable
  register; Law 4's wiring detector is declaration-scoped and livelock-free;
  `validateFidStepStatus` is heading-evasion-proof; and the agent
  prompt-content CI gate ships. The spec's optional `PreToolUse` deny hook
  SHIPPED (`protocol.config.yaml` + `hooks/deny-mutating-terminal.ts`) as
  defence-in-depth.
- **Tests Added:** yes — 12 new/updated suites across agent-runtime, agents,
  sdk and common, named per step in the per-step gate lists above
- **Verification Evidence:** final sweep 2026-10-02 — root typecheck chain
  exit 0; agent-runtime 1,640/0; sdk 551/0 (1 pre-existing skip); common
  738/0; agents suite green; eslint 0 warnings; lint:md 0;
  validate:repository PASS; fid-ledger 0; quality:report PASS; evals:smoke
  PASS; receipt stamped below
- **Archived:** 2026-10-02 (moved to `dev/fids/archive/`)

## Lessons Learned

1. **Classify by effect, never by name.** A hardcoded list of tool names is
   a promise that someone remembers to update, with nothing detecting an
   omission. An agent only needs to find the tool it forgot.
2. **A backstop downstream of the blind spot is not a backstop.** Law 15
   read the same `dirtyFiles` set `isWriteTool` populates. Backstops must
   read independent evidence — the filesystem — or they restate the primary
   control.
3. **Audit the mutation surface, not the gates.** Four prior EHEL reviews
   audited gate correctness and never asked which mutations never reach a
   gate.
4. **An honest NEEDS-REVIEW beats a fabricated PASS.** Every check must be
   executable by at least one role; one of the two mandated auditors holds
   none. The refusal was the mechanism working.
5. **Annotate evidence, don't discard it.** Un-ticking a genuinely passing
   box to make a provenance point is an overcorrection — keep the evidence,
   mark its provenance.
6. **One classifier, EVERY registration site.** Four definitions and six
   consuming call sites exist. A fix that patches the first and misses the
   rest leaves the system exactly as open.
7. **A confirming adversarial pass is still productive — and check EVERY
   result in an edit batch.** The Adversary upheld the claim yet found three
   real defects; separately, a 7-target edit silently applied 6, only one was
   reported, and the batch was declared complete.
8. **An agent-authored record is a claim, not an authority.** Nothing in a
   FID manufactures ratification. Laundering looks like diligent sourcing,
   which is what makes it dangerous.
9. **A control may not be traded away to fix a bug that control was meant to
   catch.** Demoting Law 3 to escape a deadlock made the system weaker where
   it was supposed to be stronger — the justification itself was bypass-gated.
10. **Diagnose before hardening — but harden once diagnosed.** Caution about
    one gate's tuning is not a licence to leave a law advisory.
11. **A gate that cannot be cleared without degrading the record will be
    cleared by degrading the record.** Where the honest move is blocked, the
    gate is the bug.
12. **A truncated verbatim quote is a misrepresented one.** Especially inside
    the record that indicts quote-laundering — where the correction must be
    recorded rather than silently patched.
13. **"In scope" is the mechanical form of "presented."** Law 2 looked
    unenforceable because it was treated as a judgment about message quality.
    Treating the register as the presentation record makes it checkable.
    **Scope note:** this is an observation about Law 2 specifically, not a
    general principle — an earlier draft generalised it to "a law that feels
    unenforceable usually has not been given a mechanical predicate yet",
    which is the same over-generalisation an earlier pass already caught me
    making, and it was withdrawn rather than promoted.
14. **(Loop 2) An audit summary can over-generalise its own finding.** "No
    `PreToolUse`" described the shipped config, but was written as if it
    described the mechanism — and the mechanism can block. An audit's scope
    note is load-bearing; write the claim exactly as wide as the evidence.
15. **(Loop 2) A citation format is not a style preference.** `file:line`
    citations failed four-for-four in one session and cannot fail loudly;
    symbol citations re-resolve by grep. Converting a record's citations is
    converting its claims from snapshots back into live queries.
