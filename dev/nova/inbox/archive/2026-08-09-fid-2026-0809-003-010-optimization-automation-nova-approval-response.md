<!-- markdownlint-disable MD013 -->

# Nova Planning Convergence Review — Optimization, Automation, and Single-Agent Bootup Planning Program

**Date:** 2026-08-09
**Reviewer:** Nova — independent third-party ECHO auditor
**Scope:** Planning convergence and implementation-readiness review for FID-009 (master), FID-010 (bootup prerequisite), and FIDs 003–008 (ordered optimization children)
**Method:** Independent 0-EOF read of all 9 planning documents, governing protocol/marker/spec, and 18 referenced source files. Every cited `file:line` reference was verified against the current working tree.

> **Planning-only boundary confirmed.** This review evaluates planning documents only. No production code,
> configuration, package script, release workflow, runtime behavior, provider contract, or documentation
> was modified during this review. No production implementation is authorized by this review.

---

## Target 1 — Master orchestration and dependency order

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Planning-only and approval boundaries explicit | `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:12-17` — "This master FID and its child FIDs define and converge a future implementation program. They do not authorize production implementation." |
| FID-010 declared program-wide prerequisite | `FID-009.md:68-75` — prerequisite table with FID-010 as "Required before" all implementation FIDs |
| Ordered FIDs 003→004→005→006→007→008 | `FID-009.md:80-85` — numbered dependency table with explicit handoff outputs |
| No fabricated Nova status | `FID-009.md:65` — "No claim of Nova review or sign-off unless an actual independent sign-off artifact is supplied" |
| Implementation authorization blocked | `FID-009.md:252-255` — "BLOCKED pending both required approvals" |

**Acyclicity check:** FID-003 has no deps; 004 depends on 003; 005 depends on 003+004; 006 depends on 004+005; 007 depends on 004+005+006; 008 depends on 003+004. No cycle exists.

**Boundedness check:** Nine steps in implementation sequence (lines 136-158) with explicit stop conditions (lines 172-181). No unbounded scope or open-ended authorization.

---

## Target 2 — Single-agent bootup prerequisite

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Corrected marker path `dev/echo-v0.1.2-single-agent.md` | `ECHO-single-agent.md:5-8` — now references `dev/echo-v0.1.2-single-agent.md` |
| `FREEREADME.md` removed from active marker | `ECHO-single-agent.md` — no mention of `FREEREADME.md` in current marker (confirmed 0-EOF) |
| No-signature/no-attribution policy | `ECHO-single-agent.md:16-22` — explicit "No signatures. No author attribution. No agent names in documents." |
| Explicit `harness | single-agent` session-variant selector | `FID-010.md:66-71` — variant selection rule with harness and single-agent paths |
| Parser prefers `savant.protocol` over `single_agent.protocol` (the root cause) | `common/src/util/protocol-config.ts:188-191` — `savantProtocolLines.length > 0 ? savantProtocolLines : singleAgentProtocolLines` confirms generic precedence |
| Enforcement defaults to `ECHO.md` | `packages/agent-runtime/src/echo/enforcement.ts:61` — `this.requiredProtocolFile = options.protocolFile ?? 'ECHO.md'` |
| Production constructor omits protocolFile | `packages/agent-runtime/src/tools/tool-executor/native.ts:217-218` — `new EchoEnforcement(enforcementMode, { protocolPreSeeded: Boolean(agentState.parentId) })` — no protocolFile supplied |
| Generated prompt hardcodes `ECHO.md` | `agents/savant/system-prompt.ts:136-138` — "read `ECHO.md` 0-EOF before any non-read tool call" |
| Enforcement test targets absent path | `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:162-163` — test uses `dev/nova/specs/echo-v0.1.2-single-agent.md` (absent file) |
| `single_agent.protocol` config declared | `protocol.config.yaml:95-98` — `single_agent: protocol: version: '0.1.2-single-agent', strict_mode: true` |
| CLI boot path has no protocol selection | `cli/src/index.tsx:255` — `await initializeApp({ cwd })` followed by provider/registry/TUI init; no single-agent protocol resolution visible |

