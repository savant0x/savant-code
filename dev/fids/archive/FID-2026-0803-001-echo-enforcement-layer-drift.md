# FID: ECHO Protocol Enforcement Layer Drift

**Filename:** `FID-2026-0803-001-echo-enforcement-layer-drift.md`
**ID:** FID-2026-0803-001
**Severity:** high
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

---

## Summary

Audit the live ECHO enforcement contract across `agents/savant/savant.ts`,
`protocol.config.yaml`, `ARCHITECTURE.md`, `ECHO.md`, and the runtime enforcement
paths. The audit found that the source-of-truth documents, agent capability
metadata, protocol configuration loader, and runtime gates have drifted apart.
One finding concerns an inert policy contract at runtime; the remaining
findings are trusted-capability, lifecycle, and documentation mismatches that
can cause agents, operators, or future maintainers to make incorrect decisions.

Historical FIDs deleted by the operator as intentional cleanup are explicitly
out of scope. This FID audits only live source files and current runtime paths.

## Environment

- **OS:** Windows (`win32`), Bash-compatible shell
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.x
- **Protocol:** Savant ECHO v0.2.0; Savant contract v0.1.2-freebuff
- **Project version:** 0.0.15
- **Commit/State:** `4aaa3f9` plus the existing uncommitted quality-session change set
- **Scope:** `agents/savant/savant.ts`, `protocol.config.yaml`, `ARCHITECTURE.md`,
  `ECHO.md`, protocol loader, FSM transition handler, tool executor, and
  programmatic-step execution

## Detailed Description

### Problem

ECHO claims to be a non-negotiable, machine-enforced protocol, but the current
contracts disagree in several places:

- The runtime intentionally bypasses an agent template's declared `toolNames`
  for all `handleSteps` tool calls.
- `protocol.config.yaml` declares commands, quality thresholds, testing policy,
  FID policy, sandbox policy, perfection-loop limits, and session policy, but
  the production loader parses only `strict_mode`, `language`, Savant fields,
  and top-level FID filenames. Most configuration changes therefore have no
  runtime effect.
- The documented agent roster and tool restrictions do not match the actual
  agent definitions and `createSavant()` tool set.
- Recorder is documented as controlling FID archiving, but no registered tool
  gives it a filesystem move/archive operation.

### Evidence and Findings

#### ECHO-1 — Programmatic `handleSteps` capabilities lack a separate allowlist

- **Severity:** medium
- **Files/lines:**
  - `packages/agent-runtime/src/tools/tool-executor.ts:367-380`
  - `packages/agent-runtime/src/run-programmatic-step.ts:353-382`
  - `agents/thinker/thinker-with-files-gemini.ts:40-57`
- **Evidence:** The executor rejects a tool absent from
  `agentTemplate.toolNames` only when `!fromHandleSteps` is true. The
  programmatic executor sets `fromHandleSteps: true` for every generator yield.
  `thinker-with-files-gemini` declares `toolNames: []` but its generator yields
  `read_files`.
- **Problem:** The model-visible tool filter remains strict, but a trusted
  programmatic generator can invoke any registered tool without declaring that
  capability in `toolNames`. This is an intentional internal-generator escape
  hatch, not conclusively an untrusted-template vulnerability; however, the
  exception is not represented as a separate, auditable capability allowlist.
- **Impact:** Capability reviews cannot tell which tools are model-callable
  versus trusted programmatic primitives. If a local or database template is
  ever treated as untrusted, the broad bypass becomes a real authorization risk;
  until then this is a separation-of-duties and auditability gap.

#### ECHO-2 — Thinker-with-files capability declaration contradicts its generator

- **Severity:** medium
- **Files/lines:**
  - `agents/thinker/thinker-with-files-gemini.ts:40-57`
  - `packages/agent-runtime/src/run-programmatic-step.ts:353-382`
  - `packages/agent-runtime/src/run-agent-step.ts:905-923`
- **Evidence:** The agent declares `toolNames: []`, while `handleSteps` yields
  `read_files` when `filePaths` are present. The runtime's `fromHandleSteps`
  bypass currently makes this call executable, even though the model-visible
  child tool set is empty.
