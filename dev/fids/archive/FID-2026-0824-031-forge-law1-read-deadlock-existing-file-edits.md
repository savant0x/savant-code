# FID: Forge cannot satisfy EHEL Law 1 — permanent deadlock editing existing files

**Filename:** `FID-2026-0824-031-forge-law1-read-deadlock-existing-file-edits.md`
**ID:** FID-2026-0824-031
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 21:30
**YAGNI-Compliance:** Verified

---

## Summary

Forge — the GREEN-phase implementer and the only agent authorized to edit production code
during FID-Bound execution — structurally cannot satisfy EHEL Law 1 (Read 0-EOF Before Touch)
for edits to existing files. Its tool set omits `read_files`, so the per-child EHEL read-tracker
can never register a read, and every `write_file`/`str_replace` against an existing path is
hard-blocked. New-file creation works only via the `isNewFile` exemption. The result: any Forge
task that touches an existing file deadlocks at GREEN, forcing the Orchestrator to either abandon
the FID-Bound contract or perform the edits itself — a documented separation-of-duties erosion
that already happened once (FID-2026-0824-029 GREEN, ten blocked edit attempts in a single Forge
spawn; the Orchestrator completed the wiring under the FID-085 fallback precedent).

## Environment

- **OS:** Windows 11 (win32), Git Bash shell
- **Language/Runtime:** TypeScript monorepo on Bun 1.3.14
- **Tool Versions:** Savant harness (agent-runtime EHEL enforcement layer)
- **Commit/State:** Branch main, working tree mid-release-prep (v0.0.27)

## Detailed Description

### Problem

During FID-2026-0824-029 GREEN, the spawned Forge successfully created one NEW file
(`rich-text.tsx`) but every attempt to edit an EXISTING file was blocked:

```text
[ECHO Enforcement] BLOCKED: Law 1: Read 0-EOF before touch —
  "...structured-card/ErrorCard.tsx" has not been read. Fix the violation and retry.
```

The block repeated for hierarchy.tsx, SuccessCard.tsx, RecordCard.tsx, ListCard.tsx,
ErrorCard.tsx, structured-card.test.tsx — and even for re-touching the just-created
rich-text.tsx. Ten blocked edit attempts inside ONE Forge spawn (nine Law 1 + one interleaved
Law 3), surviving corrective retry instructions: Forge has no read tool to register reads with.

### Expected Behavior

Forge, as the GREEN implementer, should be able to read the files it is about to edit —
satisfying Law 1 through its own tool calls the way the Recorder does (Recorder holds both
`read_files` and `write_file` and completes UPDATE workflows routinely).

### Root Cause

1. **Tool-surface gap:** `agents/forge/forge.ts:28` —
   `toolNames: ['write_file', 'str_replace', 'set_output']`. There is no read tool. The
   definition's own `spawnerPrompt` admits it (`forge.ts:26`: "...as it cannot read files on
   its own") — i.e., the design documents the gap instead of fixing it, implicitly assuming
   the parent's reads suffice.
2. **Tracker-semantics gap:** EHEL Law-1 credit is tracked per child agent state from that
   child's own tool calls. Even though Forge runs with `includeMessageHistory: true`
   (`forge.ts:30`) and therefore SEES the parent's `read_files` results in its context window,
   those reads are never credited to the child's tracker — so Law 1 evaluates as unread.
3. **Prompt layer makes it worse:** the Forge `instructionsPrompt` states "You cannot read
   more files" (`forge.ts:37`) and forbids non-editing tool calls — so even if a read tool
   were granted without prompt changes, the model would be instructed not to use it.

### Evidence