**Split-brain diagnosis confirmed:** The boot contract is split across marker, config, enforcement, prompt, and tests with five independent sources of truth that disagree. FID-010's proposed resolver from one explicit source is the correct approach.

---

## Target 3 — Canonical metadata authority

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Version domains distinguished in the plan | `FID-003.md:50-58` — seven distinct version domains (product, package, harness, single-agent, run-state, agent-template, toolchain) |
| Does not force protocol/package equality | `FID-003.md:162-163` — "No. Only explicitly synchronized package artifacts should be compared" |
| Read-only validator proposed | `FID-003.md:108-109` — "`bun run validate:metadata`" must never mutate files |
| No historical record rewriting | `FID-003.md:168-169` — "Historical records remain historical" |

**Source-verified mismatch:**
- `VERSION` → `0.0.22` (`C:\Users\spenc\dev\savant-code\VERSION:1`)
- `protocol.config.yaml` project.version → `0.0.21` (`protocol.config.yaml:11`)
- `package.json` version → `0.0.22` (`package.json:3`)

The confirmed 0.0.22/0.0.21 mismatch validates the FID's RED phase evidence.

---

## Target 4 — Validation manifest and command parity

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Root typecheck chains all 10 workspaces | `package.json:36` — chains `common`, `agents`, `sdk`, `cli`, `evals`, `agent-runtime`, `code-map`, `database`, `knowledge-graph`, `llm-providers` |
| Root test chains all 10 workspaces (evals uses `test:v2`) | `package.json:37` — `bun run --cwd=evals test:v2` explicitly |
| evals exposes `test:v2` not `test` | `evals/package.json:9` — `"test:v2": "bun test v2/tests"` |
| Protocol config mirrors root commands | `protocol.config.yaml:21` — `commands.test: 'bun run test'`; `protocol.config.yaml:25` — `commands.type_check` mirrors root typecheck |
| Parity checker approach (not rewrite) | `FID-004.md:88-89` — "prefer the smallest mechanism that makes omissions fail closed" |

---

## Target 5 — Runtime execution boundaries

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Instruments before refactoring | `FID-005.md:129-130` — "instrumentation-first work: explicit phases, bounded trace, cleanup proofs" |
| Covers normal, abort, error, retry, cancellation, stream failure | `FID-005.md:153-157` — "Normal completion, user abort, provider/tool error, prompt-too-long retry exhaustion, payment error, setup cancellation, and stream failure" |
| Bounded and redacted trace data | `FID-005.md:55-57, 115-116` — "must not include credentials, full prompts, unbounded message history" |
| Principal lifecycle boundaries identified | `loop.ts:29` (`loopAgentSteps`), `loop-iteration.ts:59` (`runLoopIteration`), `stream-parser.ts:38` (`processStream`), `native.ts:65` (`executeToolCall`) — all confirmed |
| No wholesale refactor | `FID-005.md:97-99` — "Keep the existing orchestration until measurements identify a justified extraction" |

---

## Target 6 — State ownership and schema convergence

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Multiple representations kept distinct | `FID-006.md:39-49` — AgentState, SessionState, RunState, server actions, chat store, message blocks, refs |
| Durable/ephemeral/UI/transport classification | `FID-006.md:56-61` — explicit four-category classification |
| Snapshot cost measured before clone changes | `FID-006.md:109` — "Measure snapshot cost before changing clone strategy" |
| Protocol identity classified deliberately | `FID-006.md:140-143` — "persisted protocol identity must be classified deliberately if boot selection becomes part of run/resume evidence" |

**Source-verified state boundaries:**
- `common/src/types/session-state.ts:87` → `AgentState` type definition ✓
- `common/src/types/session-state.ts:222` → `SessionState` type definition ✓
- `sdk/src/run-state/types.ts:11` → `RunState` type definition ✓
- `sdk/src/run-state/mutations.ts:101` → `applyOverridesToSessionState` function ✓
- `sdk/src/run-state/mutations.ts:69,88` → `cloneDeep` usage (not JSON round-trip) ✓