- **Problem:** The agent metadata says the child has no tools, the instructions
  say it should not call tools, and the generator secretly performs a read. This
  makes capability audits and FID-007 child-tool-set reasoning incomplete.
- **Impact:** Future tightening of ECHO-1 can silently break this thinker; current
  audits can incorrectly conclude that the agent is fully toolless. The fix must
  distinguish internal programmatic capabilities from model-callable capabilities.

#### ECHO-3 — `strict_mode` and most protocol configuration are not live enforcement

- **Severity:** high
- **Files/lines:**
  - `protocol.config.yaml:14-16,27-87`
  - `common/src/util/protocol-config.ts:46-99`
  - `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts:12-21,87-99`
- **Evidence:** `readProtocolConfig()` parses only Savant `strict_mode`, language,
  Savant protocol values, and open FID filenames. Code search found no
  production caller of `readProtocolConfig()`; the only reference is its test.
  `MAX_ITERATIONS = 10` is hardcoded in the transition handler while
  `perfection_loop.max_iterations: 10` in YAML is not parsed. Commands, paths,
  quality, testing, fid policy, sandbox permission mode, convergence settings,
  and session settings are likewise not parsed or consumed.
- **Problem:** Operators can change the documented configuration and receive no
  corresponding runtime behavior. Even the parsed `strict_mode` value is not
  connected to the phase gates or prompt law activation in production.
- **Impact:** The project can claim strict ECHO enforcement while running with
  hardcoded defaults and inert policy fields. This is a protocol governance gap,
  not merely stale documentation.

#### ECHO-4 — Hybrid idle-to-green policy is not objectively documented

- **Severity:** medium
- **Files/lines:**
  - `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts:14-21,56-78`
  - `protocol.config.yaml:64-67`
  - `ARCHITECTURE.md:7-9,145-164`
  - `ECHO.md:16-19,245-255`
- **Evidence:** The FSM allows `idle → green`. The no-open-FID check runs only
  when `phase === 'green' && currentPhase !== 'idle'`, so `idle → green` bypasses
  the open-FID requirement. The architecture overview says code is never
  written until a converged FID, while ECHO's Hybrid Mode separately permits
  direct orchestrator writes for simple tasks.
- **Problem:** The runtime has a deliberate Hybrid Mode exception, but the
  architecture overview still says code is never written before a converged FID.
  The exception is not represented as one consistent, objective policy, and the
  YAML `fid.auto_create`/`max_open_fids` fields do not govern it.
- **Impact:** Agents and reviewers cannot reliably determine whether a write is
  protocol-compliant. A future documentation or gate change may accidentally
  remove the intended Hybrid Mode or allow complex work to skip FID review. The
  fix must define objective routing criteria and make the exception explicit in
  the enforcement path and documentation.

#### ECHO-5 — Roster/tool tables are materially stale

- **Severity:** medium
- **Files/lines:**
  - `agents/savant/savant.ts:100-119,122-136`
  - `ARCHITECTURE.md:19-31,177-186`
  - `ECHO.md:55-67`
  - `agents/recorder/recorder.ts:12-21`
  - `agents/detective/detective.ts:57-67`
  - `agents/scribe/scribe.ts:12-21`
- **Evidence:** `createSavant()` includes `run_readonly_command`, conditional
  `gravity_index`, `apply_patch`, and other tools absent from the Orchestrator
  rows in `ARCHITECTURE.md` and `ECHO.md`. The docs list Detective as only
  `code_search`/`set_output`, while the definition also grants list, glob, read,
  and subtree tools. Docs list Recorder `grep` and `transition_phase`, while
  the definition grants `code_search` and neither of those two. Scribe has the
  same `grep` versus `code_search` mismatch.
- **Impact:** Capability reviews, incident response, and future agent prompts can
  be based on false permissions. This directly undermines separation-of-duties
  documentation even where runtime filtering is correct.

#### ECHO-6 — Recorder FID lifecycle claims are not executable

- **Severity:** medium
- **Files/lines:**
  - `ARCHITECTURE.md:25-31,181-186`
  - `ECHO.md:61,72-75,475-519`
  - `agents/recorder/recorder.ts:12-21,31-46`
  - `common/src/tools/constants.ts:40-82`
