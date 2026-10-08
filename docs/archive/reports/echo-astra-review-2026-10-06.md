# ECHO.md review of Astra's recommendations

## Astra's review (verbatim)

To earn a defensible 10/10, ECHO needs fewer ambiguities, stronger evidence contracts, and tests proving its laws cannot be bypassednot more absolute language.

Based on your attached ECHO.md, these are the 10 fixes Id require. The implementation items are requirements to verify, not claims that your harness currently lacks them.

1. Establish one authoritative rule set

Fix: Replace contradictory paragraphs with one explicit permissions and precedence matrix.

Resolve these first:
G1 permits agent pushes, while Automation Levels says pushing remains forbidden.
Law 2 requires approval before every implementation, while Level 3 permits execution without per-step approval.
Complex-task routing alternates between over 100 lines and over 100 lines plus new APIs/imports.
Recorder exclusivity and Hybrid exceptions appear in multiple places.

Define exactly what each combination of mode, autonomy level, role, action, and approval permits. Distinguish standing authorization from one-action approval. Move superseded wording into amendment history.

Acceptance: Every supported combination produces one unambiguous authorization decision.

2. Separate plan convergence from implementation completion

Your lifecycle section already introduces converged correctly; the earlier FSM and execution instructions still tell the Recorder to close and archive before implementation.

Fix: Propagate a consistent lifecycle throughout:

Created  Analyzed  Converged  Implementation authorized  Implemented  Verified  Committed  Closed

Pre-implementation audits examine the design, existing evidence, and proposed tests.
Post-implementation audits examine actual code and executed tests.
New production callers cannot be required to exist before their implementation is authorized.
Closure requires the implementation commit and matching verification evidence.

Acceptance: Neither a polished plan nor ship it can falsely produce an implementation-complete status.

3. Make verification prove behavior

The attached definition requires static analysis + runtime tests, but Hybrid substitutes static analysis + code review.

Fix:
Require relevant behavioral tests for executable changes.
Keep independent review as an additional checknot a substitute for execution.
Use grep to locate wiring, then test the affected entry point and observable result.
Define separate validation requirements for documentation-only changes.
Treat missing or skipped required tests as unresolved, not passing.

This follows the distinction NIST makes between code review/analysis and testing executable software. (nvlpubs.nist.gov)

Acceptance: A feature with a matching function name but a broken execution path fails verification.

4. Bind every verdict to the exact artifact tested

Fix: Give every verification run a harness-generated evidence record containing:

Source-tree or changeset digest.
Test/configuration inputs and relevant toolchain versions.
Commands, exit codes, timestamps, and captured output.
Runner identity, policy version, and evidence references.

Keep authoritative records outside ordinary agent write permissions. Invalidate affected approvals when their inputs change. SLSAs provenance model is a useful foundation for connecting artifacts, inputs, execution identity, and results. (slsa.dev)

Acceptance: Passing output from revision A cannot certify revision B; agent-written tests passed text cannot impersonate a runner record.

5. Make security invariants unconditional

Fix: Move Law 12 out of the relaxable Extended tier. Make these always-on:

Credential and sensitive-data protection.
Workspace, filesystem, and network boundaries.
Authorization for destructive or externally visible operations.
Separation of trusted policy from repository content, retrieved text, and tool output.
Protection against agents weakening their own active enforcement policy.

Apply authorization at every execution route, including shell helpers and delegated agentsnot just named write tools. That matches OWASPs deny-by-default and every-request authorization guidance. (cheatsheetseries.owasp.org)

Acceptance: strict_mode: false, delegation, or an alternate mutation tool cannot disable these protections.

6. Strengthen independence without banning developer testing

Fix: Replace the writer cannot verify with:

The writer may run development tests, but cannot issue the final independent acceptance verdict.

Then:
Give reviewers the complete diff, requirements, and runner evidencenot only the writers summary.
Let the tool-less Verifier request missing evidence through a defined harness interface.
Require the Adversary to justify overrides with evidence.
Keep unresolved disagreements blocked or escalated; reviewer rank alone must not erase a failure.

