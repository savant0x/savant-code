# Workflow selection for safe parallel work

Status: three-way comparison complete; reviewed-draft candidate prepared and
awaiting four additional physical requests. FID-2026-1017-003.

**Plan:** 4 observations and a decision. Subject: choose a buildable workflow
from equal final deliverables rather than assuming more agents are faster.

## Decision record

### Thought 1

Existing `handleSpawnAgents` (`spawn-agents.ts`) already runs children
concurrently and joins their reports. The previous live graph had no useful
sibling overlap. C's boundary analysis can inspect its own sources before A's
spawn analysis completes; D can join both. Removing that ordering dependency
is a hypothesis to test, not a measured speed claim.

### Branch A from 1

Fused: one bounded read-only investigator gets all nine source files and the
complete final brief. No handoff overhead; no independent model cross-check.

### Branch B from 1

Flat: C/A/B investigate separate source domains independently, then D receives
all three validated artifacts and all final sources. Existing batch semantics
remain. C is admitted first; HTTP concurrency stays two, so queued time counts.

### Branch C from 1

Chain: A -> C and B/C -> D, retaining the previous research dependencies.
Same final brief and final sources; extra intermediate context is an intentional
workflow cost. This is the control, not a new asynchronous API.

### Thought 2

The predeclared semantic review checks the same final obligation for each
variant. Mechanical citation success alone does not satisfy these checks.

| Check | Required final-answer behavior |
| --- | --- |
| Spawn visibility | Separate streamed lifecycle, returned reports and cost aggregation. |
| Tool boundary | Distinguish native/XML completion; consume at a safe parent boundary. |
| Steering | Distinguish genuine user input from child/compliance messages. |
| Persistence | Filesystem-first restore; DB fallback; drain/return is not a durable atomic commit. |
| Concrete workflow | Identify work to combine/overlap and distinguish proposal from existing code. |
| Safety | Retain true dependencies, write ownership, independent code review and stale-result fencing. |
| Unsafe shortcut | Identify a shortcut that would violate delivery or evidence semantics. |
| Limits | State what is unproven; invent no benchmark or durability guarantee. |

Fixed dispatch order: fused, flat, chain. Nominal sends: 1 + 4 + 4 = 9.
All variants use the actual SDK, read tools, selected Apixo route, source
fingerprint, output ceiling, and request guard. There is one live sample per
variant, no synthetic delay, and no statistical reliability claim.

### Thought 3

All three variants completed on source fingerprint
`6ccdadadf823b4e4d5cf1a82c7fa27ca3fd5d3ad225f05b2d27ece45b5a065cf`.
Evidence: `dev/research/parallel-agent-slice-1zh9YM/report.json`, with separate
SQLite stores and full histories. No source changes, inference errors or retries.

| Variant | Wall time | Sends | First-step history characters | Final words |
| --- | ---: | ---: | ---: | ---: |
| Fused | 41.230 s | 1 | 187,020 | 389 |
| Flat | 90.202 s | 4 | 380,030 | 422 |
| Chain | 91.603 s | 4 | 419,768 | 358 |

History characters are the sum of JSON-serialized first-step message histories,
not actual provider input tokens, pricing or billed usage. All final answers
exceeded the advisory 350-word instruction; the hard request ceiling remained
4,000 output tokens. No output was trimmed or silently repaired.

Mechanical checks passed for all nine tasks. Replaying actual read_files JSON
results against the stricter read-receipt gate verified every assigned file's
content after CRLF normalization, including uncited files. Exact predecessor
artifact JSON and digests appear in the correct downstream histories.

Flat's 1.401 s difference from chain is inconclusive. Although C was declared
first, source preparation and SDK scheduling meant its HTTP dispatch followed
A's completion: actual request intervals show A/B occupying the first two
permits, then C. Task preparation order is not provider admission priority.
There is one sample per variant and fixed order, not a latency distribution.

The fastest draft is not accepted. Its recommendation says late reports/costs
are ignored unless their generation is current. Stale delivery must be fenced,
but incurred/uncertain usage must remain accounted for. This is an unsafe
proposal in model output, not an observed cost-loss bug in the current runtime.
The existing `handleSpawnAgents` explicitly includes partial failed-child cost.

| Common review | Fused | Flat | Chain |
| --- | --- | --- | --- |
| Spawn/report/accounting distinction | Supported | Supported | Supported |
| Native/XML and safe boundary | Supported | Supported | Supported |
| Genuine versus synthetic steering | Supported | Supported | Supported |
| Files/DB authority and drain caveat | Supported | Supported | Supported |
| Concrete proposed workflow and limits | Present | Present | Present |
| Stale-result handling preserves incurred cost | **Unsafe** | Explicitly retained | Explicitly retained |
| Existing mandatory review triggers preserved | Ambiguous risk qualifier | Ambiguous risk qualifier | Required phases retained |
| Production-ready contract | Not accepted | Needs refinement | Needs refinement |