- **Evidence:** The docs say Recorder creates, updates, archives, and controls
  FID lifecycle. Recorder's actual `toolNames` are only
  `write_file`, `read_files`, `glob`, `code_search`, and `set_output`. Search
  found no registered `create_fid`, `update_fid`, or `archive_fid` tool and no
  runtime rename/move handler. `protocol.config.yaml`'s FID policy is not parsed.
- **Problem:** Recorder can write an FID and CHANGELOG content if path gating
  permits it, but cannot perform the documented archive move itself. The
  lifecycle is procedural/orchestrator- or CLI-driven, not Recorder-exclusive
  as the docs claim.
- **Impact:** The protocol's separation-of-duties claim is false at the archive
  boundary, and the documented Recorder workflow is incomplete unless another
  explicitly identified actor performs the move.

#### ECHO-7 — Open-FID detection checks filenames, not FID status or convergence

- **Severity:** medium
- **Files/lines:**
  - `common/src/util/protocol-config.ts:103-115`
  - `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts:56-78`
- **Evidence:** `scanOpenFids()` returns every top-level `FID-*.md` file outside
  an `archive` path. It does not parse `**Status:**`, Perfection Loop state,
  unresolved work, or convergence evidence.
- **Problem:** Any FID-shaped file counts as open. A closed/stale/incomplete FID
  left in `dev/fids/` satisfies the green-transition precondition, while a
  valid FID with a nonstandard status is indistinguishable from an open one.
- **Impact:** FID-bound gating is presence-based rather than state-based and can
  be bypassed by stale files or fail to recognize lifecycle state accurately.

#### ECHO-8 — Protocol command and quality claims do not match the real gates

- **Severity:** low
- **Files/lines:**
  - `protocol.config.yaml:27-62`
  - `package.json:20-33`
  - `AGENTS.md:81-94`
- **Evidence:** YAML `commands.build` is `bun run ci`, whose root script builds
  SDK and Savant-Free only. YAML `commands.type_check` omits
  `packages/database`, while the root typecheck includes it. YAML lint says
  `bunx eslint .` without the repository's `--max-warnings 0` gate. YAML format
  says `bunx prettier --check .`, while the repository currently has known
  Prettier warnings and AGENTS documents changed-file formatting as the
  practical gate.
- **Impact:** ECHO audit instructions can report a green result using commands
  that do not cover the same surface as the actual project quality gates.

#### ECHO-9 — Helper/legacy architecture references are stale

- **Severity:** low
- **Files/lines:**
  - `ARCHITECTURE.md:208-220`
  - `docs/agents-and-tools.md:35,41`
  - `CHANGELOG.md:454,880,992,1000`
  - filesystem: `agents/debug/browser-agent-traces/`
- **Evidence:** ARCHITECTURE references missing
  `agents/savant/savant-deep.ts`, missing `agents/__tests__/context-pruner.test.ts`,
  and missing `evals/benchmark/eval-savant-code-hard.json`. The current tree
  still contains a `debug/` directory not included in the documented 9+5
  hierarchy. `docs/agents-and-tools.md` still documents `savant-deep`.
- **Impact:** Repository navigation, cleanup audits, and agent-roster reasoning
  use paths and counts that no longer describe the live tree. This is
  documentation debt, not an archive-restoration request.

### Root Cause

The ECHO contract evolved through several targeted FIDs and product/rebrand
changes, but source-of-truth synchronization was manual. Runtime policy was
added as local constants and path gates while the YAML schema and architecture
pages retained broader aspirational settings. Agent templates also gained
programmatic `handleSteps` capabilities without a separate declaration for
internal tool calls.

## Impact Assessment

### Affected Components

- Orchestrator definition and generated agent capabilities
- Programmatic and model-visible tool authorization
- FSM phase transitions and FID preconditions
- Protocol configuration loading
- Recorder/FID lifecycle workflow
- Architecture and agent capability documentation

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: protocol configuration claims can be inert (`strict_mode`/policy fields)
- [x] Medium: trusted capability metadata, Hybrid Mode policy, and FID lifecycle semantics are inconsistent
- [x] Low: command/documentation/helper-tree drift