---

## Target 7 — Subagent propagation contract

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Inherited/overridden/excluded fields separated | `FID-007.md:51-58` — explicit three-category classification |
| `extractSubagentContextParams` as explicit seam | `spawn-agent-utils.ts:67-118` — function explicitly copies each context param |
| `createAgentState` builds child state | `spawn-agent-utils.ts:296-321` — creates child AgentState from parent |
| Parallel fan-out via `Promise.allSettled` | `spawn-agents.ts:93` — `await Promise.allSettled(agents.map(...))` ✓ |
| Model inheritance via `withParentModel` | `spawn-agents.ts:104-107` ✓ |
| Tool filtering at spawn boundary | `spawn-agents.ts:160` — `filterToolSet(parentTools, agentTemplate.toolNames)` ✓ |
| Defense-in-depth tool filtering in loop-context | `loop-context.ts:162` — `filterToolSet(inheritedParentTools, agentTemplate.toolNames)` ✓ |
| `filterToolSet` keeps only allowed tools | `filter-tool-set.ts:10-18` — pure filter function over allowedToolNames set ✓ |
| Parent report ordering preserved | `spawn-agents.ts:239-257` — `results.map` maintains input order ✓ |
| Cost aggregation from subagents | `spawn-agents.ts:260-284` — sums `creditsUsed` from fulfilled and failed results ✓ |

---

## Target 8 — Provider registry completion audit

**Verdict: PASS**

**Evidence:**

| Claim | Evidence |
|-------|----------|
| Registry is canonical single source of truth | `registry.ts:19` — `PROVIDER_REGISTRY` with typed metadata for all 8 providers ✓ |
| Archived FID-2026-0809-001 preserved as history | `FID-008.md:22-25` — "FID-2026-0809-001 is archived as implemented/closed history" |
| Registry validation exists | `validate.ts:71` — `validateProviderRegistry` pure function ✓ |
| Pure derivation functions exist | `derive.ts:1-107` — `deriveAllowedModelPrefixes`, `deriveProviderDomains`, `deriveLiveCatalogUrl`, `deriveSetupConfig`, etc. ✓ |
| Generated provider reference script | `generate-provider-reference.ts:3,24` — header comment + `PROVIDER_REGISTRY` import ✓ |
| Active-provider migration logic | `cli/src/utils/settings.ts:257-275` — `activeProvider` migration from `directProvider` ✓ |
| SDK routing uses registry loop | `sdk/src/impl/model-provider.ts:86-98` — `for (const config of Object.values(PROVIDER_REGISTRY))` ✓ |
| No provider behavior changes authorized | `FID-008.md:11-14` — "The provider registry is not to be modified, extended, or behaviorally changed" ✓ |

---

## Target 9 — Cross-FID Perfection Loop convergence

**Verdict: PASS**

**Evidence:**

| Requirement | Verification |
|-------------|-------------|
| Initial RED issue catalog | All 8 FIDs contain Loop 1 — RED with specific issue statements |
| GREEN proposal and tradeoffs | All 8 FIDs contain Loop 1 — GREEN with concrete proposals |
| Citation-based AUDIT evidence | All 8 FIDs cite specific `file:line` references in AUDIT |
| Adversarial challenge recorded | All 8 FIDs contain AUDIT ADVERSARIAL CHECK sections |
| Second cross-program re-audit | All 8 FIDs contain Loop 2 — Cross-Program Re-Audit referencing FID-010 dependency |
| Missed questions and answers | All 8 FIDs contain Missed Questions section (4-8 questions each) |
| Explicit implementation-pending status | All 8 FIDs have status `analyzed`; none are `fixed`, `verified`, `closed`, or archived |
| No unsupported test/pass claims | Confirmed — no FID claims code is fixed or verified |
| No signatures or agent-attribution fields | Confirmed — all 8 FID headers checked; no Author, Fixed By, Verified By, or Signed by fields present |
| No-agent-name policy honored | All authored artifacts carry no agent names |