Acceptance: A reviewer cannot approve incomplete evidence, and an Adversary cannot turn a failing test into a pass through argument alone.

7. Replace character-count restrictions with risk-based change control

Fix: Remove the universal 10% character-change rejection as a correctness gate.

Use:
Security sensitivity, blast radius, reversibility, and architectural impact for escalation.
Coherent change sets as verification boundaries, rather than requiring every intermediate edit to compile.
Read-version checks so a file changed by another session cannot be silently overwritten.
Explicit handling for new files and generated artifacts.
Atomic application or rollback of related edits.

Keep size thresholds as review signals, not proof of safety.

Acceptance: A one-line authorization change escalates, while a large mechanical rename can follow a proportionate, fully verified path.

8. Preserve accountability while guaranteeing termination

Fix: Keep every discovered issue is recorded, but separate that from every discovered issue must be implemented in this run.

Your existing blocked pending operator ruling concept can support this without silently dropping work:
Execute within authorized scope and budget.
Record newly discovered work with evidence and its required authorization.
Escalate scope expansion rather than recursively expanding forever.
Apply time, cost, retry, and delegation limits across the entire task tree.
Stop against explicit acceptance criterianot zero imaginable improvements.

Bounded recursion and resource limits are also part of OWASPs agent-security guidance. (cheatsheetseries.owasp.org)

Acceptance: Exhausting a budget produces an honest blocked state, preserved work, and a clear operator decisionnot false completion or another unbounded loop.

9. Replace overengineering mandates with measurable quality requirements

Fix these specific clauses:
Replace the ban on the simplest approach with the least complex design that satisfies documented requirements.
Replace mandatory abstraction after two occurrences with an assessment of shared semantics and expected change.
Allow documented departures from existing patterns when those patterns are defective.
Replace ALL cases and universal 1,000 agents requirements with defined operating limits, threat models, and load tests.
Allow TypeScript unknown at untrusted boundaries, followed by validation/narrowing. TypeScript explicitly defines it as the type-safe counterpart of any; treating it as a general safety shortcut is backwards. (typescriptlang.org)

Acceptance: Reviews evaluate correctness, coupling, failure handling, and measured requirementsnot abstraction count or architectural grandeur.

10. Make governance itself a tested product

Fix: Maintain a versioned control registry connecting:

Rule  applicability  enforcement point  required evidence  failure behavior  regression test

Test both allowed and forbidden behavior, including:
Premature closure and illegal phase transitions.
Missing, fabricated, or stale evidence.
Approval replay and unauthorized delegation.
Concurrent edits and interrupted recovery.
Attempts to weaken checks, policy, or test coverage.
Legitimate workflows that must not deadlock.

Run these tests whenever prompts, tools, policies, or providers change. OWASP specifically recommends adversarial regression testing across those changes. (cheatsheetseries.owasp.org)

Acceptance: Every mechanically enforceable mandatory rule has passing positive and negative tests; human-review requirements have explicit evidence and escalation contracts.

Priority: Fix 15 first, then 69, with 10 validating every change.

The standard Id use for 10/10 governance is: clear authority, truthful state, artifact-bound evidence, bounded execution, and demonstrated enforcement within a defined threat model. Stronger wording alone would not raise the score.

The useful next deliverable would be a section-by-section ECHO amendment with exact replacement clauses and acceptance tests.j

## My review

Astra’s review is useful. Its strongest finding is **truthful lifecycle state**: [ECHO.md](/C:/Users/spenc/dev/savant-code/ECHO.md:295) says to close and archive a FID before Forge writes code, while its later status definition and G2 require implemented, verified, committed work before closure. That is a real contradiction, not a preference about wording. The [phase validator](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/echo/fid-validator.ts:282) also treats `closed` status as sufficient evidence for its `complete` phase. I would settle what `COMPLETE` means before drafting replacement clauses.

Here is my code-grounded read of the ten points:

| Point | What I found |
|---|---|
| **1. Authority** | Confirmed documentation ambiguity. G1 permits agent stage/commit/push, while [Automation Levels](/C:/Users/spenc/dev/savant-code/ECHO.md:744) say those levels do not authorize a commit or push by themselves. Those can coexist, but the required *action-specific authorization* is not stated in one place. The single-agent document adds different wording. |
| **2. Lifecycle** | **Confirmed contradiction and highest priority.** `converged` already exists, but the earlier FSM still closes before implementation. A plan audit must not certify code that does not exist. |
| **3. Behavioral verification** | Confirmed policy gap: [Hybrid Double Audit](/C:/Users/spenc/dev/savant-code/ECHO.md:393) lists static analysis plus review, despite the earlier definition saying static analysis plus runtime tests. The repo has executable [FID test gates](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/echo/fid-verification-gates.ts:53), so this calls for aligning the policy and coverage rules, not inventing a test runner. NIST treats code review/analysis and software testing as distinct verification activities. [NIST SSDF](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf) |
| **4. Artifact-bound evidence** | Partly implemented, with a substantive gap. FID receipts hash **the FID text**, not the tested source tree. The [audit manifest](/C:/Users/spenc/dev/savant-code/scripts/audit-evidence-types.ts:28) records HEAD, Bun version, commands, output hashes, and counts of working-tree changes; counts cannot identify the changed bytes. The [provenance system](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/provenance/session.ts:120) signs individual write receipts, but that is a different claim from “this test result certifies this entire changeset.” SLSA’s provenance model is a useful reference for specifying that link. [SLSA provenance](https://slsa.dev/spec/v1.0/provenance) |
| **5. Security invariants** | The textual issue is real: Law 12 sits in the relaxable tier. I did find unconditional containment and EHEL gate ordering in the [tool gate chain](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/tools/tool-executor/gate-chain.ts:31). I would audit each execution route before claiming `strict_mode: false` actually bypasses a security control. |
| **6. Independent verdicts** | I agree with Astra’s distinction: development testing by the writer is useful; final acceptance needs independent evidence. The current [verdict binding](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/provenance/verdict-binding.ts:38) signs verdict text against a write hash. That does not, by itself, prove a failing test was resolved. |
| **7. Change control** | The 10% code-change rejection is asserted in ECHO, but my targeted search found the implemented 10% cap for **skill patches**, not a universal code-write cap. So this may be documentation overstating enforcement. The [Law 1 gate](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/echo/pre-write-gates-law1.ts:47) tracks that a path was read, but I did not find a read-version comparison there for concurrent edits. |
| **8. Termination** | The proposal is sound, but the repo is not starting from zero: [loop guard rails](/C:/Users/spenc/dev/savant-code/packages/agent-runtime/src/run-agent-step/loop-guard-rails.ts:118) include iteration, role, cycle, and optional deadline limits. The unresolved policy question is how a budget stop preserves discovered work without calling unfinished work complete. |
| **9. Quality language** | I agree strongly. In particular, ECHO’s blanket restriction on TypeScript `unknown` conflicts with its intended use at untrusted boundaries; TypeScript describes `unknown` as safer than `any` because it requires narrowing before use. [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown) |
| **10. Governance tests** | Existing tests cover FID gates, mutation paths, provenance attacks, and governance scenarios. I did not find a single rule-to-enforcement-to-test registry. That is a coverage and auditability improvement, not a claim that governance has no tests. OWASP recommends adversarial regression tests after material changes to prompts, tools, policies, or providers. [OWASP AI Agent Security](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) |

I would **change Astra’s priority order** slightly: resolve **2 and 1 together first**, then **4 and 3**, then **5 and 6**, with **10 used to test each amendment as it lands**. Point 2 determines what evidence is needed; point 1 determines who may authorize and certify each transition. Writing a control registry before those meanings are settled would codify the ambiguity.

I have made no edits and run no tests. This is a source review, not a demonstrated bypass assessment.