## Proposed Solution

### Approach

Establish one machine-readable capability and policy contract, while preserving
intentional Hybrid Mode behavior explicitly:

1. Define separate model-visible tools and trusted programmatic tools in the
   agent template schema, or validate every `handleSteps` yield against an
   explicit internal-tool allowlist rather than bypassing `toolNames` globally.
2. Add the required internal capability to `thinker-with-files-gemini` or make
   its read operation a dedicated runtime primitive with an auditable name.
3. Extend the protocol config loader to parse only policy fields the runtime
   will actually honor, and wire strict mode, perfection-loop limits, commands,
   and FID policy to their production consumers. If a field is intentionally
   advisory, rename/document it as advisory instead of presenting it as active.
4. Make Hybrid Mode a named, objective policy: document when `idle → green` is
   legal, enforce complex-task/FID criteria where possible, and align the
   architecture overview with ECHO's hybrid exception.
5. Generate or test architecture/tool tables from live agent definitions and
   canonical tool constants. Correct Recorder, Detective, Scribe, Orchestrator,
   helper-directory, and legacy-path references.
6. Give the FID lifecycle an explicit executable boundary: either add safe
   Recorder-scoped lifecycle tools or revise the docs so archive movement is an
   orchestrator/CLI operation with Recorder approval/documentation.
7. Parse FID status/convergence before treating a file as an open-FID gate.
8. Align `protocol.config.yaml` commands with the actual hard gates, including
   database typecheck and zero-warning ESLint; document the intentional
   changed-file Prettier boundary if full-repository formatting remains
   deferred.

### Verification

- Add focused tests proving model-visible tools cannot expand through
  `handleSteps` and that approved internal programmatic tools remain executable.
- Add tests for `thinker-with-files-gemini` capability metadata and FID-007 child
  tool filtering.
- Add protocol-config tests proving every claimed enforced field is parsed and
  consumed, or explicitly classify non-consumed fields as advisory.
- Add transition tests for idle-to-green Hybrid Mode, open-FID status parsing,
  maximum iterations, and missing/invalid config behavior.
- Run all commands from the corrected config plus the repository's hard gates:
  four-way typecheck, focused common/agent-runtime/agents tests, full affected
  package tests, zero-warning ESLint, Prettier on changed files, and markdownlint.
- Grep every documented agent/tool/path reference against the live tree and
  generated bundle.

## Perfection Loop

### Loop 1

- **RED:** Completed 0-EOF reads of the primary ECHO sources and runtime paths;
  independently grounded 9 findings with line citations, code search, and
  package/tool evidence. Historical deleted FIDs were excluded per operator
  instruction.
- **GREEN:** Proposed solution recorded; no source/config/documentation files
  were changed.
- **AUDIT:** Independent review found no blocking omission. It required
  severity/framing corrections: ECHO-1 changed from high to medium as an
  intentional trusted-generator capability gap; ECHO-4 changed from high to
  medium as intentional Hybrid Mode policy ambiguity; ECHO-6 narrowed to
  lifecycle ownership; ECHO-2 retained as the concrete metadata contradiction.
- **SELF-CORRECT:** Applied all four audit corrections and preserved the
  operator's intentional archive cleanup as out of scope.
- **IMPLEMENTATION AUDIT (code-reviewer-deepseek-flash):** No blockers. One
  MED (transition-phase `maxIterationsCache` not cwd-keyed → fixed with a
  per-cwd Map) + 3 LOWs (end_turn declaration-required contract tightening
  documented; docs/agents-and-tools.md thinker-variant classification
  relabeled; bundle regen diff confirmed clean — generated file is gitignored).
- **CHANGE DELTA:** 0% of runtime semantics beyond the approved contract; all
  9 findings implemented.

### Missed Questions

1. **Which ECHO settings are normative versus advisory?** The robust default is
   that every field presented as a gate must have a production consumer; fields
   that cannot be enforced should be explicitly labeled advisory.