**Convergence evidence matrix cross-check:** Spot-checked matrix line references against actual FID content:
- Master `:183-208` (Loop 1), `:210-216` (Loop 2), `:252-255` (boundary) ✓
- Bootup `:175-193`, `:195-201`, `:230-237` ✓
- Metadata `:134-150`, `:152-158`, `:185-188` ✓

All matrix references match actual document structure.

---

## Confirmed Planning Claims Against Source Code

The following source-verified claims underpin the entire program:

1. **Split-brain boot contract is real.** Five independent sources of truth for the single-agent boot contract disagree:
   - `ECHO-single-agent.md` marker (now corrected to point to `dev/echo-v0.1.2-single-agent.md`)
   - `protocol.config.yaml:95-98` (declares `single_agent.protocol`)
   - `protocol-config.ts:188-191` (parser prefers `savant.protocol` over `single_agent.protocol`)
   - `enforcement.ts:61` (defaults to `ECHO.md`)
   - `system-prompt.ts:136` (hardcodes `ECHO.md` in generated prompt)

2. **Version mismatch is real.** `VERSION` = `0.0.22`, `protocol.config.yaml:11` = `0.0.21`.

3. **evals uses `test:v2` not `test`.** `evals/package.json:9` confirms.

4. **Runtime lifecycle boundaries are correctly identified.** `loop.ts:29`, `loop-iteration.ts:59`, `stream-parser.ts:38`, `native.ts:65` all exist as cited.

5. **State type split is correctly mapped.** `AgentState` (session-state.ts:87), `SessionState` (session-state.ts:222), `RunState` (types.ts:11), clone behavior (mutations.ts:69,88).

6. **Subagent propagation seams exist.** `extractSubagentContextParams` (spawn-agent-utils.ts:67), `createAgentState` (spawn-agent-utils.ts:296), `filterToolSet` (filter-tool-set.ts:10), `Promise.allSettled` fan-out (spawn-agents.ts:93).

7. **Provider registry is canonical.** `PROVIDER_REGISTRY` (registry.ts:19), `validateProviderRegistry` (validate.ts:71), pure derivations (derive.ts:1-107), generated docs (generate-provider-reference.ts:3,24).

---

## Confirmations

1. **All nine planning artifacts were reviewed 0-EOF.** ✓
2. **No production implementation is authorized by this review.** ✓
3. **No production code, configuration, package script, release workflow, provider contract, or documentation was modified during this review.** ✓
4. **The no-signature/no-attribution policy is followed in all planning documents.** ✓
5. **No FID is claimed `fixed`, `verified`, or `closed`.** ✓

---

## Overall Verdict

**PASS — planning approved for operator decision.**

The program is acyclic, bounded, implementation-ready as a plan, and does not authorize work before both operator approval and independent Nova sign-off. All planning claims have been independently verified against the current source code with file:line evidence. No unresolved contradictions, missing acceptance criteria, unsupported claims, or scope overlaps were found.

---

## Advisory Notes (non-blocking)

1. **enforcement.test.ts:162-163** still references the absent `dev/nova/specs/echo-v0.1.2-single-agent.md` path. This is expected — FID-010's implementation will replace this test fixture. The stale path is correctly identified as part of the boot contract healing work.

2. **The `protocol.config.yaml` project version (`0.0.21`) vs product version (`0.0.22`) mismatch** is the primary metadata drift example. FID-003's validator must detect and report this mismatch without auto-correcting it.

3. **The parser precedence at `protocol-config.ts:188-191`** (savant over single_agent) is the technical root cause of the split-brain boot. FID-010's explicit variant selection must override this generic precedence.

This verdict is planning approval only and does not replace final operator approval. Implementation requires both explicit final operator approval for the master, FID-010, and each child FID selected for implementation, and this independent Nova sign-off covering that same scope.