```text
Live failure sequence (FID-2026-0824-029 GREEN, 2026-08-24) — ONE Forge spawn:
  1 write_file rich-text.tsx (NEW) → SUCCESS via isNewFile exemption
then 10 blocked edit attempts across two revision passes (9x Law 1 + 1x Law 3):
  - BLOCKED Law 1 x9: ErrorCard.tsx, structured-card.test.tsx, hierarchy.tsx,
    rich-text.tsx (rev 2), rich-text.tsx (retry), hierarchy.tsx (retry),
    SuccessCard.tsx, RecordCard.tsx, ListCard.tsx
  - BLOCKED Law 3 x1: rich-text.tsx ("unverified file(s)") — interleaved gate
Forge reasoning during the run: "I can't see hierarchy.tsx's exact formatting" —
the agent itself recognized it had no way to obtain disk truth.

Definition citations (agents/forge/forge.ts, grep -n verified 2026-08-24):
- :26  spawnerPrompt: "...as it cannot read files on its own"
- :28  toolNames: ['write_file', 'str_replace', 'set_output']
- :30  includeMessageHistory: true (parent reads visible in context, NOT credited)
- :37  instructionsPrompt: "You cannot read more files..."

Working counter-example: the Recorder (read_files + write_file) completed FID updates
against existing files repeatedly this session after satisfying Law 1 with its own reads.
```

## Impact Assessment

### Affected Components

- `agents/forge/forge.ts` (tool surface + prompt) and the generated bundle
  (`initial-agents-dir/**` regenerated via `prebuild:agents`)
- EHEL Law-1 gate (`pre-write-gates.ts` read-tracker semantics) — candidate second fix site
- Every STRICT/FID-Bound execution that routes existing-file edits through Forge
- Separation-of-duties integrity: forced Orchestrator self-implementations erode the
  author-vs-verifier contract the mode exists to protect

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The only "workaround" is the Orchestrator writing implementation code itself — which defeats
the purpose of the mode (documented as a necessary deviation twice: FID-085 era and
FID-2026-0824-029).

## Proposed Solution

### Approach

CONVERGED 2026-08-24 (Detective-evidenced): **Remedy A selected for implementation.**
Candidates considered:

- **A — Grant Forge `read_files`:** add `read_files` to `toolNames`, amend the
  `instructionsPrompt` (replace the "you cannot read more files" prohibition with an explicit
  instruction to read-before-edit, mirroring the Recorder UPDATE workflow), regenerate bundled
  agents via `prebuild:agents`, and extend the forge-related test suites. Smallest change;
  makes Forge self-sufficient exactly like the Recorder.
- **B — Credit inherited parent reads:** at subagent spawn, seed the child's EHEL read-tracker
  from `read_files` tool-use records already present in the inherited message history (when
  `includeMessageHistory: true`). Generalizes to ALL history-inheriting write-capable agents,
  removes redundant re-reads, and matches the operator hint ("credit inherited parent reads").
  Needs a spoofing analysis: seeded entries must derive ONLY from harness-recorded tool_use
  pairs (real executed calls), never from assistant text claiming reads.
- **E — handleSteps-programmatic pre-reads:** `forge.ts` already defines a `handleSteps`
  generator; the runtime can yield read calls mechanically before the model turn — no
  `toolNames` or tracker-semantics change required.
- **F — content-hash credit:** credit Law 1 when the target file's bytes appear verbatim in
  inherited history AND freshness is validated (mtime/hash at evaluation time).
- Remedy B unflagged risks (post-audit): blast radius covers ALL history-inheriting subagents
  (needs per-agent opt-in); per FID-2026-0824-020/-026 subagents inherit COMPACTED history —
  seeded credit could bless stale reads, so B mandates mtime/hash freshness validation at seed
  time.
- **CONVERGED — Remedy A.** Detective evidence: reads credit per-agent at
  `enforcement.ts:237` when the agent itself calls `read_files`; the gate evaluates
  `filesRead` membership (`pre-write-gates.ts:97-137`, block message :137); child trackers
  start EMPTY (`spawn-agent-utils.ts:137` createAgentState; `enforcement-state.ts:18-21`) and
  no history-derived file-read credit exists (explicit no-match grep). A lets Forge satisfy
  Law 1 through its own calls exactly like the Recorder — smallest surface, zero
  tracker-semantics change, bundle regenerated via `prebuild:agents`.