2. **Are programmatic generator tools part of an agent's public capability?** The
   robust default is to treat them as a separate trusted capability surface with
   explicit allowlists and tests, not as an unconditional bypass.
3. **Is Hybrid Mode an exception to FID-bound execution?** Yes, but only for
   objectively simple tasks; the exception must be represented in both runtime
   policy and documentation.
4. **Who owns archive movement?** The robust default is one executable owner
   (CLI/runtime lifecycle handler) plus Recorder-authored evidence, rather than
   claiming Recorder can perform an operation it cannot execute.
5. **What makes an FID open?** A filename alone is insufficient; the status and
   Perfection Loop state must be parsed or the gate must be described as a
   presence check rather than an open-FID check.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist in the live tree
- [x] Runtime citations verified with direct reads/grep
- [x] Historical deleted FIDs intentionally excluded from scope
- [x] Implementation matches the proposed solution (approved, all 3 stages)
- [x] Typecheck ×4 green (common/agents/agent-runtime/cli); agent-runtime suite
      566 pass / 0 fail; CLI suite 2748 pass / 0 fail; focused common 0 fail;
      zero-warning ESLint; `bun run lint:md` exit 0; bundle regenerated
- [x] FID status reflects actual implementation state (`verified`)

## Resolution

- **Fixed By:** Savant — approved via "resume"
- **Fixed Date:** 2026-08-03
- **Fix Description:** All 9 findings implemented across three stages.
  Stage 1 (ECHO-1/2): new `PROGRAMMATIC_PRIMITIVES` single source in
  `common/src/tools/constants.ts`; new optional `programmaticToolNames` field
  on AgentTemplate/DynamicAgentTemplate/AgentDefinition/SecretAgentDefinition;
  fail-closed validation in `run-programmatic-step.ts` (handleSteps yields must
  be in toolNames ∪ programmaticToolNames ∪ primitives);
  `thinker-with-files-gemini` declares `read_files` programmatically (ECHO-2
  metadata honesty). Stage 2 (ECHO-3/7/8): `readProtocolConfig` parses
  `perfection_loop.max_iterations`; transition handler uses it via a per-cwd
  cache; FID gate reworded as presence-based with Hybrid Mode documented;
  `protocol.config.yaml` type_check now includes packages/database, lint uses
  `--max-warnings 0`, advisory fields annotated. Stage 3 (ECHO-4/5/6/9):
  ARCHITECTURE.md/ECHO.md/AGENTS.md roster + helper-dir + archive-ownership +
  Hybrid Mode corrections; docs/agents-and-tools.md savant-deep references
  removed; MIGRATION.md quick-reference row replaced.
- **Tests Added:** Yes — `programmatic-tool-authorization.test.ts` (4:
  declared-tool, primitive, programmaticToolNames, undeclared-rejection);
  `agent-toolnames-validation.test.ts` +2 (programmaticToolNames allowlist +
  thinker ECHO-2 metadata); `protocol-config.test.ts` updated for maxIterations.
- **Verified By:** 4-way typecheck, agent-runtime 566/0, CLI 2748/0, focused
  common 0 fail, ESLint 0 warnings, lint:md 0, bundle regenerated + validated.
- **Commit/PR:** None
- **Archived:** 2026-08-03 (moved to `dev/fids/archive/` by orchestrator per
  ECHO-6 ownership note)

## Lessons Learned

1. A protocol document, YAML schema, prompt constant, agent definition, and
   runtime gate are separate sources of truth unless a test or generator ties
   them together.
2. `toolNames` filtering must distinguish model-visible capabilities from
   trusted programmatic primitives; otherwise either the runtime is too loose
   or legitimate internal generators are forced to lie in their metadata.
   (`end_turn` stays declaration-required — a deliberate contract tightening
   for user-authored dynamic templates, surfaced via an actionable error.)
3. “Open FID” is a semantic state, not merely a filename. Presence checks are
   useful fail-safe defaults but should not be described as convergence-aware
   enforcement.
4. The operator's intentional deletion of poisoned historical FIDs is not a
   protocol defect. Future archive-integrity checks must audit live files and
   explicit retention policy, not assume historical records remain on disk.