Selected references are mechanically valid, but not every prose assertion has
a selected citation. This review checks source-backed distinctions and safety;
it is not proof of every implementation detail or deployable code.

### Thought 4

Branch C offers no measured advantage here. Branch B preserves domain separation
and useful findings, but adds context and coordination with no clear speed win
in this sample. Branch A exposes a substantial opportunity in fewer model hops,
but fails the safety check. The next candidate is therefore **a compact draft
plus fresh, focused review under an explicit host-owned contract**.

The candidate is implemented as --review-workflows: two fresh D -> R trials,
two sends nominally each. Both stages read all nine sources, use the same final
brief and binding host constraints. R receives only D's selected artifact plus
actual source reads, not private draft reasoning/history; it must correct
unsupported or unsafe recommendations and identify the correction/verification.
This is research review, not the product's Verifier role or a code approval.

The 60-request ceiling is exhausted. The prepared command is blocked before
provider dispatch until an explicit four-request allowance is granted. This
proposed allowance preserves concurrency two, 4,000 output tokens per request,
20 minutes per invocation, and counts retries. No extra request has been sent.

Verification checklist: branches were compared against the same final brief;
the fastest unsafe draft was rejected; no timing result is generalized; actual
tool results and handoffs were checked; follow-up claims remain unestablished.

### Final

Recommended build direction: **one conductor, few model hops, and hard evidence
and review boundaries**, with read-only fan-out selected by real data dependency
and work size. Do not make full asynchronous background sessions the initial
performance investment on the strength of these results.

The reviewed-draft variant is a concrete prepared candidate; its speed and
semantic reliability are pending the live follow-up. No global optimum or
production-ready system is claimed.

## Build contract and integration map

1. **Choose research shape before spawning.** Bounded context and one coupled
   question use consolidated investigation. Distinct costly source domains can
   fan out read-only, with only the final synthesis joining them. Every edge
   names an input artifact; role labels alone do not create dependencies.
   Enforce this at Orchestrator planning, alongside `buildSystemPrompt` and
   `buildImplementationInstructionsPrompt`; prompting alone is not an authority
   gate. Existing examples already batch independent agents, so the change is
   concrete dependency/acceptance planning rather than adding another slogan.
2. **Keep evidence and authority in the host.** Before dispatch, pin objective,
   source identity, allowed tools/write scope, budget and acceptance checks.
   Resolve source references against captured bytes; reject missing or changed
   reads before consuming results. Product references should include symbols
   and source hashes; experimental line IDs are snapshot locators, not durable
   live-code identity. Never let a model grant itself tools or approve its output.
3. **Use existing aggregate spawn semantics first.** `handleSpawnAgents` and
   `runSingleSubagent` already provide the execution path. The current read-only
   tests have no detached child lifetime or parent wake-up requirement. Keep
   turn ownership and one writer. A bounded worker pool would need explicit
   admission/priority and nested-spawn analysis; array order is insufficient.
4. **Use fresh review for the right obligation.** The experimental R corrects
   research proposals. Production Verifier returns verdicts and cannot rewrite
   code; Thinker has no read tools and needs actual evidence supplied by its
   parent. Do not copy R into either role or grant new capabilities. Reuse
   `loadRawEvidenceForSpawn`, raw-evidence spill/splice and existing capability
   checks when constructing bounded, fresh evidence contexts.
5. **Preserve the engineering pipeline.** Converged FID -> Forge -> Verifier ->
   Adversary remains. Read-only code review and deterministic validation may
   overlap after Forge stops writing, but acceptance waits for both. Adversary
   must receive Verifier findings and actual evidence. Any later source change
   invalidates affected reads/reviews. This research does not authorize dropping
   a mandatory role, review trigger, test, receipt or phase transition.
6. **Separate delivery eligibility from resource accounting.** Generation and
   attempt identity may reject a late result's influence; they never erase
   observed or uncertain usage. Provider permits live only across physical
   requests/streams, not child waits or tool execution. Runtime projections
   must not double-count on replay. The current harness caps physical sends;
   it does not establish a monetary ceiling or production settlement ledger.
7. **Retain storage authority until async lifetime is required.** First build
   needs no canonical-session migration. If useful background work later
   requires a parent to return before children settle, the earlier task-service
   proposal's transactional inbox/state authority, cancellation and restart
   contracts must be implemented and tested. A mailbox beside filesystem-first
   restore does not supply those guarantees.

The smallest reviewable implementation slice is the bounded research-plan
contract and fresh evidence handoff, exercised through the existing spawn path.
Acceptance must include exact source/read identity, no unauthorized writer or
descendant, cancelled result rejection with retained usage, and required review
phases. Add broader task services only when measured workloads require them.