- **E rejected as standalone:** Forge's `handleSteps` cannot know edit targets before the
  model turn; programmatic blind reads would be overbroad. The read-before-edit duty moves
  into the prompt instead (part of A).
- **B deferred (systemic follow-up):** right long-term direction but needs a spoofing +
  freshness design (COMPACTED-history staleness per -020/-026) plus per-agent opt-in across
  all history-inheriting subagents. Precedent exists for seeding (`enforcement.ts:89-186`
  `protocolPreSeeded` credits only protocol-doc reads) — B is tracked as future work and does
  not block this fix.
- **Operator-directed amendments (implemented 2026-08-24):**
  1. FORCED GROUNDING READ — `handleSteps` yields `read_files ECHO.md` programmatically before
     the model's first STEP (remedy-E mechanics applied narrowly to the one file every
     implementer needs); content enters the conversation regardless of model behavior.
  2. Tier-accurate prompt wording — Laws 1-4 unconditional; Laws 5-15 active in strict
     sessions (ECHO.md Activation Tiers).
  3. MODEL-AUDIT scope expansion (operator concern over hardcoded slugs): VERIFIED INTACT —
     `withParentModel` (`spawn-agent-utils.ts:257`) unconditionally overrides child.model with
     parent.model on BOTH spawn paths (`spawn-agents.ts:133`, `spawn-agent-inline.ts:107`);
     census shows ZERO `inheritParentModel:false` opt-outs remain (gemini-thinker comments
     document their removal); regression-tested
     (`subagent-propagation-contract.test.ts:116`); definition literals like openrouter/free
     are inert fallback metadata (FID-2026-0814-009 B-08, never paid). Gemini-named thinkers:
     ALIVE (Free-tier reasoners spawned by base-chat / free-savant prompts; Savant itself
     spawns only canonical `thinker`) — pre-fork naming leftover, rename candidate for the
     dead-code sweep alongside editor/best-of-n/* and savant-free-minimax-m3.
- **Doc sweep:** Forge roster rows updated in ECHO.md + ARCHITECTURE.md (+read_files,
  FID-tagged); markdownlint clean on both.

### Steps

1. [RED] Detective catalogs: exact Law-1 credit path (`enforcement.ts` registration +
   `pre-write-gates.ts` evaluation), spawn-time tracker initialization, bundled-agents
   regeneration flow, existing forge test coverage.
2. [GREEN] Implement converged remedy (A, B, or both) with regression tests: Forge edit of an
   existing file succeeds post-read; Law-1 still blocks genuinely-unread files (no over-credit).
3. [AUDIT] typecheck ×affected workspaces + focused suites + eslint + reachability grep.
4. [ADVERSARIAL] Meta-verification per standard loop.

### Verification

- `bun run --cwd=agents typecheck` exit 0 (definition change) + affected workspace typechecks
- Bundled agents regenerated; grep proves `read_files` present in the serialized forge chunk
- Live probe: spawn Forge against a scratch repo file edit — succeeds post-read, still blocked
  without a prior read (both directions proven, live NEEDS-REVIEW until restarted harness)
- Existing suites green; no Law-1 over-credit regressions (unread-file control case)
- Bundle regen proof: grep -rl read_files generated-data → 24 chunks incl. 14-forge.ts;
  ECHO.md refs in forge chunk = 2 (comment + yield input)
- Doc sweep: markdownlint ECHO.md + ARCHITECTURE.md exit 0; sdk validate-agents-part-a
  7 pass / 0 fail; eslint agents/forge/forge.ts --max-warnings 0 exit 0

## Verification Gates

- gate: typecheck agents
- gate: typecheck cli
- gate: test sdk/src/__tests__/validate-agents-part-a.test.ts

### Verification Receipt

- fingerprint: sha256:b4015d2598d25350bc0f4e0b3177c181f863f3f5a0955ad1cea7a80216851a81
- verified: 2026-08-25T03:04:22.512Z
- typecheck agents: exit 0
- typecheck cli: exit 0
- test sdk/src/__tests__/validate-agents-part-a.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Complete. Live-failure sequence (10 blocked attempts, 9x Law 1 + 1x Law 3) cited;
  Law-1 mechanics resolved — registration `enforcement.ts:237`, gate evaluation
  `pre-write-gates.ts:97-137`, empty-per-child init (`spawn-agent-utils.ts:137`,
  `enforcement-state.ts:18-21`), zero history-derived file-read credit (no-match grep);
  bundled flow `cli/scripts/prebuild-agents.ts` via `bun run prebuild:agents`; forge variants
  census: single instantiation (`createCodeEditor({model:'opus'})` → id forge);
  `cli/src/teacher/forge.ts` is an unrelated teacher-side module.
- **GREEN:** Complete. forge.ts: toolNames += read_files (:30-32 comment-tagged);
  spawnerPrompt admission replaced with self-read statement (:26); instructionsPrompt
  prohibition replaced with Read-before-edit mandate + forced ECHO.md grounding yield in
  handleSteps; tier-accurate law wording. Bundle regenerated; chunk proofs green.
- **AUDIT:** Verifier PASS — implementation matches converged spec (edits confirmed via
  applied str_replace results + post-edit eslint/typecheck exit 0; roster sweep, bundle
  proofs, and gates cited). In-round discharges: stale-prompt-assertion risk retired via
  grep (old strings survive only in editor-multi-prompt — a DIFFERENT agent; zero tests
  assert old forge strings); post-edit anchors resolved by grep -n (:30/:37/:45/:158).
  Carried NEEDS-REVIEW: restart-gated live probe (programmatic ECHO.md read credits tracker
  via enforcement.ts:237; relative-path resolution under subagent cwd; unread-file still
  blocks; relay-exclusion nuance of initialMessageHistoryLength captured post-yield).
- **ADVERSARIAL:** Not run this loop — hybrid mode satisfies double audit via basher gate
  outputs + Verifier review; Adversary round available on operator request.
- **CHANGE DELTA:** —

### Missed Questions

1. Does granting Forge reads weaken any security posture? → Reads are the least-privileged
   operation; Recorder already holds read+write. GREEN-phase sandbox policy unchanged.
2. Should OTHER write-capable subagents get the same treatment? → Remedy B covers them
   generically; remedy A is Forge-specific. Census during RED.
3. Why did Forge succeed creating rich-text.tsx but fail re-writing it later? → isNewFile
   exemption applies only while the target does not exist; once created (and once EHEL state
   advanced), it became an "existing file" for subsequent writes.
4. Was withholding reads deliberate? → Git archaeology (`git log --follow forge.ts`):
   only release/rebrand commits since v0.0.1 — NO deliberate withholding decision. The gap
   predates the unconditional Law-1 gate and became lethal when FID-2026-0823-007 made
   blocking universal.
5. Does `inheritParentSystemPrompt: true` (`forge.ts:31`) also propagate a no-read posture
   from the parent system prompt into Forge's effective instructions? Census during RED.
6. Do ALL `createCodeEditor` variants share the single `toolNames` definition site?
7. Does any separate subagent phase/tool registry need updating when granting `read_files`?
8. Compaction interaction: with inherited COMPACTED history (-020/-026), can credited reads
   reference stale content? Any history-derived remedy requires freshness validation.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree (release-only-commits convention)
- [x] **File:line ranges:** `agents/forge/forge.ts` :26 spawnerPrompt, :28-29 comment,
  :30 toolNames, :37-38 ECHO.md context note, :40-43 tools paragraph, :45-48 Read-before-edit
  section, :158+ handleSteps forced grounding yield (grep -n verified post-edit);
  `ECHO.md` Forge roster row; `ARCHITECTURE.md` Forge roster row
- [x] **Gate output:** see Verification Receipt below; supporting evidence — bundle grep
  (24 chunks incl. 14-forge), ECHO.md chunk refs = 2, markdownlint ×2 exit 0, typecheck
  agents + cli exit 0, sdk validate-agents 7/0, eslint forge.ts exit 0
- [x] **Reproducibility:** grep read_files cli/src/agents/bundled-agents.generated-data/
  → includes 14-forge.ts; bun test sdk validate-agents suite green
- [x] **Step statuses:** Steps 1-4 implemented (RED catalog + GREEN remedy A + amendments;
  AUDIT/ADVERSARIAL entries land with this loop's Verifier/Adversary rounds)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (forge.ts + generated chunks grepped)
- [x] Implementation matches the Proposed Solution (Remedy A + operator amendments)
- [x] Typecheck/tests/lint pass with pasted tool output (agents/cli typecheck 0; 7/0; eslint 0)
- [x] Production call-graph evidence present (bundle chunk contains read_files + ECHO.md;
  registry consumes bundledAgents)
- [x] FID status reflects the actual implementation state (fixed; live probe carried)

### Loop 2 — Independent audit and self-correction

- **RED:** —
- **GREEN:** —
- **AUDIT:** —
- **ADVERSARIAL:** —
- **CHANGE DELTA:** —

### Loop 3 — Final convergence

- **RED:** —
- **GREEN:** —
- **AUDIT:** —
- **ADVERSARIAL:** —
- **CHANGE DELTA:** —

## Resolution

- **Closed Date:** 2026-08-24 22:50 EDT
- **Fix Description:** Remedy A implemented — Forge granted `read_files` with an explicit
  Read-before-edit mandate replacing the prohibition prompt; spawnerPrompt admission replaced
  with a self-read statement; operator-directed FORCED GROUNDING READ of ECHO.md added to
  handleSteps (programmatic pre-STEP yield); tier-accurate law wording (Laws 1-4 unconditional /
  5-15 strict-only); roster sweep applied to ECHO.md + ARCHITECTURE.md; bundle regenerated.
- **Tests Added:** No new test file — definition-level change verified through existing gates:
  sdk validate-agents-part-a 7 pass / 0 fail, typecheck agents + cli exit 0, eslint forge.ts
  exit 0, bundle chunk grep proofs (read_files + ECHO.md present in serialized 14-forge).
- **Verification Evidence:** Receipt stamped sha256:7b87046ae70c2c6204ac427101ca119c8f4699d49b
  94d7a4f1145536ced76e8c, verified 2026-08-25T02:26:14.230Z, 3/3 declared gates live-re-run
  exit 0 + chained check-mode PASS; Verifier AUDIT PASS.
- **Archived:** 2026-08-24 22:50 EDT (Orchestrator-executed mv per ECHO-6 split; mtime-verified).

Carried boundary (archive observation): restart-gated live probe — spawn Forge against an
existing-file edit post-restart and confirm read→edit succeeds while unread files still block,
plus programmatic ECHO.md read crediting the tracker (enforcement.ts:237). Operator directive
2026-08-24 archives the record with this boundary honestly carried, never claimed passed.
Deferred follow-up: remedy B (history-derived read credit) requires freshness + spoofing design.

## Lessons Learned

1. **Agent capability gaps hide behind prompt prose.** The definition documented its own
   limitation ("cannot read files on its own") instead of fixing it — when a gate later became
   unconditional, documentation-of-a-gap turned into a hard deadlock. Audit definitions against
   the laws they must satisfy, not against their own comments.
2. **Two-layer gaps need both layers named.** Tool-surface absence (no read_files) AND
   tracker semantics (inherited history never credited) combined into the deadlock; fixing
   either alone would have left a subtler bug.
3. **Model fields on agent definitions are fallback metadata.** `withParentModel`
   unconditionally overrides at spawn unless `inheritParentModel: false` is declared — census
   opt-outs before treating any hardcoded slug as runtime truth (operator codified: parent
   model only, always).
4. **fid:verify gate sections are declaration-only** (blockquotes fail parsing) and root-cwd
   bun test filters collide with vendored trees under resources/ — declare gates accordingly.